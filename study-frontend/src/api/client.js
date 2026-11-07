import axios from 'axios';
import { toLocalDateString } from '../streak';

/**
 * Single HTTP client for EUREKA.
 * - The access token lives in memory only (never localStorage).
 * - The refresh token is an HttpOnly cookie managed by the server; JavaScript cannot read it.
 * - A 401 triggers one silent refresh, then one retry. Concurrent 401s share one refresh.
 */
export const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:8000').replace(/\/$/, '');
export const LONG_AI_TIMEOUT_MS = Math.max(120000, Number(process.env.REACT_APP_LONG_AI_TIMEOUT_MS) || 300000);
export const CSRF_HEADERS = { 'X-Requested-With': 'eureka' };
export const ACTIVITY_EVENT = 'eureka:activity';
export const SESSION_EXPIRED_EVENT = 'eureka:session-expired';

let accessToken = null;
let refreshInFlight = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 120000,
});

api.interceptors.request.use(config => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  // The user's local calendar date decides which day a study action counts toward.
  config.headers['X-Local-Date'] = toLocalDateString();
  return config;
});

api.interceptors.response.use(
  response => {
    const method = (response.config.method || '').toLowerCase();
    const url = response.config.url || '';
    if (method === 'post' && !url.startsWith('/auth/')) {
      window.dispatchEvent(new Event(ACTIVITY_EVENT));
    }
    return response;
  },
  async error => {
    const config = error.config || {};
    const url = config.url || '';
    const isAuthRoute = url.startsWith('/auth/');
    if (error.response?.status === 401 && !config._retried && !isAuthRoute) {
      config._retried = true;
      const refreshed = await refreshSession();
      if (refreshed) {
        config.headers.Authorization = `Bearer ${accessToken}`;
        return api(config);
      }
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);

/** Exchanges the HttpOnly refresh cookie for a new access token. Returns the auth payload or null. */
export async function refreshSession() {
  if (!refreshInFlight) {
    const refresh = () => api.post('/auth/refresh', null, { headers: CSRF_HEADERS, _retried: true });
    const locks = typeof navigator !== 'undefined' ? navigator.locks : null;
    const serializedRefresh = locks?.request
      ? locks.request('eureka-refresh-token', { mode: 'exclusive' }, refresh)
      : refresh();
    refreshInFlight = serializedRefresh
      .then(res => {
        setAccessToken(res.data.access_token);
        return res.data;
      }).catch(error => {
        // Keep diagnostics useful without printing request config, headers, cookies, or tokens.
        const failure = error.response?.status ? `HTTP ${error.response.status}` : (error.code || 'network error');
        console.warn(`[EUREKA] Session refresh failed (${failure}).`);
        setAccessToken(null);
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/** Turns a FastAPI error into a readable message for the UI. */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback;
  if (error.response?.status === 429) {
    return error.response.data?.detail || 'Too many requests. Please wait a moment and try again.';
  }
  if (!error.response) {
    return 'Could not reach the EUREKA server. Check that the API is running and try again.';
  }
  const detail = error.response.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg.replace(/^Value error, /, '');
  return fallback;
}
