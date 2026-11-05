import { api, API_BASE_URL, authHeaders } from './client.js';

export const listAvailableTests = () => api.get('/student/tests');
export const startOrResumeAttempt = (testId) => api.post(`/student/tests/${testId}/attempt`);
export const runCode = (testId, payload) => api.post(`/student/tests/${testId}/run`, payload);
export const submitQuestion = (testId, payload) => api.post(`/student/tests/${testId}/submit-question`, payload);

// Fire-and-forget auto-submit — used when the student navigates away.
// Sends unsaved answers so they aren't lost.
export const autoSubmit = (testId, answers, keepalive = false) =>
  api.post(`/student/tests/${testId}/auto-submit`, { answers }, { keepalive });

export const submitWarning = (testId) => api.post(`/student/tests/${testId}/warning`);

export const getMyAttemptDetails = (attemptId) => api.get(`/student/tests/attempts/${attemptId}`);

// SSE-based test submission — streams progress events as subjective
// questions are evaluated. onProgress is called with { current, total, message }.
// Resolves with { submittedAt, totalScore }.
export const submitTest = async (testId, onProgress) => {
  const path = `/student/tests/${testId}/submit`;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(path) },
  });

  if (!response.ok) {
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json().catch(() => null) : null;
    throw new Error(data?.error || `Request failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventType = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        let data;
        try { data = JSON.parse(line.slice(6)); } catch { continue; }
        if (eventType === 'progress') onProgress?.(data);
        else if (eventType === 'complete') return data;
        else if (eventType === 'error') throw new Error(data?.error || 'Submitting the test failed. Please try again.');
      }
    }
  }

  throw new Error('Connection closed before submission completed. Please check your test status.');
};
