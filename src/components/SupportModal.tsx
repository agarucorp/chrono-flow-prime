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
  const whatsappNumber = '+5491123456789'; // Número de WhatsApp (ajustar según necesidad)
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-semibold">
            Soporte y Contacto
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Email de contacto */}
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email de contacto</p>
                    <p className="text-sm font-mono">{contactEmail}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyEmail}
                  className="flex items-center space-x-2"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
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
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <img 
                    src="/WhatsApp.png" 
                    alt="WhatsApp" 
                    className="h-5 w-5"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700">WhatsApp</p>
                  <p className="text-xs text-green-600">Chatea con nosotros</p>
                </div>
                <MessageCircle className="h-4 w-4 text-green-600" />
              </div>
            </CardContent>
          </Card>

          {/* Información adicional */}
          <div className="text-center pt-2">
            <p className="text-xs text-muted-foreground">
              Envíanos tus comentarios para seguir mejorando la plataforma
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
