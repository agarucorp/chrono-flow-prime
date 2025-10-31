// @ts-nocheck
// Edge Function: enviar-email-bienvenida
// Env requeridas: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@3";

function getMonthNameEs(month: number) {
  const nombres = [
    "enero","febrero","marzo","abril","mayo","junio",
    "julio","agosto","septiembre","octubre","noviembre","diciembre"
  ];
  return nombres[(month - 1) % 12];
}

function renderWelcomeEmailHTML(data: {
  nombreCompleto: string;
  mesNombre: string;
  anio: number;
  valorClase?: number | null;
  clasesReservadas?: number | null;
  descuentoPorcentaje?: number | null;
  descuentoMonto?: number | null;
  montoTotal: number;
  fechaCobro: string;
}) {
  const {
    nombreCompleto,
    mesNombre,
    anio,
    valorClase,
    clasesReservadas,
    descuentoPorcentaje,
    descuentoMonto,
    montoTotal,
    fechaCobro,
  } = data;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido</title>
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
    .month-name { text-transform: capitalize; }
    @media (max-width: 600px) { body { padding: 10px; } .header, .content, .footer { padding: 20px; } .summary-item { flex-direction: column; gap: 5px; } }
  </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>¡Bienvenido! 🎉</h1>
      </div>
      <div class="content">
        <div class="greeting">Hola ${nombreCompleto},</div>
        <p>Te damos la bienvenida y te confirmamos tu registro en nuestro sistema.</p>
        <p>A continuación, te detallamos la cuota correspondiente al mes actual de <strong class="month-name">${mesNombre} ${anio}</strong>.</p>
        <div class="summary-box">
          <div class="summary-title">Detalle de tu primera cuota mensual:</div>
          ${valorClase ? `<div class=\"summary-item\"><span class=\"summary-label\">Valor por clase:</span><span class=\"summary-value\">$${Number(valorClase).toLocaleString('es-AR')}</span></div>` : ``}
          ${clasesReservadas != null ? `<div class=\"summary-item\"><span class=\"summary-label\">Clases programadas:</span><span class=\"summary-value\">${clasesReservadas} clase(s)</span></div>` : ``}
          ${descuentoPorcentaje ? `<div class=\"summary-item\"><span class=\"summary-label\">Descuento (${descuentoPorcentaje}%):</span><span class=\"summary-value\">-$${Number(descuentoMonto || 0).toLocaleString('es-AR')}</span></div>` : ``}
          <div class="summary-item"><span class="summary-label">Total a abonar:</span><span class="summary-value total-amount">$${Number(montoTotal).toLocaleString('es-AR')}</span></div>
        </div>
        <div class="payment-info">
          <div class="payment-title">💳 Información Importante</div>
          <p>El cobro se realizará el <strong>${fechaCobro}</strong>.</p>
          <p>A partir del día 25 de cada mes, recibirás un email con el detalle de la cuota del mes siguiente.</p>
        </div>
        <p>¡Gracias por confiar en nosotros para tu entrenamiento!</p>
      </div>
      <div class="footer">
        <p>Este es un mensaje automático del sistema de gestión de entrenamientos.</p>
      </div>
    </div>
  </body>
</html>`;
}

function buildSubject(mesNombre: string, anio: number) {
  return `Bienvenido - Tu primera cuota: ${mesNombre} ${anio}`;
}

async function fetchCuotaConEmail(supabase: ReturnType<typeof createClient>, usuarioId: string, anio: number, mes: number) {
  // Obtener cuota del usuario
  const { data: cuota, error: cuotaError } = await supabase
    .from("cuotas_mensuales")
    .select("usuario_id, anio, mes, clases_previstas, tarifa_unitaria, monto_total, monto_con_descuento, descuento_porcentaje")
    .eq("usuario_id", usuarioId)
    .eq("anio", anio)
    .eq("mes", mes)
    .single();

  if (cuotaError || !cuota) {
    throw new Error(`No se encontró cuota para el usuario: ${cuotaError?.message || 'Cuota no encontrada'}`);
  }

  // Obtener datos del usuario
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", usuarioId)
    .single();

  const { data: userAdmin } = await (supabase as any).auth.admin.getUserById(usuarioId);
  const email: string | null = userAdmin?.user?.email ?? null;

  const monto = (cuota.monto_con_descuento ?? cuota.monto_total) ?? 0;
  const descuentoMonto = cuota.descuento_porcentaje
    ? Number((cuota.tarifa_unitaria || 0) * (cuota.clases_previstas || 0)) * (cuota.descuento_porcentaje / 100)
    : 0;

  return {
    ...cuota,
    email,
    first_name: profile?.first_name ?? null,
    last_name: profile?.last_name ?? null,
    descuentoMonto,
    monto
  };
}

async function sendWelcomeEmail(cuota: any, period: { anio: number; mes: number }) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const resendFrom = Deno.env.get("RESEND_FROM") || "Notificaciones <noreply@example.com>";
  if (!resendApiKey) throw new Error("Falta RESEND_API_KEY");
  const resend = new Resend(resendApiKey);

  const mesNombre = getMonthNameEs(period.mes);
  const fechaCobro = `01/${String(period.mes).padStart(2, "0")}/${period.anio}`;

  if (!cuota.email) {
    throw new Error("Email faltante");
  }

  const nombreCompleto = [cuota.first_name, cuota.last_name].filter(Boolean).join(" ") || "Alumno";

  const html = renderWelcomeEmailHTML({
    nombreCompleto,
    mesNombre,
    anio: period.anio,
    valorClase: cuota.tarifa_unitaria,
    clasesReservadas: cuota.clases_previstas,
    descuentoPorcentaje: cuota.descuento_porcentaje || undefined,
    descuentoMonto: cuota.descuentoMonto,
    montoTotal: cuota.monto,
    fechaCobro,
  });

  const result = await resend.emails.send({
    from: resendFrom,
    to: [cuota.email],
    subject: buildSubject(mesNombre, period.anio),
    html,
  });

  if ((result as any)?.error) {
    const errObj: any = (result as any).error;
    const msg = errObj?.message || errObj?.name || JSON.stringify(errObj);
    throw new Error(msg);
  }

  return { success: true };
}

Deno.serve(async (req: Request) => {
  try {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    } as const;
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

    const { usuario_id, anio, mes } = await req.json();

    if (!usuario_id || !anio || !mes) {
      return new Response(JSON.stringify({ success: false, error: "Faltan parámetros requeridos" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Faltan credenciales de Supabase");
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Obtener cuota y datos del usuario
    const cuota = await fetchCuotaConEmail(supabase, usuario_id, anio, mes);

    // Enviar email
    await sendWelcomeEmail(cuota, { anio, mes });

    return new Response(
      JSON.stringify({ success: true, message: "Email de bienvenida enviado" }),
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

