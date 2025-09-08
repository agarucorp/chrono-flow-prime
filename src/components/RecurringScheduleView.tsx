import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
    } else if (!user) {
      setLoading(false);
      setHasLoaded(true);
    }
  }, [user, hasLoaded]);

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
    setSelectedClase(clase);
    setShowModal(true);
  };

  const handleCancelarClase = async () => {
    if (!selectedClase) return;
    
    try {
      // Aquí iría la lógica para cancelar la clase
      console.log('Cancelando clase:', selectedClase.id);
      // Por ahora solo cerramos el modal
      setShowModal(false);
      setSelectedClase(null);
    } catch (error) {
      console.error('Error cancelando clase:', error);
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
        <h2 className="text-2xl font-bold">Mis Clases</h2>
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

      {/* Agenda */}
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
                      <tr key={`${dia.getTime()}-${claseIndex}`} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <div className="text-sm font-medium">
                            {format(dia, 'dd/MM/yyyy', { locale: es })}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm text-muted-foreground">
                            {format(dia, 'EEEE', { locale: es })}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
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
                          >
                            Ver Detalles
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
    </div>
  );
};
