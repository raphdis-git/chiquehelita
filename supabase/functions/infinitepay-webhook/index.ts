import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

function serviceKey() {
  const modern = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (modern) { const keys = JSON.parse(modern); if (keys.default) return keys.default; }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return respond({ success: false, message: "Método não permitido" }, 405);
  try {
    const event = await req.json();
    const orderNumber = Number(event.order_nsu);
    if (!Number.isInteger(orderNumber)) return respond({ success: false, message: "Pedido inválido" }, 400);
    const client = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), { auth: { persistSession: false } });
    const [{ data: settings }, { data: order }] = await Promise.all([
      client.from("store_settings").select("infinitepay_handle,infinitepay_test_mode").limit(1).single(),
      client.from("orders").select("id,total_amount,payment_status").eq("order_number", orderNumber).single(),
    ]);
    if (!settings || settings.infinitepay_test_mode || !order) return respond({ success: false, message: "Pagamento não localizado" }, 400);
    const verification = await fetch("https://api.checkout.infinitepay.io/payment_check", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: String(settings.infinitepay_handle).replace(/^\$/, ""), order_nsu: String(orderNumber), transaction_nsu: event.transaction_nsu, slug: event.invoice_slug }),
    });
    const checked = await verification.json().catch(() => ({}));
    const expected = Math.round(Number(order.total_amount) * 100);
    if (!verification.ok || !checked.paid || Number(checked.amount) !== expected) return respond({ success: false, message: "Pagamento não confirmado" }, 400);
    const { error } = await client.from("orders").update({
      payment_provider: "infinitepay", payment_status: "paid", payment_test_mode: false,
      payment_invoice_slug: event.invoice_slug, payment_transaction_nsu: event.transaction_nsu,
      payment_receipt_url: event.receipt_url || null, payment_paid_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", order.id);
    if (error) throw error;
    return respond({ success: true, message: null });
  } catch {
    return respond({ success: false, message: "Falha ao processar pagamento" }, 400);
  }
});
