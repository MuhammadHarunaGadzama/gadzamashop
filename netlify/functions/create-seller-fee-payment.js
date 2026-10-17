const { env, adminClient, requireUser, json } = require("./_shared");
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });
  try {
    const { user } = await requireUser(event);
    const supabase = adminClient();
    const { data: existing, error } = await supabase.from("seller_account_fees").select("user_id").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (existing) return json(409, { error: "Your seller account is already activated for life. Refresh the page and submit your product." });
    const siteUrl = env("SITE_URL").replace(/\/$/, "");
    const reference = `sellerfee_${user.id}_${Date.now()}`;
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST", headers: { Authorization: `Bearer ${env("PAYSTACK_SECRET_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, amount: 10000, currency: "NGN", reference, callback_url: `${siteUrl}/?seller_fee_reference=${encodeURIComponent(reference)}`, metadata: { purpose: "seller_account_lifetime_fee", user_id: user.id } })
    });
    const payment = await paystackResponse.json();
    if (!paystackResponse.ok || !payment.status || !payment.data?.authorization_url) return json(502, { error: "Paystack could not start the ₦100 seller fee payment. Please try again." });
    return json(200, { authorization_url: payment.data.authorization_url, reference: payment.data.reference });
  } catch (e) { console.error("create-seller-fee-payment:", e.message); return json(e.statusCode || 500, { error: e.statusCode ? e.message : "Could not start seller fee checkout." }); }
};
