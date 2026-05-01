import { sendJson } from "./_openai.js";

export default function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
  sendJson(res, 200, {
    ok: true,
    openai: Boolean(process.env.OPENAI_API_KEY),
    supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  });
}
