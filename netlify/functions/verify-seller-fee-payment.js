const { env, adminClient, requireUser, json, parseBody } = require("./_shared");
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });
  try {
    const { user } = await requireUser(event);
    const { reference } = parseBody(event);
    if (typeof reference !== "string" || !reference.startsWith(`sellerfee_${user.id}_`)) return json(400, { error: "Invalid seller fee reference for this account." });
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${env("PAYSTACK_SECRET_KEY")}` } });
    const result = await response.json();
    if (!response.ok || !result.status || result.data?.status !== "success" || Number(result.data?.amount) !== 10000 || result.data?.currency !== "NGN" || result.data?.metadata?.purpose !== "seller_account_lifetime_fee" || result.data?.metadata?.user_id !== user.id) return json(402, { error: "Paystack has not confirmed the full ₦100 seller fee for this account." });
    const supabase = adminClient();
    const { data, error } = await supabase.from("seller_account_fees").upsert({ user_id: user.id, paystack_reference: reference, paid_at: new Date().toISOString(), amount_kobo: 10000 }, { onConflict: "user_id" }).select("user_id,paid_at").single();
    if (error) throw error;
    return json(200, { activated: true, paid_at: data.paid_at, message: "Seller account activated for lifetime access." });
  } catch (e) { console.error("verify-seller-fee-payment:", e.message); return json(e.statusCode || 500, { error: e.statusCode ? e.message : "Could not verify seller fee payment." }); }
};
