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

      // Parsear la fecha manualmente para evitar problemas de zona horaria
      const fechaParts = fecha.split('T')[0].split('-').map(Number);
      const fechaObjValidacion = new Date(fechaParts[0], fechaParts[1] - 1, fechaParts[2]);
      fechaObjValidacion.setHours(0, 0, 0, 0);
      const diaSemana = fechaObjValidacion.getDay();
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

      // Si es día hábil feriado, cancelar turnos
      // Para nuevos feriados siempre cancelar, para editados solo si aún no se cancelaron
      if (tipo === 'dia_habil_feriado' && (!editandoFeriado || !editandoFeriado.turnos_cancelados)) {
        console.log('📌 [FERIADO] Llamando a cancelarTurnosDia con:', { fecha, feriadoId, horariosPersonalizados: horariosPersonalizados.length });
        try {
          await cancelarTurnosDia(fecha, feriadoId, horariosPersonalizados);
          console.log('✅ [FERIADO] cancelarTurnosDia completado');
        } catch (cancelacionError) {
          console.error('❌ [FERIADO] Error en cancelarTurnosDia:', cancelacionError);
          // No lanzar error aquí para que el feriado se guarde, pero loguear el error
        }
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

  const cancelarTurnosDia = async (fechaStr: string, feriadoIdParam?: string, horariosPersonalizadosParam?: HorarioPersonalizado[]) => {
    try {
      console.log('🚀 [FERIADO] Iniciando cancelación de turnos para:', fechaStr);
      console.log('📋 [FERIADO] Parámetros recibidos:', { feriadoIdParam, horariosPersonalizadosParam: horariosPersonalizadosParam?.length || 0 });
      
      // Asegurar formato correcto de fecha (YYYY-MM-DD)
      const fechaFormateada = fechaStr.split('T')[0]; // En caso de que venga con hora
      console.log('📅 [FERIADO] Fecha formateada:', fechaFormateada);
      
      // Parsear la fecha manualmente para evitar problemas de zona horaria
      const [year, month, day] = fechaFormateada.split('-').map(Number);
      const fechaObj = new Date(year, month - 1, day); // month - 1 porque Date usa 0-11 para meses
      fechaObj.setHours(0, 0, 0, 0); // Normalizar a medianoche
      
      const diaSemana = fechaObj.getDay(); // 0=domingo, 6=sábado
      const diaSemanaDB = diaSemana === 0 ? 7 : diaSemana; // Convertir a formato DB (1=lunes, 7=domingo)
      
      const nombresDias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      console.log('📆 [FERIADO] Día de la semana:', { 
        diaSemana, 
        diaSemanaDB, 
        nombreDia: nombresDias[diaSemana],
        fecha: fechaObj.toISOString(),
        fechaLocal: fechaObj.toLocaleDateString('es-ES')
      });

      // Si no se pasaron los parámetros, intentar obtener el feriado de la base de datos
      let feriadoId = feriadoIdParam;
      let horariosPersonalizados = horariosPersonalizadosParam || [];

      if (!feriadoId || !horariosPersonalizadosParam) {
        const { data: feriadoData } = await supabase
          .from('feriados')
          .select('id, horarios_personalizados')
          .eq('fecha', fechaFormateada) // Usar fecha formateada
          .eq('tipo', 'dia_habil_feriado')
          .eq('activo', true)
          .maybeSingle();

        if (feriadoData) {
          feriadoId = feriadoId || feriadoData.id;
          horariosPersonalizados = horariosPersonalizadosParam || (feriadoData.horarios_personalizados || []);
        } else {
          console.log('⚠️ [FERIADO] No se encontró el feriado en la base de datos con fecha:', fechaFormateada);
        }
      }

      console.log('📅 [FERIADO] Feriado:', { feriadoId, horariosPersonalizados: horariosPersonalizados.length });

      // 1. Obtener horarios recurrentes activos para este día de la semana
      console.log('🔍 [FERIADO] Buscando horarios recurrentes para día_semana:', diaSemanaDB);
      const { data: horariosRecurrentes, error: errorHorariosRecurrentes } = await supabase
        .from('horarios_recurrentes_usuario')
        .select('id, usuario_id, hora_inicio, hora_fin, dia_semana')
        .eq('dia_semana', diaSemanaDB)
        .eq('activo', true);

      if (errorHorariosRecurrentes) {
        console.error('❌ [FERIADO] Error obteniendo horarios recurrentes:', errorHorariosRecurrentes);
        throw errorHorariosRecurrentes; // Lanzar error para que se capture en el try-catch
      } else {
        console.log('📋 [FERIADO] Horarios recurrentes encontrados:', horariosRecurrentes?.length || 0);
        if (horariosRecurrentes && horariosRecurrentes.length > 0) {
          console.log('📝 [FERIADO] Muestra de horarios:', horariosRecurrentes.slice(0, 3));
        }
      }

      // 2. Crear cancelaciones para horarios recurrentes (verificar duplicados primero)
      if (horariosRecurrentes && horariosRecurrentes.length > 0) {
        // Verificar cancelaciones existentes para evitar duplicados
        const { data: cancelacionesExistentes } = await supabase
          .from('turnos_cancelados')
          .select('cliente_id, turno_hora_inicio, turno_hora_fin')
          .eq('turno_fecha', fechaFormateada) // Usar fecha formateada
          .eq('tipo_cancelacion', 'sistema');
        
        console.log('🔍 [FERIADO] Cancelaciones existentes encontradas:', cancelacionesExistentes?.length || 0);

        const cancelacionesExistentesSet = new Set(
          (cancelacionesExistentes || []).map(c => 
            `${c.cliente_id}-${c.turno_hora_inicio}-${c.turno_hora_fin}`
          )
        );

        const nuevasCancelaciones = horariosRecurrentes
          .filter(hr => {
            const clave = `${hr.usuario_id}-${hr.hora_inicio}-${hr.hora_fin}`;
            const yaExiste = cancelacionesExistentesSet.has(clave);
            if (yaExiste) {
              console.log('⚠️ [FERIADO] Cancelación ya existe para:', clave);
            }
            return !yaExiste;
          })
          .map(hr => {
            // Asegurar formato correcto de hora (HH:MM:SS)
            let horaInicio = hr.hora_inicio;
            let horaFin = hr.hora_fin;
            
            // Si viene sin segundos, agregarlos
            if (horaInicio && horaInicio.split(':').length === 2) {
              horaInicio = `${horaInicio}:00`;
            }
            if (horaFin && horaFin.split(':').length === 2) {
              horaFin = `${horaFin}:00`;
            }
            
            console.log('📝 [FERIADO] Procesando horario:', {
              usuario_id: hr.usuario_id,
              hora_inicio_original: hr.hora_inicio,
              hora_inicio_procesada: horaInicio,
              hora_fin_original: hr.hora_fin,
              hora_fin_procesada: horaFin,
              dia_semana: hr.dia_semana
            });
            
            return {
              cliente_id: hr.usuario_id,
              turno_fecha: fechaFormateada, // Usar fecha formateada
              turno_hora_inicio: horaInicio,
              turno_hora_fin: horaFin,
              tipo_cancelacion: 'sistema',
              motivo_cancelacion: 'Día feriado',
              cancelacion_tardia: false
            };
          });

        if (nuevasCancelaciones.length > 0) {
          console.log('➕ [FERIADO] Creando', nuevasCancelaciones.length, 'cancelaciones para horarios recurrentes');
          const detallesCancelaciones = nuevasCancelaciones.slice(0, 5).map(c => ({
            cliente_id: c.cliente_id,
            turno_fecha: c.turno_fecha,
            turno_hora_inicio: c.turno_hora_inicio,
            turno_hora_fin: c.turno_hora_fin,
            tipo_cancelacion: c.tipo_cancelacion
          }));
          console.log('📝 [FERIADO] Detalle completo de cancelaciones a crear (primeras 5):', detallesCancelaciones);
          const { data: cancelacionesInsertadas, error: errorCancelacionesRecurrentes } = await supabase
            .from('turnos_cancelados')
            .insert(nuevasCancelaciones)
            .select('id, cliente_id, turno_fecha, turno_hora_inicio, turno_hora_fin, tipo_cancelacion');

          if (errorCancelacionesRecurrentes) {
            console.error('❌ [FERIADO] Error creando cancelaciones recurrentes:', errorCancelacionesRecurrentes);
            console.error('❌ [FERIADO] Detalles completos del error:', JSON.stringify(errorCancelacionesRecurrentes, null, 2));
            throw errorCancelacionesRecurrentes; // Lanzar error
          } else {
            console.log('✅ [FERIADO] Cancelaciones recurrentes creadas exitosamente:', cancelacionesInsertadas?.length || 0);
            if (cancelacionesInsertadas && cancelacionesInsertadas.length > 0) {
              const detallesInsertadas = cancelacionesInsertadas.slice(0, 5).map(c => ({
                id: c.id,
                cliente_id: c.cliente_id,
                turno_fecha: c.turno_fecha,
                turno_hora_inicio: c.turno_hora_inicio,
                turno_hora_fin: c.turno_hora_fin,
                tipo_cancelacion: c.tipo_cancelacion
              }));
              console.log('📋 [FERIADO] Cancelaciones insertadas (primeras 5):', detallesInsertadas);
            } else {
              console.warn('⚠️ [FERIADO] No se devolvieron cancelaciones insertadas en el SELECT (pero insert podría haber funcionado)');
            }
          }
        } else {
          console.log('ℹ️ [FERIADO] No hay nuevas cancelaciones recurrentes que crear (todas ya existen)');
        }
      } else {
        console.log('⚠️ [FERIADO] No se encontraron horarios recurrentes para este día de la semana');
      }

      // 3. Cancelar turnos variables del día específico
      const { data: turnosVariables, error: errorSelect } = await supabase
        .from('turnos_variables')
        .select('id, cliente_id, turno_hora_inicio, turno_hora_fin')
        .eq('turno_fecha', fechaFormateada) // Usar fecha formateada
        .eq('estado', 'confirmada');

      if (errorSelect) {
        console.error('❌ [FERIADO] Error obteniendo turnos variables:', errorSelect);
      } else {
        console.log('📋 [FERIADO] Turnos variables encontrados:', turnosVariables?.length || 0);
      }

      if (turnosVariables && turnosVariables.length > 0) {
        // Verificar cancelaciones existentes para turnos variables
        const { data: cancelacionesVariablesExistentes } = await supabase
          .from('turnos_cancelados')
          .select('cliente_id, turno_hora_inicio, turno_hora_fin')
          .eq('turno_fecha', fechaFormateada) // Usar fecha formateada
          .eq('tipo_cancelacion', 'sistema');

        const cancelacionesVariablesSet = new Set(
          (cancelacionesVariablesExistentes || []).map(c => 
            `${c.cliente_id}-${c.turno_hora_inicio}-${c.turno_hora_fin}`
          )
        );

        const nuevasCancelacionesVariables = turnosVariables
          .filter(tv => {
            const clave = `${tv.cliente_id}-${tv.turno_hora_inicio}-${tv.turno_hora_fin}`;
            return !cancelacionesVariablesSet.has(clave);
          })
          .map(turno => ({
            cliente_id: turno.cliente_id,
            turno_fecha: fechaFormateada, // Usar fecha formateada
            turno_hora_inicio: turno.turno_hora_inicio,
            turno_hora_fin: turno.turno_hora_fin,
            tipo_cancelacion: 'sistema',
            motivo_cancelacion: 'Día feriado',
            cancelacion_tardia: false
          }));

        if (nuevasCancelacionesVariables.length > 0) {
          console.log('➕ [FERIADO] Creando', nuevasCancelacionesVariables.length, 'cancelaciones para turnos variables');
          const { error: errorCancelacionesVariables } = await supabase
            .from('turnos_cancelados')
            .insert(nuevasCancelacionesVariables);

          if (errorCancelacionesVariables) {
            console.error('❌ [FERIADO] Error creando cancelaciones variables:', errorCancelacionesVariables);
          } else {
            console.log('✅ [FERIADO] Cancelaciones variables creadas exitosamente');
          }
        }

        // Actualizar estado de turnos variables a cancelada
        const { error: errorVariables } = await supabase
          .from('turnos_variables')
          .update({ estado: 'cancelada' })
          .eq('turno_fecha', fechaFormateada) // Usar fecha formateada
          .eq('estado', 'confirmada');

        if (errorVariables) {
          console.error('❌ [FERIADO] Error cancelando turnos variables:', errorVariables);
        } else {
          console.log('✅ [FERIADO] Turnos variables actualizados a cancelada');
        }
      }

      // 4. Si hay horarios personalizados, crear turnos disponibles
      if (horariosPersonalizados.length > 0 && feriadoId) {
        console.log('⏰ [FERIADO] Creando turnos disponibles para horarios personalizados');
        
        for (const horario of horariosPersonalizados) {
          // Crear cancelación dummy (sin cliente_id) para poder crear turno disponible
          const { data: cancelacionDummy, error: errorDummy } = await supabase
            .from('turnos_cancelados')
            .insert({
              cliente_id: null,
              turno_fecha: fechaFormateada, // Usar fecha formateada
              turno_hora_inicio: horario.hora_inicio,
              turno_hora_fin: horario.hora_fin,
              tipo_cancelacion: 'sistema',
              motivo_cancelacion: 'Turno disponible desde feriado'
            })
            .select('id')
            .single();

          if (!errorDummy && cancelacionDummy) {
            // Crear turno disponible
            const { error: errorDisponible } = await supabase
              .from('turnos_disponibles')
              .insert({
                turno_fecha: fechaFormateada, // Usar fecha formateada
                turno_hora_inicio: horario.hora_inicio,
                turno_hora_fin: horario.hora_fin,
                creado_desde_cancelacion_id: cancelacionDummy.id,
                creado_desde_feriado_id: feriadoId
              });

            if (errorDisponible) {
              console.error('❌ [FERIADO] Error creando turno disponible:', errorDisponible);
            } else {
              console.log('✅ [FERIADO] Turno disponible creado:', horario);
            }
          }
        }
      }

      // 5. Marcar que los turnos fueron cancelados
      const { error: errorUpdateFeriado } = await supabase
        .from('feriados')
        .update({ turnos_cancelados: true })
        .eq('fecha', fechaFormateada) // Usar fecha formateada
        .eq('tipo', 'dia_habil_feriado');

      if (errorUpdateFeriado) {
        console.error('❌ [FERIADO] Error actualizando feriado:', errorUpdateFeriado);
      } else {
        console.log('✅ [FERIADO] Feriado marcado como turnos cancelados');
      }

      // 6. Disparar eventos para actualizar vistas (con delay para asegurar que la DB se actualizó)
      setTimeout(() => {
        console.log('📢 [FERIADO] Disparando eventos de actualización');
        window.dispatchEvent(new CustomEvent('feriados:updated'));
        window.dispatchEvent(new CustomEvent('turnosCancelados:updated'));
        window.dispatchEvent(new CustomEvent('turnosVariables:updated'));
        window.dispatchEvent(new CustomEvent('clasesDelMes:updated'));
        window.dispatchEvent(new CustomEvent('balance:refresh'));
      }, 500);

      console.log('✅ [FERIADO] Proceso de cancelación completado');
    } catch (error) {
      console.error('❌ [FERIADO] Error cancelando turnos:', error);
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
              ? `Configura el feriado para ${format(fechaSeleccionada, 'dd/MM/yyyy', { locale: es })}`
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
              Crear Feriado para {format(fechaSeleccionada, 'dd/MM/yyyy', { locale: es })}
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
                  <Button 
                    onClick={guardarFeriado} 
                    disabled={loading} 
                    className="flex-1 bg-white text-gray-900 hover:bg-gray-100 border border-gray-300"
                  >
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

