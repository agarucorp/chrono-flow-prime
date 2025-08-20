import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, CheckCircle } from 'lucide-react';

interface TurnoReserva {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  servicio?: string;
  estado: string;
  profesional_nombre?: string;
}

interface ReservaConfirmationModalProps {
  turno: TurnoReserva | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

export const ReservaConfirmationModal: React.FC<ReservaConfirmationModalProps> = ({
  turno,
  isOpen,
  onClose,
  onConfirm,
  loading
}) => {
  if (!turno) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span>Confirmar Reserva</span>
          </DialogTitle>
          <DialogDescription>
            ¿Estás seguro de que quieres reservar esta sesión de entrenamiento?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Información del turno */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {new Date(turno.fecha).toLocaleDateString('es-ES', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {turno.hora_inicio} - {turno.hora_fin}
              </span>
            </div>
            
            {turno.profesional_nombre && turno.profesional_nombre !== 'Sin asignar' && (
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {turno.profesional_nombre}
                </span>
              </div>
            )}
            
            <div className="pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Servicio: {turno.servicio || 'Sin especificar'}
              </span>
            </div>
          </div>
          
          {/* Confirmación */}
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-medium">¡Perfecto! Este horario está disponible</p>
                <p className="text-xs mt-1">
                  Confirma tu reserva para asegurar tu lugar en el entrenamiento
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex space-x-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Reservando...
              </>
            ) : (
              'Confirmar Reserva'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
