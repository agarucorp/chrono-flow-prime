import React from 'react'
import { useAuthContext } from '../contexts/AuthContext'
import { Navigate, useLocation } from 'react-router-dom'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAuth?: boolean
  redirectTo?: string
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  redirectTo = '/login'
}) => {
  const { user, loading } = useAuthContext()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (requireAuth && !user) {
    // Guardar la ubicación actual para redirigir después del login
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  if (!requireAuth && user) {
    // Si el usuario está autenticado y no debería estar en esta ruta
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
