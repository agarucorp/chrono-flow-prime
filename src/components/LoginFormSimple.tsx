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
import { RecoverPasswordForm } from "./RecoverPasswordForm";

interface LoginFormProps {
  onLogin: () => void;
}

export const LoginFormSimple = ({ onLogin }: LoginFormProps) => {
  const { signIn, signUp } = useAuthContext();
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
  const [isLoading, setIsLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isRecoverMode, setIsRecoverMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!isRegisterMode) {
      // Login real con Supabase
      try {
        setIsLoading(true);
        console.log("Intentando login con:", credentials.email);
        
        const result = await signIn(credentials.email, credentials.password);

        if (!result.success || !result.user) {
          const message = result.error || 'Error al iniciar sesión';
          console.error('Error en login:', message);
          setError(message);
          return;
        }

        console.log('Login exitoso');

        // Consultar rol desde profiles para decidir la redirección
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
      if (!registerData.firstName || !registerData.lastName || !registerData.phone) {
        setError("Por favor complete todos los campos del paso 1");
        return;
      }
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
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
        console.log("Registrando usuario:", registerData.email);
        
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
        
        console.log('Registro exitoso:', result.user);
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
        alert('¡Cuenta creada exitosamente! Revisa tu email para confirmar tu cuenta.');
        
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
                : "Ingresá a la plataforma para visualizar el calendario con los turnos disponibles y gestionar tus reservas."
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
                    </div>
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
                        ? "Continuar"
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
                    ¿Ya tienes cuenta?{" "}
                    <button 
                      onClick={() => {
                        setIsRegisterMode(false);
                        setCurrentStep(1);
                        setError(null);
                      }}
                      className="text-primary hover:underline font-medium"
                    >
                      Iniciar sesión
                    </button>
                  </>
                ) : (
                  <>
                    ¿No tienes cuenta?{" "}
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
                <p className="text-sm text-muted-foreground">
                  ¿Olvidaste tu contraseña?{" "}
                  <button 
                    onClick={handleRecoverMode}
                    className="text-primary hover:underline font-medium"
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
          <p className="text-sm text-muted-foreground">© Powered by AgaruCorp</p>
        </div>

      </div>
    </div>
  );
};
