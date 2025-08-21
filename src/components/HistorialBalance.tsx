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

  // Duración fija para todas las clases (en horas)
  const duracionClaseFija = 2;

  // Datos simulados de julio 2024 (TEMPORAL - BORRAR DESPUÉS)
  const turnosSimuladosJulio: Turno[] = [
    // Semana 1 (1-7 julio)
    {
      id: '1',
      fecha: '2024-07-01',
      hora_inicio: '09:00',
      hora_fin: '11:00',
      usuario: { full_name: 'María González', email: 'maria.gonzalez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '2',
      fecha: '2024-07-01',
      hora_inicio: '14:00',
      hora_fin: '16:00',
      usuario: { full_name: 'Carlos Rodríguez', email: 'carlos.rodriguez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '3',
      fecha: '2024-07-01',
      hora_inicio: '17:00',
      hora_fin: '18:00',
      usuario: { full_name: 'Ana Martínez', email: 'ana.martinez@email.com' },
      estado_pago: 'pendiente',
      tarifa_aplicada: 2500,
      duracion_horas: 1
    },
    {
      id: '4',
      fecha: '2024-07-02',
      hora_inicio: '10:00',
      hora_fin: '12:00',
      usuario: { full_name: 'Luis Fernández', email: 'luis.fernandez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '5',
      fecha: '2024-07-03',
      hora_inicio: '15:00',
      hora_fin: '17:00',
      usuario: { full_name: 'Sofía López', email: 'sofia.lopez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '6',
      fecha: '2024-07-04',
      hora_inicio: '09:00',
      hora_fin: '11:00',
      usuario: { full_name: 'María González', email: 'maria.gonzalez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '7',
      fecha: '2024-07-05',
      hora_inicio: '16:00',
      hora_fin: '18:00',
      usuario: { full_name: 'Diego Silva', email: 'diego.silva@email.com' },
      estado_pago: 'pendiente',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    
    // Semana 2 (8-14 julio)
    {
      id: '8',
      fecha: '2024-07-08',
      hora_inicio: '11:00',
      hora_fin: '13:00',
      usuario: { full_name: 'Carlos Rodríguez', email: 'carlos.rodriguez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '9',
      fecha: '2024-07-08',
      hora_inicio: '14:00',
      hora_fin: '15:00',
      usuario: { full_name: 'Valentina Ruiz', email: 'valentina.ruiz@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 1
    },
    {
      id: '10',
      fecha: '2024-07-09',
      hora_inicio: '09:00',
      hora_fin: '11:00',
      usuario: { full_name: 'Ana Martínez', email: 'ana.martinez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '11',
      fecha: '2024-07-10',
      hora_inicio: '15:00',
      hora_fin: '17:00',
      usuario: { full_name: 'Roberto Jiménez', email: 'roberto.jimenez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '12',
      fecha: '2024-07-11',
      hora_inicio: '10:00',
      hora_fin: '12:00',
      usuario: { full_name: 'Luis Fernández', email: 'luis.fernandez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '13',
      fecha: '2024-07-12',
      hora_inicio: '16:00',
      hora_fin: '18:00',
      usuario: { full_name: 'Sofía López', email: 'sofia.lopez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    
    // Semana 3 (15-21 julio)
    {
      id: '14',
      fecha: '2024-07-15',
      hora_inicio: '09:00',
      hora_fin: '11:00',
      usuario: { full_name: 'María González', email: 'maria.gonzalez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '15',
      fecha: '2024-07-15',
      hora_inicio: '14:00',
      hora_fin: '16:00',
      usuario: { full_name: 'Carlos Rodríguez', email: 'carlos.rodriguez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '16',
      fecha: '2024-07-16',
      hora_inicio: '11:00',
      hora_fin: '13:00',
      usuario: { full_name: 'Diego Silva', email: 'diego.silva@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '17',
      fecha: '2024-07-17',
      hora_inicio: '15:00',
      hora_fin: '17:00',
      usuario: { full_name: 'Valentina Ruiz', email: 'valentina.ruiz@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '18',
      fecha: '2024-07-18',
      hora_inicio: '09:00',
      hora_fin: '11:00',
      usuario: { full_name: 'Ana Martínez', email: 'ana.martinez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '19',
      fecha: '2024-07-19',
      hora_inicio: '16:00',
      hora_fin: '18:00',
      usuario: { full_name: 'Roberto Jiménez', email: 'roberto.jimenez@email.com' },
      estado_pago: 'pendiente',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    
    // Semana 4 (22-28 julio)
    {
      id: '20',
      fecha: '2024-07-22',
      hora_inicio: '10:00',
      hora_fin: '12:00',
      usuario: { full_name: 'Luis Fernández', email: 'luis.fernandez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '21',
      fecha: '2024-07-22',
      hora_inicio: '14:00',
      hora_fin: '16:00',
      usuario: { full_name: 'Sofía López', email: 'sofia.lopez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '22',
      fecha: '2024-07-23',
      hora_inicio: '09:00',
      hora_fin: '11:00',
      usuario: { full_name: 'María González', email: 'maria.gonzalez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '23',
      fecha: '2024-07-24',
      hora_inicio: '15:00',
      hora_fin: '17:00',
      usuario: { full_name: 'Carlos Rodríguez', email: 'carlos.rodriguez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '24',
      fecha: '2024-07-25',
      hora_inicio: '11:00',
      hora_fin: '13:00',
      usuario: { full_name: 'Diego Silva', email: 'diego.silva@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '25',
      fecha: '2024-07-26',
      hora_inicio: '16:00',
      hora_fin: '18:00',
      usuario: { full_name: 'Valentina Ruiz', email: 'valentina.ruiz@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    
    // Semana 5 (29-31 julio)
    {
      id: '26',
      fecha: '2024-07-29',
      hora_inicio: '09:00',
      hora_fin: '11:00',
      usuario: { full_name: 'Ana Martínez', email: 'ana.martinez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '27',
      fecha: '2024-07-29',
      hora_inicio: '14:00',
      hora_fin: '16:00',
      usuario: { full_name: 'Roberto Jiménez', email: 'roberto.jimenez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '28',
      fecha: '2024-07-30',
      hora_inicio: '10:00',
      hora_fin: '12:00',
      usuario: { full_name: 'Luis Fernández', email: 'luis.fernandez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    },
    {
      id: '29',
      fecha: '2024-07-31',
      hora_inicio: '15:00',
      hora_fin: '17:00',
      usuario: { full_name: 'Sofía López', email: 'sofia.lopez@email.com' },
      estado_pago: 'pagado',
      tarifa_aplicada: 2500,
      duracion_horas: 2
    }
  ];

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const años = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Obtener semanas del mes seleccionado
  const obtenerSemanasDelMes = () => {
    const primerDia = new Date(añoSeleccionado, mesSeleccionado, 1);
    const ultimoDia = new Date(añoSeleccionado, mesSeleccionado + 1, 0);
    const semanas = [];
    
    let fechaActual = new Date(primerDia);
    let semanaActual = 1;
    
    while (fechaActual <= ultimoDia) {
      const inicioSemana = new Date(fechaActual);
      const finSemana = new Date(fechaActual);
      finSemana.setDate(finSemana.getDate() + 6);
      
      if (finSemana > ultimoDia) {
        finSemana.setTime(ultimoDia.getTime());
      }
      
      semanas.push({
        numero: semanaActual,
        inicio: inicioSemana,
        fin: finSemana,
        label: `Semana ${semanaActual} (${inicioSemana.getDate()}-${finSemana.getDate()})`
      });
      
      fechaActual.setDate(fechaActual.getDate() + 7);
      semanaActual++;
    }
    
    return semanas;
  };

  // Obtener días del mes seleccionado
  const obtenerDiasDelMes = () => {
    const ultimoDia = new Date(añoSeleccionado, mesSeleccionado + 1, 0);
    const dias = [];
    
    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      const fecha = new Date(añoSeleccionado, mesSeleccionado, dia);
      dias.push({
        numero: dia,
        fecha: fecha,
        label: `${dia} de ${meses[mesSeleccionado]}`
      });
    }
    
    return dias;
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

  const cargarDatosHistorial = async (año: number, mes: number) => {
    try {
      // Verificar si es julio 2024 para usar datos simulados
      if (año === 2024 && mes === 6) { // mes 6 = julio (0-indexed)
        // Usar datos simulados de julio
        setTurnosIndividuales(turnosSimuladosJulio);
        
        // Calcular resumen mensual con duración fija
        const resumen = {
          ingresos_totales: turnosSimuladosJulio
            .filter(t => t.estado_pago === 'pagado')
            .reduce((total, turno) => total + (turno.tarifa_aplicada * duracionClaseFija), 0),
          total_horas: turnosSimuladosJulio.length * duracionClaseFija,
          cantidad_clientes: new Set(turnosSimuladosJulio.map(t => t.usuario.email)).size
        };
        setResumenMensual(resumen);
        
        // Agrupar por día (para mantener compatibilidad)
        const resumenDiario = HistorialService.agruparTurnosPorDia(turnosSimuladosJulio);
        setResumenDiario(resumenDiario);
        
        console.log('📊 Cargando datos simulados de julio 2024');
        return;
      }
      
      // Obtener turnos del período (datos reales)
      const turnos = await HistorialService.obtenerTurnosPeriodo(año, mes);
      
      // Guardar turnos individuales
      setTurnosIndividuales(turnos);
      
      // Calcular resumen mensual
      const resumen = HistorialService.calcularResumenMensual(turnos);
      setResumenMensual(resumen);
      
      // Agrupar por día (para mantener compatibilidad)
      const resumenDiario = HistorialService.agruparTurnosPorDia(turnos);
      setResumenDiario(resumenDiario);
    } catch (error) {
      console.error('Error al cargar datos del historial:', error);
      // En caso de error, mostrar datos vacíos
      setResumenMensual({
        ingresos_totales: 0,
        total_horas: 0,
        cantidad_clientes: 0
      });
      setResumenDiario([]);
      setTurnosIndividuales([]);
    }
  };

  const toggleFechaExpandida = (fecha: string) => {
    setFechaExpandida(fechaExpandida === fecha ? null : fecha);
  };

  const filtrarPorUsuario = (termino: string) => {
    setTerminoBusqueda(termino);
  };

  const exportarDatos = () => {
    const nombreArchivo = `historial-${meses[mesSeleccionado]}-${añoSeleccionado}.csv`;
    
    // Crear CSV con turnos individuales
    const headers = ['Fecha', 'Día', 'Alumno', 'Email', 'Horario', 'Duración', 'Estado Pago', 'Tarifa por Hora', 'Total'];
    const datosCSV = turnosIndividualesFiltrados.map(turno => [
      new Date(turno.fecha).toLocaleDateString('es-ES'),
      new Date(turno.fecha).toLocaleDateString('es-ES', { weekday: 'long' }),
      turno.usuario.full_name,
      turno.usuario.email,
      `${turno.hora_inicio} - ${turno.hora_fin}`,
      `${duracionClaseFija}h`,
      turno.estado_pago === 'pagado' ? 'Pagado' : 'Pendiente',
      `$${turno.tarifa_aplicada.toLocaleString()}`,
      `$${(turno.tarifa_aplicada * duracionClaseFija).toLocaleString()}`
    ]);
    
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
  };

  const turnosFiltrados = resumenDiario.map(dia => ({
    ...dia,
    turnos: dia.turnos.filter(turno =>
      turno.usuario.full_name.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
      turno.usuario.email.toLowerCase().includes(terminoBusqueda.toLowerCase())
    )
  }));

  // Filtrar turnos individuales según criterios
  const turnosIndividualesFiltrados = turnosIndividuales.filter(turno => {
    // Filtro por búsqueda
    const coincideBusqueda = 
      turno.usuario.full_name.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
      turno.usuario.email.toLowerCase().includes(terminoBusqueda.toLowerCase());
    
    if (!coincideBusqueda) return false;
    
    // Filtro por semana
    if (filtroSemana !== 'todas') {
      const semanaSeleccionada = parseInt(filtroSemana);
      const semanas = obtenerSemanasDelMes();
      const semana = semanas.find(s => s.numero === semanaSeleccionada);
      if (semana) {
        const fechaTurno = new Date(turno.fecha);
        if (fechaTurno < semana.inicio || fechaTurno > semana.fin) return false;
      }
    }
    
    // Filtro por día
    if (filtroDia !== 'todos') {
      const diaSeleccionado = parseInt(filtroDia);
      const fechaTurno = new Date(turno.fecha);
      if (fechaTurno.getDate() !== diaSeleccionado) return false;
    }
    
    // Filtro por estado de pago
    if (filtroPago !== 'todos') {
      if (turno.estado_pago !== filtroPago) return false;
    }
    
    return true;
  });

  const actualizarTarifa = async () => {
    try {
      const exito = await HistorialService.actualizarTarifa(tarifaPorHora);
      if (exito) {
        // Mostrar mensaje de éxito (podrías usar un toast aquí)
        console.log('Tarifa actualizada exitosamente');
      } else {
        console.error('Error al actualizar la tarifa');
      }
    } catch (error) {
      console.error('Error al actualizar la tarifa:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Selectores de período */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Seleccionar Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Año:</span>
              <Select value={añoSeleccionado.toString()} onValueChange={(value) => {
                const nuevoAño = parseInt(value);
                setAñoSeleccionado(nuevoAño);
                cargarDatosHistorial(nuevoAño, mesSeleccionado);
              }}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {años.map(año => (
                    <SelectItem key={año} value={año.toString()}>{año}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Mes:</span>
              <Select value={mesSeleccionado.toString()} onValueChange={(value) => {
                const nuevoMes = parseInt(value);
                setMesSeleccionado(nuevoMes);
                cargarDatosHistorial(añoSeleccionado, nuevoMes);
              }}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((mes, index) => (
                    <SelectItem key={index} value={index.toString()}>{mes}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métricas del mes - Panel de KPIs Premium */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-800">Indicadores Clave del Período</h3>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Comparado con mes anterior</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* KPI 1: Ingresos Netos */}
          <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <span className="text-sm font-medium text-slate-600">Ingresos Netos</span>
              </div>
              <div className="flex items-center gap-1 text-green-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <span className="text-xs font-medium">+12%</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mb-1">
              ${resumenMensual.ingresos_totales.toLocaleString()}
            </div>
            <div className="text-xs text-slate-500">
              {resumenMensual.ingresos_totales > 0 ? 
                `${Math.round((resumenMensual.ingresos_totales / (resumenMensual.ingresos_totales + 15000)) * 100)}% del objetivo mensual` : 
                'Sin ingresos registrados'
              }
            </div>
          </div>
          
          {/* KPI 2: Horas Reservadas */}
          <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-slate-600">Horas Reservadas</span>
              </div>
              <div className="flex items-center gap-1 text-blue-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <span className="text-xs font-medium">+8%</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mb-1">
              {resumenMensual.total_horas}h
            </div>
            <div className="text-xs text-slate-500">
              {resumenMensual.total_horas > 0 ? 
                `${Math.round((resumenMensual.total_horas / 80) * 100)}% de ocupación mensual` : 
                'Sin horas reservadas'
              }
            </div>
          </div>
          
          {/* KPI 3: Nuevos Usuarios */}
          <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-slate-600">Nuevos Usuarios</span>
              </div>
              <div className="flex items-center gap-1 text-purple-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <span className="text-xs font-medium">+15%</span>
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mb-1">
              {resumenMensual.cantidad_clientes}
            </div>
            <div className="text-xs text-slate-500">
              {resumenMensual.cantidad_clientes > 0 ? 
                `${Math.round((resumenMensual.cantidad_clientes / 12) * 100)}% del objetivo de crecimiento` : 
                'Sin nuevos usuarios'
              }
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico Interactivo de Métricas */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Análisis de Tendencia</h3>
            <div className="flex items-center gap-3">
              {/* Selector de tipo de gráfico */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Visualizar:</span>
                <Select value="ingresos" onValueChange={() => {}}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ingresos">Ingresos</SelectItem>
                    <SelectItem value="horas">Horas</SelectItem>
                    <SelectItem value="usuarios">Usuarios</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Selector de tipo de gráfico */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                <button className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white rounded-md shadow-sm">
                  Líneas
                </button>
                <button className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-600">
                  Barras
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          {/* Gráfico de Líneas Simulado */}
          <div className="h-64 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-slate-200 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-slate-800 mb-2">Gráfico Interactivo</h4>
              <p className="text-sm text-slate-600 mb-4">
                Visualización de {meses[mesSeleccionado]} {añoSeleccionado}
              </p>
              
              {/* Datos simulados del gráfico */}
              <div className="grid grid-cols-4 gap-4 text-xs">
                <div className="text-center">
                  <div className="font-semibold text-blue-600">Semana 1</div>
                  <div className="text-slate-500">$32,500</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-blue-600">Semana 2</div>
                  <div className="text-slate-500">$28,000</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-blue-600">Semana 3</div>
                  <div className="text-slate-500">$35,000</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-blue-600">Semana 4</div>
                  <div className="text-slate-500">$34,500</div>
                </div>
              </div>
              
              <div className="mt-4 text-xs text-slate-500">
                💡 Pasa el cursor sobre los puntos para ver detalles
              </div>
            </div>
          </div>
          
          {/* Leyenda y estadísticas adicionales */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="text-sm font-medium text-green-800">Mejor Día</div>
              <div className="text-lg font-bold text-green-600">15 Julio</div>
              <div className="text-xs text-green-600">$12,500</div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm font-medium text-blue-800">Promedio Diario</div>
              <div className="text-lg font-bold text-blue-600">$4,194</div>
              <div className="text-xs text-blue-600">Por día</div>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div className="text-sm font-medium text-purple-800">Tendencia</div>
              <div className="text-lg font-bold text-purple-600">↗️ +5.2%</div>
              <div className="text-xs text-purple-600">vs semana anterior</div>
            </div>
          </div>
        </div>
      </div>

      {/* Búsqueda y exportación */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Filtros principales */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Filtro por semana */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Semana</label>
                <Select value={filtroSemana} onValueChange={setFiltroSemana}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las semanas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las semanas</SelectItem>
                    {obtenerSemanasDelMes().map(semana => (
                      <SelectItem key={semana.numero} value={semana.numero.toString()}>
                        {semana.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Filtro por día */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Día</label>
                <Select value={filtroDia} onValueChange={setFiltroDia}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los días" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los días</SelectItem>
                    {obtenerDiasDelMes().map(dia => (
                      <SelectItem key={dia.numero} value={dia.numero.toString()}>
                        {dia.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Filtro por estado de pago */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Estado de Pago</label>
                <Select value={filtroPago} onValueChange={setFiltroPago}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los pagos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los pagos</SelectItem>
                    <SelectItem value="pagado">Pagado</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Búsqueda por nombre/email */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Buscar Alumno</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nombre o email..."
                    value={terminoBusqueda}
                    onChange={(e) => filtrarPorUsuario(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
            
            {/* Botón de exportación */}
            <div className="flex justify-end">
              <Button onClick={exportarDatos} variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Exportar a CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de historial mensual */}
      <Card>
        <CardHeader>
          <CardTitle>Historial Mensual - {meses[mesSeleccionado]} {añoSeleccionado}</CardTitle>
          <div className="text-sm text-muted-foreground">
            {turnosIndividualesFiltrados.length} turnos encontrados
            {añoSeleccionado === 2024 && mesSeleccionado === 6 && (
              <span className="ml-2 inline-flex items-center gap-1">
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  📊 Datos Simulados
                </Badge>
                <span className="text-xs">(29 turnos, 8 clientes únicos)</span>
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Fecha</th>
                  <th className="text-left p-3 font-medium">Alumno</th>
                  <th className="text-left p-3 font-medium">Horario</th>
                  <th className="text-left p-3 font-medium">Estado de Pago</th>
                  <th className="text-left p-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {turnosIndividualesFiltrados.map((turno) => (
                  <tr key={turno.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">
                      <div className="text-sm">
                        <div className="font-medium">
                          {new Date(turno.fecha).getDate()} de {meses[mesSeleccionado]}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(turno.fecha).toLocaleDateString('es-ES', { weekday: 'long' })}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div>
                        <div className="font-medium">{turno.usuario.full_name}</div>
                        <div className="text-sm text-muted-foreground">{turno.usuario.email}</div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-sm">
                        {turno.hora_inicio} - {turno.hora_fin}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant={turno.estado_pago === 'pagado' ? 'default' : 'secondary'}>
                        {turno.estado_pago === 'pagado' ? 'Pagado' : 'Pendiente'}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-green-600">
                        ${(turno.tarifa_aplicada * duracionClaseFija).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ${turno.tarifa_aplicada.toLocaleString()}/h
                      </div>
                    </td>
                  </tr>
                ))}
                
                {turnosIndividualesFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8">
                      <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No hay turnos para los filtros seleccionados</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Configuración de tarifa */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Tarifa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Tarifa por Hora:</span>
              <Input
                type="number"
                value={tarifaPorHora}
                onChange={(e) => setTarifaPorHora(parseFloat(e.target.value) || 0)}
                className="w-24"
                min="0"
                step="0.01"
              />
              <span className="text-sm text-muted-foreground">ARS</span>
            </div>
            <Button variant="outline" size="sm" onClick={actualizarTarifa}>
              Actualizar Tarifa
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Esta tarifa se aplicará a los nuevos turnos. Los turnos existentes mantendrán su tarifa original.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
