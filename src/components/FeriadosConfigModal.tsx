import { useState, useEffect } from 'react';
import { Calendar, X, Plus, Trash2, Clock, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/hooks/useNotifications';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface HorarioPersonalizado {
  hora_inicio: string;
  hora_fin: string;
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
  const [fechaFiltro, setFechaFiltro] = useState<string>('');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'dia_habil_feriado' | 'fin_semana_habilitado'>('todos');

  // Estado para nuevo/editar feriado
  const [editandoFeriado, setEditandoFeriado] = useState<Feriado | null>(null);
  const [fecha, setFecha] = useState<string>('');
  const [tipo, setTipo] = useState<'dia_habil_feriado' | 'fin_semana_habilitado'>('dia_habil_feriado');
  const [motivo, setMotivo] = useState<string>('');
  const [horariosPersonalizados, setHorariosPersonalizados] = useState<HorarioPersonalizado[]>([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  useEffect(() => {
    if (open) {
      cargarFeriados();
      if (fechaSeleccionada) {
        const fechaStr = format(fechaSeleccionada, 'yyyy-MM-dd');
        setFecha(fechaStr);
        // Determinar tipo automáticamente según el día de la semana
        const diaSemana = fechaSeleccionada.getDay();
        if (diaSemana === 0 || diaSemana === 6) {
          setTipo('fin_semana_habilitado');
        } else {
          setTipo('dia_habil_feriado');
        }
        setMostrarFormulario(true);
      } else {
        setMostrarFormulario(false);
      }
    } else {
      resetearFormulario();
    }
  }, [open, fechaSeleccionada]);

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
        .order('fecha', { ascending: false });

      // Si hay fecha seleccionada, filtrar por esa fecha
      if (fechaSeleccionada) {
        const fechaStr = format(fechaSeleccionada, 'yyyy-MM-dd');
        query = query.eq('fecha', fechaStr);
      } else {
        // Si no hay fecha seleccionada, aplicar filtros del usuario
        if (fechaFiltro) {
          query = query.eq('fecha', fechaFiltro);
        }

        if (tipoFiltro !== 'todos') {
          query = query.eq('tipo', tipoFiltro);
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
    } catch (error: any) {
      console.error('Error cargando feriados:', error);
      showError('Error al cargar feriados');
    } finally {
      setLoading(false);
    }
  };

  const agregarHorario = () => {
    setHorariosPersonalizados([
      ...horariosPersonalizados,
      { hora_inicio: '09:00', hora_fin: '10:00' }
    ]);
  };

  const eliminarHorario = (index: number) => {
    setHorariosPersonalizados(horariosPersonalizados.filter((_, i) => i !== index));
  };

  const actualizarHorario = (index: number, campo: 'hora_inicio' | 'hora_fin', valor: string) => {
    const nuevos = [...horariosPersonalizados];
    nuevos[index][campo] = valor;
    setHorariosPersonalizados(nuevos);
  };

  const guardarFeriado = async () => {
    if (!fecha) {
      showError('Debes seleccionar una fecha');
      return;
    }

    try {
      setLoading(true);
      showLoading('Guardando feriado...');

      const diaSemana = new Date(fecha).getDay();
      const esFinSemana = diaSemana === 0 || diaSemana === 6;

      // Validar que el tipo coincida con el día
      if (esFinSemana && tipo === 'dia_habil_feriado') {
        showError('No puedes marcar un fin de semana como día hábil feriado. Usa "Fin de semana habilitado"');
        dismissToast();
        setLoading(false);
        return;
      }

      if (!esFinSemana && tipo === 'fin_semana_habilitado') {
        showError('Solo puedes habilitar fines de semana (sábados y domingos)');
        dismissToast();
        setLoading(false);
        return;
      }

      const datosFeriado: any = {
        fecha,
        tipo,
        motivo: motivo || null,
        horarios_personalizados: horariosPersonalizados.length > 0 ? horariosPersonalizados : null,
        activo: true,
        turnos_cancelados: false,
      };

      let error;
      if (editandoFeriado?.id) {
        // Actualizar
        const { error: updateError } = await supabase
          .from('feriados')
          .update(datosFeriado)
          .eq('id', editandoFeriado.id);
        error = updateError;
      } else {
        // Crear
        const { error: insertError } = await supabase
          .from('feriados')
          .insert(datosFeriado);
        error = insertError;
      }

      if (error) throw error;

      // Si es día hábil feriado, cancelar turnos
      if (tipo === 'dia_habil_feriado' && !editandoFeriado?.turnos_cancelados) {
        await cancelarTurnosDia(fecha);
      }

      showSuccess('Feriado guardado correctamente');
      dismissToast();
      resetearFormulario();
      await cargarFeriados();
      // Disparar evento para actualizar CalendarView
      window.dispatchEvent(new CustomEvent('feriados:updated'));
      onFeriadoGuardado?.();
    } catch (error: any) {
      console.error('Error guardando feriado:', error);
      showError(error.message || 'Error al guardar feriado');
      dismissToast();
    } finally {
      setLoading(false);
    }
  };

  const cancelarTurnosDia = async (fechaStr: string) => {
    try {
      const fechaObj = new Date(fechaStr);
      const diaSemana = fechaObj.getDay(); // 0=domingo, 6=sábado
      const diaSemanaDB = diaSemana === 0 ? 7 : diaSemana; // Convertir a formato DB (1=lunes, 7=domingo)

      // Cancelar turnos recurrentes del día específico
      const { error: errorRecurrentes } = await supabase
        .from('horarios_recurrentes_usuario')
        .update({ activo: false })
        .eq('dia_semana', diaSemanaDB)
        .eq('activo', true);

      if (errorRecurrentes) {
        console.error('Error cancelando turnos recurrentes:', errorRecurrentes);
      }

      // Cancelar turnos variables del día específico y crear registros en turnos_cancelados
      const { data: turnosVariables, error: errorSelect } = await supabase
        .from('turnos_variables')
        .select('id, cliente_id, turno_hora_inicio, turno_hora_fin')
        .eq('turno_fecha', fechaStr)
        .eq('estado', 'confirmada');

      if (errorSelect) {
        console.error('Error obteniendo turnos variables:', errorSelect);
      } else if (turnosVariables && turnosVariables.length > 0) {
        // Crear registros en turnos_cancelados para cada turno cancelado
        const cancelaciones = turnosVariables.map(turno => ({
          cliente_id: turno.cliente_id,
          turno_fecha: fechaStr,
          turno_hora_inicio: turno.turno_hora_inicio,
          turno_hora_fin: turno.turno_hora_fin,
          tipo_cancelacion: 'sistema',
          cancelacion_tardia: false
        }));

        const { error: errorCancelaciones } = await supabase
          .from('turnos_cancelados')
          .insert(cancelaciones);

        if (errorCancelaciones) {
          console.error('Error creando registros de cancelación:', errorCancelaciones);
        }

        // Actualizar estado de turnos variables a cancelada
        const { error: errorVariables } = await supabase
          .from('turnos_variables')
          .update({ estado: 'cancelada' })
          .eq('turno_fecha', fechaStr)
          .eq('estado', 'confirmada');

        if (errorVariables) {
          console.error('Error cancelando turnos variables:', errorVariables);
        }
      }

      // Marcar que los turnos fueron cancelados
      await supabase
        .from('feriados')
        .update({ turnos_cancelados: true })
        .eq('fecha', fechaStr)
        .eq('tipo', 'dia_habil_feriado');

      // Disparar evento para actualizar la vista
      window.dispatchEvent(new CustomEvent('feriados:updated'));
    } catch (error) {
      console.error('Error cancelando turnos:', error);
    }
  };

  const eliminarFeriado = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este feriado?')) {
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('feriados')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showSuccess('Feriado eliminado correctamente');
      await cargarFeriados();
      // Disparar evento para actualizar CalendarView
      window.dispatchEvent(new CustomEvent('feriados:updated'));
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
    setTipo(feriado.tipo);
    setMotivo(feriado.motivo || '');
    setHorariosPersonalizados(feriado.horarios_personalizados || []);
    setMostrarFormulario(true);
  };

  // Aplicar filtros automáticamente cuando cambian
  useEffect(() => {
    if (!fechaSeleccionada && open) {
      cargarFeriados();
    }
  }, [fechaFiltro, tipoFiltro]);

  const feriadosFiltrados = feriados.filter(f => {
    if (fechaFiltro && f.fecha !== fechaFiltro) return false;
    if (tipoFiltro !== 'todos' && f.tipo !== tipoFiltro) return false;
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {fechaSeleccionada ? 'Configurar Feriado' : 'Gestionar Feriados'}
          </DialogTitle>
          <DialogDescription>
            {fechaSeleccionada 
              ? `Configura el feriado para ${format(new Date(fechaSeleccionada), 'dd/MM/yyyy', { locale: es })}`
              : 'Visualiza y gestiona todos los feriados configurados. Usa click derecho en un día del calendario para crear nuevos feriados.'
            }
          </DialogDescription>
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
                  <div>
                    <Label className="mb-2 block">Filtrar por tipo</Label>
                    <Select value={tipoFiltro} onValueChange={(v: any) => {
                      setTipoFiltro(v);
                    }}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos los tipos</SelectItem>
                        <SelectItem value="dia_habil_feriado">Día hábil feriado</SelectItem>
                        <SelectItem value="fin_semana_habilitado">Fin de semana habilitado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(fechaFiltro || tipoFiltro !== 'todos') && (
                    <Button 
                      onClick={() => {
                        setFechaFiltro('');
                        setTipoFiltro('todos');
                      }} 
                      variant="ghost" 
                      size="sm"
                      className="w-full"
                    >
                      Limpiar Filtros
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
              Crear Feriado para {format(new Date(fechaSeleccionada), 'dd/MM/yyyy', { locale: es })}
            </Button>
          )}

          {/* Formulario de nuevo/editar feriado */}
          {mostrarFormulario && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">
                    {editandoFeriado ? 'Editar Feriado' : 'Nuevo Feriado'}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetearFormulario}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Fecha</Label>
                    <Input
                      type="date"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label>Tipo</Label>
                    <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dia_habil_feriado">Día hábil feriado</SelectItem>
                        <SelectItem value="fin_semana_habilitado">Fin de semana habilitado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Motivo (opcional)</Label>
                  <Textarea
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
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar
                    </Button>
                  </div>
                  {tipo === 'dia_habil_feriado' && (
                    <div className="mb-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded text-sm text-amber-800 dark:text-amber-200">
                      <AlertCircle className="h-4 w-4 inline mr-1" />
                      Si no agregas horarios, el día estará completamente cerrado y se cancelarán todos los turnos.
                    </div>
                  )}
                  {horariosPersonalizados.length === 0 && (
                    <p className="text-sm text-muted-foreground mb-2">
                      Sin horarios personalizados. {tipo === 'dia_habil_feriado' ? 'El día estará cerrado.' : 'El día estará cerrado.'}
                    </p>
                  )}
                  {horariosPersonalizados.map((horario, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <Input
                        type="time"
                        value={horario.hora_inicio}
                        onChange={(e) => actualizarHorario(index, 'hora_inicio', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="time"
                        value={horario.hora_fin}
                        onChange={(e) => actualizarHorario(index, 'hora_fin', e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => eliminarHorario(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button onClick={guardarFeriado} disabled={loading} className="flex-1">
                    {editandoFeriado ? 'Actualizar' : 'Guardar'}
                  </Button>
                  <Button onClick={resetearFormulario} variant="outline">
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de feriados - Siempre visible para gestión */}
          <div className="space-y-2">
            <h3 className="font-semibold">
              {fechaSeleccionada ? 'Feriado del Día' : 'Feriados Configurados'}
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
                          <Badge variant={feriado.tipo === 'dia_habil_feriado' ? 'destructive' : 'default'}>
                            {feriado.tipo === 'dia_habil_feriado' ? 'Día hábil feriado' : 'Fin de semana habilitado'}
                          </Badge>
                          <span className="font-medium">
                            {format(new Date(feriado.fecha), 'dd/MM/yyyy', { locale: es })}
                          </span>
                          {!feriado.activo && (
                            <Badge variant="secondary">Inactivo</Badge>
                          )}
                        </div>
                        {feriado.motivo && (
                          <p className="text-sm text-muted-foreground mb-2">{feriado.motivo}</p>
                        )}
                        {feriado.horarios_personalizados && feriado.horarios_personalizados.length > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4" />
                            <span>
                              {feriado.horarios_personalizados.map(h => `${h.hora_inicio}-${h.hora_fin}`).join(', ')}
                            </span>
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

        <DialogFooter>
          {fechaSeleccionada && mostrarFormulario && (
            <Button onClick={resetearFormulario} variant="outline">
              Cancelar
            </Button>
          )}
          <Button onClick={onClose} variant="outline">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

