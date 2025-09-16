import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface HorarioFijo {
  id: string;
  clase_numero: number;
  nombre_clase: string;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
}

interface AusenciaEventual {
  id: string;
  tipo_ausencia: 'unica' | 'periodo';
  fecha_inicio: string;
  fecha_fin?: string;
  clases_canceladas?: number[];
  motivo?: string;
  activo: boolean;
}

interface ConfiguracionSistema {
  id: string;
  clave: string;
  valor: string;
  descripcion?: string;
  tipo_dato: 'string' | 'number' | 'boolean' | 'json';
}

interface ConfiguracionTarifa {
  id: string;
  tipo_clase: string;
  tarifa_por_clase: number;
  moneda: string;
  activo: boolean;
}

interface ConfiguracionCapacidad {
  id: string;
  tipo_clase: string;
  max_alumnos_por_clase: number;
  activo: boolean;
}

export const useSystemConfig = () => {
  const [horariosFijos, setHorariosFijos] = useState<HorarioFijo[]>([]);
  const [ausenciasEventuales, setAusenciasEventuales] = useState<AusenciaEventual[]>([]);
  const [configuracionSistema, setConfiguracionSistema] = useState<ConfiguracionSistema[]>([]);
  const [configuracionTarifas, setConfiguracionTarifas] = useState<ConfiguracionTarifa[]>([]);
  const [configuracionCapacidad, setConfiguracionCapacidad] = useState<ConfiguracionCapacidad[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar todas las configuraciones
  const cargarConfiguraciones = async () => {
    try {
      setLoading(true);

      // Cargar horarios fijos
      const { data: horarios, error: errorHorarios } = await supabase
        .from('horarios_fijos_sistema')
        .select('*')
        .eq('activo', true)
        .order('clase_numero');

      if (errorHorarios) {
        console.error('Error cargando horarios fijos:', errorHorarios);
      } else {
        setHorariosFijos(horarios || []);
      }

      // Cargar ausencias eventuales
      const { data: ausencias, error: errorAusencias } = await supabase
        .from('ausencias_eventuales')
        .select('*')
        .eq('activo', true)
        .order('fecha_inicio', { ascending: false });

      if (errorAusencias) {
        console.error('Error cargando ausencias eventuales:', errorAusencias);
      } else {
        setAusenciasEventuales(ausencias || []);
      }

      // Cargar configuración del sistema
      const { data: config, error: errorConfig } = await supabase
        .from('configuracion_sistema')
        .select('*');

      if (errorConfig) {
        console.error('Error cargando configuración del sistema:', errorConfig);
      } else {
        setConfiguracionSistema(config || []);
      }

      // Cargar configuración de tarifas
      const { data: tarifas, error: errorTarifas } = await supabase
        .from('configuracion_tarifas')
        .select('*')
        .eq('activo', true);

      if (errorTarifas) {
        console.error('Error cargando configuración de tarifas:', errorTarifas);
      } else {
        setConfiguracionTarifas(tarifas || []);
      }

      // Cargar configuración de capacidad
      const { data: capacidad, error: errorCapacidad } = await supabase
        .from('configuracion_capacidad')
        .select('*')
        .eq('activo', true);

      if (errorCapacidad) {
        console.error('Error cargando configuración de capacidad:', errorCapacidad);
      } else {
        setConfiguracionCapacidad(capacidad || []);
      }

    } catch (error) {
      console.error('Error inesperado cargando configuraciones:', error);
    } finally {
      setLoading(false);
    }
  };

  // Actualizar horarios fijos
  const actualizarHorariosFijos = async (horarios: Omit<HorarioFijo, 'id'>[]) => {
    try {
      // Eliminar horarios existentes
      await supabase
        .from('horarios_fijos_sistema')
        .update({ activo: false })
        .eq('activo', true);

      // Insertar nuevos horarios
      const { error } = await supabase
        .from('horarios_fijos_sistema')
        .insert(horarios.map(h => ({
          ...h,
          activo: true
        })));

      if (error) {
        console.error('Error actualizando horarios fijos:', error);
        return { success: false, error: error.message };
      }

      await cargarConfiguraciones();
      return { success: true };
    } catch (error) {
      console.error('Error inesperado actualizando horarios:', error);
      return { success: false, error: 'Error inesperado' };
    }
  };

  // Agregar ausencia eventual
  const agregarAusenciaEventual = async (ausencia: Omit<AusenciaEventual, 'id'>) => {
    try {
      const { error } = await supabase
        .from('ausencias_eventuales')
        .insert({
          ...ausencia,
          activo: true
        });

      if (error) {
        console.error('Error agregando ausencia eventual:', error);
        return { success: false, error: error.message };
      }

      await cargarConfiguraciones();
      return { success: true };
    } catch (error) {
      console.error('Error inesperado agregando ausencia:', error);
      return { success: false, error: 'Error inesperado' };
    }
  };

  // Eliminar ausencia eventual
  const eliminarAusenciaEventual = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ausencias_eventuales')
        .update({ activo: false })
        .eq('id', id);

      if (error) {
        console.error('Error eliminando ausencia eventual:', error);
        return { success: false, error: error.message };
      }

      await cargarConfiguraciones();
      return { success: true };
    } catch (error) {
      console.error('Error inesperado eliminando ausencia:', error);
      return { success: false, error: 'Error inesperado' };
    }
  };

  // Actualizar configuración del sistema
  const actualizarConfiguracionSistema = async (clave: string, valor: string) => {
    try {
      const { error } = await supabase
        .from('configuracion_sistema')
        .upsert({
          clave,
          valor,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error actualizando configuración del sistema:', error);
        return { success: false, error: error.message };
      }

      await cargarConfiguraciones();
      return { success: true };
    } catch (error) {
      console.error('Error inesperado actualizando configuración:', error);
      return { success: false, error: 'Error inesperado' };
    }
  };

  // Actualizar configuración de tarifas
  const actualizarConfiguracionTarifas = async (tarifa: Omit<ConfiguracionTarifa, 'id'>) => {
    try {
      const { error } = await supabase
        .from('configuracion_tarifas')
        .upsert({
          ...tarifa,
          activo: true,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error actualizando configuración de tarifas:', error);
        return { success: false, error: error.message };
      }

      await cargarConfiguraciones();
      return { success: true };
    } catch (error) {
      console.error('Error inesperado actualizando tarifas:', error);
      return { success: false, error: 'Error inesperado' };
    }
  };

  // Actualizar configuración de capacidad
  const actualizarConfiguracionCapacidad = async (capacidad: Omit<ConfiguracionCapacidad, 'id'>) => {
    try {
      const { error } = await supabase
        .from('configuracion_capacidad')
        .upsert({
          ...capacidad,
          activo: true,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error actualizando configuración de capacidad:', error);
        return { success: false, error: error.message };
      }

      await cargarConfiguraciones();
      return { success: true };
    } catch (error) {
      console.error('Error inesperado actualizando capacidad:', error);
      return { success: false, error: 'Error inesperado' };
    }
  };

  // Funciones de utilidad
  const obtenerConfiguracion = (clave: string) => {
    return configuracionSistema.find(config => config.clave === clave)?.valor;
  };

  const obtenerTarifaActual = () => {
    return configuracionTarifas.find(t => t.activo)?.tarifa_por_clase || 0;
  };

  const obtenerCapacidadActual = () => {
    return configuracionCapacidad.find(c => c.activo)?.max_alumnos_por_clase || 1;
  };

  const obtenerHorariosActivos = () => {
    return horariosFijos.filter(h => h.activo);
  };

  const obtenerAusenciasActivas = () => {
    return ausenciasEventuales.filter(a => a.activo);
  };

  // Cargar configuraciones al montar el hook
  useEffect(() => {
    cargarConfiguraciones();
  }, []);

  return {
    // Estados
    horariosFijos,
    ausenciasEventuales,
    configuracionSistema,
    configuracionTarifas,
    configuracionCapacidad,
    loading,

    // Funciones de actualización
    actualizarHorariosFijos,
    agregarAusenciaEventual,
    eliminarAusenciaEventual,
    actualizarConfiguracionSistema,
    actualizarConfiguracionTarifas,
    actualizarConfiguracionCapacidad,

    // Funciones de utilidad
    obtenerConfiguracion,
    obtenerTarifaActual,
    obtenerCapacidadActual,
    obtenerHorariosActivos,
    obtenerAusenciasActivas,
    cargarConfiguraciones
  };
};



