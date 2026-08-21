import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { LoginFormSimple } from "./components/LoginFormSimple";
import { ResetPasswordForm } from "./components/ResetPasswordForm";
import { RecurringScheduleModal } from "./components/RecurringScheduleModal";
import { RecurringScheduleView } from "./components/RecurringScheduleView";
import { useAuthContext } from "./contexts/AuthContext";
import { useFirstTimeUser } from "./hooks/useFirstTimeUser";
import { Calendar, Clock, User, Settings, LogOut, ChevronDown, HelpCircle, Dumbbell, Zap, Wallet, X, Info, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ProfileSettingsDialog } from "./components/ProfileSettingsDialog";
import { SupportModal } from "./components/SupportModal";
import { ChangeScheduleModal } from "./components/ChangeScheduleModal";
import { RecordsView } from "./components/RecordsView";
import Admin from "./pages/Admin";
import { useAdmin } from "./hooks/useAdmin";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ProtectedAdminRouteWithAuth } from "./components/ProtectedAdminRoute";
import NotFound from "./pages/NotFound";
import LandingPage from "./pages/LandingPage";
import { useUserBalance } from "./hooks/useUserBalance";
import { OnboardingTutorial } from "./components/OnboardingTutorial";
import { supabase } from "./lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatLocalDate, todayLocal } from "./lib/dateLocal";

