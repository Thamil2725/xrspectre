import { api } from './client.js';

export const listAdmins = () => api.get('/admin/admins');

export const createAdmin = (data) => api.post('/admin/admins', data);

export const deleteAdmin = (adminId) => api.delete(`/admin/admins/${adminId}`);
