const { requireAdmin, adminClient, json, parseBody } = require("./_shared");
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });
  try {
    const { user } = await requireAdmin(event);
    const supabase = adminClient();
    const body = parseBody(event);
    if (body.action === "list") {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return json(200, { products: (data || []).map(p => ({...p, price: Number(p.price_kobo)/100, active: p.is_active})) });
    }
    if (body.action === "create") {
      const p = body.product || {};
      const name = String(p.name || "").trim();
      const price = Number(p.price);
      if (!name || name.length > 160 || !Number.isSafeInteger(price) || price < 1 || price > 1000000000)
        return json(400, { error: "Provide a product name (max 160 chars) and a valid whole-number price in naira." });
      const image = p.image_url ? String(p.image_url) : null;
      if (image && (!image.startsWith("https://") || image.length > 2000)) return json(400, { error: "Image URL must use HTTPS." });
      const { data, error } = await supabase.from("products").insert({
        name, price_kobo: price * 100, image_url: image, description: String(p.description || "").slice(0, 2000),
        category: String(p.category || "General").slice(0, 80), stock: Number.isSafeInteger(Number(p.stock)) && Number(p.stock) >= 0 ? Number(p.stock) : 0, is_active: true,
        product_type: ["physical","external","digital","chicken"].includes(p.product_type) ? p.product_type : "physical",
        external_url: p.external_url ? String(p.external_url).slice(0, 2000) : null,
        age_weeks: [2,4,6].includes(Number(p.age_weeks)) ? Number(p.age_weeks) : null,
        pickup_minimum: p.product_type === "chicken" ? 1 : null,
        delivery_minimum: p.product_type === "chicken" ? 5 : null
      }).select().single();
      if (error) throw error;
      return json(201, { product: {...data, price, active: data.is_active} });
    }
    if (body.action === "update") {
      const id = String(body.id || "");
      const p = body.product || {};
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json(400, { error: "Invalid product ID." });
      const updates = {};
      if (typeof p.active === "boolean") updates.is_active = p.active;
      if (p.name !== undefined) updates.name = String(p.name).trim().slice(0, 160);
      if (p.description !== undefined) updates.description = String(p.description).slice(0, 2000);
      if (p.price !== undefined && Number.isSafeInteger(Number(p.price)) && Number(p.price) > 0) updates.price_kobo = Number(p.price) * 100;
      if (p.image_url !== undefined) {
        if (p.image_url && !String(p.image_url).startsWith("https://")) return json(400, { error: "Image URL must use HTTPS." });
        updates.image_url = p.image_url || null;
      }
      if (p.category !== undefined) updates.category = String(p.category).slice(0, 80);
      if (p.stock !== undefined && Number.isSafeInteger(Number(p.stock)) && Number(p.stock) >= 0) updates.stock = Number(p.stock);
      if (p.product_type !== undefined && ["physical","external","digital","chicken"].includes(p.product_type)) updates.product_type = p.product_type;
      if (p.external_url !== undefined) updates.external_url = p.external_url ? String(p.external_url).slice(0, 2000) : null;
      if (p.age_weeks !== undefined) updates.age_weeks = [2,4,6].includes(Number(p.age_weeks)) ? Number(p.age_weeks) : null;
      if (!Object.keys(updates).length) return json(400, { error: "No valid product changes supplied." });
      updates.updated_at = new Date().toISOString();
      const { error } = await supabase.from("products").update(updates).eq("id", id);
      if (error) throw error;
      return json(200, { ok: true });
    }
    if (body.action === "delete") {
      const id = String(body.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json(400, { error: "Invalid product ID." });
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      return json(200, { ok: true });
    }
    if (body.action === "orders") {
      const { data, error } = await supabase.from("orders")
        .select("id,order_number,customer_name,customer_phone,total_kobo,payment_status,order_status,created_at")
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return json(200, { orders: (data || []).map(o=>({...o, amount_kobo:o.total_kobo})) });
    }
    return json(400, { error: "Unknown admin action." });
  } catch (e) {
    console.error("admin-products:", e.message);
    return json(e.statusCode || 500, { error: e.statusCode ? e.message : "Admin request failed." });
  }
};
