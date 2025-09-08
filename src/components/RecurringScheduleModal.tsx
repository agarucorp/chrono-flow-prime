import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

interface HorarioClase {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  capacidad_maxima: number;
  activo: boolean;
}

interface RecurringScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const RecurringScheduleModal: React.FC<RecurringScheduleModalProps> = ({
  isOpen,
  onClose,
  onComplete
}) => {
  const { user } = useAuthContext();
  const { showSuccess, showError, showLoading, dismissToast } = useNotifications();
  
  const [horariosClase, setHorariosClase] = useState<HorarioClase[]>([]);
  const [horariosSeleccionados, setHorariosSeleccionados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Días de la semana
  const diasSemana = [
    { numero: 1, nombre: 'Lunes', nombreCorto: 'Lun' },
    { numero: 2, nombre: 'Martes', nombreCorto: 'Mar' },
    { numero: 3, nombre: 'Miércoles', nombreCorto: 'Mié' },
    { numero: 4, nombre: 'Jueves', nombreCorto: 'Jue' },
    { numero: 5, nombre: 'Viernes', nombreCorto: 'Vie' }
  ];

  // Cargar horarios de clase disponibles
  useEffect(() => {
    if (isOpen) {
      fetchHorariosClase();
    }
  }, [isOpen]);

  const fetchHorariosClase = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('horarios_clase')
        .select('*')
        .eq('activo', true)
        .order('dia_semana', { ascending: true })
        .order('hora_inicio', { ascending: true });

      if (error) {
        console.error('Error cargando horarios:', error);
        showError('Error', 'No se pudieron cargar los horarios disponibles');
        return;
      }

      setHorariosClase(data || []);
    } catch (error) {
      console.error('Error inesperado:', error);
      showError('Error', 'Error inesperado al cargar horarios');
    } finally {
      setLoading(false);
    }
  };

  const toggleHorario = (horarioId: string, diaSemana: number) => {
    setHorariosSeleccionados(prev => {
      const newSelection = new Set(prev);
      
      // Verificar si ya hay un horario seleccionado para este día
      const horariosDelDia = horariosClase.filter(h => h.dia_semana === diaSemana);
      const horariosDelDiaSeleccionados = horariosDelDia.filter(h => newSelection.has(h.id));
      
      if (horariosDelDiaSeleccionados.length > 0 && !newSelection.has(horarioId)) {
        // Si ya hay un horario seleccionado para este día, remover el anterior
        horariosDelDiaSeleccionados.forEach(h => newSelection.delete(h.id));
      }
      
      if (newSelection.has(horarioId)) {
        newSelection.delete(horarioId);
      } else {
        newSelection.add(horarioId);
      }
      
      return newSelection;
    });
  };

  const handleSave = async () => {
    if (horariosSeleccionados.size === 0) {
      showError('Selección requerida', 'Debes seleccionar al menos un horario para tu cuota mensual');
      return;
    }

    try {
      setSaving(true);
      const loadingToast = showLoading('Configurando tu horario recurrente...');

      // Crear registros de horarios recurrentes para el usuario
      const horariosRecurrentes = Array.from(horariosSeleccionados).map(horarioId => {
        const horario = horariosClase.find(h => h.id === horarioId);
        return {
          usuario_id: user?.id,
          horario_clase_id: horarioId,
          dia_semana: horario?.dia_semana,
          hora_inicio: horario?.hora_inicio,
          hora_fin: horario?.hora_fin,
          activo: true,
          fecha_inicio: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString()
        };
      });

      const { error } = await supabase
        .from('horarios_recurrentes_usuario')
        .insert(horariosRecurrentes);

      dismissToast(loadingToast);

      if (error) {
        console.error('Error guardando horarios recurrentes:', error);
        showError('Error', 'No se pudieron guardar tus horarios recurrentes');
        return;
      }

      showSuccess(
        '¡Horarios configurados!', 
        `Has configurado ${horariosSeleccionados.size} horario(s) recurrente(s) para tu cuota mensual`
      );

      onComplete();
    } catch (error) {
      console.error('Error inesperado:', error);
      showError('Error', 'Error inesperado al guardar horarios');
    } finally {
      setSaving(false);
    }
  };

  const getHorariosPorDia = (diaSemana: number) => {
    return horariosClase.filter(h => h.dia_semana === diaSemana);
  };

  const isHorarioSeleccionado = (horarioId: string) => {
    return horariosSeleccionados.has(horarioId);
  };

  const tieneHorarioEnDia = (diaSemana: number) => {
    const horariosDelDia = getHorariosPorDia(diaSemana);
    return horariosDelDia.some(h => horariosSeleccionados.has(h.id));
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Configura tu horario recurrente</span>
          </DialogTitle>
          <DialogDescription>
            Selecciona los horarios que deseas reservar de forma recurrente para tu cuota mensual. 
            Puedes elegir máximo 1 clase por día de lunes a viernes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información importante */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Sistema de cuota mensual</p>
                <p className="text-xs mt-1">
                  Los horarios que selecciones se reservarán automáticamente cada mes. 
                  Solo puedes elegir 1 clase por día para mantener la disponibilidad para otros usuarios.
                </p>
              </div>
            </div>
          </div>

          {/* Selección de horarios por día */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {diasSemana.map(dia => {
              const horariosDelDia = getHorariosPorDia(dia.numero);
              const tieneSeleccion = tieneHorarioEnDia(dia.numero);

              return (
                <Card key={dia.numero} className={`${tieneSeleccion ? 'ring-2 ring-primary' : ''}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>{dia.nombre}</span>
                      {tieneSeleccion && (
                        <Badge variant="default" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Seleccionado
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {horariosDelDia.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          No hay horarios disponibles
                        </p>
                      ) : (
                        horariosDelDia.map(horario => (
                          <Button
                            key={horario.id}
                            variant={isHorarioSeleccionado(horario.id) ? "default" : "outline"}
                            size="sm"
                            className="w-full justify-start text-xs h-8"
                            onClick={() => toggleHorario(horario.id, dia.numero)}
                          >
                            <Clock className="h-3 w-3 mr-2" />
                            {horario.hora_inicio} - {horario.hora_fin}
                          </Button>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Resumen de selección */}
          {horariosSeleccionados.size > 0 && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Resumen de tu selección:</h4>
              <div className="text-sm text-muted-foreground">
                <p>• {horariosSeleccionados.size} horario(s) seleccionado(s)</p>
                <p>• Estos horarios se reservarán automáticamente cada mes</p>
                <p>• Podrás modificar tu selección desde tu perfil</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || horariosSeleccionados.size === 0}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Guardando...
              </>
            ) : (
              `Configurar ${horariosSeleccionados.size} horario(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
