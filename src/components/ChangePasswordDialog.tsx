import { useState } from "react";
import { Lock, Eye, EyeOff, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotifications } from "@/hooks/useNotifications";
import { supabase } from "@/lib/supabase";

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

export const ChangePasswordDialog = ({ open, onClose }: ChangePasswordDialogProps) => {
  const { showSuccess, showError, showLoading, dismissToast } = useNotifications();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones
    if (!currentPassword.trim()) {
      showError("Campo requerido", "Por favor ingrese su contraseña actual");
      return;
    }

    if (!newPassword.trim()) {
      showError("Campo requerido", "Por favor ingrese su nueva contraseña");
      return;
    }

    if (newPassword.length < 6) {
      showError("Contraseña muy corta", "La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      showError("Contraseñas no coinciden", "Las contraseñas nuevas no coinciden");
      return;
    }

    if (currentPassword === newPassword) {
      showError("Contraseña inválida", "La nueva contraseña debe ser diferente a la actual");
      return;
    }

    try {
      setIsLoading(true);
      const loadingToast = showLoading("Cambiando contraseña...");

      // Verificar contraseña actual reautenticando
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: (await supabase.auth.getUser()).data.user?.email || '',
        password: currentPassword
      });

      if (reauthError) {
        dismissToast(loadingToast);
        showError("Contraseña actual incorrecta", "La contraseña actual no es válida");
        return;
      }

      // Actualizar contraseña
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      dismissToast(loadingToast);

      if (error) {
        showError("Error al cambiar contraseña", error.message);
        return;
      }

      // Éxito
      setPasswordChanged(true);
      showSuccess(
        "¡Contraseña cambiada!", 
        "Su contraseña ha sido actualizada exitosamente"
      );

      // Limpiar formulario después de 2 segundos
      setTimeout(() => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPasswordChanged(false);
        onClose();
      }, 2000);

    } catch (err) {
      showError("Error inesperado", "Ocurrió un problema al cambiar la contraseña");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordChanged(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        {/* Botón X para mobile */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          className="absolute right-2 top-2 sm:hidden h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
        
        <DialogHeader className="pb-3 sm:block hidden">
          <DialogTitle className="text-center text-sm">
            Cambiar Contraseña
          </DialogTitle>
          <DialogDescription className="text-center text-sm">
            Ingrese su contraseña actual y la nueva contraseña
          </DialogDescription>
        </DialogHeader>

        {passwordChanged ? (
          <div className="text-center space-y-4 py-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-600">
                ¡Contraseña Cambiada!
              </h3>
              <p className="text-sm text-muted-foreground">
                Su contraseña ha sido actualizada exitosamente
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-sm">Contraseña Actual</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="Ingrese su contraseña actual"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pl-10 pr-10 text-sm h-9"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm">Nueva Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Ingrese su nueva contraseña"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 pr-10 text-sm h-9"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
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
              <Label htmlFor="confirmPassword" className="text-sm">Confirmar Nueva Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirme su nueva contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10 text-sm h-9"
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

            {/* Mobile: Botón único */}
            <div className="sm:hidden pt-4">
              <Button
                type="submit"
                className="w-full text-sm h-10"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Cambiando...</span>
                  </div>
                ) : (
                  "Cambiar Contraseña"
                )}
              </Button>
            </div>

            {/* Desktop: Botones horizontales */}
            <div className="hidden sm:flex space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1 text-sm h-9"
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 text-sm h-9"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Cambiando...</span>
                  </div>
                ) : (
                  "Cambiar Contraseña"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
