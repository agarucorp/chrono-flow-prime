import React from 'react'
import { useAuthContext } from '../contexts/AuthContext'

export const TestAuth: React.FC = () => {
  const { user, loading, error } = useAuthContext()

  if (loading) {
    return <div>Cargando...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  if (user) {
    return (
      <div>
        <h2>Usuario autenticado</h2>
        <p>Email: {user.email}</p>
        <p>ID: {user.id}</p>
      </div>
    )
  }

  return (
    <div>
      <h2>No autenticado</h2>
      <p>No hay usuario logueado</p>
    </div>
  )
}
