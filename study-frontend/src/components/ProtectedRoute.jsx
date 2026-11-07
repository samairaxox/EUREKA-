import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function ProtectedRoute({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') {
    return <div className="route-loading" role="status" aria-live="polite">Preparing your study space…</div>;
  }
  if (status !== 'authenticated') {
    return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}
