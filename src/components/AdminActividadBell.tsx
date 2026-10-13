import { useEffect, useMemo, useState } from 'react';
import { BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  formatoCuando,
  hoyArgentina,
  sumarDias,
  useAdminActividad,
  type ActividadEvento,
  type TipoActividad,
} from '@/hooks/useAdminActividad';

const VISTO_KEY = 'malda_admin_actividad_vista';
const GRUPOS_VISIBLES = 8;

type FiltroTipo = 'todas' | TipoActividad;

interface GrupoActividad {
  clave: string;
  tipo: TipoActividad;
  nombre: string;
  ocurridoEn: string;
  cantidad: number;
  accion: string;
}

const ETIQUETA: Record<FiltroTipo, string> = {
  todas: 'Todas',
  cancelo: 'Canceló',
  reservo: 'Reservó',
  cambio_plan: 'Cambió de plan',
};

function resumenGrupo(tipo: TipoActividad, cantidad: number, accion: string): string {
  if (cantidad <= 1) return accion;
  if (tipo === 'cancelo') return `Canceló ${cantidad} clases`;
  if (tipo === 'reservo') return `Reservó ${cantidad} clases`;
  return accion;
}

function agrupar(eventos: ActividadEvento[]): GrupoActividad[] {
  const grupos = new Map<string, ActividadEvento[]>();
  for (const evento of eventos) {
    const dia = formatoCuando(evento.ocurridoEn).fecha;
    const clave = `${evento.usuarioId}|${evento.tipo}|${dia}`;
    const lista = grupos.get(clave) || [];
    lista.push(evento);
    grupos.set(clave, lista);
  }

  return [...grupos.entries()]
    .map(([clave, lista]) => {
      const ordenada = [...lista].sort((a, b) => (a.ocurridoEn < b.ocurridoEn ? 1 : -1));
      const ultima = ordenada[0];
      return {
        clave,
        tipo: ultima.tipo,
        nombre: ultima.nombre,
        ocurridoEn: ultima.ocurridoEn,
        cantidad: ordenada.length,
        accion: resumenGrupo(ultima.tipo, ordenada.length, ultima.accion),
      };
    })
    .sort((a, b) => (a.ocurridoEn < b.ocurridoEn ? 1 : -1))
    .slice(0, GRUPOS_VISIBLES);
}

function punto(tipo: TipoActividad): string {
  if (tipo === 'cancelo') return 'bg-red-400';
  if (tipo === 'reservo') return 'bg-sky-400';
  return 'bg-amber-300';
}

