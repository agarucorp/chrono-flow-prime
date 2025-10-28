// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getTargetPeriod(override?: { anio?: number; mes?: number }) {
  const now = new Date();
  if (override?.anio && override?.mes) return { anio: override.anio, mes: override.mes };
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { anio: nextMonth.getFullYear(), mes: nextMonth.getMonth() + 1 };
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

    // Generar cuotas usando SQL directo (evitando función RPC problemática)
    const { data: usuarios, error: errorUsuarios } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "client");

    if (errorUsuarios) {
      throw new Error(`Error obteniendo usuarios: ${errorUsuarios.message}`);
    }

    if (!usuarios || usuarios.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: `No hay usuarios para generar cuotas en ${period.anio}-${period.mes}`,
        cantidad_cuotas: 0
      }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Obtener tarifa por defecto
    const { data: config, error: errorConfig } = await supabase
      .from("configuracion_admin")
      .select("precio_clase, tarifa_horaria")
      .limit(1)
      .single();

    const tarifaDefault = config?.precio_clase || config?.tarifa_horaria || 10000;

    // Generar cuotas para cada usuario
    let cuotasGeneradas = 0;
    for (const usuario of usuarios) {
      const { error: errorCuota } = await supabase
        .from("cuotas_mensuales")
        .upsert({
          usuario_id: usuario.id,
          anio: period.anio,
          mes: period.mes,
          clases_previstas: 20, // Valor por defecto, se puede ajustar
          tarifa_unitaria: tarifaDefault,
          monto_total: 20 * tarifaDefault,
          estado_pago: "pendiente",
          generado_el: new Date().toISOString()
        }, {
          onConflict: "usuario_id,anio,mes"
        });

      if (!errorCuota) {
        cuotasGeneradas++;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Cuotas generadas para ${period.anio}-${period.mes}`,
      cantidad_cuotas: cuotasGeneradas,
      usuarios_procesados: usuarios.length
    }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (err) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    } as const;
    const errorMsg = (err as any)?.message || JSON.stringify(err);
    console.log("Error general:", errorMsg);
    return new Response(JSON.stringify({ success: false, error: errorMsg }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});


