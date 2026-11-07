import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { profileApi } from '../api/auth';
import { ACTIVITY_EVENT } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const ProgressContext = createContext(null);

export function ProgressProvider({ children }) {
  const { status } = useAuth();
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await profileApi.getProgress();
      setProgress(data);
      setError('');
      return data;
    } catch {
      setError('Your progress could not be loaded. Check your connection and try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') {
      setProgress(null);
      return undefined;
    }
    refresh();
    // Any completed study action (AI generation, quiz, focus session) changes progress.
    const onActivity = () => refresh();
    window.addEventListener(ACTIVITY_EVENT, onActivity);
    return () => window.removeEventListener(ACTIVITY_EVENT, onActivity);
  }, [status, refresh]);

  const value = useMemo(() => ({ progress, error, loading, refresh }), [progress, error, loading, refresh]);
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const context = useContext(ProgressContext);
  if (!context) throw new Error('useProgress must be used inside ProgressProvider');
  return context;
}
