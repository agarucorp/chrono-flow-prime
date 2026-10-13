import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatClockAmPm, formatClockRangeAmPm } from '@/lib/timeFormat';

export type TipoActividad = 'cancelo' | 'reservo' | 'cambio_plan';

export interface ActividadEvento {
  id: string;
  tipo: TipoActividad;
  usuarioId: string;
  nombre: string;
  ocurridoEn: string;
  accion: string;
}

const ZONA = 'America/Argentina/Buenos_Aires';
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const LIMITE = 400;

interface Perfil {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
}

export function hoyArgentina(desde: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(desde);
}

export function sumarDias(isoFecha: string, dias: number): string {
  const [y, m, d] = isoFecha.split('-').map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function inicioDia(isoFecha: string): string {
  return new Date(`${isoFecha}T00:00:00-03:00`).toISOString();
}

function finDia(isoFecha: string): string {
  return new Date(`${isoFecha}T23:59:59.999-03:00`).toISOString();
}

function fechaArgentina(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function minutoArgentina(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

export function formatoCuando(iso: string): { fecha: string; hora: string } {
  const fecha = new Date(iso);
  const dia = new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA,
    day: 'numeric',
    month: 'short',
  }).format(fecha).replace(/\./g, '');
  const hora = new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(fecha);
  return { fecha: dia, hora };
}

function etiquetaClase(fecha: string, inicio: string, fin: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  if (!y || !m || !d) return formatClockRangeAmPm(inicio, fin);
  const local = new Date(y, m - 1, d);
  return `${DIAS[local.getDay()]} ${d} ${MESES[m - 1]}, ${formatClockRangeAmPm(inicio, fin)}`;
}

function nombrePersona(perfil?: Perfil): string {
  const directo = [perfil?.first_name, perfil?.last_name].filter(Boolean).join(' ').trim();
  const base = directo || (perfil?.full_name || '').trim();
  if (!base || base.includes('@')) return 'Alumno';
  return base
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase())
    .join(' ');
}

async function nombresPorId(ids: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const unicos = [...new Set(ids)];
  for (let i = 0; i < unicos.length; i += 100) {
    const lote = unicos.slice(i, i + 100);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, first_name, last_name')
      .in('id', lote);
    if (error) {
      console.error('Error cargando nombres de actividad:', error);
      continue;
    }
    for (const perfil of (data || []) as Perfil[]) {
      mapa.set(perfil.id, nombrePersona(perfil));
    }
  }
  return mapa;
}

