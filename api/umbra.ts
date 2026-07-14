import { createDecipheriv, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const COOKIE_NAME = 'umbra_pass';
const SESSION_SECONDS = 60 * 45;
const ASSET_URL_SECONDS = 60 * 45;
const MAGIC = Buffer.from('UMBRA01');
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_REQUEST_TIMEOUT_MS = 2500;
const RATE_LIMIT_LUA = [
  "local count = redis.call('INCR', KEYS[1])",
  "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('PTTL', KEYS[1])",
  "if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end",
  'return {count, ttl}',
].join('\n');

interface ArchiveFile {
  contentType: string;
  data: string;
}

interface ArchiveManifest {
  version: number;
  files: Record<string, ArchiveFile>;
}

interface AttemptWindow {
  count: number;
  resetsAt: number;
}

interface RedisRestConfig {
  url: string;
  token: string;
}

interface RedisRestResponse<T> {
  result?: T;
  error?: string;
}

const attempts = new Map<string, AttemptWindow>();
let manifestPromise: Promise<ArchiveManifest> | null = null;

class PayloadTooLargeError extends Error {}
class RateLimitUnavailableError extends Error {}

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function json(body: Record<string, unknown>, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: { ...PRIVATE_HEADERS, ...extraHeaders },
  });
}

function getRequiredEnv(name: 'UMBRA_PASSWORD' | 'UMBRA_SESSION_SECRET' | 'UMBRA_ARCHIVE_KEY') {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function fixedDigest(value: string) {
  return createHash('sha256').update(value, 'utf8').digest();
}

function passwordMatches(candidate: string) {
  return timingSafeEqual(fixedDigest(candidate), fixedDigest(getRequiredEnv('UMBRA_PASSWORD')));
}

function signExpiry(expiresAt: string) {
  return createHmac('sha256', getRequiredEnv('UMBRA_SESSION_SECRET'))
    .update(`umbra:${expiresAt}`)
    .digest('base64url');
}

function signAsset(fileName: string, expiresAt: string) {
  return createHmac('sha256', getRequiredEnv('UMBRA_SESSION_SECRET'))
    .update(`umbra-asset:${expiresAt}:${fileName}`)
    .digest('base64url');
}

function createSignedAssetUrl(fileName: string, expiresAt: string) {
  const signature = signAsset(fileName, expiresAt);
  return `/api/umbra?asset=${encodeURIComponent(fileName)}&expires=${expiresAt}&sig=${signature}`;
}

function hasValidAssetSignature(url: URL, fileName: string) {
  const expiresAt = url.searchParams.get('expires');
  const signature = url.searchParams.get('sig');
  if (!expiresAt || !signature || !/^\d{10}$/.test(expiresAt)) return false;
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;

  const expected = Buffer.from(signAsset(fileName, expiresAt));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function attachSignedAssetUrls(bytes: Buffer) {
  const expiresAt = String(Math.floor(Date.now() / 1000) + ASSET_URL_SECONDS);
  const html = bytes.toString('utf8').replace(
    /\/api\/umbra\?asset=([^"'&<>\s]+)/g,
    (match, encodedFileName: string) => {
      try {
        return createSignedAssetUrl(decodeURIComponent(encodedFileName), expiresAt);
      } catch {
        return match;
      }
    },
  );
  return Buffer.from(html, 'utf8');
}

function createSessionCookie(request: Request) {
  const expiresAt = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  const token = `${expiresAt}.${signExpiry(expiresAt)}`;
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; Path=/api/umbra; Max-Age=${SESSION_SECONDS}; HttpOnly; SameSite=Strict${secure}`;
}

function readCookie(request: Request) {
  const source = request.headers.get('cookie') || '';
  for (const entry of source.split(';')) {
    const [name, ...parts] = entry.trim().split('=');
    if (name === COOKIE_NAME) return parts.join('=');
  }
  return null;
}

function hasValidSession(request: Request) {
  const token = readCookie(request);
  if (!token) return false;
  const [expiresAt, signature] = token.split('.');
  if (!expiresAt || !signature || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;

  const expected = Buffer.from(signExpiry(expiresAt));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function isDevelopmentRuntime() {
  const vercelEnvironment = process.env.VERCEL_ENV;
  if (vercelEnvironment) return vercelEnvironment === 'development';
  if (process.env.VERCEL === '1') return false;
  return process.env.NODE_ENV !== 'production';
}

function clientAddress(request: Request) {
  const source = request.headers.get('x-vercel-forwarded-for')
    || request.headers.get('x-forwarded-for')
    || request.headers.get('x-real-ip')
    || 'local';
  return source.split(',')[0].trim().slice(0, 128) || 'local';
}

function clientRateLimitKey(request: Request) {
  const digest = createHmac('sha256', getRequiredEnv('UMBRA_SESSION_SECRET'))
    .update(`umbra-rate-ip:${clientAddress(request)}`)
    .digest('base64url');
  return `umbra:unlock:v1:${digest}`;
}

function getRedisRestConfig() {
  const candidates = [
    {
      url: process.env.UPSTASH_REDIS_REST_URL?.trim(),
      token: process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
    },
    {
      url: process.env.KV_REST_API_URL?.trim(),
      token: process.env.KV_REST_API_TOKEN?.trim(),
    },
  ];
  const configured = candidates.find(
    (candidate): candidate is RedisRestConfig => Boolean(candidate.url && candidate.token),
  );
  if (!configured) {
    const partiallyConfigured = candidates.some((candidate) => candidate.url || candidate.token);
    if (partiallyConfigured) throw new RateLimitUnavailableError();
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(configured.url);
  } catch {
    throw new RateLimitUnavailableError();
  }
  if (parsedUrl.username || parsedUrl.password || parsedUrl.search || parsedUrl.hash) {
    throw new RateLimitUnavailableError();
  }
  if (parsedUrl.protocol !== 'https:' && !isDevelopmentRuntime()) {
    throw new RateLimitUnavailableError();
  }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new RateLimitUnavailableError();
  }

  return {
    url: parsedUrl.toString().replace(/\/$/, ''),
    token: configured.token,
  } satisfies RedisRestConfig;
}

async function runRedisCommand<T>(config: RedisRestConfig, command: Array<string | number>) {
  let response: Response;
  try {
    response = await fetch(config.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      cache: 'no-store',
      signal: AbortSignal.timeout(RATE_LIMIT_REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new RateLimitUnavailableError();
  }

  if (!response.ok) throw new RateLimitUnavailableError();
  let payload: RedisRestResponse<T>;
  try {
    payload = await response.json() as RedisRestResponse<T>;
  } catch {
    throw new RateLimitUnavailableError();
  }
  if (payload.error || !Object.prototype.hasOwnProperty.call(payload, 'result')) {
    throw new RateLimitUnavailableError();
  }
  return payload.result as T;
}

function consumeLocalAttempt(request: Request) {
  const key = clientRateLimitKey(request);
  const now = Date.now();
  const current = attempts.get(key);

  if (!current || current.resetsAt <= now) {
    attempts.set(key, { count: 1, resetsAt: now + ATTEMPT_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  current.count += 1;
  return {
    allowed: current.count <= MAX_ATTEMPTS,
    retryAfter: Math.max(1, Math.ceil((current.resetsAt - now) / 1000)),
  };
}

async function consumeAttempt(request: Request) {
  const config = getRedisRestConfig();
  if (!config) {
    if (!isDevelopmentRuntime()) throw new RateLimitUnavailableError();
    return consumeLocalAttempt(request);
  }

  const result = await runRedisCommand<unknown>(config, [
    'EVAL',
    RATE_LIMIT_LUA,
    1,
    clientRateLimitKey(request),
    ATTEMPT_WINDOW_MS,
  ]);
  if (!Array.isArray(result) || result.length < 2) throw new RateLimitUnavailableError();
  const count = Number(result[0]);
  const ttlMs = Number(result[1]);
  if (!Number.isSafeInteger(count) || count < 1 || !Number.isFinite(ttlMs)) {
    throw new RateLimitUnavailableError();
  }
  return {
    allowed: count <= MAX_ATTEMPTS,
    retryAfter: count <= MAX_ATTEMPTS ? 0 : Math.max(1, Math.ceil(Math.max(0, ttlMs) / 1000)),
  };
}

async function clearAttempts(request: Request) {
  const key = clientRateLimitKey(request);
  const config = getRedisRestConfig();
  if (!config) {
    if (!isDevelopmentRuntime()) throw new RateLimitUnavailableError();
    attempts.delete(key);
    return;
  }

  const deleted = await runRedisCommand<unknown>(config, ['DEL', key]);
  if (!Number.isSafeInteger(Number(deleted)) || Number(deleted) < 0) {
    throw new RateLimitUnavailableError();
  }
}

async function loadManifest() {
  if (manifestPromise) return manifestPromise;

  manifestPromise = (async () => {
    const bundlePath = path.join(process.cwd(), 'private', 'umbra.bundle');
    const bundle = await fs.readFile(bundlePath);
    if (!bundle.subarray(0, MAGIC.length).equals(MAGIC)) {
      throw new Error('The encrypted archive has an invalid signature');
    }

    const key = Buffer.from(getRequiredEnv('UMBRA_ARCHIVE_KEY'), 'hex');
    if (key.length !== 32) throw new Error('UMBRA_ARCHIVE_KEY is invalid');

    const ivStart = MAGIC.length;
    const tagStart = ivStart + 12;
    const payloadStart = tagStart + 16;
    const decipher = createDecipheriv('aes-256-gcm', key, bundle.subarray(ivStart, tagStart));
    decipher.setAuthTag(bundle.subarray(tagStart, payloadStart));
    const compressed = Buffer.concat([decipher.update(bundle.subarray(payloadStart)), decipher.final()]);
    return JSON.parse(gunzipSync(compressed).toString('utf8')) as ArchiveManifest;
  })().catch((error) => {
    manifestPromise = null;
    throw error;
  });

  return manifestPromise;
}

function hiddenNotFound() {
  return new Response('Not Found', { status: 404, headers: PRIVATE_HEADERS });
}

async function readBoundedBody(request: Request, maxBytes: number) {
  const reader = request.body?.getReader();
  if (!reader) return '';

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError();
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks).toString('utf8');
}

async function handlePost(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return hiddenNotFound();

  const contentType = request.headers.get('content-type') || '';
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) return json({ ok: false }, 415);

  const length = Number(request.headers.get('content-length') || 0);
  if (length > 1024) return json({ ok: false }, 413);

  let attempt: { allowed: boolean; retryAfter: number };
  try {
    attempt = await consumeAttempt(request);
  } catch {
    console.error('Umbra rate limiter is unavailable');
    return json({ ok: false, reason: 'unavailable' }, 503);
  }
  if (!attempt.allowed) {
    return json({ ok: false, reason: 'cooldown' }, 429, { 'Retry-After': String(attempt.retryAfter) });
  }

  let password: string;
  try {
    const rawBody = await readBoundedBody(request, 1024);
    const body = JSON.parse(rawBody) as { password?: unknown };
    password = typeof body.password === 'string' ? body.password.slice(0, 128) : '';
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return json({ ok: false }, 413);
    return json({ ok: false }, 400);
  }

  try {
    if (!passwordMatches(password)) {
      await new Promise((resolve) => setTimeout(resolve, 280));
      return json({ ok: false }, 200);
    }

    await loadManifest();
    await clearAttempts(request);
    return json({ ok: true, destination: '/api/umbra' }, 200, {
      'Set-Cookie': createSessionCookie(request),
    });
  } catch (error) {
    console.error(
      error instanceof RateLimitUnavailableError
        ? 'Umbra rate limiter is unavailable'
        : `Umbra archive unlock failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    return json({ ok: false, reason: 'unavailable' }, 503);
  }
}

async function handleGet(request: Request) {
  const url = new URL(request.url);
  const requestedAsset = url.searchParams.get('asset');
  const sessionIsValid = hasValidSession(request);
  const signedAssetIsValid = Boolean(requestedAsset && hasValidAssetSignature(url, requestedAsset));
  if (!sessionIsValid && !signedAssetIsValid) return hiddenNotFound();

  try {
    const manifest = await loadManifest();
    const fileName = requestedAsset || 'index.html';
    if (!Object.prototype.hasOwnProperty.call(manifest.files, fileName)) return hiddenNotFound();
    const file = manifest.files[fileName];

    const sourceBytes = Buffer.from(file.data, 'base64');
    const bytes = fileName === 'index.html' ? attachSignedAssetUrls(sourceBytes) : sourceBytes;
    return new Response(request.method === 'HEAD' ? null : bytes, {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        'Content-Type': file.contentType,
        'Content-Length': String(bytes.byteLength),
        ...(fileName === 'index.html' ? { 'Set-Cookie': createSessionCookie(request) } : {}),
      },
    });
  } catch (error) {
    console.error('Umbra archive delivery failed:', error instanceof Error ? error.message : 'unknown error');
    return hiddenNotFound();
  }
}

async function handle(request: Request) {
  if (request.method === 'POST') return handlePost(request);
  if (request.method === 'GET' || request.method === 'HEAD') return handleGet(request);
  return new Response('Method Not Allowed', {
    status: 405,
    headers: { ...PRIVATE_HEADERS, Allow: 'GET, HEAD, POST' },
  });
}

export default { fetch: handle };
