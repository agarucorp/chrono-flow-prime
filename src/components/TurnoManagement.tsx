import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Clock, Calendar, Edit3, X, Plus } from 'lucide-react';

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

export const TurnoManagement = () => {
  const [cantidadAlumnos, setCantidadAlumnos] = useState('1');
  const [tarifaClase, setTarifaClase] = useState('');
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
  
  // Estados para ausencias
  const [isDialogAusenciasOpen, setIsDialogAusenciasOpen] = useState(false);
  const [tipoAusencia, setTipoAusencia] = useState<'unica' | 'periodo' | null>(null);
  const [ausenciasUnicas, setAusenciasUnicas] = useState<AusenciaUnica[]>([]);
  const [ausenciasPeriodo, setAusenciasPeriodo] = useState<AusenciaPeriodo[]>([]);
  
  // Estado para nueva ausencia única
  const [nuevaAusenciaUnica, setNuevaAusenciaUnica] = useState({
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
      setNuevaAusenciaUnica({ dia: '', mes: '', año: '', clasesCanceladas: [] });
      setTipoAusencia(null);
    }
  };

  const handleAgregarAusenciaPeriodo = () => {
    if (nuevaAusenciaPeriodo.fechaDesde && nuevaAusenciaPeriodo.fechaHasta) {
      const nuevaAusencia: AusenciaPeriodo = {
        id: Date.now().toString(),
        ...nuevaAusenciaPeriodo
      };
      setAusenciasPeriodo(prev => [...prev, nuevaAusencia]);
      setNuevaAusenciaPeriodo({ fechaDesde: '', fechaHasta: '' });
      setTipoAusencia(null);
    }
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
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const años = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i);

  return (
    <div className="space-y-6 w-full max-w-full">
      <Card className="w-full max-w-full">
        <CardContent className="space-y-6 w-full max-w-full pt-6">
          {/* Configuración: mobile muestra CTAs; desktop mantiene controles actuales */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            <div className="h-12 w-full rounded-xl border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white transition-colors shadow-sm hover:shadow-md font-heading flex items-center justify-center cursor-pointer" style={{ padding: '12px 24px' }}>
              Alumnos por clase
            </div>
            <div className="h-12 w-full rounded-xl border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white transition-colors shadow-sm hover:shadow-md font-heading flex items-center justify-center cursor-pointer" style={{ padding: '12px 24px' }}>
              Tarifa por clase
            </div>
          </div>

          {/* CTAs para desktop también */}
          <div className="hidden md:grid md:grid-cols-2 md:gap-4">
            <div className="h-12 w-full rounded-xl border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white transition-colors shadow-sm hover:shadow-md font-heading flex items-center justify-center cursor-pointer" style={{ padding: '12px 24px' }}>
              Alumnos por clase
            </div>
            <div className="h-12 w-full rounded-xl border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white transition-colors shadow-sm hover:shadow-md font-heading flex items-center justify-center cursor-pointer" style={{ padding: '12px 24px' }}>
              Tarifa por clase
            </div>
          </div>

          {/* Botones de acción */}
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* CTA 1: Editar horarios fijos */}
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <div className="h-12 w-full rounded-xl border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white transition-colors shadow-sm hover:shadow-md font-heading flex items-center justify-center cursor-pointer" style={{ padding: '12px 24px' }}>
                    Editar horarios fijos
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">Configurar Horarios Fijos</DialogTitle>
                    <DialogDescription>
                      Configura los horarios de inicio y fin para las 8 clases del día
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    {horariosFijos.map((horario) => (
                      <div key={horario.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-4 border rounded-lg">
                        <div className="font-medium text-sm">
                          {horario.nombre}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`inicio-${horario.id}`} className="text-xs">
                            Hora de inicio
                          </Label>
                          <Input
                            id={`inicio-${horario.id}`}
                            type="time"
                            value={horario.horaInicio}
                            onChange={(e) => handleHorarioChange(horario.id, 'horaInicio', e.target.value)}
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`fin-${horario.id}`} className="text-xs">
                            Hora de fin
                          </Label>
                          <Input
                            id={`fin-${horario.id}`}
                            type="time"
                            value={horario.horaFin}
                            onChange={(e) => handleHorarioChange(horario.id, 'horaFin', e.target.value)}
                            className="w-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleGuardarHorarios}>
                      Guardar Horarios
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* CTA 2: Editar ausencias eventuales */}
              <Dialog open={isDialogAusenciasOpen} onOpenChange={setIsDialogAusenciasOpen}>
                <DialogTrigger asChild>
                  <div className="h-12 w-full rounded-xl border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white transition-colors shadow-sm hover:shadow-md font-heading flex items-center justify-center cursor-pointer" style={{ padding: '12px 24px' }}>
                    Editar ausencias eventuales
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">Gestionar Ausencias Eventuales</DialogTitle>
                    <DialogDescription>
                      Configura ausencias por día específico o por período
                    </DialogDescription>
                  </DialogHeader>

                  {!tipoAusencia ? (
                    // Selección de tipo de ausencia
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button
                          onClick={() => setTipoAusencia('unica')}
                          className="h-24 flex flex-col items-center justify-center space-y-2"
                          variant="outline"
                        >
                          <Calendar className="h-8 w-8" />
                          <span className="font-medium">Ausencia Única</span>
                          <span className="text-xs text-muted-foreground text-center">
                            Cancelar clases de un día específico
                          </span>
                        </Button>
                        
                        <Button
                          onClick={() => setTipoAusencia('periodo')}
                          className="h-24 flex flex-col items-center justify-center space-y-2"
                          variant="outline"
                        >
                          <X className="h-8 w-8" />
                          <span className="font-medium">Ausencia por Período</span>
                          <span className="text-xs text-muted-foreground text-center">
                            Cancelar todas las clases por un período
                          </span>
                        </Button>
                      </div>
                    </div>
                  ) : tipoAusencia === 'unica' ? (
                    // Formulario para ausencia única
                    <div className="space-y-6">
                      <div className="border-b pb-4">
                        <h3 className="font-medium mb-4">Ausencia Única</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Día</Label>
                            <Select value={nuevaAusenciaUnica.dia} onValueChange={(value) => setNuevaAusenciaUnica(prev => ({ ...prev, dia: value }))}>
                              <SelectTrigger id="ausencia-unica-dia">
                                <SelectValue placeholder="Seleccionar día" />
                              </SelectTrigger>
                              <SelectContent>
                                {dias.map(dia => (
                                  <SelectItem key={dia} value={dia.toString()}>{dia}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Mes</Label>
                            <Select value={nuevaAusenciaUnica.mes} onValueChange={(value) => setNuevaAusenciaUnica(prev => ({ ...prev, mes: value }))}>
                              <SelectTrigger id="ausencia-unica-mes">
                                <SelectValue placeholder="Seleccionar mes" />
                              </SelectTrigger>
                              <SelectContent>
                                {meses.map((mes, index) => (
                                  <SelectItem key={index} value={(index + 1).toString()}>{mes}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Año</Label>
                            <Select value={nuevaAusenciaUnica.año} onValueChange={(value) => setNuevaAusenciaUnica(prev => ({ ...prev, año: value }))}>
                              <SelectTrigger id="ausencia-unica-anio">
                                <SelectValue placeholder="Seleccionar año" />
                              </SelectTrigger>
                              <SelectContent>
                                {años.map(año => (
                                  <SelectItem key={año} value={año.toString()}>{año}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label>Clases a cancelar (selección múltiple)</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {horariosFijos.map((clase) => (
                            <Button
                              key={clase.id}
                              variant={nuevaAusenciaUnica.clasesCanceladas.includes(clase.id) ? "default" : "outline"}
                              onClick={() => handleToggleClase(clase.id)}
                              className="h-12 flex flex-col items-center justify-center"
                            >
                              <span className="font-medium">{clase.nombre}</span>
                              <span className="text-xs">{clase.horaInicio} - {clase.horaFin}</span>
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <Button variant="outline" onClick={() => setTipoAusencia(null)}>
                          Volver
                        </Button>
                        <Button onClick={handleAgregarAusenciaUnica} disabled={!nuevaAusenciaUnica.dia || !nuevaAusenciaUnica.mes || !nuevaAusenciaUnica.año || nuevaAusenciaUnica.clasesCanceladas.length === 0}>
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar Ausencia
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Formulario para ausencia por período
                    <div className="space-y-6">
                      <div className="border-b pb-4">
                        <h3 className="font-medium mb-4">Ausencia por Período</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Fecha desde</Label>
                            <Input
                              type="date"
                              value={nuevaAusenciaPeriodo.fechaDesde}
                              onChange={(e) => setNuevaAusenciaPeriodo(prev => ({ ...prev, fechaDesde: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Fecha hasta</Label>
                            <Input
                              type="date"
                              value={nuevaAusenciaPeriodo.fechaHasta}
                              onChange={(e) => setNuevaAusenciaPeriodo(prev => ({ ...prev, fechaHasta: e.target.value }))}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <Button variant="outline" onClick={() => setTipoAusencia(null)}>
                          Volver
                        </Button>
                        <Button onClick={handleAgregarAusenciaPeriodo} disabled={!nuevaAusenciaPeriodo.fechaDesde || !nuevaAusenciaPeriodo.fechaHasta}>
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar Ausencia
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Lista de ausencias existentes */}
                  {(ausenciasUnicas.length > 0 || ausenciasPeriodo.length > 0) && (
                    <div className="space-y-4 pt-6 border-t">
                      <h3 className="font-medium">Ausencias Configuradas</h3>
                      
                      {/* Ausencias únicas */}
                      {ausenciasUnicas.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground">Ausencias Únicas</h4>
                          {ausenciasUnicas.map((ausencia) => (
                            <div key={ausencia.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div>
                                <span className="font-medium">
                                  {ausencia.dia}/{ausencia.mes}/{ausencia.año}
                                </span>
                                <span className="text-sm text-muted-foreground ml-2">
                                  Clases: {ausencia.clasesCanceladas.map(id => `Clase ${id}`).join(', ')}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEliminarAusencia(ausencia.id, 'unica')}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Ausencias por período */}
                      {ausenciasPeriodo.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-muted-foreground">Ausencias por Período</h4>
                          {ausenciasPeriodo.map((ausencia) => (
                            <div key={ausencia.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div>
                                <span className="font-medium">
                                  {ausencia.fechaDesde} - {ausencia.fechaHasta}
                                </span>
                                <span className="text-sm text-muted-foreground ml-2">
                                  Todas las clases canceladas
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEliminarAusencia(ausencia.id, 'periodo')}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogAusenciasOpen(false)}>
                      Cerrar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
