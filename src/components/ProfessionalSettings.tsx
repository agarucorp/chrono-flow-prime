import { useState } from "react";
import { Settings, Clock, Calendar, User, Save, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Professional {
  name: string;
  specialty: string;
  workingHours: { start: string; end: string };
  appointmentDuration: number;
  availableDays: number[];
}

interface ProfessionalSettingsProps {
  professional: Professional;
  onUpdate: (professional: Professional) => void;
}

export const ProfessionalSettings = ({ professional, onUpdate }: ProfessionalSettingsProps) => {
  const [formData, setFormData] = useState(professional);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const dayValues = [1, 2, 3, 4, 5, 6, 7];

  const handleSave = async () => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      onUpdate(formData);
      setIsLoading(false);
      toast({
        title: "Configuración guardada",
        description: "Los cambios se han aplicado correctamente.",
      });
    }, 1000);
  };

  const toggleDay = (dayValue: number) => {
    setFormData(prev => ({
      ...prev,
      availableDays: prev.availableDays.includes(dayValue)
        ? prev.availableDays.filter(d => d !== dayValue)
        : [...prev.availableDays, dayValue].sort()
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Configuración Profesional
          </CardTitle>
          <CardDescription>
            Personalice su perfil y horarios de atención
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Professional Info */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Información Personal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre Completo</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ingrese su nombre completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialty">Especialidad</Label>
              <Input
                id="specialty"
                value={formData.specialty}
                onChange={(e) => setFormData(prev => ({ ...prev, specialty: e.target.value }))}
                placeholder="Ej: Medicina General, Odontología, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Descripción (Opcional)</Label>
              <Textarea
                id="bio"
                placeholder="Breve descripción de su práctica profesional..."
                className="min-h-[100px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Working Hours */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Horarios de Trabajo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Hora de Inicio</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.workingHours.start}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    workingHours: { ...prev.workingHours, start: e.target.value }
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endTime">Hora de Fin</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.workingHours.end}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    workingHours: { ...prev.workingHours, end: e.target.value }
                  }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duración por Turno (minutos)</Label>
              <Input
                id="duration"
                type="number"
                min="15"
                max="180"
                step="15"
                value={formData.appointmentDuration}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  appointmentDuration: parseInt(e.target.value) || 30
                }))}
              />
            </div>

            <div className="space-y-3">
              <Label>Días de Atención</Label>
              <div className="flex flex-wrap gap-2">
                {dayNames.map((day, index) => {
                  const dayValue = dayValues[index];
                  const isSelected = formData.availableDays.includes(dayValue);
                  
                  return (
                    <Button
                      key={day}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleDay(dayValue)}
                      className={`transition-all duration-200 ${
                        isSelected ? 'shadow-md' : 'hover:shadow-md'
                      }`}
                    >
                      {day}
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Seleccione los días en que atiende pacientes
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Customization */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Personalización
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Mostrar disponibilidad pública</Label>
                <p className="text-sm text-muted-foreground">
                  Permite que los clientes vean horarios disponibles
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Confirmación automática</Label>
                <p className="text-sm text-muted-foreground">
                  Los turnos se confirman automáticamente
                </p>
              </div>
              <Switch />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Notificaciones por email</Label>
                <p className="text-sm text-muted-foreground">
                  Recibir notificaciones de nuevos turnos
                </p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="space-y-2">
              <Label>URL de acceso público</Label>
              <div className="flex">
                <Input
                  value="turnopro.com/dr-maria-gonzalez"
                  readOnly
                  className="bg-muted"
                />
                <Button
                  variant="outline"
                  className="ml-2"
                  onClick={() => {
                    navigator.clipboard.writeText("https://turnopro.com/dr-maria-gonzalez");
                    toast({
                      title: "URL copiada",
                      description: "El enlace se copió al portapapeles",
                    });
                  }}
                >
                  Copiar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Resumen de Configuración
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Horario de trabajo</p>
                <p className="text-lg font-semibold">
                  {formData.workingHours.start} - {formData.workingHours.end}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Duración por turno</p>
                <p className="text-lg font-semibold">{formData.appointmentDuration} minutos</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Días de atención</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {formData.availableDays.map(dayValue => (
                    <Badge key={dayValue} variant="secondary">
                      {dayNames[dayValue - 1]}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  Slots disponibles por día: {
                    Math.floor(
                      (parseInt(formData.workingHours.end.split(':')[0]) * 60 + 
                       parseInt(formData.workingHours.end.split(':')[1]) -
                       parseInt(formData.workingHours.start.split(':')[0]) * 60 -
                       parseInt(formData.workingHours.start.split(':')[1])) / 
                      formData.appointmentDuration
                    )
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isLoading}
          className="bg-gradient-primary hover:shadow-md transition-all duration-300 min-w-[120px]"
        >
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Guardando...</span>
            </div>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Guardar Cambios
            </>
          )}
        </Button>
      </div>
    </div>
  );
};