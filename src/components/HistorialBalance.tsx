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
  const [fechaExpandida, setFechaExpandida] = useState<string | null>(null);
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [tarifaPorHora, setTarifaPorHora] = useState(2500); // Tarifa por defecto en pesos argentinos

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const años = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Cargar datos al montar el componente
  useEffect(() => {
    // Por defecto mostrar mes anterior
    const mesAnterior = new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1;
    const añoAnterior = new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear();
    
    setMesSeleccionado(mesAnterior);
    setAñoSeleccionado(añoAnterior);
    
    cargarDatosHistorial(añoAnterior, mesAnterior);
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
      // Obtener turnos del período
      const turnos = await HistorialService.obtenerTurnosPeriodo(año, mes);
      
      // Calcular resumen mensual
      const resumen = HistorialService.calcularResumenMensual(turnos);
      setResumenMensual(resumen);
      
      // Agrupar por día
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
    }
  };

  const handleCambioPeriodo = () => {
    cargarDatosHistorial(añoSeleccionado, mesSeleccionado);
  };

  const toggleFechaExpandida = (fecha: string) => {
    setFechaExpandida(fechaExpandida === fecha ? null : fecha);
  };

  const filtrarPorUsuario = (termino: string) => {
    setTerminoBusqueda(termino);
  };

  const exportarDatos = () => {
    const nombreArchivo = `historial-${meses[mesSeleccionado]}-${añoSeleccionado}.csv`;
    HistorialService.exportarCSV(resumenDiario, nombreArchivo);
  };

  const turnosFiltrados = resumenDiario.map(dia => ({
    ...dia,
    turnos: dia.turnos.filter(turno =>
      turno.usuario.full_name.toLowerCase().includes(terminoBusqueda.toLowerCase()) ||
      turno.usuario.email.toLowerCase().includes(terminoBusqueda.toLowerCase())
    )
  }));

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
              <Select value={añoSeleccionado.toString()} onValueChange={(value) => setAñoSeleccionado(parseInt(value))}>
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
              <Select value={mesSeleccionado.toString()} onValueChange={(value) => setMesSeleccionado(parseInt(value))}>
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
            
            <Button onClick={handleCambioPeriodo} variant="outline">
              Cargar Datos
            </Button>
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
          <div className="flex flex-col md:flex-row gap-4 justify-between">
            <div className="flex-1 relative max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={terminoBusqueda}
                onChange={(e) => filtrarPorUsuario(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={exportarDatos} variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Exportar a CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de historial mensual */}
      <Card>
        <CardHeader>
          <CardTitle>Historial Mensual - {meses[mesSeleccionado]} {añoSeleccionado}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Fecha</th>
                  <th className="text-left p-3 font-medium">Ingresos Diarios</th>
                  <th className="text-left p-3 font-medium">Cantidad de Turnos</th>
                  <th className="text-left p-3 font-medium">Horas Totales</th>
                  <th className="text-left p-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {turnosFiltrados.map((dia) => (
                  <React.Fragment key={dia.fecha}>
                    <tr className="border-b hover:bg-muted/50 cursor-pointer" 
                        onClick={() => toggleFechaExpandida(dia.fecha)}>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {fechaExpandida === dia.fecha ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          {new Date(dia.fecha).getDate()} de {meses[mesSeleccionado]}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`font-medium ${dia.ingresos_diarios > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                          ${dia.ingresos_diarios.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3">{dia.cantidad_turnos}</td>
                      <td className="p-3">{dia.horas_totales}h</td>
                      <td className="p-3">
                        <Button variant="ghost" size="sm">
                          {fechaExpandida === dia.fecha ? 'Ocultar' : 'Ver Detalle'}
                        </Button>
                      </td>
                    </tr>
                    
                    {/* Vista expandida del día */}
                    {fechaExpandida === dia.fecha && (
                      <tr>
                        <td colSpan={5} className="p-0">
                          <div className="bg-muted/30 p-4">
                            <h4 className="font-medium mb-3">Turnos del {new Date(dia.fecha).getDate()} de {meses[mesSeleccionado]}</h4>
                            {dia.turnos.length > 0 ? (
                              <div className="space-y-3">
                                {dia.turnos.map((turno) => (
                                  <div key={turno.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                                    <div className="flex-1">
                                      <p className="font-medium">{turno.usuario.full_name}</p>
                                      <p className="text-sm text-muted-foreground">{turno.usuario.email}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {turno.hora_inicio} - {turno.hora_fin} ({turno.duracion_horas}h)
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <Badge variant={turno.estado_pago === 'pagado' ? 'default' : 'secondary'}>
                                        {turno.estado_pago === 'pagado' ? 'Pagado' : 'Pendiente'}
                                      </Badge>
                                      <span className="font-medium">
                                        ${(turno.tarifa_aplicada * turno.duracion_horas).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-muted-foreground text-center py-4">
                                No hay turnos registrados para este día
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            
            {turnosFiltrados.length === 0 && (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No hay datos para el período seleccionado</p>
              </div>
            )}
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
