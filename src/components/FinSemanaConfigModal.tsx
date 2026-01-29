import { useState, useEffect } from 'react';
import { Calendar, X, Plus, Trash2, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/hooks/useNotifications';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface HorarioPersonalizado {
  hora_inicio: string;
  hora_fin: string;
  clase_numero?: number; // Para identificar qué clase fue seleccionada
  capacidad: number; // Capacidad OBLIGATORIA para este horario
}

interface ClaseDisponible {
  clase_numero: number;
  hora_inicio: string;
  hora_fin: string;
  nombre: string;
  capacidad: number; // Capacidad de la clase
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
  const [clasesDisponibles, setClasesDisponibles] = useState<ClaseDisponible[]>([]);

  useEffect(() => {
    if (open) {
      cargarClasesDisponibles();
      if (fechaSeleccionada) {
        const fechaStr = format(fechaSeleccionada, 'yyyy-MM-dd');
        setFecha(fechaStr);
        cargarFinSemanaExistente(fechaStr);
      } else {
        resetearFormulario();
      }
    } else {
      resetearFormulario();
    }
  }, [open, fechaSeleccionada]);

  // Actualizar horarios con clase_numero cuando se cargan las clases disponibles
  useEffect(() => {
    if (clasesDisponibles.length > 0 && editandoFinSemana && horariosPersonalizados.length > 0) {
      const horariosConClase = horariosPersonalizados.map(horario => {
        // Si ya tiene clase_numero, mantenerlo
        if (horario.clase_numero) {
          return horario;
        }
        
        // Intentar encontrar la clase que coincida con este horario
        const horaInicio = horario.hora_inicio?.substring(0, 5) || '';
        const horaFin = horario.hora_fin?.substring(0, 5) || '';
        const claseEncontrada = clasesDisponibles.find(
          c => c.hora_inicio === horaInicio && c.hora_fin === horaFin
        );
        
        if (claseEncontrada) {
          return {
            ...horario,
            clase_numero: claseEncontrada.clase_numero
          };
        }
        
        // Si no se encuentra, mantener el horario sin clase_numero
        return horario;
      });
      
      // Solo actualizar si hay cambios
      const hayCambios = horariosConClase.some((h, i) => h.clase_numero !== horariosPersonalizados[i]?.clase_numero);
      if (hayCambios) {
        setHorariosPersonalizados(horariosConClase);
      }
    }
  }, [clasesDisponibles]);

  const cargarClasesDisponibles = async () => {
    try {
      const { data, error } = await supabase
        .from('horarios_semanales')
        .select('clase_numero, hora_inicio, hora_fin, capacidad')
        .eq('dia_semana', 1) // Usar lunes como referencia (todas las clases tienen los mismos horarios todos los días)
        .eq('activo', true)
        .order('clase_numero');

      if (error) {
        console.error('Error cargando clases disponibles:', error);
        return;
      }

      if (data && data.length > 0) {
        const clases = data.map((h: any) => ({
          clase_numero: h.clase_numero,
          hora_inicio: h.hora_inicio.substring(0, 5), // Formato HH:MM
          hora_fin: h.hora_fin.substring(0, 5),
          nombre: `Clase ${h.clase_numero} (${h.hora_inicio.substring(0, 5)} - ${h.hora_fin.substring(0, 5)})`,
          capacidad: h.capacidad || 4
        }));
        setClasesDisponibles(clases);
      }
    } catch (error) {
      console.error('Error inesperado cargando clases:', error);
    }
  };

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
        // Los horarios se asociarán con clases en el useEffect cuando clasesDisponibles se carguen
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
    // Agregar un horario vacío que se completará con el dropdown (capacidad obligatoria)
    setHorariosPersonalizados([
      ...horariosPersonalizados,
      { hora_inicio: '', hora_fin: '', clase_numero: undefined, capacidad: 0 }
    ]);
  };

  const eliminarHorario = (index: number) => {
    setHorariosPersonalizados(horariosPersonalizados.filter((_, i) => i !== index));
  };

  const seleccionarClase = (index: number, claseNumero: number) => {
    const claseSeleccionada = clasesDisponibles.find(c => c.clase_numero === claseNumero);
    if (!claseSeleccionada) return;

    const nuevosHorarios = [...horariosPersonalizados];
    // Mantener la capacidad existente (el admin debe configurarla manualmente)
    const capacidadExistente = nuevosHorarios[index]?.capacidad || 0;
    nuevosHorarios[index] = {
      hora_inicio: claseSeleccionada.hora_inicio,
      hora_fin: claseSeleccionada.hora_fin,
      clase_numero: claseNumero,
      capacidad: capacidadExistente
    };
    setHorariosPersonalizados(nuevosHorarios);
  };

  const actualizarCapacidad = (index: number, capacidad: number) => {
    const nuevosHorarios = [...horariosPersonalizados];
    nuevosHorarios[index] = {
      ...nuevosHorarios[index],
      capacidad: Math.max(1, capacidad)
    };
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

    // Validar que todos los horarios tengan capacidad configurada
    const sinCapacidad = horariosPersonalizados.some(h => !h.capacidad || h.capacidad < 1);
    if (sinCapacidad) {
      showError('Debes configurar la capacidad para todos los horarios');
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
                    <div className="flex items-start gap-4">
                      <div className="flex-1 space-y-3">
                        <div>
                          <Label htmlFor={`clase_${index}`}>Seleccionar clase</Label>
                          {clasesDisponibles.length > 0 ? (
                            <Select
                              value={horario.clase_numero?.toString() || ''}
                              onValueChange={(value) => seleccionarClase(index, parseInt(value))}
                            >
                              <SelectTrigger id={`clase_${index}`} className="mt-1">
                                <SelectValue placeholder="Selecciona una clase" />
                              </SelectTrigger>
                              <SelectContent>
                                {clasesDisponibles.map((clase) => (
                                  <SelectItem key={clase.clase_numero} value={clase.clase_numero.toString()}>
                                    {clase.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="mt-1 p-2 border rounded-md text-sm text-muted-foreground">
                              Cargando clases...
                            </div>
                          )}
                          {horario.hora_inicio && horario.hora_fin && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Horario: {horario.hora_inicio} - {horario.hora_fin}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor={`capacidad_${index}`} className="flex items-center gap-1">
                            Capacidad (cupos) <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id={`capacidad_${index}`}
                            type="number"
                            min="1"
                            max="50"
                            value={horario.capacidad || ''}
                            onChange={(e) => actualizarCapacidad(index, parseInt(e.target.value) || 0)}
                            className={`mt-1 w-24 ${!horario.capacidad || horario.capacidad < 1 ? 'border-destructive' : ''}`}
                            required
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Obligatorio - Define cuántos alumnos pueden reservar
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => eliminarHorario(index)}
                        className="text-destructive hover:text-destructive mt-6"
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
