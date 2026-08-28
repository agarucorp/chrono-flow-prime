import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WHATSAPP_DESARROLLADOR =
  'https://wa.me/5491130509316?text=' +
  encodeURIComponent('Hola! Necesito ayuda con la aplicación MALDA.');
const WHATSAPP_MALDA = 'https://wa.link/tcs28v';

export const SupportModal = ({ isOpen, onClose }: SupportModalProps) => {
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
            <DialogTitle className="text-title">Soporte</DialogTitle>
            <DialogDescription>
              Escribinos por WhatsApp al canal que prefieras.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-3 px-5 py-5 sm:px-6">
          <a
            href={WHATSAPP_DESARROLLADOR}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex h-12 w-full items-center justify-center rounded-xl border border-white/50 text-sm font-medium text-foreground transition-colors hover:border-white/70 hover:bg-accent"
          >
            Desarrollador
          </a>
          <a
            href={WHATSAPP_MALDA}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex h-12 w-full items-center justify-center rounded-xl border border-white/50 text-sm font-medium text-foreground transition-colors hover:border-white/70 hover:bg-accent"
          >
            MALDA
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
};
