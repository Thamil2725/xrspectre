import { api } from './client.js';

export const getInstitutions = () => api.get('/org/institutions', { auth: false });
export const getDepartments = (institutionId) => {
  const params = new URLSearchParams();
  if (institutionId) params.set('institutionId', institutionId);
  const qs = params.toString();
  return api.get(`/org/departments${qs ? '?' + qs : ''}`, { auth: false });
};
export const getBatches = (institutionId, departmentId) => {
  const params = new URLSearchParams();
  if (institutionId) params.set('institutionId', institutionId);
  if (departmentId) params.set('departmentId', departmentId);
  const qs = params.toString();
  return api.get(`/org/batches${qs ? '?' + qs : ''}`, { auth: false });
};

export const createInstitution = (name) => api.post('/org/institutions', { name });
export const createDepartment = (name, institutionId) => api.post('/org/departments', { name, institutionId });
export const createBatch = (name, institutionId, departmentId) => api.post('/org/batches', { name, institutionId, departmentId });

export const deleteInstitution = (id, force) => api.delete(`/org/institutions/${id}${force ? '?force=true' : ''}`);
export const deleteDepartment = (id, force) => api.delete(`/org/departments/${id}${force ? '?force=true' : ''}`);
export const deleteBatch = (id, force) => api.delete(`/org/batches/${id}${force ? '?force=true' : ''}`);
