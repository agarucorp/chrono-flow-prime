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
        if (event === 'TOKEN_REFRESHED') {
          setAuthState(prev => ({ ...prev, user: session?.user || null, loading: false }))
          return
        }
        if (event === 'SIGNED_OUT') {
          setAuthState({ user: null, loading: false, error: null })
          return
        }
        if (event === 'USER_UPDATED') {
          setAuthState(prev => ({ ...prev, user: session?.user || null, loading: false }))
          return
        }
        if (event === 'SIGNED_IN') {
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
    setAuthState(prev => ({ ...prev, loading: true, error: null }))

    const isRateLimit = (err: any) => {
      const msg = (err?.message || '').toLowerCase();
      const status = err?.status || err?.code;
      return msg.includes('rate limit') || msg.includes('email rate limit') || status === 429 || `${status}` === '429';
    };

    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

    const attempt = async (triesLeft: number, delayMs: number): Promise<{ success: boolean; user?: any; error?: string }> => {
      try {
        const signUpOptions: Parameters<typeof supabase.auth.signUp>[0] = {
          email,
          password,
          options: {
            data: metadata
          }
        };
        const { data, error } = await supabase.auth.signUp({ ...signUpOptions });
        if (error) throw error;

        setAuthState({
          user: data.user,
          loading: false,
          error: null
        });
        return { success: true, user: data.user };
      } catch (err: any) {
        if (triesLeft > 0 && isRateLimit(err)) {
          // Backoff y reintento
          await sleep(delayMs);
          return attempt(triesLeft - 1, delayMs * 2);
        }
        const errorMessage = err instanceof Error ? err.message : 'Error al registrarse';
        setAuthState(prev => ({ ...prev, loading: false, error: errorMessage }));
        return { success: false, error: errorMessage };
      }
    };

    return attempt(1, 15000); // 1 reintento con 15s; luego 30s si se repite
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
    setAuthState(prev => ({ ...prev, loading: true, error: null }))

    const isRateLimit = (err: any) => {
      const msg = (err?.message || '').toLowerCase();
      const status = err?.status || err?.code;
      return msg.includes('rate limit') || msg.includes('email rate limit') || status === 429 || `${status}` === '429';
    };

    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

    const attempt = async (triesLeft: number, delayMs: number): Promise<{ success: boolean; error?: string }> => {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        });
        if (error) throw error;
        setAuthState(prev => ({ ...prev, loading: false, error: null }));
        return { success: true };
      } catch (err: any) {
        if (triesLeft > 0 && isRateLimit(err)) {
          await sleep(delayMs);
          return attempt(triesLeft - 1, delayMs * 2);
        }
        const errorMessage = err instanceof Error ? err.message : 'Error al enviar email de reset';
        setAuthState(prev => ({ ...prev, loading: false, error: errorMessage }));
        return { success: false, error: errorMessage };
      }
    };

    return attempt(1, 15000);
  }

  return {
    ...authState,
    signIn,
    signUp,
    signOut,
    resetPassword
  }
}
