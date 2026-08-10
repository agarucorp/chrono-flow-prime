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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <img src="/assets/logovertical.svg" alt="Malda" className="max-w-[160px] md:max-w-[200px] opacity-90" />
      </div>
    )
  }

  if (requireAuth && (!user || !user.email_confirmed_at)) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  if (!requireAuth && user?.email_confirmed_at) {
    return <Navigate to="/user" replace />
  }

  return <>{children}</>
}
