/**
 * TestPilot AI Backend
 * Node.js 18+ required
 *
 * Current provider: Ollama (local) only.
 * OpenAI cloud provider is stubbed — wire it up when the API key is purchased.
 * Search for "TODO: OpenAI" to find the exact spots to uncomment.
 *
 * What changed from v1:
 *  - Removed classifyChatScope()       → AI decides relevance via system prompt
 *  - Removed isChatAnswerAligned()     → stopped throwing away valid AI answers
 *  - Removed buildFallbackChatAnswer() → replaced with a single honest error message
 *  - Removed all if(lower.includes()) prompt routing → system prompt handles everything
 *  - Unified Ollama endpoint → both chat and stream use /api/chat
 *  - Fallback only fires on actual provider failure, not regex mismatch
 *  - Chat history is wired into the system prompt properly
 *  - Context is injected once, cleanly, into every request
 */

import http from 'node:http';
import fs   from 'node:fs';

loadEnvFile();
assertRuntime();

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG = {
  ollamaBaseUrl:  process.env.OLLAMA_BASE_URL   || 'http://localhost:11434',
  ollamaModel:    process.env.OLLAMA_MODEL       || 'llama3.2:3b',
  modelTimeoutMs: Number(process.env.AI_MODEL_TIMEOUT_MS || 240_000),
  chatTimeoutMs:  Number(process.env.AI_CHAT_TIMEOUT_MS  || 180_000),
  port:           Number(process.env.PORT        || 8787),
  // TODO: OpenAI — add these back when the API key is purchased:
  // openAiApiKey: process.env.OPENAI_API_KEY || '',
  // openAiModel:  process.env.OPENAI_MODEL   || 'gpt-4o-mini',
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────
function loadEnvFile() {
  try {
    const text = fs.readFileSync(new URL('.env', import.meta.url), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#') || !t.includes('=')) continue;
      const i = t.indexOf('=');
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim();
      if (k && process.env[k] === undefined) process.env[k] = v;
    }
  } catch { /* .env is optional */ }
}

function assertRuntime() {
  const major = Number(String(process.versions.node || '0').split('.')[0]);
  if (!Number.isFinite(major) || major < 18) {
    console.error(`TestPilot requires Node.js 18+. Current: ${process.version}`);
    process.exit(1);
  }
}

// ── AI Providers ──────────────────────────────────────────────────────────────

/**
 * OllamaProvider
 * Uses /api/chat for BOTH streaming and non-streaming to keep request shapes
 * consistent. stream:false for regular calls, stream:true for SSE.
 */
class OllamaProvider {
  constructor({ baseUrl, model }) {
    this.baseUrl = String(baseUrl || '').replace(/\/+$/, '');
    this.model   = model;
    this.name    = 'ollama';
  }

  async health() {
    const res = await fetch(`${this.baseUrl}/api/tags`);
    if (!res.ok) throw new Error(`Ollama /api/tags returned ${res.status}`);
    const data = await res.json();
    const models = (data.models || []).map(m => m.name);
    const modelAvailable = models.some(m => m.startsWith(this.model.split(':')[0]));
    return {
      ok: true,
      provider: 'ollama',
      model: this.model,
      modelAvailable,
      availableModels: models.slice(0, 20),
    };
  }

  // Non-streaming: returns the full text response
  async chat({ system, messages }) {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:    this.model,
        stream:   false,
        options:  { temperature: 0.3 },
        messages: buildOllamaMessages(system, messages),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Ollama returned ${res.status}: ${body.slice(0, 300)}`);
    }
    const payload = await res.json();
    const content = payload?.message?.content;
    if (!content) throw new Error('Ollama returned an empty response.');
    return content.trim();
  }

  // Streaming: calls onToken(token) for each chunk, returns full text
  async stream({ system, messages, onToken, signal }) {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model:    this.model,
        stream:   true,
        options:  { temperature: 0.3 },
        messages: buildOllamaMessages(system, messages),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Ollama stream returned ${res.status}: ${body.slice(0, 300)}`);
    }

    // Fall back to non-streaming if the response body isn't a readable stream
    if (!res.body?.getReader) {
      const text = await this.chat({ system, messages });
      onToken(text);
      return text;
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full   = '';

    const consumeLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const payload = JSON.parse(trimmed);
      const token = payload?.message?.content || '';
      if (token) { full += token; onToken(token); }
      if (payload.done && payload.error) throw new Error(String(payload.error));
    };

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) consumeLine(line);
      if (done) break;
    }
    if (buffer.trim()) consumeLine(buffer);
    return full;
  }

  // JSON-only completion for structured analysis tasks
  async completeJson({ system, messages }) {
    // Append a reminder to return JSON only — Ollama doesn't have response_format natively
    const jsonSystem = system + '\n\nIMPORTANT: Return valid JSON only. No markdown fences, no extra text.';
    const text = await this.chat({ system: jsonSystem, messages });
    return parseJsonSafely(text);
  }
}

