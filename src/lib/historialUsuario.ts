import { supabase } from '@/lib/supabase';
import { formatClockRangeAmPm } from '@/lib/timeFormat';
import { formatoCuando, sumarDias } from '@/hooks/useAdminActividad';

const ZONA = 'America/Argentina/Buenos_Aires';
const DIAS_PLAN = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const DIAS_FECHA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS_A_FAVOR = 10;
const LIMITE = 1000;

export type TipoHistorial = 'plan' | 'cancelo' | 'reservo';

export interface EntradaHistorial {
  id: string;
  tipo: TipoHistorial;
  /** La tarjeta habla de una clase a favor: la que se generó, la que se usó o la que volvió. */
  esFavor: boolean;
  ocurridoEn: string;
  lineas: string[];
}

interface Cancelacion {
  id: string;
  turno_fecha: string;
  turno_hora_inicio: string;
  turno_hora_fin: string;
  clase_numero: number;
  origen: string | null;
  tipo_cancelacion: string | null;
  cancelacion_tardia: boolean | null;
  fecha_cancelacion: string | null;
  created_at: string | null;
}

interface Reserva {
  id: string;
  turno_fecha: string;
  turno_hora_inicio: string;
  turno_hora_fin: string;
  clase_numero: number;
  estado: string | null;
  credito_cancelacion_id: string | null;
  created_at: string | null;
}

interface FilaPlan {
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  created_at: string;
}

