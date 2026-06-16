import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { Loading } from '@/components/ui/misc';

/** Gate admin routes behind an authenticated session. */
export default function ProtectedRoute({ children }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'idle' || status === 'loading') {
    return <Loading label="Restoring session…" />;
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
