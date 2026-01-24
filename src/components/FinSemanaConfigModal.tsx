import { useState, useEffect } from 'react';
import { Calendar, X, Plus, Trash2, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/hooks/useNotifications';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface HorarioPersonalizado {
  hora_inicio: string;
  hora_fin: string;
}

interface FinSemanaHabilitado {
  id?: string;
  fecha: string;
  tipo: 'fin_semana_habilitado';
  horarios_personalizados: HorarioPersonalizado[];
  activo: boolean;
}

interface FinSemanaConfigModalProps {
  open: boolean;
  onClose: () => void;
  fechaSeleccionada?: Date | null;
  onFinSemanaGuardado?: () => void;
}

export const FinSemanaConfigModal = ({ 
  open, 
  onClose, 
  fechaSeleccionada,
  onFinSemanaGuardado 
}: FinSemanaConfigModalProps) => {
  const { showSuccess, showError, showLoading, dismissToast } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [fecha, setFecha] = useState<string>('');
  const [horariosPersonalizados, setHorariosPersonalizados] = useState<HorarioPersonalizado[]>([]);
  const [editandoFinSemana, setEditandoFinSemana] = useState<FinSemanaHabilitado | null>(null);

  useEffect(() => {
    if (open && fechaSeleccionada) {
      const fechaStr = format(fechaSeleccionada, 'yyyy-MM-dd');
      setFecha(fechaStr);
      cargarFinSemanaExistente(fechaStr);
    } else {
      resetearFormulario();
    }
  }, [open, fechaSeleccionada]);

  const resetearFormulario = () => {
    setEditandoFinSemana(null);
    setFecha('');
    setHorariosPersonalizados([]);
  };

  const cargarFinSemanaExistente = async (fechaStr: string) => {
    try {
      const { data, error } = await supabase
        .from('feriados')
        .select('*')
        .eq('fecha', fechaStr)
        .eq('tipo', 'fin_semana_habilitado')
        .eq('activo', true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error cargando fin de semana:', error);
        return;
      }

      if (data) {
        setEditandoFinSemana(data);
        setHorariosPersonalizados(data.horarios_personalizados || []);
      } else {
        setEditandoFinSemana(null);
        setHorariosPersonalizados([]);
      }
    } catch (error) {
      console.error('Error inesperado cargando fin de semana:', error);
    }
  };

  const agregarHorario = () => {
    setHorariosPersonalizados([...horariosPersonalizados, { hora_inicio: '09:00', hora_fin: '10:00' }]);
  };

  const eliminarHorario = (index: number) => {
    setHorariosPersonalizados(horariosPersonalizados.filter((_, i) => i !== index));
  };

  const actualizarHorario = (index: number, campo: 'hora_inicio' | 'hora_fin', valor: string) => {
    const nuevosHorarios = [...horariosPersonalizados];
    nuevosHorarios[index][campo] = valor;
    setHorariosPersonalizados(nuevosHorarios);
  };

  const guardarFinSemana = async () => {
    if (!fecha) {
      showError('Por favor, selecciona una fecha');
      return;
    }

    if (horariosPersonalizados.length === 0) {
      showError('Debes agregar al menos un horario para habilitar el fin de semana');
      return;
    }

    // Validar que todos los horarios tengan hora_inicio y hora_fin
    const horariosInvalidos = horariosPersonalizados.some(h => !h.hora_inicio || !h.hora_fin);
    if (horariosInvalidos) {
      showError('Todos los horarios deben tener hora de inicio y fin');
      return;
    }

    setLoading(true);
    let loadingToast = showLoading('Guardando fin de semana habilitado...');

    try {
      const datosFinSemana: any = {
        fecha,
        tipo: 'fin_semana_habilitado',
        horarios_personalizados: horariosPersonalizados,
        activo: true
      };

      let finSemanaId: string | undefined;

      if (editandoFinSemana?.id) {
        // Actualizar
        const { error: updateError } = await supabase
          .from('feriados')
          .update(datosFinSemana)
          .eq('id', editandoFinSemana.id);

        if (updateError) throw updateError;
        finSemanaId = editandoFinSemana.id;
      } else {
        // Crear
        const { data: insertData, error: insertError } = await supabase
          .from('feriados')
          .insert(datosFinSemana)
          .select()
          .single();

        if (insertError) throw insertError;
        finSemanaId = insertData?.id;
      }

      // Crear turnos disponibles para los horarios personalizados
      if (horariosPersonalizados.length > 0 && finSemanaId) {
        for (const horario of horariosPersonalizados) {
          const horaInicio = horario.hora_inicio.length === 5 ? horario.hora_inicio : `${horario.hora_inicio}:00`;
          const horaFin = horario.hora_fin.length === 5 ? horario.hora_fin : `${horario.hora_fin}:00`;

          // Verificar si ya existe
          const { data: existente } = await supabase
            .from('turnos_disponibles')
            .select('id')
            .eq('turno_fecha', fecha)
            .eq('turno_hora_inicio', horaInicio)
            .eq('turno_hora_fin', horaFin)
            .eq('creado_desde_feriado_id', finSemanaId)
            .maybeSingle();

          if (!existente) {
            const { error: errorDisponible } = await supabase
              .from('turnos_disponibles')
              .insert({
                turno_fecha: fecha,
                turno_hora_inicio: horaInicio,
                turno_hora_fin: horaFin,
                creado_desde_feriado_id: finSemanaId
              });

            if (errorDisponible) {
              console.error('Error creando turno disponible:', errorDisponible);
            }
          }
        }
      }

      dismissToast(loadingToast);
      showSuccess('Fin de semana habilitado guardado correctamente');
      resetearFormulario();
      onClose();
      window.dispatchEvent(new CustomEvent('feriados:updated'));
      onFinSemanaGuardado?.();
    } catch (error: any) {
      dismissToast(loadingToast);
      console.error('Error guardando fin de semana:', error);
      showError(error.message || 'Error al guardar fin de semana habilitado');
    } finally {
      setLoading(false);
    }
  };

  const eliminarFinSemana = async () => {
    if (!editandoFinSemana?.id) return;

    setLoading(true);
    let loadingToast = showLoading('Eliminando fin de semana habilitado...');

    try {
      // Eliminar turnos disponibles asociados
      await supabase
        .from('turnos_disponibles')
        .delete()
        .eq('creado_desde_feriado_id', editandoFinSemana.id);

      // Eliminar el feriado
      const { error } = await supabase
        .from('feriados')
        .delete()
        .eq('id', editandoFinSemana.id);

      if (error) throw error;

      dismissToast(loadingToast);
      showSuccess('Fin de semana habilitado eliminado correctamente');
      resetearFormulario();
      onClose();
      window.dispatchEvent(new CustomEvent('feriados:updated'));
      onFinSemanaGuardado?.();
    } catch (error: any) {
      dismissToast(loadingToast);
      console.error('Error eliminando fin de semana:', error);
      showError(error.message || 'Error al eliminar fin de semana habilitado');
    } finally {
      setLoading(false);
    }
  };

  const fechaFormateada = fecha ? format(new Date(fecha + 'T00:00:00'), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es }) : '';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Habilitar fin de semana</DialogTitle>
          <DialogDescription>
            {fechaSeleccionada && (
              <span>Configura los horarios disponibles para el {fechaFormateada}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {fechaSeleccionada && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium">Fecha seleccionada:</p>
              <p className="text-lg font-semibold mt-1">{fechaFormateada}</p>
            </div>
          )}

          <div>
            <Label className="text-base font-semibold mb-3 block">Horarios disponibles</Label>
            <p className="text-sm text-muted-foreground mb-4">
              Agrega los horarios que estarán disponibles para este fin de semana.
            </p>

            {horariosPersonalizados.length === 0 ? (
              <Card className="p-4 border-dashed">
                <p className="text-sm text-muted-foreground text-center">
                  No hay horarios configurados. Agrega al menos uno para habilitar el fin de semana.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {horariosPersonalizados.map((horario, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`hora_inicio_${index}`}>Hora inicio</Label>
                          <Input
                            id={`hora_inicio_${index}`}
                            type="time"
                            value={horario.hora_inicio}
                            onChange={(e) => actualizarHorario(index, 'hora_inicio', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`hora_fin_${index}`}>Hora fin</Label>
                          <Input
                            id={`hora_fin_${index}`}
                            type="time"
                            value={horario.hora_fin}
                            onChange={(e) => actualizarHorario(index, 'hora_fin', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => eliminarHorario(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={agregarHorario}
              className="mt-4 w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar horario
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {editandoFinSemana && (
            <Button
              variant="destructive"
              onClick={eliminarFinSemana}
              disabled={loading}
            >
              Eliminar
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={guardarFinSemana} disabled={loading || horariosPersonalizados.length === 0}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
