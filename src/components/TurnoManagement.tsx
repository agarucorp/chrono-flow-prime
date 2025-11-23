import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useSystemConfig } from '@/hooks/useSystemConfig';
import { useToast } from '@/hooks/use-toast';
import { Clock, Calendar, Edit3, X, Plus, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '@/hooks/useAdmin';

interface HorarioClase {
  id: number;
  nombre: string;
  horaInicio: string;
  horaFin: string;
}

interface AusenciaUnica {
  id: string;
  dia: string;
  mes: string;
  año: string;
  clasesCanceladas: number[];
}

interface AusenciaPeriodo {
  id: string;
  fechaDesde: string;
  fechaHasta: string;
}

interface HorarioSemanal {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  capacidad: number;
  alumnos_agendados: number;
  activo: boolean;
}

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Función para formatear fechas en formato dd/mm/aaaa
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export const TurnoManagement = () => {
  const [cantidadAlumnos, setCantidadAlumnos] = useState('1');
  const [tarifaClase, setTarifaClase] = useState('');
  const [capacidadMaximaGlobal, setCapacidadMaximaGlobal] = useState('4');
  
  // Tarifas escalonadas (valores se cargan desde BD)
  const [combo1Tarifa, setCombo1Tarifa] = useState('12500');
  const [combo2Tarifa, setCombo2Tarifa] = useState('11250');
  const [combo3Tarifa, setCombo3Tarifa] = useState('10000');
  const [combo4Tarifa, setCombo4Tarifa] = useState('8750');
  const [combo5Tarifa, setCombo5Tarifa] = useState('7500');
  const [horariosFijos, setHorariosFijos] = useState<HorarioClase[]>([
    { id: 1, nombre: 'Clase 1', horaInicio: '07:00', horaFin: '08:00' },
    { id: 2, nombre: 'Clase 2', horaInicio: '08:00', horaFin: '09:00' },
    { id: 3, nombre: 'Clase 3', horaInicio: '09:00', horaFin: '10:00' },
    { id: 4, nombre: 'Clase 4', horaInicio: '15:00', horaFin: '16:00' },
    { id: 5, nombre: 'Clase 5', horaInicio: '16:00', horaFin: '17:00' },
    { id: 6, nombre: 'Clase 6', horaInicio: '17:00', horaFin: '18:00' },
    { id: 7, nombre: 'Clase 7', horaInicio: '18:00', horaFin: '19:00' },
    { id: 8, nombre: 'Clase 8', horaInicio: '19:00', horaFin: '20:00' },
    { id: 9, nombre: 'Clase 9', horaInicio: '20:00', horaFin: '21:00' }
  ]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [isCapacidadDialogOpen, setIsCapacidadDialogOpen] = useState(false);
  const [capacidadValor, setCapacidadValor] = useState<string>('');
  const [horariosSemanales, setHorariosSemanales] = useState<HorarioSemanal[]>([]);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [isTarifaDialogOpen, setIsTarifaDialogOpen] = useState(false);
  const [tarifaValor, setTarifaValor] = useState<string>('');
  const { 
    actualizarConfiguracionCapacidad, 
    obtenerCapacidadActual, 
    cargarConfiguraciones, 
    actualizarConfiguracionTarifas, 
    obtenerTarifaActual,
    configuracionCapacidad
  } = useSystemConfig();
  const { createAusenciaUnica, createAusenciaPeriodo, fetchAusencias, deleteAusencia } = useAdmin();
  const { toast } = useToast();

  // Cargar tarifas escalonadas al montar
  useEffect(() => {
    const cargarTarifas = async () => {
      try {
        const { data, error } = await supabase
          .from('configuracion_admin')
          .select('combo_1_tarifa, combo_2_tarifa, combo_3_tarifa, combo_4_tarifa, combo_5_tarifa')
          .single();

        if (!error && data) {
          setCombo1Tarifa(data.combo_1_tarifa?.toString() || '12500');
          setCombo2Tarifa(data.combo_2_tarifa?.toString() || '11250');
          setCombo3Tarifa(data.combo_3_tarifa?.toString() || '10000');
          setCombo4Tarifa(data.combo_4_tarifa?.toString() || '8750');
          setCombo5Tarifa(data.combo_5_tarifa?.toString() || '7500');
        }
      } catch (error) {
        console.error('Error cargando tarifas:', error);
      }
    };

    cargarTarifas();
  }, []);

  // Cargar capacidad real al montar
  useEffect(() => {
    if (configuracionCapacidad && configuracionCapacidad.length > 0) {
      const capacidadActual = configuracionCapacidad[0].max_alumnos_por_clase;
      setCapacidadMaximaGlobal(capacidadActual.toString());
    }
  }, [configuracionCapacidad]);

  // Cargar horarios desde BD cuando se abre el dialog
  const cargarHorariosDesdeDB = async () => {
    try {
      const { data, error } = await supabase
        .from('horarios_semanales')
        .select('clase_numero, hora_inicio, hora_fin')
        .eq('dia_semana', 1) // Cargar del lunes (todos los días tienen los mismos horarios)
        .eq('activo', true)
        .order('clase_numero');

      if (error) {
        console.error('Error cargando horarios desde BD:', error);
        return;
      }

      if (data && data.length > 0) {
        const horariosDB = data.map((h: any) => ({
          id: h.clase_numero,
          nombre: `Clase ${h.clase_numero}`,
          horaInicio: h.hora_inicio.substring(0, 5),
          horaFin: h.hora_fin.substring(0, 5)
        }));
        setHorariosFijos(horariosDB);
      }
    } catch (error) {
      console.error('Error inesperado cargando horarios:', error);
    }
  };

  // Cargar horarios al abrir el dialog
  useEffect(() => {
    if (isDialogOpen) {
      cargarHorariosDesdeDB();
    }
  }, [isDialogOpen]);

  // Cargar horarios semanales
  const cargarHorariosSemanales = async () => {
    setLoadingHorarios(true);
    try {
      const { data, error } = await supabase
        .from('horarios_semanales')
        .select('*')
        .order('dia_semana')
        .order('hora_inicio');

      if (error) throw error;
      setHorariosSemanales(data || []);
    } catch (error) {
      console.error('Error cargando horarios:', error);
      toast({ title: 'Error', description: 'No se pudieron cargar los horarios', variant: 'destructive' });
    } finally {
      setLoadingHorarios(false);
    }
  };

  const abrirCapacidad = async () => {
    await cargarHorariosSemanales();
    setIsCapacidadDialogOpen(true);
  };

  const actualizarCapacidadHorario = async (horarioId: string, nuevaCapacidad: number) => {
    try {
      const { error } = await supabase
        .from('horarios_semanales')
        .update({ capacidad: nuevaCapacidad })
        .eq('id', horarioId);

      if (error) throw error;

      toast({ title: 'Guardado', description: 'Capacidad actualizada' });
      await cargarHorariosSemanales();
    } catch (error) {
      console.error('Error:', error);
      toast({ title: 'Error', description: 'No se pudo actualizar la capacidad', variant: 'destructive' });
    }
  };

  const guardarCapacidad = async () => {
    setIsCapacidadDialogOpen(false);
  };

  const abrirTarifa = () => {
    const actual = obtenerTarifaActual();
    setTarifaValor(String(actual || 0));
    setIsTarifaDialogOpen(true);
  };

  const guardarTarifa = async () => {
    const numero = Math.max(0, parseFloat(tarifaValor || '0'));
    const { success, error } = await actualizarConfiguracionTarifas({ tipo_clase: 'general', tarifa_por_clase: numero, moneda: 'ARS', activo: true as any });
    if (!success) {
      toast({ title: 'Error', description: error || 'No se pudo guardar la tarifa', variant: 'destructive' });
      return;
    }
    await cargarConfiguraciones();
    toast({ title: 'Guardado', description: 'Tarifa actualizada globalmente' });
    setIsTarifaDialogOpen(false);
  };
  
  // Estados para ausencias
  const [isDialogAusenciasOpen, setIsDialogAusenciasOpen] = useState(false);
  const [tipoAusencia, setTipoAusencia] = useState<'unica' | 'periodo' | null>(null);
  const [ausenciasUnicas, setAusenciasUnicas] = useState<AusenciaUnica[]>([]);
  const [ausenciasPeriodo, setAusenciasPeriodo] = useState<AusenciaPeriodo[]>([]);
  
  // Estado para nueva ausencia única
  const [nuevaAusenciaUnica, setNuevaAusenciaUnica] = useState({
    fechaCompleta: '',
    dia: '',
    mes: '',
    año: '',
    clasesCanceladas: [] as number[]
  });
  
  // Estado para nueva ausencia por período
  const [nuevaAusenciaPeriodo, setNuevaAusenciaPeriodo] = useState({
    fechaDesde: '',
    fechaHasta: ''
  });
  
  // Estado para mostrar resumen de ausencia
  const [mostrarResumenAusencia, setMostrarResumenAusencia] = useState(false);

  // Cargar ausencias al abrir el dialog de ausencias
  useEffect(() => {
    const cargarAusencias = async () => {
      if (isDialogAusenciasOpen) {
        const ausencias = await fetchAusencias();
        
        // Separar ausencias únicas y por período
        const unicas = ausencias
          .filter((a: any) => a.tipo_ausencia === 'unica')
          .map((a: any) => {
            // Extraer fecha directamente del string para evitar problemas de zona horaria
            const fechaStr = a.fecha_inicio.split('T')[0]; // Obtener solo la parte de fecha YYYY-MM-DD
            const [año, mes, dia] = fechaStr.split('-');
            return {
              id: a.id,
              dia: dia,
              mes: mes,
              año: año,
              clasesCanceladas: a.clases_canceladas || []
            };
          });

        const periodos = ausencias
          .filter((a: any) => a.tipo_ausencia === 'periodo')
          .map((a: any) => ({
            id: a.id,
            fechaDesde: a.fecha_inicio.split('T')[0], // Solo la fecha YYYY-MM-DD
            fechaHasta: a.fecha_fin.split('T')[0] // Solo la fecha YYYY-MM-DD
          }));

        setAusenciasUnicas(unicas);
        setAusenciasPeriodo(periodos);
      }
    };

    cargarAusencias();
  }, [isDialogAusenciasOpen, fetchAusencias]);

  const handleHorarioChange = (id: number, field: 'horaInicio' | 'horaFin', value: string) => {
    setHorariosFijos(prev => 
      prev.map(horario => 
        horario.id === id ? { ...horario, [field]: value } : horario
      )
    );
  };

  // Función para validar capacidad vs alumnos existentes
  const validarCapacidad = async (nuevaCapacidad: number) => {
    try {
      // Obtener horarios con alumnos agendados
      const { data: horariosConAlumnos, error } = await supabase
        .from('horarios_semanales')
        .select('id, capacidad, alumnos_agendados, dia_semana, hora_inicio, hora_fin')
        .gte('alumnos_agendados', 1);

      if (error) {
        console.error('Error obteniendo horarios:', error);
        return { valido: false, conflictos: [], error: 'Error al validar capacidad' };
      }

      // Verificar conflictos
      const conflictos = horariosConAlumnos?.filter(horario => 
        horario.alumnos_agendados > nuevaCapacidad
      ) || [];

      return {
        valido: conflictos.length === 0,
        conflictos: conflictos.map(conflicto => ({
          ...conflicto,
          diaNombre: DIAS_SEMANA[conflicto.dia_semana - 1]
        }))
      };
    } catch (error) {
      console.error('Error inesperado validando capacidad:', error);
      return { valido: false, conflictos: [], error: 'Error inesperado' };
    }
  };

  const handleGuardarHorarios = async () => {
    const nuevaCapacidad = parseInt(capacidadMaximaGlobal);
    
    // Validar capacidad
    const validacion = await validarCapacidad(nuevaCapacidad);
    
    if (!validacion.valido) {
      if (validacion.conflictos.length > 0) {
        // Mostrar alerta de conflictos
        const conflictosText = validacion.conflictos.map(c => 
          `${c.diaNombre} ${c.hora_inicio.substring(0,5)} (${c.alumnos_agendados} alumnos)`
        ).join('\n');
        
        if (!confirm(`⚠️ ADVERTENCIA: La nueva capacidad (${nuevaCapacidad}) es menor que el número actual de alumnos agendados en:\n\n${conflictosText}\n\n¿Está seguro de continuar? Esto podría afectar el funcionamiento del sistema.`)) {
          return; // Usuario canceló
        }
      } else {
        toast({ 
          title: 'Error', 
          description: validacion.error || 'Error validando capacidad', 
          variant: 'destructive' 
        });
        return;
      }
    }

    try {
      // Calcular horarios de apertura y cierre basándose en los horarios del popup
      const horariosInicio = horariosFijos.map(h => h.horaInicio).sort();
      const horariosFin = horariosFijos.map(h => h.horaFin).sort();
      const horarioApertura = horariosInicio[0] || '08:00';
      const horarioCierre = horariosFin[horariosFin.length - 1] || '20:00';

      // Preparar datos para actualizar configuracion_admin
      const updateData: any = {
        max_alumnos_por_clase: nuevaCapacidad,
        horario_apertura: horarioApertura,
        horario_cierre: horarioCierre,
        updated_at: new Date().toISOString()
      };

      // Agregar tarifa si fue modificada (retrocompatibilidad)
      if (tarifaClase && parseFloat(tarifaClase) >= 0) {
        updateData.precio_clase = parseFloat(tarifaClase);
      }

      // Agregar tarifas escalonadas
      if (combo1Tarifa && parseFloat(combo1Tarifa) >= 0) {
        updateData.combo_1_tarifa = parseFloat(combo1Tarifa);
      }
      if (combo2Tarifa && parseFloat(combo2Tarifa) >= 0) {
        updateData.combo_2_tarifa = parseFloat(combo2Tarifa);
      }
      if (combo3Tarifa && parseFloat(combo3Tarifa) >= 0) {
        updateData.combo_3_tarifa = parseFloat(combo3Tarifa);
      }
      if (combo4Tarifa && parseFloat(combo4Tarifa) >= 0) {
        updateData.combo_4_tarifa = parseFloat(combo4Tarifa);
      }
      if (combo5Tarifa && parseFloat(combo5Tarifa) >= 0) {
        updateData.combo_5_tarifa = parseFloat(combo5Tarifa);
      }

      
      const { data: updateResult, error: errorConfiguracion } = await supabase
        .from('configuracion_admin')
        .update(updateData)
        .eq('sistema_activo', true)
        .select();


      if (errorConfiguracion) {
        console.error('Error guardando configuración:', errorConfiguracion);
        toast({ 
          title: 'Error', 
          description: `No se pudo guardar la configuración: ${errorConfiguracion.message}`, 
          variant: 'destructive' 
        });
        return;
      }

      // Sincronización con horarios_semanales usando clase_numero
      const diasLaborales = [1, 2, 3, 4, 5];
      const nowIso = new Date().toISOString();

      for (const ds of diasLaborales) {
        // Traer existentes del día con clase_numero
        const { data: existentes, error: errorExistentes } = await supabase
          .from('horarios_semanales')
          .select('id, clase_numero, hora_inicio, hora_fin, capacidad')
          .eq('dia_semana', ds)
          .order('clase_numero');
        
        if (errorExistentes) {
          console.error('Error leyendo horarios existentes:', errorExistentes);
          continue;
        }

        // Procesar cada clase del popup
        for (let i = 0; i < horariosFijos.length; i++) {
          const h = horariosFijos[i];
          const claseNumero = i + 1; // Clase 1, 2, 3, etc.
          const hi = (h.horaInicio || '00:00').substring(0, 5) + ':00';
          const hf = (h.horaFin || '00:00').substring(0, 5) + ':00';

          // Buscar si ya existe esta clase_numero para este día
          const existente = existentes?.find((e: any) => e.clase_numero === claseNumero);

          if (existente) {
            // Actualizar el horario existente (las horas pueden cambiar, pero clase_numero es fijo)
            const { error: errorUpd } = await supabase
              .from('horarios_semanales')
              .update({ 
                hora_inicio: hi, 
                hora_fin: hf, 
                capacidad: nuevaCapacidad, 
                activo: true, 
                updated_at: nowIso 
              })
              .eq('id', existente.id);
            
            if (errorUpd) {
              console.error('❌ Error actualizando clase:', { dia: ds, clase: claseNumero, errorUpd });
            } else {
            }
          } else {
            // Insertar nuevo slot con clase_numero
            const { error: errorIns } = await supabase
              .from('horarios_semanales')
              .insert({ 
                dia_semana: ds, 
                clase_numero: claseNumero,
                hora_inicio: hi, 
                hora_fin: hf, 
                capacidad: nuevaCapacidad, 
                activo: true, 
                updated_at: nowIso 
              });
            
            if (errorIns) {
              console.error('❌ Error insertando clase:', { dia: ds, clase: claseNumero, errorIns });
            } else {
            }
          }
        }
      }

      toast({ 
        title: 'Guardado exitoso', 
        description: 'Configuración y horarios sincronizados correctamente' 
      });
      
      setIsDialogOpen(false);
      
      // Recargar configuraciones
      window.location.reload(); // Temporal - después se puede optimizar
      
    } catch (error) {
      console.error('Error guardando configuración:', error);
      toast({ 
        title: 'Error', 
        description: 'Error inesperado al guardar', 
        variant: 'destructive' 
      });
    }
  };

  const handleGuardarCapacidadMaxima = async () => {
    try {
      const nuevaCapacidad = parseInt(capacidadMaximaGlobal);
      
      // 1. Actualizar configuracion_admin
      const { error: errorConfig } = await supabase
        .from('configuracion_admin')
        .update({ 
          max_alumnos_por_clase: nuevaCapacidad,
          updated_at: new Date().toISOString()
        })
        .eq('sistema_activo', true);

      if (errorConfig) {
        console.error('Error actualizando configuracion_admin:', errorConfig);
        throw errorConfig;
      }

      // 2. Actualizar todos los horarios_semanales con la nueva capacidad
      const { error: errorHorarios } = await supabase
        .from('horarios_semanales')
        .update({ 
          capacidad: nuevaCapacidad,
          updated_at: new Date().toISOString()
        })
        .eq('activo', true);

      if (errorHorarios) {
        console.error('Error actualizando horarios_semanales:', errorHorarios);
        // No lanzar error, solo loguear - la capacidad global ya se actualizó
      }

      toast({ title: 'Guardado', description: 'Capacidad máxima actualizada globalmente' });
      
      // Disparar evento para actualizar otros componentes
      window.dispatchEvent(new Event('capacidad:updated'));
      
      // Recargar configuración
      await actualizarConfiguracionCapacidad({
        tipo_clase: 'general',
        max_alumnos_por_clase: nuevaCapacidad,
        activo: true
      });
    } catch (error) {
      console.error('Error actualizando capacidad máxima:', error);
      toast({ title: 'Error', description: 'No se pudo actualizar la capacidad máxima', variant: 'destructive' });
    }
  };

  const handleAgregarHorario = () => {
    setHorariosFijos(prev => {
      const nextId = prev.length ? Math.max(...prev.map(h => h.id)) + 1 : 1;
      return [
        ...prev,
        { id: nextId, nombre: `Clase ${nextId}`, horaInicio: '00:00', horaFin: '00:00' }
      ];
    });
  };

  const handleEliminarHorario = (id: number) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmarEliminar = () => {
    if (confirmDeleteId === null) return;
    setHorariosFijos(prev => prev.filter(h => h.id !== confirmDeleteId));
    setConfirmDeleteId(null);
  };

  // Funciones para manejar ausencias
  const handleToggleClase = (claseId: number) => {
    setNuevaAusenciaUnica(prev => ({
      ...prev,
      clasesCanceladas: prev.clasesCanceladas.includes(claseId)
        ? prev.clasesCanceladas.filter(id => id !== claseId)
        : [...prev.clasesCanceladas, claseId]
    }));
  };

  const handleAgregarAusenciaUnica = async () => {
    if (nuevaAusenciaUnica.fechaCompleta && nuevaAusenciaUnica.clasesCanceladas.length > 0) {
      try {
        // Guardar en la base de datos
        // Agregar hora del mediodía para evitar problemas de zona horaria
        const fechaConHora = `${nuevaAusenciaUnica.fechaCompleta}T12:00:00`;
        const result = await createAusenciaUnica(
          fechaConHora, // fecha en formato ISO con hora
          nuevaAusenciaUnica.clasesCanceladas,
          null // motivo opcional
        );

        if (result.success) {
          toast({
            title: 'Ausencia creada',
            description: `Se bloquearon ${nuevaAusenciaUnica.clasesCanceladas.length} clase(s) para el ${nuevaAusenciaUnica.fechaCompleta}`,
          });

          // Guardar también en el estado local para mostrar en la interfaz
          const nuevaAusencia: AusenciaUnica = {
            id: result.data.id,
            dia: nuevaAusenciaUnica.dia,
            mes: nuevaAusenciaUnica.mes,
            año: nuevaAusenciaUnica.año,
            clasesCanceladas: nuevaAusenciaUnica.clasesCanceladas
          };
          setAusenciasUnicas(prev => [...prev, nuevaAusencia]);

          // Disparar evento para que los usuarios recarguen sus calendarios
          window.dispatchEvent(new Event('ausenciasAdmin:updated'));

          // Limpiar formulario
          setNuevaAusenciaUnica({ fechaCompleta: '', dia: '', mes: '', año: '', clasesCanceladas: [] });
          setTipoAusencia(null);
        } else {
          toast({
            title: 'Error',
            description: result.error || 'No se pudo crear la ausencia',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error guardando ausencia:', error);
        toast({
          title: 'Error',
          description: 'Error inesperado al guardar la ausencia',
          variant: 'destructive',
        });
      }
    }
  };

  const handleAgregarAusenciaPeriodo = () => {
    if (nuevaAusenciaPeriodo.fechaDesde && nuevaAusenciaPeriodo.fechaHasta) {
      // Mostrar resumen en lugar de guardar automáticamente
      setMostrarResumenAusencia(true);
    }
  };

  const confirmarAusenciaPeriodo = async () => {
    try {
      // Guardar en la base de datos
      // Agregar hora del mediodía para evitar problemas de zona horaria
      const fechaDesdeConHora = `${nuevaAusenciaPeriodo.fechaDesde}T12:00:00`;
      const fechaHastaConHora = `${nuevaAusenciaPeriodo.fechaHasta}T12:00:00`;
      const result = await createAusenciaPeriodo(
        fechaDesdeConHora,
        fechaHastaConHora,
        null // motivo opcional
      );

      if (result.success) {
        toast({
          title: 'Ausencia por período creada',
          description: `Se bloquearon todas las clases desde ${nuevaAusenciaPeriodo.fechaDesde} hasta ${nuevaAusenciaPeriodo.fechaHasta}`,
        });

        // Guardar también en el estado local para mostrar en la interfaz
        const nuevaAusencia: AusenciaPeriodo = {
          id: result.data.id,
          fechaDesde: nuevaAusenciaPeriodo.fechaDesde,
          fechaHasta: nuevaAusenciaPeriodo.fechaHasta
        };
        setAusenciasPeriodo(prev => [...prev, nuevaAusencia]);

        // Disparar evento para que los usuarios recarguen sus calendarios
        window.dispatchEvent(new Event('ausenciasAdmin:updated'));

        // Limpiar formulario
        setNuevaAusenciaPeriodo({ fechaDesde: '', fechaHasta: '' });
        setTipoAusencia(null);
        setMostrarResumenAusencia(false);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo crear la ausencia por período',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error guardando ausencia por período:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al guardar la ausencia por período',
        variant: 'destructive',
      });
    }
  };

  const handleEliminarAusencia = async (id: string, tipo: 'unica' | 'periodo') => {
    try {
      const result = await deleteAusencia(id);
      
      if (result.success) {
        if (tipo === 'unica') {
          setAusenciasUnicas(prev => prev.filter(ausencia => ausencia.id !== id));
        } else {
          setAusenciasPeriodo(prev => prev.filter(ausencia => ausencia.id !== id));
        }
        
        // Disparar evento para que los usuarios recarguen sus calendarios
        window.dispatchEvent(new Event('ausenciasAdmin:updated'));
        
        toast({
          title: 'Ausencia eliminada',
          description: 'La ausencia se eliminó correctamente',
        });
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo eliminar la ausencia',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error eliminando ausencia:', error);
      toast({
        title: 'Error',
        description: 'Error inesperado al eliminar la ausencia',
        variant: 'destructive',
      });
    }
  };

  // Generar opciones para días (1-31)
  const dias = Array.from({ length: 31 }, (_, i) => i + 1);

  // Función para convertir hora 24h a 12h
  const convertirHoraA12h = (hora24: string) => {
    const [hora] = hora24.split(':');
    const horaNum = parseInt(hora);
    
    if (horaNum === 0) return '12am';
    if (horaNum < 12) return `${horaNum}am`;
    if (horaNum === 12) return '12pm';
    return `${horaNum - 12}pm`;
  };
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const años = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i);

  return (
    <div className="space-y-6 w-full max-w-full">
      <Card className="w-full max-w-full">
        <CardContent className="space-y-6 w-full max-w-full pt-6 md:space-y-6 space-y-0">


          {/* Botones de acción */}
          <div className="space-y-0 sm:space-y-4 pt-0 sm:pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              {/* CTA 1: Capacidad, tarifa y horarios */}
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <div className="h-12 w-full rounded-xl border-2 border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors shadow-sm hover:shadow-md font-heading flex items-center justify-center cursor-pointer" style={{ padding: '12px 24px', fontSize: '14px' }}>
                    Capacidad, tarifa y horarios
                  </div>
                </DialogTrigger>
                <DialogContent className="w-[90%] max-w-[20rem] sm:max-w-2xl max-h-[80vh] overflow-y-auto p-3 sm:p-6 rounded-xl">
                  <DialogHeader>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    {/* Card para capacidad por clase */}
                    <div className="p-3 border border-border rounded-lg bg-muted/50">
                      <div className="flex items-center justify-center gap-4">
                        <Label htmlFor="capacidad-maxima" className="whitespace-nowrap" style={{ fontSize: '12px' }}>Capacidad por clase</Label>
                        <Select
                          value={capacidadMaximaGlobal}
                          onValueChange={(value) => setCapacidadMaximaGlobal(value)}
                        >
                          <SelectTrigger className="w-20 text-center" style={{ fontSize: '12px' }}>
                            <SelectValue placeholder="Elegir" />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                              <SelectItem key={num} value={num.toString()} style={{ fontSize: '12px' }}>
                                {num}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Card para tarifas escalonadas */}
                    <div className="p-4 border border-blue-500 rounded-lg bg-muted/50">
                      <div className="text-center mb-3">
                        <Label className="font-semibold" style={{ fontSize: '13px' }}>Tarifas por clase según asistencia</Label>
                        <p className="text-xs text-muted-foreground mt-1">Precio unitario por clase</p>
                      </div>
                      
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        {/* Combo 1 */}
                        <div className="flex flex-col items-center gap-1.5">
                          <Label htmlFor="combo-1" className="text-xs font-medium text-center">Combo 1</Label>
                          <Input
                            id="combo-1"
                            type="number"
                            min="0"
                            step="100"
                            value={combo1Tarifa}
                            onChange={(e) => setCombo1Tarifa(e.target.value)}
                            className="w-full h-8 text-xs text-center"
                            placeholder="12500"
                          />
                          <span className="text-[10px] text-muted-foreground">ARS</span>
                        </div>

                        {/* Combo 2 */}
                        <div className="flex flex-col items-center gap-1.5">
                          <Label htmlFor="combo-2" className="text-xs font-medium text-center">Combo 2</Label>
                          <Input
                            id="combo-2"
                            type="number"
                            min="0"
                            step="100"
                            value={combo2Tarifa}
                            onChange={(e) => setCombo2Tarifa(e.target.value)}
                            className="w-full h-8 text-xs text-center"
                            placeholder="11250"
                          />
                          <span className="text-[10px] text-muted-foreground">ARS</span>
                        </div>

                        {/* Combo 3 */}
                        <div className="flex flex-col items-center gap-1.5">
                          <Label htmlFor="combo-3" className="text-xs font-medium text-center">Combo 3</Label>
                          <Input
                            id="combo-3"
                            type="number"
                            min="0"
                            step="100"
                            value={combo3Tarifa}
                            onChange={(e) => setCombo3Tarifa(e.target.value)}
                            className="w-full h-8 text-xs text-center"
                            placeholder="10000"
                          />
                          <span className="text-[10px] text-muted-foreground">ARS</span>
                        </div>

                        {/* Combo 4 */}
                        <div className="flex flex-col items-center gap-1.5">
                          <Label htmlFor="combo-4" className="text-xs font-medium text-center">Combo 4</Label>
                          <Input
                            id="combo-4"
                            type="number"
                            min="0"
                            step="100"
                            value={combo4Tarifa}
                            onChange={(e) => setCombo4Tarifa(e.target.value)}
                            className="w-full h-8 text-xs text-center"
                            placeholder="8750"
                          />
                          <span className="text-[10px] text-muted-foreground">ARS</span>
                        </div>

                        {/* Combo 5 */}
                        <div className="flex flex-col items-center gap-1.5">
                          <Label htmlFor="combo-5" className="text-xs font-medium text-center">Combo 5</Label>
                          <Input
                            id="combo-5"
                            type="number"
                            min="0"
                            step="100"
                            value={combo5Tarifa}
                            onChange={(e) => setCombo5Tarifa(e.target.value)}
                            className="w-full h-8 text-xs text-center"
                            placeholder="7500"
                          />
                          <span className="text-[10px] text-muted-foreground">ARS</span>
                        </div>
                      </div>
                    </div>

                    {horariosFijos.map((horario) => (
                      <div key={horario.id} className="relative grid grid-cols-1 md:grid-cols-3 gap-0 items-center py-4 px-2 border rounded-lg">
                        <div 
                          className="absolute -top-2 -left-2 bg-background px-2 text-xs text-muted-foreground"
                          style={{ 
                            background: 'hsl(var(--background))',
                            zIndex: 10
                          }}
                        >
                          {horario.nombre}
                        </div>
                        <div className="flex items-center gap-2 px-0.5">
                          <div className="space-y-1 flex flex-col items-center">
                            <Label htmlFor={`inicio-${horario.id}`} className="text-xs">
                              Hora de inicio
                            </Label>
                            <Input
                              id={`inicio-${horario.id}`}
                              type="time"
                              value={horario.horaInicio}
                              onChange={(e) => handleHorarioChange(horario.id, 'horaInicio', e.target.value)}
                              className="w-24 h-8 text-sm text-center [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-0 [&::-webkit-calendar-picker-indicator]:h-0"
                            />
                          </div>
                          <div className="space-y-1 flex flex-col items-center">
                            <Label htmlFor={`fin-${horario.id}`} className="text-xs">
                              Hora de fin
                            </Label>
                            <Input
                              id={`fin-${horario.id}`}
                              type="time"
                              value={horario.horaFin}
                              onChange={(e) => handleHorarioChange(horario.id, 'horaFin', e.target.value)}
                              className="w-24 h-8 text-sm text-center [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-0 [&::-webkit-calendar-picker-indicator]:h-0"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label="Eliminar clase"
                          onClick={() => handleEliminarHorario(horario.id)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}

                    {/* Confirmación de eliminación */}
                    <AlertDialog open={confirmDeleteId !== null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle style={{ fontSize: '12px' }}>Eliminar clase</AlertDialogTitle>
                          <AlertDialogDescription style={{ fontSize: '12px' }}>
                            ¿Está seguro que desea eliminar esta clase?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel style={{ fontSize: '14px' }}>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleConfirmarEliminar} style={{ fontSize: '14px' }}>Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <div className="w-full">
                      <div
                        onClick={handleAgregarHorario}
                        className="h-10 w-full rounded-xl border-2 border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors shadow-sm hover:shadow-md font-heading flex items-center justify-center gap-2 cursor-pointer"
                        style={{ padding: '8px 16px', fontSize: '12px' }}
                      >
                        <Plus className="h-4 w-4" />
                        Agregar horario
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      style={{ fontSize: '12px' }}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleGuardarHorarios} style={{ fontSize: '12px' }}>
                      Guardar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* CTA 2: Editar ausencias */}
              <Dialog open={isDialogAusenciasOpen} onOpenChange={(open) => {
                setIsDialogAusenciasOpen(open);
                if (!open) {
                  // Resetear estados al cerrar
                  setTipoAusencia(null);
                  setMostrarResumenAusencia(false);
                  setNuevaAusenciaPeriodo({ fechaDesde: '', fechaHasta: '' });
                  setNuevaAusenciaUnica({ fechaCompleta: '', dia: '', mes: '', año: '', clasesCanceladas: [] });
                }
              }}>
                <DialogTrigger asChild>
                  <div className="h-12 w-full rounded-xl border-2 border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors shadow-sm hover:shadow-md font-heading flex items-center justify-center cursor-pointer" style={{ padding: '12px 24px', fontSize: '14px' }}>
                    Editar ausencias
                  </div>
                </DialogTrigger>
                <DialogContent className="w-[90%] max-w-[20rem] sm:max-w-4xl max-h-[90vh] overflow-y-auto pt-6 pb-3 px-3 sm:p-6 rounded-xl">
                  <DialogHeader>
                    <DialogTitle style={{ fontSize: '12px' }}>
                      {tipoAusencia === 'periodo' ? '' : ''}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                      Modal para gestionar ausencias del profesor
                    </DialogDescription>
                  </DialogHeader>

                  {!tipoAusencia ? (
                    // Selección de tipo de ausencia
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button
                          onClick={() => setTipoAusencia('unica')}
                          className="h-24 flex flex-col items-center justify-center space-y-2 border-border"
                          variant="outline"
                          style={{ fontSize: '14px' }}
                        >
                          <span className="font-medium">Ausencia única</span>
                          <span className="text-xs text-muted-foreground text-center">
                            Cancelar clases de un día específico
                          </span>
                        </Button>
                        
            <Button
              onClick={() => setTipoAusencia('periodo')}
              className="h-24 flex flex-col items-center justify-center space-y-2 border-border"
              variant="outline"
              style={{ fontSize: '14px' }}
            >
              <span className="font-medium">Ausencia por período</span>
              <span className="text-xs text-muted-foreground text-center">
                Cancelar todas las clases por un período
              </span>
            </Button>
                      </div>
                    </div>
                  ) : tipoAusencia === 'unica' ? (
                    // Formulario para ausencia única
                    <div className="space-y-4">
                      <div className="border-b pb-3">
                        <div className="space-y-2">
                          <Label style={{ fontSize: '14px' }}>Fecha</Label>
                          <Input
                            type="date"
                            value={nuevaAusenciaUnica.fechaCompleta}
                            onChange={(e) => {
                              const fecha = e.target.value;
                              if (fecha) {
                                const [año, mes, dia] = fecha.split('-');
                                setNuevaAusenciaUnica(prev => ({
                                  ...prev,
                                  fechaCompleta: fecha,
                                  dia: dia,
                                  mes: mes,
                                  año: año
                                }));
                              }
                            }}
                            className="w-full"
                            style={{ fontSize: '14px' }}
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label style={{ fontSize: '14px' }}>Clases a cancelar</Label>
                        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                          {horariosFijos.map((clase) => (
                            <Button
                              key={clase.id}
                              variant={nuevaAusenciaUnica.clasesCanceladas.includes(clase.id) ? "default" : "outline"}
                              onClick={() => handleToggleClase(clase.id)}
                              className="h-10 flex flex-col items-center justify-center"
                            >
                              <span className="text-xs font-light" style={{ fontSize: '10px' }}>{clase.nombre}</span>
                              <span className="text-xs font-light" style={{ fontSize: '10px' }}>{convertirHoraA12h(clase.horaInicio)} - {convertirHoraA12h(clase.horaFin)}</span>
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-center space-x-2">
                        <Button variant="outline" onClick={() => setTipoAusencia(null)} size="sm" style={{ fontSize: '14px' }}>
                          Volver
                        </Button>
                        <Button onClick={handleAgregarAusenciaUnica} disabled={!nuevaAusenciaUnica.fechaCompleta || nuevaAusenciaUnica.clasesCanceladas.length === 0} size="sm" style={{ fontSize: '14px' }}>
                          Guardar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Formulario para ausencia por período
                    <div className="space-y-6">
                      {!mostrarResumenAusencia ? (
                        <>
                          <div className="border-b pb-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label style={{ fontSize: '14px' }}>Fecha desde</Label>
                                <Input
                                  type="date"
                                  value={nuevaAusenciaPeriodo.fechaDesde}
                                  onChange={(e) => setNuevaAusenciaPeriodo(prev => ({ ...prev, fechaDesde: e.target.value }))}
                                  style={{ fontSize: '14px' }}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label style={{ fontSize: '14px' }}>Fecha hasta</Label>
                                <Input
                                  type="date"
                                  value={nuevaAusenciaPeriodo.fechaHasta}
                                  onChange={(e) => setNuevaAusenciaPeriodo(prev => ({ ...prev, fechaHasta: e.target.value }))}
                                  style={{ fontSize: '14px' }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-center space-x-2">
                            <Button variant="outline" onClick={() => setTipoAusencia(null)} style={{ fontSize: '14px' }}>
                              Volver
                            </Button>
                            <Button onClick={handleAgregarAusenciaPeriodo} disabled={!nuevaAusenciaPeriodo.fechaDesde || !nuevaAusenciaPeriodo.fechaHasta} style={{ fontSize: '14px' }}>
                              Continuar
                            </Button>
                          </div>
                        </>
                      ) : (
                        // Resumen de ausencia por período
                        <div className="space-y-4">
                          <div className="text-center space-y-2">
                            <h3 className="font-medium" style={{ fontSize: '16px' }}>Resumen de Ausencia</h3>
                            <p className="text-muted-foreground" style={{ fontSize: '14px' }}>
                              Se cancelarán todas las clases desde el <strong>{formatDate(nuevaAusenciaPeriodo.fechaDesde)}</strong> hasta el <strong>{formatDate(nuevaAusenciaPeriodo.fechaHasta)}</strong>
                            </p>
                          </div>

                          <div className="flex justify-center space-x-2">
                            <Button variant="outline" onClick={() => setMostrarResumenAusencia(false)} style={{ fontSize: '14px' }}>
                              Volver
                            </Button>
                            <Button onClick={confirmarAusenciaPeriodo} style={{ fontSize: '14px' }}>
                              Confirmar
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sección de ausencias creadas */}
                  {(ausenciasUnicas.length > 0 || ausenciasPeriodo.length > 0) && (
                    <div className="mt-6 space-y-4">
                      <div className="border-t pt-4">
                        <h3 className="text-sm font-medium mb-4">Ausencias creadas</h3>
                        
                        {/* Ausencias únicas */}
                        {ausenciasUnicas.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-medium text-muted-foreground">Ausencias únicas</h4>
                            {ausenciasUnicas.map((ausencia) => (
                              <div key={ausencia.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                                <div className="flex-1">
                                  <div className="text-sm font-medium">
                                    {ausencia.dia}/{ausencia.mes}/{ausencia.año}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Clases: {ausencia.clasesCanceladas.join(', ')}
                                  </div>
                                </div>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleEliminarAusencia(ausencia.id, 'unica')}
                                  className="h-8 px-3 text-xs"
                                >
                                  Eliminar
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Ausencias por período */}
                        {ausenciasPeriodo.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-medium text-muted-foreground">Ausencias por período</h4>
                            {ausenciasPeriodo.map((ausencia) => (
                              <div key={ausencia.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                                <div className="flex-1">
                                  <div className="text-sm font-medium">
                                    {formatDate(ausencia.fechaDesde)} - {formatDate(ausencia.fechaHasta)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Todas las clases del período
                                  </div>
                                </div>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleEliminarAusencia(ausencia.id, 'periodo')}
                                  className="h-8 px-3 text-xs"
                                >
                                  Eliminar
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
