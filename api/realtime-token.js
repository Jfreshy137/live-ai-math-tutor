import { sendJson } from "./_openai.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return sendJson(res, 200, {
      demo: true,
      message: "Set OPENAI_API_KEY in Vercel to enable live Realtime voice."
    });
  }

  const payload = {
    session: {
      type: "realtime",
      model: "gpt-realtime",
      instructions:
        "You are a live math tutor. Speak naturally and briefly. When math should appear on screen, describe the math intent clearly and ask the app to render it as LaTeX. Do not spell long formulas aloud unless the student asks.",
      audio: {
        output: { voice: "marin" }
      }
    }
  };

  const upstream = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await upstream.json().catch(() => ({}));
  sendJson(res, upstream.status, data);
}
