export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function tutorSchema() {
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

export function demoFeedback(problem) {
  return {
    demo: true,
    summary: "Demo analysis: I can render the integral and show the evaluation beside your work.",
    status: "incomplete",
    detectedProblem: problem || "Evaluate the integral from 0 to A of x squared dx.",
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
  };
}
