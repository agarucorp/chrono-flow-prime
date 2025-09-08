import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { LoginFormSimple } from "./components/LoginFormSimple";
import { TurnoReservation } from "./components/TurnoReservation";
import { Calendar, Clock, User, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
            <Route path="/dashboard" element={
              <div className="min-h-screen bg-background">
                {/* Header */}
                <header className="bg-card border-b shadow-card">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                      <div className="flex items-center space-x-4">
                        <div className="w-32 h-12">
                          <img src="/letrasgym.png" alt="Logo Letras Gym" className="w-full h-full object-contain" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Sistema de Gestión de Turnos</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">Usuario</p>
                          <p className="text-xs text-muted-foreground">Cliente</p>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.location.href = '/login'}
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
                  <TurnoReservation />
                </main>
              </div>
            } />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  );
};

export default App;