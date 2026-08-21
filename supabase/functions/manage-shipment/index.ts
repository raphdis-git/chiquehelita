import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const API_URL = "https://sandbox.melhorenvio.com.br";
const CLIENT_ID = "11261";
const ALLOWED_ORIGINS = new Set(["https://raphdis-git.github.io", "http://localhost:5173"]);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function requiredEnv(name: string) { const value = Deno.env.get(name)?.trim(); if (!value) throw new Error(`Configuração ausente: ${name}`); return value; }
function serviceKey() { const modern = Deno.env.get("SUPABASE_SECRET_KEYS"); if (modern) { const keys = JSON.parse(modern); if (keys.default) return keys.default; } return requiredEnv("SUPABASE_SERVICE_ROLE_KEY"); }
function cors(req: Request) { const origin = req.headers.get("origin") ?? ""; return { "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://raphdis-git.github.io", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" }; }
function reply(req: Request, body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } }); }
function digits(value: unknown) { return String(value ?? "").replace(/\D/g, ""); }
function brazilianPhone(value: unknown) { const normalized = digits(value); return normalized.startsWith("55") && normalized.length >= 12 ? normalized.slice(2) : normalized; }
function fromBase64(value: string) { const binary = atob(value); return Uint8Array.from(binary, (character) => character.charCodeAt(0)); }
function toBase64(value: Uint8Array) { let binary = ""; for (const byte of value) binary += String.fromCharCode(byte); return btoa(binary); }
async function encryptionKey(secret: string) { const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret)); return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]); }
async function decrypt(ciphertext: string, iv: string, secret: string) { const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, await encryptionKey(secret), fromBase64(ciphertext)); return decoder.decode(plain); }
async function encrypt(value: string, secret: string) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(secret), encoder.encode(value)); return { ciphertext: toBase64(new Uint8Array(ciphertext)), iv: toBase64(iv) }; }

async function authenticatedAdmin(req: Request, client: ReturnType<typeof createClient>) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: admin } = await client.from("admin_users").select("user_id").eq("user_id", data.user.id).eq("active", true).maybeSingle();
  return admin ? data.user : null;
}

