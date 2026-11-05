import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { config } from '../config/env.js';
import { gradeExecution } from './grading.js';
import { HttpError } from '../middleware/errorHandler.js';

// Runs code in a throw-away container built from ./sandbox-runner.
// Requires access to a Docker daemon, so it is meant for VM/self-hosted
// deployments — it is NOT available on Render web services.
const SANDBOX_IMAGE = config.dockerSandboxImage;

async function runDocker(input) {
  const jobDir = join(tmpdir(), `sandbox-${randomUUID()}`);
  await mkdir(jobDir, { recursive: true });

  try {
    await writeFile(join(jobDir, 'input.json'), JSON.stringify(input));

    const memLimit = input.memoryLimitMB ?? 256;
    const cpuLimit = memLimit > 512 ? 2 : 1;

    const args = [
      'run', '--rm',
      '--network', 'none',
      '--memory', `${memLimit}m`,
      '--memory-swap', `${memLimit}m`,
      '--cpus', String(cpuLimit),
      '--pids-limit', '64',
      '--read-only',
      '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges',
      '--tmpfs', '/tmp:size=16m,noexec,nosuid',
      '-v', `${jobDir}:/workspace:rw`,
      SANDBOX_IMAGE,
    ];

    let output;
    try {
      output = await new Promise((resolve, reject) => {
        execFile('docker', args, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
          if (err && err.killed) return reject(new Error('Sandbox timed out.'));
          if (err && !stdout) return reject(new Error(String(stderr).slice(0, 500) || 'Sandbox execution failed.'));
          resolve(stdout);
        });
      });
    } catch (err) {
      console.error('Docker sandbox failed:', err.message);
      throw new HttpError(503, 'The code execution service is unavailable. Please try again in a moment.');
    }

    const text = output.toString().trim();
    const lastLine = text.slice(text.lastIndexOf('\n') + 1);
    let parsed;
    try {
      parsed = JSON.parse(lastLine);
    } catch {
      throw new HttpError(503, 'The code execution service returned an invalid response.');
    }
    if (parsed.error) throw new HttpError(400, parsed.error);
    return parsed.results ?? [];
  } finally {
    rm(jobDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function executeCode({ languageId, code, stdin = '', timeLimitSecs = 5, memoryLimitMB = 256 }) {
  const [r] = await runDocker({
    language: languageId,
    code,
    timeLimitSecs,
    memoryLimitMB,
    testCases: [{ id: 'custom', input: stdin }],
  });
  return {
    stdout: r?.stdout ?? '',
    stderr: r?.stderr ?? 'No result.',
    exitCode: r?.exitCode ?? 1,
    timedOut: !!r?.timedOut,
    stage: 'run',
  };
}

export async function runAgainstTestCases({ languageId, code, testCases, timeLimitSecs = 5, memoryLimitMB = 256 }) {
  if (testCases.length === 0) return [];

  const raw = await runDocker({
    language: languageId,
    code,
    timeLimitSecs,
    memoryLimitMB,
    testCases: testCases.map((tc) => ({ id: tc.id, input: tc.input ?? '' })),
  });
  const byId = new Map(raw.map((r) => [r.id, r]));
  return testCases.map((tc) => gradeExecution(tc, byId.get(tc.id) ?? { stdout: '', stderr: 'No result.', exitCode: 1 }));
}