// TODO: OpenAI — uncomment this entire class when the API key is purchased.
// The provider interface is identical to OllamaProvider (health/chat/stream/completeJson)
// so swapping in will require no changes to the route handlers above.
//
// class OpenAIProvider {
//   constructor({ apiKey, model }) {
//     this.apiKey = apiKey;
//     this.model  = model;
//     this.name   = 'openai';
//   }
//   async health() { ... }
//   async chat({ system, messages }) { ... }
//   async stream({ system, messages, onToken, signal }) { ... }
//   async completeJson({ system, messages }) { ... }
// }

// ── Provider factory ──────────────────────────────────────────────────────────
// TODO: OpenAI — when the API key is ready, restore the OpenAIProvider class above
// and add a branch here:
//   if (process.env.OPENAI_API_KEY) {
//     return new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || 'gpt-4o-mini' });
//   }
function createProvider() {
  console.log(`[TestPilot] Using Ollama provider (${CONFIG.ollamaModel})`);
  return new OllamaProvider({ baseUrl: CONFIG.ollamaBaseUrl, model: CONFIG.ollamaModel });
}

const provider = createProvider();

// ── Message builder ───────────────────────────────────────────────────────────
function buildOllamaMessages(system, messages) {
  return [
    { role: 'system', content: system },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];
  // TODO: OpenAI uses the same shape — this function works for both providers as-is.
}

// ── System prompts ────────────────────────────────────────────────────────────
// One prompt per task. No branching inside prompts. No if(lower.includes()).
// The AI is trusted to interpret the user's question directly.

function buildChatSystemPrompt(context) {
  const { pageUrl, health, counts, actionableFindings, needsReviewFindings,
          networkSummary, consoleSummary, uiScanSummary } = context;

const topFindings = (actionableFindings || []).slice(0, 5)
    .map((f, i) => `  ${i + 1}. [${f.severity || 'medium'}] ${f.title}${f.userImpact ? ` — ${f.userImpact}` : ''}`)
    .join('\n');

  const needsReviewList = (needsReviewFindings || []).slice(0, 3)
    .map((f, i) => `  ${i + 1}. ${f.title}`)
    .join('\n');
  const evidenceCards = Array.isArray(context.evidenceCards)
    ? context.evidenceCards.slice(0, 12).map((card) => `  ${card.text || `[${card.id}] ${card.type || 'evidence'}`}`).join('\n')
    : '';

  return `You are TestPilot AI, a QA assistant embedded in a Chrome extension.
A software tester is actively testing a webpage and talking to you in real time.

Answer WHATEVER the tester asks — test strategy, bug analysis, Jira tickets,
console errors, API failures, accessibility, repro steps, "is this a bug?",
"what should I test next?", code explanations — everything is in scope if it
relates to software quality or the current session.

The ONLY thing you should decline is questions with zero connection to software,
testing, or this session (e.g. "write me a poem", "what's the weather").
For those, say exactly: "I'm focused on QA for this session — ask me about what you're testing."
Do NOT decline anything else. Real QA questions come in many forms.

When asked to generate a bug report: write a full report immediately.
When asked for a Jira ticket: use this exact format:
  Title / Severity / Priority / Environment / Affected URL /
  Steps to Reproduce / Expected Result / Actual Result / Evidence /
  User Impact / Developer Notes / QA Notes
When asked what to test next: give specific, actionable suggestions based on the findings.
When context is missing: tell the tester exactly which TestPilot action to run.
Use retrieved evidence cards first. Cite evidence IDs like [API-001], [CON-001],
[DOM-004], [ACT-012], [OBS-003], or say "not captured" for concrete claims
that are not supported by the provided evidence.

Tone: QA lead talking to a peer. Concise, practical, direct. Use plain text.
If you return JSON, return exactly one object {"answer": "..."}.

── CURRENT SESSION CONTEXT ──────────────────────────────────────────
Page: ${pageUrl || 'not captured'}
Health: ${health?.label || 'unknown'} (score: ${health?.score ?? '?'}/100)
Actionable findings: ${counts?.actionable ?? 0}
Needs review:        ${counts?.needsReview ?? 0}
API calls captured:  ${networkSummary?.businessApis ?? 0}
Console errors:      ${consoleSummary?.errors ?? 0}
UI scans run:        ${uiScanSummary?.scans ?? 0}
${topFindings   ? `\nTop actionable issues:\n${topFindings}`    : ''}
${needsReviewList ? `\nNeeds review:\n${needsReviewList}`       : ''}
${evidenceCards ? `\nRetrieved evidence cards:\n${evidenceCards}` : ''}
─────────────────────────────────────────────────────────────────────`;
}

