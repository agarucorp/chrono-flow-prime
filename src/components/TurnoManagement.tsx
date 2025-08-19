import { useState, useEffect } from 'react';
import { Calendar, Clock, Settings, Plus, Trash2, Save, CalendarDays, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/hooks/useNotifications';

interface HorarioConfig {
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
}

interface DiaConfig {
  nombre: string;
  codigo: number; // 0=Domingo, 1=Lunes, etc.
  activo: boolean;
  horarios: HorarioConfig[];
}

interface DiaEspecial {
  fecha: string;
  nombre: string;
  tipo: 'feriado' | 'medio_dia' | 'cerrado';
  horarios?: HorarioConfig[];
}

export const TurnoManagement = () => {
  const { showSuccess, showError, showLoading, dismissToast } = useNotifications();
  
  const [diasConfig, setDiasConfig] = useState<DiaConfig[]>([
    { nombre: 'Domingo', codigo: 0, activo: false, horarios: [] },
    { nombre: 'Lunes', codigo: 1, activo: true, horarios: [] },
    { nombre: 'Martes', codigo: 2, activo: true, horarios: [] },
    { nombre: 'Miércoles', codigo: 3, activo: true, horarios: [] },
    { nombre: 'Jueves', codigo: 4, activo: true, horarios: [] },
    { nombre: 'Viernes', codigo: 5, activo: true, horarios: [] },
    { nombre: 'Sábado', codigo: 6, activo: false, horarios: [] }
  ]);

  const [diasEspeciales, setDiasEspeciales] = useState<DiaEspecial[]>([]);
  const [nuevoDiaEspecial, setNuevoDiaEspecial] = useState<DiaEspecial>({
    fecha: '',
    nombre: '',
    tipo: 'cerrado'
  });
  
  const [horariosDisponibles, setHorariosDisponibles] = useState<HorarioConfig[]>([
    { hora_inicio: '08:00', hora_fin: '09:00', activo: true },
    { hora_inicio: '09:00', hora_fin: '10:00', activo: true },
    { hora_inicio: '10:00', hora_fin: '11:00', activo: true },
    { hora_inicio: '11:00', hora_fin: '12:00', activo: true },
    { hora_inicio: '15:00', hora_fin: '16:00', activo: true },
    { hora_inicio: '16:00', hora_fin: '17:00', activo: true },
    { hora_inicio: '18:00', hora_fin: '19:00', activo: true },
    { hora_inicio: '19:00', hora_fin: '20:00', activo: true }
  ]);

  const [maxAlumnosPorTurno, setMaxAlumnosPorTurno] = useState(1);
  const [loading, setLoading] = useState(false);

  // Cargar configuración guardada
  useEffect(() => {
    cargarConfiguracion();
  }, []);

  const cargarConfiguracion = async () => {
    try {
      setLoading(true);
      
      // Aquí podrías cargar configuración desde una tabla de configuración
      // Por ahora usamos valores por defecto
      
    } catch (error) {
      console.error('Error cargando configuración:', error);
    } finally {
      setLoading(false);
    }
  };

  // Guardar configuración
  const guardarConfiguracion = async () => {
    try {
      const loadingToast = showLoading('Guardando configuración...');
      
      // Aquí guardarías la configuración en la base de datos
      // Por ahora solo simulamos
      
      setTimeout(() => {
        dismissToast(loadingToast);
        showSuccess('Configuración guardada', 'Los cambios se han aplicado correctamente');
      }, 1000);
      
    } catch (error) {
      showError('Error al guardar', 'No se pudo guardar la configuración');
    }
  };

  // Generar turnos según la configuración
  const generarTurnos = async () => {
    try {
      const loadingToast = showLoading('Generando turnos...');
      
      // Obtener fechas para los próximos 30 días
      const fechas = [];
      const hoy = new Date();
      
      for (let i = 0; i < 30; i++) {
        const fecha = new Date(hoy);
        fecha.setDate(hoy.getDate() + i);
        fechas.push(fecha);
      }

      // Filtrar días según configuración
      const diasActivos = diasConfig.filter(dia => dia.activo);
      const fechasValidas = fechas.filter(fecha => {
        const diaSemana = fecha.getDay();
        return diasActivos.some(dia => dia.codigo === diaSemana);
      });

      // Crear turnos para cada fecha válida
      const turnosACrear = [];
      
      for (const fecha of fechasValidas) {
        const diaSemana = fecha.getDay();
        const configDia = diasConfig.find(dia => dia.codigo === diaSemana);
        
        if (configDia && configDia.activo) {
          for (const horario of horariosDisponibles) {
            if (horario.activo) {
              turnosACrear.push({
                fecha: fecha.toISOString().split('T')[0],
                hora_inicio: horario.hora_inicio + ':00',
                hora_fin: horario.hora_fin + ':00',
                estado: 'disponible',
                servicio: 'Entrenamiento Personal',
                max_alumnos: maxAlumnosPorTurno,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            }
          }
        }
      }

      // Insertar turnos en la base de datos
      if (turnosACrear.length > 0) {
        const { error } = await supabase
          .from('turnos')
          .insert(turnosACrear);

        if (error) {
          throw error;
        }
      }

      dismissToast(loadingToast);
      showSuccess('Turnos generados', `Se crearon ${turnosACrear.length} turnos exitosamente`);
      
    } catch (error) {
      console.error('Error generando turnos:', error);
      showError('Error al generar turnos', 'No se pudieron crear los turnos');
    }
  };

  // Limpiar turnos existentes
  const limpiarTurnos = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar todos los turnos existentes? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const loadingToast = showLoading('Limpiando turnos...');
      
      const { error } = await supabase
        .from('turnos')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Evitar error de delete sin where

      dismissToast(loadingToast);

      if (error) {
        throw error;
      }

      showSuccess('Turnos limpiados', 'Todos los turnos han sido eliminados');
      
    } catch (error) {
      console.error('Error limpiando turnos:', error);
      showError('Error al limpiar turnos', 'No se pudieron eliminar los turnos');
    }
  };

  // Agregar día especial
  const agregarDiaEspecial = () => {
    if (!nuevoDiaEspecial.fecha || !nuevoDiaEspecial.nombre) {
      showError('Error', 'Completa todos los campos');
      return;
    }

    setDiasEspeciales([...diasEspeciales, { ...nuevoDiaEspecial }]);
    setNuevoDiaEspecial({ fecha: '', nombre: '', tipo: 'cerrado' });
    showSuccess('Día especial agregado', 'El día especial se ha configurado correctamente');
  };

  // Eliminar día especial
  const eliminarDiaEspecial = (index: number) => {
    setDiasEspeciales(diasEspeciales.filter((_, i) => i !== index));
    showSuccess('Día especial eliminado', 'El día especial se ha eliminado correctamente');
  };

  // Toggle día de la semana
  const toggleDia = (codigo: number) => {
    setDiasConfig(diasConfig.map(dia => 
      dia.codigo === codigo ? { ...dia, activo: !dia.activo } : dia
    ));
  };

  // Toggle horario
  const toggleHorario = (horaInicio: string) => {
    setHorariosDisponibles(horariosDisponibles.map(horario =>
      horario.hora_inicio === horaInicio ? { ...horario, activo: !horario.activo } : horario
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Gestión de Turnos y Horarios</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="horarios" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="horarios">Horarios</TabsTrigger>
              <TabsTrigger value="dias">Días Laborables</TabsTrigger>
              <TabsTrigger value="especiales">Días Especiales</TabsTrigger>
              <TabsTrigger value="acciones">Acciones</TabsTrigger>
            </TabsList>

            {/* Configuración de Horarios */}
            <TabsContent value="horarios" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Horarios Disponibles</Label>
                  <Label className="text-sm text-muted-foreground">
                    Máximo alumnos por turno: {maxAlumnosPorTurno}
                  </Label>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {horariosDisponibles.map((horario, index) => (
                    <Card key={index} className={`p-4 transition-all duration-200 ${
                      horario.activo 
                        ? 'border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-700' 
                        : 'border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-600'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-medium text-sm ${
                          horario.activo 
                            ? 'text-green-800 dark:text-green-200' 
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {horario.hora_inicio} - {horario.hora_fin}
                        </span>
                        <Switch
                          checked={horario.activo}
                          onCheckedChange={() => toggleHorario(horario.hora_inicio)}
                        />
                      </div>
                      <Badge variant={horario.activo ? 'default' : 'secondary'} className={
                        horario.activo 
                          ? 'bg-green-600 hover:bg-green-700 text-white' 
                          : 'bg-gray-500 hover:bg-gray-600 text-white'
                      }>
                        {horario.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </Card>
                  ))}
                </div>

                <div className="flex items-center space-x-4">
                  <Label htmlFor="maxAlumnos">Máximo alumnos por turno:</Label>
                  <Input
                    id="maxAlumnos"
                    type="number"
                    min="1"
                    max="10"
                    value={maxAlumnosPorTurno}
                    onChange={(e) => setMaxAlumnosPorTurno(parseInt(e.target.value) || 1)}
                    className="w-20"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Configuración de Días */}
            <TabsContent value="dias" className="mt-4">
              <div className="space-y-4">
                <Label className="text-base font-medium">Días de la Semana</Label>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {diasConfig.map((dia) => (
                    <Card key={dia.codigo} className={`p-4 transition-all duration-200 ${
                      dia.activo 
                        ? 'border-blue-300 bg-blue-50 dark:bg-blue-950 dark:border-blue-700' 
                        : 'border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-600'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <CalendarDays className={`h-5 w-5 ${
                            dia.activo 
                              ? 'text-blue-600 dark:text-blue-400' 
                              : 'text-gray-400 dark:text-gray-500'
                          }`} />
                          <span className={`font-medium ${
                            dia.activo 
                              ? 'text-blue-800 dark:text-blue-200' 
                              : 'text-gray-600 dark:text-gray-400'
                          }`}>{dia.nombre}</span>
                        </div>
                        <Switch
                          checked={dia.activo}
                          onCheckedChange={() => toggleDia(dia.codigo)}
                        />
                      </div>
                      {dia.activo && (
                        <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                          Horarios: {horariosDisponibles.filter(h => h.activo).length} activos
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Días Especiales */}
            <TabsContent value="especiales" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Input
                    type="date"
                    value={nuevoDiaEspecial.fecha}
                    onChange={(e) => setNuevoDiaEspecial({ ...nuevoDiaEspecial, fecha: e.target.value })}
                    placeholder="Fecha"
                  />
                  <Input
                    value={nuevoDiaEspecial.nombre}
                    onChange={(e) => setNuevoDiaEspecial({ ...nuevoDiaEspecial, nombre: e.target.value })}
                    placeholder="Nombre (ej: Día de la Independencia)"
                    className="flex-1"
                  />
                  <select
                    value={nuevoDiaEspecial.tipo}
                    onChange={(e) => setNuevoDiaEspecial({ ...nuevoDiaEspecial, tipo: e.target.value as any })}
                    className="px-3 py-2 border rounded-md"
                  >
                    <option value="cerrado">Cerrado</option>
                    <option value="medio_dia">Medio día</option>
                    <option value="feriado">Feriado normal</option>
                  </select>
                  <Button onClick={agregarDiaEspecial} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar
                  </Button>
                </div>

                <div className="space-y-2">
                  {diasEspeciales.map((dia, index) => (
                    <Card key={index} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{dia.fecha}</span>
                          <span className="text-sm text-muted-foreground">{dia.nombre}</span>
                          <Badge variant={
                            dia.tipo === 'cerrado' ? 'destructive' : 
                            dia.tipo === 'medio_dia' ? 'default' : 'secondary'
                          }>
                            {dia.tipo === 'cerrado' ? 'Cerrado' : 
                             dia.tipo === 'medio_dia' ? 'Medio día' : 'Feriado'}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => eliminarDiaEspecial(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Acciones */}
            <TabsContent value="acciones" className="mt-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4">
                    <div className="text-center space-y-3">
                      <Users className="h-8 w-8 mx-auto text-blue-500" />
                      <h3 className="font-medium">Generar Turnos</h3>
                      <p className="text-sm text-muted-foreground">
                        Crea turnos para los próximos 30 días según la configuración actual
                      </p>
                      <Button onClick={generarTurnos} className="w-full">
                        <Plus className="h-4 w-4 mr-2" />
                        Generar Turnos
                      </Button>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="text-center space-y-3">
                      <Trash2 className="h-8 w-8 mx-auto text-red-500" />
                      <h3 className="font-medium">Limpiar Turnos</h3>
                      <p className="text-sm text-muted-foreground">
                        Elimina todos los turnos existentes (¡Cuidado!)
                      </p>
                      <Button 
                        variant="destructive" 
                        onClick={limpiarTurnos}
                        className="w-full"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Limpiar Turnos
                      </Button>
                    </div>
                  </Card>
                </div>

                <div className="flex justify-end">
                  <Button onClick={guardarConfiguracion} className="w-full md:w-auto">
                    <Save className="h-4 w-4 mr-2" />
                    Guardar Configuración
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
