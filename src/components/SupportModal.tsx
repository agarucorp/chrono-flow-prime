import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, Copy, Check, ExternalLink } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportModal = ({ isOpen, onClose }: SupportModalProps) => {
  const [copied, setCopied] = useState(false);
  const { showSuccess } = useNotifications();

  const contactEmail = 'agaru.corp@gmail.com';
  const whatsappNumber = '5491130509316';
  const whatsappMessage = encodeURIComponent('Hola! Necesito ayuda con la aplicación.');

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(contactEmail);
      setCopied(true);
      showSuccess('Email copiado', 'Listo para pegar donde necesites');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error al copiar email:', error);
    }
  };

  const handleWhatsAppClick = () => {
    window.open(`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="w-[min(92vw,420px)] gap-0 overflow-hidden border-border bg-popover p-0 shadow-elegant">
        <div className="border-b border-border px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-title">
              Soporte
            </DialogTitle>
            <DialogDescription>
              Escribinos por el canal que te resulte más cómodo.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-3 px-5 py-5 sm:px-6">
          <div className="surface-inset p-3.5 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                <Mail className="h-5 w-5 text-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-label">Email</p>
                <p className="truncate text-body">{contactEmail}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCopyEmail}
                className="h-9 shrink-0 gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleWhatsAppClick}
            className="group flex w-full items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-left transition-colors hover:border-emerald-400/50 hover:bg-emerald-500/15 sm:p-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366]">
              <img src="/WhatsApp.png" alt="" className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-emerald-100">WhatsApp</p>
              <p className="text-caption text-emerald-200/70">Abrir chat de soporte</p>
            </div>
            <ExternalLink className="h-4 w-4 shrink-0 text-emerald-300/80 transition-transform group-hover:translate-x-0.5" />
          </button>

          <p className="pt-1 text-center text-caption">
            Tus comentarios nos ayudan a mejorar la plataforma.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
