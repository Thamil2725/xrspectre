import { config } from '../config/env.js';
import * as pistonService from './pistonService.js';
import * as judge0Service from './judge0Service.js';
import * as dockerSandboxService from './dockerSandboxService.js';
import { normalizeOutput } from './grading.js';

// Stub executor (EXECUTION_PROVIDER=stub): no code is run and every test
// case is reported as passed. Only for local UI development — it is
// refused in production unless ALLOW_STUB_EXECUTION=true.
const stubService = {
  async executeCode({ stdin = '' }) {
    return { stdout: stdin, stderr: '', exitCode: 0, timedOut: false, stage: 'run' };
  },
  async runAgainstTestCases({ testCases }) {
    return testCases.map((tc) => ({
      testCaseId: tc.id,
      passed: true,
      expectedOutput: normalizeOutput(tc.output),
      actualOutput: normalizeOutput(tc.output),
      stderr: '',
      timedOut: false,
      stub: true,
    }));
  },
};

const PROVIDERS = {
  piston: pistonService,
  judge0: judge0Service,
  docker: dockerSandboxService,
  stub: stubService,
};

function executor() {
  return PROVIDERS[config.executionProvider];
}

export async function executeCode(params) {
  return executor().executeCode(params);
}

export async function runAgainstTestCases(params) {
  if (!params.testCases || params.testCases.length === 0) return [];
  return executor().runAgainstTestCases(params);
}
