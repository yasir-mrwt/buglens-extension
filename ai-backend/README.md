# TestPilot AI Backend

Local development backend for TestPilot AI assistance.

The Chrome extension talks to this backend at `http://localhost:8787`. For now the backend is locked to local Ollama, so chat and analysis do not call remote API providers.

Default provider:

```text
AI_PROVIDER=ollama
```

## Setup

1. Start Ollama locally and make sure the configured model is available.
2. Start this backend:

   ```bash
   cd ai-backend
   npm start
   ```

3. Check health:

   ```bash
   curl http://localhost:8787/api/health
   ```

## Environment

Copy `.env.example` if you want to change defaults:

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
AI_MODEL_TIMEOUT_MS=240000
AI_CHAT_TIMEOUT_MS=180000
PORT=8787
```

Ollama is the active provider, so normal chat and analysis do not call external quota-limited APIs. `AI_CHAT_TIMEOUT_MS` controls chat answers, while `AI_MODEL_TIMEOUT_MS` controls heavier analysis, bug report, and test-case generation.

## Endpoints

```text
GET  /api/health
POST /api/ai/analyze-session
POST /api/ai/chat
POST /api/ai/generate-bug-report
POST /api/ai/generate-test-cases
```

`/api/ai/chat` powers the default AI Chat screen. It accepts a tester question plus a sanitized QA context and returns an evidence-aware answer. If the configured provider is slow or unavailable, the backend returns a deterministic fallback so the extension can still guide the tester.

The chat context may include explicit page attachments such as selected text, visible page summary, or a priority TestPilot finding. Jira ticket requests should return copy-ready text with title, severity, priority, environment, affected URL, reproduction steps, expected/actual results, evidence, user impact, developer notes, and QA notes.

## Privacy

The extension should send only a small sanitized session summary. Do not send cookies, authorization headers, tokens, passwords, full request/response bodies, huge raw headers, personal data, or screenshots.

Hosted provider API keys are configured in the Chrome extension UI under `Settings -> AI Provider` and are stored in Chrome local storage. This local backend remains a Local Backend/Ollama option and does not need hosted-provider keys.