async function accessToken(client: ReturnType<typeof createClient>) {
  const secret = requiredEnv("MELHOR_ENVIO_CLIENT_SECRET");
  const { data: integration, error } = await client.from("shipping_integrations").select("*").eq("provider", "melhor_envio").maybeSingle();
  if (error || !integration) throw new Error("A conta do Melhor Envio não está conectada.");
  const current = await decrypt(integration.access_token_ciphertext, integration.access_token_iv, secret);
  if (new Date(integration.expires_at).getTime() > Date.now() + 5 * 60 * 1000) return current;
  const refreshToken = await decrypt(integration.refresh_token_ciphertext, integration.refresh_token_iv, secret);
  const response = await fetch(`${API_URL}/oauth/token`, { method: "POST", headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded", "User-Agent": requiredEnv("MELHOR_ENVIO_USER_AGENT") }, body: new URLSearchParams({ grant_type: "refresh_token", client_id: CLIENT_ID, client_secret: secret, refresh_token: refreshToken }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token || !data.refresh_token) throw new Error("A autorização do Melhor Envio precisa ser refeita.");
  const access = await encrypt(String(data.access_token), secret); const refresh = await encrypt(String(data.refresh_token), secret);
  const expiresAt = new Date(Date.now() + Math.max(60, Number(data.expires_in) || 2592000) * 1000).toISOString();
  const { error: updateError } = await client.from("shipping_integrations").update({ token_type: String(data.token_type || "Bearer"), access_token_ciphertext: access.ciphertext, access_token_iv: access.iv, refresh_token_ciphertext: refresh.ciphertext, refresh_token_iv: refresh.iv, scope: data.scope ? String(data.scope) : integration.scope, expires_at: expiresAt, updated_at: new Date().toISOString() }).eq("provider", "melhor_envio");
  if (updateError) throw new Error("Não foi possível renovar a autorização do Melhor Envio.");
  return String(data.access_token);
}

async function melhorEnvio(path: string, token: string, body?: unknown, method = "POST") {
  const response = await fetch(`${API_URL}${path}`, { method, headers: { "Accept": "application/json", "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "User-Agent": requiredEnv("MELHOR_ENVIO_USER_AGENT") }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const messages: string[] = [];
    const collect = (value: unknown) => {
      if (typeof value === "string") messages.push(value);
      else if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === "object") Object.values(value).forEach(collect);
    };
    collect(data?.errors);
    const rawDetail = data?.message || data?.error || messages.join(" ");
    const operation = path.endsWith("/cart") ? "adicionar a etiqueta ao carrinho" : "concluir esta etapa da etiqueta";
    const detail = /unauthorized|not authorized|não autorizad/i.test(String(rawDetail))
      ? `A conexão atual não possui permissão para ${operation}. Reconecte o Melhor Envio após a atualização das permissões.`
      : rawDetail;
    throw new Error(detail ? `Melhor Envio: ${String(detail).slice(0, 240)}` : "O Melhor Envio recusou esta operação.");
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return reply(req, { error: "Método não permitido." }, 405);
  try {
    const client = createClient(requiredEnv("SUPABASE_URL"), serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    if (!await authenticatedAdmin(req, client)) return reply(req, { error: "Acesso administrativo necessário." }, 403);
    const { action, orderId } = await req.json().catch(() => ({ action: "", orderId: "" }));
    if (!["prepare", "purchase", "sync"].includes(action) || !orderId) return reply(req, { error: "Ação ou pedido inválido." }, 400);

    const { data: order, error: orderError } = await client.from("orders").select("*,order_items(*)").eq("id", orderId).maybeSingle();
    if (orderError || !order) throw new Error("Pedido não encontrado.");
    if (order.fulfillment !== "delivery" || order.shipping_provider !== "melhor_envio") throw new Error("Este pedido não utiliza entrega pelo Melhor Envio.");
    const token = await accessToken(client);

    if (action === "sync") {
      if (!order.shipping_external_id) throw new Error("Este pedido ainda não possui etiqueta no Melhor Envio.");
      const response = await melhorEnvio(`/api/v2/me/orders/${encodeURIComponent(order.shipping_external_id)}`, token, undefined, "GET");
      const shipment = response?.data ?? response;
      const providerStatus = String(shipment?.status ?? "").toLowerCase();
      const trackingStatuses: Record<string, string> = { pending: "awaiting_shipment", released: "awaiting_shipment", generated: "awaiting_shipment", received: "in_transit", posted: "posted", delivered: "delivered", cancelled: "exception", undelivered: "exception", paused: "exception", suspended: "exception" };
      const selfTracking = String(shipment?.self_tracking ?? "").trim();
      const carrierTracking = String(shipment?.tracking ?? "").trim();
      const rawTrackingUrl = String(shipment?.tracking_url ?? "").replace("https: //", "https://").trim();
      const trackingUrl = rawTrackingUrl || (selfTracking ? `https://www.melhorrastreio.com.br/rastreio/${encodeURIComponent(selfTracking)}` : "");
      const now = new Date().toISOString();
      const changes: Record<string, unknown> = { shipping_label_status: providerStatus || order.shipping_label_status, shipping_protocol: shipment?.protocol ? String(shipment.protocol) : order.shipping_protocol, tracking_status: trackingStatuses[providerStatus] ?? order.tracking_status, tracking_code: carrierTracking || selfTracking || order.tracking_code, tracking_url: trackingUrl || order.tracking_url, shipping_last_event_at: now, tracking_updated_at: now, updated_at: now };
      if (providerStatus === "posted") { changes.shipped_at = shipment?.posted_at || order.shipped_at || now; if (order.inventory_committed_at && !order.inventory_released_at) changes.status = "shipped"; }
      if (providerStatus === "delivered") { changes.delivered_at = shipment?.delivered_at || order.delivered_at || now; if (order.inventory_committed_at && !order.inventory_released_at) changes.status = "completed"; }
      const { data: updated, error } = await client.from("orders").update(changes).eq("id", order.id).select("*").single();
      if (error) throw new Error("O status foi consultado, mas não foi possível atualizar o pedido.");
      return reply(req, { order: updated, providerStatus });
    }

    if (order.status === "cancelled") throw new Error("Não é possível gerar etiqueta para um pedido cancelado.");
    if (!order.inventory_committed_at) throw new Error("Confirme o pedido antes de preparar o envio, para reservar o estoque.");

    if (action === "purchase") {
      if (!order.shipping_external_id) throw new Error("Primeiro adicione o envio ao carrinho.");
      if (order.shipping_generated_at && order.shipping_label_url) return reply(req, { order });
      if (!order.shipping_purchased_at) await melhorEnvio("/api/v2/me/shipment/checkout", token, { orders: [order.shipping_external_id] });
      await melhorEnvio("/api/v2/me/shipment/generate", token, { orders: [order.shipping_external_id] });
      const printed = await melhorEnvio("/api/v2/me/shipment/print", token, { mode: "public", orders: [order.shipping_external_id] });
      const labelUrl = String(printed?.url ?? printed ?? "");
      if (!/^https:\/\//i.test(labelUrl)) throw new Error("A etiqueta foi gerada, mas o link de impressão não foi retornado.");
      const now = new Date().toISOString();
      const { data: updated, error } = await client.from("orders").update({ shipping_label_url: labelUrl, shipping_label_status: "generated", shipping_purchased_at: order.shipping_purchased_at ?? now, shipping_generated_at: now, shipping_last_event_at: now, updated_at: now }).eq("id", order.id).select("*").single();
      if (error) throw new Error("A etiqueta foi gerada, mas não foi possível atualizar o pedido.");
      return reply(req, { order: updated, labelUrl });
    }

    if (order.shipping_external_id) return reply(req, { order, alreadyPrepared: true });
    const { data: settings, error: settingsError } = await client.from("store_settings").select("*").limit(1).single();
    if (settingsError || !settings?.melhor_envio_enabled) throw new Error("Ative o Melhor Envio nas configurações.");
    const requiredSender = [settings.sender_name, settings.sender_email, settings.sender_phone, settings.sender_tax_id, settings.sender_address, settings.sender_address_number, settings.sender_district, settings.sender_city, settings.sender_state, settings.origin_postal_code];
    if (requiredSender.some((value) => !String(value ?? "").trim())) throw new Error("Complete os dados do remetente nas Configurações da loja.");
    const productIds = [...new Set(order.order_items.map((item: any) => item.product_id).filter(Boolean))];
    const { data: products, error: productsError } = await client.from("products").select("id,name,shipping_weight_grams,shipping_height_cm,shipping_width_cm,shipping_length_cm").in("id", productIds);
    if (productsError) throw productsError;
    const totalQuantity = order.order_items.reduce((sum: number, item: any) => sum + Number(item.quantity), 0);
    const tare = Number(settings.packaging_tare_grams || 0) / Math.max(1, totalQuantity);
    const quoteProducts = order.order_items.map((item: any) => {
      const product = products?.find((entry: any) => entry.id === item.product_id);
      if (!product) throw new Error(`Produto ${item.product_name} não foi encontrado.`);
      return { id: String(item.id), width: Number(product.shipping_width_cm || settings.package_width_cm), height: Number(product.shipping_height_cm || settings.package_height_cm), length: Number(product.shipping_length_cm || settings.package_length_cm), weight: Number(((Number(product.shipping_weight_grams || settings.package_weight_grams) + tare) / 1000).toFixed(3)), insurance_value: Number(item.unit_price), quantity: Number(item.quantity) };
    });
    const quote = await melhorEnvio("/api/v2/me/shipment/calculate", token, { from: { postal_code: digits(settings.origin_postal_code) }, to: { postal_code: digits(order.postal_code) }, products: quoteProducts, options: { receipt: false, own_hand: false } });
    const service = Array.isArray(quote) ? quote.find((entry: any) => String(entry.id) === String(order.shipping_service_id) && !entry.error) : null;
    if (!service) throw new Error("A modalidade escolhida não está mais disponível. Faça um novo pedido ou recalcule o frete.");
    const volumes = (Array.isArray(service.packages) && service.packages.length ? service.packages : [{ dimensions: { height: Math.max(...quoteProducts.map((p: any) => p.height)), width: Math.max(...quoteProducts.map((p: any) => p.width)), length: Math.max(...quoteProducts.map((p: any) => p.length)) }, weight: quoteProducts.reduce((sum: number, p: any) => sum + p.weight * p.quantity, 0) }]).map((pack: any) => ({ height: Number(pack.dimensions?.height), width: Number(pack.dimensions?.width), length: Number(pack.dimensions?.length), weight: Number(pack.weight) }));
    const senderTax = digits(settings.sender_tax_id); const recipientTax = digits(order.customer_tax_id);
    const from: Record<string, unknown> = { name: settings.sender_name, email: settings.sender_email, phone: brazilianPhone(settings.sender_phone), address: settings.sender_address, complement: settings.sender_address_complement || "", number: settings.sender_address_number, district: settings.sender_district, city: settings.sender_city, postal_code: digits(settings.origin_postal_code), state_abbr: String(settings.sender_state).toUpperCase(), state_register: settings.sender_state_register || "ISENTO" };
    from[senderTax.length === 14 ? "company_document" : "document"] = senderTax;
    const to: Record<string, unknown> = { name: order.customer_name, phone: brazilianPhone(order.customer_phone), address: order.address, complement: "", number: order.address_number, district: order.district, city: order.city, postal_code: digits(order.postal_code), state_abbr: String(order.state).toUpperCase(), country_id: "BR" };
    if (order.customer_email) to.email = order.customer_email;
    to[recipientTax.length === 14 ? "company_document" : "document"] = recipientTax;
    const cart = await melhorEnvio("/api/v2/me/cart", token, { service: Number(order.shipping_service_id), from, to, products: order.order_items.map((item: any) => ({ name: item.product_name, quantity: Number(item.quantity), unitary_value: Number(item.unit_price) })), volumes, options: { platform: "CHIQUEHELITA", insurance_value: Number(order.products_amount), receipt: false, own_hand: false, reverse: false, reminder: `Pedido #${order.order_number}`, tags: [{ tag: `Pedido #${order.order_number}`, url: null }] } });
    if (!cart?.id) throw new Error("O Melhor Envio não retornou o ID da etiqueta.");
    const now = new Date().toISOString();
    const { data: updated, error } = await client.from("orders").update({ shipping_external_id: String(cart.id), shipping_protocol: cart.protocol ? String(cart.protocol) : null, shipping_label_status: String(cart.status ?? "pending"), shipping_cart_created_at: now, shipping_last_event_at: now, updated_at: now }).eq("id", order.id).is("shipping_external_id", null).select("*").single();
    if (error) throw new Error("O envio foi criado, mas não foi possível vinculá-lo ao pedido.");
    return reply(req, { order: updated });
  } catch (error) {
    console.error("manage-shipment", error instanceof Error ? error.message : error);
    return reply(req, { error: error instanceof Error ? error.message : "Não foi possível processar o envio." }, 400);
  }
});

