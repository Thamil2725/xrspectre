import { api, downloadFile } from './client.js';

function orgQuery(params = {}) {
  const qs = new URLSearchParams();
  if (params.institutionId) qs.set('institutionId', params.institutionId);
  if (params.departmentId) qs.set('departmentId', params.departmentId);
  if (params.batchId) qs.set('batchId', params.batchId);
  if (params.search) qs.set('search', params.search);
  return qs;
}

export const listStudents = (params = {}) => {
  const query = orgQuery(params).toString();
  return api.get(`/admin/students${query ? '?' + query : ''}`);
};

export const downloadStudents = async (params = {}, filename = 'students.csv', countOnly = false) => {
  const qs = orgQuery({ ...params, search: undefined });
  if (countOnly) {
    qs.set('count', 'true');
    const data = await api.get(`/admin/students/export?${qs.toString()}`);
    return data.count;
  }
  const query = qs.toString();
  return downloadFile(`/admin/students/export${query ? '?' + query : ''}`, filename);
};

export const bulkUploadStudents = (students) =>
  api.post('/admin/students/bulk-upload', { students });

export const reopenAttempt = (testId, studentId, startTime, endTime) =>
  api.post(`/admin/students/reopen-attempt/${testId}`, { studentId, startTime, endTime });

export const getAttemptDetails = (studentId, attemptId) =>
  api.get(`/admin/students/${studentId}/attempts/${attemptId}`);

export const deleteStudent = (studentId) =>
  api.delete(`/admin/students/${studentId}`);
