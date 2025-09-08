import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { format, startOfMonth, endOfMonth, addMonths, isSameMonth, isToday, addDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface HorarioRecurrente {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
}

interface ReservaConfirmada {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  dia_semana: number;
  estado: string;
}

export const RecurringScheduleView = () => {
  const { user } = useAuthContext();
  const { showError } = useNotifications();
  
  const [horariosRecurrentes, setHorariosRecurrentes] = useState<HorarioRecurrente[]>([]);
  const [reservasConfirmadas, setReservasConfirmadas] = useState<ReservaConfirmada[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // Días de la semana
  const diasSemana = [
    { numero: 1, nombre: 'Lunes', nombreCorto: 'Lun' },
    { numero: 2, nombre: 'Martes', nombreCorto: 'Mar' },
    { numero: 3, nombre: 'Miércoles', nombreCorto: 'Mié' },
    { numero: 4, nombre: 'Jueves', nombreCorto: 'Jue' },
    { numero: 5, nombre: 'Viernes', nombreCorto: 'Vie' }
  ];

  useEffect(() => {
    if (user) {
      fetchHorariosRecurrentes();
      fetchReservasConfirmadas();
    }
  }, [user, currentMonth]);

  const fetchHorariosRecurrentes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('horarios_recurrentes_usuario')
        .select('id, dia_semana, hora_inicio, hora_fin, activo')
        .eq('usuario_id', user.id)
        .eq('activo', true)
        .order('dia_semana', { ascending: true })
        .order('hora_inicio', { ascending: true });

      if (error) {
        console.error('Error cargando horarios recurrentes:', error);
        // Si la tabla no existe aún, no mostrar error
        if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist')) {
          console.log('Tabla horarios_recurrentes_usuario no existe aún');
          setHorariosRecurrentes([]);
        } else {
          showError('Error', 'No se pudieron cargar tus horarios recurrentes');
        }
        return;
      }

      setHorariosRecurrentes(data || []);
    } catch (error) {
      console.error('Error inesperado:', error);
      setHorariosRecurrentes([]);
    }
  };

  const fetchReservasConfirmadas = async () => {
    if (!user) return;

    try {
      const startDate = startOfMonth(currentMonth);
      const endDate = endOfMonth(addMonths(currentMonth, 1)); // Mes actual + siguiente

      const { data, error } = await supabase
        .from('turnos')
        .select('id, fecha, hora_inicio, hora_fin, estado')
        .eq('cliente_id', user.id)
        .gte('fecha', startDate.toISOString().split('T')[0])
        .lte('fecha', endDate.toISOString().split('T')[0])
        .in('estado', ['ocupado', 'disponible'])
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true });

      if (error) {
        console.error('Error cargando reservas:', error);
        showError('Error', 'No se pudieron cargar tus reservas');
        return;
      }

      // Agregar día de la semana a cada reserva
      const reservasConDia = (data || []).map(reserva => ({
        ...reserva,
        dia_semana: new Date(reserva.fecha).getDay() === 0 ? 7 : new Date(reserva.fecha).getDay()
      }));

      setReservasConfirmadas(reservasConDia);
    } catch (error) {
      console.error('Error inesperado:', error);
      showError('Error', 'Error inesperado al cargar reservas');
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => addMonths(prev, direction === 'next' ? 1 : -1));
  };

  const getReservasDelMes = (mes: Date) => {
    return reservasConfirmadas.filter(reserva => 
      isSameMonth(new Date(reserva.fecha), mes)
    );
  };

  const getReservasDelDia = (fecha: Date) => {
    const fechaStr = fecha.toISOString().split('T')[0];
    return reservasConfirmadas.filter(reserva => reserva.fecha === fechaStr);
  };

  const esDiaConReserva = (fecha: Date) => {
    return getReservasDelDia(fecha).length > 0;
  };

  const esHoy = (fecha: Date) => {
    return isToday(fecha);
  };

  const generarDiasDelMes = (mes: Date) => {
    const start = startOfMonth(mes);
    const end = endOfMonth(mes);
    const dias = [];
    
    let current = start;
    while (current <= end) {
      dias.push(new Date(current));
      current = addDays(current, 1);
    }
    
    return dias;
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
      {/* Header con navegación */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Mi Agenda Recurrente</h2>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('prev')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('next')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Información de horarios recurrentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Mis Horarios Recurrentes</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {horariosRecurrentes.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No tienes horarios recurrentes configurados
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {diasSemana.map(dia => {
                const horariosDelDia = horariosRecurrentes.filter(h => h.dia_semana === dia.numero);
                return (
                  <div key={dia.numero} className="space-y-2">
                    <h4 className="font-medium text-sm">{dia.nombre}</h4>
                    {horariosDelDia.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin horarios</p>
                    ) : (
                      <div className="space-y-1">
                        {horariosDelDia.map(horario => (
                          <Badge key={horario.id} variant="secondary" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {horario.hora_inicio} - {horario.hora_fin}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendario de reservas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Reservas Confirmadas</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(dia => (
              <div key={dia} className="text-center text-sm font-medium text-muted-foreground p-2">
                {dia}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {generarDiasDelMes(currentMonth).map((fecha, index) => {
              const reservasDelDia = getReservasDelDia(fecha);
              const tieneReserva = esDiaConReserva(fecha);
              const esHoyDia = esHoy(fecha);
              
              return (
                <div
                  key={index}
                  className={`
                    aspect-square p-2 border rounded-lg text-center text-sm
                    ${tieneReserva 
                      ? 'bg-primary text-primary-foreground border-primary' 
                      : 'bg-muted/30 border-muted'
                    }
                    ${esHoyDia ? 'ring-2 ring-primary/50' : ''}
                  `}
                >
                  <div className="font-medium">{fecha.getDate()}</div>
                  {tieneReserva && (
                    <div className="text-xs mt-1">
                      {reservasDelDia.map(reserva => (
                        <div key={reserva.id} className="truncate">
                          {reserva.hora_inicio}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
