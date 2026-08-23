import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuthContext } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { RecoverPasswordForm } from "./RecoverPasswordForm";
import {
  cleanAuthParamsFromUrl,
  isEmailConfirmCallback,
  parseAuthUrlParams,
  waitForAuthSession,
} from "@/lib/authCallbacks";
import { AUTH_STORAGE_KEY } from "@/lib/authStorage";

interface LoginFormProps {
  onLogin: () => void;
}

const EMAIL_CONFIRMED_FLAG = 'email_just_confirmed';

export const LoginFormSimple = ({ onLogin }: LoginFormProps) => {
  const { signIn, signUp, signOut, user, loading: authLoading } = useAuthContext();
  const { showSuccess, showError } = useNotifications();
  const navigate = useNavigate();
  
  const [credentials, setCredentials] = useState({
    email: "",
    password: ""
  });
  const [registerData, setRegisterData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    confirmEmail: "",
    password: "",
    confirmPassword: ""
  });
  const [fieldErrors, setFieldErrors] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    confirmEmail: "",
    password: "",
    confirmPassword: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isRecoverMode, setIsRecoverMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [awaitingEmailConfirmUi, setAwaitingEmailConfirmUi] = useState(
    () => isEmailConfirmCallback() || sessionStorage.getItem(EMAIL_CONFIRMED_FLAG) === '1'
  );
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendFeedback, setResendFeedback] = useState<string | null>(null);
  // Tras click en "Confirmar email": esperar PKCE, cerrar sesión y quedarse en login
  useEffect(() => {
    const { error, errorDescription } = parseAuthUrlParams();
    if (error) {
      showError(
        'No se pudo confirmar el email',
        errorDescription?.replace(/\+/g, ' ') || 'El enlace no es válido o expiró.'
      );
      cleanAuthParamsFromUrl('/login');
      return;
    }

    if (!isEmailConfirmCallback() && sessionStorage.getItem(EMAIL_CONFIRMED_FLAG) !== '1') {
      return;
    }

    sessionStorage.setItem(EMAIL_CONFIRMED_FLAG, '1');
    setAwaitingEmailConfirmUi(true);
    setIsRegisterMode(false);
    setPendingConfirmationEmail(null);

    let cancelled = false;
    (async () => {
      // Esperar a que detectSessionInUrl/exchange termine (PKCE puede tardar)
      await waitForAuthSession(() => supabase.auth.getSession(), { timeoutMs: 8000 });
      if (cancelled) return;
      await signOut();
      sessionStorage.removeItem(EMAIL_CONFIRMED_FLAG);
      cleanAuthParamsFromUrl('/login');
      showSuccess('Email confirmado', 'Ya podés iniciar sesión con tu cuenta.');
      setAwaitingEmailConfirmUi(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [signOut, showSuccess, showError]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  // Si ya hay sesión confirmada, ir al panel (nunca con email pendiente ni post-confirmación)
  useEffect(() => {
    if (authLoading || !user || !user.email_confirmed_at) return;
    if (awaitingEmailConfirmUi || sessionStorage.getItem(EMAIL_CONFIRMED_FLAG) === '1') return;
    let cancelled = false;
    (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (profile?.role === 'admin') navigate('/admin', { replace: true });
      else navigate('/user', { replace: true });
    })();
    return () => { cancelled = true; };
  }, [user, authLoading, navigate, awaitingEmailConfirmUi]);

  // Splash breve solo en mobile (max 800ms)
  useEffect(() => {
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
    if (!isMobile) return;
    setShowSplash(true);
    const timer = setTimeout(() => setShowSplash(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleNameChange = (field: 'firstName' | 'lastName', value: string) => {
    const sanitized = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
    setRegisterData(prev => ({ ...prev, [field]: sanitized }));
    setFieldErrors(prev => ({ ...prev, [field]: "" }));
  };

  const handlePhoneChange = (value: string) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    setRegisterData(prev => ({ ...prev, phone: sanitized }));
    setFieldErrors(prev => ({ ...prev, phone: "" }));
  };

  // Verificar requisitos de contraseña
  const checkPasswordRequirements = (password: string) => {
    return {
      minLength: password.length >= 6,
    };
  };

  // Validar campo al perder el foco (blur)
  const validateField = (field: string, value: string) => {
    switch(field) {
      case 'firstName':
      case 'lastName':
        if (!value.trim()) {
          setFieldErrors(prev => ({ ...prev, [field]: "Campo obligatorio" }));
        } else {
          setFieldErrors(prev => ({ ...prev, [field]: "" }));
        }
        break;
      case 'phone':
        if (!value.trim()) {
          setFieldErrors(prev => ({ ...prev, phone: "Campo obligatorio" }));
        } else {
          setFieldErrors(prev => ({ ...prev, phone: "" }));
        }
        break;
      case 'email':
        if (!value.trim()) {
          setFieldErrors(prev => ({ ...prev, email: "Campo obligatorio" }));
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          setFieldErrors(prev => ({ ...prev, email: "Email inválido" }));
        } else {
          setFieldErrors(prev => ({ ...prev, email: "" }));
        }
        break;
      case 'confirmEmail':
        if (!value.trim()) {
          setFieldErrors(prev => ({ ...prev, confirmEmail: "Campo obligatorio" }));
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          setFieldErrors(prev => ({ ...prev, confirmEmail: "Email inválido" }));
        } else if (value !== registerData.email) {
          setFieldErrors(prev => ({ ...prev, confirmEmail: "Los emails no coinciden" }));
        } else {
          setFieldErrors(prev => ({ ...prev, confirmEmail: "" }));
        }
        break;
      case 'password':
        if (!value) {
          setFieldErrors(prev => ({ ...prev, password: "Campo obligatorio" }));
        } else {
          const requirements = checkPasswordRequirements(value);
          if (!requirements.minLength) {
            setFieldErrors(prev => ({ ...prev, password: "La contraseña debe tener al menos 6 caracteres" }));
          } else {
            setFieldErrors(prev => ({ ...prev, password: "" }));
          }
        }
        break;
      case 'confirmPassword':
        if (!value) {
          setFieldErrors(prev => ({ ...prev, confirmPassword: "Campo obligatorio" }));
        } else if (value !== registerData.password) {
          setFieldErrors(prev => ({ ...prev, confirmPassword: "Las contraseñas no coinciden" }));
        } else {
          setFieldErrors(prev => ({ ...prev, confirmPassword: "" }));
        }
        break;
    }
  };

  // Limpiar errores cuando se empiece a escribir
  const handleFieldChange = (field: string, value: string) => {
    setRegisterData(prev => ({ ...prev, [field]: value }));
    if (fieldErrors[field as keyof typeof fieldErrors]) {
      setFieldErrors(prev => ({ ...prev, [field]: "" }));
    }
    // Si cambia el email, limpiar error de confirmEmail
    if (field === 'email' && fieldErrors.confirmEmail) {
      setFieldErrors(prev => ({ ...prev, confirmEmail: "" }));
    }
    // Si cambia la contraseña, limpiar error de confirmPassword
    if (field === 'password' && fieldErrors.confirmPassword) {
      setFieldErrors(prev => ({ ...prev, confirmPassword: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!isRegisterMode) {
      // Login real con Supabase
      try {
        setIsLoading(true);
        // La sesión persiste siempre en localStorage; limpiamos la copia que
        // pudiera haber quedado en sessionStorage de la versión anterior.
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
        const result = await signIn(credentials.email, credentials.password);

        if (!result.success || !result.user) {
          const message = result.error || 'Error al iniciar sesión';
          // No loguear errores de conexión para evitar spam en consola
          if (!message.includes('Conexión con la base de datos')) {
            console.error('Error en login:', message);
          }
          setError(message);
          return;
        }

        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', result.user.id)
            .single();

          if (profileError) {
            console.warn('No se pudo obtener el rol, enviando a /user por defecto:', profileError.message);
            onLogin();
            navigate('/user');
            return;
          }

          onLogin();
          if (profile?.role === 'admin') {
            navigate('/admin');
          } else {
            navigate('/user');
          }
        } catch (roleErr) {
          console.error('Error inesperado leyendo rol:', roleErr);
          onLogin();
          navigate('/user');
        }
      } catch (err) {
        console.error('Error inesperado en login:', err);
        setError('Error inesperado al iniciar sesión');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Manejo del registro por pasos
    if (currentStep === 1) {
      if (!registerData.firstName.trim() || !registerData.lastName.trim() || !registerData.phone.trim()) {
        setError("Por favor complete todos los campos del paso 1");
        return;
      }
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      if (!registerData.email.trim() || !registerData.confirmEmail.trim() || !registerData.password || !registerData.confirmPassword) {
        setError("Por favor complete todos los campos del paso 2");
        return;
      }
      const requirements = checkPasswordRequirements(registerData.password);
      if (!requirements.minLength) {
        setError("La contraseña debe tener al menos 6 caracteres");
        return;
      }
      if (registerData.email !== registerData.confirmEmail) {
        setError("Los emails no coinciden");
        return;
      }
      if (registerData.password !== registerData.confirmPassword) {
        setError("Las contraseñas no coinciden");
        return;
      }
      
      try {
        setIsLoading(true);
        
        // Crear usuario en Supabase Auth
        const result = await signUp(
          registerData.email, 
          registerData.password,
          {
            first_name: registerData.firstName,
            last_name: registerData.lastName,
            phone: registerData.phone
          }
        );
        
        // Si hay un warning (usuario creado pero problema con email), mostrar warning pero continuar
        if (result.warning) {
          showError(
            'Cuenta creada con advertencia',
            result.warning
          );
          // Continuar con el flujo normal aunque haya warning
        } else if (!result.success) {
          console.error('Error en registro:', result.error);
          const errorMsg = result.error || 'Error al crear la cuenta';
          
          // Mostrar mensaje más claro para rate limit
          if (errorMsg.toLowerCase().includes('rate limit') || errorMsg.toLowerCase().includes('límite') || errorMsg.toLowerCase().includes('429')) {
            showError(
              'Demasiados intentos',
              'Esperá unos minutos e intentá de nuevo. Si sigue fallando, probá desde otra red.'
            );
          } else if (
            errorMsg.toLowerCase().includes('confirmation email') ||
            errorMsg.toLowerCase().includes('credits exceeded') ||
            (errorMsg.toLowerCase().includes('email') && errorMsg.toLowerCase().includes('send'))
          ) {
            showError(
              'No pudimos enviar el email',
              'Tu cuenta puede haberse creado. Revisá tu correo (y spam) o pedí ayuda al entrenador.'
            );
          } else if (errorMsg.toLowerCase().includes('already') || errorMsg.toLowerCase().includes('registered') || errorMsg.toLowerCase().includes('existe')) {
            showError(
              'Este email ya está registrado',
              'Probá iniciar sesión o recuperá tu contraseña.'
            );
          } else if (errorMsg.toLowerCase().includes('500') || errorMsg.toLowerCase().includes('servidor')) {
            showError(
              'Algo salió mal',
              'No pudimos crear la cuenta ahora. Intentá de nuevo en unos minutos.'
            );
          } else {
            showError('No se pudo crear la cuenta', 'Revisá los datos e intentá nuevamente.');
          }
          
          setError(errorMsg);
          return;
        }
        
        const createdEmail = registerData.email.trim();
        setError(null);
        setIsRegisterMode(false);
        setCurrentStep(1);
        setCredentials({ email: createdEmail, password: "" });
        setRegisterData({
          firstName: "",
          lastName: "",
          phone: "",
          email: "",
          confirmEmail: "",
          password: "",
          confirmPassword: ""
        });
        setFieldErrors({
          firstName: "",
          lastName: "",
          phone: "",
          email: "",
          confirmEmail: "",
          password: "",
          confirmPassword: ""
        });
        setShowPassword(false);
        setShowConfirmPassword(false);

        if (result.warning) {
          showError(
            'Cuenta creada',
            'Tu cuenta se creó, pero no pudimos enviar el email. Contactá al entrenador para confirmarla.'
          );
        } else {
          setPendingConfirmationEmail(createdEmail);
          setResendFeedback(null);
          setResendCooldown(0);
        }
        
      } catch (err) {
        console.error('Error inesperado en registro:', err);
        setError('Error inesperado al crear la cuenta');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleBackStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Función para manejar modo recuperación
  const handleRecoverMode = () => {
    setIsRecoverMode(true);
    setIsRegisterMode(false);
    setCurrentStep(1);
    setError(null);
  };

  // Función para volver al login desde recuperación
  const handleBackToLogin = () => {
    setIsRecoverMode(false);
    setIsRegisterMode(false);
    setCurrentStep(1);
    setError(null);
    setCredentials({ email: "", password: "" });
  };

  const handleGoToLoginFromConfirmation = () => {
    setPendingConfirmationEmail(null);
    setResendFeedback(null);
    setResendCooldown(0);
    setIsRegisterMode(false);
    setIsRecoverMode(false);
    setCurrentStep(1);
    setError(null);
  };

  const handleResendConfirmation = async () => {
    if (!pendingConfirmationEmail || isResendingConfirmation || resendCooldown > 0) return;
    setIsResendingConfirmation(true);
    setResendFeedback(null);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: pendingConfirmationEmail,
      });
      if (resendError) throw resendError;
      setResendFeedback('Te lo volvimos a enviar. Revisá también spam.');
      setResendCooldown(60);
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : '').toLowerCase();
      if (msg.includes('rate limit') || msg.includes('429')) {
        setResendFeedback('Esperá un minuto y volvé a intentar.');
        setResendCooldown(60);
      } else {
        setResendFeedback('No pudimos reenviarlo ahora. Probá de nuevo en un rato.');
      }
    } finally {
      setIsResendingConfirmation(false);
    }
  };

  // Si está en modo recuperación, mostrar formulario de recuperación
  if (isRecoverMode) {
    return (
      <RecoverPasswordForm onBack={handleBackToLogin} />
    );
  }

  // Splash screen para mobile (solo se muestra 2.5 segundos)
  if (showSplash) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black md:hidden">
        <img src="/assets/logovertical.svg" alt="Logo" className="max-w-[180px] w-full px-8" />
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-x-hidden bg-black md:flex-row">
      {/* Desktop: panel izquierdo — logo full black */}
      <aside className="relative hidden md:flex md:w-1/2 md:flex-col md:items-center md:justify-center bg-black">
        <img
          src="/assets/logovertical.svg"
          alt="Logo MaldaGym"
          className="max-w-[280px] w-[55%] object-contain"
        />
        {/* Línea divisoria central */}
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-px bg-white/15"
        />
      </aside>

      {/* Mobile: layout actual · Desktop: panel derecho carbon */}
      <div className="flex flex-1 flex-col items-center bg-black p-2 pt-32 pb-0 md:w-1/2 md:justify-center md:bg-card md:p-8 md:pt-8">
        {/* Grupo modal + footer */}
        <div className="flex w-full max-w-md flex-1 flex-col justify-start pb-0 md:mb-0 md:flex-none md:justify-center md:space-y-8">
          <div className="mb-6 space-y-4 md:mb-0 md:space-y-8">
          {/* Login/Register Card */}
          <Card className="animate-slide-up border-border shadow-elegant">
          {pendingConfirmationEmail ? (
            <>
              <CardHeader className="space-y-3 p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted">
                  <Mail className="h-5 w-5 text-foreground" />
                </div>
                <CardTitle>Revisá tu correo</CardTitle>
                <CardDescription className="text-pretty">
                  Te enviamos un enlace a{' '}
                  <span className="font-medium text-foreground">{pendingConfirmationEmail}</span>
                  {' '}para confirmar tu cuenta. Hasta que no lo abras, no vas a poder ingresar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-6 pt-0">
                <p className="text-center text-sm text-muted-foreground">
                  ¿No lo recibiste todavía?{' '}
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={isResendingConfirmation || resendCooldown > 0}
                    className="font-medium text-foreground underline underline-offset-4 decoration-foreground/40 hover:decoration-foreground disabled:no-underline disabled:opacity-50"
                  >
                    {isResendingConfirmation
                      ? 'Enviando...'
                      : resendCooldown > 0
                        ? `Volver a enviar (${resendCooldown}s)`
                        : 'Volver a enviar'}
                  </button>
                </p>
                {resendFeedback && (
                  <p className="text-center text-xs text-muted-foreground">{resendFeedback}</p>
                )}
                <Button
                  type="button"
                  className="h-11 w-full text-sm"
                  onClick={handleGoToLoginFromConfirmation}
                >
                  Iniciar sesión
                </Button>
              </CardContent>
            </>
          ) : (
            <>
          <CardHeader className="space-y-1 p-3 md:p-6">
            <CardTitle className="text-center">
              {isRegisterMode ? `Crear Cuenta - Paso ${currentStep} de 2` : "Acceso"}
            </CardTitle>
            <CardDescription className="text-center">
              {isRegisterMode 
                ? currentStep === 2 
                  ? "Configure su acceso al sistema"
                  : ""
                : "Ingresá a la plataforma para visualizar y gestionar tus clases."
              }
            </CardDescription>
            {isRegisterMode && (
              <div className="flex justify-center mt-4">
                <div className="flex space-x-2">
                  <div className={`w-8 h-2 rounded-full ${currentStep >= 1 ? 'bg-primary' : 'bg-muted'}`}></div>
                  <div className={`w-8 h-2 rounded-full ${currentStep >= 2 ? 'bg-primary' : 'bg-muted'}`}></div>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-3 md:p-6 md:pt-0">
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isRegisterMode ? (
                // Login Form
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="Ingrese su email"
                        value={credentials.email}
                        onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
                        className="pl-10 text-sm transition-all duration-300 focus:ring-2 focus:ring-primary/50"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-xs">Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Ingrese su contraseña"
                        value={credentials.password}
                        onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                        className="pl-10 text-sm transition-all duration-300 focus:ring-2 focus:ring-primary/50"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 h-5 w-5 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                </>
              ) : currentStep === 1 ? (
                // Step 1: Personal Information
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-[11px] md:text-sm">Nombre</Label>
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="Nombre"
                        value={registerData.firstName}
                        onChange={(e) => handleNameChange('firstName', e.target.value)}
                        onBlur={(e) => validateField('firstName', e.target.value)}
                        className={`text-[11px] md:text-sm transition-all duration-300 focus:ring-2 focus:ring-primary/50 ${fieldErrors.firstName ? 'border-red-500' : ''}`}
                      />
                      {fieldErrors.firstName && <p className="text-xs text-red-500">{fieldErrors.firstName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-[11px] md:text-sm">Apellido</Label>
                      <Input
                        id="lastName"
                        type="text"
                        placeholder="Apellido"
                        value={registerData.lastName}
                        onChange={(e) => handleNameChange('lastName', e.target.value)}
                        onBlur={(e) => validateField('lastName', e.target.value)}
                        className={`text-[11px] md:text-sm transition-all duration-300 focus:ring-2 focus:ring-primary/50 ${fieldErrors.lastName ? 'border-red-500' : ''}`}
                      />
                      {fieldErrors.lastName && <p className="text-xs text-red-500">{fieldErrors.lastName}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-[11px] md:text-sm">Número de Teléfono</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="1123456789"
                      value={registerData.phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      onBlur={(e) => validateField('phone', e.target.value)}
                      className={`text-[11px] md:text-sm transition-all duration-300 focus:ring-2 focus:ring-primary/50 ${fieldErrors.phone ? 'border-red-500' : ''}`}
                      maxLength={10}
                    />
                    {fieldErrors.phone && <p className="text-xs text-red-500">{fieldErrors.phone}</p>}
                  </div>
                </>
              ) : (
                // Step 2: Account Setup
                <>
                  <div className="space-y-2">
                    <Label htmlFor="registerEmail" className="text-[11px] md:text-sm">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="registerEmail"
                        type="email"
                        placeholder="Ingrese su email"
                        value={registerData.email}
                        onChange={(e) => handleFieldChange('email', e.target.value)}
                        onBlur={(e) => validateField('email', e.target.value)}
                        className={`text-[11px] md:text-sm pl-10 pr-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50 ${fieldErrors.email ? 'border-red-500' : ''}`}
                      />
                    </div>
                    {fieldErrors.email && <p className="text-xs text-red-500">{fieldErrors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmEmail" className="text-[11px] md:text-sm">Confirmar Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmEmail"
                        type="email"
                        placeholder="Confirme su email"
                        value={registerData.confirmEmail}
                        onChange={(e) => handleFieldChange('confirmEmail', e.target.value)}
                        onBlur={(e) => validateField('confirmEmail', e.target.value)}
                        className={`text-[11px] md:text-sm pl-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50 ${fieldErrors.confirmEmail ? 'border-red-500' : ''}`}
                      />
                    </div>
                    {fieldErrors.confirmEmail && <p className="text-xs text-red-500">{fieldErrors.confirmEmail}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="registerPassword" className="text-[11px] md:text-sm">Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="registerPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Ingrese su contraseña"
                        value={registerData.password}
                        onChange={(e) => handleFieldChange('password', e.target.value)}
                        onBlur={(e) => validateField('password', e.target.value)}
                        className={`text-[11px] md:text-sm pl-10 pr-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50 ${fieldErrors.password ? 'border-red-500' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 h-5 w-5 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {fieldErrors.password && <p className="text-xs text-red-500">{fieldErrors.password}</p>}
                    
                    {/* Indicador de requisitos de contraseña */}
                    {registerData.password && (
                      <div className="mt-2 space-y-1">
                        <div className="space-y-1 text-xs">
                          <div className={`flex items-center gap-1 ${registerData.password.length >= 6 ? 'text-green-500' : 'text-muted-foreground'}`}>
                            {registerData.password.length >= 6 ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <span className="w-4 h-4 flex items-center justify-center">○</span>
                            )}
                            <span>Mínimo 6 caracteres</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-[11px] md:text-sm">Confirmar Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirme su contraseña"
                        value={registerData.confirmPassword}
                        onChange={(e) => handleFieldChange('confirmPassword', e.target.value)}
                        onBlur={(e) => validateField('confirmPassword', e.target.value)}
                        className={`text-[11px] md:text-sm pl-10 pr-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50 ${fieldErrors.confirmPassword ? 'border-red-500' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-3 h-5 w-5 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {fieldErrors.confirmPassword && <p className="text-xs text-red-500">{fieldErrors.confirmPassword}</p>}
                  </div>
                </>
              )}

              {isRegisterMode && currentStep === 2 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackStep}
                  className="w-full h-11 text-sm"
                >
                  Volver al paso anterior
                </Button>
              )}

              <Button
                type="submit"
                className="w-full h-11 text-sm"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                    <span>
                      {!isRegisterMode 
                        ? "Accediendo..." 
                        : currentStep === 1 
                          ? "Procesando..." 
                          : "Creando cuenta..."
                      }
                    </span>
                  </div>
                ) : (
                  <>
                    {!isRegisterMode 
                      ? "Iniciar sesión" 
                      : currentStep === 1 
                        ? "Continuar"
                        : "Crear Cuenta"
                    }
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center space-y-3">
              <p className="text-[10px] text-muted-foreground">
                {isRegisterMode ? (
                  <>
                    ¿Ya tenés cuenta?{" "}
                    <button 
                      onClick={() => {
                        setIsRegisterMode(false);
                        setCurrentStep(1);
                        setError(null);
                      }}
                      className="text-muted-foreground hover:underline font-medium text-caption"
                    >
                      Iniciar sesión
                    </button>
                  </>
                ) : (
                  <>
                    ¿No tenés cuenta?{" "}
                    <button 
                      onClick={() => {
                        setIsRegisterMode(true);
                        setCurrentStep(1);
                        setError(null);
                      }}
                      className="text-foreground hover:text-muted-foreground hover:underline font-medium text-caption"
                    >
                      Crear cuenta
                    </button>
                  </>
                )}
              </p>
              
              {!isRegisterMode && (
                <p className="text-[10px] text-muted-foreground">
                  ¿Olvidaste tu contraseña?{" "}
                  <button 
                    onClick={handleRecoverMode}
                    className="text-foreground hover:text-muted-foreground hover:underline font-medium text-caption"
                  >
                    Recuperar acceso
                  </button>
                </p>
              )}
            </div>
          </CardContent>
            </>
          )}
        </Card>
          </div>
          
          {/* Footer */}
          <footer className="mt-0 w-full flex-shrink-0 bg-transparent pb-0 pt-0 md:mt-0 md:bg-transparent md:pb-4 md:pt-2">
            <div className="flex items-center justify-center gap-2">
              <p className="text-xs text-white/70">Powered by</p>
              <a
                href="https://www.agarucorp.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium tracking-wide text-white/70 transition-colors hover:text-white hover:underline"
              >
                AGARUCORP
              </a>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};
