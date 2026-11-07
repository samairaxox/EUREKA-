import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authApi } from '../api/auth';
import { refreshSession, setAccessToken, SESSION_EXPIRED_EVENT } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // status: 'loading' while restoring a session, then 'authenticated' or 'anonymous'.
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const refreshTimer = useRef(null);

  const applySession = useCallback(payload => {
    setAccessToken(payload.access_token);
    setUser(payload.user);
    setStatus('authenticated');
    // Renew the access token a minute before it expires so the user is never interrupted.
    window.clearTimeout(refreshTimer.current);
    const seconds = Math.max(30, (payload.expires_in || 900) - 60);
    refreshTimer.current = window.setTimeout(async () => {
      const next = await refreshSession();
      if (next) applySession(next);
    }, seconds * 1000);
  }, []);

  const clearSession = useCallback(() => {
    window.clearTimeout(refreshTimer.current);
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    let cancelled = false;
    refreshSession().then(payload => {
      if (cancelled) return;
      if (payload) applySession(payload);
      else clearSession();
    });
    return () => {
      cancelled = true;
      window.clearTimeout(refreshTimer.current);
    };
  }, [applySession, clearSession]);

  useEffect(() => {
    const onExpired = () => clearSession();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [clearSession]);

  const login = useCallback(async (email, password) => {
    const payload = await authApi.login(email, password);
    applySession(payload);
    return payload.user;
  }, [applySession]);

  const register = useCallback(async (email, password, displayName) => {
    const payload = await authApi.register(email, password, displayName);
    applySession(payload);
    return payload.user;
  }, [applySession]);

  const googleSignIn = useCallback(async credential => {
    const payload = await authApi.googleSignIn(credential);
    applySession(payload);
    return payload.user;
  }, [applySession]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if the server is unreachable, the local session must end.
    }
    clearSession();
  }, [clearSession]);

  const updateUser = useCallback(patch => setUser(current => (current ? { ...current, ...patch } : current)), []);

  const value = useMemo(
    () => ({ status, user, login, register, googleSignIn, logout, updateUser }),
    [status, user, login, register, googleSignIn, logout, updateUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
