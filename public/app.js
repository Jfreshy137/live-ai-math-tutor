const canvas = document.querySelector("#inkCanvas");
const boardWrap = document.querySelector("#boardWrap");
const mathLayer = document.querySelector("#mathLayer");
const statusEl = document.querySelector("#status");
const stepsEl = document.querySelector("#steps");
const tutorSummary = document.querySelector("#tutorSummary");
const problemInput = document.querySelector("#problemInput");
const voiceButton = document.querySelector("#voiceButton");
const analyzeButton = document.querySelector("#analyzeButton");
const visualButton = document.querySelector("#visualButton");
const clearButton = document.querySelector("#clearButton");
const imageInput = document.querySelector("#imageInput");
const visualFigure = document.querySelector("#visualFigure");
const visualImage = document.querySelector("#visualImage");

const ctx = canvas.getContext("2d");
let drawing = false;
let tool = "pen";
let lastPoint = null;
let uploadedImageDataUrl = "";
let realtime = null;
let lastVisualPrompt = "";

function setStatus(message) {
  statusEl.textContent = message;
}

function resizeCanvas() {
  const rect = boardWrap.getBoundingClientRect();
  const snapshot = document.createElement("canvas");
  snapshot.width = canvas.width;
  snapshot.height = canvas.height;
  snapshot.getContext("2d").drawImage(canvas, 0, 0);

  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * scale));
  canvas.height = Math.max(1, Math.floor(rect.height * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.drawImage(snapshot, 0, 0, rect.width, rect.height);
}

function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function drawLine(from, to) {
  ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = "#1f2933";
  ctx.lineWidth = tool === "eraser" ? 24 : 3.5;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function renderLatex(target, latex, displayMode = true) {
  target.textContent = "";
  if (window.katex) {
    try {
      window.katex.render(latex, target, { displayMode, throwOnError: false });
      return;
    } catch {
      target.textContent = latex;
      return;
    }
  }
  target.textContent = latex;
}

function addMathBlock(step, index, correction = false) {
  const block = document.createElement("div");
  block.className = `mathBlock${correction ? " correction" : ""}`;
  block.style.left = `${Math.min(64 + index * 28, 260)}px`;
  block.style.top = `${Math.min(64 + index * 116, boardWrap.clientHeight - 140)}px`;

  const title = document.createElement("div");
  title.className = "mathTitle";
  title.textContent = correction ? "Correction" : step.title;

  const math = document.createElement("div");
  renderLatex(math, step.latex);

  block.append(title, math);
  mathLayer.append(block);
}

function renderFeedback(feedback) {
  tutorSummary.textContent = feedback.summary || "Tutor feedback";
  stepsEl.textContent = "";
  mathLayer.textContent = "";
  lastVisualPrompt = feedback.visualPrompt || "";

  feedback.steps?.forEach((step, index) => {
    const item = document.createElement("article");
    item.className = "step";
    const heading = document.createElement("h3");
    heading.textContent = step.title;
    const math = document.createElement("div");
    math.className = "math";
    renderLatex(math, step.latex);
    const explanation = document.createElement("p");
    explanation.textContent = step.explanation;
    item.append(heading, math, explanation);
    stepsEl.append(item);
    addMathBlock(step, index, step.source === "correction");
  });

  feedback.corrections?.forEach((correction, index) => {
    const item = document.createElement("article");
    item.className = "step";
    const heading = document.createElement("h3");
    heading.textContent = correction.issue;
    const math = document.createElement("div");
    math.className = "math";
    renderLatex(math, correction.latex);
    const explanation = document.createElement("p");
    explanation.textContent = correction.hint;
    item.append(heading, math, explanation);
    stepsEl.prepend(item);
    addMathBlock({ title: correction.issue, latex: correction.latex }, index + 2, true);
  });

  if (feedback.nextPrompt) setStatus(feedback.nextPrompt);
}

async function analyzeBoard() {
  setStatus("Checking the board...");
  const imageDataUrl = uploadedImageDataUrl || canvas.toDataURL("image/png");
  const response = await fetch("/api/analyze-board", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      problem: problemInput.value,
      imageDataUrl
    })
  });
  const data = await response.json();
  if (!response.ok) {
    setStatus(data.error || "Board analysis failed.");
    return;
  }
  renderFeedback(data);
}

