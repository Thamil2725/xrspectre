import { api } from './client.js';

export const listStudents = () => api.get('/mentor/students');
export const getStudentAttempts = (studentId) => api.get(`/mentor/students/${studentId}/attempts`);
export const getAttemptDetails = (studentId, attemptId) => api.get(`/mentor/students/${studentId}/attempts/${attemptId}`);
