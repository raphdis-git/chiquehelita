import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const encoder = new TextEncoder();
function requiredEnv(name: string) { const value = Deno.env.get(name)?.trim(); if (!value) throw new Error(`Configuração ausente: ${name}`); return value; }
function serviceKey() { const modern = Deno.env.get("SUPABASE_SECRET_KEYS"); if (modern) { const keys = JSON.parse(modern); if (keys.default) return keys.default; } return requiredEnv("SUPABASE_SERVICE_ROLE_KEY"); }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }
function toBase64(value: ArrayBuffer) { let binary = ""; for (const byte of new Uint8Array(value)) binary += String.fromCharCode(byte); return btoa(binary); }
async function hmac(body: string, secret: string) { const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return toBase64(await crypto.subtle.sign("HMAC", key, encoder.encode(body))); }
function sameSignature(left: string, right: string) { const a = encoder.encode(left.trim()), b = encoder.encode(right.trim()); if (a.length !== b.length) return false; let difference = 0; for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index]; return difference === 0; }
async function sha256(value: string) { const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))); return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }

const TRACKING_STATUS: Record<string, string> = {
  "order.created": "awaiting_shipment", "order.pending": "awaiting_shipment", "order.released": "awaiting_shipment",
  "order.generated": "awaiting_shipment", "order.received": "in_transit", "order.posted": "posted",
  "order.delivered": "delivered", "order.cancelled": "exception", "order.undelivered": "exception",
  "order.paused": "exception", "order.suspended": "exception",
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const rawBody = await req.text();
  const expectedSignature = await hmac(rawBody, requiredEnv("MELHOR_ENVIO_CLIENT_SECRET"));
  if (!sameSignature(req.headers.get("x-me-signature") ?? "", expectedSignature)) return json({ error: "Assinatura inválida." }, 401);

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return json({ error: "JSON inválido." }, 400); }
  const eventName = String(payload?.event ?? ""), externalId = String(payload?.data?.id ?? "");
  // O cadastro do webhook envia um POST de validação assinado, mas sem os
  // campos de uma etiqueta. A assinatura já prova a origem da requisição.
  if (!eventName.startsWith("order.") || !externalId) return json({ received: true, validation: true });

  const client = createClient(requiredEnv("SUPABASE_URL"), serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  const eventKey = await sha256(rawBody);
  const { data: event, error: eventError } = await client.from("shipping_webhook_events").insert({ provider: "melhor_envio", event_key: eventKey, event_name: eventName, external_id: externalId, payload }).select("id").single();
  if (eventError?.code === "23505") return json({ received: true, duplicate: true });
  if (eventError || !event) return json({ error: "Não foi possível registrar o evento." }, 500);

  const trackingStatus = TRACKING_STATUS[eventName];
  if (!trackingStatus) { await client.from("shipping_webhook_events").update({ processing_status: "ignored", processed_at: new Date().toISOString() }).eq("id", event.id); return json({ received: true, ignored: true }); }

  const { data: order, error: orderError } = await client.from("orders").select("id,status,inventory_committed_at,inventory_released_at").eq("shipping_external_id", externalId).maybeSingle();
  if (orderError) { await client.from("shipping_webhook_events").update({ processing_status: "error", error_message: orderError.message, processed_at: new Date().toISOString() }).eq("id", event.id); return json({ error: "Erro ao localizar o pedido." }, 500); }
  if (!order) { await client.from("shipping_webhook_events").update({ processing_status: "unmatched", processed_at: new Date().toISOString() }).eq("id", event.id); return json({ received: true, matched: false }); }

  const data = payload.data ?? {}, now = new Date().toISOString();
  const inventoryCommitted = order.inventory_committed_at && !order.inventory_released_at;
  const selfTracking = data.self_tracking ? String(data.self_tracking).trim() : "";
  const carrierTracking = data.tracking ? String(data.tracking).trim() : "";
  const trackingUrl = data.tracking_url
    ? String(data.tracking_url).replace("https: //", "https://")
    : selfTracking ? `https://www.melhorrastreio.com.br/rastreio/${encodeURIComponent(selfTracking)}` : undefined;
  const changes: Record<string, unknown> = {
    tracking_status: trackingStatus, tracking_code: carrierTracking || selfTracking || undefined,
    tracking_url: trackingUrl,
    shipping_protocol: data.protocol ? String(data.protocol) : undefined, shipping_label_status: data.status ? String(data.status) : eventName.replace("order.", ""),
    shipping_last_event_at: now, tracking_updated_at: now, updated_at: now,
  };
  if (eventName === "order.posted") { changes.shipped_at = data.posted_at || now; if (inventoryCommitted) changes.status = "shipped"; }
  if (eventName === "order.delivered") { changes.delivered_at = data.delivered_at || now; if (inventoryCommitted) changes.status = "completed"; }
  Object.keys(changes).forEach((key) => changes[key] === undefined && delete changes[key]);
  const { error: updateError } = await client.from("orders").update(changes).eq("id", order.id);
  await client.from("shipping_webhook_events").update({ order_id: order.id, processing_status: updateError ? "error" : "processed", error_message: updateError?.message ?? null, processed_at: now }).eq("id", event.id);
  if (updateError) return json({ error: "Não foi possível atualizar o pedido." }, 500);
  return json({ received: true, matched: true });
});

