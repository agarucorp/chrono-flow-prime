import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface StayLoggedInDialogProps {
  open: boolean;
  onChoose: (remember: boolean) => void;
}

export const StayLoggedInDialog = ({ open, onChoose }: StayLoggedInDialogProps) => {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="w-[85vw] sm:w-[400px] max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Mantenemos la sesión iniciada?</AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-2">
            <span className="block">
              En este navegador vas a entrar directo, sin volver a poner email y
              contraseña. Es lo mismo que Instagram en la web.
            </span>
            <span className="block">
              Si es una computadora compartida, elegí Solo esta vez.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row sm:justify-between items-stretch gap-2">
          <AlertDialogCancel
            className="text-xs sm:text-sm m-0 w-full sm:flex-1 bg-gray-500 text-white hover:bg-gray-600 border-gray-600"
            onClick={() => onChoose(false)}
          >
            Solo esta vez
          </AlertDialogCancel>
          <AlertDialogAction
            className="text-xs sm:text-sm m-0 w-full sm:flex-1"
            onClick={() => onChoose(true)}
          >
            Sí, mantenerme conectado
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
