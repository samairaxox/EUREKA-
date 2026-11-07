import { api } from './client';

export const notesApi = {
  list: archived => api.get('/notes', { params: { archived } }).then(r => r.data.notes),
  create: body => api.post('/notes', body).then(r => r.data),
  update: (id, patch) => api.patch(`/notes/${id}`, patch).then(r => r.data),
  remove: id => api.delete(`/notes/${id}`),
};

export const checklistsApi = {
  list: () => api.get('/checklists').then(r => r.data.checklists),
  create: body => api.post('/checklists', body).then(r => r.data),
  update: (id, patch) => api.patch(`/checklists/${id}`, patch).then(r => r.data),
  remove: id => api.delete(`/checklists/${id}`),
  addItem: (id, text) => api.post(`/checklists/${id}/items`, { text }).then(r => r.data),
  updateItem: (id, itemId, patch) => api.patch(`/checklists/${id}/items/${itemId}`, patch).then(r => r.data),
  removeItem: (id, itemId) => api.delete(`/checklists/${id}/items/${itemId}`).then(r => r.data),
};
