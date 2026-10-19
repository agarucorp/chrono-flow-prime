import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  cargarHistorialUsuario,
  cuandoHistorial,
  type EntradaHistorial,
  type TipoHistorial,
} from '@/lib/historialUsuario';

type Filtro = 'todos' | TipoHistorial | 'favor';

const FILTROS: { id: Filtro; etiqueta: string }[] = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'plan', etiqueta: 'Horarios' },
  { id: 'cancelo', etiqueta: 'Cancelaciones' },
  { id: 'reservo', etiqueta: 'Reservas' },
  { id: 'favor', etiqueta: 'Clases a favor' },
];

function punto(tipo: TipoHistorial): string {
  if (tipo === 'cancelo') return 'bg-red-400';
  if (tipo === 'reservo') return 'bg-sky-400';
  return 'bg-amber-300';
}

interface HistorialUsuarioDialogProps {
  usuario: { id: string; nombre: string } | null;
  onClose: () => void;
}

export const HistorialUsuarioDialog = ({ usuario, onClose }: HistorialUsuarioDialogProps) => {
  const [entradas, setEntradas] = useState<EntradaHistorial[]>([]);
  const [truncado, setTruncado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todos');

  useEffect(() => {
    if (!usuario) return;
    let vigente = true;
    setCargando(true);
    setError(false);
    setFiltro('todos');
    cargarHistorialUsuario(usuario.id)
      .then((resultado) => {
        if (!vigente) return;
        setEntradas(resultado.entradas);
        setTruncado(resultado.truncado);
      })
      .catch((err) => {
        console.error('Error cargando historial del usuario:', err);
        if (!vigente) return;
        setEntradas([]);
        setError(true);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [usuario]);

  const visibles = useMemo(() => {
    if (filtro === 'todos') return entradas;
    if (filtro === 'favor') return entradas.filter((entrada) => entrada.esFavor);
    return entradas.filter((entrada) => entrada.tipo === filtro);
  }, [entradas, filtro]);

  return (
    <Dialog open={Boolean(usuario)} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="flex max-h-[85vh] w-[min(94vw,40rem)] flex-col gap-3 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">Cambios de {usuario?.nombre}</DialogTitle>
          <DialogDescription>
            Horarios, cancelaciones, reservas y clases a favor de esta persona.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {FILTROS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFiltro(item.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                filtro === item.id
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.etiqueta}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {cargando ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">Cargando cambios...</p>
          ) : error ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">No se pudo cargar el historial.</p>
          ) : visibles.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              {entradas.length === 0 ? 'Esta persona todavía no tiene cambios cargados.' : 'No hay cambios de ese tipo.'}
            </p>
          ) : (
            visibles.map((entrada) => {
              const cuando = cuandoHistorial(entrada.ocurridoEn);
              return (
                <article key={entrada.id} className="rounded-lg border border-border bg-card px-3 py-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${punto(entrada.tipo)}`} />
                    <span>{cuando.fecha} · {cuando.hora}</span>
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {entrada.lineas.map((linea, indice) => (
                      <p key={indice} className="text-sm leading-snug text-foreground/90">{linea}</p>
                    ))}
                  </div>
                </article>
              );
            })
          )}
        </div>
        {truncado && (
          <p className="text-xs text-muted-foreground">Hay cambios más viejos que no entran en esta lista.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};
