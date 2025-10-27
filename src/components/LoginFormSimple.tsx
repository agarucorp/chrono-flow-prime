import { useState } from "react";
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

interface LoginFormProps {
  onLogin: () => void;
}

export const LoginFormSimple = ({ onLogin }: LoginFormProps) => {
  const { signIn, signUp } = useAuthContext();
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

  // Handler para nombre y apellido: solo letras y espacios
  const handleNameChange = (field: 'firstName' | 'lastName', value: string) => {
    const sanitized = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
    setRegisterData(prev => ({ ...prev, [field]: sanitized }));
    setFieldErrors(prev => ({ ...prev, [field]: "" }));
  };

  // Handler para teléfono: solo números, máximo 10 caracteres
  const handlePhoneChange = (value: string) => {
    const sanitized = value.replace(/[^0-9]/g, '').slice(0, 10);
    setRegisterData(prev => ({ ...prev, phone: sanitized }));
    setFieldErrors(prev => ({ ...prev, phone: "" }));
  };

  // Verificar requisitos de contraseña
  const checkPasswordRequirements = (password: string) => {
    return {
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      minLength: password.length >= 8,
      noSpecialChars: /^[a-zA-Z0-9]*$/.test(password)
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
        } else if (value.length !== 10) {
          setFieldErrors(prev => ({ ...prev, phone: "Debe tener 10 dígitos" }));
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
          if (!requirements.noSpecialChars) {
            setFieldErrors(prev => ({ ...prev, password: "No se permiten caracteres especiales" }));
          } else if (!requirements.minLength) {
            setFieldErrors(prev => ({ ...prev, password: "La contraseña debe tener al menos 8 caracteres" }));
          } else if (!requirements.hasUppercase || !requirements.hasLowercase || !requirements.hasNumber) {
            setFieldErrors(prev => ({ ...prev, password: "Debe contener mayúsculas, minúsculas y números" }));
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
        const result = await signIn(credentials.email, credentials.password);

        if (!result.success || !result.user) {
          const message = result.error || 'Error al iniciar sesión';
          console.error('Error en login:', message);
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
      if (registerData.phone.length !== 10) {
        setError("El número de teléfono debe tener exactamente 10 dígitos");
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
      if (!requirements.noSpecialChars) {
        setError("No se permiten caracteres especiales en la contraseña");
        return;
      }
      if (!requirements.minLength) {
        setError("La contraseña debe tener al menos 8 caracteres");
        return;
      }
      if (!requirements.hasUppercase || !requirements.hasLowercase || !requirements.hasNumber) {
        setError("La contraseña debe contener mayúsculas, minúsculas y números");
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
        
        if (!result.success) {
          console.error('Error en registro:', result.error);
          setError(result.error || 'Error al crear la cuenta');
          return;
        }
        
        setError(null);
        setIsRegisterMode(false);
        setCurrentStep(1);
        setRegisterData({
          firstName: "",
          lastName: "",
          phone: "",
          email: "",
          confirmEmail: "",
          password: "",
          confirmPassword: ""
        });
        
        // Mostrar mensaje de éxito
        showSuccess('¡Cuenta creada exitosamente!', 'Revisa tu email para confirmar tu cuenta.');
        
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

  // Si está en modo recuperación, mostrar formulario de recuperación
  if (isRecoverMode) {
    return (
      <RecoverPasswordForm onBack={handleBackToLogin} />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="w-full max-w-md space-y-8">
        {/* Logo - Removed for mobile */}

        {/* Login/Register Card */}
        <Card className="shadow-elegant animate-slide-up">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg md:text-xl text-center">
              {isRegisterMode ? `Crear Cuenta - Paso ${currentStep} de 2` : "Acceso"}
            </CardTitle>
            <CardDescription className="text-xs md:text-sm text-center">
              {isRegisterMode 
                ? currentStep === 1 
                  ? "Complete su información personal" 
                  : "Configure su acceso al sistema"
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
          <CardContent>
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
                      <Label htmlFor="firstName">Nombre</Label>
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="Nombre"
                        value={registerData.firstName}
                        onChange={(e) => handleNameChange('firstName', e.target.value)}
                        onBlur={(e) => validateField('firstName', e.target.value)}
                        className={`transition-all duration-300 focus:ring-2 focus:ring-primary/50 ${fieldErrors.firstName ? 'border-red-500' : ''}`}
                      />
                      {fieldErrors.firstName && <p className="text-xs text-red-500">{fieldErrors.firstName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Apellido</Label>
                      <Input
                        id="lastName"
                        type="text"
                        placeholder="Apellido"
                        value={registerData.lastName}
                        onChange={(e) => handleNameChange('lastName', e.target.value)}
                        onBlur={(e) => validateField('lastName', e.target.value)}
                        className={`transition-all duration-300 focus:ring-2 focus:ring-primary/50 ${fieldErrors.lastName ? 'border-red-500' : ''}`}
                      />
                      {fieldErrors.lastName && <p className="text-xs text-red-500">{fieldErrors.lastName}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Número de Teléfono (10 dígitos)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="1123456789"
                      value={registerData.phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      onBlur={(e) => validateField('phone', e.target.value)}
                      className={`transition-all duration-300 focus:ring-2 focus:ring-primary/50 ${fieldErrors.phone ? 'border-red-500' : ''}`}
                      maxLength={10}
                    />
                    {fieldErrors.phone && <p className="text-xs text-red-500">{fieldErrors.phone}</p>}
                  </div>
                </>
              ) : (
                // Step 2: Account Setup
                <>
                  <div className="space-y-2">
                    <Label htmlFor="registerEmail">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="registerEmail"
                        type="email"
                        placeholder="Ingrese su email"
                        value={registerData.email}
                        onChange={(e) => handleFieldChange('email', e.target.value)}
                        onBlur={(e) => validateField('email', e.target.value)}
                        className={`pl-10 pr-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50 ${fieldErrors.email ? 'border-red-500' : ''}`}
                      />
                    </div>
                    {fieldErrors.email && <p className="text-xs text-red-500">{fieldErrors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmEmail">Confirmar Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmEmail"
                        type="email"
                        placeholder="Confirme su email"
                        value={registerData.confirmEmail}
                        onChange={(e) => handleFieldChange('confirmEmail', e.target.value)}
                        onBlur={(e) => validateField('confirmEmail', e.target.value)}
                        className={`pl-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50 ${fieldErrors.confirmEmail ? 'border-red-500' : ''}`}
                      />
                    </div>
                    {fieldErrors.confirmEmail && <p className="text-xs text-red-500">{fieldErrors.confirmEmail}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="registerPassword">Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="registerPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Ingrese su contraseña"
                        value={registerData.password}
                        onChange={(e) => handleFieldChange('password', e.target.value)}
                        onBlur={(e) => validateField('password', e.target.value)}
                        className={`pl-10 pr-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50 ${fieldErrors.password ? 'border-red-500' : ''}`}
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
                        {(() => {
                          const req = checkPasswordRequirements(registerData.password);
                          return (
                            <div className="space-y-1 text-xs">
                              <div className={`flex items-center gap-1 ${req.hasUppercase ? 'text-green-500' : 'text-muted-foreground'}`}>
                                {req.hasUppercase ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <span className="w-4 h-4 flex items-center justify-center">○</span>
                                )}
                                <span>Al menos una mayúscula</span>
                              </div>
                              <div className={`flex items-center gap-1 ${req.hasLowercase ? 'text-green-500' : 'text-muted-foreground'}`}>
                                {req.hasLowercase ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <span className="w-4 h-4 flex items-center justify-center">○</span>
                                )}
                                <span>Al menos una minúscula</span>
                              </div>
                              <div className={`flex items-center gap-1 ${req.hasNumber ? 'text-green-500' : 'text-muted-foreground'}`}>
                                {req.hasNumber ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <span className="w-4 h-4 flex items-center justify-center">○</span>
                                )}
                                <span>Al menos un número</span>
                              </div>
                              <div className={`flex items-center gap-1 ${req.minLength ? 'text-green-500' : 'text-muted-foreground'}`}>
                                {req.minLength ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <span className="w-4 h-4 flex items-center justify-center">○</span>
                                )}
                                <span>Mínimo 8 caracteres</span>
                              </div>
                              <div className={`flex items-center gap-1 ${req.noSpecialChars ? 'text-green-500' : 'text-muted-foreground'}`}>
                                {req.noSpecialChars ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <span className="w-4 h-4 flex items-center justify-center">○</span>
                                )}
                                <span>Sin caracteres especiales</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirme su contraseña"
                        value={registerData.confirmPassword}
                        onChange={(e) => handleFieldChange('confirmPassword', e.target.value)}
                        onBlur={(e) => validateField('confirmPassword', e.target.value)}
                        className={`pl-10 pr-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50 ${fieldErrors.confirmPassword ? 'border-red-500' : ''}`}
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
                  className="w-full mb-4"
                >
                  Volver al Paso Anterior
                </Button>
              )}

              <Button
                type="submit"
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 transition-all duration-300 h-11"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-800"></div>
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
              <p className="text-xs text-muted-foreground">
                {isRegisterMode ? (
                  <>
                    ¿Ya tenés cuenta?{" "}
                    <button 
                      onClick={() => {
                        setIsRegisterMode(false);
                        setCurrentStep(1);
                        setError(null);
                      }}
                      className="text-gray-300 hover:underline font-medium"
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
                      className="text-white hover:text-gray-200 hover:underline font-medium"
                    >
                      Crear cuenta
                    </button>
                  </>
                )}
              </p>
              
              {!isRegisterMode && (
                <p className="text-xs text-muted-foreground">
                  ¿Olvidaste tu contraseña?{" "}
                  <button 
                    onClick={handleRecoverMode}
                    className="text-white hover:text-gray-200 hover:underline font-medium"
                  >
                    Recuperar acceso
                  </button>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-muted-foreground">© Powered by AgaruCorp</p>
        </div>

      </div>
    </div>
  );
};
