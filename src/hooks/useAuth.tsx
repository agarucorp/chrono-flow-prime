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
    let mounted = true;

    // Obtener sesión inicial
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        
        if (mounted) {
          setAuthState({
            user: session?.user || null,
            loading: false,
            error: null
          })
        }
      } catch (error) {
        // Solo loguear errores de red una vez para evitar spam en consola
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
        const isNetworkError = errorMessage.includes('Failed to fetch') || 
                               errorMessage.includes('ERR_NAME_NOT_RESOLVED') ||
                               errorMessage.includes('NetworkError')
        
        
        if (mounted) {
          setAuthState({
            user: null,
            loading: false,
            error: isNetworkError ? null : errorMessage // No mostrar errores de red como error del estado
          })
        }

        // Solo loguear errores de red una vez
        if (isNetworkError && mounted) {
          console.warn('⚠️ Error de conexión con Supabase. Sesión local limpiada para evitar intentos de refresh.')
        }
      }
    }

    getInitialSession()

    // Escuchar cambios en la autenticación
    let subscription: { unsubscribe: () => void } | null = null;
    
    try {
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!mounted) return;

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
      subscription = sub;
    } catch (error) {
      // Si falla la suscripción, continuar sin ella
      console.warn('No se pudo establecer la suscripción a cambios de autenticación')
    }

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe()
      }
    }
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
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Error al iniciar sesión'
      
      // Detectar errores de conexión/red REALES (no errores HTTP del servidor)
      // Solo errores de red del navegador, no errores 500/400/etc del servidor
      const isNetworkError = (
        errorMessage.includes('Failed to fetch') || 
        errorMessage.includes('ERR_NAME_NOT_RESOLVED') ||
        errorMessage.includes('NetworkError') ||
        (error instanceof TypeError && errorMessage.includes('fetch')) ||
        (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND' || error?.code === 'ETIMEDOUT')
      ) && !error?.status && !error?.response // No es un error HTTP del servidor
      
      const finalErrorMessage = isNetworkError 
        ? 'Conexión con la base de datos caída. Inténtalo de nuevo más tarde'
        : errorMessage
      
      setAuthState(prev => ({ ...prev, loading: false, error: finalErrorMessage }))
      return { success: false, error: finalErrorMessage }
    }
  }

  const signUp = async (email: string, password: string, metadata?: any) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }))

    const isRateLimit = (err: any) => {
      if (!err) return false;
      
      const msg = (err?.message || err?.error?.message || '').toLowerCase();
      const status = err?.status || err?.code || err?.statusCode || err?.error?.code;
      const httpStatus = err?.response?.status || err?.status;
      
      // Verificar múltiples formas en que puede venir el error 429
      const is429 = status === 429 || `${status}` === '429' || httpStatus === 429 || `${httpStatus}` === '429';
      const hasRateLimitMsg = msg.includes('rate limit') || 
                             msg.includes('email rate limit') || 
                             msg.includes('too many requests') ||
                             msg.includes('rate_limit_exceeded') ||
                             msg.includes('429');
      
      return is429 || hasRateLimitMsg;
    };

    const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

    // Delay preventivo: esperar antes de intentar para evitar rate limit
    // Supabase limita a ~3-4 registros por hora desde la misma IP en plan gratuito
    const lastSignUpTime = localStorage.getItem('lastSignUpAttempt');
    if (lastSignUpTime) {
      const timeSinceLastAttempt = Date.now() - parseInt(lastSignUpTime);
      const minDelay = 15000; // Mínimo 15 segundos entre intentos (más conservador)
      if (timeSinceLastAttempt < minDelay) {
        const waitTime = minDelay - timeSinceLastAttempt;
        console.log(`Esperando ${Math.round(waitTime / 1000)} segundos antes de intentar registro para evitar rate limit...`);
        await sleep(waitTime);
      }
    }
    localStorage.setItem('lastSignUpAttempt', Date.now().toString());

    const attempt = async (triesLeft: number, delayMs: number, attemptNumber: number = 1): Promise<{ success: boolean; user?: any; error?: string; warning?: string }> => {
      try {
        const signUpOptions: Parameters<typeof supabase.auth.signUp>[0] = {
          email,
          password,
          options: {
            data: metadata,
            // Permitir que el usuario se cree aunque falle el envío del email
            emailRedirectTo: `${window.location.origin}/dashboard`
          }
        };
        const { data, error } = await supabase.auth.signUp({ ...signUpOptions });
        
        // Si hay un error, verificar si es un error 500 relacionado con el email
        // En algunos casos, el usuario se crea pero falla el envío del email
        if (error) {
          // Si el error es 500 y el usuario se creó, permitir continuar
          const is500Error = error.status === 500 || error.message?.includes('500');
          const userWasCreated = data?.user !== null && data?.user !== undefined;
          
          if (is500Error && userWasCreated) {
            // El usuario se creó pero falló el envío del email
            // Esto puede pasar si hay un problema con el trigger o el servicio de emails
            console.warn('Usuario creado pero falló el envío del email:', error);
            
            // Limpiar el timestamp de último intento
            localStorage.removeItem('lastSignUpAttempt');
            
            setAuthState({
              user: data.user,
              loading: false,
              error: null
            });
            
            // Retornar éxito pero con advertencia sobre el email
            return { 
              success: true, 
              user: data.user,
              warning: 'Tu cuenta se creó correctamente, pero no pudimos enviar el email de confirmación. Por favor, contacta al administrador para confirmar tu cuenta manualmente.'
            };
          }
          
          // Para otros errores, lanzar el error normalmente
          throw error;
        }

        // Limpiar el timestamp de último intento al tener éxito
        localStorage.removeItem('lastSignUpAttempt');
        
        setAuthState({
          user: data.user,
          loading: false,
          error: null
        });
        return { success: true, user: data.user };
      } catch (err: any) {
        if (triesLeft > 0 && isRateLimit(err)) {
          // Backoff exponencial con más reintentos
          const delaySeconds = Math.round(delayMs / 1000);
          console.log(`Rate limit detectado. Reintentando en ${delaySeconds} segundos... (Intento ${attemptNumber + 1}/3)`);
          await sleep(delayMs);
          return attempt(triesLeft - 1, delayMs * 1.5, attemptNumber + 1);
        }
        
        // Detectar errores específicos y mostrar mensajes amigables (sin mencionar Supabase)
        const errorMsg = err?.message || err?.error?.message || '';
        const errorCode = err?.status || err?.code || err?.statusCode || err?.error?.code;
        const errorMsgLower = errorMsg.toLowerCase();
        
        // Mensaje de error más claro para diferentes tipos de errores
        let errorMessage = 'Error al registrarse. Por favor, intenta nuevamente.';
        
        // Detectar errores 500 específicamente
        const is500Error = errorCode === 500 || `${errorCode}` === '500' || 
                          errorMsgLower.includes('500') ||
                          err?.status === 500;
        
        // Detectar si el 500 viene del envío de email (Resend créditos, SMTP, etc.)
        const isEmailRelated = errorMsgLower.includes('confirmation email') ||
          errorMsgLower.includes('sending') && errorMsgLower.includes('email') ||
          errorMsgLower.includes('maximum credits exceeded') ||
          errorMsgLower.includes('credits exceeded') ||
          errorMsgLower.includes('451');
        
        if (is500Error && isEmailRelated) {
          errorMessage = 'No se pudo enviar el email de confirmación (por ejemplo, límite de créditos de Resend o SMTP). Deshabilita temporalmente el SMTP custom en Supabase o revisa tu proveedor de emails.';
        } else if (is500Error) {
          errorMessage = 'Error del servidor al crear la cuenta. Puede ser temporal, un problema con triggers o con el envío de emails. Contacta al administrador o intenta más tarde.';
        } else if (isRateLimit(err)) {
          errorMessage = 'Límite de registros alcanzado. Por favor, espera 15-20 minutos antes de intentar nuevamente, o intenta desde otra red.';
        } else if (
          errorCode === 451 || 
          errorMsgLower.includes('maximum credits exceeded') ||
          errorMsgLower.includes('credits exceeded') ||
          errorMsgLower.includes('451')
        ) {
          errorMessage = 'El servicio de envío de emails no está disponible en este momento. Por favor, contacta al administrador o intenta más tarde.';
        } else if (
          errorMsgLower.includes('error sending confirmation email') ||
          (errorMsgLower.includes('email') && errorMsgLower.includes('send'))
        ) {
          errorMessage = 'No se pudo enviar el email de confirmación. Por favor, contacta al administrador o intenta más tarde.';
        } else {
          // Incluir más detalles del error para debugging
          const detailedError = err instanceof Error 
            ? `${err.message}${errorCode ? ` (Código: ${errorCode})` : ''}` 
            : `Error desconocido${errorCode ? ` (Código: ${errorCode})` : ''}`;
          errorMessage = `Error al registrarse: ${detailedError}. Por favor, intenta nuevamente o contacta al administrador.`;
        }
        
        setAuthState(prev => ({ ...prev, loading: false, error: errorMessage }));
        return { success: false, error: errorMessage };
      }
    };

    // Reintentos con delays más largos: 2 reintentos con delays progresivos (30s, 60s)
    // Nota: Si el rate limit ya se alcanzó, los reintentos no ayudarán mucho
    // El delay preventivo es más importante
    return attempt(2, 30000);
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
