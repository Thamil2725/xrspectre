import axios from 'axios';
import { config } from '../config/env.js';
import { gradeExecution } from './grading.js';
import { HttpError } from '../middleware/errorHandler.js';

const piston = axios.create({
  baseURL: config.pistonUrl,
  timeout: 30000,
  headers: config.pistonApiKey ? { Authorization: config.pistonApiKey } : {},
});

const LANGUAGE_MAP = {
  javascript: { language: 'javascript', version: '*', filename: 'main.js' },
  python: { language: 'python', version: '*', filename: 'main.py' },
  c: { language: 'c', version: '*', filename: 'main.c' },
  cpp: { language: 'c++', version: '*', filename: 'main.cpp' },
  java: { language: 'java', version: '*', filename: 'Main.java' },
};

function resolveRuntime(languageId) {
  const runtime = LANGUAGE_MAP[languageId];
  if (!runtime) {
    throw new HttpError(400, `Unsupported language: ${languageId}`);
  }
  return runtime;
}

/**
 * Executes source code against a single stdin input via a Piston instance.
 * Returns a normalized result: { stdout, stderr, exitCode, timedOut, stage }.
 */
async function executeCodeViaPiston({ languageId, code, stdin = '', timeLimitSecs = 5, memoryLimitMB = 256 }) {
  const { language, version, filename } = resolveRuntime(languageId);

  let data;
  try {
    ({ data } = await piston.post('/api/v2/execute', {
      language,
      version,
      files: [{ name: filename, content: code }],
      stdin,
      run_timeout: timeLimitSecs * 1000,
      compile_timeout: 10000,
      run_memory_limit: memoryLimitMB * 1024 * 1024,
    }));
  } catch (err) {
    // Infrastructure failure — must not be graded as a wrong answer.
    console.error('Piston execution failed:', err.response?.status ?? '', err.message);
    throw new HttpError(503, 'The code execution service is unavailable. Please try again in a moment.');
  }

  // `compile` is only present for compiled languages and takes
  // precedence — a compile error means the run stage never happened.
  if (data.compile && data.compile.code !== 0) {
    return {
      stdout: '',
      stderr: data.compile.stderr || data.compile.output || 'Compilation failed.',
      exitCode: data.compile.code ?? 1,
      timedOut: data.compile.status === 'TO',
      stage: 'compile',
    };
  }

  return {
    stdout: data.run?.stdout ?? '',
    stderr: data.run?.stderr ?? '',
    exitCode: data.run?.code ?? (data.run?.signal ? 1 : null),
    timedOut: data.run?.status === 'TO',
    stage: 'run',
  };
}

export async function executeCode(params) {
  return executeCodeViaPiston({ timeLimitSecs: 5, memoryLimitMB: 256, ...params });
}

/**
 * Runs code against multiple test cases and reports pass/fail per case.
 * Used both for "Run" (sample tests) and "Submit" (internal tests).
 */
export async function runAgainstTestCases({ languageId, code, testCases, timeLimitSecs = 5, memoryLimitMB = 256 }) {
  const executions = await Promise.all(
    testCases.map((tc) => executeCodeViaPiston({ languageId, code, stdin: tc.input, timeLimitSecs, memoryLimitMB })),
  );
  return testCases.map((tc, i) => gradeExecution(tc, executions[i]));
}
