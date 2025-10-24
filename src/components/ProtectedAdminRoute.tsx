import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdmin } from '@/hooks/useAdmin';

interface ProtectedAdminRouteProps {
  children: ReactNode;
}

export const ProtectedAdminRoute = ({ children }: ProtectedAdminRouteProps) => {
  const { isAdmin, isLoading } = useAdmin();

  // Si está cargando, mostrar spinner
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold mb-2">Verificando permisos...</h2>
          <p className="text-muted-foreground">Comprobando tu rol de administrador.</p>
        </div>
      </div>
    );
  }

  // Si no es admin, redirigir al login
  if (!isAdmin) {
    return <Navigate to="/login" replace />;
  }

  // Si es admin, mostrar el contenido
  return <>{children}</>;
};
