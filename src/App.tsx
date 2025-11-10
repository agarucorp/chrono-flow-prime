import { useState, useEffect, useMemo, useCallback } from "react";
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
import { Calendar, Clock, User, Settings, LogOut, ChevronDown, HelpCircle, Dumbbell, Zap, Wallet, X, Info } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription } from "@/components/ui/dialog";

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
  const [infoGuideOpen, setInfoGuideOpen] = useState(false);
  const [infoGuideSection, setInfoGuideSection] = useState<'clases' | 'balance'>('clases');
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

  const dismissTutorial = useCallback(async () => {
    if (!user) return;
    try {
      await supabase.auth.updateUser({ data: { onboarding_tutorial_dismissed: true } });
    } catch (error) {
      console.error('Error actualizando preferencia de tutorial:', error);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(`onboarding-tutorial-${user.id}`, 'true');
    }
  }, [user]);

  const handleRecurringSetupComplete = async () => {
    setShowRecurringModal(false);
    setHasCompletedSetup(true);
    await dismissTutorial();
  };

  const handleTutorialClose = async () => {
    if (hasCompletedSetup) {
      await dismissTutorial();
    }
    setShowTutorial(false);
    setTutorialProcessed(true);
    if (isFirstTime && !hasCompletedSetup) {
      setShowRecurringModal(true);
    }
  };

  useEffect(() => {
    if (firstTimeLoading || isFirstTime === null) return;
    setHasCompletedSetup(!isFirstTime);
  }, [isFirstTime, firstTimeLoading]);

  useEffect(() => {
    if (!user || firstTimeLoading || isFirstTime === null) return;

    if (!hasCompletedSetup) {
      setShowRecurringModal(false);
      setShowTutorial(true);
      setTutorialProcessed(false);
    } else {
      setTutorialProcessed(true);
    }
  }, [user, firstTimeLoading, isFirstTime, hasCompletedSetup]);

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
    const handleInfoGuideOpen = () => setInfoGuideOpen(true);
    window.addEventListener('profile:open', handleProfileOpen);
    window.addEventListener('auth:signout', handleSignOutEvent);
    window.addEventListener('soporte:open', handleSupportOpen);
    window.addEventListener('info:guide-open', handleInfoGuideOpen);
    return () => {
      window.removeEventListener('profile:open', handleProfileOpen);
      window.removeEventListener('auth:signout', handleSignOutEvent);
      window.removeEventListener('soporte:open', handleSupportOpen);
      window.removeEventListener('info:guide-open', handleInfoGuideOpen);
    };
  }, [handleSignOut]);

  useEffect(() => {
    if (infoGuideOpen) {
      setInfoGuideSection('clases');
    }
  }, [infoGuideOpen]);
  const misClasesGuide = (
    <div className="rounded-xl border border-border bg-background/70 p-4 text-[12px] md:text-[11px]">
      <div className="space-y-3">
        <div className="rounded-lg border border-red-200 bg-red-50/80 p-3 text-[11px] dark:border-red-900/40 dark:bg-red-950/30 md:text-[10px]">
          <p className="text-[10px] uppercase tracking-wide text-red-600 md:text-[9px]">Clase cancelada</p>
          <p className="mt-1 text-red-600 line-through">18:00 - 19:00</p>
          <p className="mt-2 text-[10px] text-red-700 dark:text-red-200 md:text-[9px]">
            Cuando canceles una clase aparecerá tachada en rojo y se generará una nueva clase disponible en Vacantes.
          </p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-[11px] dark:border-emerald-900/40 dark:bg-emerald-950/25 md:text-[10px]">
          <p className="text-[10px] uppercase tracking-wide text-emerald-600 md:text-[9px]">Clase adicional</p>
          <p className="mt-1 text-emerald-600">Turno Variable · 20:00 - 21:00</p>
          <p className="mt-2 text-[10px] text-emerald-700 dark:text-emerald-200 md:text-[9px]">
            Al reservar una clase desde Vacantes se mostrará en tu panel como Turno Variable en color verde.
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-[11px] dark:border-amber-900/40 dark:bg-amber-950/25 md:text-[10px]">
          <p className="text-[10px] uppercase tracking-wide text-amber-600 md:text-[9px]">Ausencia del profesor</p>
          <p className="mt-1 text-amber-600">Clase bloqueada</p>
          <p className="mt-2 text-[10px] text-amber-700 dark:text-amber-200 md:text-[9px]">
            Cuando el profesor genere una licencia, la clase se verá en tu panel en color amarillo como clase bloqueada.
          </p>
        </div>
      </div>
    </div>
  );

  const balanceGuide = (
    <div className="rounded-xl border border-border bg-background/70 p-4 text-[12px] md:text-[11px]">
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-background p-4 text-[11px] shadow-sm dark:bg-muted/30 md:text-[10px]">
          <div className="flex items-center justify-between text-[11px] md:text-[10px]">
            <span className="text-muted-foreground">Balance actual</span>
            <span className="text-xs text-muted-foreground">Noviembre 2025</span>
          </div>
          <div className="mt-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Valor por clase</span>
              <span className="font-medium">$12.000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cantidad de clases</span>
              <span className="font-medium">12</span>
            </div>
            <div className="flex items-center justify-between text-emerald-600">
              <span>Vacantes reservadas</span>
              <span className="font-medium">+$12.000</span>
            </div>
            <div className="flex items-center justify-between text-red-500">
              <span>Clases canceladas</span>
              <span className="font-medium">-$12.000</span>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <span className="inline-flex items-center rounded-full bg-black px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-black">
              Ver histórico
            </span>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground md:text-[9px]">
          En el botón &quot;Ver histórico&quot; se muestra el historial de las cuotas.
        </p>
      </div>
    </div>
  );

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
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1;
  const nextMonthNum = currentMonthNum === 12 ? 1 : currentMonthNum + 1;
  const nextYear = currentMonthNum === 12 ? currentYear + 1 : currentYear;
  const mesActualNombre = getMonthNameEs(now);
  const [activeTab, setActiveTab] = useState<'clases' | 'balance' | 'vacantes'>('clases');
  const [balanceSubView, setBalanceSubView] = useState<'mis-clases' | 'vacantes' | 'balance'>('balance');
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const {
    history: balanceHistory,
    loading: balanceLoading,
  } = useUserBalance();
  const sortByDateDesc = useMemo(
    () => (a: { anio: number; mesNumero: number }, b: { anio: number; mesNumero: number }) => {
      if (a.anio === b.anio) {
        return b.mesNumero - a.mesNumero;
      }
      return b.anio - a.anio;
    },
    []
  );
  const visibleBalanceEntries = useMemo(() => {
    return balanceHistory
      .filter((entry) => entry.isCurrent || entry.isNext)
      .sort((a, b) => {
        if (a.isCurrent && !b.isCurrent) return -1;
        if (b.isCurrent && !a.isCurrent) return 1;
        if (a.isNext && !b.isNext) return -1;
        if (b.isNext && !a.isNext) return 1;
        return sortByDateDesc(a, b);
      });
  }, [balanceHistory, sortByDateDesc]);
  const fullHistoryEntries = useMemo(
    () =>
      balanceHistory
        .filter((entry) => {
          const entryDate = new Date(Number(entry.anio), Number(entry.mesNumero) - 1, 1);
          const nextAllowedDate = new Date(nextYear, nextMonthNum - 1, 1);
          const monthDiff =
            (Number(entry.anio) - currentYear) * 12 + (Number(entry.mesNumero) - currentMonthNum);
          if (monthDiff > 1) return false;
          return entryDate <= nextAllowedDate;
        })
        .sort(sortByDateDesc),
    [balanceHistory, sortByDateDesc, nextMonthNum, nextYear]
  );
  const hasAdditionalBalanceHistory = useMemo(
    () => balanceHistory.some((entry) => !entry.isCurrent && !entry.isNext),
    [balanceHistory]
  );

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

    if (!hasCompletedSetup) {
      setShowRecurringModal(false);
      setShowTutorial(true);
      setTutorialProcessed(false);
    } else {
      setTutorialProcessed(true);
    }
  }, [user, firstTimeLoading, isFirstTime, hasCompletedSetup]);

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
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={() => setInfoGuideOpen(true)}
                    >
                      <Info className="h-4 w-4 mr-2" />
                      Información
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
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={() => setInfoGuideOpen(true)}
                    >
                      <Info className="h-4 w-4 mr-2" />
                      Información
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
                      visibleBalanceEntries.map((entry) => (
                        <Card key={`${entry.anio}-${entry.mesNumero}`}>
                          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <CardTitle className="text-lg font-semibold capitalize">
                              Cuota {entry.mesNombre} {entry.anio}
                            </CardTitle>
                                   {entry.isEstimate && (
                                     <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                                       <span>Estimación</span>
                                     </div>
                                   )}
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
                            {entry.estadoPago && !entry.isCurrent && (
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
                    {hasAdditionalBalanceHistory && (
                      <div className="flex justify-center pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-white text-white hover:bg-white/10"
                          onClick={() => setHistoryModalOpen(true)}
                        >
                          Ver histórico
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'vacantes' && (
              <div className="mt-4">
                <RecurringScheduleView initialView="turnos-disponibles" hideSubNav={true} />
              </div>
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

      <Dialog open={infoGuideOpen} onOpenChange={setInfoGuideOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-3xl">
          <DialogTitle className="sr-only">Panel alumno</DialogTitle>
          <DialogClose className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Cerrar</span>
          </DialogClose>
          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-center gap-2 rounded-full bg-muted/60 p-1 text-[12px] md:text-[11px]">
              <button
                type="button"
                onClick={() => setInfoGuideSection('clases')}
                className={`flex-1 rounded-full px-4 py-1.5 transition-colors ${
                  infoGuideSection === 'clases' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                Mis Clases
              </button>
              <button
                type="button"
                onClick={() => setInfoGuideSection('balance')}
                className={`flex-1 rounded-full px-4 py-1.5 transition-colors ${
                  infoGuideSection === 'balance' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                Balance
              </button>
            </div>
            <div className="md:hidden">
              <div className="max-h-[60vh] overflow-y-auto">
                {infoGuideSection === 'clases' ? misClasesGuide : balanceGuide}
              </div>
            </div>
            <div className="hidden gap-6 md:grid md:grid-cols-2">
              {misClasesGuide}
              {balanceGuide}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="w-full max-w-[92vw] sm:max-w-2xl">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="text-[12px] font-semibold sm:text-lg">Histórico de cuotas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {fullHistoryEntries.map((entry) => (
              <Card key={`history-${entry.anio}-${entry.mesNumero}`}>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-[12px] font-semibold capitalize sm:text-base">
                    Cuota {entry.mesNombre} {entry.anio}
                  </CardTitle>
                         {entry.isEstimate && (
                           <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                             <span>Estimación</span>
                           </div>
                         )}
                </CardHeader>
                <CardContent className="space-y-3 text-[12px] sm:text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Valor por clase</span>
                    <span className="font-medium">${formatCurrency(entry.precioUnitario)}</span>
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
                    <span className="text-green-600">${formatCurrency(entry.totalConDescuento)}</span>
                  </div>
                  {/* Se quita el estado para historial */}
                  {entry.isEstimate && (
                    <div className="text-xs text-muted-foreground">
                      Se actualiza en tiempo real ante cambios.
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
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