export const AdminActividadBell = () => {
  const { recientes, historial, cargandoHistorial, truncado, cargarHistorial } = useAdminActividad(true);
  const [abierto, setAbierto] = useState(false);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [vistoEn, setVistoEn] = useState<string | null>(() => localStorage.getItem(VISTO_KEY));
  const [preset, setPreset] = useState<'hoy' | '7' | '30' | 'custom'>('7');
  const [desde, setDesde] = useState(() => sumarDias(hoyArgentina(), -6));
  const [hasta, setHasta] = useState(() => hoyArgentina());
  const [tipo, setTipo] = useState<FiltroTipo>('todas');
  const [nombre, setNombre] = useState('');

  const grupos = useMemo(() => agrupar(recientes), [recientes]);

  const noVistas = useMemo(() => {
    const corte = vistoEn || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return recientes.filter((evento) => evento.ocurridoEn > corte).length;
  }, [recientes, vistoEn]);

  const marcarVisto = () => {
    const ahora = new Date().toISOString();
    localStorage.setItem(VISTO_KEY, ahora);
    setVistoEn(ahora);
  };

  useEffect(() => {
    if (abierto) marcarVisto();
  }, [abierto, recientes]);

  const aplicarRango = (siguiente: 'hoy' | '7' | '30') => {
    const hoy = hoyArgentina();
    const inicio = siguiente === 'hoy' ? hoy : sumarDias(hoy, siguiente === '7' ? -6 : -29);
    setPreset(siguiente);
    setDesde(inicio);
    setHasta(hoy);
  };

  useEffect(() => {
    if (!historialAbierto || !desde || !hasta) return;
    const a = desde <= hasta ? desde : hasta;
    const b = desde <= hasta ? hasta : desde;
    cargarHistorial(a, b);
  }, [historialAbierto, desde, hasta, cargarHistorial]);

  const visibles = useMemo(() => {
    const busqueda = nombre.trim().toLowerCase();
    return historial.filter((evento) => {
      if (tipo !== 'todas' && evento.tipo !== tipo) return false;
      if (busqueda && !evento.nombre.toLowerCase().includes(busqueda)) return false;
      return true;
    });
  }, [historial, tipo, nombre]);

  const abrirHistorial = (filtroNombre = '', filtroTipo: FiltroTipo = 'todas') => {
    setNombre(filtroNombre);
    setTipo(filtroTipo);
    if (filtroNombre) aplicarRango('30');
    setAbierto(false);
    setHistorialAbierto(true);
  };

  return (
    <>
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-9 w-9 p-0 flex-shrink-0"
            aria-label={noVistas > 0 ? `${noVistas} movimientos sin ver` : 'Actividad'}
          >
            <BellRing className="h-5 w-5 text-foreground/80" />
            {noVistas > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold leading-none text-black">
                {noVistas > 9 ? '9+' : noVistas}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
          <div className="border-b px-4 py-3">
            <p className="text-sm font-medium">Actividad</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Cancelaciones, reservas y cambios de plan de los últimos 14 días.
            </p>
          </div>
          {grupos.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No hay movimientos recientes.</p>
          ) : (
            <div className="max-h-80 divide-y overflow-y-auto">
              {grupos.map((grupo) => {
                const cuando = formatoCuando(grupo.ocurridoEn);
                return (
                  <button
                    key={grupo.clave}
                    type="button"
                    onClick={() => abrirHistorial(grupo.nombre, grupo.tipo)}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
                  >
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${punto(grupo.tipo)}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{grupo.nombre}</span>
                      <span className="block text-xs text-muted-foreground">{cuando.fecha} · {cuando.hora}</span>
                      <span className="mt-0.5 block text-xs text-foreground/80">{grupo.accion}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={() => abrirHistorial()}
            className="w-full border-t px-4 py-2.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            Ver historial
          </button>
        </PopoverContent>
      </Popover>

      <Dialog open={historialAbierto} onOpenChange={setHistorialAbierto}>
        <DialogContent className="flex max-h-[85vh] w-[min(94vw,40rem)] flex-col gap-3 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-base font-medium">Historial de actividad</DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap gap-1.5">
            {([
              ['hoy', 'Hoy'],
              ['7', '7 días'],
              ['30', '30 días'],
            ] as const).map(([id, etiqueta]) => (
              <button
                key={id}
                type="button"
                onClick={() => aplicarRango(id)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  preset === id
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={desde}
              aria-label="Desde"
              className="h-9 text-xs [color-scheme:dark]"
              onChange={(event) => {
                setPreset('custom');
                setDesde(event.target.value);
              }}
            />
            <Input
              type="date"
              value={hasta}
              aria-label="Hasta"
              className="h-9 text-xs [color-scheme:dark]"
              onChange={(event) => {
                setPreset('custom');
                setHasta(event.target.value);
              }}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(ETIQUETA) as FiltroTipo[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTipo(id)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  tipo === id
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {ETIQUETA[id]}
              </button>
            ))}
          </div>

          <Input
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            placeholder="Buscar por nombre"
            className="h-9 text-sm"
          />

          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">
            {cargandoHistorial ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Cargando...</p>
            ) : visibles.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No hay movimientos en ese período.</p>
            ) : (
              <div className="divide-y">
                {visibles.map((evento) => {
                  const cuando = formatoCuando(evento.ocurridoEn);
                  return (
                    <div key={evento.id} className="flex items-start gap-3 px-3 py-2.5">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${punto(evento.tipo)}`} />
                      <div className="min-w-0">
                        <p className="truncate text-sm">{evento.nombre}</p>
                        <p className="text-xs text-muted-foreground">{cuando.fecha} · {cuando.hora}</p>
                        <p className="mt-0.5 text-xs text-foreground/80">{evento.accion}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {truncado && (
            <p className="text-xs text-muted-foreground">Hay más movimientos en esas fechas. Achicá el rango para verlos todos.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
