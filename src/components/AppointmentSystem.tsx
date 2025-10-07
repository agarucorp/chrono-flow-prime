import { useState } from "react";
import { Calendar, Clock, User, Settings, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./LoginForm";
import { AppointmentCalendar } from "./AppointmentCalendar";
import { ProfessionalSettings } from "./ProfessionalSettings";
import { useAuth } from "@/contexts/AuthContext";

export const AppointmentSystem = () => {
  const { user, loading, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<'calendar' | 'settings'>('calendar');
  const [professional, setProfessional] = useState({
    name: "Dr. María González",
    specialty: "Medicina General",
    workingHours: { start: "09:00", end: "18:00" },
    appointmentDuration: 30,
    availableDays: [1, 2, 3, 4, 5] // Monday to Friday
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b shadow-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8">
                <img src="/logogym.svg" alt="Logo Gym" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">TurnoPro</h1>
                <p className="text-sm text-muted-foreground">Sistema de Gestión de Turnos</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">
                  {user.user_metadata?.first_name && user.user_metadata?.last_name 
                    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
                    : user.email}
                </p>
                <p className="text-xs text-muted-foreground">{professional.specialty}</p>
              </div>
              
              <Button
                variant={currentView === 'calendar' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentView('calendar')}
                className="h-9"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Turnos
              </Button>
              
              <Button
                variant={currentView === 'settings' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentView('settings')}
                className="h-9"
              >
                <Settings className="h-4 w-4 mr-2" />
                Configuración
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut()}
                className="h-9 text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Salir
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'calendar' ? (
          <AppointmentCalendar professional={professional} />
        ) : (
          <ProfessionalSettings 
            professional={professional} 
            onUpdate={setProfessional} 
          />
        )}
      </main>
    </div>
  );
};