async function generateVisual() {
  setStatus("Generating a visual explanation...");
  const response = await fetch("/api/generate-visual", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt:
        lastVisualPrompt ||
        `Create a clear textbook-style visual explanation for this math problem: ${problemInput.value}`
    })
  });
  const data = await response.json();
  if (!response.ok || !data.image) {
    setStatus(data.message || data.error || "Visual generation needs OPENAI_API_KEY.");
    return;
  }
  visualImage.src = `data:image/png;base64,${data.image}`;
  visualFigure.classList.remove("hidden");
  setStatus("Visual ready.");
}

async function startVoice() {
  if (realtime) {
    realtime.pc.close();
    realtime = null;
    voiceButton.textContent = "Start voice";
    voiceButton.classList.remove("active");
    setStatus("Voice stopped.");
    return;
  }

  setStatus("Starting voice session...");
  const tokenResponse = await fetch("/api/realtime-token");
  const tokenData = await tokenResponse.json();
  if (!tokenData.value) {
    setStatus(tokenData.message || "Set OPENAI_API_KEY to enable live voice.");
    return;
  }

  const pc = new RTCPeerConnection();
  const audio = document.createElement("audio");
  audio.autoplay = true;
  pc.ontrack = (event) => {
    audio.srcObject = event.streams[0];
  };

  const media = await navigator.mediaDevices.getUserMedia({ audio: true });
  pc.addTrack(media.getAudioTracks()[0]);

  const dc = pc.createDataChannel("oai-events");
  dc.addEventListener("open", () => {
    dc.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: `We are tutoring this problem: ${problemInput.value}. When you mention math, also provide concise math intent so the app can render LaTeX.`
            }
          ]
        }
      })
    );
    dc.send(JSON.stringify({ type: "response.create" }));
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    body: offer.sdp,
    headers: {
      authorization: `Bearer ${tokenData.value}`,
      "content-type": "application/sdp"
    }
  });
  const answer = { type: "answer", sdp: await sdpResponse.text() };
  await pc.setRemoteDescription(answer);

  realtime = { pc, dc, audio, media };
  voiceButton.textContent = "Stop voice";
  voiceButton.classList.add("active");
  setStatus("Voice tutor is live.");
}

canvas.addEventListener("pointerdown", (event) => {
  drawing = true;
  lastPoint = pointFromEvent(event);
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!drawing || !lastPoint) return;
  const next = pointFromEvent(event);
  drawLine(lastPoint, next);
  lastPoint = next;
});

canvas.addEventListener("pointerup", () => {
  drawing = false;
  lastPoint = null;
});

document.querySelectorAll("[data-tool]").forEach((button) => {
  button.addEventListener("click", () => {
    tool = button.dataset.tool;
    document.querySelectorAll("[data-tool]").forEach((item) => item.classList.toggle("selected", item === button));
  });
});

clearButton.addEventListener("click", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  uploadedImageDataUrl = "";
  setStatus("Board cleared.");
});

imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    uploadedImageDataUrl = String(reader.result);
    const image = new Image();
    image.addEventListener("load", () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(rect.width / image.width, rect.height / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(image, (rect.width - width) / 2, (rect.height - height) / 2, width, height);
      setStatus("Screenshot loaded. Tap Check board.");
    });
    image.src = uploadedImageDataUrl;
  });
  reader.readAsDataURL(file);
});

analyzeButton.addEventListener("click", analyzeBoard);
visualButton.addEventListener("click", generateVisual);
voiceButton.addEventListener("click", startVoice);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
renderFeedback({
  summary: "Write a step, upload a screenshot, or start voice tutoring.",
  steps: [
    {
      title: "Example rendered math",
      latex: "\\int_0^A x^2\\,dx",
      explanation: "The app stores math as LaTeX and renders it like a textbook.",
      source: "ai"
    }
  ],
  corrections: [],
  nextPrompt: "Ready. Try Check board to see the demo tutor flow.",
  visualPrompt: ""
});