function buildAnalysisSystemPrompt(task) {
  const taskFocus = {
    'analyze-session': `
Analyze the entire QA session. Separate real bugs from noise.
Identify the most user-impacting issues. Do not invent issues not supported by evidence.
Rate overall health as: excellent | good | needs_review | risky | broken`,

    'generate-test-cases': `
Generate specific, executable test cases based only on the evidence in this session.
Each test case must have: title, objective, priority (P0–P3), type
(functional|regression|accessibility|visual|performance|negative),
sourceFinding, dataNeeded, steps (numbered list), expectedResult.
Write steps a human tester can follow without ambiguity.
Do not write strategy paragraphs — write tester actions.`,

    'generate-bug-report': `
Generate bug report drafts only for confirmed or high-confidence issues.
For each bug include: title, severity, stepsToReproduce (numbered),
expectedResult, actualResult, evidenceSummary.
If evidence is weak or uncertain, put it in needsReview instead.
Do not invent reproduction steps — base them on captured evidence.`,
  }[task] || 'Analyze the TestPilot QA session.';

  return `You are TestPilot AI, a careful QA analyst.
${taskFocus}

Rules:
- Use ONLY the sanitized session data provided. Never invent issues.
- Prefer session.evidenceCards and cite their IDs in concrete issue, test-case,
  and bug-report claims.
- Do not overstate severity. User impact drives priority.
- Framework/internal traffic (Next.js prefetch, analytics, polling) is noise unless it causes user-visible failure.
- If data is missing, say what the tester should do to capture it.

Return strict JSON only matching this shape exactly:
{
  "qaHealth": "excellent|good|needs_review|risky|broken",
  "executiveSummary": "",
  "actionableIssues": [{"title":"","severity":"","reason":"","recommendation":""}],
  "likelyFalsePositives": [{"title":"","reason":""}],
  "needsReview": [{"title":"","whatToVerify":""}],
  "recommendedNextTests": [""],
  "testCases": [{
    "title":"","objective":"","priority":"P0|P1|P2|P3",
    "type":"functional|regression|accessibility|visual|performance|negative",
    "sourceFinding":"","dataNeeded":"","steps":[""],"expectedResult":""
  }],
  "bugReportDrafts": [{
    "title":"","severity":"","stepsToReproduce":[""],
    "expectedResult":"","actualResult":"","evidenceSummary":""
  }],
  "managerSummary": "",
  "developerSummary": ""
}`;
}

// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = pathname(req.url);
  try {
    // Status
    if (req.method === 'GET' && url === '/') {
      return sendJson(res, 200, {
        ok: true, service: 'testpilot-ai-backend',
        provider: provider.name,
        model: CONFIG.ollamaModel,
      });
    }

    if (req.method === 'GET' && url === '/api/health') {
      const ai = await provider.health().catch(e => ({ ok: false, error: e.message }));
      return sendJson(res, 200, { ok: true, service: 'testpilot-ai-backend', ai });
    }

    // Analysis tasks (non-streaming, return JSON)
    if (req.method === 'POST' && [
      '/api/ai/analyze-session',
      '/api/ai/generate-test-cases',
      '/api/ai/generate-bug-report',
    ].includes(url)) {
      return handleAnalysis(req, res, url.split('/').pop());
    }

    // Chat (non-streaming)
    if (req.method === 'POST' && ['/api/ai/chat', '/api/chat'].includes(url)) {
      return handleChat(req, res);
    }

    // Chat (streaming SSE)
    if (req.method === 'POST' && ['/api/ai/chat-stream', '/api/chat-stream'].includes(url)) {
      return handleChatStream(req, res);
    }

    sendJson(res, 404, { ok: false, error: 'Not found' });
  } catch (err) {
    console.error(`[TestPilot] Unhandled error on ${url}:`, err.message);
    sendJson(res, 500, { ok: false, error: err.message || 'Internal server error' });
  }
});

