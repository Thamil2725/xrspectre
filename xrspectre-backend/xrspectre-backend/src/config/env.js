import 'dotenv/config';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VALID_PROVIDERS = ['piston', 'judge0', 'docker', 'stub'];
const isProduction = process.env.NODE_ENV === 'production';

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function bool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

required('DATABASE_URL');

const rawJwtSecret = required('JWT_SECRET');
if (rawJwtSecret === 'change-this-to-a-long-random-string' || rawJwtSecret.length < 32) {
  throw new Error('JWT_SECRET is too short or still set to the default value. Generate a strong random secret (at least 32 characters).');
}

const rawProvider = process.env.EXECUTION_PROVIDER || 'piston';
if (!VALID_PROVIDERS.includes(rawProvider)) {
  throw new Error(`Invalid EXECUTION_PROVIDER "${rawProvider}". Must be one of: ${VALID_PROVIDERS.join(', ')}`);
}

// The stub provider reports EVERY test case as passed. Running it in
// production silently gives every student full marks, so it has to be
// opted into explicitly.
if (isProduction && rawProvider === 'stub' && !bool('ALLOW_STUB_EXECUTION', false)) {
  throw new Error('EXECUTION_PROVIDER=stub marks every submission as passed and is disabled in production. Configure judge0/piston, or set ALLOW_STUB_EXECUTION=true for a demo deployment.');
}

// Express "trust proxy" setting. Render (and most PaaS hosts) put exactly
// one reverse proxy in front of the app, so the default is 1 hop.
function parseTrustProxy(raw) {
  if (raw === undefined || raw === '') return 1;
  if (raw === 'false') return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw; // e.g. "loopback" or a comma-separated subnet list
}

// Location of the built frontend (vite `dist`). When it exists the API
// also serves the single-page app, so frontend + backend deploy as one
// Render web service on a single origin.
const here = dirname(fileURLToPath(import.meta.url));
const defaultStaticDir = resolve(here, '../../../../xrspectre-platform/xrspectre-platform/dist');
const staticDir = process.env.STATIC_DIR ? resolve(process.env.STATIC_DIR) : defaultStaticDir;

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 4000,
  jwtSecret: rawJwtSecret,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  clientOrigin: (process.env.CLIENT_ORIGIN || (isProduction ? '' : 'http://localhost:5173,http://localhost:5174,http://localhost:5175'))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  staticDir: existsSync(resolve(staticDir, 'index.html')) ? staticDir : null,

  executionProvider: rawProvider,
  pistonUrl: process.env.PISTON_URL || 'http://localhost:2000',
  pistonApiKey: process.env.PISTON_API_KEY || '',
  judge0Url: (process.env.JUDGE0_URL || 'http://localhost:2358').replace(/\/+$/, ''),
  judge0AuthToken: process.env.JUDGE0_AUTH_TOKEN || '',
  judge0RapidApiKey: process.env.JUDGE0_RAPIDAPI_KEY || '',
  judge0RapidApiHost: process.env.JUDGE0_RAPIDAPI_HOST || '',
  dockerSandboxImage: process.env.DOCKER_SANDBOX_IMAGE || 'xrspectre-sandbox',

  // Anti-cheat: lock an attempt to the network it was started from.
  // Students behind carrier-grade NAT or dual-stack IPv4/IPv6 can change
  // IP mid-test, so this can be disabled per deployment.
  enforceAttemptIpLock: bool('ENFORCE_ATTEMPT_IP_LOCK', true),

  // TEMPORARY testing aid: show the admin login (ADMIN_EMAIL /
  // ADMIN_PASSWORD) on the login page. Anyone who opens the site can then
  // sign in as admin, so turn it off before real use.
  showLoginCredentials: bool('SHOW_LOGIN_CREDENTIALS', false),
};
