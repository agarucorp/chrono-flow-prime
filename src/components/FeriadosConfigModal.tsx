import { useState, useEffect } from 'react';
import { Calendar, X, Plus, Trash2, Clock, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/hooks/useNotifications';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { normalizeTimeToHhMm, formatClockRangeAmPm } from '@/lib/timeFormat';

/** Franjas de 1 h para el dropdown de feriados (7:00–8:00 … 20:00–21:00). No usa numeración de clase. */
const FRANJAS_FERIADO_DROPDOWN: { id: string; hora_inicio: string; hora_fin: string; label: string }[] = (() => {
  const rows: { id: string; hora_inicio: string; hora_fin: string; label: string }[] = [];
  for (let h = 7; h < 21; h++) {
    const hi = `${String(h).padStart(2, '0')}:00`;
    const hf = `${String(h + 1).padStart(2, '0')}:00`;
    rows.push({
      id: `${hi}-${hf}`,
      hora_inicio: hi,
      hora_fin: hf,
      label: formatClockRangeAmPm(hi, hf),
    });
  }
  return rows;
})();

function esFranjaFeriadoEstandar(hi: string, hf: string): boolean {
  return FRANJAS_FERIADO_DROPDOWN.some((f) => f.hora_inicio === hi && f.hora_fin === hf);
}

interface HorarioPersonalizado {
  hora_inicio: string;
  hora_fin: string;
  clase_numero?: number; // Para identificar qué clase fue seleccionada
  capacidad: number; // Capacidad OBLIGATORIA para este horario de feriado/fin de semana
}

interface ClaseDisponible {
  clase_numero: number;
  hora_inicio: string;
  hora_fin: string;
  nombre: string;
  capacidad: number; // Capacidad de la clase (de horarios_semanales)
}

interface Feriado {
  id?: string;
  fecha: string;
  tipo: 'dia_habil_feriado' | 'fin_semana_habilitado';
  motivo?: string;
  horarios_personalizados: HorarioPersonalizado[];
  activo: boolean;
  turnos_cancelados?: boolean;
}

interface FeriadosConfigModalProps {
  open: boolean;
  onClose: () => void;
  fechaSeleccionada?: Date | null;
  onFeriadoGuardado?: () => void;
}

export const FeriadosConfigModal = ({ 
  open, 
  onClose, 
  fechaSeleccionada,
  onFeriadoGuardado 
}: FeriadosConfigModalProps) => {
  const { showSuccess, showError, showLoading, dismissToast } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  // Historial de alumnos por fecha y franja horaria (para mostrar en listado de feriados)
  const [alumnosPorFeriado, setAlumnosPorFeriado] = useState<Record<string, Record<string, string[]>>>({});
  const [fechaFiltro, setFechaFiltro] = useState<string>('');

  // Estado para nuevo/editar feriado
  const [editandoFeriado, setEditandoFeriado] = useState<Feriado | null>(null);
  const [fecha, setFecha] = useState<string>('');
  const [tipo, setTipo] = useState<'dia_habil_feriado' | 'fin_semana_habilitado'>('dia_habil_feriado');
  const [motivo, setMotivo] = useState<string>('');
  const [horariosPersonalizados, setHorariosPersonalizados] = useState<HorarioPersonalizado[]>([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [clasesDisponibles, setClasesDisponibles] = useState<ClaseDisponible[]>([]);

  useEffect(() => {
    if (open) {
      cargarFeriados();
      cargarClasesDisponibles();
      if (fechaSeleccionada) {
        const fechaStr = format(fechaSeleccionada, 'yyyy-MM-dd');
        setFecha(fechaStr);
        // Si hay fecha seleccionada, este modal se usa solo para días hábiles.
        setTipo('dia_habil_feriado');
        setMostrarFormulario(true);
      } else {
        setMostrarFormulario(false);
      }
    } else {
      resetearFormulario();
    }
  }, [open, fechaSeleccionada]);

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
        const clases = data.map((h: any) => {
          const hi = normalizeTimeToHhMm(h.hora_inicio);
          const hf = normalizeTimeToHhMm(h.hora_fin);
          return {
            clase_numero: h.clase_numero,
            hora_inicio: hi,
            hora_fin: hf,
            nombre: `Clase ${h.clase_numero} (${formatClockRangeAmPm(hi, hf)})`,
            capacidad: h.capacidad || 4,
          };
        });
        setClasesDisponibles(clases);
      }
    } catch (error) {
      console.error('Error inesperado cargando clases:', error);
    }
  };

  const resetearFormulario = () => {
    setEditandoFeriado(null);
    setFecha('');
    setTipo('dia_habil_feriado');
    setMotivo('');
    setHorariosPersonalizados([]);
    setMostrarFormulario(false);
  };

  const cargarFeriados = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('feriados')
        .select('*')
        .eq('tipo', 'dia_habil_feriado') // Solo días hábiles feriados en este modal
        .order('fecha', { ascending: false });

      // Si hay fecha seleccionada, filtrar por esa fecha
      if (fechaSeleccionada) {
        const fechaStr = format(fechaSeleccionada, 'yyyy-MM-dd');
        query = query.eq('fecha', fechaStr);
      } else {
        // Si no hay fecha seleccionada, aplicar filtro de fecha del usuario
        if (fechaFiltro) {
          query = query.eq('fecha', fechaFiltro);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      const feriadosFormateados: Feriado[] = (data || []).map((f: any) => ({
        id: f.id,
        fecha: f.fecha,
        tipo: f.tipo,
        motivo: f.motivo,
        horarios_personalizados: f.horarios_personalizados || [],
        activo: f.activo,
        turnos_cancelados: f.turnos_cancelados || false,
      }));

      setFeriados(feriadosFormateados);

      // Cargar historial de alumnos por cada feriado listado (confirmada/completada)
      const fechasFeriados = Array.from(new Set(feriadosFormateados.map((f) => f.fecha)));
      if (fechasFeriados.length === 0) {
        setAlumnosPorFeriado({});
        return;
      }

      const { data: turnosVariables, error: errorTurnos } = await supabase
        .from('turnos_variables')
        .select(`
          turno_fecha,
          turno_hora_inicio,
          turno_hora_fin,
          estado,
          cliente_id,
          profiles!cliente_id(full_name, first_name, last_name, email)
        `)
        .in('turno_fecha', fechasFeriados)
        .in('estado', ['confirmada', 'completada']);

      if (errorTurnos) {
        console.error('Error cargando historial de alumnos por feriado:', errorTurnos);
        setAlumnosPorFeriado({});
        return;
      }

      const getNombreAlumno = (profile: any) => {
        if (!profile) return 'Alumno';
        const fullName = (profile.full_name || '').toString().trim();
        if (fullName) return fullName;
        const combined = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
        if (combined) return combined;
        return (profile.email || 'Alumno').toString();
      };

      const historial = (turnosVariables || []).reduce<Record<string, Record<string, string[]>>>((acc, t: any) => {
        const fechaKey = t.turno_fecha;
        const slotKey = `${normalizeTimeToHhMm(t.turno_hora_inicio)}-${normalizeTimeToHhMm(t.turno_hora_fin)}`;
        const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
        const nombre = getNombreAlumno(profile);

        if (!acc[fechaKey]) acc[fechaKey] = {};
        if (!acc[fechaKey][slotKey]) acc[fechaKey][slotKey] = [];
        if (!acc[fechaKey][slotKey].includes(nombre)) {
          acc[fechaKey][slotKey].push(nombre);
        }
        return acc;
      }, {});

      setAlumnosPorFeriado(historial);
    } catch (error: any) {
      console.error('Error cargando feriados:', error);
      showError('Error al cargar feriados');
    } finally {
      setLoading(false);
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

  /** Solo modal feriados: franjas 7:00–21:00 (sin numeración de clase). */
  const seleccionarFranjaFeriado = (index: number, value: string) => {
    const m = value.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    if (!m) return;

    const nuevos = [...horariosPersonalizados];
    const capacidadExistente = nuevos[index]?.capacidad || 0;
    nuevos[index] = {
      hora_inicio: m[1],
      hora_fin: m[2],
      clase_numero: undefined,
      capacidad: capacidadExistente,
    };
    setHorariosPersonalizados(nuevos);
  };

  const actualizarCapacidad = (index: number, capacidad: number) => {
    const nuevos = [...horariosPersonalizados];
    nuevos[index] = {
      ...nuevos[index],
      capacidad: Math.max(1, capacidad) // Mínimo 1
    };
    setHorariosPersonalizados(nuevos);
  };

  const guardarFeriado = async () => {
    const fechaObjetivo = fechaSeleccionada
      ? format(fechaSeleccionada, 'yyyy-MM-dd')
      : fecha;

    if (!fechaObjetivo) {
      showError('Debes seleccionar una fecha');
      return;
    }

    // Validar que todos los horarios tengan capacidad configurada
    if (horariosPersonalizados.length > 0) {
      const sinCapacidad = horariosPersonalizados.some(h => !h.capacidad || h.capacidad < 1);
      if (sinCapacidad) {
        showError('Debes configurar la capacidad para todos los horarios');
        return;
      }
    }

    let loadingToast: string | number | undefined;
    try {
      setLoading(true);
      loadingToast = showLoading('Guardando feriado...');

      // Parsear la fecha manualmente para evitar problemas de zona horaria
      const fechaParts = fechaObjetivo.split('T')[0].split('-').map(Number);
      const fechaObjValidacion = new Date(fechaParts[0], fechaParts[1] - 1, fechaParts[2]);
      fechaObjValidacion.setHours(0, 0, 0, 0);
      const diaSemana = fechaObjValidacion.getDay();
      const esFinSemana = diaSemana === 0 || diaSemana === 6;

      // Este modal solo maneja días hábiles - validar que no sea fin de semana
      if (esFinSemana) {
        showError('Este modal es solo para días hábiles. Para habilitar un fin de semana, usa click derecho sobre un sábado o domingo.');
        dismissToast(loadingToast);
        setLoading(false);
        return;
      }

      const datosFeriado: any = {
        fecha: fechaObjetivo,
        tipo: 'dia_habil_feriado', // Siempre día hábil feriado en este modal
        motivo: motivo || null,
        horarios_personalizados: horariosPersonalizados.length > 0 ? horariosPersonalizados : null,
        activo: true,
        turnos_cancelados: false,
      };

      let feriadoId: string | undefined;
      let error;
      if (editandoFeriado?.id) {
        // Actualizar
        const { error: updateError } = await supabase
          .from('feriados')
          .update(datosFeriado)
          .eq('id', editandoFeriado.id);
        error = updateError;
        feriadoId = editandoFeriado.id;
      } else {
        // Crear - obtener el ID del feriado creado
        const { data: insertData, error: insertError } = await supabase
          .from('feriados')
          .insert(datosFeriado)
          .select('id')
          .single();
        error = insertError;
        feriadoId = insertData?.id;
      }

      if (error) throw error;

      // Las clases del plan de ese día quedan dadas de baja por el feriado en sí,
      // pero las vacantes ya reservadas hay que liberarlas para que la grilla nueva
      // arranque vacía.
      if (feriadoId) {
        const { error: aplicarError } = await supabase.rpc('fn_admin_aplicar_feriado', {
          p_feriado_id: feriadoId,
        });
        if (aplicarError) {
          showError('El feriado se guardó, pero no se pudieron liberar las reservas del día.');
        }
      }

      showSuccess('Feriado guardado correctamente');
      dismissToast(loadingToast);
      resetearFormulario();
      await cargarFeriados();
      notificarCambioFeriado();
      onFeriadoGuardado?.();
    } catch (error: any) {
      console.error('Error guardando feriado:', error);
      showError(error.message || 'Error al guardar feriado');
      if (loadingToast !== undefined) dismissToast(loadingToast);
    } finally {
      setLoading(false);
    }
  };

  const notificarCambioFeriado = () => {
    window.dispatchEvent(new CustomEvent('feriados:updated'));
    window.dispatchEvent(new CustomEvent('clasesDelMes:updated'));
    window.dispatchEvent(new CustomEvent('balance:refresh'));
  };


  const eliminarFeriado = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este feriado?')) {
      return;
    }

    try {
      setLoading(true);

      // Primero devolver las reservas que el feriado había liberado, porque
      // después de borrar la fila ya no hay forma de saber cuáles eran.
      const { error: revertirError } = await supabase.rpc('fn_admin_revertir_feriado', {
        p_feriado_id: id,
      });
      if (revertirError) throw revertirError;

      const { error } = await supabase
        .from('feriados')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showSuccess('Feriado eliminado correctamente');
      await cargarFeriados();
      notificarCambioFeriado();
      onFeriadoGuardado?.();
    } catch (error: any) {
      console.error('Error eliminando feriado:', error);
      showError('Error al eliminar feriado');
    } finally {
      setLoading(false);
    }
  };

  const editarFeriado = (feriado: Feriado) => {
    setEditandoFeriado(feriado);
    setFecha(feriado.fecha);
    setTipo('dia_habil_feriado'); // Este modal solo maneja días hábiles feriados
    setMotivo(feriado.motivo || '');
    
    // Intentar asociar horarios existentes con clases disponibles
    const horariosConClase = (feriado.horarios_personalizados || []).map((horario) => {
      const horaInicio = normalizeTimeToHhMm(horario.hora_inicio);
      const horaFin = normalizeTimeToHhMm(horario.hora_fin);
      // Franjas estándar del dropdown: no asociar a clase_numero del gimnasio
      if (esFranjaFeriadoEstandar(horaInicio, horaFin)) {
        return { ...horario, hora_inicio: horaInicio, hora_fin: horaFin, clase_numero: undefined };
      }
      if (horario.clase_numero) {
        return horario;
      }
      const claseEncontrada = clasesDisponibles.find(
        (c) => c.hora_inicio === horaInicio && c.hora_fin === horaFin
      );
      if (claseEncontrada) {
        return { ...horario, clase_numero: claseEncontrada.clase_numero };
      }
      return horario;
    });
    
    setHorariosPersonalizados(horariosConClase);
    setMostrarFormulario(true);
  };

  // Actualizar horarios con clase_numero cuando se cargan las clases disponibles
  useEffect(() => {
    if (clasesDisponibles.length > 0 && editandoFeriado && horariosPersonalizados.length > 0) {
      const horariosConClase = horariosPersonalizados.map((horario) => {
        const horaInicio = normalizeTimeToHhMm(horario.hora_inicio);
        const horaFin = normalizeTimeToHhMm(horario.hora_fin);
        if (esFranjaFeriadoEstandar(horaInicio, horaFin)) {
          return { ...horario, clase_numero: undefined };
        }
        if (horario.clase_numero) {
          return horario;
        }
        const claseEncontrada = clasesDisponibles.find(
          (c) => c.hora_inicio === horaInicio && c.hora_fin === horaFin
        );
        if (claseEncontrada) {
          return { ...horario, clase_numero: claseEncontrada.clase_numero };
        }
        return horario;
      });
      
      // Solo actualizar si hay cambios
      const hayCambios = horariosConClase.some((h, i) => h.clase_numero !== horariosPersonalizados[i]?.clase_numero);
      if (hayCambios) {
        setHorariosPersonalizados(horariosConClase);
      }
    }
  }, [clasesDisponibles]);

  // Aplicar filtros automáticamente cuando cambian
  useEffect(() => {
    if (!fechaSeleccionada && open) {
      cargarFeriados();
    }
  }, [fechaFiltro]);

  const feriadosFiltrados = feriados.filter(f => {
    if (fechaFiltro && f.fecha !== fechaFiltro) return false;
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {fechaSeleccionada ? 'Configurar feriado' : 'Gestionar feriados'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filtros - Solo visibles cuando NO hay fecha seleccionada (modo gestión) */}
          {!fechaSeleccionada && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block">Filtrar por fecha</Label>
                    <Input
                      type="date"
                      value={fechaFiltro}
                      onChange={(e) => {
                        setFechaFiltro(e.target.value);
                      }}
                      placeholder="Seleccionar fecha"
                      className="w-full"
                    />
                  </div>
                  {fechaFiltro && (
                    <Button 
                      onClick={() => {
                        setFechaFiltro('');
                      }} 
                      variant="ghost" 
                      size="sm"
                      className="w-full"
                    >
                      Limpiar Filtro
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Botón para nuevo feriado - Solo visible si hay fecha seleccionada (click derecho) y NO en modo gestión */}
          {!mostrarFormulario && fechaSeleccionada && (
            <Button onClick={() => setMostrarFormulario(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Crear feriado para {format(fechaSeleccionada, 'dd/MM/yyyy', { locale: es })}
            </Button>
          )}

          {/* Formulario de nuevo/editar feriado */}
          {mostrarFormulario && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">
                    {editandoFeriado ? 'Editar feriado' : 'Nuevo feriado'}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetearFormulario}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div>
                  <Label>Fecha</Label>
                  {fechaSeleccionada ? (
                    <div className="mt-2 px-3 py-2 rounded-md border bg-muted text-sm">
                      {format(fechaSeleccionada, 'dd/MM/yyyy', { locale: es })}
                    </div>
                  ) : (
                    <Input
                      type="date"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      required
                    />
                  )}
                </div>

                <div>
                  <Label>Motivo (opcional)</Label>
                  <Input
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ej: Día de la Independencia"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Horarios Personalizados (opcional)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={agregarHorario}
                      className="bg-white text-gray-900 hover:bg-gray-100 border border-white"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar
                    </Button>
                  </div>
                  {tipo === 'dia_habil_feriado' && (
                    <div className="mb-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded text-sm text-amber-800 dark:text-amber-200">
                      <AlertCircle className="h-4 w-4 inline mr-1" />
                      Día hábil: si no agregas horarios, el día se cierra completo y se cancelan todos los turnos.
                    </div>
                  )}
                  {horariosPersonalizados.length === 0 && (
                    <p className="text-sm text-muted-foreground mb-2">
                      Sin horarios personalizados. {tipo === 'dia_habil_feriado' ? 'El día estará cerrado.' : 'El día estará cerrado.'}
                    </p>
                  )}
                  {horariosPersonalizados.map((horario, index) => (
                    <Card key={index} className="p-4 mb-2">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 space-y-3">
                          <div>
                            <Label htmlFor={`franja_${index}`}>Franja horaria</Label>
                            <Select
                              value={(() => {
                                const hi = normalizeTimeToHhMm(horario.hora_inicio);
                                const hf = normalizeTimeToHhMm(horario.hora_fin);
                                if (!hi || !hf) return '';
                                return `${hi}-${hf}`;
                              })()}
                              onValueChange={(value) => seleccionarFranjaFeriado(index, value)}
                            >
                              <SelectTrigger id={`franja_${index}`} className="mt-1">
                                <SelectValue placeholder="Elegí un horario (7:00 a 21:00)" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[min(70vh,320px)]">
                                {(() => {
                                  const hi = normalizeTimeToHhMm(horario.hora_inicio);
                                  const hf = normalizeTimeToHhMm(horario.hora_fin);
                                  const slotId = hi && hf ? `${hi}-${hf}` : '';
                                  const esEstandar = slotId
                                    ? FRANJAS_FERIADO_DROPDOWN.some((f) => f.id === slotId)
                                    : false;
                                  return slotId && !esEstandar ? (
                                    <SelectItem key={`legacy-${slotId}`} value={slotId}>
                                      Horario guardado: {formatClockRangeAmPm(hi, hf)}
                                    </SelectItem>
                                  ) : null;
                                })()}
                                {FRANJAS_FERIADO_DROPDOWN.map((franja) => (
                                  <SelectItem key={franja.id} value={franja.id}>
                                    {franja.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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

              </CardContent>
            </Card>
          )}

          {/* Lista de feriados - Siempre visible para gestión */}
          <div className="space-y-2">
            <h3 className="font-semibold">
              {fechaSeleccionada ? 'Feriado del día' : 'Feriados configurados'}
            </h3>
            {loading && feriados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : feriadosFiltrados.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {fechaSeleccionada 
                  ? 'No hay feriado configurado para este día'
                  : 'No hay feriados configurados'}
              </p>
            ) : (
              feriadosFiltrados.map((feriado) => (
                <Card key={feriado.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="destructive">Feriado</Badge>
                          <span className="font-medium">
                            {(() => {
                              // Parsear la fecha manualmente para evitar problemas de zona horaria
                              const [year, month, day] = feriado.fecha.split('-').map(Number);
                              const fechaCorrecta = new Date(year, month - 1, day);
                              return format(fechaCorrecta, 'dd/MM/yyyy', { locale: es });
                            })()}
                          </span>
                          {!feriado.activo && (
                            <Badge variant="secondary">Inactivo</Badge>
                          )}
                        </div>
                        {feriado.motivo && (
                          <p className="text-sm text-muted-foreground mb-2">{feriado.motivo}</p>
                        )}
                        {feriado.horarios_personalizados && feriado.horarios_personalizados.length > 0 && (
                          <div className="space-y-2 text-sm">
                            {feriado.horarios_personalizados.map((h, idx) => {
                              const slotKey = `${normalizeTimeToHhMm(h.hora_inicio)}-${normalizeTimeToHhMm(h.hora_fin)}`;
                              const alumnos = alumnosPorFeriado[feriado.fecha]?.[slotKey] || [];
                              return (
                                <div key={`${feriado.id || feriado.fecha}-${idx}`} className="flex items-start gap-2">
                                  <Clock className="h-4 w-4 mt-0.5" />
                                  <div>
                                    <p className="font-medium">{formatClockRangeAmPm(h.hora_inicio, h.hora_fin)}</p>
                                    <p className="text-muted-foreground">
                                      {alumnos.length > 0
                                        ? `Alumnos: ${alumnos.join(', ')}`
                                        : 'Sin alumnos registrados'}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => editarFeriado(feriado)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => feriado.id && eliminarFeriado(feriado.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button onClick={onClose} variant="outline" className="bg-gray-500 text-white hover:bg-gray-600">
            Cerrar
          </Button>
          {mostrarFormulario && (
            <Button 
              onClick={guardarFeriado} 
              disabled={loading} 
              className="bg-white text-gray-900 hover:bg-gray-100"
            >
              {editandoFeriado ? 'Actualizar' : 'Guardar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