// Componente Dashboard que usa el contexto de autenticación
const Dashboard = () => {
  const { user, signOut } = useAuthContext();
  const { loading: firstTimeLoading } = useFirstTimeUser();
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [hasCompletedSetup, setHasCompletedSetup] = useState(false);
  const [hasHorarios, setHasHorarios] = useState<boolean | null>(null);
  const [loadingHorarios, setLoadingHorarios] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialProcessed, setTutorialProcessed] = useState(false);
  const [tutorialDismissed, setTutorialDismissed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [infoGuideOpen, setInfoGuideOpen] = useState(false);
  const [infoGuideSection, setInfoGuideSection] = useState<'clases' | 'balance'>('clases');
  const [changeScheduleOpen, setChangeScheduleOpen] = useState(false);
  const [currentSchedules, setCurrentSchedules] = useState<any[]>([]);
  const [currentPlan, setCurrentPlan] = useState<number | null>(null);
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
      toast.success('Sesión cerrada');
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      toast.error('No se pudo cerrar sesión. Intentá de nuevo.');
    }
  };

  const handleOpenChangeSchedule = async () => {
    if (!user?.id) return;
    try {
      // Cargar horarios actuales
      const { data: horarios } = await supabase
        .from('vista_horarios_usuarios')
        .select('*')
        .eq('usuario_id', user.id)
        .eq('activo', true)
        .order('dia_semana', { ascending: true })
        .order('clase_numero', { ascending: true });

      // Cargar plan actual
      const { data: profile } = await supabase
        .from('profiles')
        .select('combo_asignado')
        .eq('id', user.id)
        .single();

      setCurrentSchedules(horarios || []);
      setCurrentPlan(profile?.combo_asignado || null);
      setChangeScheduleOpen(true);
    } catch (error) {
      console.error('Error cargando datos para cambio de horarios:', error);
    }
  };

  /** Solo marcar tutorial como visto cuando ya hay horarios (onboarding completo). */
  const persistTutorialDone = useCallback(async () => {
    if (!user) return;
    try {
      await supabase.auth.updateUser({ data: { onboarding_tutorial_dismissed: true } });
      await supabase
        .from('profiles')
        .update({ onboarding_tutorial_seen: true })
        .eq('id', user.id);
    } catch (error) {
      console.error('Error actualizando preferencia de tutorial:', error);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(`onboarding-tutorial-${user.id}`, 'true');
    }
    setTutorialDismissed(true);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setTutorialDismissed(false);
      return;
    }
    // Sin horarios: no respetar dismiss previo — debe completar onboarding
    if (hasHorarios === false) {
      setTutorialDismissed(false);
      return;
    }
    if (hasHorarios !== true) return;
    const dismissedMeta = Boolean((user.user_metadata as any)?.onboarding_tutorial_dismissed);
    const dismissedLocal =
      typeof window !== 'undefined'
        ? localStorage.getItem(`onboarding-tutorial-${user.id}`) === 'true'
        : false;
    setTutorialDismissed(dismissedMeta || dismissedLocal);
  }, [user, hasHorarios]);

  const handleRecurringSetupComplete = async () => {
    setShowRecurringModal(false);
    setHasCompletedSetup(true);
    setHasHorarios(true);
    hasHorariosCheckRef.current = { userId: user?.id ?? null, hasHorarios: true, timestamp: Date.now() };
    await persistTutorialDone();
  };

  /** Fin del tutorial → obligatorio elegir horarios (sin marcar tutorial como “hecho”). */
  const handleTutorialClose = async () => {
    setShowTutorial(false);
    setTutorialProcessed(true);
    setShowRecurringModal(true);
  };

  /** Abandonar alta sin horarios: no puede quedar sesión en el sitio. */
  const abandonOnboarding = useCallback(async () => {
    setShowTutorial(false);
    setShowRecurringModal(false);
    setTutorialProcessed(false);
    await signOut();
    navigate('/login', { replace: true });
  }, [signOut, navigate]);

  // Verificar si el usuario tiene horarios recurrentes configurados (con caché)
  const hasHorariosCheckRef = useRef<{ userId: string | null; hasHorarios: boolean | null; timestamp: number }>({ 
    userId: null, 
    hasHorarios: null, 
    timestamp: 0 
  });
  const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutos en caché
  
  useEffect(() => {
    if (!user) {
      setHasHorarios(null);
      setLoadingHorarios(false);
      hasHorariosCheckRef.current = { userId: null, hasHorarios: null, timestamp: 0 };
      return;
    }
    
    const now = Date.now();
    const cached = hasHorariosCheckRef.current;
    
    // Si ya tenemos un resultado en caché para este usuario y no ha expirado, usar caché
    if (cached.userId === user.id && cached.hasHorarios !== null && (now - cached.timestamp) < CACHE_DURATION_MS) {
      setHasHorarios(cached.hasHorarios);
      setHasCompletedSetup(cached.hasHorarios);
      setLoadingHorarios(false);
      return;
    }
    
    const checkHasHorarios = async () => {
      setLoadingHorarios(true);
      try {
        // Verificar si tiene horarios ACTIVOS (no solo existencia)
        const { data, error } = await supabase
          .from('horarios_recurrentes_usuario')
          .select('id')
          .eq('usuario_id', user.id)
          .eq('activo', true)
          .limit(1);
        
        if (error) {
          console.warn('Error verificando horarios recurrentes:', error);
          // Si hay error, NO cambiar el estado si ya tenía horarios (evitar mostrar modal incorrectamente)
          if (hasHorariosCheckRef.current.userId === user.id && hasHorariosCheckRef.current.hasHorarios === true) {
            // Mantener el estado anterior si ya tenía horarios
            setHasHorarios(true);
            setHasCompletedSetup(true);
            setLoadingHorarios(false);
            return;
          }
          setHasHorarios(false);
          setHasCompletedSetup(false);
          hasHorariosCheckRef.current = { userId: user.id, hasHorarios: false, timestamp: Date.now() };
          setLoadingHorarios(false);
          return;
        }
        
        // Verificar si tiene horarios activos
        const tieneHorarios = data && data.length > 0;
        setHasHorarios(tieneHorarios);
        setHasCompletedSetup(tieneHorarios);
        // Guardar en caché
        hasHorariosCheckRef.current = { userId: user.id, hasHorarios: tieneHorarios, timestamp: Date.now() };
      } catch (err) {
        console.error('Error inesperado verificando horarios:', err);
        // Si hay error, NO cambiar el estado si ya tenía horarios (evitar mostrar modal incorrectamente)
        if (hasHorariosCheckRef.current.userId === user.id && hasHorariosCheckRef.current.hasHorarios === true) {
          // Mantener el estado anterior si ya tenía horarios
          setHasHorarios(true);
          setHasCompletedSetup(true);
          setLoadingHorarios(false);
          return;
        }
        setHasHorarios(false);
        setHasCompletedSetup(false);
        hasHorariosCheckRef.current = { userId: user.id, hasHorarios: false, timestamp: Date.now() };
      } finally {
        setLoadingHorarios(false);
      }
    };
    
    checkHasHorarios();
  }, [user]);

  // Sin horarios: tutorial → modal de plan. No hay acceso al panel hasta completar.
  useEffect(() => {
    if (!user || adminLoading || isAdmin || loadingHorarios || hasHorarios === null) return;

    if (hasHorarios) {
      setShowTutorial(false);
      setShowRecurringModal(false);
      setTutorialProcessed(true);
      return;
    }

    if (!tutorialProcessed && !showTutorial) {
      setShowRecurringModal(false);
      setShowTutorial(true);
      return;
    }

    if (tutorialProcessed && !showTutorial) {
      setShowRecurringModal(true);
    }
  }, [
    user,
    adminLoading,
    isAdmin,
    hasHorarios,
    loadingHorarios,
    tutorialProcessed,
    showTutorial,
  ]);

  // Escuchar evento de actualización de horarios recurrentes
  useEffect(() => {
    const handleHorariosUpdated = () => {
      // Recargar verificación de horarios cuando se actualicen
      if (user) {
        const checkHasHorarios = async () => {
          try {
            // Verificar horarios ACTIVOS
            const { data, error } = await supabase
              .from('horarios_recurrentes_usuario')
              .select('id')
              .eq('usuario_id', user.id)
              .eq('activo', true)
              .limit(1);
            
            if (!error && data && data.length > 0) {
              setHasHorarios(true);
              setHasCompletedSetup(true);
              // Actualizar caché
              hasHorariosCheckRef.current = { userId: user.id, hasHorarios: true, timestamp: Date.now() };
            }
          } catch (err) {
            console.error('Error verificando horarios después de actualización:', err);
          }
        };
        checkHasHorarios();
      }
    };
    
    window.addEventListener('horariosRecurrentes:updated', handleHorariosUpdated);
    return () => {
      window.removeEventListener('horariosRecurrentes:updated', handleHorariosUpdated);
    };
  }, [user]);

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
  const [activeTab, setActiveTab] = useState<'clases' | 'balance' | 'vacantes' | 'records'>('clases');
  const [viewEpoch, setViewEpoch] = useState(0);
  const [balanceSubView, setBalanceSubView] = useState<'mis-clases' | 'vacantes' | 'balance'>('balance');
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const {
    history: balanceHistory,
    loading: balanceLoading,
    error: balanceError,
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
      description: 'En esta plataforma vas a poder setear tus clases en MaldaGym de forma recurrente, visualizar tus horarios, cancelarlos y reservar clases canceladas por otros alumnos.',
      images: [
        {
          src: '/assets/logovertical.svg',
          alt: 'Malda — entrenamientos personalizados',
          variant: 'logo' as const
        }
      ]
    },
    {
      title: 'Selección de plan y horarios',
      description: 'A continuación vas a poder elegir el plan de acuerdo a la cantidad de días de asistencia semanal y los horarios de tus clases.',
      images: [
        {
          src: '/tutorial/horariomobile.jpeg',
          alt: 'Vista mobile del tutorial de horarios',
          mobileOnly: true
        },
        {
          src: '/tutorial/desktoptutorialhorarios.png',
          alt: 'Vista desktop del tutorial de horarios',
          desktopOnly: true
        }
      ]
    },
    {
      title: 'Balance',
      description: 'Vista de tu cuota actual, siguiente e historial. El pago es por adelantado y todos los cambios que afecten el mes actual impactarán en el próximo.',
      images: [
        {
          src: '/tutorial/balancemobile.jpeg',
          alt: 'Vista mobile del balance',
          mobileOnly: true
        },
        {
          src: '/tutorial/balancedesktop.png',
          alt: 'Vista desktop del balance',
          desktopOnly: true
        }
      ]
    },
    {
      title: 'Vacantes',
      description: 'Las clases canceladas aparecerán en este panel para que puedan ser reservadas por otros alumnos si así lo desean.',
      images: [
        {
          src: '/tutorial/vacantesmobile.jpeg',
          alt: 'Vista mobile de vacantes',
          mobileOnly: true
        },
        {
          src: '/tutorial/vacantesdesktop.png',
          alt: 'Vista desktop de vacantes',
          desktopOnly: true
        }
      ]
    },
    {
      title: 'Información',
      description: 'Si tenés alguna duda podés ver una guía de las funcionalidades de la plataforma ingresando a "Información" desde el ícono de perfil.',
      images: [
        {
          src: '/tutorial/guiamobile.jpeg',
          alt: 'Vista mobile de la guía',
          mobileOnly: true
        },
        {
          src: '/tutorial/guiadesktop.png',
          alt: 'Vista desktop de la guía',
          desktopOnly: true
        }
      ]
    }
  ];

  // Sincronizar pestaña con query param ?tab= (lectura)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'clases' || tab === 'balance' || tab === 'vacantes' || tab === 'records') {
      setActiveTab(tab);
    }
  }, [location.search]);

  const goToTab = useCallback((tab: 'clases' | 'balance' | 'vacantes' | 'records') => {
    setActiveTab(tab);
    if (tab === 'balance') setBalanceSubView('balance');
    setViewEpoch((n) => n + 1);
    const params = new URLSearchParams(location.search);
    params.set('tab', tab);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  // Permitir cambiar pestaña vía eventos globales (para integrar navbar inferior existente)
  useEffect(() => {
    const toClases = () => goToTab('clases');
    const toBalance = () => goToTab('balance');
    const toVacantes = () => goToTab('vacantes');
    const toRecords = () => goToTab('records');
    window.addEventListener('nav:clases', toClases);
    window.addEventListener('nav:balance', toBalance);
    window.addEventListener('nav:vacantes', toVacantes);
    window.addEventListener('nav:records', toRecords);
    return () => {
      window.removeEventListener('nav:clases', toClases);
      window.removeEventListener('nav:balance', toBalance);
      window.removeEventListener('nav:vacantes', toVacantes);
      window.removeEventListener('nav:records', toRecords);
    };
  }, [goToTab]);

  // Onboarding incompleto: no mostrar el panel (solo tutorial + alta de horarios)
  const onboardingIncomplete =
    Boolean(user) && !isAdmin && !adminLoading && hasHorarios === false && !loadingHorarios;

  if (!isAdmin && (loadingHorarios || hasHorarios === null || adminLoading)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <img src="/assets/logovertical.svg" alt="Malda" className="max-w-[160px] opacity-90" />
      </div>
    );
  }

  if (onboardingIncomplete) {
    return (
      <div className="fixed inset-0 z-40 bg-black">
        <OnboardingTutorial
          open={showTutorial}
          slides={tutorialSlides}
          onClose={handleTutorialClose}
        />
        <RecurringScheduleModal
          isOpen={showRecurringModal}
          onClose={() => undefined}
          onComplete={handleRecurringSetupComplete}
          onAbandon={abandonOnboarding}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black sm:bg-[url('/gymdesktop-background.png')] sm:bg-cover sm:bg-center sm:bg-no-repeat relative">
      {/* Overlay oscuro sobre la imagen (desktop) */}
      <div className="hidden sm:block absolute inset-0 bg-black/70 pointer-events-none" aria-hidden />
      {/* Header restaurado */}
      <header className="relative z-10 border-b border-border bg-black/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex-1 flex items-center min-w-0 py-2">
              {!isAdmin && (
                <img
                  src="/assets/malda.svg"
                  alt="Logo Malda"
                  className="h-[1.6rem] w-auto max-h-[1.8rem] object-contain object-left sm:h-[1.8rem] sm:max-h-8"
                />
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                aria-label="Soporte"
                className="hidden sm:inline-flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                onClick={() => window.dispatchEvent(new CustomEvent('soporte:open'))}
              >
                <HelpCircle className="h-5 w-5" />
              </button>
              <div className="hidden sm:block">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-9 w-9 p-0"
                    >
                      <User className="h-5 w-5 text-muted-foreground" />
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
                    <DropdownMenuItem className="cursor-pointer" onClick={handleOpenChangeSchedule}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Cambiar horarios
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
              {/* Perfil en mobile: Dropdown con acciones */}
              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-14 w-14 p-0 active:scale-95 transition-all duration-200"
                      aria-label="Abrir menú de perfil"
                    >
                      <User className="h-6 w-6 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem className="cursor-pointer" onClick={() => window.dispatchEvent(new CustomEvent('profile:open'))}>
                      <Settings className="h-4 w-4 mr-2" />
                      Configurar Perfil
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" onClick={handleOpenChangeSchedule}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Cambiar horarios
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={() => setInfoGuideOpen(true)}
                    >
                      <Info className="h-4 w-4 mr-2" />
                      Información
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => window.dispatchEvent(new CustomEvent('soporte:open'))}
                    >
                      <HelpCircle className="h-4 w-4 mr-2" />
                      Soporte
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
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-8">
        {firstTimeLoading || loadingHorarios ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">
                Cargando...
              </p>
            </div>
          </div>
        ) : hasHorarios === false ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-muted-foreground">
                Configurando horarios...
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full pb-24 sm:pb-0">
            {/* Desktop: usamos la navbar existente en RecurringScheduleView */}

            {/* Calcular la vista inicial basada en la pestaña activa */}
            {(() => {
              let initialView: 'mis-clases' | 'turnos-disponibles' | 'perfil' = 'mis-clases';
              // Navbar desktop unificada en App; en mobile usa bottom nav.
              // Siempre ocultar la subnav interna para no saltar de posición.
              const hideSubNav = true;
              
              if (activeTab === 'clases') {
                initialView = 'mis-clases';
              } else if (activeTab === 'vacantes') {
                initialView = 'turnos-disponibles';
              } else if (activeTab === 'balance') {
                if (balanceSubView === 'mis-clases') {
                  initialView = 'mis-clases';
                } else if (balanceSubView === 'vacantes') {
                  initialView = 'turnos-disponibles';
                }
              }
              
              return (
                <>
                  {/* Subnavbar desktop fija (misma posición en todas las tabs) */}
                  <div className="hidden sm:flex justify-center mb-4 pt-2">
                    <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
                      <button
                        onClick={() => goToTab('clases')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          activeTab === 'clases'
                            ? 'bg-secondary text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Mis clases
                      </button>
                      <button
                        onClick={() => goToTab('vacantes')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          activeTab === 'vacantes'
                            ? 'bg-secondary text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Vacantes
                      </button>
                      <button
                        onClick={() => {
                          setBalanceSubView('balance');
                          goToTab('balance');
                        }}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          activeTab === 'balance'
                            ? 'bg-secondary text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Balance
                      </button>
                      <button
                        onClick={() => goToTab('records')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          activeTab === 'records'
                            ? 'bg-secondary text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Records
                      </button>
                    </div>
                  </div>

                  {/* Contenido de balance (solo cuando balanceSubView === 'balance') */}
                  {activeTab === 'balance' && balanceSubView === 'balance' && (
                    <div className="space-y-4">
                      {balanceLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                            <p className="text-muted-foreground">Cargando balance...</p>
                          </div>
                        </div>
                      ) : balanceError ? (
                        <Card>
                          <CardContent className="py-8 text-center text-sm text-destructive">
                            No se pudo cargar el balance. {balanceError}
                          </CardContent>
                        </Card>
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
                              <CardTitle className="text-heading">
                                Cuota {entry.mesNombre} {entry.anio}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Valor por clase</span>
                                <span className="font-medium">
                                  ${formatCurrency(entry.precioUnitario)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Clases del mes</span>
                                <span className="font-medium">{entry.desglose.plan}</span>
                              </div>
                              {entry.desglose.vacantes > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Vacantes reservadas</span>
                                  <span className="font-medium text-amber-400">
                                    +{entry.desglose.vacantes}
                                  </span>
                                </div>
                              )}
                              {entry.desglose.canceladasACredito > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Canceladas a tiempo</span>
                                  <span className="font-medium text-green-500">
                                    -{entry.desglose.canceladasACredito}
                                  </span>
                                </div>
                              )}
                              {entry.desglose.canceladasTardias > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">
                                    Canceladas con menos de 72hs
                                  </span>
                                  <span className="font-medium text-muted-foreground">
                                    {entry.desglose.canceladasTardias} (se cobran)
                                  </span>
                                </div>
                              )}
                              {entry.desglose.ajusteMesAnterior !== 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">
                                    Ajuste de {mesActualNombre}
                                  </span>
                                  <span
                                    className={`font-medium ${
                                      entry.desglose.ajusteMesAnterior > 0
                                        ? 'text-amber-400'
                                        : 'text-green-500'
                                    }`}
                                  >
                                    {entry.desglose.ajusteMesAnterior > 0 ? '+' : ''}
                                    {entry.desglose.ajusteMesAnterior}
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center justify-between border-t pt-2">
                                <span className="text-muted-foreground">Clases a cobrar</span>
                                <span className="font-medium">{entry.clases}</span>
                              </div>
                              {entry.isCurrent && (
                                <p className="text-[11px] text-muted-foreground">
                                  Esta cuota ya está emitida. Los cambios que hagas ahora impactan el
                                  próximo mes.
                                </p>
                              )}
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
                              <div className="border-t pt-2 flex items-center justify-between font-semibold">
                                <span>Total</span>
                                <div className="text-right">
                                  {entry.descuentoPorcentaje > 0 && entry.total > entry.totalConDescuento ? (
                                    <>
                                      <span className="text-muted-foreground line-through block text-sm">
                                        ${formatCurrency(entry.total)}
                                      </span>
                                      <span className="text-green-600">
                                        ${formatCurrency(entry.totalConDescuento)}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-green-600">
                                      ${formatCurrency(entry.totalConDescuento)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {entry.estadoPago && (
                                <div className="text-xs text-muted-foreground">
                                  Estado:{' '}
                                  {entry.estadoPago === 'abonada' || entry.estadoPago === 'pagado'
                                    ? 'Abonada'
                                    : entry.estadoPago === 'vencida'
                                    ? 'Vencida'
                                    : 'Pendiente'}
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

                  {activeTab === 'records' && (
                    <div className="mt-2">
                      <RecordsView />
                    </div>
                  )}

                  {/* Componente RecurringScheduleView siempre montado para mantener caché */}
                  <div className={
                    (activeTab === 'balance' && balanceSubView === 'balance') || activeTab === 'records'
                      ? 'hidden'
                      : 'mt-4'
                  }>
                    <RecurringScheduleView initialView={initialView} hideSubNav={hideSubNav} viewEpoch={viewEpoch} />
                  </div>
                </>
              );
            })()}

            {/* Navbar móvil (fija en bottom, solo visible en mobile) */}
            <nav className="block sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-black/95 backdrop-blur-sm">
              <div className="grid grid-cols-4 h-14">
                <button
                  onClick={() => goToTab('clases')}
                  className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                    activeTab === 'clases' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  aria-current={activeTab === 'clases'}
                >
                  <Dumbbell className="h-5 w-5" />
                  <span className="text-caption font-medium">Clases</span>
                </button>
                <button
                  onClick={() => goToTab('vacantes')}
                  className={`relative flex flex-col items-center justify-center gap-0.5 transition-colors ${
                    activeTab === 'vacantes' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  aria-current={activeTab === 'vacantes'}
                >
                  <span className="relative">
                    <Zap className="h-5 w-5" />
                  </span>
                  <span className="text-caption font-medium">Vacantes</span>
                </button>
                <button
                  onClick={() => goToTab('balance')}
                  className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                    activeTab === 'balance' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  aria-current={activeTab === 'balance'}
                >
                  <Wallet className="h-5 w-5" />
                  <span className="text-caption font-medium">Balance</span>
                </button>
                <button
                  onClick={() => goToTab('records')}
                  className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                    activeTab === 'records' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  aria-current={activeTab === 'records'}
                >
                  <Trophy className="h-5 w-5" />
                  <span className="text-caption font-medium">Records</span>
                </button>
              </div>
            </nav>
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

      {/* Modal para cambiar horarios/plan */}
      <ChangeScheduleModal
        isOpen={changeScheduleOpen}
        onClose={() => setChangeScheduleOpen(false)}
        onComplete={() => {
          setChangeScheduleOpen(false);
          // Invalidar caché de horarios
          hasHorariosCheckRef.current = { userId: null, hasHorarios: null, timestamp: 0 };
        }}
        currentSchedules={currentSchedules}
        currentPlan={currentPlan}
      />

      {/* Modal de cambio/alta de horarios (usuarios que ya completaron onboarding) */}
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

      <Dialog open={infoGuideOpen} onOpenChange={setInfoGuideOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-3xl">
          <DialogTitle className="sr-only">Panel alumno</DialogTitle>
          <DialogClose className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Cerrar</span>
          </DialogClose>
          <div className="mt-6 space-y-6">
            {/* Botones para mobile */}
            <div className="flex items-center justify-center gap-2 rounded-full bg-muted/60 p-1 text-[12px] md:hidden">
              <button
                type="button"
                onClick={() => setInfoGuideSection('clases')}
                className={`flex-1 rounded-full px-4 py-1.5 transition-colors ${
                  infoGuideSection === 'clases' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                Mis clases
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
            {/* Desktop: títulos centrados sobre sus respectivas cards */}
            <div className="hidden gap-6 md:grid md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-heading text-center">Mis clases</h3>
                {misClasesGuide}
              </div>
              <div className="space-y-4">
                <h3 className="text-heading text-center">Balance</h3>
                {balanceGuide}
              </div>
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
                <CardHeader>
                  <CardTitle className="text-[12px] font-semibold sm:text-base">
                    Cuota {entry.mesNombre} {entry.anio}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-[12px] sm:text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Valor por clase</span>
                    <span className="font-medium">${formatCurrency(entry.precioUnitario)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Clases del mes</span>
                    <span className="font-medium">{entry.desglose.plan}</span>
                  </div>
                  {entry.desglose.vacantes > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Vacantes reservadas</span>
                      <span className="font-medium text-amber-400">+{entry.desglose.vacantes}</span>
                    </div>
                  )}
                  {entry.desglose.canceladasACredito > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Canceladas a tiempo</span>
                      <span className="font-medium text-green-500">
                        -{entry.desglose.canceladasACredito}
                      </span>
                    </div>
                  )}
                  {entry.desglose.ajusteMesAnterior !== 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Ajuste del mes anterior</span>
                      <span
                        className={`font-medium ${
                          entry.desglose.ajusteMesAnterior > 0 ? 'text-amber-400' : 'text-green-500'
                        }`}
                      >
                        {entry.desglose.ajusteMesAnterior > 0 ? '+' : ''}
                        {entry.desglose.ajusteMesAnterior}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-muted-foreground">Clases a cobrar</span>
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
                  <div className="border-t pt-2 flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-green-600">${formatCurrency(entry.totalConDescuento)}</span>
                  </div>
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
  const { loading } = useAuthContext();

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <TooltipProvider>
        <SonnerToaster />
        <Toaster />
        <BrowserRouter>
          <AppContent loading={loading} />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
);
};

const getAuthCallbackType = (search: string, hash: string) => {
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const queryParams = new URLSearchParams(search);
  return hashParams.get('type') || queryParams.get('type');
};

const isAuthCallback = (search: string, hash: string) => {
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const queryParams = new URLSearchParams(search);
  const type = getAuthCallbackType(search, hash);
  return (
    hashParams.has('access_token') ||
    queryParams.has('code') ||
    Boolean(type)
  );
};

const AppContent = ({ loading }: { loading: boolean }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const publicRoutes = ['/', '/login', '/reset-password'];
  const isPublicRoute = publicRoutes.includes(location.pathname);

  // Callbacks de Auth no deben caer en la landing
  useEffect(() => {
    if (location.pathname !== '/') return;
    if (!isAuthCallback(location.search, location.hash)) return;
    const type = getAuthCallbackType(location.search, location.hash);
    const recoveryPending = sessionStorage.getItem('auth_recovery_pending') === '1';
    const target =
      type === 'recovery' || recoveryPending ? '/reset-password' : '/login';
    if (recoveryPending && target === '/reset-password') {
      sessionStorage.removeItem('auth_recovery_pending');
    }
    navigate(`${target}${location.search}${location.hash}`, { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginFormSimple onLogin={() => {}} />} />
        <Route path="/reset-password" element={<ResetPasswordForm />} />
        <Route path="/dashboard" element={<Navigate to="/user" replace />} />
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
            <ProtectedAdminRouteWithAuth>
              <Admin />
            </ProtectedAdminRouteWithAuth>
          } 
        />
        {/* Ruta 404 - debe estar al final */}
        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* Overlay de carga global: solo para rutas protegidas */}
      {loading && !isPublicRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <img src="/assets/logovertical.svg" alt="Logo" className="max-w-[180px] md:max-w-xs" />
        </div>
      )}
    </>
  );
};

export default App;