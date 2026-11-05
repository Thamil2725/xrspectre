import { api } from './client.js';

export const createTest = (payload) => api.post('/admin/tests', payload);
export const listAdminTests = () => api.get('/admin/tests');
export const getTestDetails = (testId) => api.get(`/admin/tests/${testId}`);
export const updateAudience = (testId, payload) => api.patch(`/admin/tests/${testId}/audience`, payload);
export const addQuestion = (testId, payload) => api.post(`/admin/tests/${testId}/questions`, payload);
export const updateQuestion = (testId, questionId, payload) => api.patch(`/admin/tests/${testId}/questions/${questionId}`, payload);
export const removeQuestion = (testId, questionId) => api.delete(`/admin/tests/${testId}/questions/${questionId}`);
export const scheduleTest = (testId, payload) => api.post(`/admin/tests/${testId}/schedule`, payload);
export const reopenTest = (testId, payload) => api.post(`/admin/tests/${testId}/reopen`, payload);
export const deleteTest = (testId) => api.delete(`/admin/tests/${testId}`);
export const deleteAllTests = () => api.delete('/admin/tests');
export const getTestStats = (testId) => api.get(`/admin/tests/${testId}/stats`);
