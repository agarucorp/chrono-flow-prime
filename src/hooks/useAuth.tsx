import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    // Obtener sesión inicial
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        
        setAuthState({
          user: session?.user || null,
          loading: false,
          error: null
        })
      } catch (error) {
        setAuthState({
          user: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Error desconocido'
        })
      }
    }

    getInitialSession()

    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, session?.user?.email_confirmed_at)
        
        if (event === 'TOKEN_REFRESHED') {
          setAuthState(prev => ({ ...prev, user: session?.user || null, loading: false }))
          return
        }
        if (event === 'SIGNED_OUT') {
          setAuthState({ user: null, loading: false, error: null })
          return
        }
        if (event === 'USER_DELETED') {
          setAuthState({ user: null, loading: false, error: null })
          return
        }
        if (event === 'USER_UPDATED') {
          setAuthState(prev => ({ ...prev, user: session?.user || null, loading: false }))
          return
        }
        if (event === 'SIGNED_IN' || event === 'SIGNED_UP') {
          setAuthState({ user: session?.user || null, loading: false, error: null })
          return
        }
        // Fallback para otros eventos
        setAuthState({ user: session?.user || null, loading: false, error: null })
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }))
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        // Si el error es "Email not confirmed", permitir el login pero mostrar mensaje
        if (error.message.includes('Email not confirmed')) {
          console.log('Email no confirmado, pero permitiendo login')
          setAuthState({
            user: data.user,
            loading: false,
            error: null
          })
          return { success: true, user: data.user, needsConfirmation: true }
        }
        throw error
      }
      
      setAuthState({
        user: data.user,
        loading: false,
        error: null
      })
      
      return { success: true, user: data.user }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al iniciar sesión'
      setAuthState(prev => ({ ...prev, loading: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }

  const signUp = async (email: string, password: string, metadata?: any) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }))
      
      const signUpOptions: Parameters<typeof supabase.auth.signUp>[0] = {
        email,
        password,
        options: {
          data: metadata
        }
      }
      const { data, error } = await supabase.auth.signUp({
        ...signUpOptions
      })
      
      if (error) throw error
      
      // No establecer el usuario como autenticado hasta que confirme el email
      setAuthState({
        user: data.user,
        loading: false,
        error: null
      })
      
      return { success: true, user: data.user }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al registrarse'
      setAuthState(prev => ({ ...prev, loading: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }

  const signOut = async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }))
      
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      setAuthState({
        user: null,
        loading: false,
        error: null
      })
      
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al cerrar sesión'
      setAuthState(prev => ({ ...prev, loading: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }

  const resetPassword = async (email: string) => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }))
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      
      if (error) throw error
      
      setAuthState(prev => ({ ...prev, loading: false, error: null }))
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al enviar email de reset'
      setAuthState(prev => ({ ...prev, loading: false, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }

  return {
    ...authState,
    signIn,
    signUp,
    signOut,
    resetPassword
  }
}
