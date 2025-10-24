import { useState, useEffect } from "react";
import { Lock, User, Mail, ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthContext } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/lib/supabase";
import { useNotifications } from "@/hooks/useNotifications";
import { RecoverPasswordForm } from "./RecoverPasswordForm";

interface LoginFormProps {
  onLogin: () => void;
}

export const LoginForm = ({ onLogin }: LoginFormProps) => {
  const { signIn, signUp, signOut, user } = useAuthContext();
  const { showSuccess, showError, showInfo, showWarning, showLoading, dismissToast } = useNotifications();
  // const { canBeAdmin } = useAdmin(); // ✅ Hook para verificar si un email puede ser admin - Temporalmente deshabilitado
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
  const [isLoading, setIsLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isRecoverMode, setIsRecoverMode] = useState(false); // ✅ Estado para modo recuperación
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false); // ✅ Estado para mostrar/ocultar contraseña

  // Redirigir cuando el usuario esté autenticado
  useEffect(() => {
    if (user && user.email_confirmed_at) {
      window.location.href = '/dashboard';
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!isRegisterMode) {
      // Login con Supabase
      try {
        setIsLoading(true);
        const loadingToast = showLoading("Iniciando sesión...");
        
        const result = await signIn(credentials.email, credentials.password);
        
        dismissToast(loadingToast);
        
        if (result.success) {
          showSuccess("¡Bienvenido!", "Sesión iniciada correctamente. El sistema está en desarrollo.");
          onLogin();
          // No redirigir, solo mostrar mensaje de éxito
        } else {
          showError("Error al iniciar sesión", result.error || "Credenciales incorrectas");
          setError(result.error || 'Error al iniciar sesión');
        }
      } catch (err) {
        showError("Error inesperado", "Ocurrió un problema al iniciar sesión");
        setError('Error inesperado al iniciar sesión');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Manejo del registro por pasos
    if (currentStep === 1) {
      // Validación paso 1
      if (!registerData.firstName || !registerData.lastName || !registerData.phone) {
        showWarning("Campos incompletos", "Por favor complete todos los campos del paso 1");
        setError("Por favor complete todos los campos del paso 1");
        return;
      }
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      // Validación paso 2
      if (registerData.email !== registerData.confirmEmail) {
        showWarning("Emails no coinciden", "Los emails ingresados no son iguales");
        setError("Los emails no coinciden");
        return;
      }
      if (registerData.password !== registerData.confirmPassword) {
        showWarning("Contraseñas no coinciden", "Las contraseñas ingresadas no son iguales");
        setError("Las contraseñas no coinciden");
        return;
      }
      
      try {
        setIsLoading(true);
        const loadingToast = showLoading("Creando cuenta...");
        
        // Crear usuario en Supabase con metadatos (para poblar perfiles automáticamente)
        const result = await signUp(registerData.email, registerData.password, {
          first_name: registerData.firstName,
          last_name: registerData.lastName,
          full_name: `${registerData.firstName} ${registerData.lastName}`,
          phone: registerData.phone
        });
        
        if (result.success && result.user) {
          // Nota: En este flujo el email debe confirmarse, por lo que el perfil se completará
          // con los metadatos del auth.user en el backend (trigger). Aquí solo mostramos feedback.
          dismissToast(loadingToast);
          {
            // ✅ Usuario creado exitosamente - mostrar toast y volver al login
            const roleMessage = "¡Usuario creado exitosamente! Revise su email y confirme la cuenta para poder iniciar sesión";
            
            showSuccess(
              "¡Usuario creado exitosamente!", 
              roleMessage
            );
            
            // Limpiar formulario y volver al login
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
            
            // Limpiar errores
            setError(null);
            
            // ✅ NO navegar a /turnos - el usuario debe confirmar email y hacer login primero
          }
        } else {
          dismissToast(loadingToast);
          showError("Error al crear cuenta", result.error || "No se pudo crear la cuenta");
          setError(result.error || 'Error al crear la cuenta');
        }
      } catch (err) {
        showError("Error inesperado", "Ocurrió un problema al crear la cuenta");
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

  // ✅ Función para manejar modo recuperación
  const handleRecoverMode = () => {
    setIsRecoverMode(true);
    setIsRegisterMode(false);
    setCurrentStep(1);
    setError(null);
  };

  // ✅ Función para volver al login desde recuperación
  const handleBackToLogin = () => {
    setIsRecoverMode(false);
    setIsRegisterMode(false);
    setCurrentStep(1);
    setError(null);
    setCredentials({ email: "", password: "" });
  };


  // ✅ Si está en modo recuperación, mostrar formulario de recuperación
  if (isRecoverMode) {
    return (
      <RecoverPasswordForm onBack={handleBackToLogin} />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="w-full max-w-md space-y-8">
                 {/* Logo */}
         <div className="text-center animate-fade-in">
           <div className="mx-auto w-32 h-32 mb-6">
             <img src="/maldagym1.png" alt="Logo Malda Gym" className="w-full h-full object-contain" />
           </div>
         </div>

        {/* Login/Register Card */}
        <Card className="shadow-elegant animate-slide-up">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              {isRegisterMode ? `Crear Cuenta - Paso ${currentStep} de 2` : "Acceso"}
            </CardTitle>
                         <CardDescription className="text-center">
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
            
            {/* Mensaje para usuarios recién registrados que no han confirmado email */}
            {user && !user.email_confirmed_at && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-700">
                  📧 <strong>¡Cuenta creada exitosamente!</strong> 
                  Hemos enviado un email de confirmación a <strong>{user.email}</strong>. 
                  Por favor, revisa tu bandeja y haz clic en el enlace para activar tu cuenta.
                </p>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isRegisterMode ? (
                // Login Form
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="Ingrese su email"
                        value={credentials.email}
                        onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
                        className="pl-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Ingrese su contraseña"
                        value={credentials.password}
                        onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                        className="pl-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50"
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
                        onChange={(e) => setRegisterData(prev => ({ ...prev, firstName: e.target.value }))}
                        className="transition-all duration-300 focus:ring-2 focus:ring-primary/50"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Apellido</Label>
                      <Input
                        id="lastName"
                        type="text"
                        placeholder="Apellido"
                        value={registerData.lastName}
                        onChange={(e) => setRegisterData(prev => ({ ...prev, lastName: e.target.value }))}
                        className="transition-all duration-300 focus:ring-2 focus:ring-primary/50"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Número de Teléfono</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+54 11 1234-5678"
                      value={registerData.phone}
                      onChange={(e) => setRegisterData(prev => ({ ...prev, phone: e.target.value }))}
                      className="transition-all duration-300 focus:ring-2 focus:ring-primary/50"
                      required
                    />
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
                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                        className="pl-10 pr-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50"
                        required
                      />
                      {/* ✅ Indicador de email admin - Temporalmente deshabilitado */}
                      {/* {registerData.email && canBeAdmin(registerData.email) && (
                        <div className="absolute right-3 top-3">
                          <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                            <svg 
                              className="w-3 h-3 text-white" 
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </div>
                        </div>
                      )} */}
                    </div>
                    {/* ✅ Mensaje informativo para emails admin - Temporalmente deshabilitado */}
                    {/* {registerData.email && canBeAdmin(registerData.email) && (
                      <p className="text-xs text-yellow-600 bg-yellow-50 p-2 rounded-md border border-yellow-200">
                        ✨ Este email puede ser configurado como administrador del sistema
                      </p>
                    )} */}
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
                        onChange={(e) => setRegisterData(prev => ({ ...prev, confirmEmail: e.target.value }))}
                        className="pl-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="registerPassword">Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="registerPassword"
                        type="password"
                        placeholder="Ingrese su contraseña"
                        value={registerData.password}
                        onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                        className="pl-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Confirme su contraseña"
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                        className="pl-10 pr-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50"
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
              )}

              {isRegisterMode && currentStep === 2 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackStep}
                  className="w-full mb-4"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Volver al Paso Anterior
                </Button>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-primary hover:shadow-md transition-all duration-300 h-11"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
                      ? "Iniciar Sesión" 
                      : currentStep === 1 
                        ? (
                          <>
                            Continuar
                            <ChevronRight className="w-4 h-4 ml-2" />
                          </>
                        )
                        : "Crear Cuenta"
                    }
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
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
                      className="text-primary hover:underline font-medium"
                    >
                      Crear cuenta
                    </button>
                  </>
                )}
              </p>
              
              {!isRegisterMode && (
                <>
                  <p className="text-sm text-muted-foreground">
                    ¿Olvidaste tu contraseña?{" "}
                    <button 
                      onClick={handleRecoverMode}
                      className="text-primary hover:underline font-medium"
                    >
                      Recuperar acceso
                    </button>
                  </p>
                  
                  
                  {/* Mensaje informativo para usuarios recién registrados */}
                  {/* ELIMINADO: <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-700">
                      💡 <strong>¿Primera vez aquí?</strong> Después de crear tu cuenta, 
                      revisa tu email y haz clic en el enlace de confirmación. 
                      Una vez confirmado, podrás iniciar sesión normalmente.
                    </p>
                  </div> */}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground">© Powered by AgaruCorp</p>
        </div>

      </div>

    </div>
  );
};