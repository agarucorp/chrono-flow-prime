import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, AlertTriangle } from 'lucide-react';

interface TurnoReservado {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  servicio: string;
  estado: string;
  profesional_nombre?: string;
}

interface CancelacionConfirmationModalProps {
  turno: TurnoReservado | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

export const CancelacionConfirmationModal: React.FC<CancelacionConfirmationModalProps> = ({
  turno,
  isOpen,
  onClose,
  onConfirm,
  loading
}) => {
  if (!turno) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 sm:fixed sm:bottom-4 sm:left-4 sm:top-auto sm:transform-none">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span>Confirmar Cancelación</span>
          </DialogTitle>
          <DialogDescription>
            ¿Estás seguro de que quieres cancelar esta sesión de entrenamiento?
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
            
            {turno.profesional_nombre && (
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {turno.profesional_nombre}
                </span>
              </div>
            )}
            
            <div className="pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Servicio: {turno.servicio}
              </span>
            </div>
          </div>
          
          {/* Advertencia */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Esta acción no se puede deshacer</p>
                <p className="text-xs mt-1">
                  Una vez cancelado, el turno volverá a estar disponible para otros usuarios
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
            Mantener Reserva
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Cancelando...
              </>
            ) : (
              'Sí, Cancelar Turno'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

