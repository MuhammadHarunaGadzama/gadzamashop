const { env, adminClient, requireUser, json, parseBody } = require("./_shared");
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });
  try {
    const { user } = await requireUser(event);
    const body = parseBody(event);
    const c = body.customer || {};
    const name = String(c.name || "").trim(), phone = String(c.phone || "").trim();
    const email = String(c.email || "").trim(), address = String(c.address || "").trim();
    const fulfilment = c.fulfilment === "pickup" ? "pickup" : "delivery";
    if (!name || name.length > 160 || !phone || phone.length > 40 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (fulfilment === "delivery" && !address) || address.length > 1000)
      return json(400, { error: "Please provide a valid name, phone and email, plus a delivery address when delivery is selected." });
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length || items.length > 40) return json(400, { error: "Your cart is empty or too large." });
    const supabase = adminClient();
    const ids = [...new Set(items.map(i => String(i.id || "")))];
    if (ids.some(id => !/^[0-9a-f-]{36}$/i.test(id))) return json(400, { error: "The cart contains an invalid product. Refresh the store and try again." });
    const { data: products, error: productError } = await supabase.from("products")
      .select("id,name,price_kobo,is_active,stock").in("id", ids).eq("is_active", true);
    if (productError) throw productError;
    const byId = new Map((products || []).map(p => [p.id, p]));
    const orderItems = [];
    let subtotalKobo = 0;
    for (const item of items) {
      const p = byId.get(String(item.id)), quantity = Number(item.quantity);
      if (!p || !Number.isInteger(quantity) || quantity < 1 || quantity > 10) return json(400, { error: "A product is unavailable or quantity is invalid. Refresh your cart." });
      if (Number(p.stock) > 0 && quantity > Number(p.stock)) return json(400, { error: `Not enough stock for ${p.name}.` });
      const lineTotal = Number(p.price_kobo) * quantity;
      subtotalKobo += lineTotal;
      orderItems.push({ product_id: p.id, product_name: p.name, unit_price_kobo: Number(p.price_kobo), quantity, line_total_kobo: lineTotal });
    }
    const deliveryFeeKobo = 0;
    const totalKobo = subtotalKobo + deliveryFeeKobo;
    if (!Number.isSafeInteger(totalKobo) || totalKobo < 10000 || totalKobo > 100000000000)
      return json(400, { error: "Order total must be at least ₦100 and within the supported payment limit." });
    const { data: order, error: orderError } = await supabase.from("orders").insert({
      user_id: user.id, customer_name: name, customer_phone: phone, customer_email: email,
      delivery_address: address || "Home pickup", delivery_notes: [`Fulfilment: ${fulfilment}`, String(c.note || "").trim()].filter(Boolean).join(" | ").slice(0, 1000),
      subtotal_kobo: subtotalKobo, delivery_fee_kobo: deliveryFeeKobo, total_kobo: totalKobo,
      payment_method: "paystack", payment_status: "pending", order_status: "pending"
    }).select("id,order_number,total_kobo").single();
    if (orderError) throw orderError;
    const { error: itemError } = await supabase.from("order_items").insert(orderItems.map(i=>({...i,order_id:order.id})));
    if (itemError) { await supabase.from("orders").delete().eq("id",order.id); throw itemError; }
    const siteUrl = env("SITE_URL").replace(/\/$/, "");
    const reference = order.id;
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("PAYSTACK_SECRET_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email, amount: totalKobo, currency: "NGN", reference,
        callback_url: `${siteUrl}/?payment=return`,
        metadata: { order_id: order.id, order_number: order.order_number, user_id: user.id, customer_name: name, custom_fields: [] }
      })
    });
    const payment = await paystackResponse.json();
    if (!paystackResponse.ok || !payment.status || !payment.data?.authorization_url) {
      await supabase.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
      console.error("Paystack initialize failed:", payment.message || "unknown");
      return json(502, { error: "Paystack could not start checkout. Please try again later." });
    }
    await supabase.from("orders").update({ paystack_reference: payment.data.reference }).eq("id", order.id);
    return json(200, { authorization_url: payment.data.authorization_url, reference: payment.data.reference });
  } catch (e) {
    console.error("create-payment:", e.message);
    return json(e.statusCode || 500, { error: e.statusCode ? e.message : "Could not start checkout. Please try again." });
  }
};
