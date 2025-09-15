import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Calendar } from 'lucide-react';

export const TurnoManagement = () => {
  const [cantidadAlumnos, setCantidadAlumnos] = useState('1');
  const [tarifaClase, setTarifaClase] = useState('');

  return (
    <div className="space-y-6 w-full max-w-full">
      <Card className="w-full max-w-full">
        <CardContent className="space-y-6 w-full max-w-full pt-6">
          {/* Componentes editables en fila */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cantidad de alumnos por clase */}
            <div className="flex items-center space-x-2">
              <Label htmlFor="cantidad-alumnos" className="text-base font-medium whitespace-nowrap">
                Cantidad de alumnos por clase
              </Label>
              <Select value={cantidadAlumnos} onValueChange={setCantidadAlumnos}>
                <SelectTrigger className="w-16">
                  <SelectValue placeholder="1" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="6">6</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="12">12</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tarifa por clase */}
            <div className="flex items-center space-x-2">
              <Label htmlFor="tarifa-clase" className="text-base font-medium whitespace-nowrap">
                Tarifa por clase
              </Label>
              <Input
                id="tarifa-clase"
                type="number"
                value={tarifaClase}
                onChange={(e) => setTarifaClase(e.target.value)}
                placeholder="0"
                className="w-20"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          {/* Botones de acción */}
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* CTA 1: Editar horarios fijos */}
              <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <Clock className="h-8 w-8 text-blue-500 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-medium text-sm sm:text-base">Editar horarios fijos</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Configurar horarios regulares del gimnasio
                    </p>
                  </div>
                </div>
              </Card>

              {/* CTA 2: Editar ausencias eventuales */}
              <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-8 w-8 text-orange-500 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-medium text-sm sm:text-base">Editar ausencias eventuales</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Gestionar días sin clases o cambios especiales
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
