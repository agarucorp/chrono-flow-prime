export interface Turno {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  usuario: {
    full_name: string;
    email: string;
  };
  estado_pago: 'pagado' | 'pendiente';
  tarifa_aplicada: number;
  duracion_horas: number;
}

export interface ResumenMensual {
  ingresos_totales: number;
  total_horas: number;
  cantidad_clientes: number;
}

export interface ResumenDiario {
  fecha: string;
  ingresos_diarios: number;
  cantidad_turnos: number;
  horas_totales: number;
  turnos: Turno[];
}

export interface ConfiguracionTarifa {
  tarifa_actual: number;
  fecha_actualizacion: string;
  historial_tarifas: {
    tarifa: number;
    fecha_inicio: string;
    fecha_fin?: string;
  }[];
}
