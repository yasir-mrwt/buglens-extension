# BugLens AI Backend

Local development backend for BugLens AI assistance.

The Chrome extension talks to this backend at `http://localhost:8787`. The backend sends sanitized session summaries to local Ollama using the OpenAI-compatible endpoint:

```text
http://localhost:11434/v1/chat/completions
```

Default model:

```text
llama3.2:3b
```

## Setup

1. Install and start Ollama.
2. Pull the model:

   ```bash
   ollama pull llama3.2:3b
   ```

3. Start this backend:

   ```bash
   cd ai-backend
   npm start
   ```

4. Check health:

   ```bash
   curl http://localhost:8787/api/health
   ```

## Environment

Copy `.env.example` if you want to change defaults:

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
PORT=8787
```

## Endpoints

```text
GET  /api/health
POST /api/ai/analyze-session
POST /api/ai/generate-bug-report
POST /api/ai/generate-test-cases
```

## Privacy

The extension should send only a small sanitized session summary. Do not send cookies, authorization headers, tokens, passwords, full request/response bodies, huge raw headers, personal data, or screenshots.

No OpenAI API key is used. `OpenAIProvider` is only a future placeholder.
