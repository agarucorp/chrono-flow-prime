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

      {/* Métricas del mes */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales del Mes</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${resumenMensual.ingresos_totales.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total de pagos registrados
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Horas Reservadas</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {resumenMensual.total_horas}h
            </div>
            <p className="text-xs text-muted-foreground">
              Horas totales de turnos
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Atendidos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {resumenMensual.cantidad_clientes}
            </div>
            <p className="text-xs text-muted-foreground">
              Usuarios únicos con turnos
            </p>
          </CardContent>
        </Card>
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
