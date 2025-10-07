import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { LoginFormSimple } from "./components/LoginFormSimple";
import { ResetPasswordForm } from "./components/ResetPasswordForm";
import { TurnoReservation } from "./components/TurnoReservation";
import { RecurringScheduleModal } from "./components/RecurringScheduleModal";
import { RecurringScheduleView } from "./components/RecurringScheduleView";
import { useAuthContext } from "./contexts/AuthContext";
import { useFirstTimeUser } from "./hooks/useFirstTimeUser";
import { Calendar, Clock, User, Settings, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ProfileSettingsDialog } from "./components/ProfileSettingsDialog";
import Admin from "./pages/Admin";
import { useAdmin } from "./hooks/useAdmin";

// Componente Dashboard que usa el contexto de autenticación
const Dashboard = () => {
  const { user, signOut } = useAuthContext();
  const { isFirstTime, loading: firstTimeLoading } = useFirstTimeUser();
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [hasCompletedSetup, setHasCompletedSetup] = useState(false);
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  
  // Función para obtener las iniciales del usuario
  const getInitials = (email: string) => {
    if (!email) return 'U';
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email[0].toUpperCase();
  };

  // Función para obtener el nombre del usuario
  const getUserName = (email: string) => {
    if (!email) return 'Usuario';
    const name = email.split('@')[0];
    // Separar por punto y capitalizar cada parte
    const parts = name.split('.');
    if (parts.length >= 2) {
      return parts.map(part => 
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      ).join(' ');
    }
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const handleRecurringSetupComplete = () => {
    setShowRecurringModal(false);
    setHasCompletedSetup(true);
  };

  // Mostrar modal de configuración si es la primera vez
  useEffect(() => {
    if (!firstTimeLoading && isFirstTime && !hasCompletedSetup) {
      setShowRecurringModal(true);
    }
  }, [isFirstTime, firstTimeLoading, hasCompletedSetup]);

  // Si el usuario es admin y está en /user, redirigir a /admin
  useEffect(() => {
    if (!adminLoading && isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [adminLoading, isAdmin, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b shadow-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo centrado */}
            <div className="flex-1 flex justify-center">
              <div className="w-32 h-12">
                <img src="/letrasgym.png" alt="Logo Letras Gym" className="w-full h-full object-contain" />
              </div>
            </div>
            
            {/* Menú de usuario */}
            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-9 w-9 p-0 hover:bg-muted rounded-full"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                      {getInitials(user?.email || '')}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium">{getUserName(user?.email || '')}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer" onClick={() => setProfileOpen(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Configurar Perfil
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="cursor-pointer text-destructive focus:text-destructive"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-8">
        {firstTimeLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">
                Cargando...
              </p>
            </div>
          </div>
        ) : (
          <RecurringScheduleView />
        )}
      </main>

      {/* Perfil del usuario */}
      <ProfileSettingsDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        userId={user?.id ?? null}
        email={user?.email ?? null}
      />

      {/* Modal de configuración de horarios recurrentes para primera vez */}
      <RecurringScheduleModal
        isOpen={showRecurringModal}
        onClose={() => setShowRecurringModal(false)}
        onComplete={handleRecurringSetupComplete}
      />
    </div>
  );
};

const App = () => {
  console.log("App renderizando...");
  
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <TooltipProvider>
        <Toaster />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginFormSimple onLogin={() => {}} />} />
              <Route path="/reset-password" element={<ResetPasswordForm />} />
              <Route path="/user" element={<Dashboard />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
);
};

export default App;