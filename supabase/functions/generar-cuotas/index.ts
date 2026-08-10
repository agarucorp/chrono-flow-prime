// @ts-nocheck
// Edge Function: generar-cuotas
// Delega el cálculo a fn_generar_cuotas_mes (fuente de verdad en Postgres).
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, CRON_SECRET, ALLOWED_ORIGINS

import {
  assertAuthorized,
  corsHeaders,
  createServiceClient,
  getArgentinaNowParts,
  jsonResponse,
} from "../_shared/auth.ts";

function getTargetPeriod(override?: { anio?: number; mes?: number }) {
  if (override?.anio && override?.mes) return { anio: override.anio, mes: override.mes };
  const { year, month, day } = getArgentinaNowParts();
  // Alineado con cobros: día 1–5 mes actual; resto → mes siguiente
  if (day <= 5) return { anio: year, mes: month };
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return { anio: nextYear, mes: nextMonth };
}

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req);
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers });
    if (req.method !== "POST") {
      return jsonResponse({ success: false, error: "Method Not Allowed" }, 405, headers);
    }

    const auth = await assertAuthorized(req);
    if (!auth.ok) {
      return jsonResponse({ success: false, error: auth.error }, auth.status, headers);
    }

    const { anio, mes } = await req.json().catch(() => ({ anio: undefined, mes: undefined }));
    const period = getTargetPeriod({ anio, mes });
    const supabase = createServiceClient();

    const { data: config } = await supabase
      .from("configuracion_admin")
      .select("sistema_activo")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (config?.sistema_activo === false) {
      return jsonResponse({
        success: false,
        error: "Sistema desactivado (master switch)",
      }, 403, headers);
    }

    const { error: genError } = await supabase.rpc("fn_generar_cuotas_mes", {
      p_anio: period.anio,
      p_mes: period.mes,
    });

    if (genError) {
      console.error("fn_generar_cuotas_mes:", genError);
      return jsonResponse({ success: false, error: genError.message }, 500, headers);
    }

    const { count, error: countError } = await supabase
      .from("cuotas_mensuales")
      .select("id", { count: "exact", head: true })
      .eq("anio", period.anio)
      .eq("mes", period.mes);

    if (countError) {
      console.warn("count cuotas:", countError.message);
    }

    return jsonResponse({
      success: true,
      message: `Cuotas generadas para ${period.anio}-${period.mes}`,
      cantidad_cuotas: count ?? null,
      anio: period.anio,
      mes: period.mes,
    }, 200, headers);
  } catch (err) {
    console.error("generar-cuotas:", err);
    return jsonResponse({ success: false, error: "Error interno" }, 500, headers);
  }
});
