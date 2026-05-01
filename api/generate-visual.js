import { readJson, sendJson } from "./_openai.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  const body = await readJson(req);

  if (!apiKey) {
    return sendJson(res, 200, {
      demo: true,
      message: "Set OPENAI_API_KEY in Vercel to generate tutor visuals.",
      image: null
    });
  }

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-5",
      input: body.prompt || "Create a clean visual explanation for a math problem.",
      tools: [{ type: "image_generation", size: "1024x1024", quality: "medium" }]
    })
  });

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) return sendJson(res, upstream.status, data);

  const image = data.output?.find((item) => item.type === "image_generation_call")?.result || null;
  sendJson(res, 200, { image });
}