// ── Route handlers ────────────────────────────────────────────────────────────

async function handleAnalysis(req, res, task) {
  log(`${task} started`);
  const body    = await readJson(req);
  const session = sanitizeSession(body.session || body);
  const system  = buildAnalysisSystemPrompt(task);
  const messages = [{ role: 'user', content: JSON.stringify({ task, session }, null, 2) }];

  let result, usedFallback = false, fallbackReason = '';
  try {
    result = await withTimeout(
      provider.completeJson({ system, messages }),
      CONFIG.modelTimeoutMs
    );
  } catch (err) {
    usedFallback   = true;
    fallbackReason = err.message;
    log(`${task} provider error — ${fallbackReason}`);
  }

  const analysis = result
    ? normalizeAnalysis(result)
    : buildMinimalFallback(session, task, fallbackReason);

  log(`${task} done${usedFallback ? ' (fallback)' : ''}`);
  sendJson(res, 200, { ok: true, task, fallback: usedFallback, fallbackReason, analysis });
}

async function handleChat(req, res) {
  log('chat started');
  const body     = await readJson(req);
  const question = String(body.message || body.question || '').slice(0, 2000);
  const context  = sanitizeSession(body.context || {});
  const history  = sanitizeHistory(body.history || []);

  const system   = buildChatSystemPrompt(context);
  // Include conversation history + new question as the messages array
  const messages = [...history, { role: 'user', content: question }];

  let answer = '', usedFallback = false, fallbackReason = '';
  try {
    answer = await withTimeout(
      provider.chat({ system, messages }),
      CONFIG.chatTimeoutMs
    );
    // Clean up JSON-wrapped answers if the model returned {"answer":"..."}
    answer = unwrapJsonAnswer(answer);
  } catch (err) {
    usedFallback   = true;
    fallbackReason = err.message;
    answer         = providerErrorMessage(err);
    log(`chat provider error — ${fallbackReason}`);
  }

  log(`chat done${usedFallback ? ' (fallback)' : ''}`);
  sendJson(res, 200, {
    ok: true, fallback: usedFallback, fallbackReason, answer,
    usedContext: listUsedContext(context),
  });
}

async function handleChatStream(req, res) {
  log('chat-stream started');
  const body     = await readJson(req);
  const question = String(body.message || body.question || '').slice(0, 2000);
  const context  = sanitizeSession(body.context || {});
  const history  = sanitizeHistory(body.history || []);

  const system   = buildChatSystemPrompt(context);
  const messages = [...history, { role: 'user', content: question }];

  sendSseHeaders(res);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.chatTimeoutMs);

  let rawAnswer = '', usedFallback = false, fallbackReason = '';
  try {
    rawAnswer = await provider.stream({
      system, messages,
      signal: controller.signal,
      onToken(token) { sendSse(res, 'token', { token }); },
    });
    rawAnswer = unwrapJsonAnswer(rawAnswer);
  } catch (err) {
    usedFallback   = true;
    fallbackReason = err.message;
    rawAnswer      = providerErrorMessage(err);
    // Replace whatever partial tokens were sent with the error message
    sendSse(res, 'replace', { answer: rawAnswer });
    log(`chat-stream provider error — ${fallbackReason}`);
  } finally {
    clearTimeout(timer);
  }

  log(`chat-stream done${usedFallback ? ' (fallback)' : ''}`);
  sendSse(res, 'done', {
    ok: true, fallback: usedFallback, fallbackReason, answer: rawAnswer,
    usedContext: listUsedContext(context),
  });
  res.end();
}

// ── Normalisation helpers ─────────────────────────────────────────────────────
// Shape-check and clamp AI output so callers always get a predictable object.

