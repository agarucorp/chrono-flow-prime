// @ts-nocheck
// Edge Function: avisos-admin
// La llama la base (pg_net) cada vez que encola un aviso en push_pendientes.
// Manda los avisos pendientes a los celulares de los admins.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Las claves VAPID salen de vault.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: vapid, error: vapidError } = await supabase.rpc("fn_push_vapid");
  if (vapidError || !vapid?.publica || !vapid?.privada) {
    console.error("Claves VAPID", vapidError);
    return json({ error: "Faltan las claves VAPID" }, 500);
  }
  webpush.setVapidDetails(vapid.contacto, vapid.publica, vapid.privada);

  const { data: pendientes, error } = await supabase.rpc("fn_push_tomar_pendientes");
  if (error) return json({ error: error.message }, 500);
  if (!pendientes?.length) return json({ enviados: 0 });

  const { data: destinos, error: destinosError } = await supabase.rpc("fn_push_destinos");
  if (destinosError) return json({ error: destinosError.message }, 500);

  let enviados = 0;
  const vencidas = new Set<string>();

  for (const aviso of pendientes) {
    const payload = JSON.stringify({
      title: aviso.titulo,
      body: aviso.cuerpo,
      url: aviso.url,
      tag: `aviso-${aviso.id}`,
    });

    await Promise.all((destinos || []).map(async (destino) => {
      if (vencidas.has(destino.id)) return;
      try {
        await webpush.sendNotification(
          { endpoint: destino.endpoint, keys: { p256dh: destino.p256dh, auth: destino.auth } },
          payload,
          { TTL: 60 * 60 * 24, urgency: "high" },
        );
        enviados++;
      } catch (err) {
        // 404/410: el celular desactivó los avisos o borró la app.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          vencidas.add(destino.id);
        } else {
          console.error("Aviso push", destino.id, err?.statusCode, err?.body || err?.message);
        }
      }
    }));
  }

  if (vencidas.size > 0) {
    await supabase.from("push_suscripciones").delete().in("id", [...vencidas]);
  }

  return json({ enviados, vencidas: vencidas.size });
});