interface SlotPlan {
  dia: number;
  inicio: string;
  fin: string | null;
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

function unir(partes: string[]): string {
  if (partes.length <= 1) return partes[0] || '';
  if (partes.length === 2) return `${partes[0]} y ${partes[1]}`;
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

function etiquetaFecha(isoFecha: string): string {
  const [y, m, d] = isoFecha.split('-').map(Number);
  if (!y || !m || !d) return isoFecha;
  const local = new Date(y, m - 1, d);
  return `${DIAS_FECHA[local.getDay()]} ${d} ${MESES[m - 1]}`;
}

function etiquetaClase(fecha: string, inicio: string, fin: string | null): string {
  const rango = formatClockRangeAmPm(inicio, fin);
  const cuando = etiquetaFecha(fecha);
  return rango ? `${cuando}, ${rango}` : cuando;
}

function etiquetaSlot(slot: SlotPlan): string {
  const dia = DIAS_PLAN[slot.dia] || 'día';
  const rango = formatClockRangeAmPm(slot.inicio, slot.fin);
  return rango ? `${dia} ${rango}` : dia;
}

function slotsDe(filas: FilaPlan[]): SlotPlan[] {
  const vistos = new Set<string>();
  const slots: SlotPlan[] = [];
  for (const fila of filas) {
    const dia = Number(fila.dia_semana) || 0;
    const clave = `${dia}|${fila.hora_inicio}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    slots.push({ dia, inicio: fila.hora_inicio, fin: fila.hora_fin });
  }
  return slots.sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));
}

function lineasDelPlan(antes: SlotPlan[], ahora: SlotPlan[], esAlta: boolean): string[] {
  const ahoraTxt = unir(ahora.map(etiquetaSlot));
  if (esAlta) {
    return [`Eligió sus horarios: ${ahoraTxt}.`];
  }
  if (antes.length === 0) {
    return [
      'Actualizó sus horarios recurrentes.',
      `Quedó en: ${ahoraTxt}.`,
    ];
  }

  const antesTxt = unir(antes.map(etiquetaSlot));
  const lineas = [
    'Actualizó sus horarios recurrentes.',
    `Antes: ${antesTxt}.`,
    `Ahora: ${ahoraTxt}.`,
  ];

  const clave = (slot: SlotPlan) => `${slot.dia}|${slot.inicio}`;
  const quedaron = new Set(ahora.map(clave));
  const yaEstaban = new Set(antes.map(clave));
  const dejo = antes.filter((slot) => !quedaron.has(clave(slot)));
  const sumo = ahora.filter((slot) => !yaEstaban.has(clave(slot)));

  if (dejo.length === 0 && sumo.length === 0) {
    return [`Guardó de nuevo los mismos horarios: ${ahoraTxt}.`];
  }
  if (dejo.length === 1 && sumo.length === 1) {
    lineas.push(
      dejo[0].dia === sumo[0].dia
        ? `El ${DIAS_PLAN[dejo[0].dia]} pasó de ${formatClockRangeAmPm(dejo[0].inicio, dejo[0].fin)} a ${formatClockRangeAmPm(sumo[0].inicio, sumo[0].fin)}.`
        : `Cambió el ${etiquetaSlot(dejo[0])} por el ${etiquetaSlot(sumo[0])}.`
    );
    return lineas;
  }
  if (dejo.length > 0) lineas.push(`Dejó ${unir(dejo.map((slot) => `el ${etiquetaSlot(slot)}`))}.`);
  if (sumo.length > 0) lineas.push(`Sumó ${unir(sumo.map((slot) => `el ${etiquetaSlot(slot)}`))}.`);
  return lineas;
}

function armarPlanes(filas: FilaPlan[]): EntradaHistorial[] {
  const grupos = new Map<string, FilaPlan[]>();
  for (const fila of filas) {
    if (!fila.created_at) continue;
    const clave = minutoArgentina(fila.created_at);
    const lista = grupos.get(clave) || [];
    lista.push(fila);
    grupos.set(clave, lista);
  }

  const entradas: EntradaHistorial[] = [];
  for (const [clave, grupo] of grupos) {
    const cuando = grupo.reduce((max, fila) => (fila.created_at > max ? fila.created_at : max), grupo[0].created_at);
    const fechaInicio = grupo.map((fila) => fila.fecha_inicio).find(Boolean) || null;
    const esAlta = !fechaInicio || fechaInicio <= fechaArgentina(cuando);
    let antes: SlotPlan[] = [];
    if (!esAlta && fechaInicio) {
      const corte = sumarDias(fechaInicio, -1);
      const previas = filas.filter((fila) => fila.fecha_fin === corte && fila.created_at < cuando);
      const ultimo = previas.reduce((max, fila) => (fila.created_at > max ? fila.created_at : max), '');
      const minuto = ultimo ? minutoArgentina(ultimo) : '';
      antes = slotsDe(previas.filter((fila) => minutoArgentina(fila.created_at) === minuto));
    }
    entradas.push({
      id: `plan-${clave}`,
      tipo: 'plan',
      esFavor: false,
      ocurridoEn: cuando,
      lineas: lineasDelPlan(antes, slotsDe(grupo), esAlta),
    });
  }
  return entradas;
}

function venceEl(iso: string): string {
  return etiquetaFecha(sumarDias(fechaArgentina(iso), DIAS_A_FAVOR));
}

function armarCancelaciones(filas: Cancelacion[], reservas: Reserva[], porId: Map<string, Cancelacion>): EntradaHistorial[] {
  const reservasPorClase = new Map<string, Reserva>();
  for (const reserva of reservas) {
    reservasPorClase.set(`${reserva.turno_fecha}|${reserva.clase_numero}`, reserva);
  }

  return filas.flatMap((fila) => {
    const tipo = String(fila.tipo_cancelacion || '').toLowerCase();
    if (tipo && tipo !== 'usuario' && tipo !== 'admin') return [];
    const cuando = fila.fecha_cancelacion || fila.created_at;
    if (!cuando) return [];

    const clase = etiquetaClase(fila.turno_fecha, fila.turno_hora_inicio, fila.turno_hora_fin);
    const desdeAdmin = tipo === 'admin';
    const tardia = Boolean(fila.cancelacion_tardia);
    const esPlan = (fila.origen || 'recurrente') !== 'variable';

    if (esPlan) {
      return [{
        id: `cancel-${fila.id}`,
        tipo: 'cancelo' as const,
        esFavor: !tardia,
        ocurridoEn: cuando,
        lineas: tardia
          ? [
              `${desdeAdmin ? 'El admin le canceló' : 'Canceló'} tarde la clase del ${clase}.`,
              'No le quedó clase a favor.',
            ]
          : [
              `${desdeAdmin ? 'El admin le canceló' : 'Canceló'} la clase del ${clase}.`,
              `Le quedó una clase a favor de esa clase, para usar hasta el ${venceEl(cuando)}.`,
            ],
      }];
    }

    const reserva = reservasPorClase.get(`${fila.turno_fecha}|${fila.clase_numero}`);
    const credito = reserva?.credito_cancelacion_id ? porId.get(reserva.credito_cancelacion_id) : undefined;
    const origen = credito
      ? etiquetaClase(credito.turno_fecha, credito.turno_hora_inicio, credito.turno_hora_fin)
      : '';
    const lineas = [
      `${desdeAdmin ? 'El admin le canceló' : 'Canceló'}${tardia ? ' tarde' : ''} la vacante del ${clase}.`,
    ];
    if (origen && tardia) lineas.push(`Perdió la clase a favor del ${origen}.`);
    if (origen && !tardia) lineas.push(`Le volvió la clase a favor del ${origen}.`);
    return [{
      id: `cancel-${fila.id}`,
      tipo: 'cancelo' as const,
      esFavor: Boolean(origen),
      ocurridoEn: cuando,
      lineas,
    }];
  });
}

function armarReservas(filas: Reserva[], porId: Map<string, Cancelacion>): EntradaHistorial[] {
  return filas.flatMap((fila) => {
    if (!fila.created_at) return [];
    if (fila.estado !== 'confirmada' && fila.estado !== 'cancelada') return [];
    const clase = etiquetaClase(fila.turno_fecha, fila.turno_hora_inicio, fila.turno_hora_fin);
    const credito = fila.credito_cancelacion_id ? porId.get(fila.credito_cancelacion_id) : undefined;
    if (credito) {
      const origen = etiquetaClase(credito.turno_fecha, credito.turno_hora_inicio, credito.turno_hora_fin);
      return [{
        id: `reserva-${fila.id}`,
        tipo: 'reservo' as const,
        esFavor: true,
        ocurridoEn: fila.created_at,
        lineas: [
          `Usó la clase a favor del ${origen}.`,
          `La usó en la clase del ${clase}.`,
        ],
      }];
    }
    return [{
      id: `reserva-${fila.id}`,
      tipo: 'reservo' as const,
      esFavor: false,
      ocurridoEn: fila.created_at,
      lineas: [`Reservó una vacante el ${clase}.`],
    }];
  });
}

export async function cargarHistorialUsuario(usuarioId: string): Promise<{ entradas: EntradaHistorial[]; truncado: boolean }> {
  const [cancelaciones, reservas, planes] = await Promise.all([
    supabase
      .from('turnos_cancelados')
      .select('id, turno_fecha, turno_hora_inicio, turno_hora_fin, clase_numero, origen, tipo_cancelacion, cancelacion_tardia, fecha_cancelacion, created_at')
      .eq('cliente_id', usuarioId)
      .order('fecha_cancelacion', { ascending: false })
      .limit(LIMITE),
    supabase
      .from('turnos_variables')
      .select('id, turno_fecha, turno_hora_inicio, turno_hora_fin, clase_numero, estado, credito_cancelacion_id, created_at')
      .eq('cliente_id', usuarioId)
      .order('created_at', { ascending: false })
      .limit(LIMITE),
    supabase
      .from('horarios_recurrentes_usuario')
      .select('dia_semana, hora_inicio, hora_fin, fecha_inicio, fecha_fin, created_at')
      .eq('usuario_id', usuarioId)
      .order('created_at', { ascending: true })
      .limit(LIMITE),
  ]);

  if (cancelaciones.error) throw cancelaciones.error;
  if (reservas.error) throw reservas.error;
  if (planes.error) throw planes.error;

  const cancels = (cancelaciones.data || []) as Cancelacion[];
  const porId = new Map(cancels.map((fila) => [fila.id, fila]));
  const reservasFilas = (reservas.data || []) as Reserva[];

  const entradas = [
    ...armarPlanes((planes.data || []) as FilaPlan[]),
    ...armarCancelaciones(cancels, reservasFilas, porId),
    ...armarReservas(reservasFilas, porId),
  ].sort((a, b) => (a.ocurridoEn < b.ocurridoEn ? 1 : a.ocurridoEn > b.ocurridoEn ? -1 : 0));

  const truncado = [cancelaciones.data, reservas.data, planes.data].some((filas) => (filas?.length || 0) >= LIMITE);
  return { entradas, truncado };
}

export function cuandoHistorial(iso: string): { fecha: string; hora: string } {
  return formatoCuando(iso);
}
