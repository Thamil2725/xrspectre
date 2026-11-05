// Runs inside the isolated sandbox container (no network, read-only root,
// memory/CPU/pid limits). Compiles once, then executes every test case
// and prints a single JSON line with the raw results. Grading happens in
// the API process (src/services/grading.js).
const { readFileSync, writeFileSync } = require('node:fs');
const { execFileSync, spawnSync } = require('node:child_process');

const input = JSON.parse(readFileSync('/workspace/input.json', 'utf-8'));
const { language, code, testCases, timeLimitSecs } = input;

const LANG = {
  javascript: { filename: 'code.js', compile: null, run: ['node', 'code.js'] },
  python: { filename: 'code.py', compile: null, run: ['python3', 'code.py'] },
  c: { filename: 'code.c', compile: ['gcc', 'code.c', '-o', 'code', '-O2', '-std=c11', '-lm'], run: ['./code'] },
  cpp: { filename: 'code.cpp', compile: ['g++', 'code.cpp', '-o', 'code', '-O2', '-std=c++17'], run: ['./code'] },
  java: { filename: 'Main.java', compile: ['javac', 'Main.java'], run: ['java', '-cp', '.', 'Main'] },
};

const MAX_OUTPUT = 1024 * 1024; // 1 MB per stream

const lang = LANG[language];
if (!lang) {
  console.log(JSON.stringify({ error: `Unsupported language: ${language}` }));
  process.exit(0);
}

writeFileSync(lang.filename, code, 'utf-8');

if (lang.compile) {
  try {
    execFileSync(lang.compile[0], lang.compile.slice(1), { timeout: 15000, stdio: 'pipe' });
  } catch (e) {
    const stderr = (e.stderr ? e.stderr.toString() : '') || 'Compilation failed.';
    const results = testCases.map((tc) => ({ id: tc.id, stdout: '', stderr, exitCode: 1, timedOut: false }));
    console.log(JSON.stringify({ results }));
    process.exit(0);
  }
}

const results = [];
for (const tc of testCases) {
  const child = spawnSync(lang.run[0], lang.run.slice(1), {
    input: tc.input || '',
    timeout: (timeLimitSecs || 5) * 1000,
    maxBuffer: MAX_OUTPUT,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const timedOut = !!(child.error && child.error.code === 'ETIMEDOUT');
  const overflow = !!(child.error && child.error.code === 'ENOBUFS');
  results.push({
    id: tc.id,
    stdout: (child.stdout || '').toString(),
    stderr: timedOut ? 'Time limit exceeded.' : overflow ? 'Output limit exceeded.' : (child.stderr || '').toString(),
    exitCode: timedOut || overflow ? 1 : child.status,
    timedOut,
  });
}

console.log(JSON.stringify({ results }));
