import { useState } from "react";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotifications } from "@/hooks/useNotifications";
import { supabase } from "@/lib/supabase";

interface RecoverPasswordFormProps {
  onBack: () => void;
}

export const RecoverPasswordForm = ({ onBack }: RecoverPasswordFormProps) => {
  const { showSuccess, showError, showLoading, dismissToast } = useNotifications();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      showError("Campo requerido", "Por favor ingrese su email");
      return;
    }

    try {
      setIsLoading(true);
      const loadingToast = showLoading("Enviando email de recuperación...");

      // Enviar email de recuperación de contraseña
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'http://localhost:8080/reset-password'
      });

      dismissToast(loadingToast);

      if (error) {
        showError("Error al enviar email", error.message);
        return;
      }

      // Éxito
      setEmailSent(true);
      showSuccess(
        "Email enviado exitosamente", 
        "Revise su bandeja de entrada y siga las instrucciones"
      );

    } catch (err) {
      showError("Error inesperado", "Ocurrió un problema al enviar el email");
    } finally {
      setIsLoading(false);
    }
  };

  // Pantalla de confirmación después de enviar el email
  if (emailSent) {
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
                ¡Email Enviado!
              </CardTitle>
              <CardDescription>
                Hemos enviado las instrucciones de recuperación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Hemos enviado un email de recuperación a:
                </p>
                <p className="font-medium text-foreground bg-muted p-3 rounded-lg">
                  {email}
                </p>
                <p className="text-sm text-muted-foreground">
                  Por favor, revise su bandeja de entrada y siga las instrucciones 
                  para restablecer su contraseña.
                </p>
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={onBack}
                  variant="outline" 
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver al Login
                </Button>
                
                <Button 
                  onClick={() => setEmailSent(false)}
                  className="w-full"
                >
                  Enviar a otro email
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
                 {/* Logo */}
         <div className="text-center animate-fade-in">
           <div className="mx-auto w-32 h-32 mb-6">
             <img src="/maldagym1.png" alt="Logo Malda Gym" className="w-full h-full object-contain" />
           </div>
         </div>

        {/* Recover Password Card */}
        <Card className="shadow-elegant animate-slide-up">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              Recuperar Acceso
            </CardTitle>
            <CardDescription className="text-center">
              Ingrese su email para recibir instrucciones de recuperación
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recoverEmail">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="recoverEmail"
                    type="email"
                    placeholder="Ingrese su email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 transition-all duration-300 focus:ring-2 focus:ring-primary/50"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-primary hover:shadow-md transition-all duration-300 h-11"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Enviando...</span>
                  </div>
                ) : (
                  "Enviar Instrucciones"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Button 
                onClick={onBack}
                variant="ghost" 
                size="sm"
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al Login
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
