import { sendJson } from "./_openai.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return sendJson(res, 401, {
      error: "Set OPENAI_API_KEY in Vercel to enable live voice."
    });
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const sdp = Buffer.concat(chunks).toString("utf8");

  const session = JSON.stringify({
    type: "realtime",
    model: "gpt-realtime",
    instructions:
      "You are a live math tutor. Speak naturally and briefly. When math should appear on screen, describe the math intent clearly and ask the app to render it as LaTeX. Do not spell long formulas aloud unless the student asks.",
    audio: {
      output: { voice: "marin" }
    }
  });

  const form = new FormData();
  form.set("sdp", sdp);
  form.set("session", session);

  const upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`
    },
    body: form
  });

  const answer = await upstream.text();
  res.statusCode = upstream.status;
  res.setHeader("content-type", "application/sdp; charset=utf-8");
  res.end(answer);
}
