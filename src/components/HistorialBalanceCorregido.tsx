import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  DollarSign, 
  Clock, 
  Users, 
  Search, 
  Download,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Turno, ResumenMensual, ResumenDiario } from '@/types/historial';
import { HistorialService } from '@/services/historialService';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

export const HistorialBalance: React.FC = () => {
  const [añoSeleccionado, setAñoSeleccionado] = useState(new Date().getFullYear());
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth());
  const [resumenMensual, setResumenMensual] = useState<ResumenMensual>({
    ingresos_totales: 0,
    total_horas: 0,
    cantidad_clientes: 0
  });
  const [resumenDiario, setResumenDiario] = useState<ResumenDiario[]>([]);
  const [turnosIndividuales, setTurnosIndividuales] = useState<Turno[]>([]);
  const [fechaExpandida, setFechaExpandida] = useState<string | null>(null);
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [tarifaPorHora, setTarifaPorHora] = useState(2500); // Tarifa por defecto en pesos argentinos
  const [filtroSemana, setFiltroSemana] = useState<string>('todas');
  const [filtroDia, setFiltroDia] = useState<string>('todos');
  const [filtroPago, setFiltroPago] = useState<string>('todos');
  const [ausenciasAdmin, setAusenciasAdmin] = useState<any[]>([]);

  // Duración fija para todas las clases (en horas)
  const duracionClaseFija = 2;

  // Cargar ausencias del admin
  const cargarAusenciasAdmin = async () => {
    try {
      const { data, error } = await supabase
        .from('ausencias_admin')
        .select('*')
        .eq('activo', true);

      if (error) {
        console.error('❌ Error al cargar ausencias del admin:', error);
        return;
      }

      setAusenciasAdmin(data || []);
      console.log('✅ Ausencias del admin cargadas:', data?.length || 0);
    } catch (error) {
      console.error('❌ Error inesperado al cargar ausencias:', error);
    }
  };

  // Función helper para verificar si una fecha+clase está bloqueada por ausencia del admin
  const estaClaseBloqueada = (fecha: Date, claseNumero?: number): boolean => {
    const fechaStr = format(fecha, 'yyyy-MM-dd');
    
    return ausenciasAdmin.some(ausencia => {
      // Verificar ausencia única
      if (ausencia.tipo_ausencia === 'unica') {
        const fechaAusenciaISO = ausencia.fecha_inicio.split('T')[0];
        
        if (fechaAusenciaISO === fechaStr) {
          // Si no hay clases_canceladas específicas, se bloquean todas
          if (!ausencia.clases_canceladas || ausencia.clases_canceladas.length === 0) {
            return true;
          }
          // Si hay clases específicas, verificar si esta clase está en la lista
          if (claseNumero && ausencia.clases_canceladas.includes(claseNumero)) {
            return true;
          }
        }
      }
      
      // Verificar ausencia por período
      if (ausencia.tipo_ausencia === 'periodo') {
        const fechaInicio = new Date(ausencia.fecha_inicio);
        const fechaFin = new Date(ausencia.fecha_fin);
        const fechaClase = new Date(fecha);
        
        if (fechaClase >= fechaInicio && fechaClase <= fechaFin) {
          return true;
        }
      }
      
      return false;
    });
  };

  // Datos simulados de julio 2024 (TEMPORAL - BORRAR DESPUÉS)
  const turnosSimuladosJulio: Turno[] = [
    // Semana 1 (1-7 julio)
    {
      id: '1',
      fecha: '2024-07-01',
      hora_inicio: '08:00',
      hora_fin: '10:00',
      usuario: { email: 'cliente1@test.com', full_name: 'Cliente 1' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      clase_numero: 1
    },
    {
      id: '2',
      fecha: '2024-07-02',
      hora_inicio: '09:00',
      hora_fin: '11:00',
      usuario: { email: 'cliente2@test.com', full_name: 'Cliente 2' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      clase_numero: 2
    },
    // ... más datos simulados
  ];

  const cargarDatosHistorial = async (año: number, mes: number) => {
    try {
      // Cargar ausencias del admin primero
      await cargarAusenciasAdmin();
      
      // Verificar si es julio 2024 para usar datos simulados
      if (año === 2024 && mes === 6) { // mes 6 = julio (0-indexed)
        // Usar datos simulados de julio
        setTurnosIndividuales(turnosSimuladosJulio);
        
        // Calcular resumen mensual con duración fija, excluyendo clases bloqueadas
        const turnosValidos = turnosSimuladosJulio.filter(turno => {
          const fechaTurno = new Date(turno.fecha);
          return !estaClaseBloqueada(fechaTurno, turno.clase_numero);
        });
        
        const resumen = {
          ingresos_totales: turnosValidos
            .filter(t => t.estado_pago === 'pagado')
            .reduce((total, turno) => total + (turno.tarifa_aplicada * duracionClaseFija), 0),
          total_horas: turnosValidos.length * duracionClaseFija,
          cantidad_clientes: new Set(turnosValidos.map(t => t.usuario.email)).size
        };
        setResumenMensual(resumen);
        
        // Agrupar por día (para mantener compatibilidad)
        const resumenDiario = HistorialService.agruparTurnosPorDia(turnosValidos);
        setResumenDiario(resumenDiario);
        
        console.log('📊 Cargando datos simulados de julio 2024 (excluyendo clases bloqueadas)');
        return;
      }
      
      // Obtener turnos del período (datos reales)
      const turnos = await HistorialService.obtenerTurnosPeriodo(año, mes);
      
      // Filtrar turnos que no estén bloqueados por ausencias del admin
      const turnosValidos = turnos.filter(turno => {
        const fechaTurno = new Date(turno.fecha);
        return !estaClaseBloqueada(fechaTurno, turno.clase_numero);
      });
      
      // Guardar turnos individuales (solo los válidos)
      setTurnosIndividuales(turnosValidos);
      
      // Calcular resumen mensual (solo con turnos válidos)
      const resumen = HistorialService.calcularResumenMensual(turnosValidos);
      setResumenMensual(resumen);
      
      // Agrupar por día (para mantener compatibilidad)
      const resumenDiario = HistorialService.agruparTurnosPorDia(turnosValidos);
      setResumenDiario(resumenDiario);
      
      console.log(`📊 Cargados ${turnosValidos.length} turnos válidos de ${turnos.length} totales (excluyendo ${turnos.length - turnosValidos.length} bloqueados por ausencias del admin)`);
    } catch (error) {
      console.error('Error al cargar datos del historial:', error);
    }
  };

  // Cargar datos al montar el componente
  useEffect(() => {
    // Por defecto mostrar julio 2024 (datos simulados)
    setMesSeleccionado(6); // Julio (0-indexed)
    setAñoSeleccionado(2024);
    
    cargarDatosHistorial(2024, 6);
    cargarTarifaActual();
  }, []);

  const cargarTarifaActual = async () => {
    try {
      const tarifa = await HistorialService.obtenerTarifaActual();
      setTarifaPorHora(tarifa);
    } catch (error) {
      console.error('Error al cargar tarifa:', error);
    }
  };

  // Resto del componente...
  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Historial de Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500">
            Componente corregido para excluir clases bloqueadas por ausencias del admin
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
