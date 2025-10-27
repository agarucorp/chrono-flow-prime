import { useState, useEffect } from "react";
import { Lock, CheckCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotifications } from "@/hooks/useNotifications";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

export const ResetPasswordForm = () => {
  const { showSuccess, showError, showLoading, dismissToast } = useNotifications();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  // Verificar si el usuario está en modo reset password
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Verificar si hay un hash en la URL con el token de recuperación
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');
        
        // Si hay un token de acceso y es tipo recovery, establecer la sesión
        if (accessToken && type === 'recovery') {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: hashParams.get('refresh_token') || ''
          });
          
          if (error) {
            console.error('Error setting session:', error);
            showError("Enlace inválido", "Este enlace de recuperación no es válido o ha expirado");
            setTimeout(() => navigate('/login'), 3000);
            setIsValidSession(false);
            return;
          }
          
          setIsValidSession(true);
        } else {
          // Verificar si ya hay una sesión válida
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) {
            showError("Enlace inválido", "Este enlace de recuperación no es válido o ha expirado");
            setTimeout(() => navigate('/login'), 3000);
            setIsValidSession(false);
            return;
          }
          
          setIsValidSession(true);
        }
      } catch (err) {
        console.error('Error checking session:', err);
        showError("Error", "Hubo un problema al verificar su sesión");
        setTimeout(() => navigate('/login'), 3000);
        setIsValidSession(false);
      }
    };

    checkSession();
  }, [navigate, showError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones
    if (!password.trim()) {
      showError("Campo requerido", "Por favor ingrese su nueva contraseña");
      return;
    }

    if (password.length < 6) {
      showError("Contraseña muy corta", "La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      showError("Contraseñas no coinciden", "Las contraseñas ingresadas no son iguales");
      return;
    }

    try {
      setIsLoading(true);
      const loadingToast = showLoading("Actualizando contraseña...");

      // Actualizar contraseña
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      dismissToast(loadingToast);

      if (error) {
        showError("Error al actualizar contraseña", error.message);
        return;
      }

      // Éxito
      setPasswordReset(true);
      showSuccess(
        "¡Contraseña actualizada!", 
        "Su contraseña ha sido cambiada exitosamente"
      );

      // Cerrar sesión para que haga login con la nueva contraseña
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/login');
      }, 3000);

    } catch (err) {
      showError("Error inesperado", "Ocurrió un problema al actualizar la contraseña");
    } finally {
      setIsLoading(false);
    }
  };

  // Mostrar loading mientras se verifica la sesión
  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando enlace...</p>
        </div>
      </div>
    );
  }

  // Si la sesión no es válida, no mostrar nada (ya se redirige o muestra error)
  if (isValidSession === false) {
    return null;
  }

  // Pantalla de confirmación después de resetear contraseña
  if (passwordReset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="text-center animate-fade-in">
            <div className="mx-auto w-32 h-32 mb-6">
              <img src="/maldagym1.png" alt="Logo Malda Gym" className="w-full h-full object-contain" />
            </div>
          </div>

          {/* Success Card */}
          <Card className="shadow-elegant animate-slide-up">
            <CardHeader className="text-center space-y-1">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-green-600">
                ¡Contraseña Actualizada!
              </CardTitle>
              <CardDescription>
                Su contraseña ha sido cambiada exitosamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Su contraseña ha sido actualizada correctamente. 
                  Será redirigido al login en unos segundos para que pueda 
                  iniciar sesión con su nueva contraseña.
                </p>
              </div>

              <div className="text-center">
                <Button 
                  onClick={() => navigate('/login')}
                  className="w-full"
                >
                  Ir al Login
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">© Powered by AgaruCorp</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Reset Password Card */}
        <Card className="shadow-elegant animate-slide-up">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              Establecer nueva contraseña
            </CardTitle>
            <CardDescription className="text-center">
              Ingrese su nueva contraseña para recuperar el acceso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nueva Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Ingrese su nueva contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mínimo 6 caracteres
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">Confirmar Nueva Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmNewPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirme su nueva contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-white text-gray-900 hover:bg-gray-100 border border-gray-300 transition-all duration-300 h-11"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                    <span>Actualizando...</span>
                  </div>
                ) : (
                  "Actualizar contraseña"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Button 
                onClick={() => navigate('/login')}
                variant="ghost" 
                size="sm"
                className="text-muted-foreground hover:text-foreground"
              >
                Cancelar y volver al Login
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">© Powered by AgaruCorp</p>
        </div>
      </div>
    </div>
  );
};
