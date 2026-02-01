// @ts-nocheck
// Edge Function: enviar-cobros-mensuales
// Env requeridas: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@3";

type CuotaMensual = {
  usuario_id: string;
  anio: number;
  mes: number;
  clases_previstas: number | null;
  clases_a_cobrar: number | null;
  tarifa_unitaria: number | null;
  monto_total: number | null;
  monto_con_descuento: number | null;
  descuento_porcentaje: number | null;
  clases_canceladas_anticipacion: number | null;
  clases_canceladas_tardia: number | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
};

function getTargetPeriod(override?: { anio?: number; mes?: number }) {
  const now = new Date();
  if (override?.anio && override?.mes) return { anio: override.anio, mes: override.mes };
  // Si estamos en los primeros días del mes (1-5), enviar para el mes ACTUAL
  // Si estamos después del día 5, enviar para el mes SIGUIENTE (comportamiento original)
  const dayOfMonth = now.getDate();
  if (dayOfMonth <= 5) {
    // Mes actual (ideal para enviar el 1ro de cada mes)
    return { anio: now.getFullYear(), mes: now.getMonth() + 1 };
  }
  // Mes siguiente (comportamiento original, para pruebas manuales a mitad de mes)
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { anio: nextMonth.getFullYear(), mes: nextMonth.getMonth() + 1 };
}

function getMonthNameEs(month: number) {
  const nombres = [
    "enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre"
  ];
  return nombres[(month - 1) % 12];
}

