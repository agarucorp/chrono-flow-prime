import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdmin } from '@/hooks/useAdmin';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface ProtectedAdminRouteProps {
  children: ReactNode;
}

export const ProtectedAdminRoute = ({ children }: ProtectedAdminRouteProps) => {
  const { isAdmin, isLoading } = useAdmin();

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div className="text-center space-y-4">
          <img src="/assets/logovertical.svg" alt="Malda" className="max-w-[140px] mx-auto opacity-90" />
          <p className="text-sm text-white/70">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/user" replace />;
  }

  return <>{children}</>;
};

/** Combina sesión + rol admin */
export const ProtectedAdminRouteWithAuth = ({ children }: ProtectedAdminRouteProps) => (
  <ProtectedRoute>
    <ProtectedAdminRoute>{children}</ProtectedAdminRoute>
  </ProtectedRoute>
);