function normalizeAnalysis(raw) {
  const src = (raw && typeof raw === 'object') ? raw : {};
  const str  = (v, fb = '') => String(v ?? fb).trim().slice(0, 2000);
  const arr  = (v)           => Array.isArray(v) ? v.slice(0, 20) : [];

  const validHealth = ['excellent', 'good', 'needs_review', 'risky', 'broken'];
  const qaHealth    = validHealth.includes(src.qaHealth) ? src.qaHealth : 'needs_review';

  return {
    qaHealth,
    executiveSummary:     str(src.executiveSummary, 'No summary provided.'),
    actionableIssues:     arr(src.actionableIssues).map(i => ({
      title:          str(i?.title,          'Untitled issue'),
      severity:       str(i?.severity,       'medium'),
      reason:         str(i?.reason,         ''),
      recommendation: str(i?.recommendation, ''),
    })),
    likelyFalsePositives: arr(src.likelyFalsePositives).map(i => ({
      title:  str(i?.title,  ''),
      reason: str(i?.reason, ''),
    })),
    needsReview:          arr(src.needsReview).map(i => ({
      title:         str(i?.title,         ''),
      whatToVerify:  str(i?.whatToVerify,  ''),
    })),
    recommendedNextTests: arr(src.recommendedNextTests).map(i => str(i)).filter(Boolean),
    testCases:            arr(src.testCases).map(i => ({
      title:          str(i?.title,          'Untitled test case'),
      objective:      str(i?.objective,      ''),
      priority:       str(i?.priority,       'P2'),
      type:           str(i?.type,           'functional'),
      sourceFinding:  str(i?.sourceFinding,  ''),
      dataNeeded:     str(i?.dataNeeded,     ''),
      steps:          arr(i?.steps).map(s => str(s)).filter(Boolean),
      expectedResult: str(i?.expectedResult, ''),
    })),
    bugReportDrafts:      arr(src.bugReportDrafts).map(i => ({
      title:              str(i?.title,           ''),
      severity:           str(i?.severity,        'medium'),
      stepsToReproduce:   arr(i?.stepsToReproduce).map(s => str(s)).filter(Boolean),
      expectedResult:     str(i?.expectedResult,  ''),
      actualResult:       str(i?.actualResult,    ''),
      evidenceSummary:    str(i?.evidenceSummary, ''),
    })).filter(i => i.title || i.evidenceSummary),
    managerSummary:   str(src.managerSummary,   ''),
    developerSummary: str(src.developerSummary, ''),
  };
}

/**
 * Minimal fallback when the provider itself fails (network down, model missing, timeout).
 * Does NOT try to fake AI analysis — tells the user what happened and what to do.
 */
function buildMinimalFallback(session, task, reason) {
  const pageUrl     = session.pageUrl || 'the tested page';
  const actionable  = (session.actionableFindings  || []).slice(0, 8);
  const needsReview = (session.needsReviewFindings || []).slice(0, 5);
  const counts      = session.counts || {};
  const hasAction   = actionable.length > 0 || Number(counts.actionable || 0) > 0;

  return {
    qaHealth:         hasAction ? 'risky' : 'needs_review',
    executiveSummary: `AI provider unavailable (${reason}). Showing raw session data for ${pageUrl}. ${hasAction ? `${actionable.length} actionable finding(s) require review.` : 'No confirmed actionable findings.'} Fix the provider connection to get AI analysis.`,
    actionableIssues: actionable.map(i => ({
      title:          i.title          || 'Finding',
      severity:       i.severity       || 'medium',
      reason:         i.evidenceSummary || i.description || '',
      recommendation: i.recommendation || 'Reproduce and confirm manually.',
    })),
    likelyFalsePositives: [],
    needsReview:          needsReview.map(i => ({
      title:        i.title        || 'Observation',
      whatToVerify: i.recommendation || 'Confirm manually.',
    })),
    recommendedNextTests: [
      `Check that Ollama is reachable: curl ${CONFIG.ollamaBaseUrl}/api/tags`,
      `Reload the page and repeat the user flow to capture fresh evidence.`,
    ],
    testCases:       [],
    bugReportDrafts: [],
    managerSummary:  `AI analysis unavailable. ${actionable.length} raw actionable finding(s) listed. Restore the provider connection for full analysis.`,
    developerSummary: `Provider error during ${task}: ${reason}`,
  };
}

// ── Utility helpers ───────────────────────────────────────────────────────────

/**
 * Cleans up answers where the model wrapped its response in {"answer":"..."}
 * even though we asked for plain text in chat mode.
 */
