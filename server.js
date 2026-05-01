import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const port = Number(process.env.PORT || 3000);
const apiKey = process.env.OPENAI_API_KEY;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function tutorSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      status: { type: "string", enum: ["correct", "needs_attention", "incomplete", "unknown"] },
      detectedProblem: { type: "string" },
      steps: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            latex: { type: "string" },
            explanation: { type: "string" },
            source: { type: "string", enum: ["student", "ai", "correction"] }
          },
          required: ["id", "title", "latex", "explanation", "source"]
        }
      },
      corrections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            target: { type: "string" },
            issue: { type: "string" },
            latex: { type: "string" },
            hint: { type: "string" }
          },
          required: ["target", "issue", "latex", "hint"]
        }
      },
      nextPrompt: { type: "string" },
      visualPrompt: { type: "string" }
    },
    required: ["summary", "status", "detectedProblem", "steps", "corrections", "nextPrompt", "visualPrompt"]
  };
}

async function createRealtimeSession(req, res) {
  if (!apiKey) {
    return sendJson(res, 200, {
      demo: true,
      message: "Set OPENAI_API_KEY to enable live Realtime voice."
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

async function createRealtimeCall(req, res) {
  if (!apiKey) {
    return sendJson(res, 401, {
      error: "Set OPENAI_API_KEY to enable live Realtime voice."
    });
  }

  const sdp = (await readBody(req)).toString("utf8");
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
  res.writeHead(upstream.status, { "content-type": "application/sdp; charset=utf-8" });
  res.end(answer);
}

async function analyzeBoard(req, res) {
  const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");

  if (!apiKey) {
    return sendJson(res, 200, {
      demo: true,
      summary: "Demo analysis: I can render the integral and show the evaluation beside your work.",
      status: "incomplete",
      detectedProblem: body.problem || "Evaluate the integral from 0 to A of x squared dx.",
      steps: [
        {
          id: "ai-1",
          title: "Set up the antiderivative",
          latex: "\\int_0^A x^2\\,dx = \\left[\\frac{x^3}{3}\\right]_0^A",
          explanation: "Raise the power by one and divide by the new power.",
          source: "ai"
        },
        {
          id: "ai-2",
          title: "Evaluate the bounds",
          latex: "\\left[\\frac{x^3}{3}\\right]_0^A = \\frac{A^3}{3} - 0 = \\frac{A^3}{3}",
          explanation: "Substitute A, then subtract the value at 0.",
          source: "ai"
        }
      ],
      corrections: [],
      nextPrompt: "Try writing the antiderivative on the board, and I will check it.",
      visualPrompt: "A clean textbook-style visual showing area under y=x^2 from x=0 to x=A, with the final area A^3/3."
    });
  }

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

async function generateVisual(req, res) {
  const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");

  if (!apiKey) {
    return sendJson(res, 200, {
      demo: true,
      message: "Set OPENAI_API_KEY to generate tutor visuals.",
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

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const rawPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(rawPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);

  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "content-type": mime[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: "Not found" });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS" && req.url === "/api/realtime-session") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type"
      });
      return res.end();
    }
    if (req.method === "GET" && req.url === "/api/health") {
      return sendJson(res, 200, { ok: true, openai: Boolean(apiKey) });
    }
    if (req.method === "GET" && req.url === "/api/realtime-token") return createRealtimeSession(req, res);
    if (req.method === "POST" && req.url === "/api/realtime-session") return createRealtimeCall(req, res);
    if (req.method === "POST" && req.url === "/api/analyze-board") return analyzeBoard(req, res);
    if (req.method === "POST" && req.url === "/api/generate-visual") return generateVisual(req, res);
    if (req.method === "GET") return serveStatic(req, res);

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(port, () => {
  console.log(`Live AI Math Tutor running at http://localhost:${port}`);
  console.log(apiKey ? "OpenAI API enabled." : "Demo mode: set OPENAI_API_KEY to enable OpenAI calls.");
});
