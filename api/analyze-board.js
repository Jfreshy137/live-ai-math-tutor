import { demoFeedback, readJson, sendJson, tutorSchema } from "./_openai.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  const body = await readJson(req);

  if (!apiKey) return sendJson(res, 200, demoFeedback(body.problem));

  const content = [
    {
      type: "input_text",
      text:
        "You are checking an iPad math whiteboard for a live tutor. Extract the visible math, identify mistakes, and return only structured tutor feedback. Prefer concise LaTeX suitable for KaTeX. If handwriting is ambiguous, say so in summary and keep status unknown."
    },
    {
      type: "input_text",
      text: `Known problem/context: ${body.problem || "unknown"}\nUser note/transcript: ${body.note || ""}`
    }
  ];

  if (body.imageDataUrl) {
    content.push({ type: "input_image", image_url: body.imageDataUrl });
  }

  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-5",
      input: [{ role: "user", content }],
      text: {
        format: {
          type: "json_schema",
          name: "live_math_tutor_feedback",
          strict: true,
          schema: tutorSchema()
        }
      }
    })
  });

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) return sendJson(res, upstream.status, data);

  const text = data.output_text || data.output?.flatMap((item) => item.content || []).find((part) => part.type === "output_text")?.text;
  try {
    sendJson(res, 200, JSON.parse(text));
  } catch {
    sendJson(res, 502, { error: "Model returned non-JSON output.", raw: text, upstream: data });
  }
}
