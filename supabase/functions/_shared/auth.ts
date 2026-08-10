import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowOrigin =
    ALLOWED_ORIGINS.length === 0
      ? "*" // fallback solo si no se configuró ALLOWED_ORIGINS
      : ALLOWED_ORIGINS.includes(origin)
        ? origin
        : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** CRON_SECRET (header x-cron-secret o Bearer) o JWT de usuario con role admin. */
export async function assertAuthorized(
  req: Request,
): Promise<{ ok: true; mode: "cron" | "admin"; userId?: string } | { ok: false; status: number; error: string }> {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const headerSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("Authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (cronSecret && (headerSecret === cronSecret || bearer === cronSecret)) {
    return { ok: true, mode: "cron" };
  }

  if (!bearer) {
    return { ok: false, status: 401, error: "No autorizado" };
  }

  // Si el bearer es el cron secret ya se manejó arriba; si no hay CRON_SECRET configurado, no aceptar anon/service como "auth"
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, status: 500, error: "Configuración incompleta" };
  }

  // Validar JWT del usuario con el cliente anon (respeta auth)
  const userClient = createClient(supabaseUrl, anonKey || serviceKey, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(bearer);
  if (userError || !userData?.user) {
    return { ok: false, status: 401, error: "Token inválido" };
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return { ok: false, status: 403, error: "Se requiere rol administrador" };
  }

  return { ok: true, mode: "admin", userId: userData.user.id };
}

/** Bienvenida: el caller debe ser el mismo usuario_id (JWT) o admin/cron. */
export async function assertSelfOrAdmin(
  req: Request,
  usuarioId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const headerSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("Authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (cronSecret && (headerSecret === cronSecret || bearer === cronSecret)) {
    return { ok: true };
  }

  if (!bearer) {
    return { ok: false, status: 401, error: "No autorizado" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, status: 500, error: "Configuración incompleta" };
  }

  const userClient = createClient(supabaseUrl, anonKey || serviceKey, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(bearer);
  if (userError || !userData?.user) {
    return { ok: false, status: 401, error: "Token inválido" };
  }

  if (userData.user.id === usuarioId) {
    return { ok: true };
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profile?.role === "admin") {
    return { ok: true };
  }

  return { ok: false, status: 403, error: "No autorizado para este usuario" };
}

export function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Faltan credenciales de Supabase");
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
}

/** Fecha/hora en America/Argentina/Buenos_Aires para períodos de cobro. */
export function getArgentinaNowParts(): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return { year, month, day };
}
