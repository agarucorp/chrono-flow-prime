import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, MessageCircle, Copy, Check } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportModal = ({ isOpen, onClose }: SupportModalProps) => {
  const [copied, setCopied] = useState(false);
  const { showSuccess } = useNotifications();

  const contactEmail = 'agaru.corp@gmail.com';
  const whatsappNumber = '5491130509316'; // Número de WhatsApp de soporte
  const whatsappMessage = encodeURIComponent('Hola! Necesito ayuda con la aplicación.');

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(contactEmail);
      setCopied(true);
      showSuccess('Email copiado', 'El email ha sido copiado al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error al copiar email:', error);
    }
  };

  const handleWhatsAppClick = () => {
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;
    window.open(whatsappUrl, '_blank');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:w-auto sm:max-w-md p-4 sm:p-6">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="text-center text-base sm:text-xl font-semibold">
            Soporte y Contacto
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 py-2 sm:py-4">
          {/* Email de contacto */}
          <Card className="border-primary/20">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start sm:items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                  <div className="p-1.5 sm:p-2 bg-primary/10 rounded-full flex-shrink-0">
                    <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">Email</p>
                    <p className="text-xs sm:text-sm font-mono truncate">{contactEmail}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyEmail}
                  className="flex items-center justify-center space-x-1 h-8 px-3 text-xs w-full sm:w-auto flex-shrink-0"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span className="text-xs">
                    {copied ? 'Copiado' : 'Copiar'}
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* WhatsApp */}
          <Card className="border-green-200 hover:border-green-300 transition-colors cursor-pointer"
                onClick={handleWhatsAppClick}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="p-1.5 sm:p-2 bg-green-100 rounded-full flex-shrink-0">
                  <img 
                    src="/WhatsApp.png" 
                    alt="WhatsApp" 
                    className="h-4 w-4 sm:h-5 sm:w-5"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-green-700">WhatsApp</p>
                  <p className="text-[10px] sm:text-xs text-green-600">Chatea con nosotros</p>
                </div>
                <MessageCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          {/* Información adicional */}
          <div className="text-center pt-1 sm:pt-2 px-2">
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Envíanos tus comentarios para seguir mejorando la plataforma
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
