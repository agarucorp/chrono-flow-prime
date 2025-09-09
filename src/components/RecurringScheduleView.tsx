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

  // Generar clases para el mes actual
  const clasesDelMes = useMemo(() => {
    const clases: ClaseDelDia[] = [];
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    
    horariosRecurrentes.forEach(horario => {
      const days = eachDayOfInterval({ start, end });
      days.forEach(dia => {
        if (getDay(dia) === horario.dia_semana) {
          clases.push({
            id: `${horario.id}-${format(dia, 'yyyy-MM-dd')}`,
            dia,
            horario
          });
        }
      });
    });
    
    return clases;
  }, [horariosRecurrentes, currentMonth]);

  // Función para obtener clases de un día específico
  const getClasesDelDia = (dia: Date) => {
    return clasesDelMes.filter(clase => isSameDay(clase.dia, dia));
  };

  // Generar días del mes actual (solo días con clases)
  const diasDelMes = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    
    // Filtrar solo días que tienen clases
    return days.filter(dia => {
      const clasesDelDia = getClasesDelDia(dia);
      return clasesDelDia.length > 0;
    });
  }, [currentMonth, clasesDelMes]);

  useEffect(() => {
    if (user && !hasLoaded) {
      fetchHorariosRecurrentes();
      cargarClasesCanceladas();
    } else if (!user) {
      setLoading(false);
      setHasLoaded(true);
    }
  }, [user, hasLoaded]);

  const cargarClasesCanceladas = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('turnos_cancelados')
        .select('*')
        .eq('cliente_id', user.id);

      if (error) {
        console.error('Error cargando clases canceladas:', error);
        return;
      }

      // Marcar las clases canceladas en horariosRecurrentes
      if (data && data.length > 0) {
        setHorariosRecurrentes(prev => 
          prev.map(horario => {
            const esCancelada = data.some(cancelacion => 
              cancelacion.turno_hora_inicio === horario.hora_inicio &&
              cancelacion.turno_hora_fin === horario.hora_fin
            );
            return esCancelada ? { ...horario, cancelada: true, activo: false } : horario;
          })
        );
      }
    } catch (error) {
      console.error('Error cargando clases canceladas:', error);
    }
  };

  useEffect(() => {
    if (showTurnosCancelados && user) {
      cargarTurnosCancelados();
    }
  }, [showTurnosCancelados, user]);

  const fetchHorariosRecurrentes = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('horarios_recurrentes_usuario')
        .select('id, dia_semana, hora_inicio, hora_fin, activo')
        .eq('usuario_id', user.id)
        .eq('activo', true)
        .order('dia_semana', { ascending: true })
        .order('hora_inicio', { ascending: true });

      if (error) {
        console.error('Error cargando horarios recurrentes:', error);
        if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist')) {
          console.log('Tabla horarios_recurrentes_usuario no existe aún');
          setHorariosRecurrentes([]);
        } else {
          throw error;
        }
      } else {
        setHorariosRecurrentes(data || []);
      }
    } catch (error) {
      console.error('Error inesperado:', error);
      setHorariosRecurrentes([]);
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  };

  const handleClaseClick = (clase: ClaseDelDia) => {
    // No permitir abrir modal si la clase ya está cancelada
    if (clase.horario.cancelada) {
      return;
    }
    setSelectedClase(clase);
    setShowModal(true);
  };

  const handleCancelarClase = () => {
    // Abrir confirmación primero
    setConfirmOpen(true);
  };

  const handleConfirmarCancelacion = async () => {
    if (!selectedClase || !user) return;
    
    // Verificar si la clase ya fue cancelada
    if (selectedClase.horario.cancelada) {
      alert('Esta clase ya fue cancelada anteriormente');
      setConfirmOpen(false);
      setShowModal(false);
      setSelectedClase(null);
      return;
    }
    
    try {
      console.log('Iniciando cancelación de clase:', selectedClase);
      
      // Verificar si ya existe una cancelación para esta clase
      const { data: cancelacionExistente } = await supabase
        .from('turnos_cancelados')
        .select('*')
        .eq('cliente_id', user.id)
        .eq('turno_fecha', format(selectedClase.dia, 'yyyy-MM-dd'))
        .eq('turno_hora_inicio', selectedClase.horario.hora_inicio)
        .eq('turno_hora_fin', selectedClase.horario.hora_fin);

      if (cancelacionExistente && cancelacionExistente.length > 0) {
        alert('Esta clase ya fue cancelada anteriormente');
        setConfirmOpen(false);
        setShowModal(false);
        setSelectedClase(null);
        return;
      }
      
      // Datos para insertar (sin turno_id para evitar foreign key constraint)
      const datosCancelacion = {
        cliente_id: user.id,
        turno_fecha: format(selectedClase.dia, 'yyyy-MM-dd'),
        turno_hora_inicio: selectedClase.horario.hora_inicio,
        turno_hora_fin: selectedClase.horario.hora_fin,
        servicio: 'Clase Individual',
        tipo_cancelacion: 'usuario',
        motivo_cancelacion: `Cancelado por el usuario: ${user.email}`
      };
      
      console.log('Datos a insertar:', datosCancelacion);
      
      // Insertar en la tabla turnos_cancelados
      const { data, error } = await supabase
        .from('turnos_cancelados')
        .insert(datosCancelacion)
        .select();

      if (error) {
        console.error('Error insertando cancelación:', error);
        alert('Error al cancelar la clase: ' + JSON.stringify(error));
        return;
      }

      console.log('Cancelación insertada:', data);

      // Marcar la clase como cancelada y desactivarla
      setHorariosRecurrentes(prev => 
        prev.map(horario => 
          horario.id === selectedClase.horario.id 
            ? { ...horario, cancelada: true, activo: false }
            : horario
        )
      );

      // Recargar turnos cancelados
      await cargarTurnosCancelados();

      setConfirmOpen(false);
      setShowModal(false);
      setSelectedClase(null);
      
      console.log('Clase cancelada exitosamente');
      alert('Clase cancelada exitosamente');
    } catch (error) {
      console.error('Error confirmando cancelación:', error);
      alert('Error al cancelar la clase: ' + error);
    }
  };

  const cargarTurnosCancelados = async () => {
    if (!user) {
      console.log('No hay usuario autenticado');
      return;
    }
    
    console.log('Cargando turnos cancelados para usuario:', user.id);
    setLoadingTurnosCancelados(true);
    
    try {
      // Primero probar una consulta simple
      const { data, error } = await supabase
        .from('turnos_cancelados')
        .select('*');

      if (error) {
        console.error('Error cargando turnos cancelados:', error);
        alert('Error cargando turnos cancelados: ' + JSON.stringify(error));
        return;
      }

      console.log('Todos los turnos cancelados:', data);
      
      // Filtrar por cliente_id en el frontend
      const turnosDelUsuario = data?.filter(turno => turno.cliente_id === user.id) || [];
      console.log('Turnos del usuario:', turnosDelUsuario);
      
      setTurnosCancelados(turnosDelUsuario);
    } catch (error) {
      console.error('Error cargando turnos cancelados:', error);
      alert('Error cargando turnos cancelados: ' + error);
    } finally {
      setLoadingTurnosCancelados(false);
    }
  };

  const handlePreviousMonth = () => {
    const today = new Date();
    const currentMonthStart = startOfMonth(currentMonth);
    const todayMonthStart = startOfMonth(today);
    
    // Solo permitir navegar si no es el mes actual
    if (currentMonthStart.getTime() > todayMonthStart.getTime()) {
      setCurrentMonth(prev => subMonths(prev, 1));
    }
  };

  const handleNextMonth = () => {
    const today = new Date();
    const nextMonth = addMonths(today, 1);
    const currentMonthStart = startOfMonth(currentMonth);
    const nextMonthStart = startOfMonth(nextMonth);
    
    // Solo permitir navegar al mes siguiente
    if (currentMonthStart.getTime() < nextMonthStart.getTime()) {
      setCurrentMonth(prev => addMonths(prev, 1));
    }
  };

  // Verificar si se puede navegar a meses anteriores o siguientes
  const canNavigatePrevious = () => {
    const today = new Date();
    const currentMonthStart = startOfMonth(currentMonth);
    const todayMonthStart = startOfMonth(today);
    return currentMonthStart.getTime() > todayMonthStart.getTime();
  };

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
      {/* Header con navegación del mes */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold">Mis Clases</h2>
          <div className="flex space-x-2">
            <button 
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={() => setShowTurnosCancelados(!showTurnosCancelados)}
            >
              {showTurnosCancelados ? 'Ver Mis Clases' : 'Turnos disponibles'}
            </button>
            <button 
              className="px-2 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
              onClick={cargarTurnosCancelados}
            >
              Test DB
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-4">
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
      </div>

      {/* Vista de Turnos Cancelados */}
      {showTurnosCancelados && (
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
                          {turno.turno_fecha} - 
                          {turno.turno_hora_inicio} a {turno.turno_hora_fin}
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

      {/* Agenda */}
      {!showTurnosCancelados && (
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
                    <th className="p-4 text-center font-medium text-sm text-muted-foreground">Acciones</th>
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
                            {format(dia, 'dd/MM/yyyy', { locale: es })}
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
                          <div className="flex items-center space-x-2">
                            <Clock className={`h-4 w-4 ${
                              clase.horario.cancelada 
                                ? 'text-red-500' 
                                : 'text-muted-foreground'
                            }`} />
                            <span className={`text-sm font-medium ${
                              clase.horario.cancelada 
                                ? 'text-red-600 dark:text-red-400 line-through' 
                                : ''
                            }`}>
                              {clase.horario.hora_inicio} - {clase.horario.hora_fin}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
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
                  <p className="text-sm">{format(selectedClase.dia, 'dd/MM/yyyy', { locale: es })}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Día</label>
                  <p className="text-sm">{format(selectedClase.dia, 'EEEE', { locale: es })}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Hora de Inicio</label>
                  <p className="text-sm">{selectedClase.horario.hora_inicio}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Hora de Fin</label>
                  <p className="text-sm">{selectedClase.horario.hora_fin}</p>
                </div>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button
                  variant="destructive"
                  onClick={handleCancelarClase}
                  className="flex-1"
                >
                  Cancelar Clase
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

      {/* Confirmación de cancelación con advertencia 24hs */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cancelación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Deseas cancelar esta clase?
              <br />
              <span className="block mt-2 text-amber-600 dark:text-amber-400">
                Importante: si cancelas con menos de 24 horas de antelación, se cobrará el valor total de la clase.
              </span>
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
