import { api, setToken } from './client.js';

export const getMe = () => api.get('/auth/me');

export async function signupStudent({ name, email, password, institutionId, departmentId, batchId }) {
  const data = await api.post('/auth/signup/student', { name, email, password, institutionId, departmentId, batchId }, { auth: false });
  setToken(data.token);
  return data.user;
}

export async function login({ email, password }) {
  const data = await api.post('/auth/login', { email, password }, { auth: false });
  setToken(data.token);
  return data.user;
}

// Testing aid — the server only answers when SHOW_LOGIN_CREDENTIALS=true.
export async function getTestCredentials() {
  try {
    return await api.get('/auth/test-credentials', { auth: false });
  } catch {
    return null;
  }
}

export function logout() {
  setToken(null);
}
