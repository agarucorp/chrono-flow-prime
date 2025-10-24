import { useState } from 'react';
import { Calendar, Clock, User, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Turno {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: 'disponible' | 'ocupado' | 'cancelado';
  servicio: string;
  cliente_id?: string;
  profesional_id?: string;
}

interface TurnoConfirmationModalProps {
  turno: Turno | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (turno: Turno) => void;
  loading?: boolean;
}

export const TurnoConfirmationModal = ({ 
  turno, 
  isOpen, 
  onClose, 
  onConfirm, 
  loading = false 
}: TurnoConfirmationModalProps) => {
  if (!turno) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5); // Asegura formato HH:MM
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'disponible':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'ocupado':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelado':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span>Confirmar Reserva de Entrenamiento</span>
          </DialogTitle>
          <DialogDescription>
            Revisa los detalles de tu sesión antes de confirmar la reserva
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Información del Turno */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Detalles de la Sesión</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Estado y Servicio */}
              <div className="flex items-center justify-between">
                <Badge className={getStatusColor(turno.estado)}>
                  {turno.estado}
                </Badge>
                <span className="text-sm font-medium text-primary">
                  {turno.servicio}
                </span>
              </div>

              {/* Fecha */}
              <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Fecha</p>
                  <p className="font-medium">{formatDate(turno.fecha)}</p>
                </div>
              </div>

              {/* Horario */}
              <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Horario</p>
                  <p className="font-medium">
                    {formatTime(turno.hora_inicio)} - {formatTime(turno.hora_fin)}
                  </p>
                </div>
              </div>

              {/* Duración */}
              <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Duración</p>
                  <p className="font-medium">
                    {Math.round((new Date(`2000-01-01T${turno.hora_fin}`).getTime() - 
                                new Date(`2000-01-01T${turno.hora_inicio}`).getTime()) / (1000 * 60))} minutos
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>


        </div>

        <DialogFooter className="flex space-x-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(turno)}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Confirmando...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Reservar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
