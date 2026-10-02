import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatFechaCorta, DIAS_CLASE_A_FAVOR } from '@/hooks/useClasesAFavor';
import type { AlumnoConClasesAFavor } from '@/hooks/useAdminClasesAFavor';

interface ClasesAFavorBellProps {
  alumnos: AlumnoConClasesAFavor[];
  total: number;
  onSelectAlumno?: (alumno: AlumnoConClasesAFavor) => void;
}

/**
 * Campanita del panel admin: solo aparece si algún alumno tiene clases a favor
 * sin usar. Lista quién y cuándo vence la primera.
 */
export const ClasesAFavorBell = ({ alumnos, total, onSelectAlumno }: ClasesAFavorBellProps) => {
  const [open, setOpen] = useState(false);

  if (total === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-9 w-9 p-0 flex-shrink-0"
          aria-label={total === 1 ? '1 clase a favor pendiente' : `${total} clases a favor pendientes`}
        >
          <Bell className="h-5 w-5 text-foreground/80" />
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-green-600 px-1 text-[10px] font-semibold leading-none text-white">
            {total}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-medium">Clases a favor pendientes</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Alumnos que cancelaron a tiempo y todavía no reservaron la vacante. Vencen a los {DIAS_CLASE_A_FAVOR} días de cancelar.
          </p>
        </div>
        <div className="max-h-72 divide-y overflow-y-auto">
          {alumnos.map((a) => (
            <button
              key={a.usuarioId}
              type="button"
              onClick={() => {
                setOpen(false);
                onSelectAlumno?.(a);
              }}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{a.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {a.cantidad > 1 ? 'La primera vence' : 'Vence'} el {formatFechaCorta(a.proximoVencimiento)}
                </p>
              </div>
              <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-green-600/15 px-2 text-xs font-semibold text-green-600 dark:text-green-400">
                {a.cantidad}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