export async function cargarActividad(desde: string, hasta: string): Promise<{ eventos: ActividadEvento[]; truncado: boolean }> {
  const desdeIso = inicioDia(desde);
  const hastaIso = finDia(hasta);

  const [cancelaciones, reservas, planes] = await Promise.all([
    supabase
      .from('turnos_cancelados')
      .select('id, cliente_id, turno_fecha, turno_hora_inicio, turno_hora_fin, fecha_cancelacion, created_at, tipo_cancelacion')
      .in('tipo_cancelacion', ['usuario', 'admin'])
      .gte('fecha_cancelacion', desdeIso)
      .lte('fecha_cancelacion', hastaIso)
      .order('fecha_cancelacion', { ascending: false })
      .limit(LIMITE),
    supabase
      .from('turnos_variables')
      .select('id, cliente_id, turno_fecha, turno_hora_inicio, turno_hora_fin, created_at')
      .eq('estado', 'confirmada')
      .gte('created_at', desdeIso)
      .lte('created_at', hastaIso)
      .order('created_at', { ascending: false })
      .limit(LIMITE),
    supabase
      .from('horarios_recurrentes_usuario')
      .select('usuario_id, dia_semana, hora_inicio, fecha_inicio, created_at')
      .gte('created_at', desdeIso)
      .lte('created_at', hastaIso)
      .order('created_at', { ascending: false })
      .limit(LIMITE),
  ]);

  if (cancelaciones.error) console.error('Error cargando cancelaciones:', cancelaciones.error);
  if (reservas.error) console.error('Error cargando reservas:', reservas.error);
  if (planes.error) console.error('Error cargando cambios de plan:', planes.error);

  const eventos: ActividadEvento[] = [];
  const ids: string[] = [];

  for (const fila of cancelaciones.data || []) {
    const cuando = fila.fecha_cancelacion || fila.created_at;
    if (!cuando || !fila.cliente_id) continue;
    ids.push(fila.cliente_id);
    const clase = etiquetaClase(fila.turno_fecha, fila.turno_hora_inicio, fila.turno_hora_fin);
    const desdeAdmin = String(fila.tipo_cancelacion || '').toLowerCase() === 'admin';
    eventos.push({
      id: `cancel-${fila.id}`,
      tipo: 'cancelo',
      usuarioId: fila.cliente_id,
      nombre: 'Alumno',
      ocurridoEn: cuando,
      accion: desdeAdmin ? `Canceló el ${clase} · desde el admin` : `Canceló el ${clase}`,
    });
  }

  for (const fila of reservas.data || []) {
    if (!fila.created_at || !fila.cliente_id) continue;
    ids.push(fila.cliente_id);
    eventos.push({
      id: `reserva-${fila.id}`,
      tipo: 'reservo',
      usuarioId: fila.cliente_id,
      nombre: 'Alumno',
      ocurridoEn: fila.created_at,
      accion: `Reservó el ${etiquetaClase(fila.turno_fecha, fila.turno_hora_inicio, fila.turno_hora_fin)}`,
    });
  }

  const lotes = new Map<string, { usuarioId: string; cuando: string; dias: { dia: number; hora: string }[] }>();
  for (const fila of planes.data || []) {
    if (!fila.created_at || !fila.usuario_id || !fila.fecha_inicio) continue;
    if (fila.fecha_inicio <= fechaArgentina(fila.created_at)) continue;
    const clave = `${fila.usuario_id}|${minutoArgentina(fila.created_at)}`;
    const lote = lotes.get(clave) || { usuarioId: fila.usuario_id, cuando: fila.created_at, dias: [] };
    if (fila.created_at > lote.cuando) lote.cuando = fila.created_at;
    lote.dias.push({ dia: Number(fila.dia_semana) || 0, hora: fila.hora_inicio });
    lotes.set(clave, lote);
  }

  for (const [clave, lote] of lotes) {
    ids.push(lote.usuarioId);
    const dias = [...lote.dias]
      .sort((a, b) => a.dia - b.dia || a.hora.localeCompare(b.hora))
      .filter((dia, index, lista) => lista.findIndex((otro) => otro.dia === dia.dia) === index);
    const detalle = dias
      .map((dia) => `${DIAS[dia.dia] || 'día'} ${formatClockAmPm(dia.hora)}`)
      .join(', ');
    const cantidad = dias.length;
    eventos.push({
      id: `plan-${clave}`,
      tipo: 'cambio_plan',
      usuarioId: lote.usuarioId,
      nombre: 'Alumno',
      ocurridoEn: lote.cuando,
      accion: `Cambió el plan a ${cantidad} ${cantidad === 1 ? 'día' : 'días'}${detalle ? `: ${detalle}` : ''}`,
    });
  }

  const nombres = await nombresPorId(ids);
  for (const evento of eventos) {
    evento.nombre = nombres.get(evento.usuarioId) || 'Alumno';
  }

  eventos.sort((a, b) => (a.ocurridoEn < b.ocurridoEn ? 1 : a.ocurridoEn > b.ocurridoEn ? -1 : 0));

  const truncado = [cancelaciones.data, reservas.data, planes.data].some((filas) => (filas?.length || 0) >= LIMITE);
  return { eventos, truncado };
}

export function useAdminActividad(activo: boolean) {
  const [recientes, setRecientes] = useState<ActividadEvento[]>([]);
  const [historial, setHistorial] = useState<ActividadEvento[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [truncado, setTruncado] = useState(false);

  const cargarRecientes = useCallback(async () => {
    if (!activo) return;
    const hoy = hoyArgentina();
    const { eventos } = await cargarActividad(sumarDias(hoy, -13), hoy);
    setRecientes(eventos);
  }, [activo]);

  const cargarHistorial = useCallback(async (desde: string, hasta: string) => {
    if (!activo) return;
    setCargandoHistorial(true);
    try {
      const { eventos, truncado: corto } = await cargarActividad(desde, hasta);
      setHistorial(eventos);
      setTruncado(corto);
    } finally {
      setCargandoHistorial(false);
    }
  }, [activo]);

  useEffect(() => {
    if (!activo) return;
    cargarRecientes();
    const id = window.setInterval(cargarRecientes, 60_000);
    const alVolver = () => {
      if (document.visibilityState === 'visible') cargarRecientes();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [activo, cargarRecientes]);

  return { recientes, historial, cargandoHistorial, truncado, cargarHistorial, cargarRecientes };
}
