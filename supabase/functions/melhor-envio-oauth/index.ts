import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const ADMIN_URL = "https://raphdis-git.github.io/chiquehelita/admin/";
const MELHOR_ENVIO_API_URL = "https://sandbox.melhorenvio.com.br";
const MELHOR_ENVIO_CLIENT_ID = "11261";
const MELHOR_ENVIO_REDIRECT_URI = "https://zkwwfjinhbrjhebeasac.supabase.co/functions/v1/melhor-envio-oauth";
const ALLOWED_ORIGINS = new Set(["https://raphdis-git.github.io", "http://localhost:5173"]);
const encoder = new TextEncoder();

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Configuração ausente: ${name}`);
  return value;
}

function serviceKey() {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) {
    const keys = JSON.parse(modern);
    if (keys.default) return keys.default;
  }
  return requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : ADMIN_URL.replace(/\/admin\/$/, ""),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}

function redirect(status: "connected" | "error", reason = "") {
  const url = new URL(ADMIN_URL);
  url.searchParams.set("melhor_envio", status);
  if (reason) url.searchParams.set("reason", reason.slice(0, 80));
  return Response.redirect(url.toString(), 302);
}

function base64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt"]);
}

async function encrypt(value: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(secret), encoder.encode(value));
  return { ciphertext: base64(new Uint8Array(ciphertext)), iv: base64(iv) };
}

async function authenticatedAdmin(req: Request, client: ReturnType<typeof createClient>) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data: userResult, error: userError } = await client.auth.getUser(token);
  if (userError || !userResult.user) return null;
  const { data: admin } = await client.from("admin_users").select("user_id").eq("user_id", userResult.user.id).eq("active", true).maybeSingle();
  return admin ? userResult.user : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const clientId = MELHOR_ENVIO_CLIENT_ID;
    const clientSecret = requiredEnv("MELHOR_ENVIO_CLIENT_SECRET");
    const redirectUri = MELHOR_ENVIO_REDIRECT_URI;
    const apiUrl = MELHOR_ENVIO_API_URL;
    const userAgent = requiredEnv("MELHOR_ENVIO_USER_AGENT");
    const client = createClient(supabaseUrl, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } });

    const url = new URL(req.url);
    if (req.method === "GET" && (url.searchParams.has("code") || url.searchParams.has("error"))) {
      if (url.searchParams.has("error")) return redirect("error", "Autorização recusada");
      const code = url.searchParams.get("code") ?? "";
      const state = url.searchParams.get("state") ?? "";
      if (!code || !state) return redirect("error", "Retorno de autorização inválido");

      const stateHash = await sha256(state);
      const now = new Date().toISOString();
      const { data: storedState, error: stateError } = await client.from("shipping_oauth_states")
        .update({ used_at: now }).eq("state_hash", stateHash).eq("provider", "melhor_envio")
        .is("used_at", null).gt("expires_at", now).select("state_hash").maybeSingle();
      if (stateError || !storedState) return redirect("error", "Autorização expirada ou já utilizada");

      const tokenResponse = await fetch(`${apiUrl}/oauth/token`, {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded", "User-Agent": userAgent },
        body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code }),
      });
      const tokenData = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !tokenData.access_token || !tokenData.refresh_token) return redirect("error", "Credenciais ou callback não aceitos");

      const access = await encrypt(String(tokenData.access_token), clientSecret);
      const refresh = await encrypt(String(tokenData.refresh_token), clientSecret);
      const expiresIn = Math.max(60, Number(tokenData.expires_in) || 2592000);
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      const { error: saveError } = await client.from("shipping_integrations").upsert({
        provider: "melhor_envio", token_type: String(tokenData.token_type || "Bearer"),
        access_token_ciphertext: access.ciphertext, access_token_iv: access.iv,
        refresh_token_ciphertext: refresh.ciphertext, refresh_token_iv: refresh.iv,
        scope: tokenData.scope ? String(tokenData.scope) : null, expires_at: expiresAt,
        connected_at: now, updated_at: now,
      }, { onConflict: "provider" });
      if (saveError) return redirect("error", "Não foi possível guardar a autorização");
      await client.from("shipping_oauth_states").delete().lt("expires_at", now);
      return redirect("connected");
    }

    if (req.method !== "POST") return json(req, { error: "Método não permitido." }, 405);
    const user = await authenticatedAdmin(req, client);
    if (!user) return json(req, { error: "Acesso administrativo necessário." }, 403);
    const { action } = await req.json().catch(() => ({ action: "" }));

    if (action === "status") {
      const { data } = await client.from("shipping_integrations").select("expires_at,connected_at").eq("provider", "melhor_envio").maybeSingle();
      return json(req, { connected: Boolean(data), expiresAt: data?.expires_at ?? null, connectedAt: data?.connected_at ?? null });
    }

    if (action === "disconnect") {
      const { error } = await client.from("shipping_integrations").delete().eq("provider", "melhor_envio");
      if (error) return json(req, { error: "Não foi possível desconectar." }, 500);
      return json(req, { connected: false });
    }

    if (action !== "start") return json(req, { error: "Ação inválida." }, 400);
    const state = `${crypto.randomUUID()}-${base64(crypto.getRandomValues(new Uint8Array(24)))}`;
    const stateHash = await sha256(state);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error: stateError } = await client.from("shipping_oauth_states").insert({ state_hash: stateHash, provider: "melhor_envio", user_id: user.id, expires_at: expiresAt });
    if (stateError) return json(req, { error: "Não foi possível iniciar a autorização." }, 500);
    const authorizationUrl = new URL(`${apiUrl}/oauth/authorize`);
    authorizationUrl.searchParams.set("client_id", clientId);
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("scope", "shipping-calculate ecommerce-shipping");
    return json(req, { authorizationUrl: authorizationUrl.toString() });
  } catch (error) {
    console.error("melhor-envio-oauth", error instanceof Error ? error.message : error);
    return json(req, { error: "A integração ainda não está disponível." }, 500);
  }
});

