const { env, adminClient, requireUser, json, parseBody } = require("./_shared");
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });
  try {
    const { user } = await requireUser(event);
    const { reference } = parseBody(event);
    if (!reference || String(reference).length > 100) return json(400, { error: "Invalid payment reference." });
    const supabase = adminClient();
    const { data: order, error } = await supabase.from("orders").select("*")
      .eq("paystack_reference", String(reference)).eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!order) return json(404, { error: "Order not found for this account." });
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${env("PAYSTACK_SECRET_KEY")}` }
    });
    const result = await response.json();
    if (!response.ok || !result.status || !result.data) return json(502, { error: "Payment provider verification is temporarily unavailable." });
    const tx = result.data;
    const paid = tx.status === "success" && Number(tx.amount) === Number(order.total_kobo) && tx.currency === "NGN" && tx.reference === reference;
    if (paid) {
      const { error: updateError } = await supabase.from("orders").update({
        payment_status: "paid", updated_at: new Date().toISOString()
      }).eq("id", order.id);
      if (updateError) throw updateError;
    } else if (tx.status === "failed" || tx.status === "abandoned") {
      await supabase.from("orders").update({ payment_status: "failed" }).eq("id", order.id);
    }
    return json(200, { paid, message: paid ? "Payment confirmed. Your order has been recorded." : `Payment is currently marked "${tx.status}". If money was deducted, contact the store with reference ${reference}.` });
  } catch (e) {
    console.error("verify-payment:", e.message);
    return json(e.statusCode || 500, { error: e.statusCode ? e.message : "Could not verify payment." });
  }
};
