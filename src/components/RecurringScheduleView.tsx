import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay, getDate } from 'date-fns';
import { es } from 'date-fns/locale';

interface HorarioRecurrente {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
  cancelada?: boolean;
}

interface ClaseDelDia {
  id: string;
  dia: Date;
  horario: HorarioRecurrente;
}

export const RecurringScheduleView = () => {
  const { user } = useAuthContext();
  const [horariosRecurrentes, setHorariosRecurrentes] = useState<HorarioRecurrente[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedClase, setSelectedClase] = useState<ClaseDelDia | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showTurnosCancelados, setShowTurnosCancelados] = useState(false);
  const [turnosCancelados, setTurnosCancelados] = useState<any[]>([]);
  const [loadingTurnosCancelados, setLoadingTurnosCancelados] = useState(false);
  const [activeView, setActiveView] = useState<'mis-clases' | 'turnos-disponibles'>('mis-clases');

  // Función para formatear horas sin segundos
  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    return timeString.substring(0, 5); // Toma solo HH:mm
  };

  // Cargar turnos cancelados cuando se cambie a la vista de turnos disponibles
  useEffect(() => {
    if (activeView === 'turnos-disponibles' && turnosCancelados.length === 0) {
      cargarTurnosCancelados();
    }
  }, [activeView]);

  // Días de la semana (0 = Domingo, 1 = Lunes, etc.)
  const diasSemana = useMemo(() => [
    { numero: 0, nombre: 'Domingo', nombreCorto: 'Dom' },
    { numero: 1, nombre: 'Lunes', nombreCorto: 'Lun' },
    { numero: 2, nombre: 'Martes', nombreCorto: 'Mar' },
    { numero: 3, nombre: 'Miércoles', nombreCorto: 'Mié' },
    { numero: 4, nombre: 'Jueves', nombreCorto: 'Jue' },
    { numero: 5, nombre: 'Viernes', nombreCorto: 'Vie' },
    { numero: 6, nombre: 'Sábado', nombreCorto: 'Sáb' }
  ], []);

  // Cargar horarios recurrentes del usuario
  const cargarHorariosRecurrentes = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('horarios_recurrentes_usuario')
        .select('id, dia_semana, hora_inicio, hora_fin, activo')
        .eq('usuario_id', user.id)
        .eq('activo', true)
        .order('dia_semana', { ascending: true })
        .order('hora_inicio', { ascending: true });

      if (error) {
        console.error('Error al cargar horarios recurrentes:', error);
        return;
      }

      setHorariosRecurrentes(data || []);
    } catch (error) {
      console.error('Error al cargar horarios recurrentes:', error);
    }
  };

  // Cargar turnos cancelados disponibles
  const cargarTurnosCancelados = async () => {
    if (!user?.id) return;

    setLoadingTurnosCancelados(true);
    try {
      const { data, error } = await supabase
        .from('turnos_cancelados')
        .select('*')
        .eq('disponible', true)
        .order('turno_fecha', { ascending: true });

      if (error) {
        console.error('Error al cargar turnos cancelados:', error);
        return;
      }

      setTurnosCancelados(data || []);
    } catch (error) {
      console.error('Error al cargar turnos cancelados:', error);
    } finally {
      setLoadingTurnosCancelados(false);
    }
  };

  // Cargar datos iniciales
  useEffect(() => {
    if (user?.id && !hasLoaded) {
      cargarHorariosRecurrentes();
      setHasLoaded(true);
      setLoading(false);
    }
  }, [user?.id, hasLoaded]);

  // Generar días del mes actual
  const diasDelMes = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Obtener clases del día
  const getClasesDelDia = (dia: Date) => {
    const diaSemana = dia.getDay();
    return horariosRecurrentes
      .filter(horario => horario.dia_semana === diaSemana)
      .map(horario => ({
        id: `${horario.id}-${format(dia, 'yyyy-MM-dd')}`,
        dia,
        horario
      }));
  };

  // Manejar click en clase
  const handleClaseClick = (clase: ClaseDelDia) => {
    if (clase.horario.cancelada) return;
    setSelectedClase(clase);
    setShowModal(true);
  };

  // Manejar cancelación de clase
  const handleCancelarClase = async (clase: ClaseDelDia) => {
    if (!user?.id) return;

    try {
      // Verificar si ya existe una cancelación para este turno
      const { data: cancelacionExistente } = await supabase
        .from('turnos_cancelados')
        .select('id')
        .eq('usuario_id', user.id)
        .eq('turno_fecha', format(selectedClase.dia, 'yyyy-MM-dd'))
        .eq('turno_hora_inicio', selectedClase.horario.hora_inicio)
        .eq('turno_hora_fin', selectedClase.horario.hora_fin);

      if (cancelacionExistente && cancelacionExistente.length > 0) {
        alert('Ya has cancelado este turno anteriormente');
        return;
      }

      // Crear registro de cancelación
      const { error } = await supabase
        .from('turnos_cancelados')
        .insert({
          usuario_id: user.id,
          turno_fecha: format(selectedClase.dia, 'yyyy-MM-dd'),
          turno_hora_inicio: selectedClase.horario.hora_inicio,
          turno_hora_fin: selectedClase.horario.hora_fin,
          motivo_cancelacion: 'Cancelado por el usuario',
          disponible: true,
          fecha_cancelacion: new Date().toISOString()
        });

      if (error) {
        console.error('Error al cancelar turno:', error);
        alert('Error al cancelar el turno');
        return;
      }

      // Marcar horario como cancelado localmente
      setHorariosRecurrentes(prev => 
        prev.map(h => 
          h.id === selectedClase.horario.id 
            ? { ...h, cancelada: true }
            : h
        )
      );

      setShowModal(false);
      setConfirmOpen(false);
      alert('Turno cancelado exitosamente');
    } catch (error) {
      console.error('Error al cancelar turno:', error);
      alert('Error al cancelar el turno');
    }
  };

  // Manejar confirmación de cancelación
  const handleConfirmarCancelacion = () => {
    if (selectedClase) {
      handleCancelarClase(selectedClase);
    }
  };

  // Navegación del mes
  const handlePreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  // Verificar si se puede navegar al mes anterior
  const canNavigatePrevious = () => {
    const today = new Date();
    const currentMonthStart = startOfMonth(currentMonth);
    const todayMonthStart = startOfMonth(today);
    return currentMonthStart.getTime() > todayMonthStart.getTime();
  };

  // Verificar si se puede navegar al mes siguiente
  const canNavigateNext = () => {
    const today = new Date();
    const nextMonth = addMonths(today, 1);
    const currentMonthStart = startOfMonth(currentMonth);
    const nextMonthStart = startOfMonth(nextMonth);
    return currentMonthStart.getTime() < nextMonthStart.getTime();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subnavbar */}
      <div className="space-y-4">
        <div className="flex justify-center">
          <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveView('mis-clases')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === 'mis-clases'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Mis Clases
          </button>
          <button
            onClick={() => setActiveView('turnos-disponibles')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === 'turnos-disponibles'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Turnos Disponibles
          </button>
          </div>
        </div>
      </div>

      {/* Contenido basado en la vista activa */}
      {activeView === 'mis-clases' && (
        <>
          {/* Navegación del mes */}
          <div className="flex items-center justify-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousMonth}
              disabled={!canNavigatePrevious()}
              className="h-8 w-8 p-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold min-w-[200px] text-center">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextMonth}
              disabled={!canNavigateNext()}
              className="h-8 w-8 p-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Calendario de Mis Clases */}
          <Card>
            <CardContent className="p-0">
              {horariosRecurrentes.length === 0 ? (
                <div className="p-8 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No tienes clases configuradas</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-4 text-left font-medium text-sm text-muted-foreground">Fecha</th>
                        <th className="p-4 text-left font-medium text-sm text-muted-foreground">Día</th>
                        <th className="p-4 text-left font-medium text-sm text-muted-foreground">Horario</th>
                        <th className="p-4 text-center font-medium text-sm text-muted-foreground hidden md:table-cell">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diasDelMes.map((dia, index) => {
                        const clasesDelDia = getClasesDelDia(dia);
                        return clasesDelDia.map((clase, claseIndex) => (
                          <tr 
                            key={`${dia.getTime()}-${claseIndex}`} 
                            className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors ${
                              clase.horario.cancelada 
                                ? 'bg-red-50 dark:bg-red-950/20 opacity-60' 
                                : ''
                            }`}
                          >
                            <td className="p-4">
                              <div className="text-sm font-medium">
                                {format(dia, 'dd/MM', { locale: es })}
                              </div>
                              {clase.horario.cancelada && (
                                <div className="text-xs text-red-600 dark:text-red-400 font-medium">
                                  CANCELADA
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="text-sm text-muted-foreground">
                                {format(dia, 'EEEE', { locale: es })}
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={`text-sm font-medium ${
                                clase.horario.cancelada 
                                  ? 'text-red-600 dark:text-red-400 line-through' 
                                  : ''
                              }`}>
                                {formatTime(clase.horario.hora_inicio)} - {formatTime(clase.horario.hora_fin)}
                              </span>
                            </td>
                            <td className="p-4 text-center hidden md:table-cell">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleClaseClick(clase)}
                                className="h-8 px-3"
                                disabled={clase.horario.cancelada}
                              >
                                {clase.horario.cancelada ? 'Cancelada' : 'Ver Detalles'}
                              </Button>
                            </td>
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Vista de Turnos Disponibles */}
      {activeView === 'turnos-disponibles' && (
        <Card>
          <CardHeader>
            <CardTitle>Turnos Cancelados Disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTurnosCancelados ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Cargando turnos cancelados...</p>
              </div>
            ) : turnosCancelados.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No hay turnos cancelados disponibles
              </div>
            ) : (
              <div className="space-y-4">
                {turnosCancelados.map((turno) => (
                  <div key={turno.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{turno.servicio}</h3>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(turno.turno_fecha), 'dd/MM', { locale: es })} - 
                          {formatTime(turno.turno_hora_inicio)} a {formatTime(turno.turno_hora_fin)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Cancelado el {format(new Date(turno.fecha_cancelacion), 'dd/MM/yyyy HH:mm', { locale: es })}
                        </p>
                        {turno.motivo_cancelacion && (
                          <p className="text-xs text-muted-foreground italic">
                            {turno.motivo_cancelacion}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary">
                        Disponible
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal de detalles de la clase */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Detalles de la Clase</span>
            </DialogTitle>
            <DialogDescription>
              Información completa de tu clase programada
            </DialogDescription>
          </DialogHeader>
          
          {selectedClase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Fecha</label>
                  <p className="text-sm">{format(selectedClase.dia, 'dd/MM', { locale: es })}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Día</label>
                  <p className="text-sm">{format(selectedClase.dia, 'EEEE', { locale: es })}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Hora de Inicio</label>
                  <p className="text-sm">{formatTime(selectedClase.horario.hora_inicio)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Hora de Fin</label>
                  <p className="text-sm">{formatTime(selectedClase.horario.hora_fin)}</p>
                </div>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowModal(false);
                    setConfirmOpen(true);
                  }}
                  disabled={selectedClase.horario.cancelada}
                  className="flex-1"
                >
                  {selectedClase.horario.cancelada ? 'Ya Cancelada' : 'Cancelar Clase'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  className="flex-1"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación de cancelación */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cancelación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres cancelar esta clase? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmarCancelacion} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar cancelación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};