import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const text = (value: unknown, max = 250) => String(value ?? "").trim().slice(0, max);
const digits = (value: unknown) => text(value).replace(/\D/g, "");

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
    const { customer, lines, shipping } = await req.json();
    if (!customer || !Array.isArray(lines) || lines.length < 1 || lines.length > 50) return reply({ error: "Pedido inválido." }, 400);
    const taxId = digits(customer.taxId), phone = digits(customer.phone), postalCode = digits(customer.postalCode);
    if (![11,14].includes(taxId.length) || !/^\d{10,11}$/.test(phone) || !/^\d{8}$/.test(postalCode)) return reply({ error: "Dados cadastrais inválidos." }, 400);
    const email = text(customer.email);
    if ((email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || text(customer.name).split(/\s+/).length < 2 || text(customer.address).length < 3 || !text(customer.addressNumber) || text(customer.district).length < 2 || text(customer.city).length < 2 || !/^[A-Za-z]{2}$/.test(text(customer.state)) || !["delivery","pickup"].includes(customer.fulfillment) || !text(customer.payment)) return reply({ error: "Preencha todos os campos obrigatórios corretamente." }, 400);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const client = createClient(supabaseUrl, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const ids = lines.map((line: any) => line.variantId);
    const { data: variants, error } = await client.from("product_variants").select("id,color,print_pattern,active,products!inner(id,name,price,promotional_price,wholesale_price,wholesale_rule_mode,wholesale_minimum_quantity,active),product_variant_stock(size,stock)").in("id", ids);
    if (error) throw error;
    const general = await client.from("store_settings").select("minimum_wholesale_quantity").limit(1).single();
    const totalQuantity = lines.reduce((sum: number, line: any) => sum + Number(line.quantity || 0), 0);
    const items = lines.map((line: any) => {
      const variant: any = variants?.find((v: any) => v.id === line.variantId);
      const product: any = variant?.products;
      const stock = variant?.product_variant_stock?.find((s: any) => s.size === line.size);
      const quantity = Number(line.quantity);
      if (!variant?.active || !product?.active || !Number.isInteger(quantity) || quantity < 1 || quantity > Number(stock?.stock || 0)) throw new Error("Um item não está mais disponível.");
      const productQty = lines.filter((x: any) => x.productId === product.id).reduce((sum: number, x: any) => sum + Number(x.quantity), 0);
      const wholesale = product.wholesale_rule_mode !== "disabled" && (product.wholesale_rule_mode === "product" ? productQty >= Number(product.wholesale_minimum_quantity) : totalQuantity >= Number(general.data?.minimum_wholesale_quantity || 6));
      const unitPrice = Number(wholesale ? (product.wholesale_price ?? product.price) : (product.promotional_price ?? product.price));
      return { product_id: product.id, variant_id: variant.id, product_name: product.name, color: variant.color, print_pattern: variant.print_pattern, size: text(line.size,20), quantity, unit_price: unitPrice, price_type: wholesale ? "wholesale" : "retail", subtotal: unitPrice * quantity };
    });
    const productsAmount = items.reduce((sum: number, item: any) => sum + item.subtotal, 0);
    let selectedShipping: any = null;
    if (customer.fulfillment === "delivery") {
      if (shipping?.provider !== "melhor_envio" || !text(shipping.serviceId, 40)) return reply({ error: "Calcule e selecione uma opção de frete." }, 400);
      const quoteResponse = await fetch(`${supabaseUrl}/functions/v1/calculate-shipping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postalCode, lines: lines.map((line: any) => ({ productId: line.productId, variantId: line.variantId, quantity: line.quantity })) }),
      });
      const quote = await quoteResponse.json().catch(() => ({}));
      if (!quoteResponse.ok) return reply({ error: quote.error || "Não foi possível confirmar o frete." }, 400);
      selectedShipping = quote.options?.find((option: any) => String(option.serviceId) === String(shipping.serviceId));
      if (!selectedShipping) return reply({ error: "A opção de frete escolhida não está mais disponível. Calcule novamente." }, 400);
    }
    const shippingPrice = Number(selectedShipping?.price || 0);
    const totalAmount = Number((productsAmount + shippingPrice).toFixed(2));
    const { data: order, error: orderError } = await client.from("orders").insert({ customer_name:text(customer.name), customer_email:email, customer_tax_id:taxId, customer_phone:phone, address:text(customer.address), address_number:text(customer.addressNumber), district:text(customer.district), city:text(customer.city), state:text(customer.state,2).toUpperCase(), postal_code:postalCode, fulfillment:customer.fulfillment, payment_method:text(customer.payment), notes:text(customer.notes,1000), total_quantity:totalQuantity, products_amount:productsAmount, shipping_provider:selectedShipping?.provider ?? null, shipping_service_id:selectedShipping?.serviceId ?? null, shipping_service_name:selectedShipping?.serviceName ?? null, shipping_company:selectedShipping?.company ?? null, shipping_price:shippingPrice, shipping_delivery_min_days:selectedShipping?.deliveryMinDays ?? null, shipping_delivery_max_days:selectedShipping?.deliveryMaxDays ?? null, shipping_quoted_at:selectedShipping ? new Date().toISOString() : null, total_amount:totalAmount }).select("id,order_number").single();
    if (orderError) throw orderError;
    const { error: itemsError } = await client.from("order_items").insert(items.map((item:any)=>({ ...item, order_id:order.id })));
    if (itemsError) { await client.from("orders").delete().eq("id", order.id); throw itemsError; }
    return reply({ orderNumber: order.order_number, productsAmount, shipping: selectedShipping, totalAmount });
  } catch (error) { return reply({ error: error instanceof Error ? error.message : "Não foi possível registrar o pedido." }, 400); }
});

