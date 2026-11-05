import { api } from './client.js';

export const listMentors = () => api.get('/admin/mentors');
export const createMentor = (data) => api.post('/admin/mentors', data);
export const deleteMentor = (mentorId) => api.delete(`/admin/mentors/${mentorId}`);
