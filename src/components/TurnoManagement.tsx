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

export const TurnoManagement = () => {
  const [cantidadAlumnos, setCantidadAlumnos] = useState('1');
  const [tarifaClase, setTarifaClase] = useState('');
  const [capacidadMaximaGlobal, setCapacidadMaximaGlobal] = useState('20');
  const [horariosFijos, setHorariosFijos] = useState<HorarioClase[]>([
    { id: 1, nombre: 'Clase 1', horaInicio: '08:00', horaFin: '09:00' },
    { id: 2, nombre: 'Clase 2', horaInicio: '09:00', horaFin: '10:00' },
    { id: 3, nombre: 'Clase 3', horaInicio: '10:00', horaFin: '11:00' },
    { id: 4, nombre: 'Clase 4', horaInicio: '11:00', horaFin: '12:00' },
    { id: 5, nombre: 'Clase 5', horaInicio: '15:00', horaFin: '16:00' },
    { id: 6, nombre: 'Clase 6', horaInicio: '16:00', horaFin: '17:00' },
    { id: 7, nombre: 'Clase 7', horaInicio: '18:00', horaFin: '19:00' },
    { id: 8, nombre: 'Clase 8', horaInicio: '19:00', horaFin: '20:00' }
  ]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [isCapacidadDialogOpen, setIsCapacidadDialogOpen] = useState(false);
  const [capacidadValor, setCapacidadValor] = useState<string>('');
  const [horariosSemanales, setHorariosSemanales] = useState<HorarioSemanal[]>([]);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [isTarifaDialogOpen, setIsTarifaDialogOpen] = useState(false);
  const [tarifaValor, setTarifaValor] = useState<string>('');
  const { actualizarConfiguracionCapacidad, obtenerCapacidadActual, cargarConfiguraciones, actualizarConfiguracionTarifas, obtenerTarifaActual } = useSystemConfig();
  const { toast } = useToast();

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

  const handleHorarioChange = (id: number, field: 'horaInicio' | 'horaFin', value: string) => {
    setHorariosFijos(prev => 
      prev.map(horario => 
        horario.id === id ? { ...horario, [field]: value } : horario
      )
    );
  };

  const handleGuardarHorarios = () => {
    // Aquí guardarías los horarios en la base de datos
    console.log('Guardando horarios:', horariosFijos);
    setIsDialogOpen(false);
  };

  const handleGuardarCapacidadMaxima = async () => {
    try {
      const { error } = await supabase
        .from('configuracion_admin')
        .update({ 
          max_alumnos_por_clase: parseInt(capacidadMaximaGlobal),
          updated_at: new Date().toISOString()
        })
        .eq('id_configuracion', '1'); // Asumiendo que hay una configuración con ID 1

      if (error) throw error;

      toast({ title: 'Guardado', description: 'Capacidad máxima actualizada' });
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

  const handleAgregarAusenciaUnica = () => {
    if (nuevaAusenciaUnica.dia && nuevaAusenciaUnica.mes && nuevaAusenciaUnica.año && nuevaAusenciaUnica.clasesCanceladas.length > 0) {
      const nuevaAusencia: AusenciaUnica = {
        id: Date.now().toString(),
        ...nuevaAusenciaUnica
      };
      setAusenciasUnicas(prev => [...prev, nuevaAusencia]);
      setNuevaAusenciaUnica({ fechaCompleta: '', dia: '', mes: '', año: '', clasesCanceladas: [] });
      setTipoAusencia(null);
    }
  };

  const handleAgregarAusenciaPeriodo = () => {
    if (nuevaAusenciaPeriodo.fechaDesde && nuevaAusenciaPeriodo.fechaHasta) {
      // Mostrar resumen en lugar de guardar automáticamente
      setMostrarResumenAusencia(true);
    }
  };

  const confirmarAusenciaPeriodo = () => {
    const nuevaAusencia: AusenciaPeriodo = {
      id: Date.now().toString(),
      ...nuevaAusenciaPeriodo
    };
    setAusenciasPeriodo(prev => [...prev, nuevaAusencia]);
    setNuevaAusenciaPeriodo({ fechaDesde: '', fechaHasta: '' });
    setTipoAusencia(null);
    setMostrarResumenAusencia(false);
  };

  const handleEliminarAusencia = (id: string, tipo: 'unica' | 'periodo') => {
    if (tipo === 'unica') {
      setAusenciasUnicas(prev => prev.filter(ausencia => ausencia.id !== id));
    } else {
      setAusenciasPeriodo(prev => prev.filter(ausencia => ausencia.id !== id));
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
          {/* Configuración: mobile muestra CTAs; desktop mantiene controles actuales */}
          <div className="grid grid-cols-1 gap-2 md:hidden mb-2 sm:mb-0">
            <Dialog open={isCapacidadDialogOpen} onOpenChange={setIsCapacidadDialogOpen}>
              <DialogTrigger asChild>
                <div onClick={abrirCapacidad} className="h-12 w-full rounded-xl border-2 border-orange-500 text-muted-foreground hover:bg-orange-500 hover:text-white transition-colors shadow-sm hover:shadow-md font-heading flex items-center justify-center cursor-pointer" style={{ padding: '12px 24px', fontSize: '14px' }}>
                  Alumnos por clase
                </div>
              </DialogTrigger>
              <DialogContent 
                className="p-2 rounded-xl" 
                style={{ 
                  width: '90vw', 
                  maxWidth: '90vw',
                  minWidth: '90vw'
                }}
              >
                <DialogHeader>
                  <DialogTitle style={{ fontSize: '12px' }}>Capacidad por clase</DialogTitle>
                  <DialogDescription style={{ fontSize: '12px' }}>Edite la capacidad de alumnos para cada horario.</DialogDescription>
                </DialogHeader>
                
                {loadingHorarios ? (
                  <div className="py-8 text-center text-muted-foreground">Cargando...</div>
                ) : (
                  <div className="max-h-[60vh] overflow-y-auto space-y-3">
                    {horariosSemanales.map((horario) => (
                      <div key={horario.id} className="flex items-center justify-between gap-4 p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {DIAS_SEMANA[horario.dia_semana - 1]}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {horario.hora_inicio.substring(0, 5)} - {horario.hora_fin.substring(0, 5)}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Users className="w-3 h-3" />
                            {horario.alumnos_agendados}/{horario.capacidad} agendados
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`capacidad-${horario.id}`} className="text-xs whitespace-nowrap">Capacidad:</Label>
                          <Input 
                            id={`capacidad-${horario.id}`}
                            type="number" 
                            min={horario.alumnos_agendados} 
                            value={horario.capacidad}
                            onChange={(e) => {
                              const nuevaCapacidad = parseInt(e.target.value) || horario.alumnos_agendados;
                              actualizarCapacidadHorario(horario.id, Math.max(horario.alumnos_agendados, nuevaCapacidad));
                            }}
                            className="w-16 text-center" 
                          />
                        </div>
                      </div>
                    ))}
                    {horariosSemanales.length === 0 && (
                      <div className="py-8 text-center text-muted-foreground">
                        No hay horarios configurados
                      </div>
                    )}
                  </div>
                )}
                
                <DialogFooter className="gap-2">
                  <Button onClick={() => setIsCapacidadDialogOpen(false)} style={{ fontSize: '14px' }}>Cerrar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={isTarifaDialogOpen} onOpenChange={setIsTarifaDialogOpen}>
              <DialogTrigger asChild>
                <div onClick={abrirTarifa} className="h-12 w-full rounded-xl border-2 border-orange-500 text-muted-foreground hover:bg-orange-500 hover:text-white transition-colors shadow-sm hover:shadow-md font-heading flex items-center justify-center cursor-pointer" style={{ padding: '12px 24px', fontSize: '14px' }}>
                  Tarifa por clase
                </div>
              </DialogTrigger>
              <DialogContent className="w-[90vw] max-w-[90vw] p-2 rounded-xl">
                <div className="w-full">
                  <DialogHeader>
                    <DialogTitle style={{ fontSize: '12px' }}>Tarifa por clase</DialogTitle>
                    <DialogDescription style={{ fontSize: '12px' }}>Defina el valor de cada clase.</DialogDescription>
                  </DialogHeader>
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="tarifa-global" className="text-xs">Precio (ARS)</Label>
                    <Input id="tarifa-global" type="number" min={0} step="0.01" value={tarifaValor} onChange={(e) => setTarifaValor(e.target.value)} className="w-32 text-center" />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsTarifaDialogOpen(false)} style={{ fontSize: '14px' }}>Cancelar</Button>
                    <Button onClick={guardarTarifa} style={{ fontSize: '14px' }}>Guardar</Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* CTAs para desktop también */}
          <div className="hidden md:grid md:grid-cols-2 md:gap-4">
            <Dialog open={isCapacidadDialogOpen} onOpenChange={setIsCapacidadDialogOpen}>
              <DialogTrigger asChild>
                <div onClick={abrirCapacidad} className="h-12 w-full rounded-xl border-2 border-orange-500 text-muted-foreground hover:bg-orange-500 hover:text-white transition-colors shadow-sm hover:shadow-md font-heading flex items-center justify-center cursor-pointer" style={{ padding: '12px 24px', fontSize: '14px' }}>
                  Alumnos por clase
                </div>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle style={{ fontSize: '12px' }}>Capacidad por clase</DialogTitle>
                  <DialogDescription style={{ fontSize: '12px' }}>Edite la capacidad de alumnos para cada horario.</DialogDescription>
                </DialogHeader>
                
                {loadingHorarios ? (
                  <div className="py-8 text-center text-muted-foreground">Cargando...</div>
                ) : (
                  <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-2">
                    {horariosSemanales.map((horario) => (
                      <div key={horario.id} className="flex items-center justify-between gap-4 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="flex-1">
                          <div className="font-medium">
                            {DIAS_SEMANA[horario.dia_semana - 1]}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {horario.hora_inicio.substring(0, 5)} - {horario.hora_fin.substring(0, 5)}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Users className="w-3 h-3" />
                            {horario.alumnos_agendados}/{horario.capacidad} agendados
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`capacidad-desktop-${horario.id}`} className="text-sm whitespace-nowrap">Capacidad:</Label>
                          <Input 
                            id={`capacidad-desktop-${horario.id}`}
                            type="number" 
                            min={horario.alumnos_agendados} 
                            value={horario.capacidad}
                            onChange={(e) => {
                              const nuevaCapacidad = parseInt(e.target.value) || horario.alumnos_agendados;
                              actualizarCapacidadHorario(horario.id, Math.max(horario.alumnos_agendados, nuevaCapacidad));
                            }}
                            className="w-20 text-center" 
                          />
                        </div>
                      </div>
                    ))}
                    {horariosSemanales.length === 0 && (
                      <div className="py-8 text-center text-muted-foreground">
                        No hay horarios configurados
                      </div>
                    )}
                  </div>
                )}
                
                <DialogFooter className="gap-2">
                  <Button onClick={() => setIsCapacidadDialogOpen(false)} style={{ fontSize: '14px' }}>Cerrar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={isTarifaDialogOpen} onOpenChange={setIsTarifaDialogOpen}>
              <DialogTrigger asChild>
                <div onClick={abrirTarifa} className="h-12 w-full rounded-xl border-2 border-orange-500 text-muted-foreground hover:bg-orange-500 hover:text-white transition-colors shadow-sm hover:shadow-md font-heading flex items-center justify-center cursor-pointer" style={{ padding: '12px 24px', fontSize: '14px' }}>
                  Tarifa por clase
                </div>
              </DialogTrigger>
              <DialogContent 
                className="p-2 rounded-xl" 
                style={{ 
                  width: '90vw', 
                  maxWidth: '90vw',
                  minWidth: '90vw'
                }}
              >
                <DialogHeader>
                  <DialogTitle>Tarifa por clase</DialogTitle>
                  <DialogDescription>Defina el valor de cada clase.</DialogDescription>
                </DialogHeader>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="tarifa-global-desktop" className="text-xs">Precio (ARS)</Label>
                  <Input id="tarifa-global-desktop" type="number" min={0} step="0.01" value={tarifaValor} onChange={(e) => setTarifaValor(e.target.value)} className="w-32 text-center" />
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setIsTarifaDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={guardarTarifa}>Guardar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Botones de acción */}
          <div className="space-y-0 sm:space-y-4 pt-0 sm:pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              {/* CTA 1: Editar horarios fijos */}
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <div className="h-12 w-full rounded-xl border-2 border-orange-500 text-muted-foreground hover:bg-orange-500 hover:text-white transition-colors shadow-sm hover:shadow-md font-heading flex items-center justify-center cursor-pointer" style={{ padding: '12px 24px', fontSize: '14px' }}>
                    Editar horarios fijos
                  </div>
                </DialogTrigger>
                <DialogContent className="w-[90%] max-w-[20rem] sm:max-w-2xl max-h-[80vh] overflow-y-auto p-3 sm:p-6 rounded-xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2" style={{ fontSize: '12px' }}>Configurar Horarios Fijos</DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    {/* Card para capacidad por clase */}
                    <div className="p-3 border border-orange-500 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-center gap-4">
                        <Label htmlFor="capacidad-maxima" className="whitespace-nowrap" style={{ fontSize: '12px' }}>Capacidad por clase</Label>
                        <Input
                          id="capacidad-maxima"
                          type="number"
                          min="1"
                          max="100"
                          value={capacidadMaximaGlobal}
                          onChange={(e) => setCapacidadMaximaGlobal(e.target.value)}
                          className="w-20 text-center"
                          style={{ fontSize: '12px' }}
                        />
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
                        className="h-10 w-full rounded-xl border-2 border-orange-500 text-muted-foreground hover:bg-orange-500 hover:text-white transition-colors shadow-sm hover:shadow-md font-heading flex items-center justify-center gap-2 cursor-pointer"
                        style={{ padding: '8px 16px', fontSize: '14px' }}
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
                      style={{ fontSize: '14px' }}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleGuardarHorarios} style={{ fontSize: '14px' }}>
                      Guardar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* CTA 2: Editar ausencias */}
              <Dialog open={isDialogAusenciasOpen} onOpenChange={setIsDialogAusenciasOpen}>
                <DialogTrigger asChild>
                  <div className="h-12 w-full rounded-xl border-2 border-orange-500 text-muted-foreground hover:bg-orange-500 hover:text-white transition-colors shadow-sm hover:shadow-md font-heading flex items-center justify-center cursor-pointer" style={{ padding: '12px 24px', fontSize: '14px' }}>
                    Editar ausencias
                  </div>
                </DialogTrigger>
                <DialogContent className="w-[90%] max-w-[20rem] sm:max-w-4xl max-h-[90vh] overflow-y-auto pt-6 pb-3 px-3 sm:p-6 rounded-xl">
                  <DialogHeader className="relative">
                    <DialogTitle style={{ fontSize: '12px' }}>
                      {tipoAusencia === 'periodo' ? '' : ''}
                    </DialogTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute -top-4 -right-2 h-6 w-6 p-0 z-10"
                      onClick={() => {
                        setIsDialogAusenciasOpen(false);
                        setTipoAusencia(null);
                        setMostrarResumenAusencia(false);
                        setNuevaAusenciaPeriodo({ fechaDesde: '', fechaHasta: '' });
                        setNuevaAusenciaUnica({ fechaCompleta: '', dia: '', mes: '', año: '', clasesCanceladas: [] });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </DialogHeader>

                  {!tipoAusencia ? (
                    // Selección de tipo de ausencia
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button
                          onClick={() => setTipoAusencia('unica')}
                          className="h-24 flex flex-col items-center justify-center space-y-2 border-orange-500"
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
                          className="h-24 flex flex-col items-center justify-center space-y-2 border-orange-500"
                          variant="outline"
                          style={{ fontSize: '14px' }}
                        >
                          <span className="font-medium">Ausencia por periodo</span>
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
                              Se cancelarán todas las clases desde el <strong>{nuevaAusenciaPeriodo.fechaDesde}</strong> hasta el <strong>{nuevaAusenciaPeriodo.fechaHasta}</strong>
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


                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