function renderEmailHTML(data: {
  nombreCompleto: string;
  mesNombre: string;
  anio: number;
  valorClase?: number | null;
  clasesReservadas?: number | null;
  clasesACobrar?: number | null;
  cancelacionesAnticipacion?: number | null;
  cancelacionesTardia?: number | null;
  descuentoPorcentaje?: number | null;
  descuentoMonto?: number | null;
  montoTotal: number;
  fechaCobro: string;
  unsubscribeUrl?: string;
}) {
  const {
    nombreCompleto,
    mesNombre,
    anio,
    valorClase,
    clasesReservadas,
    clasesACobrar,
    cancelacionesAnticipacion,
    cancelacionesTardia,
    descuentoPorcentaje,
    descuentoMonto,
    montoTotal,
    fechaCobro,
    unsubscribeUrl
  } = data;

  // HTML basado en email-templates/cobro-mensual.html con variables reemplazadas
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resumen de Cobro Mensual</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa; }
    .container { background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 30px; }
    .greeting { font-size: 18px; margin-bottom: 20px; color: #2c3e50; }
    .summary-box { background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
    .summary-title { font-size: 16px; font-weight: 600; color: #2c3e50; margin-bottom: 15px; }
    .summary-item { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 5px 0; }
    .summary-item:last-child { border-top: 1px solid #dee2e6; margin-top: 10px; padding-top: 15px; font-weight: 600; font-size: 18px; color: #2c3e50; }
    .summary-label { color: #6c757d; }
    .summary-value { color: #2c3e50; font-weight: 500; }
    .total-amount { color: #28a745; font-size: 20px; }
    .payment-info { background-color: #e3f2fd; border: 1px solid #bbdefb; border-radius: 6px; padding: 15px; margin: 20px 0; }
    .payment-title { font-weight: 600; color: #1976d2; margin-bottom: 10px; }
    .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; color: #6c757d; font-size: 14px; }
    .footer a { color: #667eea; text-decoration: none; }
    .month-name { text-transform: capitalize; }
    @media (max-width: 600px) { body { padding: 10px; } .header, .content, .footer { padding: 20px; } .summary-item { flex-direction: column; gap: 5px; } }
  </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Resumen de Cobro Mensual</h1>
      </div>
      <div class="content">
        <div class="greeting">Hola ${nombreCompleto},</div>
        <p>Te informamos sobre el cobro correspondiente al mes de <strong class="month-name">${mesNombre} ${anio}</strong>.</p>
        <div class="summary-box">
          <div class="summary-title">Detalle de tu cuota mensual:</div>
          ${valorClase ? `<div class=\"summary-item\"><span class=\"summary-label\">Valor por clase:</span><span class=\"summary-value\">$${Number(valorClase).toLocaleString('es-AR')}</span></div>` : ``}
          ${clasesReservadas != null && clasesReservadas > 0 ? `<div class=\"summary-item\"><span class=\"summary-label\">Clases previstas:</span><span class=\"summary-value\">${clasesReservadas} clase(s)</span></div>` : ``}
          ${cancelacionesAnticipacion != null && cancelacionesAnticipacion > 0 ? `<div class=\"summary-item\"><span class=\"summary-label\">Cancelaciones anticipadas:</span><span class=\"summary-value\">-${cancelacionesAnticipacion} clase(s)</span></div>` : ``}
          ${cancelacionesTardia != null && cancelacionesTardia > 0 ? `<div class=\"summary-item\"><span class=\"summary-label\">Cancelaciones tardías:</span><span class=\"summary-value\">${cancelacionesTardia} clase(s) (se cobran)</span></div>` : ``}
          ${clasesACobrar != null ? `<div class=\"summary-item\"><span class=\"summary-label\">Clases a cobrar:</span><span class=\"summary-value\">${clasesACobrar} clase(s)</span></div>` : ``}
          ${descuentoPorcentaje ? `<div class=\"summary-item\"><span class=\"summary-label\">Descuento (${descuentoPorcentaje}%):</span><span class=\"summary-value\">-$${Number(descuentoMonto || 0).toLocaleString('es-AR')}</span></div>` : ``}
          <div class="summary-item"><span class="summary-label">Total a abonar:</span><span class="summary-value total-amount">$${Number(montoTotal).toLocaleString('es-AR')}</span></div>
        </div>
        <div class="payment-info">
          <div class="payment-title">💳 Información de Pago</div>
          <p>El cobro se realizará por adelantado el <strong>${fechaCobro}</strong>.</p>
          <p>Si tienes alguna consulta sobre tu cuota, no dudes en contactarnos.</p>
        </div>
        <p>Gracias por confiar en nosotros para tu entrenamiento.</p>
      </div>
      <div class="footer">
        <p>Este es un mensaje automático del sistema de gestión de entrenamientos.</p>
        ${unsubscribeUrl ? `<p>Si no deseas recibir estos emails, puedes <a href="${unsubscribeUrl}">cancelar tu suscripción</a>.</p>` : ``}
      </div>
    </div>
  </body>
  </html>`;
}

function buildSubject(mesNombre: string, anio: number) {
  return `Resumen de cobro - ${mesNombre} ${anio}`;
}

async function fetchCuotasConEmail(supabase: ReturnType<typeof createClient>, anio: number, mes: number) {
  const { data, error } = await supabase
    .from("cuotas_mensuales")
    .select("usuario_id, anio, mes, clases_a_cobrar, clases_previstas, tarifa_unitaria, monto_total, monto_con_descuento, descuento_porcentaje, clases_canceladas_anticipacion, clases_canceladas_tardia")
    .eq("anio", anio)
    .eq("mes", mes);
  if (error) throw error;

  const rows = data || [];
  const enriched = await Promise.all(rows.map(async (row) => {
    // Nombre desde profiles
    const { data: prof } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", row.usuario_id)
      .single();
    // Email desde Admin API
    const { data: userAdmin } = await (supabase as any).auth.admin.getUserById(row.usuario_id);
    const email: string | null = userAdmin?.user?.email ?? null;
    const monto = (row.monto_con_descuento ?? row.monto_total) ?? 0;
    const enrichedRow: CuotaMensual = {
      usuario_id: row.usuario_id,
      anio: row.anio,
      mes: row.mes,
      clases_previstas: row.clases_previstas,
      clases_a_cobrar: row.clases_a_cobrar,
      tarifa_unitaria: row.tarifa_unitaria,
      monto_total: monto,
      monto_con_descuento: row.monto_con_descuento,
      descuento_porcentaje: row.descuento_porcentaje,
      clases_canceladas_anticipacion: row.clases_canceladas_anticipacion,
      clases_canceladas_tardia: row.clases_canceladas_tardia,
      email,
      first_name: prof?.first_name ?? null,
      last_name: prof?.last_name ?? null,
    };
    return enrichedRow;
  }));
  return enriched as CuotaMensual[];
}

// Helper para evitar rate limit de Resend (2 req/seg en plan free)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function sendEmails(cuotas: CuotaMensual[], period: { anio: number; mes: number }) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resendFrom = Deno.env.get("RESEND_FROM") || "Notificaciones <noreply@example.com>";
  if (!resendApiKey) throw new Error("Falta RESEND_API_KEY");
  const resend = new Resend(resendApiKey);

  const mesNombre = getMonthNameEs(period.mes);
  const fechaCobro = `01/${String(period.mes).padStart(2, "0")}/${period.anio}`;

  const results: Array<{ usuario_id: string; status: "success" | "error"; error?: string }> = [];
  for (const row of cuotas) {
    if (!row.email) {
      results.push({ usuario_id: row.usuario_id, status: "error", error: "Email faltante" });
      continue;
    }
    const nombreCompleto = [row.first_name, row.last_name].filter(Boolean).join(" ") || "Alumno";
    const montoBase = Number(row.monto_con_descuento ?? row.monto_total ?? 0);
    const descuentoMonto = row.descuento_porcentaje
      ? Number(((row.tarifa_unitaria || 0) * (row.clases_a_cobrar || row.clases_previstas || 0)) * (row.descuento_porcentaje / 100))
      : 0;

    const html = renderEmailHTML({
      nombreCompleto,
      mesNombre,
      anio: period.anio,
      valorClase: row.tarifa_unitaria,
      clasesReservadas: row.clases_previstas,
      clasesACobrar: row.clases_a_cobrar,
      cancelacionesAnticipacion: row.clases_canceladas_anticipacion,
      cancelacionesTardia: row.clases_canceladas_tardia,
      descuentoPorcentaje: row.descuento_porcentaje || undefined,
      descuentoMonto,
      montoTotal: montoBase,
      fechaCobro,
    });

    try {
      const result = await resend.emails.send({
        from: resendFrom,
        to: [row.email],
        subject: buildSubject(mesNombre, period.anio),
        html,
      });
      if ((result as any)?.error) {
        const errObj: any = (result as any).error;
        const msg = errObj?.message || errObj?.name || JSON.stringify(errObj);
        results.push({ usuario_id: row.usuario_id, status: "error", error: msg });
      } else {
        results.push({ usuario_id: row.usuario_id, status: "success" });
      }
    } catch (err) {
      const msg = (err as any)?.message || JSON.stringify(err);
      results.push({ usuario_id: row.usuario_id, status: "error", error: msg });
    }
    // Delay de 600ms entre envíos para evitar rate limit de Resend (2 req/seg)
    await sleep(600);
  }
  return results;
}

Deno.serve(async (req: Request) => {
  try {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    } as const;
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

    const { anio, mes } = await req.json().catch(() => ({ anio: undefined, mes: undefined }));
    const period = getTargetPeriod({ anio, mes });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Faltan credenciales de Supabase");
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Leer cuotas del período y enriquecer con email/nombre
    let cuotas = await fetchCuotasConEmail(supabase, period.anio, period.mes);

    // Filtrar cuotas sin monto ni email
    cuotas = cuotas.filter(q => (q.monto_con_descuento ?? q.monto_total ?? 0) > 0 && !!q.email);

    const resultados = await sendEmails(cuotas, period);
    const exitosos = resultados.filter(r => r.status === "success").length;
    const errores = resultados.filter(r => r.status === "error");

    return new Response(
      JSON.stringify({ success: true, enviados: exitosos, errores }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    } as const;
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});