function unwrapJsonAnswer(text) {
  const t = String(text || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(t);
    if (parsed && typeof parsed === 'object') {
      const inner = parsed.answer || parsed.message || parsed.response || parsed.content;
      if (inner && typeof inner === 'string') return inner.trim();
    }
  } catch { /* not JSON, return as-is */ }
  return t;
}

function parseJsonSafely(text) {
  const t = String(text || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(t);
  } catch {
    // Try extracting the first {...} block
    const match = t.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    throw new Error(`Model returned non-JSON: ${t.slice(0, 200)}`);
  }
}

function providerErrorMessage(err) {
  const msg = String(err?.message || err || 'Unknown error');
  if (/ECONNREFUSED|ENOTFOUND|fetch failed/i.test(msg)) {
    return `Ollama is not running. Start it with: ollama serve\nThen make sure the model is pulled: ollama pull ${CONFIG.ollamaModel}`;
  }
  if (/404|not found/i.test(msg)) {
    return `Model "${CONFIG.ollamaModel}" is not installed. Run: ollama pull ${CONFIG.ollamaModel}`;
  }
  if (/timed out/i.test(msg)) {
    return `Ollama timed out after ${CONFIG.chatTimeoutMs / 1000}s. Try a smaller model or increase AI_CHAT_TIMEOUT_MS.`;
  }
  // TODO: OpenAI — add error handling here when the provider is wired up:
  // if (/401|Incorrect API key/i.test(msg)) return 'Invalid OpenAI API key.';
  // if (/429|rate limit/i.test(msg))        return 'OpenAI rate limit hit.';
  // if (/insufficient_quota/i.test(msg))    return 'OpenAI quota exhausted.';
  return `AI provider error: ${msg.slice(0, 300)}`;
}

function sanitizeSession(session) {
  const safe = deepRedact(JSON.parse(JSON.stringify(session || {})));
  // Strip raw headers/bodies — too large and contain secrets
  for (const key of ['rawHeaders','requestHeaders','responseHeaders','requestBody','responseBody','cookies']) {
    delete safe[key];
  }
  return safe;
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-10) // keep last 10 turns max
    .map(item => ({
      role:    item?.role === 'assistant' ? 'assistant' : 'user',
      content: String(item?.content || item?.text || '').slice(0, 2000),
    }))
    .filter(item => item.content);
}

function listUsedContext(context) {
  const used = [];
  if (context.pageUrl)                                      used.push('page URL');
  if (context.health)                                       used.push('health score');
  if (context.actionableFindings?.length)                   used.push('actionable findings');
  if (context.needsReviewFindings?.length)                  used.push('needs-review findings');
  if (context.networkSummary?.businessApis)                 used.push('network summary');
  if (context.consoleSummary?.errors)                       used.push('console summary');
  if (context.uiScanSummary?.scans)                         used.push('UI scan summary');
  if (context.pageContext?.attachments?.length)             used.push('page attachments');
  return used;
}

function deepRedact(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth > 6) return '[object]';
  if (Array.isArray(value)) return value.slice(0, 80).map(v => deepRedact(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value).slice(0, 80)) {
      out[k] = /authorization|cookie|token|password|secret|api[_-]?key/i.test(k)
        ? '[REDACTED]'
        : deepRedact(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

function redactText(text) {
  return String(text || '')
    .replace(/(authorization|cookie|token|password|secret|api[_-]?key)=([^&\s"]+)/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [REDACTED]')
    .slice(0, 8000);
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1_000_000) { req.destroy(); reject(new Error('Request body too large.')); }
    });
    req.on('end',   () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('Invalid JSON.')); } });
    req.on('error', reject);
  });
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendSseHeaders(res) {
  res.writeHead(200, {
    'Content-Type':                'text/event-stream; charset=utf-8',
    'Cache-Control':               'no-cache, no-transform',
    'Connection':                  'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':'Content-Type, Authorization',
  });
}

function sendSse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function pathname(url) {
  return (String(url || '').split('?')[0].replace(/\/+$/, '') || '/');
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(CONFIG.port, () => {
  console.log(`\nTestPilot AI backend running on http://localhost:${CONFIG.port}`);
  console.log(`Provider : ${provider.name}`);
  console.log(`Model    : ${CONFIG.ollamaModel}`);
  console.log(`Health   : http://localhost:${CONFIG.port}/api/health\n`);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${CONFIG.port} is already in use. Try: PORT=8788 npm start`);
  } else {
    console.error('Server failed to start:', err.message);
  }
  process.exit(1);
});
