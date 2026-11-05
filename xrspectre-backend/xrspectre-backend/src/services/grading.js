// Shared output comparison used by every execution provider.
//
// Outputs are compared after normalising line endings and trailing
// whitespace on each line, so a stray "\r\n" (Windows-authored test
// cases) or a trailing space doesn't fail an otherwise-correct answer.
export function normalizeOutput(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .trim();
}

// A test case passes when the program finished in time, exited
// successfully and printed the expected output. Exit status (not "was
// anything written to stderr") decides success, so debug prints or JVM
// notices on stderr don't fail a correct solution.
export function gradeExecution(testCase, execution) {
  const actualOutput = normalizeOutput(execution.stdout);
  const expectedOutput = normalizeOutput(testCase.output);
  const exitedCleanly = execution.exitCode === 0 || (execution.exitCode == null && !execution.stderr);
  return {
    testCaseId: testCase.id,
    passed: !execution.timedOut && exitedCleanly && actualOutput === expectedOutput,
    expectedOutput,
    actualOutput,
    stderr: execution.stderr ?? '',
    timedOut: !!execution.timedOut,
  };
}
