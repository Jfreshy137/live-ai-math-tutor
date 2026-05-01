# Live AI Math Tutor

An API-ready MVP for a live math tutor with:

- iPad-friendly ink canvas
- rendered LaTeX math blocks
- screenshot/board analysis
- OpenAI Realtime voice session hook
- generated visual explanations
- demo mode when `OPENAI_API_KEY` is not set

## Run

```bash
npm run dev
```

If `npm` is not available in your shell:

```bash
node server.js
```

Open `http://localhost:3000`.

## Enable OpenAI

```bash
export OPENAI_API_KEY="your_api_key"
npm run dev
```

If `npm` is not available:

```bash
export OPENAI_API_KEY="your_api_key"
node server.js
```

The app uses:

- `gpt-realtime` through the Realtime API for voice
- `gpt-5` through the Responses API for board/screenshot analysis
- the `image_generation` tool for visual explanations

## Deploy To Vercel

This repo can run as a Vercel static app with serverless API routes.

1. Push the project to GitHub.
2. Create a new Vercel project from the GitHub repo.
3. Add these environment variables in Vercel:

```bash
OPENAI_API_KEY="your_api_key"
SUPABASE_URL="your_supabase_project_url"
SUPABASE_ANON_KEY="your_supabase_anon_key"
SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_role_key"
```

4. Deploy.

The browser app calls the same endpoints locally and in the cloud:

- `/api/realtime-token`
- `/api/analyze-board`
- `/api/generate-visual`
- `/api/health`

## Supabase Role

Supabase is planned as the persistence layer:

- users
- tutor sessions
- saved whiteboards
- screenshots
- problem history
- generated visual records

Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Never expose it in browser code.

## MVP Flow

1. Write on the board or upload a math screenshot.
2. Click **Check board**.
3. The tutor returns structured steps and corrections as LaTeX.
4. The app renders them beside the student work.
5. Click **Generate visual** for a visual explanation.
6. Click **Start voice** to begin a realtime tutor conversation.
