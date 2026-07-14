import { createCipheriv, randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { gzipSync } from 'node:zlib';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');
const SOURCE_DIR = path.join(ROOT_DIR, 'references', '封存');
const OUTPUT_FILE = path.join(ROOT_DIR, 'private', 'umbra.bundle');
const ENV_FILE = path.join(ROOT_DIR, '.env.local');
const MAGIC = Buffer.from('UMBRA01');

async function readHiddenPassword() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    let value = '';
    for await (const chunk of process.stdin) value += chunk;
    return value.trim();
  }

  process.stdout.write('Umbra password: ');
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
    UMBRA_PASSWORD: process.env.UMBRA_PASSWORD || current.UMBRA_PASSWORD,
    UMBRA_SESSION_SECRET: current.UMBRA_SESSION_SECRET || randomBytes(32).toString('hex'),
    UMBRA_ARCHIVE_KEY: current.UMBRA_ARCHIVE_KEY || randomBytes(32).toString('hex'),
  };

  if (!values.UMBRA_PASSWORD) {
    values.UMBRA_PASSWORD = await readHiddenPassword();
  }

  if (!values.UMBRA_PASSWORD) {
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
    (_match, quote, fileName) => `${quote}/api/umbra?asset=${encodeURIComponent(`photos/${fileName}`)}${quote}`,
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
  const { UMBRA_ARCHIVE_KEY } = await ensureLocalSecrets();
  const files = await collectFiles(SOURCE_DIR);
  if (!files['index.html']) throw new Error('The archive is missing index.html');

  const payload = gzipSync(Buffer.from(JSON.stringify({ version: 1, files })));
  const key = Buffer.from(UMBRA_ARCHIVE_KEY, 'hex');
  if (key.length !== 32) throw new Error('UMBRA_ARCHIVE_KEY must be 32 random bytes encoded as hex');

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const authTag = cipher.getAuthTag();

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, Buffer.concat([MAGIC, iv, authTag, encrypted]));

  const megabytes = (encrypted.byteLength / 1024 / 1024).toFixed(2);
  process.stdout.write(`Encrypted ${Object.keys(files).length} archive files (${megabytes} MB).\n`);
}

await main();
