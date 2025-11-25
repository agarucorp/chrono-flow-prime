import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Users, X, Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/hooks/useNotifications';
import { useSystemConfig } from '@/hooks/useSystemConfig';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CancelacionConfirmationModal } from './CancelacionConfirmationModal';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';

interface Turno {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: 'disponible' | 'ocupado' | 'cancelado';
  cliente_id?: string;
  cliente_nombre?: string;
  profesional_id?: string;
  profesional_nombre?: string;
  servicio?: string;
  max_alumnos?: number;
}

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  tipo?: string;
  cancelado?: boolean;
}

interface AdminTurnoModalProps {
  turno: Turno | null;
  isOpen: boolean;
  onClose: () => void;
  onTurnoUpdated: () => void;
}

export const AdminTurnoModal = ({ turno, isOpen, onClose, onTurnoUpdated }: AdminTurnoModalProps) => {
  const { showSuccess, showError, showLoading, dismissToast } = useNotifications();
  const { obtenerCapacidadActual } = useSystemConfig();

  const [clientes, setClientes] = useState<AdminUser[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientesReservados, setClientesReservados] = useState<AdminUser[]>([]);
  const [capacidadDisponible, setCapacidadDisponible] = useState(0);


  // Estado para el modal de confirmación de cancelación
  const [showCancelacionModal, setShowCancelacionModal] = useState(false);
  const [turnoToCancel, setTurnoToCancel] = useState<{ clienteId: string, clienteNombre: string } | null>(null);
  const [cancelingTurno, setCancelingTurno] = useState(false);

  // Cargar clientes disponibles y reservas existentes
  useEffect(() => {
    if (isOpen) {
      cargarClientes();
      cargarReservasExistentes();
    }
  }, [isOpen, turno]);

  const cargarClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('role', 'client')
        .order('full_name');

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Error cargando clientes:', error);
      showError('Error', 'No se pudieron cargar los clientes');
    }
  };

  const cargarReservasExistentes = async () => {
    if (!turno) return;

    try {
      // 1. Buscar reservas normales en turnos
      const { data: reservasNormales, error: errorNormales } = await supabase
        .from('turnos')
        .select(`
          cliente_id,
          profiles:cliente_id(id, full_name, email)
        `)
        .eq('fecha', turno.fecha)
        .eq('hora_inicio', turno.hora_inicio)
        .eq('hora_fin', turno.hora_fin)
        .not('cliente_id', 'is', null);

      if (errorNormales) {
        console.error('Error cargando reservas normales:', errorNormales);
      }

      // 2. Buscar reservas en reservas_turnos (reservas creadas desde el panel admin)
      const { data: reservasTurnos, error: errorReservasTurnos } = await supabase
        .from('reservas_turnos')
        .select(`
          cliente_id,
          estado,
          turno_id,
          profiles:cliente_id(id, full_name, email)
        `)
        .eq('turno_id', turno.id)
        .eq('estado', 'confirmada');

      if (errorReservasTurnos) {
        console.error('Error cargando reservas_turnos:', errorReservasTurnos);
      }

      // 3. Buscar turnos variables que coincidan con este horario
      const { data: turnosVariables, error: errorVariables } = await supabase
        .from('turnos_variables')
        .select(`
          cliente_id,
          estado,
          profiles:cliente_id(id, full_name, email)
        `)
        .eq('turno_fecha', turno.fecha)
        .eq('turno_hora_inicio', turno.hora_inicio)
        .eq('turno_hora_fin', turno.hora_fin)
        .eq('estado', 'confirmada');

      if (errorVariables) {
        console.error('Error cargando turnos variables:', errorVariables);
      }

      // 4. Buscar turnos cancelados para este horario
      const { data: turnosCancelados, error: errorCancelados } = await supabase
        .from('turnos_cancelados')
        .select(`
          cliente_id,
          profiles:cliente_id(id, full_name, email)
        `)
        .eq('turno_fecha', turno.fecha)
        .eq('turno_hora_inicio', turno.hora_inicio)
        .eq('turno_hora_fin', turno.hora_fin);

      if (errorCancelados) {
        console.error('Error cargando turnos cancelados:', errorCancelados);
      }

      // 5. Crear un Set de IDs de clientes cancelados para verificar duplicados
      const clientesCanceladosIds = new Set((turnosCancelados || []).map((tc: any) => tc.cliente_id));

      // 6. Combinar todas las listas, marcando los cancelados
      const clientesReservadosNormales = (reservasNormales || []).map((reserva: any) => ({
        id: reserva.profiles.id,
        full_name: reserva.profiles.full_name,
        email: reserva.profiles.email,
        role: 'client',
        tipo: 'normal',
        cancelado: false
      }));

      const clientesReservadosTurnos = (reservasTurnos || []).map((reserva: any) => ({
        id: reserva.profiles.id,
        full_name: reserva.profiles.full_name,
        email: reserva.profiles.email,
        role: 'client',
        tipo: 'reserva_turno',
        cancelado: clientesCanceladosIds.has(reserva.profiles.id)
      }));

      const clientesReservadosVariables = (turnosVariables || []).map((turno: any) => ({
        id: turno.profiles.id,
        full_name: turno.profiles.full_name,
        email: turno.profiles.email,
        role: 'client',
        tipo: 'variable',
        cancelado: clientesCanceladosIds.has(turno.profiles.id)
      }));

      const clientesCancelados = (turnosCancelados || []).map((cancelado: any) => {
        const profile = Array.isArray(cancelado.profiles) ? cancelado.profiles[0] : cancelado.profiles;
        return {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          role: 'client',
          tipo: 'cancelado',
          cancelado: true
        };
      }).filter((cliente: any) => 
        // Solo incluir cancelados que no estén ya en las otras listas
        !clientesReservadosNormales.some(c => c.id === cliente.id) &&
        !clientesReservadosTurnos.some(c => c.id === cliente.id) &&
        !clientesReservadosVariables.some(c => c.id === cliente.id)
      );

      // Combinar todas las listas
      const todosLosClientes = [
        ...clientesReservadosNormales,
        ...clientesReservadosTurnos,
        ...clientesReservadosVariables,
        ...clientesCancelados
      ];

      setClientesReservados(todosLosClientes);

      // Calcular capacidad disponible usando capacidad global
      // Solo contar clientes activos (no cancelados)
      const clientesActivos = todosLosClientes.filter(c => !c.cancelado);
      const maxAlumnos = obtenerCapacidadActual() || 4;
      setCapacidadDisponible(Math.max(0, maxAlumnos - clientesActivos.length));
    } catch (error) {
      console.error('Error cargando reservas:', error);
    }
  };

  // Reservar turno para un cliente
  const reservarTurno = async () => {
    if (!turno || !clienteSeleccionado) {
      showError('Error', 'Selecciona un cliente');
      return;
    }

    if (capacidadDisponible <= 0) {
      showError('Error', 'El turno ya no tiene capacidad disponible');
      return;
    }

    try {
      setLoading(true);
      const loadingToast = showLoading('Reservando turno...');

      // Crear reserva en la tabla de reservas
      const { error } = await supabase
        .from('reservas_turnos')
        .insert({
          turno_id: turno.id,
          cliente_id: clienteSeleccionado,
          estado: 'confirmada'
        });

      dismissToast(loadingToast);

      if (error) throw error;

      showSuccess('Turno reservado', 'El turno ha sido asignado al cliente exitosamente');

      // Recargar reservas y limpiar selección
      await cargarReservasExistentes();
      setClienteSeleccionado('');
      onTurnoUpdated();
    } catch (error) {
      console.error('Error reservando turno:', error);
      showError('Error', 'No se pudo reservar el turno');
    } finally {
      setLoading(false);
    }
  };

  // Cancelar reserva de un cliente específico
  const cancelarReserva = async (clienteId: string) => {
    if (!turno) return;

    try {
      setLoading(true);
      const loadingToast = showLoading('Cancelando reserva...');

      // 0. Primero, eliminar de reservas_turnos si existe (reservas creadas desde panel admin)
      const { error: errorEliminarReserva } = await supabase
        .from('reservas_turnos')
        .delete()
        .eq('turno_id', turno.id)
        .eq('cliente_id', clienteId)
        .eq('estado', 'confirmada');

      if (errorEliminarReserva) {
        console.error('Error eliminando reserva_turnos (puede no existir):', errorEliminarReserva);
        // No bloquear el flujo si no existe en reservas_turnos
      }

      // 1. Determinar el tipo de turno
      const esTurnoVariable = turno.id.startsWith('variable_');
      const esTurnoRecurrente = turno.servicio === 'Entrenamiento Recurrente';

      if (esTurnoVariable) {
        // CANCELAR TURNO VARIABLE
        const turnoVariableId = turno.id.replace('variable_', '');
        const { data: turnoVariable, error: errorVariable } = await supabase
          .from('turnos_variables')
          .select('id, creado_desde_disponible_id')
          .eq('id', turnoVariableId)
          .eq('cliente_id', clienteId)
          .eq('estado', 'confirmada')
          .single();

        if (errorVariable || !turnoVariable) {
          showError('Error', 'No se encontró el turno variable');
          return;
        }

        // Eliminar el turno variable
        const { error: errorEliminar } = await supabase
          .from('turnos_variables')
          .delete()
          .eq('id', turnoVariable.id);

        if (errorEliminar) {
          showError('Error', 'No se pudo eliminar el turno variable');
          return;
        }

        // Calcular si la cancelación es tardía (dentro de 24hs)
        const fechaHoraTurno = new Date(`${turno.fecha}T${turno.hora_inicio}`);
        const ahora = new Date();
        const diferenciaHoras = (fechaHoraTurno.getTime() - ahora.getTime()) / (1000 * 60 * 60);
        const esCancelacionTardia = diferenciaHoras < 24;

        // Crear registro en turnos_cancelados (el trigger creará turnos_disponibles)
        const { error: errorCancelacion } = await supabase
          .from('turnos_cancelados')
          .insert({
            cliente_id: clienteId,
            turno_fecha: turno.fecha,
            turno_hora_inicio: turno.hora_inicio,
            turno_hora_fin: turno.hora_fin,
            tipo_cancelacion: 'admin',
            cancelacion_tardia: esCancelacionTardia
          });

        if (errorCancelacion) {
          showError('Error', 'No se pudo crear la cancelación');
          return;
        }

      } else if (esTurnoRecurrente) {
        // CANCELAR TURNO RECURRENTE (solo crear cancelación, no eliminar horario fijo)
        
        // Calcular si la cancelación es tardía (dentro de 24hs)
        const fechaHoraTurno = new Date(`${turno.fecha}T${turno.hora_inicio}`);
        const ahora = new Date();
        const diferenciaHoras = (fechaHoraTurno.getTime() - ahora.getTime()) / (1000 * 60 * 60);
        const esCancelacionTardia = diferenciaHoras < 24;

        const { error: errorCancelacion } = await supabase
          .from('turnos_cancelados')
          .insert({
            cliente_id: clienteId,
            turno_fecha: turno.fecha,
            turno_hora_inicio: turno.hora_inicio,
            turno_hora_fin: turno.hora_fin,
            tipo_cancelacion: 'admin',
            cancelacion_tardia: esCancelacionTardia
          });

        if (errorCancelacion) {
          showError('Error', 'No se pudo crear la cancelación del turno recurrente');
          return;
        }

      } else {
        // 2. Buscar en turnos normales
        const { data: turnoCliente, error: errorBuscar } = await supabase
          .from('turnos')
          .select('*')
          .eq('fecha', turno.fecha)
          .eq('hora_inicio', turno.hora_inicio)
          .eq('cliente_id', clienteId)
          .eq('estado', 'ocupado')
          .single();

        if (errorBuscar) {
          showError('Error', 'No se pudo encontrar la reserva del cliente');
          return;
        }

        // Cancelar la reserva normal
        const { error: errorCancelar } = await supabase
          .from('turnos')
          .update({
            estado: 'disponible',
            cliente_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', turnoCliente.id);

        if (errorCancelar) {
          showError('Error', 'No se pudo cancelar la reserva');
          return;
        }

        // Calcular si la cancelación es tardía (dentro de 24hs)
        const fechaHoraTurno = new Date(`${turno.fecha}T${turno.hora_inicio}`);
        const ahora = new Date();
        const diferenciaHoras = (fechaHoraTurno.getTime() - ahora.getTime()) / (1000 * 60 * 60);
        const esCancelacionTardia = diferenciaHoras < 24;

        // Registrar disponibilidad en turnos_cancelados
        const { error: errorCancelacion } = await supabase
          .from('turnos_cancelados')
          .insert({
            cliente_id: clienteId,
            turno_fecha: turno.fecha,
            turno_hora_inicio: turno.hora_inicio,
            turno_hora_fin: turno.hora_fin,
            tipo_cancelacion: 'admin',
            cancelacion_tardia: esCancelacionTardia
          });

        if (errorCancelacion) {
          showError('Error', 'No se pudo crear la cancelación');
          return;
        }
      }

      showSuccess('Reserva cancelada', 'La reserva del cliente ha sido cancelada exitosamente');

      // Disparar eventos para actualizar otras vistas
      window.dispatchEvent(new Event('turnosCancelados:updated'));
      window.dispatchEvent(new Event('turnosVariables:updated'));
      window.dispatchEvent(new Event('clasesDelMes:updated'));
      
      // Disparar evento específico para actualizar contadores en agenda
      window.dispatchEvent(new Event('alumnosHorarios:updated'));

      // Recargar datos
      await cargarReservasExistentes();
      onTurnoUpdated();

      // Cerrar modal de cancelación
      setShowCancelacionModal(false);
      setTurnoToCancel(null);
      setCancelingTurno(false);
    } catch (error) {
      console.error('Error al cancelar reserva:', error);
      showError('Error', 'No se pudo cancelar la reserva');
      setCancelingTurno(false);
    } finally {
      setLoading(false);
    }
  };

  // Eliminar turno completamente
  const eliminarTurno = async () => {
    try {

      if (!turno) {
        showError('Error', 'No hay turno seleccionado para eliminar');
        return;
      }

      if (!confirm('¿Estás seguro de que quieres eliminar esta clase? El usuario verá la clase como cancelada y aparecerá en vacantes.')) {
        return;
      }

    } catch (error) {
      console.error('❌ Error en confirmación:', error);
      showError('Error', 'Error al procesar la confirmación');
      return;
    }

    try {
      setLoading(true);
      const loadingToast = showLoading('Eliminando clase...');

      // Determinar el tipo de turno
      const esTurnoVariable = turno.id.startsWith('variable_');
      const esTurnoRecurrente = turno.servicio === 'Entrenamiento Recurrente';

      if (esTurnoVariable) {
        // CANCELAR TURNO VARIABLE
        const turnoVariableId = turno.id.replace('variable_', '');

        // 1. Buscar el turno variable específico
        const { data: turnoVariable, error: errorBuscar } = await supabase
          .from('turnos_variables')
          .select('id, cliente_id, creado_desde_disponible_id')
          .eq('id', turnoVariableId)
          .eq('estado', 'confirmada')
          .single();

        if (errorBuscar || !turnoVariable) {
          showError('Error', 'No se encontró el turno variable');
          return;
        }

        // 2. Eliminar el turno variable
        const { error: errorEliminar } = await supabase
          .from('turnos_variables')
          .delete()
          .eq('id', turnoVariable.id);

        if (errorEliminar) {
          showError('Error', 'No se pudo eliminar el turno variable');
          return;
        }

        // 3. Calcular si la cancelación es tardía (dentro de 24hs)
        const fechaHoraTurno = new Date(`${turno.fecha}T${turno.hora_inicio}`);
        const ahora = new Date();
        const diferenciaHoras = (fechaHoraTurno.getTime() - ahora.getTime()) / (1000 * 60 * 60);
        const esCancelacionTardia = diferenciaHoras < 24;

        // Crear registro en turnos_cancelados (esto creará turnos_disponibles automáticamente)
        const { error: errorCancelacion } = await supabase
          .from('turnos_cancelados')
          .insert({
            cliente_id: turnoVariable.cliente_id,
            turno_fecha: turno.fecha,
            turno_hora_inicio: turno.hora_inicio,
            turno_hora_fin: turno.hora_fin,
            tipo_cancelacion: 'admin',
            cancelacion_tardia: esCancelacionTardia
          });

        if (errorCancelacion) {
          showError('Error', 'No se pudo crear la cancelación');
          return;
        }

      } else if (esTurnoRecurrente) {
        // CANCELAR TURNO RECURRENTE
        // 1. Actualizar horarios_recurrentes_usuario.activo = false para este usuario y horario
        // 2. Crear registro en turnos_cancelados

        // Obtener día de la semana desde la fecha
        const fechaTurno = new Date(turno.fecha);
        const diaSemana = fechaTurno.getDay() === 0 ? 7 : fechaTurno.getDay(); // Convertir domingo (0) a 7

        // Actualizar horarios_recurrentes_usuario.activo = false
        const { error: errorActualizarRecurrente } = await supabase
          .from('horarios_recurrentes_usuario')
          .update({ 
            activo: false,
            updated_at: new Date().toISOString()
          })
          .eq('usuario_id', turno.cliente_id)
          .eq('dia_semana', diaSemana)
          .eq('hora_inicio', turno.hora_inicio)
          .eq('hora_fin', turno.hora_fin)
          .eq('activo', true); // Solo actualizar los que están activos

        if (errorActualizarRecurrente) {
          console.error('❌ Error actualizando horario recurrente:', errorActualizarRecurrente);
          // No bloquear el flujo, solo loguear el error
        }

        // Verificar si ya existe una cancelación para este turno
        const { data: cancelacionExistente, error: errorVerificar } = await supabase
          .from('turnos_cancelados')
          .select('id')
          .eq('cliente_id', turno.cliente_id)
          .eq('turno_fecha', turno.fecha)
          .eq('turno_hora_inicio', turno.hora_inicio)
          .eq('turno_hora_fin', turno.hora_fin);

        if (errorVerificar) {
          console.error('❌ Error verificando cancelación existente:', errorVerificar);
          throw errorVerificar;
        }

        if (cancelacionExistente && cancelacionExistente.length > 0) {
          showError('Error', 'Este turno ya está cancelado');
          return;
        }

        // Calcular si la cancelación es tardía (dentro de 24hs)
        const fechaHoraTurno = new Date(`${turno.fecha}T${turno.hora_inicio}`);
        const ahora = new Date();
        const diferenciaHoras = (fechaHoraTurno.getTime() - ahora.getTime()) / (1000 * 60 * 60);
        const esCancelacionTardia = diferenciaHoras < 24;

        // Crear registro de cancelación
        const { error: errorCancelacion } = await supabase
          .from('turnos_cancelados')
          .insert({
            cliente_id: turno.cliente_id,
            turno_fecha: turno.fecha,
            turno_hora_inicio: turno.hora_inicio,
            turno_hora_fin: turno.hora_fin,
            tipo_cancelacion: 'admin',
            cancelacion_tardia: esCancelacionTardia
          });

        if (errorCancelacion) {
          console.error('❌ Error creando cancelación:', errorCancelacion);
          throw errorCancelacion;
        }

      } else {
        // CANCELAR TURNO NORMAL
        // 1. Buscar el turno específico
        const { data: turnoCliente, error: errorBuscar } = await supabase
          .from('turnos')
          .select('*')
          .eq('fecha', turno.fecha)
          .eq('hora_inicio', turno.hora_inicio)
          .eq('cliente_id', turno.cliente_id)
          .eq('estado', 'ocupado')
          .single();

        if (errorBuscar || !turnoCliente) {
          showError('Error', 'No se encontró la reserva del cliente');
          return;
        }

        // 2. Marcar turno como cancelado y liberar cliente
        const { error: errorCancelar } = await supabase
          .from('turnos')
          .update({
            estado: 'cancelado',
            cliente_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', turnoCliente.id);

        if (errorCancelar) {
          showError('Error', 'No se pudo cancelar el turno');
          return;
        }

        // 3. Calcular si la cancelación es tardía (dentro de 24hs)
        const fechaHoraTurno = new Date(`${turno.fecha}T${turno.hora_inicio}`);
        const ahora = new Date();
        const diferenciaHoras = (fechaHoraTurno.getTime() - ahora.getTime()) / (1000 * 60 * 60);
        const esCancelacionTardia = diferenciaHoras < 24;

        // Crear registro en turnos_cancelados
        const { error: errorCancelacion } = await supabase
          .from('turnos_cancelados')
          .insert({
            cliente_id: turno.cliente_id,
            turno_fecha: turno.fecha,
            turno_hora_inicio: turno.hora_inicio,
            turno_hora_fin: turno.hora_fin,
            tipo_cancelacion: 'admin',
            cancelacion_tardia: esCancelacionTardia
          });

        if (errorCancelacion) {
          showError('Error', 'No se pudo crear la cancelación');
          return;
        }
      }

      dismissToast(loadingToast);

      showSuccess('Clase eliminada', 'La clase ha sido cancelada exitosamente. Aparecerá en vacantes y el usuario la verá como cancelada.');

      // Disparar eventos para actualizar otras vistas
      window.dispatchEvent(new Event('turnosCancelados:updated'));
      window.dispatchEvent(new Event('turnosVariables:updated'));
      window.dispatchEvent(new Event('clasesDelMes:updated'));
      
      // Disparar evento específico para actualizar contadores en agenda
      window.dispatchEvent(new Event('alumnosHorarios:updated'));

      // Recargar datos
      await cargarReservasExistentes();
      onTurnoUpdated();

      // Cerrar modal después de un pequeño delay para asegurar que se vea el mensaje de éxito
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Error eliminando turno:', error);
      showError('Error', 'No se pudo eliminar la clase');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar clientes por búsqueda y excluir los ya reservados
  const clientesFiltrados = clientes.filter(cliente =>
    (cliente.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.email.toLowerCase().includes(searchTerm.toLowerCase())) &&
    !clientesReservados.some(reservado => reservado.id === cliente.id)
  );

  const handleCancelarClick = (clienteId: string, clienteNombre: string) => {
    setTurnoToCancel({ clienteId, clienteNombre });
    setShowCancelacionModal(true);
  };

  const handleCloseCancelacionModal = () => {
    setShowCancelacionModal(false);
    setTurnoToCancel(null);
    setCancelingTurno(false);
  };

  const handleConfirmCancelacion = async () => {
    if (!turnoToCancel) return;

    setCancelingTurno(true);
    try {
      await cancelarReserva(turnoToCancel.clienteId);
      // El cierre del modal ya se maneja dentro de cancelarReserva
    } catch (error) {
      console.error('Error en handleConfirmCancelacion:', error);
    } finally {
      setCancelingTurno(false);
    }
  };

  if (!isOpen || !turno) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 md:h-screen md:p-10">
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden md:max-h-[80vh] md:shadow-xl">
        <div className="flex-shrink-0 p-6 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Gestionar Turno</span>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Información del Turno */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                                                   <div>
                                 <Label className="text-sm font-medium text-muted-foreground">Fecha</Label>
                                  <p className="font-medium">
                                         {(() => {
                       if (!turno.fecha) return 'Fecha no disponible';
                       
                       // Dividir la fecha para obtener año, mes y día
                       const [year, month, day] = turno.fecha.split('-').map(Number);
                       
                       // Arrays de nombres
                       const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
                       const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                       
                       // Calcular día de la semana manualmente usando el algoritmo de Zeller
                       let y = year;
                       let m = month;
                       if (m < 3) {
                         m += 12;
                         y -= 1;
                       }
                       const k = y % 100;
                       const j = Math.floor(y / 100);
                       const diaSemanaIdx = (day + Math.floor((13 * (m - 2)) / 5) + k + Math.floor(k / 4) + Math.floor(j / 4) - 2 * j) % 7;
                       const diaSemana = diasSemana[(diaSemanaIdx + 6) % 7];
                       
                       return `${diaSemana}, ${day} de ${meses[month - 1]} de ${year}`;
                     })()}
                  </p>
              </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Horario</Label>
              <p className="font-medium">{turno.hora_inicio} - {turno.hora_fin}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Estado</Label>
              <Badge variant={
                turno.estado === 'disponible' ? 'default' :
                  turno.estado === 'ocupado' ? 'secondary' : 'destructive'
              }>
                {turno.estado === 'disponible' ? 'Disponible' :
                  turno.estado === 'ocupado' ? 'Ocupado' : 'Cancelado'}
              </Badge>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Capacidad</Label>
              <p className="font-medium">
                {clientesReservados.filter(c => !c.cancelado).length} / {turno.max_alumnos || 1} alumnos
              </p>
            </div>
          </div>

          {/* Clientes Reservados */}
          {clientesReservados.length > 0 && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-2 mb-3">
                <Users className="h-5 w-5 text-blue-600" />
                <Label className="text-base font-medium text-blue-800 dark:text-blue-200">
                  Clientes Reservados ({clientesReservados.length})
                </Label>
              </div>

              <div className="space-y-2">
                {clientesReservados.map((cliente) => (
                  <div 
                    key={cliente.id} 
                    className={`flex items-center justify-between p-2 rounded border ${
                      cliente.cancelado 
                        ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700' 
                        : 'bg-white dark:bg-blue-900 border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <User className={`h-4 w-4 ${cliente.cancelado ? 'text-red-600' : 'text-blue-600'}`} />
                      <div>
                        <p className={`font-medium ${
                          cliente.cancelado 
                            ? 'text-red-900 dark:text-red-100' 
                            : 'text-blue-900 dark:text-blue-100'
                        }`}>
                          {cliente.full_name}
                          {cliente.cancelado && (
                            <span className="ml-2 text-xs text-red-600 dark:text-red-400">(Cancelado)</span>
                          )}
                        </p>
                        <p className={`text-sm ${
                          cliente.cancelado 
                            ? 'text-red-700 dark:text-red-300' 
                            : 'text-blue-700 dark:text-blue-300'
                        }`}>
                          {cliente.email}
                        </p>
                      </div>
                    </div>
                    {!cliente.cancelado && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleCancelarClick(cliente.id, cliente.full_name)}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reservar para Nuevo Cliente */}
          {capacidadDisponible > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-green-600" />
                  <Label className="text-base font-medium">Reservar para Cliente</Label>
                </div>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  {capacidadDisponible} cupo{capacidadDisponible > 1 ? 's' : ''} disponible{capacidadDisponible > 1 ? 's' : ''}
                </Badge>
              </div>

              {/* Búsqueda de clientes */}
              <div className="space-y-3">
                <Input
                  placeholder="Buscar cliente por nombre o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />

                {/* Lista de clientes */}
                <div className="max-h-40 overflow-y-auto border rounded-lg">
                  {clientesFiltrados.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      {searchTerm ? 'No se encontraron clientes' : 'No hay clientes disponibles'}
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {clientesFiltrados.map((cliente) => (
                        <li
                          key={cliente.id}
                          className={`p-2 cursor-pointer hover:bg-muted/50 transition-colors ${clienteSeleccionado === cliente.id ? 'bg-primary/10 border-l-2 border-primary' : ''
                            }`}
                          onClick={() => setClienteSeleccionado(cliente.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-normal">{cliente.full_name}</p>
                              <p className="text-xs text-muted-foreground">{cliente.email}</p>
                            </div>
                            {clienteSeleccionado === cliente.id && (
                              <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Botón para reservar */}
              <Button
                onClick={reservarTurno}
                disabled={!clienteSeleccionado || loading}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Reservar Turno
              </Button>
            </div>
          )}
        </div>

        {/* Acciones adicionales - Footer fijo */}
        <div className="flex-shrink-0 border-t p-6">
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cerrar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                eliminarTurno();
              }}
              disabled={loading}
              style={{
                opacity: loading ? 0.5 : 1,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar Clase {loading ? '(Cargando...)' : ''}
            </Button>
          </div>
        </div>
      </Card>

      {/* Modal de Confirmación de Cancelación */}
      <CancelacionConfirmationModal
        turno={{
          id: turno.id,
          fecha: turno.fecha,
          hora_inicio: turno.hora_inicio,
          hora_fin: turno.hora_fin,
          servicio: turno.servicio || 'Entrenamiento Personal',
          estado: 'ocupado',
          profesional_nombre: turnoToCancel ? `Cliente: ${turnoToCancel.clienteNombre}` : undefined
        }}
        isOpen={showCancelacionModal}
        onClose={handleCloseCancelacionModal}
        onConfirm={handleConfirmCancelacion}
        loading={cancelingTurno}
      />
    </div>
  );
};


