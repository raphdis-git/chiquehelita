import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const API_URL = "https://sandbox.melhorenvio.com.br";
const CLIENT_ID = "11261";
const ALLOWED_ORIGINS = new Set(["https://raphdis-git.github.io", "http://localhost:5173"]);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

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
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://raphdis-git.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function reply(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toBase64(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function decrypt(ciphertext: string, iv: string, secret: string) {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, await encryptionKey(secret), fromBase64(ciphertext));
  return decoder.decode(plain);
}

async function encrypt(value: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(secret), encoder.encode(value));
  return { ciphertext: toBase64(new Uint8Array(ciphertext)), iv: toBase64(iv) };
}

async function accessToken(client: ReturnType<typeof createClient>) {
  const secret = requiredEnv("MELHOR_ENVIO_CLIENT_SECRET");
  const userAgent = requiredEnv("MELHOR_ENVIO_USER_AGENT");
  const { data: integration, error } = await client.from("shipping_integrations").select("*").eq("provider", "melhor_envio").maybeSingle();
  if (error || !integration) throw new Error("A conta do Melhor Envio não está conectada.");

  const currentAccess = await decrypt(integration.access_token_ciphertext, integration.access_token_iv, secret);
  if (new Date(integration.expires_at).getTime() > Date.now() + 5 * 60 * 1000) return currentAccess;

  const refreshToken = await decrypt(integration.refresh_token_ciphertext, integration.refresh_token_iv, secret);
  const response = await fetch(`${API_URL}/oauth/token`, {
    method: "POST",
    headers: { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded", "User-Agent": userAgent },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: CLIENT_ID, client_secret: secret, refresh_token: refreshToken }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token || !data.refresh_token) throw new Error("A autorização do Melhor Envio precisa ser refeita.");

  const access = await encrypt(String(data.access_token), secret);
  const refresh = await encrypt(String(data.refresh_token), secret);
  const expiresAt = new Date(Date.now() + Math.max(60, Number(data.expires_in) || 2592000) * 1000).toISOString();
  const { error: updateError } = await client.from("shipping_integrations").update({
    token_type: String(data.token_type || "Bearer"),
    access_token_ciphertext: access.ciphertext,
    access_token_iv: access.iv,
    refresh_token_ciphertext: refresh.ciphertext,
    refresh_token_iv: refresh.iv,
    scope: data.scope ? String(data.scope) : integration.scope,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }).eq("provider", "melhor_envio");
  if (updateError) throw new Error("Não foi possível renovar a autorização de frete.");
  return String(data.access_token);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return reply(req, { error: "Método não permitido." }, 405);

  try {
    const { postalCode, destinationAddress, lines } = await req.json();
    const destination = String(postalCode ?? "").replace(/\D/g, "");
    if (!/^\d{8}$/.test(destination) || !Array.isArray(lines) || lines.length < 1 || lines.length > 50) return reply(req, { error: "Informe um CEP válido e produtos para calcular o frete." }, 400);

    const normalizedLines = lines.map((line: any) => ({
      productId: String(line.productId ?? ""),
      variantId: String(line.variantId ?? ""),
      quantity: Number(line.quantity),
    }));
    if (normalizedLines.some((line: any) => !line.productId || !line.variantId || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 100)) return reply(req, { error: "Os itens do carrinho são inválidos." }, 400);

    const client = createClient(requiredEnv("SUPABASE_URL"), serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: settings, error: settingsError } = await client.from("store_settings").select("origin_postal_code,package_weight_grams,packaging_tare_grams,package_height_cm,package_width_cm,package_length_cm,shipping_handling_days,shipping_markup_percent,melhor_envio_enabled,local_delivery_enabled,local_delivery_days,local_delivery_origin_postal_code,local_delivery_origin_address,local_delivery_origin_number,local_delivery_origin_district,local_delivery_origin_city,local_delivery_origin_state,local_delivery_cities,local_delivery_distance_ranges").limit(1).single();
    if (settingsError || (!settings?.melhor_envio_enabled && !settings?.local_delivery_enabled)) throw new Error("O frete automático ainda não está disponível.");
    if (settings.melhor_envio_enabled && !/^\d{8}$/.test(String(settings.origin_postal_code ?? ""))) throw new Error("O CEP de origem da loja precisa ser configurado.");

    const variantIds = [...new Set(normalizedLines.map((line: any) => line.variantId))];
    const { data: variants, error: variantsError } = await client.from("product_variants").select("id,active,products!inner(id,name,price,promotional_price,active,shipping_weight_grams,shipping_height_cm,shipping_width_cm,shipping_length_cm)").in("id", variantIds);
    if (variantsError) throw variantsError;

    const totalQuantity = normalizedLines.reduce((total: number, line: any) => total + line.quantity, 0);
    const tarePerItem = Number(settings.packaging_tare_grams || 0) / totalQuantity;
    const products = normalizedLines.map((line: any) => {
      const variant: any = variants?.find((item: any) => item.id === line.variantId);
      const product: any = variant?.products;
      if (!variant?.active || !product?.active || product.id !== line.productId) throw new Error("Um produto do carrinho não está mais disponível.");
      return {
        id: product.id,
        width: Number(product.shipping_width_cm || settings.package_width_cm),
        height: Number(product.shipping_height_cm || settings.package_height_cm),
        length: Number(product.shipping_length_cm || settings.package_length_cm),
        weight: Number(((Number(product.shipping_weight_grams || settings.package_weight_grams) + tarePerItem) / 1000).toFixed(3)),
        insurance_value: Number(product.promotional_price ?? product.price),
        quantity: line.quantity,
      };
    });
    if (products.some((product: any) => !product.width || !product.height || !product.length || !product.weight)) throw new Error("Complete o peso e as dimensões dos produtos ou os valores padrão da loja.");

    const localOptions: any[] = [];
    let localDeliveryRangeError = "";
    if (settings.local_delivery_enabled && Array.isArray(settings.local_delivery_cities) && Array.isArray(settings.local_delivery_distance_ranges)) {
      try {
        const addressResponse = await fetch(`https://viacep.com.br/ws/${destination}/json/`);
        const address = await addressResponse.json().catch(() => ({}));
        const normalize = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
        const allowedCity = settings.local_delivery_cities.some((city: unknown) => normalize(city) === normalize(address.localidade));
        const destinationState = String(address.uf ?? "").toUpperCase();
        const configuredState = String(settings.local_delivery_origin_state ?? "").toUpperCase();
        if (!address.erro && allowedCity && destinationState === configuredState) {
          const field = (name: string) => String(destinationAddress?.[name] ?? "").trim().slice(0, 120);
          const origin = [settings.local_delivery_origin_address, settings.local_delivery_origin_number, settings.local_delivery_origin_district, settings.local_delivery_origin_city, settings.local_delivery_origin_state, settings.local_delivery_origin_postal_code].filter(Boolean).join(", ");
          const destinationFull = [field("address") || address.logradouro, field("number"), field("district") || address.bairro, address.localidade, address.uf, destination].filter(Boolean).join(", ");
          const mapsKey = Deno.env.get("GOOGLE_MAPS_ROUTES_API_KEY")?.trim();
          if (!mapsKey) throw new Error("A chave de cálculo de rotas da entrega local não está configurada.");
          const routeResponse = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Goog-Api-Key": mapsKey, "X-Goog-FieldMask": "routes.distanceMeters" },
            body: JSON.stringify({ origin:{ address:origin }, destination:{ address:destinationFull }, travelMode:"DRIVE", routingPreference:"TRAFFIC_UNAWARE" }),
          });
          const route = await routeResponse.json().catch(() => ({}));
          const distanceMeters = Number(route?.routes?.[0]?.distanceMeters);
          if (!routeResponse.ok || !Number.isFinite(distanceMeters) || distanceMeters <= 0) throw new Error("Não foi possível calcular a rota da entrega local.");
          const distanceKm = distanceMeters / 1000;
          const ranges = settings.local_delivery_distance_ranges
            .map((range: any) => ({ maxKm:Number(range?.maxKm), price:Number(range?.price) }))
            .filter((range: any) => Number.isFinite(range.maxKm) && range.maxKm > 0 && Number.isFinite(range.price) && range.price >= 0)
            .sort((a: any, b: any) => a.maxKm - b.maxKm);
          const selectedRange = ranges.find((range: any) => distanceKm <= range.maxKm + 0.0001);
          if (selectedRange) {
            localOptions.push({
              provider: "local_delivery", serviceId: "local_delivery", serviceName: `Motoboy · ${distanceKm.toFixed(1).replace(".", ",")} km`,
              company: "Entrega local", companyPicture: null, price: selectedRange.price, distanceKm:Number(distanceKm.toFixed(1)),
              deliveryMinDays: Number(settings.local_delivery_days || 1), deliveryMaxDays: Number(settings.local_delivery_days || 1),
            });
          } else if (ranges.length) {
            const maximumKm = ranges[ranges.length - 1].maxKm;
            localDeliveryRangeError = `A entrega local está a ${distanceKm.toFixed(1).replace(".", ",")} km e ultrapassa a última faixa cadastrada de ${maximumKm.toLocaleString("pt-BR")} km. Adicione uma nova faixa em Configurações.`;
          }
        }
      } catch (error) {
        console.error("calculate-shipping:local-delivery", error instanceof Error ? error.message : error);
      }
    }
    if (localDeliveryRangeError) return reply(req, { error: localDeliveryRangeError, reason: "local_delivery_out_of_range" }, 422);
    if (!settings.melhor_envio_enabled) {
      if (localOptions.length) return reply(req, { options: localOptions });
      return reply(req, { error: "A entrega local não atende a cidade informada." });
    }

    const token = await accessToken(client);
    const response = await fetch(`${API_URL}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "User-Agent": requiredEnv("MELHOR_ENVIO_USER_AGENT") },
      body: JSON.stringify({ from: { postal_code: String(settings.origin_postal_code) }, to: { postal_code: destination }, products, options: { receipt: false, own_hand: false } }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(result)) {
      if (localOptions.length) return reply(req, { options: localOptions });
      throw new Error("O Melhor Envio não conseguiu calcular o frete agora.");
    }

    const markup = Math.max(0, Number(settings.shipping_markup_percent || 0));
    const handling = Math.max(0, Number(settings.shipping_handling_days || 0));
    const options = [...localOptions, ...result.filter((item: any) => !item.error && Number(item.custom_price ?? item.price) >= 0).map((item: any) => {
      const basePrice = Number(item.custom_price ?? item.price);
      const range = item.custom_delivery_range ?? item.delivery_range ?? {};
      const deliveryTime = Number(item.custom_delivery_time ?? item.delivery_time ?? 0);
      return {
        provider: "melhor_envio",
        serviceId: String(item.id),
        serviceName: String(item.name ?? "Entrega"),
        company: String(item.company?.name ?? "Transportadora"),
        companyPicture: item.company?.picture ? String(item.company.picture) : null,
        price: Number((basePrice * (1 + markup / 100)).toFixed(2)),
        deliveryMinDays: Math.max(0, Number(range.min ?? deliveryTime)) + handling,
        deliveryMaxDays: Math.max(0, Number(range.max ?? deliveryTime)) + handling,
      };
    })].sort((a: any, b: any) => a.price - b.price);
    if (!options.length) {
      const providerMessages = [...new Set(result
        .map((item: any) => String(item?.error ?? "").trim())
        .filter(Boolean))];
      console.error("calculate-shipping:no-options", JSON.stringify({ destination, providerMessages }));
      const detail = providerMessages.length
        ? providerMessages.join(" ")
        : "Nenhuma transportadora atende este CEP com o pacote informado.";
      return reply(req, { error: `Frete indisponível: ${detail}` });
    }
    return reply(req, { options });
  } catch (error) {
    console.error("calculate-shipping", error instanceof Error ? error.message : error);
    return reply(req, { error: error instanceof Error ? error.message : "Não foi possível calcular o frete." }, 400);
  }
});
