import { useState } from "react";
import { Calendar, Clock, User, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./LoginForm";
import { AppointmentCalendar } from "./AppointmentCalendar";
import { ProfessionalSettings } from "./ProfessionalSettings";
import { Footer } from "./Footer";

export const AppointmentSystem = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState<'calendar' | 'settings'>('calendar');
  const [professional, setProfessional] = useState({
    name: "Dr. María González",
    specialty: "Medicina General",
    workingHours: { start: "09:00", end: "18:00" },
    appointmentDuration: 30,
    availableDays: [1, 2, 3, 4, 5] // Monday to Friday
  });

  if (!isLoggedIn) {
    return <LoginForm onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b shadow-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="w-32 h-12">
                <img src="/letrasgym.png" alt="Logo MaldaGym" className="w-full h-full object-contain" />
              </div>
                             <div>
                 <p className="text-sm text-muted-foreground">Sistema de Gestión de Turnos</p>
               </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{professional.name}</p>
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
                onClick={() => setIsLoggedIn(false)}
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

      <Footer />
    </div>
  );
};