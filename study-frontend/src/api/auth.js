import { api, CSRF_HEADERS } from './client';

export const authApi = {
  register: (email, password, displayName) =>
    api.post('/auth/register', { email, password, display_name: displayName || null }).then(r => r.data),
  login: (email, password) => api.post('/auth/login', { email, password }).then(r => r.data),
  googleSignIn: credential => api.post('/auth/google', { credential }).then(r => r.data),
  logout: () => api.post('/auth/logout', null, { headers: CSRF_HEADERS }),
};

export const profileApi = {
  getProfile: () => api.get('/me/profile').then(r => r.data),
  updateProfile: displayName => api.patch('/me/profile', { display_name: displayName }).then(r => r.data),
  updateGoals: goals => api.put('/me/goals', goals).then(r => r.data),
  getProgress: () => api.get('/me/progress').then(r => r.data),
  recordFocusSession: session => api.post('/me/focus-sessions', session).then(r => r.data),
  recordQuizResult: result => api.post('/me/quiz-results', result).then(r => r.data),
};
