// client/src/utils/adminApi.js
// All admin API calls — mirrors the pattern of your existing api.js

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const adminAxios = axios.create({ baseURL: `${API_BASE}/api/admin` });

// Attach JWT token to every request
adminAxios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const adminAPI = {
  getDashboard:     () => adminAxios.get('/dashboard'),
  getSystemStats:   () => adminAxios.get('/system-stats'),
  getLogs:          (params) => adminAxios.get('/logs', { params }),

  // Users
  getUsers:         (params) => adminAxios.get('/users', { params }),
  banUser:          (id, reason) => adminAxios.put(`/ban-user/${id}`, { reason }),
  deleteUser:       (id) => adminAxios.delete(`/delete-user/${id}`),
  promoteUser:      (id, role) => adminAxios.put(`/promote-user/${id}`, { role }),
  muteUser:         (id, durationMinutes) => adminAxios.put(`/mute-user/${id}`, { durationMinutes }),

  // Messages
  getMessages:      (params) => adminAxios.get('/messages', { params }),
  deleteMessage:    (id) => adminAxios.delete(`/delete-message/${id}`),

  // Rooms
  getRooms:         (params) => adminAxios.get('/rooms', { params }),
  deleteRoom:       (roomId) => adminAxios.delete(`/delete-room/${roomId}`),

  // Reports
  getReports:       (params) => adminAxios.get('/reports', { params }),
  resolveReport:    (id, data) => adminAxios.put(`/resolve-report/${id}`, data),
  submitReport:     (data) => adminAxios.post('/submit-report', data),

  // Broadcast
  broadcast:        (data) => adminAxios.post('/broadcast', data),
};

export default adminAPI;