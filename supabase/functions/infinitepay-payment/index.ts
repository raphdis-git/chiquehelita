import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function serviceKey() {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) {
    const keys = JSON.parse(modern);
    if (keys.default) return keys.default;
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405);
  try {
    const body = await req.json();
    const client = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), { auth: { persistSession: false } });
    const { data: settings, error: settingsError } = await client.from("store_settings")
      .select("infinitepay_enabled,infinitepay_test_mode,infinitepay_handle").limit(1).single();
    if (settingsError || !settings?.infinitepay_enabled) return reply({ error: "O pagamento online ainda não está habilitado." }, 400);

    const orderNumber = Number(body.orderNumber);
    if (!Number.isInteger(orderNumber) || orderNumber < 1) return reply({ error: "Pedido inválido." }, 400);
    const { data: order, error: orderError } = await client.from("orders")
      .select("id,order_number,total_amount,shipping_price,payment_status,payment_checkout_token,checkout_state,customer_name,customer_email,customer_phone,postal_code,address,address_number,district,order_items(product_name,quantity,unit_price)")
      .eq("order_number", orderNumber).single();
    if (orderError || !order) return reply({ error: "Pedido não encontrado." }, 404);
    if (!body.paymentToken || body.paymentToken !== order.payment_checkout_token) return reply({ error: "Código de pagamento inválido." }, 403);
    if (order.payment_status === "paid") return reply({ error: "Este pedido já está pago." }, 409);

    if (body.action === "complete_test") {
      if (!settings.infinitepay_test_mode || !body.testToken || body.testToken !== order.payment_checkout_token) return reply({ error: "Simulação inválida ou encerrada." }, 403);
      const approved = body.result === "approved";
      const { error } = await client.from("orders").update({
        payment_status: approved ? "paid" : "failed", checkout_state: approved ? "order" : "reservation",
        payment_transaction_nsu: approved ? `TESTE-${crypto.randomUUID()}` : null,
        payment_paid_at: approved ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("id", order.id).eq("payment_checkout_token", body.testToken);
      if (error) throw error;
      return reply({ approved, testMode: true });
    }

    if (body.action === "status") return reply({ paid: order.payment_status === "paid" && order.checkout_state === "order", orderNumber: order.order_number });

    const token = order.payment_checkout_token;
    await client.from("orders").update({
      payment_provider: "infinitepay", payment_status: "pending",
      payment_test_mode: Boolean(settings.infinitepay_test_mode),
      updated_at: new Date().toISOString(),
    }).eq("id", order.id);

    if (settings.infinitepay_test_mode) return reply({ testMode: true, testToken: token, orderNumber: order.order_number, amount: Number(order.total_amount) });
    const handle = String(settings.infinitepay_handle || "").replace(/^\$/, "").trim();
    if (!handle) return reply({ error: "Informe a InfiniteTag nas configurações do painel." }, 400);
    const siteUrl = String(Deno.env.get("SITE_URL") || "https://raphdis-git.github.io/chiquehelita/");
    const response = await fetch("https://api.checkout.infinitepay.io/links", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle, order_nsu: String(order.order_number),
        redirect_url: `${siteUrl}?pagamento=retorno&pedido=${order.order_number}`,
        webhook_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/infinitepay-webhook`,
        items: [...order.order_items.map((item: any) => ({ quantity: item.quantity, price: Math.round(Number(item.unit_price) * 100), description: item.product_name })), ...(Number(order.shipping_price) > 0 ? [{ quantity: 1, price: Math.round(Number(order.shipping_price) * 100), description: "Frete" }] : [])],
        customer: { name: order.customer_name, email: order.customer_email || undefined, phone_number: `+55${String(order.customer_phone).replace(/\D/g, "")}` },
        address: { cep: order.postal_code, street: order.address, neighborhood: order.district, number: order.address_number },
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.url) return reply({ error: result.message || "A InfinitePay não conseguiu criar o checkout." }, 400);
    return reply({ testMode: false, url: result.url, orderNumber: order.order_number });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Não foi possível iniciar o pagamento." }, 400);
  }
});
