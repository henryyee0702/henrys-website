import { createCipheriv, randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { gzipSync } from 'node:zlib';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const ENV_FILE = path.join(ROOT_DIR, '.env.local');
const MAGIC = Buffer.from('UMBRA01');
const PROFILE_NAME = process.argv[2] || 'umbra';
const PROFILES = {
  umbra: {
    sourceDir: path.join(ROOT_DIR, 'references', '封存'),
    outputFile: path.join(ROOT_DIR, 'private', 'umbra.bundle'),
    endpoint: '/api/umbra',
    passwordKey: 'UMBRA_PASSWORD',
    archiveKey: 'UMBRA_ARCHIVE_KEY',
    sessionKey: 'UMBRA_SESSION_SECRET',
  },
  birthday: {
    sourceDir: process.argv[3] || path.join(ROOT_DIR, 'references', 'birthday-card'),
    entryFileOnly: true,
    outputFile: path.join(ROOT_DIR, 'private', 'birthday.bundle'),
    endpoint: '/api/birthday',
    passwordKey: 'BIRTHDAY_PASSWORD',
    archiveKey: 'BIRTHDAY_ARCHIVE_KEY',
    sessionKey: 'BIRTHDAY_SESSION_SECRET',
  },
};
const profile = PROFILES[PROFILE_NAME];

if (!profile) {
  throw new Error(`Unknown archive profile: ${PROFILE_NAME}`);
}

async function readHiddenPassword() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    let value = '';
    for await (const chunk of process.stdin) value += chunk;
    return value.trim();
  }

  process.stdout.write(`${PROFILE_NAME} password: `);
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (error) => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') return finish(new Error('Password entry cancelled'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f') {
          value = value.slice(0, -1);
        } else if (character >= ' ') {
          value += character;
        }
      }
    };
    process.stdin.on('data', onData);
  });
}

function parseEnv(source) {
  const entries = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    entries[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return entries;
}

async function ensureLocalSecrets() {
  let source = '';
  try {
    source = await fs.readFile(ENV_FILE, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const current = parseEnv(source);
  const values = {
    [profile.passwordKey]: process.env[profile.passwordKey] || current[profile.passwordKey],
    [profile.sessionKey]: current[profile.sessionKey] || randomBytes(32).toString('hex'),
    [profile.archiveKey]: current[profile.archiveKey] || randomBytes(32).toString('hex'),
  };

  if (!values[profile.passwordKey]) {
    values[profile.passwordKey] = await readHiddenPassword();
  }

  if (!values[profile.passwordKey]) {
    throw new Error('The private password cannot be empty');
  }

  const missingLines = Object.entries(values)
    .filter(([key]) => !current[key])
    .map(([key, value]) => `${key}=${value}`);

  if (missingLines.length > 0) {
    const separator = source.length === 0 || source.endsWith('\n') ? '' : '\n';
    await fs.writeFile(ENV_FILE, `${source}${separator}${missingLines.join('\n')}\n`, { mode: 0o600 });
  }
  await fs.chmod(ENV_FILE, 0o600);

  return values;
}

function detectContentType(filePath, bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  return 'application/octet-stream';
}

function prepareHtml(source) {
  const withoutBlockedFont = source.replace(
    /\s*<link\s+rel="stylesheet"\s+href="https:\/\/cdn\.jsdelivr\.net\/npm\/lxgw-wenkai-tc-webfont@[^"\s]+\/style\.css"\s*\/?>/gi,
    '',
  );
  const noInlineErrorHandlers = withoutBlockedFont.replace(/\s+onerror\s*=\s*"[\s\S]*?"/gi, '');
  const withProtectedAssets = noInlineErrorHandlers.replace(
    /(["'])photos\/([^"']+)\1/g,
    (_match, quote, fileName) => `${quote}${profile.endpoint}?asset=${encodeURIComponent(`photos/${fileName}`)}${quote}`,
  );

  return withProtectedAssets.replace(
    /<head>/i,
    '<head>\n    <meta name="robots" content="noindex, nofollow, noarchive" />',
  );
}

async function collectFiles(directory, prefix = '') {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = {};

  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue;
    if (entry.isSymbolicLink()) {
      throw new Error(`Refusing to archive symbolic link: ${path.posix.join(prefix, entry.name)}`);
    }
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.posix.join(prefix, entry.name);

    if (entry.isDirectory()) {
      Object.assign(files, await collectFiles(absolutePath, relativePath));
      continue;
    }

    const raw = await fs.readFile(absolutePath);
    const bytes = relativePath === 'index.html'
      ? Buffer.from(prepareHtml(raw.toString('utf8')))
      : raw;

    files[relativePath] = {
      contentType: detectContentType(relativePath, bytes),
      data: bytes.toString('base64'),
    };
  }

  return files;
}

async function main() {
  const secrets = await ensureLocalSecrets();
  const files = profile.entryFileOnly
    ? {
        'index.html': {
          contentType: 'text/html; charset=utf-8',
          data: Buffer.from(prepareHtml(await fs.readFile(path.join(profile.sourceDir, 'index.html'), 'utf8'))).toString('base64'),
        },
      }
    : await collectFiles(profile.sourceDir);
  if (!files['index.html']) throw new Error('The archive is missing index.html');

  const payload = gzipSync(Buffer.from(JSON.stringify({ version: 1, files })));
  const key = Buffer.from(secrets[profile.archiveKey], 'hex');
  if (key.length !== 32) throw new Error(`${profile.archiveKey} must be 32 random bytes encoded as hex`);

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const authTag = cipher.getAuthTag();

  await fs.mkdir(path.dirname(profile.outputFile), { recursive: true });
  await fs.writeFile(profile.outputFile, Buffer.concat([MAGIC, iv, authTag, encrypted]));

  const megabytes = (encrypted.byteLength / 1024 / 1024).toFixed(2);
  process.stdout.write(`Encrypted ${Object.keys(files).length} ${PROFILE_NAME} archive files (${megabytes} MB).\n`);
}

await main();
