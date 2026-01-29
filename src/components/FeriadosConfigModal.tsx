import { useState, useEffect } from 'react';
import { Calendar, X, Plus, Trash2, Clock, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
        // Si hay fecha seleccionada, siempre es día hábil feriado (los fines de semana usan otro modal)
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
        const clases = data.map((h: any) => ({
          clase_numero: h.clase_numero,
          hora_inicio: h.hora_inicio.substring(0, 5), // Formato HH:MM
          hora_fin: h.hora_fin.substring(0, 5),
          nombre: `Clase ${h.clase_numero} (${h.hora_inicio.substring(0, 5)} - ${h.hora_fin.substring(0, 5)})`,
          capacidad: h.capacidad || 4 // Capacidad por defecto
        }));
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

  const seleccionarClase = (index: number, claseNumero: number) => {
    const claseSeleccionada = clasesDisponibles.find(c => c.clase_numero === claseNumero);
    if (!claseSeleccionada) return;

    const nuevos = [...horariosPersonalizados];
    // Mantener la capacidad existente (el admin debe configurarla manualmente)
    const capacidadExistente = nuevos[index]?.capacidad || 0;
    nuevos[index] = {
      hora_inicio: claseSeleccionada.hora_inicio,
      hora_fin: claseSeleccionada.hora_fin,
      clase_numero: claseNumero,
      capacidad: capacidadExistente
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
    if (!fecha) {
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
      const fechaParts = fecha.split('T')[0].split('-').map(Number);
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
        fecha,
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

      // Si es día hábil feriado, cancelar turnos
      // Para nuevos feriados siempre cancelar, para editados solo si aún no se cancelaron
      if (tipo === 'dia_habil_feriado') {
        // Si es un feriado nuevo o si aún no se cancelaron los turnos, ejecutar cancelación
        const debeCancelar = !editandoFeriado || !editandoFeriado.turnos_cancelados;
        
        if (debeCancelar) {
          console.log('📌 [FERIADO] Llamando a cancelarTurnosDia con:', { fecha, feriadoId, horariosPersonalizados: horariosPersonalizados.length });
          try {
            await cancelarTurnosDia(fecha, feriadoId, horariosPersonalizados);
            console.log('✅ [FERIADO] cancelarTurnosDia completado');
          } catch (cancelacionError) {
            console.error('❌ [FERIADO] Error en cancelarTurnosDia:', cancelacionError);
            // Mostrar error al usuario pero permitir que el feriado se guarde
            showError('El feriado se guardó, pero hubo un error al cancelar los turnos. Por favor, verifica manualmente.');
          }
        } else {
          console.log('ℹ️ [FERIADO] Los turnos ya fueron cancelados previamente, no se vuelven a cancelar');
        }
      }

      showSuccess('Feriado guardado correctamente');
      dismissToast(loadingToast);
      resetearFormulario();
      await cargarFeriados();
      // Disparar evento para actualizar CalendarView
      window.dispatchEvent(new CustomEvent('feriados:updated'));
      onFeriadoGuardado?.();
    } catch (error: any) {
      console.error('Error guardando feriado:', error);
      showError(error.message || 'Error al guardar feriado');
      if (loadingToast !== undefined) dismissToast(loadingToast);
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
        console.log('⏰ [FERIADO] Creando turnos disponibles para horarios personalizados:', horariosPersonalizados.length);
        
        for (const horario of horariosPersonalizados) {
          // Asegurar formato correcto de hora (HH:MM:SS)
          let horaInicio = horario.hora_inicio;
          let horaFin = horario.hora_fin;
          
          // Si viene sin segundos, agregarlos
          if (horaInicio && horaInicio.split(':').length === 2) {
            horaInicio = `${horaInicio}:00`;
          }
          if (horaFin && horaFin.split(':').length === 2) {
            horaFin = `${horaFin}:00`;
          }
          
          console.log('📝 [FERIADO] Procesando horario personalizado:', {
            hora_inicio_original: horario.hora_inicio,
            hora_inicio_procesada: horaInicio,
            hora_fin_original: horario.hora_fin,
            hora_fin_procesada: horaFin,
            feriadoId
          });
          
          // Verificar si ya existe un turno disponible para este horario
          const { data: turnoExistente } = await supabase
            .from('turnos_disponibles')
            .select('id')
            .eq('turno_fecha', fechaFormateada)
            .eq('turno_hora_inicio', horaInicio)
            .eq('turno_hora_fin', horaFin)
            .eq('creado_desde_feriado_id', feriadoId)
            .maybeSingle();
          
          if (turnoExistente) {
            console.log('⚠️ [FERIADO] Turno disponible ya existe para este horario:', horaInicio, '-', horaFin);
            continue;
          }
          
          // Crear turno disponible directamente (creado_desde_cancelacion_id es nullable)
          // Los turnos disponibles desde feriados no requieren cancelación previa
          const { error: errorDisponible } = await supabase
            .from('turnos_disponibles')
            .insert({
              turno_fecha: fechaFormateada, // Usar fecha formateada
              turno_hora_inicio: horaInicio,
              turno_hora_fin: horaFin,
              creado_desde_cancelacion_id: null, // Nullable, no requerido para feriados
              creado_desde_feriado_id: feriadoId
            });

          if (errorDisponible) {
            console.error('❌ [FERIADO] Error creando turno disponible:', errorDisponible);
            console.error('❌ [FERIADO] Detalles del error:', JSON.stringify(errorDisponible, null, 2));
          } else {
            console.log('✅ [FERIADO] Turno disponible creado exitosamente:', { horaInicio, horaFin, feriadoId });
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
        window.dispatchEvent(new CustomEvent('turnosDisponibles:updated'));
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
    setTipo('dia_habil_feriado'); // Este modal solo maneja días hábiles feriados
    setMotivo(feriado.motivo || '');
    
    // Intentar asociar horarios existentes con clases disponibles
    const horariosConClase = (feriado.horarios_personalizados || []).map(horario => {
      // Si ya tiene clase_numero, mantenerlo
      if (horario.clase_numero) {
        return horario;
      }
      
      // Intentar encontrar la clase que coincida con este horario
      const horaInicio = horario.hora_inicio.substring(0, 5);
      const horaFin = horario.hora_fin.substring(0, 5);
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
    
    setHorariosPersonalizados(horariosConClase);
    setMostrarFormulario(true);
  };

  // Actualizar horarios con clase_numero cuando se cargan las clases disponibles
  useEffect(() => {
    if (clasesDisponibles.length > 0 && editandoFeriado && horariosPersonalizados.length > 0) {
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
          <DialogDescription>
            {fechaSeleccionada 
              ? `Configura el feriado para ${format(fechaSeleccionada, 'dd/MM/yyyy', { locale: es })}. Este modal es solo para días hábiles (lunes a viernes).`
              : 'Visualiza y gestiona los feriados de días hábiles. Usa click derecho en un día del calendario para crear nuevos feriados.'
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
                  <Input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                  />
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
                    <Card key={index} className="p-4 mb-2">
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
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4" />
                            <span>
                              {feriado.horarios_personalizados.map(h => 
                                `${h.hora_inicio}-${h.hora_fin} (${h.capacidad} cupos)`
                              ).join(', ')}
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

