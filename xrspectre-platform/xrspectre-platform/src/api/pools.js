import { api } from './client.js';

export const listPools = () => api.get('/admin/pools');
export const getPoolDetails = (poolId) => api.get(`/admin/pools/${poolId}`);
export const createPool = (payload) => api.post('/admin/pools', payload);
export const updatePool = (poolId, payload) => api.patch(`/admin/pools/${poolId}`, payload);
export const deletePool = (poolId) => api.delete(`/admin/pools/${poolId}`);

export const listCategories = (poolId) => api.get(`/admin/pools/${poolId}/categories`);
export const createCategory = (poolId, payload) => api.post(`/admin/pools/${poolId}/categories`, payload);
export const deleteCategory = (categoryId) => api.delete(`/admin/pools/categories/${categoryId}`);

export const listQuestions = (poolId, categoryId) => {
  const params = categoryId ? `?categoryId=${categoryId}` : '';
  return api.get(`/admin/pools/${poolId}/questions${params}`);
};
export const createQuestion = (poolId, payload) => api.post(`/admin/pools/${poolId}/questions`, payload);
export const updateQuestion = (questionId, payload) => api.patch(`/admin/pools/questions/${questionId}`, payload);
export const deleteQuestion = (questionId) => api.delete(`/admin/pools/questions/${questionId}`);