import axios from 'axios';

const API = axios.create({ baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api' });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const supportAPI = {
  // User
  createTicket:  (data)       => API.post('/support/tickets', data),
  getMyTickets:  ()           => API.get('/support/tickets/my'),
  getTicket:     (id)         => API.get(`/support/tickets/${id}`),
  sendMessage:   (id, content)=> API.post(`/support/tickets/${id}/messages`, { content }),

  // Admin
  getAllTickets:  (params)     => API.get('/support/admin/tickets', { params }),
  getAdminTicket:(id)         => API.get(`/support/admin/tickets/${id}`),
  replyTicket:   (id, content)=> API.post(`/support/admin/tickets/${id}/reply`, { content }),
  updateStatus:  (id, data)   => API.put(`/support/admin/tickets/${id}/status`, data),
  getStats:      ()           => API.get('/support/admin/support-stats'),
};