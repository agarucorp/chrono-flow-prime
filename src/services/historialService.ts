import { supabase } from '@/lib/supabase';
import { Turno, ResumenMensual, ResumenDiario } from '@/types/historial';

export class HistorialService {
  // Obtener turnos de un período específico
  static async obtenerTurnosPeriodo(año: number, mes: number): Promise<Turno[]> {
    const fechaInicio = new Date(año, mes, 1).toISOString();
    const fechaFin = new Date(año, mes + 1, 0).toISOString();
    
    const { data, error } = await supabase
      .from('turnos')
      .select(`
        id,
        fecha,
        hora_inicio,
        hora_fin,
        estado_pago,
        tarifa_aplicada,
        duracion_horas,
        usuarios!inner(
          full_name,
          email
        )
      `)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha', { ascending: true });

    if (error) {
      console.error('Error al obtener turnos:', error);
      return [];
    }

    // Transformar los datos al formato esperado
    return data?.map(turno => ({
      id: turno.id,
      fecha: turno.fecha,
      hora_inicio: turno.hora_inicio,
      hora_fin: turno.hora_fin,
      usuario: {
        full_name: turno.usuarios.full_name,
        email: turno.usuarios.email
      },
      estado_pago: turno.estado_pago,
      tarifa_aplicada: turno.tarifa_aplicada,
      duracion_horas: turno.duracion_horas
    })) || [];
  }

  // Calcular resumen mensual
  static calcularResumenMensual(turnos: Turno[]): ResumenMensual {
    const ingresosTotales = turnos
      .filter(t => t.estado_pago === 'pagado')
      .reduce((sum, t) => sum + (t.tarifa_aplicada * t.duracion_horas), 0);
    
    const totalHoras = turnos.reduce((sum, t) => sum + t.duracion_horas, 0);
    
    const clientesUnicos = new Set(
      turnos.map(t => t.usuario.email)
    ).size;

    return {
      ingresos_totales: ingresosTotales,
      total_horas: totalHoras,
      cantidad_clientes: clientesUnicos
    };
  }

  // Agrupar turnos por día
  static agruparTurnosPorDia(turnos: Turno[]): ResumenDiario[] {
    const turnosPorDia = new Map<string, Turno[]>();
    
    turnos.forEach(turno => {
      const fecha = turno.fecha;
      if (!turnosPorDia.has(fecha)) {
        turnosPorDia.set(fecha, []);
      }
      turnosPorDia.get(fecha)!.push(turno);
    });

    return Array.from(turnosPorDia.entries()).map(([fecha, turnosDia]) => {
      const ingresosDiarios = turnosDia
        .filter(t => t.estado_pago === 'pagado')
        .reduce((sum, t) => sum + (t.tarifa_aplicada * t.duracion_horas), 0);
      
      const horasTotales = turnosDia.reduce((sum, t) => sum + t.duracion_horas, 0);

      return {
        fecha,
        ingresos_diarios: ingresosDiarios,
        cantidad_turnos: turnosDia.length,
        horas_totales: horasTotales,
        turnos: turnosDia
      };
    }).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }

  // Obtener tarifa actual
  static async obtenerTarifaActual(): Promise<number> {
    const { data, error } = await supabase
      .from('configuracion_tarifas')
      .select('tarifa_actual')
      .single();

    if (error) {
      console.error('Error al obtener tarifa:', error);
      return 2500; // Tarifa por defecto en pesos argentinos
    }

    return data?.tarifa_actual || 2500;
  }

  // Actualizar tarifa
  static async actualizarTarifa(nuevaTarifa: number): Promise<boolean> {
    const { error } = await supabase
      .from('configuracion_tarifas')
      .upsert({
        id: 1, // Asumiendo que solo hay una configuración
        tarifa_actual: nuevaTarifa,
        fecha_actualizacion: new Date().toISOString()
      });

    if (error) {
      console.error('Error al actualizar tarifa:', error);
      return false;
    }

    return true;
  }

  // Exportar datos a CSV
  static exportarCSV(resumenDiario: ResumenDiario[], nombreArchivo: string): void {
    const headers = ['Fecha', 'Ingresos', 'Cantidad Turnos', 'Horas'];
    const datosCSV = resumenDiario.map(d => 
      [d.fecha, d.ingresos_diarios, d.cantidad_turnos, d.horas_totales]
    );
    
    const csvContent = [headers, ...datosCSV]
      .map(row => row.join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', nombreArchivo);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}
