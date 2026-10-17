const { createClient } = require("@supabase/supabase-js");

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  return value;
}
function adminClient() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
async function requireUser(event) {
  const auth = event.headers.authorization || event.headers.Authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw Object.assign(new Error("Sign in is required."), { statusCode: 401 });
  const supabase = adminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw Object.assign(new Error("Your session is invalid or expired."), { statusCode: 401 });
  return { supabase, user: data.user };
}
async function requireAdmin(event) {
  const context = await requireUser(event);
  const { data: profile, error } = await context.supabase
    .from("profiles").select("role").eq("id", context.user.id).maybeSingle();
  if (error) throw Object.assign(new Error("Could not check admin permissions."), { statusCode: 500 });
  if (!profile || profile.role !== "admin") throw Object.assign(new Error("Admin access required."), { statusCode: 403 });
  return context;
}
function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) };
}
function parseBody(event) {
  try { return JSON.parse(event.body || "{}"); }
  catch { throw Object.assign(new Error("Invalid JSON request body."), { statusCode: 400 }); }
}
module.exports = { env, adminClient, requireUser, requireAdmin, json, parseBody };