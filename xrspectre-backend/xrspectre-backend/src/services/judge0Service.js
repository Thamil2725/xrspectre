import axios from 'axios';
import { config } from '../config/env.js';
import { gradeExecution } from './grading.js';
import { HttpError } from '../middleware/errorHandler.js';

// Judge0 CE client. Works with a self-hosted Judge0 (optionally protected
// by AUTHN_TOKEN → JUDGE0_AUTH_TOKEN) or the RapidAPI-hosted instance
// (JUDGE0_RAPIDAPI_KEY + JUDGE0_RAPIDAPI_HOST).
const headers = {};
if (config.judge0AuthToken) headers['X-Auth-Token'] = config.judge0AuthToken;
if (config.judge0RapidApiKey) {
  headers['X-RapidAPI-Key'] = config.judge0RapidApiKey;
  headers['X-RapidAPI-Host'] = config.judge0RapidApiHost || new URL(config.judge0Url).host;
}

const judge0 = axios.create({
  baseURL: config.judge0Url,
  timeout: 30000,
  headers,
});

const LANGUAGE_MAP = {
  javascript: 63, // Node.js
  python: 71,     // Python 3
  c: 50,          // C (GCC)
  cpp: 54,        // C++ (GCC)
  java: 62,       // Java (OpenJDK)
};

// Judge0's default server-side maximums (cpu_time_limit 15s,
// memory_limit 512000 KB). Requests above them are rejected with 422.
const MAX_CPU_SECONDS = 15;
const MAX_MEMORY_KB = 512000;
const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 60000;
const RESULT_FIELDS = 'token,stdout,stderr,compile_output,message,exit_code,status';

function resolveLanguageId(languageId) {
  const id = LANGUAGE_MAP[languageId];
  if (!id) throw new Error(`Unsupported language: ${languageId}`);
  return id;
}

const encode = (text) => Buffer.from(String(text ?? ''), 'utf8').toString('base64');
const decode = (text) => (text ? Buffer.from(text, 'base64').toString('utf8') : '');

function buildSubmission({ languageId, code, stdin, timeLimitSecs, memoryLimitMB }) {
  const cpu = Math.min(Math.max(1, timeLimitSecs ?? 5), MAX_CPU_SECONDS);
  return {
    source_code: encode(code),
    language_id: resolveLanguageId(languageId),
    stdin: encode(stdin),
    cpu_time_limit: cpu,
    wall_time_limit: Math.min(cpu * 2 + 1, MAX_CPU_SECONDS * 2),
    memory_limit: Math.min(Math.max(32, memoryLimitMB ?? 256) * 1024, MAX_MEMORY_KB),
  };
}

function parseSubmission(data) {
  const statusId = data.status?.id ?? 13;

  if (statusId === 6) {
    return {
      stdout: '',
      stderr: decode(data.compile_output) || 'Compilation failed.',
      exitCode: 1,
      timedOut: false,
      stage: 'compile',
    };
  }

  const isRuntimeError = statusId >= 7 && statusId <= 14;
  return {
    stdout: decode(data.stdout),
    stderr: decode(data.stderr) || (isRuntimeError ? `Runtime error (${data.status?.description ?? 'unknown'})` : ''),
    // Status 3 = Accepted, 4 = Wrong Answer (we don't pass expected_output,
    // so 4 never appears). Anything else is a failure even without an exit code.
    exitCode: data.exit_code ?? (statusId === 3 ? 0 : 1),
    timedOut: statusId === 5,
    stage: 'run',
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// POST /submissions/batch only returns tokens (Judge0 does not support
// ?wait=true for batches), so poll until every submission has left the
// "In Queue" (1) / "Processing" (2) states.
async function runBatch(submissions) {
  const { data: created } = await judge0.post(
    '/submissions/batch',
    { submissions },
    { params: { base64_encoded: true } },
  );
  const tokens = (Array.isArray(created) ? created : created?.submissions ?? []).map((s) => s.token);
  if (tokens.length !== submissions.length || tokens.some((t) => !t)) {
    throw new Error('Judge0 rejected the submission batch.');
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    const { data } = await judge0.get('/submissions/batch', {
      params: { tokens: tokens.join(','), base64_encoded: true, fields: RESULT_FIELDS },
    });
    const results = data?.submissions ?? [];
    const pending = results.some((r) => !r || (r.status?.id ?? 1) <= 2);
    if (!pending && results.length === tokens.length) return results;
    if (Date.now() > deadline) throw new Error('Judge0 did not finish in time.');
    await sleep(POLL_INTERVAL_MS);
  }
}

export async function executeCode({ languageId, code, stdin = '', timeLimitSecs = 5, memoryLimitMB = 256 }) {
  try {
    const [result] = await runBatch([buildSubmission({ languageId, code, stdin, timeLimitSecs, memoryLimitMB })]);
    return parseSubmission(result);
  } catch (err) {
    console.error('Judge0 execution failed:', err.response?.status ?? '', err.message);
    throw new HttpError(503, 'The code execution service is unavailable. Please try again in a moment.');
  }
}

export async function runAgainstTestCases({ languageId, code, testCases, timeLimitSecs = 5, memoryLimitMB = 256 }) {
  if (testCases.length === 0) return [];

  let results;
  try {
    results = await runBatch(testCases.map((tc) => buildSubmission({
      languageId, code, stdin: tc.input, timeLimitSecs, memoryLimitMB,
    })));
  } catch (err) {
    // Never grade an infrastructure failure as a wrong answer: surface it
    // so no submission is recorded and the student can retry.
    console.error('Judge0 execution failed:', err.response?.status ?? '', err.message);
    throw new HttpError(503, 'The code execution service is unavailable. Please try again in a moment.');
  }

  return testCases.map((tc, i) => gradeExecution(tc, parseSubmission(results[i])));
}
