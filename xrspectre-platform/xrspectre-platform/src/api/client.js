import { generateFingerprint } from '../utils/fingerprint.js';

// The API is served from the same origin as the app ("/api") in
// production. Set VITE_API_URL only when the frontend is hosted
// separately from the backend (e.g. https://api.example.com/api).
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
const ROOT_URL = API_BASE_URL.replace(/\/api$/, '');

let cachedFingerprint = null;
export function getFingerprint() {
  if (!cachedFingerprint) cachedFingerprint = generateFingerprint();
  return cachedFingerprint;
}

export async function checkHealth() {
  try {
    const res = await fetch(`${ROOT_URL}/health`);
    if (!res.ok) return null;
    return await res.json(); // { status, executionProvider }
  } catch {
    return null;
  }
}

const TOKEN_KEY = 'xrspectre_token';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable */ }
}

class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function authHeaders(path = '') {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (path.startsWith('/student/tests')) headers['X-Browser-Fingerprint'] = getFingerprint();
  return headers;
}

async function errorFromResponse(response) {
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json().catch(() => null) : null;
  return new ApiError(data?.error || `Request failed (${response.status})`, response.status, data?.details);
}

async function request(path, { method = 'GET', body, auth = true, keepalive = false } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(auth ? authHeaders(path) : {}) };

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      keepalive,
    });
  } catch (networkErr) {
    throw new ApiError('Could not reach the server. Please check your connection.', 0, networkErr);
  }

  if (!response.ok) throw await errorFromResponse(response);

  const isJson = response.headers.get('content-type')?.includes('application/json');
  return isJson ? await response.json().catch(() => null) : null;
}

// Downloads a file (PDF / XLSX / CSV) from an authenticated endpoint.
export async function downloadFile(path, filename) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders(path) });
  } catch (networkErr) {
    throw new ApiError('Could not reach the server. Please check your connection.', 0, networkErr);
  }
  if (!response.ok) throw await errorFromResponse(response);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
};

export { ApiError };
