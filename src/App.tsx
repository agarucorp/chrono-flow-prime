import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { LoginFormSimple } from "./components/LoginFormSimple";
import { ResetPasswordForm } from "./components/ResetPasswordForm";
import { TurnoReservation } from "./components/TurnoReservation";
import { RecurringScheduleModal } from "./components/RecurringScheduleModal";
import { RecurringScheduleView } from "./components/RecurringScheduleView";
import { useAuthContext } from "./contexts/AuthContext";
import { useFirstTimeUser } from "./hooks/useFirstTimeUser";
import { Calendar, Clock, User, Settings, LogOut, ChevronDown, HelpCircle, Dumbbell, Zap, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ProfileSettingsDialog } from "./components/ProfileSettingsDialog";
import { SupportModal } from "./components/SupportModal";
import Admin from "./pages/Admin";
import { useAdmin } from "./hooks/useAdmin";
import { ProtectedRoute } from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import { useUserBalance } from "./hooks/useUserBalance";
import { OnboardingTutorial } from "./components/OnboardingTutorial";
import { supabase } from "./lib/supabase";

// Componente Dashboard que usa el contexto de autenticación
const Dashboard = () => {
  const { user, signOut } = useAuthContext();
  const { isFirstTime, loading: firstTimeLoading } = useFirstTimeUser();
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [hasCompletedSetup, setHasCompletedSetup] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialProcessed, setTutorialProcessed] = useState(false);
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const location = useLocation();
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

  // Nombre mostrado en el menú del avatar: profiles/user_metadata/email
  const getDisplayName = () => {
    const meta: any = user?.user_metadata || {};
    const first = (meta.first_name || '').toString().trim();
    const last = (meta.last_name || '').toString().trim();
    if (first || last) return `${first} ${last}`.trim();
    const email = user?.email || '';
    if (!email) return 'Usuario';
    const base = email.split('@')[0];
    const parts = base.split('.');
    if (parts.length >= 2) {
      return parts
        .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : ''))
        .join(' ')
        .trim();
    }
    return base.charAt(0).toUpperCase() + base.slice(1);
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

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

  const handleTutorialClose = async (dontShowAgain: boolean) => {
    if (dontShowAgain && user) {
      try {
        await supabase.auth.updateUser({ data: { onboarding_tutorial_dismissed: true } });
      } catch (error) {
        console.error('Error actualizando preferencia de tutorial:', error);
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem(`onboarding-tutorial-${user.id}`, 'true');
      }
    }

    setShowTutorial(false);
    setTutorialProcessed(true);
    if (isFirstTime && !hasCompletedSetup) {
      setShowRecurringModal(true);
    }
  };

  // Mostrar modal de configuración si es la primera vez
  useEffect(() => {
    if (!firstTimeLoading && isFirstTime && !hasCompletedSetup && !showTutorial && tutorialProcessed) {
      setShowRecurringModal(true);
    }
  }, [isFirstTime, firstTimeLoading, hasCompletedSetup, showTutorial, tutorialProcessed]);

  // Escuchar evento de apertura de perfil desde la navbar mobile
  useEffect(() => {
    const handleProfileOpen = () => setProfileOpen(true);
    const handleSignOutEvent = () => handleSignOut();
    const handleSupportOpen = () => setSupportOpen(true);
    window.addEventListener('profile:open', handleProfileOpen);
    window.addEventListener('auth:signout', handleSignOutEvent);
    window.addEventListener('soporte:open', handleSupportOpen);
    return () => {
      window.removeEventListener('profile:open', handleProfileOpen);
      window.removeEventListener('auth:signout', handleSignOutEvent);
      window.removeEventListener('soporte:open', handleSupportOpen);
    };
  }, [handleSignOut]);

  // Comentado: La redirección de admin se maneja en el login
  // useEffect(() => {
  //   if (!adminLoading && isAdmin) {
  //     navigate('/admin', { replace: true });
  //   }
  // }, [adminLoading, isAdmin, navigate]);

  const getMonthNameEs = (date: Date) => {
    const nombres = [
      'enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'
    ];
    return nombres[date.getMonth()];
  };

  const now = new Date();
  const mesActualNombre = getMonthNameEs(now);
  const [activeTab, setActiveTab] = useState<'clases' | 'balance' | 'vacantes'>('clases');
  const [balanceSubView, setBalanceSubView] = useState<'mis-clases' | 'vacantes' | 'balance'>('balance');
  const {
    history: balanceHistory,
    loading: balanceLoading,
  } = useUserBalance();

  const tutorialSlides = [
    {
      title: 'Sistema de autogestión de clases',
      description: 'En esta plataforma vas a poder setear tus clases en MaldaGym de forma recurrente, visualizar tus horarios, cancelarlos y reservar clases canceladas por otros alumnos.'
    },
    {
      title: 'Selección de horarios',
      description: 'Una vez que selecciones tus horarios, no podrán ser modificados (etapa en desarrollo). Por favor elegirlos cuidadosamente.'
    },
    {
      title: 'Balance',
      description: 'Vista de tu cuota actual, siguiente e historial. El pago es por adelantado y todos los cambios que afecten el mes actual impactarán en el próximo.'
    },
    {
      title: 'Vacantes',
      description: 'Las clases canceladas aparecerán en este panel para que puedan ser reservadas por otros alumnos si así lo desean.'
    },
    {
      title: 'Información',
      description: 'Si tenés alguna duda podés ver una guía de la plataforma ingresando a “Información” desde el ícono de perfil.'
    }
  ];

  useEffect(() => {
    if (!user || firstTimeLoading || isFirstTime === null) return;

    const metadataDismissed = Boolean(user.user_metadata?.onboarding_tutorial_dismissed);
    const localDismissed = typeof window !== 'undefined'
      ? localStorage.getItem(`onboarding-tutorial-${user.id}`) === 'true'
      : false;

    if (isFirstTime && !metadataDismissed && !localDismissed) {
      setShowRecurringModal(false);
      setShowTutorial(true);
      setTutorialProcessed(false);
    } else {
      setTutorialProcessed(true);
      if (isFirstTime) {
        setShowRecurringModal(true);
      }
    }
  }, [user, firstTimeLoading, isFirstTime]);

  // Sincronizar pestaña con query param ?tab=
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'clases' || tab === 'balance' || tab === 'vacantes') {
      setActiveTab(tab);
    }
  }, [location.search]);

  // Permitir cambiar pestaña vía eventos globales (para integrar navbar inferior existente)
  useEffect(() => {
    const toClases = () => setActiveTab('clases');
    const toBalance = () => setActiveTab('balance');
    const toVacantes = () => setActiveTab('vacantes');
    window.addEventListener('nav:clases', toClases);
    window.addEventListener('nav:balance', toBalance);
    window.addEventListener('nav:vacantes', toVacantes);
    return () => {
      window.removeEventListener('nav:clases', toClases);
      window.removeEventListener('nav:balance', toBalance);
      window.removeEventListener('nav:vacantes', toVacantes);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header restaurado */}
      <header className="bg-black shadow-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-1"></div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Soporte"
                className="hidden sm:inline-flex items-center justify-center h-10 w-10 transition-all duration-200 hover:scale-105 group"
                onClick={() => window.dispatchEvent(new CustomEvent('soporte:open'))}
              >
                <HelpCircle className="h-5 w-5 text-gray-300 group-hover:text-white transition-colors" />
              </button>
              <div className="hidden sm:block">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-9 w-9 p-0 hover:bg-muted"
                    >
                      <User className="h-6 w-6 text-accent-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium">{getDisplayName()}</p>
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
                      onClick={() => window.dispatchEvent(new CustomEvent('auth:signout-confirm'))}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Cerrar Sesión
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <button
                type="button"
                aria-label="Soporte"
                className="sm:hidden inline-flex items-center justify-center h-10 w-10 active:scale-95 transition-all duration-200 group"
                onClick={() => window.dispatchEvent(new CustomEvent('soporte:open'))}
              >
                <HelpCircle className="h-5 w-5 text-gray-300 group-hover:text-white transition-colors" />
              </button>

              {/* Perfil en mobile: Dropdown con acciones */}
              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-10 w-10 p-0 active:scale-95 transition-all duration-200"
                      aria-label="Abrir menú de perfil"
                    >
                      <User className="h-5 w-5 text-gray-300" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem className="cursor-pointer" onClick={() => window.dispatchEvent(new CustomEvent('profile:open'))}>
                      <Settings className="h-4 w-4 mr-2" />
                      Configurar Perfil
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="cursor-pointer text-destructive focus:text-destructive"
                      onClick={() => window.dispatchEvent(new CustomEvent('auth:signout-confirm'))}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Cerrar Sesión
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
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
          <div className="w-full pb-24 sm:pb-0">
            {/* Desktop: usamos la navbar existente en RecurringScheduleView */}

            {/* Contenido según pestaña activa */}
            {activeTab === 'clases' && (
              <div className="mt-4">
                <RecurringScheduleView />
              </div>
            )}

            {activeTab === 'balance' && (
              <div className="mt-4">
                {/* Subnavbar igual que en RecurringScheduleView */}
                <div className="hidden sm:flex justify-center mb-4">
                  <div className="flex space-x-1 bg-muted p-1 rounded-full w-fit">
                    <button
                      onClick={() => setBalanceSubView('mis-clases')}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        balanceSubView === 'mis-clases'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Mis Clases
                    </button>
                    <button
                      onClick={() => setBalanceSubView('vacantes')}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        balanceSubView === 'vacantes'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Vacantes
                    </button>
                    <button
                      onClick={() => setBalanceSubView('balance')}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        balanceSubView === 'balance'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Balance
                    </button>
                  </div>
                </div>

                {/* Contenido según sub-vista */}
                {balanceSubView === 'mis-clases' && (
                  <div className="mt-4">
                    <RecurringScheduleView initialView="mis-clases" hideSubNav={true} />
                  </div>
                )}

                {balanceSubView === 'vacantes' && (
                  <div className="mt-4">
                    <RecurringScheduleView initialView="turnos-disponibles" hideSubNav={true} />
                  </div>
                )}

                {balanceSubView === 'balance' && (
                  <div className="space-y-4">
                    {balanceLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                          <p className="text-muted-foreground">Cargando balance...</p>
                        </div>
                      </div>
                    ) : balanceHistory.length === 0 ? (
                      <Card>
                        <CardContent className="py-8 text-center text-sm text-muted-foreground">
                          No hay información de cuotas disponible.
                        </CardContent>
                      </Card>
                    ) : (
                      balanceHistory.map((entry) => (
                        <Card key={`${entry.anio}-${entry.mesNumero}`}>
                          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="text-lg font-semibold capitalize">
                              Cuota {entry.mesNombre} {entry.anio}
                            </CardTitle>
                            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                              {entry.isCurrent && <span>Mes actual</span>}
                              {entry.isNext && <span>Próximo mes</span>}
                              {entry.isEstimate && <span>Estimación</span>}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Valor por clase</span>
                              <span className="font-medium">
                                ${formatCurrency(entry.precioUnitario)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Cantidad de clases</span>
                              <span className="font-medium">{entry.clases}</span>
                            </div>
                            {entry.descuentoPorcentaje > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Descuento</span>
                                <span className="font-medium text-green-500">
                                  {entry.descuentoPorcentaje.toLocaleString('es-AR', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 2,
                                  })}% (-${formatCurrency(entry.descuento)})
                                </span>
                              </div>
                            )}
                            {entry.ajustes && (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">
                                    Clases canceladas {mesActualNombre}
                                  </span>
                                  <div className="text-right">
                                    <p className="font-medium text-green-500">
                                      -${formatCurrency(entry.ajustes.cancelaciones.monto)}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      {entry.ajustes.cancelaciones.cantidad} clase{entry.ajustes.cancelaciones.cantidad === 1 ? '' : 's'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">
                                    Vacantes reservadas {mesActualNombre}
                                  </span>
                                  <div className="text-right">
                                    <p className="font-medium text-amber-400">
                                      +${formatCurrency(entry.ajustes.vacantes.monto)}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      {entry.ajustes.vacantes.cantidad} clase{entry.ajustes.vacantes.cantidad === 1 ? '' : 's'}
                                    </p>
                                  </div>
                                </div>
                              </>
                            )}
                            <div className="border-t pt-2 flex items-center justify-between font-semibold">
                              <span>Total</span>
                              <span className="text-green-600">
                                ${formatCurrency(entry.totalConDescuento)}
                              </span>
                            </div>
                            {entry.estadoPago && (
                              <div className="text-xs text-muted-foreground">
                                Estado:{' '}
                                {entry.estadoPago === 'pagado'
                                  ? '✅ Pagado'
                                  : entry.estadoPago === 'abonada'
                                  ? '💰 Abonada'
                                  : '⏳ Pendiente'}
                              </div>
                            )}
                            {entry.isEstimate && (
                              <div className="text-xs text-muted-foreground">
                                Se actualiza en tiempo real ante cambios.
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'vacantes' && (
              <div className="mt-4 p-4 text-center text-muted-foreground">No hay clases disponibles canceladas por otros alumnos</div>
            )}

            {/* Navbar móvil flotante (siempre visible en mobile) */}
            <div className="block sm:hidden">
              <nav className="fixed bottom-4 left-0 right-0 z-40 pointer-events-none">
                <div className="max-w-7xl mx-auto px-6 flex justify-center">
                  <div className="flex items-center gap-2 bg-black/40 backdrop-blur-lg rounded-full shadow-lg pointer-events-auto px-3 py-1.5">
                    {/* Mis Clases */}
                    <button
                      onClick={() => setActiveTab('clases')}
                      className={`relative flex flex-col items-center justify-center w-20 py-1.5 text-[10px] font-medium transition-colors ${
                        activeTab === 'clases' ? 'text-white' : 'text-muted-foreground'
                      }`}
                      aria-current={activeTab === 'clases'}
                    >
                      <Dumbbell className={`h-5 w-5 ${activeTab === 'clases' ? 'text-white mb-1' : 'text-muted-foreground'}`} />
                      {activeTab === 'clases' && <span className="leading-none">Mis Clases</span>}
                      {activeTab === 'clases' && <span className="absolute -bottom-0.5 h-0.5 w-8 rounded-full bg-accent-foreground/80" />}
                    </button>
                    {/* Vacantes */}
                    <button
                      onClick={() => setActiveTab('vacantes')}
                      className={`relative flex flex-col items-center justify-center w-20 py-1.5 text-[10px] font-medium transition-colors ${
                        activeTab === 'vacantes' ? 'text-white' : 'text-muted-foreground'
                      }`}
                      aria-current={activeTab === 'vacantes'}
                    >
                      <Zap className={`h-5 w-5 ${activeTab === 'vacantes' ? 'text-white mb-1' : 'text-muted-foreground'}`} />
                      {activeTab === 'vacantes' && <span className="leading-none">Vacantes</span>}
                      {activeTab === 'vacantes' && <span className="absolute -bottom-0.5 h-0.5 w-8 rounded-full bg-accent-foreground/80" />}
                    </button>
                    {/* Balance */}
                    <button
                      onClick={() => setActiveTab('balance')}
                      className={`relative flex flex-col items-center justify-center w-20 py-1.5 text-[10px] font-medium transition-colors ${
                        activeTab === 'balance' ? 'text-white' : 'text-muted-foreground'
                      }`}
                      aria-current={activeTab === 'balance'}
                    >
                      <Wallet className={`h-5 w-5 ${activeTab === 'balance' ? 'text-white mb-1' : 'text-muted-foreground'}`} />
                      {activeTab === 'balance' && <span className="leading-none">Balance</span>}
                      {activeTab === 'balance' && <span className="absolute -bottom-0.5 h-0.5 w-8 rounded-full bg-accent-foreground/80" />}
                    </button>
                  </div>
                </div>
              </nav>
            </div>
          </div>
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

      {/* Modal de soporte */}
      <SupportModal
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
      />

      <OnboardingTutorial
        open={showTutorial}
        slides={tutorialSlides}
        onClose={handleTutorialClose}
      />
    </div>
  );
};

const App = () => {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <TooltipProvider>
        <Toaster />
        <SonnerToaster />
        <BrowserRouter>
          <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginFormSimple onLogin={() => {}} />} />
              <Route path="/reset-password" element={<ResetPasswordForm />} />
              <Route 
                path="/user" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute>
                    <Admin />
                  </ProtectedRoute>
                } 
              />
              {/* Ruta 404 - debe estar al final */}
              <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
);
};

export default App;