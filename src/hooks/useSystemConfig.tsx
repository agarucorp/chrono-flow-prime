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

      // Cargar horarios fijos (usar horarios_clase sin filtros problemáticos)
      let horarios = [];
      let errorHorarios = null;
      
      try {
        // Consultar horarios_clase sin filtros que puedan causar error 400
        const { data, error } = await supabase
          .from('horarios_clase')
          .select('*');
        horarios = data;
        errorHorarios = error;
      } catch (err: any) {
        if (err.code !== 'PGRST205') { // Ignore "table does not exist" error
          console.error('Error cargando horarios fijos:', err);
        }
        errorHorarios = err;
      }

      if (errorHorarios) {
        // Si hay error, usar datos por defecto
        console.log('Error cargando horarios_clase, usando horarios por defecto');
        setHorariosFijos([]);
      } else {
        setHorariosFijos(horarios || []);
      }

      // Cargar ausencias eventuales (usar ausencias_admin)
      let ausencias = [];
      let errorAusencias = null;
      
      try {
        const { data, error } = await supabase
          .from('ausencias_admin')
          .select('*')
          .eq('activo', true)
          .order('fecha_inicio', { ascending: false });
        ausencias = data;
        errorAusencias = error;
      } catch (err: any) {
        if (err.code !== 'PGRST205') { // Ignore "table does not exist" error
          console.error('Error cargando ausencias eventuales:', err);
        }
        errorAusencias = err;
      }

      if (errorAusencias) {
        console.error('Error cargando ausencias eventuales:', errorAusencias);
      } else {
        setAusenciasEventuales(ausencias || []);
      }

      // Cargar configuración del sistema (usar configuracion_admin)
      let config = [];
      let errorConfig = null;
      
      try {
        const { data, error } = await supabase
          .from('configuracion_admin')
          .select('*')
          .eq('sistema_activo', true);
        config = data;
        errorConfig = error;
      } catch (err: any) {
        if (err.code !== 'PGRST205') { // Ignore "table does not exist" error
          console.error('Error cargando configuración del sistema:', err);
        }
        errorConfig = err;
      }

      if (errorConfig) {
        console.error('Error cargando configuración del sistema:', errorConfig);
      } else {
        setConfiguracionSistema(config || []);
      }

      // Cargar configuración de tarifas (usar configuracion_admin directamente)
      try {
        const { data: cfgAdminTarifa } = await supabase
          .from('configuracion_admin')
          .select('precio_clase, tarifa_horaria, moneda')
          .eq('sistema_activo', true)
          .limit(1)
          .maybeSingle();
        
        const tarifa = cfgAdminTarifa ? (Number(cfgAdminTarifa.precio_clase ?? cfgAdminTarifa.tarifa_horaria) || 0) : 0;
        const moneda = (cfgAdminTarifa && (cfgAdminTarifa as any).moneda) ? (cfgAdminTarifa as any).moneda : 'ARS';
        setConfiguracionTarifas(tarifa > 0 ? [{ id: 'admin', tipo_clase: 'general', tarifa_por_clase: tarifa, moneda, activo: true }] : []);
      } catch (error) {
        console.error('Error cargando configuración de tarifas:', error);
        setConfiguracionTarifas([]);
      }

      // Cargar configuración de capacidad (usar configuracion_admin directamente)
      try {
        const { data: cfgAdminCap } = await supabase
          .from('configuracion_admin')
          .select('max_alumnos_por_clase')
          .eq('sistema_activo', true)
          .limit(1)
          .maybeSingle();
        
        setConfiguracionCapacidad(cfgAdminCap ? [{ id: 'admin', tipo_clase: 'general', max_alumnos_por_clase: Number(cfgAdminCap.max_alumnos_por_clase) || 1, activo: true }] : []);
      } catch (error) {
        console.error('Error cargando configuración de capacidad:', error);
        setConfiguracionCapacidad([]);
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
      // Intentar tabla específica; si falla, actualizar configuracion_admin
      const { error } = await supabase
        .from('configuracion_tarifas')
        .upsert({
          ...tarifa,
          activo: true,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error actualizando configuración de tarifas:', error);
        // Intento 1: precio_clase
        const { error: adminError1 } = await supabase
          .from('configuracion_admin')
          .update({ precio_clase: tarifa.tarifa_por_clase, moneda: tarifa.moneda, updated_at: new Date().toISOString() })
          .eq('activa', true);
        if (adminError1) {
          // Intento 2: tarifa_horaria (columna alternativa)
          const { error: adminError2 } = await supabase
            .from('configuracion_admin')
            .update({ tarifa_horaria: tarifa.tarifa_por_clase, moneda: tarifa.moneda, updated_at: new Date().toISOString() })
            .eq('activa', true);
          if (adminError2) {
            return { success: false, error: adminError2.message };
          }
        }
        await cargarConfiguraciones();
        return { success: true };
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
        const { error: adminError } = await supabase
          .from('configuracion_admin')
          .update({ max_alumnos_por_clase: capacidad.max_alumnos_por_clase, updated_at: new Date().toISOString() })
          .eq('activa', true);
        if (adminError) {
          return { success: false, error: adminError.message };
        }
        await cargarConfiguraciones();
        return { success: true };
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



