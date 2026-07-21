// @ts-nocheck
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

loadEnvFile();
assertRuntime();

const CONFIG = {
  provider: 'ollama',
  requestedProvider: (process.env.AI_PROVIDER || 'ollama').toLowerCase(),
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2:3b',
  corsOriginAllowlist: process.env.CORS_ORIGIN_ALLOWLIST || 'chrome-extension://*,http://localhost:3000,http://localhost:4173,http://localhost:5173',
  modelTimeoutMs: Number(process.env.AI_MODEL_TIMEOUT_MS || 240000),
  chatTimeoutMs: Number(process.env.AI_CHAT_TIMEOUT_MS || process.env.AI_MODEL_TIMEOUT_MS || 180000),
  port: Number(process.env.PORT || 8787)
};

const CORS_ALLOWLIST = parseOriginAllowlist(CONFIG.corsOriginAllowlist);

function loadEnvFile() {
  try {
    const text = fs.readFileSync(new URL('.env', import.meta.url), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const index = trimmed.indexOf('=');
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // .env is optional; defaults are development friendly.
  }
}

function parseOriginAllowlist(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin, allowlist) {
  if (!origin) return true;
  if (!allowlist.length) return false;
  const normalizedOrigin = normalizeOrigin(origin);
  return allowlist.some((entry) => {
    if (entry === '*') return true;
    const normalizedEntry = normalizeOrigin(entry);
    if (!normalizedEntry) return false;
    if (normalizedEntry.endsWith('*')) {
      const prefix = normalizedEntry.slice(0, -1);
      return normalizedOrigin.startsWith(prefix);
    }
    return normalizedOrigin === normalizedEntry;
  });
}

function normalizeOrigin(value) {
  return String(value || '').trim().replace(/\/+$/, '').toLowerCase();
}

class AIProvider {
  async health() {
    throw new Error('AIProvider.health is not implemented.');
  }

  async completeJson() {
    throw new Error('AIProvider.completeJson is not implemented.');
  }

  async completeChat() {
    throw new Error('AIProvider.completeChat is not implemented.');
  }

  async streamChat() {
    throw new Error('AIProvider.streamChat is not implemented.');
  }
}

class OllamaProvider extends AIProvider {
  constructor({ baseUrl, model }) {
    super();
    this.baseUrl = String(baseUrl || '').replace(/\/+$/, '');
    this.model = model;
  }

  async health() {
    const response = await fetch(`${this.baseUrl}/api/tags`, { method: 'GET' });
    if (!response.ok) throw new Error(`Ollama health returned ${response.status}`);
    return { ok: true, provider: 'ollama', model: this.model };
  }

  async completeJson({ system, user }) {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Ollama completion returned ${response.status}: ${body.slice(0, 240)}`);
    }
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Ollama returned an empty completion.');
    return parseJsonFromModel(content);
  }

  async completeChat({ system, user }) {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Ollama chat returned ${response.status}: ${body.slice(0, 240)}`);
    }
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) throw new Error('Ollama returned an empty chat response.');
    return parseOptionalJsonFromModel(content);
  }

  async streamChat({ system, user, onToken, signal }) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: this.model,
        stream: true,
        options: { temperature: 0.3 },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Ollama stream returned ${response.status}: ${body.slice(0, 240)}`);
    }
    if (!response.body || typeof response.body.getReader !== 'function') {
      const result = await this.completeChat({ system, user });
      const answer = typeof result === 'string' ? result : (result.answer || result.message || '');
      if (answer) onToken(answer);
      return answer;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let answer = '';
    const consumeLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const payload = JSON.parse(trimmed);
      const token = payload?.message?.content || payload?.response || '';
      if (token) {
        answer += token;
        onToken(token);
      }
      if (payload.done && payload.error) throw new Error(payload.error);
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
    return answer;
  }
}

class OpenAIProvider extends AIProvider {
  async health() {
    return { ok: false, provider: 'openai', configured: false, note: 'OpenAI provider placeholder only. No API keys are used by TestPilot.' };
  }

  async completeJson() {
    throw new Error('OpenAI provider is a future placeholder and is not configured.');
  }

  async completeChat() {
    throw new Error('OpenAI provider is a future placeholder and is not configured.');
  }
}

const provider = createProvider();
let server = null;
let shutdownHooksRegistered = false;
let isShuttingDown = false;

const analyzeSessionBodySchema = z.object({
  session: z.unknown().optional()
}).passthrough();

const generateBugReportBodySchema = z.object({
  session: z.unknown().optional()
}).passthrough();

const generateTestCasesBodySchema = z.object({
  session: z.unknown().optional()
}).passthrough();

const chatHistoryItemSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']).optional(),
  content: z.string().max(4000).optional(),
  text: z.string().max(4000).optional()
}).passthrough();

const chatBodySchema = z.object({
  message: z.string().max(1000).optional(),
  question: z.string().max(1000).optional(),
  mode: z.enum(['chat', 'agent']).optional(),
  context: z.record(z.unknown()).optional(),
  history: z.array(chatHistoryItemSchema).max(20).optional()
}).passthrough();

const chatStreamBodySchema = z.object({
  message: z.string().max(1000).optional(),
  question: z.string().max(1000).optional(),
  mode: z.enum(['chat', 'agent']).optional(),
  context: z.record(z.unknown()).optional(),
  history: z.array(chatHistoryItemSchema).max(20).optional()
}).passthrough();

function createProvider() {
  return new OllamaProvider({ baseUrl: CONFIG.ollamaBaseUrl, model: CONFIG.ollamaModel });
}

function getConfiguredModelName() {
  return CONFIG.ollamaModel;
}

export const app = express();

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.use(pinoHttp({
  autoLogging: {
    ignore(req) {
      return req.url === '/api/health';
    }
  },
  customLogLevel(req, res, error) {
    if (error || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage(req, res) {
    return `${req.method} ${req.url} -> ${res.statusCode}`;
  },
  customErrorMessage(req, res, error) {
    return `${req.method} ${req.url} -> ${res.statusCode} (${error?.message || 'request error'})`;
  }
}));

app.use(cors({
  origin(origin, callback) {
    if (isOriginAllowed(origin, CORS_ALLOWLIST)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin not allowed by CORS policy: ${String(origin || '(none)')}`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));

app.get('/', asyncRoute(async (_req, res) => {
  sendJson(res, 200, {
    ok: true,
    service: 'testpilot-ai-backend',
    message: 'TestPilot AI backend is running.',
    backendUrl: `http://localhost:${CONFIG.port}`,
    healthCheck: `http://localhost:${CONFIG.port}/api/health`,
    provider: CONFIG.provider,
    model: getConfiguredModelName()
  });
}));

app.get('/api/health', asyncRoute(async (_req, res) => {
  const health = await getProviderHealth();
  sendJson(res, 200, {
    ok: true,
    service: 'testpilot-ai-backend',
    provider: CONFIG.provider,
    model: getConfiguredModelName(),
    ai: health
  });
}));

app.post('/api/ai/analyze-session', validateBody(analyzeSessionBodySchema), asyncRoute(async (req, res) => {
  await handleAi(req, res, 'analyze-session');
}));

app.post('/api/ai/generate-bug-report', validateBody(generateBugReportBodySchema), asyncRoute(async (req, res) => {
  await handleAi(req, res, 'generate-bug-report');
}));

app.post('/api/ai/generate-test-cases', validateBody(generateTestCasesBodySchema), asyncRoute(async (req, res) => {
  await handleAi(req, res, 'generate-test-cases');
}));

app.post(['/api/ai/chat', '/api/chat'], validateBody(chatBodySchema), asyncRoute(async (req, res) => {
  await handleChat(req, res);
}));

app.post(['/api/ai/chat-stream', '/api/chat-stream'], validateBody(chatStreamBodySchema), asyncRoute(async (req, res) => {
  await handleChatStream(req, res);
}));

app.use((req, res) => {
  sendJson(res, 404, { ok: false, error: `Not found: ${req.method} ${req.path}` });
});

app.use((error, req, res, _next) => {
  if (res.headersSent) return;

  const isCorsError = typeof error?.message === 'string' && error.message.includes('Origin not allowed by CORS policy');
  const status = Number(error?.status || error?.statusCode) ||
    (isCorsError ? 403 : 0) ||
    (error?.type === 'entity.parse.failed' ? 400 : 500);
  const message = error?.message || (status === 400 ? 'Invalid request body.' : 'Internal server error');

  req.log?.error?.({ err: error, status }, 'request failed');
  sendJson(res, status, {
    ok: false,
    error: message
  });
});

export function startServer() {
  if (server) return server;

  registerShutdownHandlers();
  server = app.listen(CONFIG.port, () => {
    console.log('TestPilot AI backend is running.');
    console.log(`Backend URL: http://localhost:${CONFIG.port}`);
    console.log(`Health check: http://localhost:${CONFIG.port}/api/health`);
    console.log(`Provider: ${CONFIG.provider}; model: ${getConfiguredModelName()}`);
    console.log('Tip: open the Health check URL above. The root URL now returns a backend status JSON.');
    if (CONFIG.requestedProvider !== CONFIG.provider) {
      console.log(`Remote provider "${CONFIG.requestedProvider}" is disabled; TestPilot is using local Ollama only.`);
    }
  });

  server.on('error', (error) => {
    if (error && error.code === 'EADDRINUSE') {
      console.error(`TestPilot AI backend could not start because port ${CONFIG.port} is already in use.`);
      console.error(`Stop the other process or start this backend with another port, for example: PORT=8788 npm start`);
    } else {
      console.error('TestPilot AI backend failed to start:', error && error.message ? error.message : error);
    }
    process.exit(1);
  });

  return server;
}

function registerShutdownHandlers() {
  if (shutdownHooksRegistered) return;
  shutdownHooksRegistered = true;
  process.once('SIGINT', () => {
    void shutdownServer('SIGINT')
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
  process.once('SIGTERM', () => {
    void shutdownServer('SIGTERM')
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
}

export async function shutdownServer(signal = 'SIGTERM') {
  if (!server || isShuttingDown) return;
  isShuttingDown = true;

  console.log(`Received ${signal}. Starting graceful shutdown...`);
  const activeServer = server;

  await new Promise((resolve) => {
    activeServer.close(() => {
      console.log('HTTP server closed cleanly.');
      resolve();
    });
    setTimeout(() => {
      console.warn('Forcing shutdown after timeout.');
      resolve();
    }, 8000).unref();
  });

  server = null;
  isShuttingDown = false;
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  startServer();
}

function assertRuntime() {
  const major = Number(String(process.versions.node || '0').split('.')[0]);
  if (!Number.isFinite(major) || major < 18) {
    console.error(`TestPilot AI backend requires Node.js 18 or newer. Current Node.js: ${process.version}`);
    console.error('Install a newer Node.js version, then run: cd ai-backend && npm start');
    process.exit(1);
  }
}

function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      sendJson(res, 400, {
        ok: false,
        error: 'Invalid request body.',
        details: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.') || '(root)',
          message: issue.message,
          code: issue.code
        }))
      });
      return;
    }
    req.body = parsed.data;
    next();
  };
}

async function handleAi(req, res, task) {
  console.log(`[${new Date().toISOString()}] ${task} request received`);
  const body = await readJson(req);
  const session = sanitizeIncomingSession(body.session || body);
  const fallback = buildFallbackAnalysis(session, task);
  let usedFallback = false;
  let fallbackReason = '';
  let result = null;

  try {
    result = await withTimeout(provider.completeJson({
      system: buildSystemPrompt(task),
      user: JSON.stringify({ task, session }, null, 2)
    }), CONFIG.modelTimeoutMs);
  } catch (error) {
    usedFallback = true;
    fallbackReason = error.message || 'Model did not return a usable response.';
    console.warn(`[${new Date().toISOString()}] ${task} using fallback: ${fallbackReason}`);
  }

  const analysis = mergeAnalysisWithFallback(
    result ? normalizeAiAnalysis(result) : fallback,
    fallback,
    { usedFallback, fallbackReason }
  );
  console.log(`[${new Date().toISOString()}] ${task} completed${usedFallback ? ' with fallback' : ''}`);
  sendJson(res, 200, { ok: true, task, fallback: usedFallback, fallbackReason, analysis });
}

async function handleChat(req, res) {
  console.log(`[${new Date().toISOString()}] chat request received`);
  const body = await readJson(req);
  const question = String(body.message || body.question || '').slice(0, 1000);
  const context = sanitizeIncomingSession(body.context || {});
  const history = sanitizeChatHistory(body.history || []);
  const scope = classifyChatScope(question);
  const usedContext = buildUsedContextList(context);
  if (scope === 'irrelevant') {
    sendJson(res, 200, {
      ok: true,
      fallback: false,
      fallbackReason: '',
      answer: 'I can only help with this TestPilot QA session, testing, debugging, reports, and software engineering topics. Ask me about the current findings, APIs, UI scan, console logs, or what to test next.',
      scope,
      usedContext,
      suggestedActions: ['Ask about current findings', 'Review API failures', 'Explain health score']
    });
    return;
  }
  const fallbackAnswer = buildFallbackChatAnswer(question, context, '');
  let answer = fallbackAnswer;
  let usedFallback = false;
  let fallbackReason = '';

  try {
    const result = await withTimeout(provider.completeChat({
      system: buildChatSystemPrompt(),
      user: JSON.stringify({ message: question, context, history }, null, 2)
    }), CONFIG.chatTimeoutMs);
    const normalized = normalizeChatAnswer(result, fallbackAnswer);
    answer = normalized.answer;
    if (normalized.usedFallback) {
      usedFallback = true;
      fallbackReason = 'AI returned no usable chat answer.';
      answer = buildFallbackChatAnswer(question, context, fallbackReason);
    } else if (!isChatAnswerAligned(question, answer)) {
      usedFallback = true;
      fallbackReason = 'AI answer did not match the requested task.';
      answer = buildFallbackChatAnswer(question, context, '');
    }
  } catch (error) {
    usedFallback = true;
    fallbackReason = formatProviderError(error);
    answer = isProviderCapacityError(fallbackReason)
      ? buildProviderUnavailableChatAnswer(fallbackReason)
      : buildFallbackChatAnswer(question, context, fallbackReason);
    console.warn(`[${new Date().toISOString()}] chat using fallback: ${fallbackReason}`);
  }

  console.log(`[${new Date().toISOString()}] chat completed${usedFallback ? ' with fallback' : ''}`);
  sendJson(res, 200, {
    ok: true,
    fallback: usedFallback,
    fallbackReason,
    answer,
    scope,
    usedContext,
    suggestedActions: suggestChatActions(question, context)
  });
}

async function handleChatStream(req, res) {
  console.log(`[${new Date().toISOString()}] chat stream request received`);
  const body = await readJson(req);
  const question = String(body.message || body.question || '').slice(0, 1000);
  const context = sanitizeIncomingSession(body.context || {});
  const history = sanitizeChatHistory(body.history || []);
  const scope = classifyChatScope(question);
  const usedContext = buildUsedContextList(context);
  const fallbackAnswer = scope === 'irrelevant'
    ? 'I can only help with this TestPilot QA session, testing, debugging, reports, and software engineering topics. Ask me about the current findings, APIs, UI scan, console logs, or what to test next.'
    : buildFallbackChatAnswer(question, context, '');

  sendSseHeaders(res);
  if (scope === 'irrelevant') {
    sendSse(res, 'token', { token: fallbackAnswer });
    sendSse(res, 'done', {
      ok: true,
      fallback: false,
      fallbackReason: '',
      answer: fallbackAnswer,
      scope,
      usedContext,
      suggestedActions: ['Ask about current findings', 'Review API failures', 'Explain health score']
    });
    res.end();
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.chatTimeoutMs);
  let rawAnswer = '';
  let usedFallback = false;
  let fallbackReason = '';

  try {
    rawAnswer = await provider.streamChat({
      system: buildChatSystemPrompt(),
      user: JSON.stringify({ message: question, context, history }, null, 2),
      signal: controller.signal,
      onToken(token) {
        sendSse(res, 'token', { token });
      }
    });
    const answer = cleanChatAnswerText(rawAnswer);
    if (!answer || !isChatAnswerAligned(question, answer)) {
      usedFallback = true;
      fallbackReason = answer ? 'AI answer did not match the requested task.' : 'AI returned no usable chat answer.';
      const replacement = buildFallbackChatAnswer(question, context, fallbackReason);
      sendSse(res, 'replace', { answer: replacement });
      rawAnswer = replacement;
    } else {
      rawAnswer = answer;
    }
  } catch (error) {
    usedFallback = true;
    fallbackReason = formatProviderError(error);
    rawAnswer = isProviderCapacityError(fallbackReason)
      ? buildProviderUnavailableChatAnswer(fallbackReason)
      : buildFallbackChatAnswer(question, context, fallbackReason);
    sendSse(res, 'replace', { answer: rawAnswer });
    console.warn(`[${new Date().toISOString()}] chat stream using fallback: ${fallbackReason}`);
  } finally {
    clearTimeout(timeout);
  }

  console.log(`[${new Date().toISOString()}] chat stream completed${usedFallback ? ' with fallback' : ''}`);
  sendSse(res, 'done', {
    ok: true,
    fallback: usedFallback,
    fallbackReason,
    answer: rawAnswer,
    scope,
    usedContext,
    suggestedActions: suggestChatActions(question, context)
  });
  res.end();
}

function sendSseHeaders(res) {
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });
}

function sendSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function buildChatSystemPrompt() {
  return [
    'You are TestPilot AI Chat, an evidence-aware QA assistant inside a Chrome DevTools extension.',
    'Answer using only the provided sanitized TestPilot context.',
    'Answer the tester question directly first, then add evidence details.',
    'Use a friendly QA lead tone. Be concise, practical, and specific.',
    'When the tester asks how to improve score/health, explain the top fixes that would raise the score.',
    'When the tester asks to generate bug reports, draft bug reports for actionable findings. Include title, severity, impact, steps to reproduce, expected result, actual result, and evidence. Do not answer with score-improvement advice.',
    'When the tester asks for a Jira ticket, use this exact plain-text format: Title, Severity, Priority, Environment, Affected URL, Steps to Reproduce, Expected Result, Actual Result, Evidence, User Impact, Developer Notes, QA Notes.',
    'Use attached pageContext.selectedText, pageContext.attachments, and relatedFindings when present. Clearly label missing evidence instead of inventing it.',
    'When evidence is missing, say exactly which TestPilot action to run next, such as Start Session, reload, or Scan UI.',
    'Separate actionable bugs, needs-review observations, background activity, framework/internal noise, ignored findings, and passed checks.',
    'Do not invent issues. If evidence is missing, say what the tester should do next.',
    'Do not overstate severity. Prioritize user impact and linked user actions.',
    'Prefer plain text for chat. If you return JSON, return exactly one object shaped like {"answer":""}. Never return multiple JSON objects.'
  ].join('\n');
}

function classifyChatScope(question) {
  const value = String(question || '').toLowerCase();
  if (!value.trim()) return 'qa';
  if (/(qa|test|testing|bug|issue|api|console|ui|ux|error|exception|debug|frontend|backend|report|regression|health|score|finding|request|response|network|chrome|extension|javascript|typescript|react|next|vue|angular|css|html|performance|security|accessibility|jira|ticket|reproduce|expected|actual)/i.test(value)) {
    return 'software_testing';
  }
  return 'irrelevant';
}

function sanitizeChatHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-8).map((item) => ({
    role: item && item.role === 'assistant' ? 'assistant' : 'user',
    content: redactText(String(item && (item.content || item.text) || ''), 1600)
  })).filter((item) => item.content);
}

function buildUsedContextList(context) {
  const used = [];
  if (context.pageUrl) used.push('page');
  if (context.health) used.push('health');
  if (context.counts) used.push('finding counts');
  if (context.actionableFindings && context.actionableFindings.length) used.push('actionable findings');
  if (context.needsReviewFindings && context.needsReviewFindings.length) used.push('needs-review findings');
  if (context.networkSummary) used.push('network summary');
  if (context.consoleSummary) used.push('console summary');
  if (context.uiScanSummary) used.push('UI scan summary');
  if (context.apiClassificationSummary) used.push('API classifications');
  if (context.pageContext && context.pageContext.attachments && context.pageContext.attachments.length) used.push('attached page context');
  return used;
}

function suggestChatActions(question, context) {
  const value = String(question || '').toLowerCase();
  if (value.includes('jira') || value.includes('ticket')) return ['Copy Jira ticket', 'Add response to report', 'Regenerate with more technical detail'];
  if (value.includes('bug report')) return ['Add useful draft to report', 'Download bug report JSON'];
  if (value.includes('ui')) return ['Run UI Scan', 'Review UI Bugs tab'];
  if (value.includes('api')) return ['Open Findings', 'Filter API issues'];
  if (!context || !context.uiScanSummary || !context.uiScanSummary.scans) return ['Run UI Scan', 'Ask what to test next'];
  return ['Copy response', 'Add response to report'];
}

function normalizeChatAnswer(value, fallback) {
  if (typeof value === 'string') {
    const text = cleanChatAnswerText(value);
    return { answer: (text || fallback).slice(0, 5000), usedFallback: !text };
  }
  if (value && typeof value === 'object') {
    const text = cleanChatAnswerText(value.answer || value.message || value.response || value.summary || '');
    return { answer: (text || fallback).slice(0, 5000), usedFallback: !text };
  }
  return { answer: fallback, usedFallback: true };
}

function cleanChatAnswerText(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withoutFence = raw
    .replace(/^```(?:json|text)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  const whole = parseAnswerObject(withoutFence);
  if (whole) return whole;

  const fragments = extractAnswerObjectFragments(withoutFence);
  if (fragments.length) return fragments.join('\n\n');

  return withoutFence
    .replace(/^\{\s*"answer"\s*:\s*"/, '')
    .replace(/"\s*\}\s*$/, '')
    .trim();
}

function parseAnswerObject(value) {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      const answer = parsed.answer || parsed.message || parsed.response || parsed.summary;
      if (answer) return String(answer).trim();
    }
  } catch {
    // Not a single JSON answer object.
  }
  return '';
}

function extractAnswerObjectFragments(value) {
  const answers = [];
  const matches = String(value || '').match(/\{[\s\S]*?\}/g) || [];
  for (const match of matches) {
    const answer = parseAnswerObject(match);
    if (answer) answers.push(answer);
  }
  return answers;
}

function isChatAnswerAligned(question, answer) {
  const lowerQuestion = String(question || '').toLowerCase();
  const lowerAnswer = String(answer || '').toLowerCase();
  if (lowerQuestion.includes('bug report') || lowerQuestion.includes('jira') || lowerQuestion.includes('ticket')) {
    const looksLikeBugReport = /(title|severity|steps|expected|actual|evidence|impact)/i.test(answer);
    const looksLikeWrongScoreAdvice = /improve (the )?(score|qa score)|focus on fixing/i.test(lowerAnswer);
    return looksLikeBugReport && !looksLikeWrongScoreAdvice;
  }
  return true;
}

function buildFallbackChatAnswer(question, context, reason) {
  const counts = context.counts || {};
  const health = context.health || {};
  const lower = String(question || '').toLowerCase();
  const basedOn = context.contextUsed || `Based on: ${(context.userActions || []).length} user actions, ${context.networkSummary?.businessApis || 0} API calls, ${context.uiScanSummary?.scans || 0} UI scans, ${context.consoleSummary?.errors || 0} console errors.`;
  const actionable = context.actionableFindings || [];
  const review = context.needsReviewFindings || [];
  const background = context.backgroundAndIgnoredSummary || {};
  const noiseCount = Number(counts.frameworkNoise || 0) + Number(counts.backgroundActivity || 0) + Number(counts.likelyFalsePositive || 0) + Number(counts.ignored || 0);
  const fallbackNote = reason ? `\n\nLocal fallback note: ${reason}` : '';
  const asksScore = lower.includes('score') || lower.includes('scrore') || lower.includes('health') || lower.includes('rating');
  const asksImprove = lower.includes('improve') || lower.includes('increase') || lower.includes('better') || lower.includes('fix');

  if (lower.includes('jira') || lower.includes('ticket')) {
    return `${basedOn}\n\n${buildFallbackJiraTicket(context)}${fallbackNote}`;
  }
  if (lower.includes('bug report')) {
    return `${basedOn}\n\n${actionable.length ? actionable.slice(0, 5).map((item, index) => `Bug Report ${index + 1}: ${item.title}\nSeverity: ${item.severity || 'needs review'}\nImpact: ${item.userImpact || 'A tested user flow may be affected.'}\nSteps to reproduce:\n1. Open the page captured in this TestPilot session.\n2. Start TestPilot, reload the page, and repeat the tested user flow.\n3. Observe the finding evidence for this issue.\nExpected result: The flow completes without this defect.\nActual result: ${item.userImpact || item.title}\nEvidence: ${item.evidenceSummary || item.recommendation || item.title}`).join('\n\n') : 'No confirmed actionable bugs are available for bug report drafts yet.'}${fallbackNote}`;
  }
  if (lower.includes('test') || lower.includes('checklist')) {
    return `${basedOn}\n\nSuggested next tests:\n- Repeat the user flow after starting TestPilot and reloading the page.\n- Verify actionable findings first.\n- Validate needs-review UI and console findings manually.\n- Re-run UI scan after fixes.\n${fallbackNote}`;
  }
  if (lower.includes('ignore') || lower.includes('noise')) {
    return `${basedOn}\n\nIgnored/noise summary: ${noiseCount} item(s). Framework/internal, background, likely false positive, analytics, and polling requests are not treated as real bugs unless user impact is confirmed.${fallbackNote}`;
  }
  if (asksScore) {
    const topActionable = actionable.slice(0, 3).map((item, index) => `${index + 1}. Fix ${item.title}: ${item.userImpact || item.recommendation || 'This is counted as user-impacting evidence.'}`).join('\n');
    const topReview = review.slice(0, 2).map((item, index) => `- Confirm or dismiss needs-review: ${item.title}`).join('\n');
    if (asksImprove) {
      return `${basedOn}\n\nTo improve the QA score, reduce the user-impacting findings first.\n\nCurrent health: ${health.label || 'Unknown'} (${health.score ?? 'N/A'}/100)\nActionable: ${counts.actionable || 0}\nNeeds review: ${counts.needsReview || 0}\n\nPriority fixes:\n${topActionable || '1. No actionable bug details are available yet. Review Findings and run the tested user flow again.'}\n${topReview ? `\nReview cleanup:\n${topReview}` : ''}\n\nAfter fixes, reload the page, repeat the same flow, run UI Scan if needed, then check whether actionable and needs-review counts drop.${fallbackNote}`;
    }
    return `${basedOn}\n\nHealth is ${health.label || 'Unknown'} (${health.score ?? 'N/A'}/100). It is reduced mainly by ${counts.actionable || 0} actionable finding(s) and ${counts.needsReview || 0} needs-review finding(s). Background/noise is tracked separately and does not meaningfully reduce the score.${fallbackNote}`;
  }
  if (lower.includes('ui') || lower.includes('visual')) {
    return `${basedOn}\n\n${context.uiScanSummary?.scans ? 'Review UI findings in the UI Bugs tab, then confirm visible layout, clickable target, image, and link issues manually.' : 'No UI scan evidence is captured yet. Open the page state you want to check, go to UI Bugs, and run Scan UI.'}${fallbackNote}`;
  }
  if (lower.includes('real bug') || lower.includes('actionable')) {
    return `${basedOn}\n\n${actionable.length ? actionable.map((item, index) => `${index + 1}. ${item.title} - ${item.userImpact}`).join('\n') : 'No confirmed actionable bugs are captured. Review manual observations before filing.'}${fallbackNote}`;
  }
  return `${basedOn}\n\nSession summary: ${counts.actionable || 0} actionable, ${counts.needsReview || 0} needs review, ${noiseCount} background/noise. ${review.length ? 'Manual-review findings need tester confirmation before filing.' : 'No manual-review finding is currently highlighted.'}${fallbackNote}`;
}

function buildFallbackJiraTicket(context) {
  const pageContext = context.pageContext || {};
  const attachments = Array.isArray(pageContext.attachments) ? pageContext.attachments : [];
  const selectedText = pageContext.selectedText || (attachments.find((item) => item.type === 'selected-text') || {}).text || '';
  const findings = Array.isArray(context.relatedFindings) && context.relatedFindings.length
    ? context.relatedFindings
    : [...(context.actionableFindings || []), ...(context.needsReviewFindings || [])];
  const primary = findings[0] || {};
  const environment = [
    context.frameworkGuess && context.frameworkGuess !== 'Unknown' ? context.frameworkGuess : '',
    context.environment?.viewport ? `Viewport ${context.environment.viewport.width || 0}x${context.environment.viewport.height || 0}` : '',
    context.environment?.userAgentSummary || ''
  ].filter(Boolean).join(' | ') || 'Captured TestPilot environment';
  const title = primary.title || (selectedText ? `Page message conflicts with captured QA evidence` : 'TestPilot QA issue requires review');
  const evidence = [
    selectedText ? `Selected page text: "${selectedText.slice(0, 500)}"` : '',
    primary.evidenceSummary ? `Finding evidence: ${primary.evidenceSummary}` : '',
    primary.title ? `Primary finding: ${primary.title}` : '',
    attachments.filter((item) => item.type !== 'selected-text').slice(0, 3).map((item) => `${item.label || item.type}: ${(item.text || item.title || '').slice(0, 300)}`).join('\n')
  ].filter(Boolean).join('\n');

  return [
    `Title: ${title}`,
    `Severity: ${primary.severity || 'Needs review'}`,
    `Priority: ${primary.severity === 'critical' || primary.severity === 'high' ? 'P1' : 'P2'}`,
    `Environment: ${environment}`,
    `Affected URL: ${pageContext.page?.url || context.pageUrl || 'Not captured'}`,
    'Steps to Reproduce:',
    '1. Open the affected URL.',
    '2. Start TestPilot, reload the page, and repeat the tested user flow.',
    selectedText ? '3. Observe the selected page text or UI message attached to this ticket.' : '3. Observe the TestPilot finding evidence.',
    'Expected Result:',
    selectedText ? 'The page copy and backend/console behavior should describe the same successful or failed state.' : 'The tested flow completes without the captured TestPilot issue.',
    'Actual Result:',
    primary.userImpact || primary.description || selectedText || 'TestPilot captured evidence that needs QA review.',
    'Evidence:',
    evidence || 'No detailed evidence was captured yet. Attach selected page text or run the user flow again.',
    'User Impact:',
    primary.userImpact || 'Potential user impact requires confirmation by the tester.',
    'Developer Notes:',
    primary.recommendation || 'Review the linked API, console, and UI evidence before changing behavior.',
    'QA Notes:',
    'Confirm reproducibility, attach screenshots manually if needed, and re-run TestPilot after the fix.'
  ].join('\n');
}

function buildProviderUnavailableChatAnswer(reason) {
  return [
    'AI provider error',
    '',
    reason,
    '',
    'TestPilot can still capture findings and export reports. For local testing, keep `AI_PROVIDER=ollama` and make sure Ollama is running with the selected model.'
  ].join('\n');
}

function formatProviderError(error) {
  const message = String(error && error.message ? error.message : error || 'Local Ollama request failed.');
  if (/429|quota|rate limit|exceeded/i.test(message)) {
    return 'Local Ollama reported a capacity or rate-limit error.';
  }
  if (/401|403|api key|permission|unauthorized|forbidden/i.test(message)) {
    return 'Local Ollama rejected the request permissions.';
  }
  if (/404|not found|not supported/i.test(message)) {
    return 'The configured Ollama model is unavailable. Pull the model or change OLLAMA_MODEL.';
  }
  return message.slice(0, 500);
}

function isProviderCapacityError(message) {
  return /rate limited|quota|out of quota/i.test(String(message || ''));
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Model timed out after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
}

function mergeAnalysisWithFallback(analysis, fallback, meta = {}) {
  const merged = normalizeAiAnalysis({
    ...fallback,
    ...analysis,
    actionableIssues: analysis.actionableIssues && analysis.actionableIssues.length ? analysis.actionableIssues : fallback.actionableIssues,
    likelyFalsePositives: analysis.likelyFalsePositives && analysis.likelyFalsePositives.length ? analysis.likelyFalsePositives : fallback.likelyFalsePositives,
    needsReview: analysis.needsReview && analysis.needsReview.length ? analysis.needsReview : fallback.needsReview,
    recommendedNextTests: analysis.recommendedNextTests && analysis.recommendedNextTests.length ? analysis.recommendedNextTests : fallback.recommendedNextTests,
    testCases: analysis.testCases && analysis.testCases.length ? analysis.testCases : fallback.testCases,
    bugReportDrafts: analysis.bugReportDrafts && analysis.bugReportDrafts.length ? analysis.bugReportDrafts : fallback.bugReportDrafts
  });
  if (meta.usedFallback) {
    merged.developerSummary = `${merged.developerSummary} Fallback note: ${meta.fallbackReason}`.slice(0, 1600);
  }
  return merged;
}

async function getProviderHealth() {
  try {
    return await provider.health();
  } catch (error) {
    return {
      ok: false,
      provider: CONFIG.provider,
      model: CONFIG.ollamaModel,
      error: error.message || 'AI provider is not reachable.'
    };
  }
}

function buildSystemPrompt(task) {
  const focus = {
    'analyze-session': 'Analyze the TestPilot QA session, separate real issues from likely false positives, and recommend practical next tests.',
    'generate-test-cases': 'Generate concrete QA test cases. Each test case must have a title, objective, priority, type, source finding, data needed, step-by-step actions, and one expected result. Prefer evidence-driven tests over generic advice.',
    'generate-bug-report': 'Generate concise bug report drafts only for confirmed or high-confidence issues. If evidence is uncertain, put it in needsReview instead of inventing a bug.'
  }[task] || 'Analyze the TestPilot QA session.';

  return [
    'You are TestPilot AI, a careful QA assistant embedded in a Chrome DevTools extension.',
    focus,
    'Use only the sanitized session summary. Do not invent issues.',
    'Do not overstate severity. Prioritize confirmed user impact.',
    'Clearly identify framework/internal noise and likely false positives.',
    'Mark uncertain UI or console findings as manual review.',
    'For test cases, write tester-executable steps, not strategy paragraphs.',
    'For bug reports, include steps to reproduce, expected result, actual result, and evidence summary.',
    'Keep output concise and useful for QA testers, frontend developers, and managers.',
    'Return strict JSON only with this shape:',
    '{"qaHealth":"excellent|good|needs_review|risky|broken","executiveSummary":"","actionableIssues":[{"title":"","severity":"","reason":"","recommendation":""}],"likelyFalsePositives":[{"title":"","reason":""}],"needsReview":[{"title":"","whatToVerify":""}],"recommendedNextTests":[""],"testCases":[{"title":"","objective":"","priority":"P0|P1|P2|P3","type":"functional|regression|accessibility|visual|performance|negative","sourceFinding":"","dataNeeded":"","steps":[""],"expectedResult":""}],"bugReportDrafts":[{"title":"","severity":"","stepsToReproduce":[""],"expectedResult":"","actualResult":"","evidenceSummary":""}],"managerSummary":"","developerSummary":""}'
  ].join('\n');
}

function sanitizeIncomingSession(session) {
  const safe = redactSensitiveValue(JSON.parse(JSON.stringify(session || {})));
  delete safe.rawHeaders;
  delete safe.requestHeaders;
  delete safe.responseHeaders;
  delete safe.requestBody;
  delete safe.responseBody;
  delete safe.cookies;
  delete safe.authorization;
  return safe;
}

function redactText(text, maxLength = 5000) {
  return String(text || '')
    .replace(/(authorization|cookie|token|password|secret|api[_-]?key|apikey|access[_-]?token|refresh[_-]?token)=([^&\s]+)/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .slice(0, maxLength);
}

function redactSensitiveValue(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth > 6) return '[Object]';
  if (Array.isArray(value)) return value.slice(0, 80).map((item) => redactSensitiveValue(item, depth + 1));
  if (typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 80)) {
      if (/authorization|cookie|token|password|secret|api[_-]?key|apikey/i.test(key)) {
        output[key] = '[REDACTED]';
      } else {
        output[key] = redactSensitiveValue(item, depth + 1);
      }
    }
    return output;
  }
  return String(value);
}

function buildFallbackAnalysis(session, task) {
  const actionable = Array.isArray(session.actionableFindings) ? session.actionableFindings : [];
  const needsReview = Array.isArray(session.needsReviewFindings) ? session.needsReviewFindings : [];
  const findings = [...actionable, ...needsReview].slice(0, 10);
  const counts = session.counts || {};
  const pageUrl = session.pageUrl || 'the tested page';
  const hasActionable = actionable.length > 0 || Number(counts.actionable || 0) > 0;
  const hasReview = needsReview.length > 0 || Number(counts.needsReview || 0) > 0;
  const qaHealth = hasActionable ? 'risky' : (hasReview ? 'needs_review' : 'good');

  const recommendedNextTests = buildRecommendedTests(session, findings);
  const testCases = buildFallbackTestCases(session, findings, recommendedNextTests);
  const bugReportDrafts = buildFallbackBugDrafts(session, actionable, needsReview);

  return {
    qaHealth,
    executiveSummary: [
      `TestPilot reviewed the sanitized session for ${pageUrl}.`,
      hasActionable ? `${actionable.length} actionable finding(s) should be prioritized.` : 'No confirmed actionable defects were present in the sanitized summary.',
      hasReview ? `${needsReview.length} observation(s) need manual confirmation.` : ''
    ].filter(Boolean).join(' '),
    actionableIssues: actionable.slice(0, 8).map((issue) => ({
      title: issue.title || 'Actionable TestPilot finding',
      severity: issue.severity || 'medium',
      reason: issue.evidenceSummary || issue.description || 'TestPilot captured actionable evidence.',
      recommendation: issue.recommendation || 'Reproduce the flow and fix the confirmed behavior.'
    })),
    likelyFalsePositives: buildLikelyFalsePositives(session),
    needsReview: needsReview.slice(0, 8).map((issue) => ({
      title: issue.title || 'TestPilot observation needs review',
      whatToVerify: issue.recommendation || issue.evidenceSummary || 'Confirm whether this is visible and user-impacting before filing.'
    })),
    recommendedNextTests,
    testCases,
    bugReportDrafts,
    managerSummary: hasActionable
      ? 'TestPilot found evidence that should be reviewed before release. Prioritize confirmed actionable issues, then validate manual-review observations.'
      : 'TestPilot did not find confirmed actionable defects in the sanitized session. Complete the generated follow-up tests for confidence.',
    developerSummary: `Generated ${testCases.length} test case(s) and ${bugReportDrafts.length} bug draft(s) from sanitized local evidence${task ? ` for ${task}` : ''}.`
  };
}

function buildRecommendedTests(session, findings) {
  const tests = [];
  if (session.networkSummary && Number(session.networkSummary.businessApis || 0) > 0) {
    tests.push('Repeat the main user flow and confirm all business API calls return expected 2xx/3xx responses without duplicate side effects.');
  }
  if (session.consoleSummary && (Number(session.consoleSummary.errors || 0) > 0 || Number(session.consoleSummary.warnings || 0) > 0)) {
    tests.push('Repeat the flow with DevTools open and verify console errors or warnings do not appear during the user action.');
  }
  if (session.uiScanSummary && Number(session.uiScanSummary.scans || 0) > 0) {
    tests.push('Re-run the visible viewport UI scan after fixing review items and confirm no layout, clipping, or target-size observations remain.');
  } else {
    tests.push('Run a visible viewport UI scan on the target screen after the page reaches the intended state.');
  }
  for (const finding of findings.slice(0, 4)) {
    tests.push(`Verify "${finding.title || 'captured finding'}" manually and confirm whether the user-facing behavior is reproducible.`);
  }
  if (!tests.length) {
    tests.push('Open the tested page, complete the core happy path, and confirm no API, console, or visible UI issues are captured.');
  }
  return Array.from(new Set(tests)).slice(0, 8);
}

function buildFallbackTestCases(session, findings, recommendedNextTests) {
  const pageUrl = session.pageUrl || 'the tested page';
  const sourceItems = findings.length ? findings : recommendedNextTests.map((item, index) => ({
    title: `Follow-up QA check ${index + 1}`,
    type: index === 0 ? 'api' : 'ui',
    severity: 'medium',
    category: 'needs-review',
    evidenceSummary: item,
    recommendation: item
  }));

  const cases = sourceItems.slice(0, 8).map((finding, index) => {
    const type = normalizeTestType(finding.type, finding.title);
    const priority = priorityFromSeverity(finding.severity, finding.category);
    return {
      title: `${priority} ${type} check: ${finding.title || `QA follow-up ${index + 1}`}`,
      objective: finding.description || finding.evidenceSummary || finding.recommendation || 'Verify the captured TestPilot observation.',
      priority,
      type,
      sourceFinding: finding.title || 'TestPilot session',
      dataNeeded: 'Use a normal QA account and any existing test data required for this page.',
      steps: [
        `Open ${pageUrl}.`,
        'Start TestPilot, reload the page, and perform the exact user flow under test.',
        finding.recommendation || finding.evidenceSummary || 'Observe the behavior related to the captured finding.',
        'Confirm whether network, console, and visible UI evidence matches the expected result.'
      ],
      expectedResult: expectedForFinding(finding)
    };
  });

  return cases.length ? cases : [{
    title: 'P2 smoke test: page loads cleanly',
    objective: 'Confirm the captured page can complete the core user flow without new TestPilot findings.',
    priority: 'P2',
    type: 'regression',
    sourceFinding: 'No specific finding',
    dataNeeded: 'Standard QA test data.',
    steps: [
      `Open ${pageUrl}.`,
      'Start TestPilot and reload the page.',
      'Complete the primary user flow for this page.',
      'Review TestPilot Findings, AI Analysis, and Reports.'
    ],
    expectedResult: 'No confirmed actionable API, console, or UI defects are captured.'
  }];
}

function buildFallbackBugDrafts(session, actionable, needsReview) {
  const pageUrl = session.pageUrl || 'the tested page';
  const candidates = actionable.length ? actionable : needsReview.slice(0, 3);
  return candidates.slice(0, 8).map((finding) => ({
    title: finding.title || 'TestPilot captured issue',
    severity: finding.severity || (finding.category === 'needs-review' ? 'needs review' : 'medium'),
    stepsToReproduce: [
      `Open ${pageUrl}.`,
      'Start TestPilot and reload the page.',
      'Repeat the tested user flow that produced this evidence.',
      'Review the matching TestPilot finding and confirm the behavior.'
    ],
    expectedResult: expectedForFinding(finding),
    actualResult: finding.description || finding.evidenceSummary || 'TestPilot captured evidence that differs from the expected behavior.',
    evidenceSummary: finding.evidenceSummary || finding.recommendation || 'Sanitized TestPilot finding evidence.'
  }));
}

function buildLikelyFalsePositives(session) {
  const items = [];
  const framework = session.frameworkNoiseSummary || {};
  if (Number(framework.count || 0) > 0) {
    items.push({
      title: 'Framework/internal route prefetch traffic',
      reason: 'Speculative framework requests were observed without confirmed user-facing failure.'
    });
  }
  return items;
}

function normalizeTestType(type, title) {
  const source = `${type || ''} ${title || ''}`.toLowerCase();
  if (source.includes('ui') || source.includes('visual') || source.includes('layout')) return 'visual';
  if (source.includes('console')) return 'regression';
  if (source.includes('api') || source.includes('network')) return 'functional';
  if (source.includes('slow') || source.includes('performance')) return 'performance';
  return 'regression';
}

function priorityFromSeverity(severity, category) {
  if (severity === 'critical') return 'P0';
  if (severity === 'high') return 'P1';
  if (severity === 'medium' || category === 'actionable') return 'P2';
  return 'P3';
}

function expectedForFinding(finding) {
  if (finding.type === 'api') return 'The relevant API calls complete with expected status, timing, and no duplicate side effects.';
  if (finding.type === 'console') return 'The flow completes without meaningful console errors, runtime errors, or unhandled promise rejections.';
  if (finding.type === 'ui') return 'The visible UI remains readable, aligned, accessible, and usable in the tested viewport.';
  return finding.recommendation || 'The tested flow behaves correctly without confirmed user-facing defects.';
}

function normalizeAiAnalysis(value) {
  const source = value && typeof value === 'object' ? value : {};
  const text = (input, fallback = '') => {
    const value = String(input ?? '').trim();
    return (value || String(fallback || '')).slice(0, 1600);
  };
  const array = (items) => Array.isArray(items) ? items.slice(0, 12) : [];
  const qaHealth = ['excellent', 'good', 'needs_review', 'risky', 'broken'].includes(source.qaHealth)
    ? source.qaHealth
    : 'needs_review';
  const recommendedNextTests = array(source.recommendedNextTests).map((item) => text(item)).filter(Boolean);
  const testCases = array(source.testCases).map((item) => ({
    title: text(item?.title, 'Untitled test case'),
    objective: text(item?.objective, 'Verify the behavior described by TestPilot evidence.'),
    priority: text(item?.priority, 'P2'),
    type: text(item?.type, 'functional'),
    sourceFinding: text(item?.sourceFinding, 'TestPilot session'),
    dataNeeded: text(item?.dataNeeded, 'Standard QA account or existing test data.'),
    steps: array(item?.steps).map((step) => text(step)).filter(Boolean),
    expectedResult: text(item?.expectedResult, 'The flow completes without confirmed API, console, or UI defects.')
  }));
  const actionableIssues = array(source.actionableIssues).map((item) => ({
    title: text(item?.title),
    severity: text(item?.severity),
    reason: text(item?.reason),
    recommendation: text(item?.recommendation)
  }));
  const bugReportDrafts = array(source.bugReportDrafts).map((item) => ({
    title: text(item?.title),
    severity: text(item?.severity),
    stepsToReproduce: array(item?.stepsToReproduce).map((step) => text(step)).filter(Boolean),
    expectedResult: text(item?.expectedResult),
    actualResult: text(item?.actualResult),
    evidenceSummary: text(item?.evidenceSummary)
  })).filter((item) => item.title || item.evidenceSummary);
  const fallbackBugDrafts = actionableIssues.map((item) => ({
    title: item.title || 'TestPilot actionable issue',
    severity: item.severity || 'needs review',
    stepsToReproduce: [
      'Open the page captured in the TestPilot session.',
      'Start TestPilot, reload the page, and repeat the tested user flow.',
      'Observe the evidence described in the TestPilot finding.'
    ],
    expectedResult: item.recommendation || 'The tested flow completes without user-facing defects.',
    actualResult: item.reason || 'TestPilot captured evidence that requires developer review.',
    evidenceSummary: item.reason || 'Actionable TestPilot finding.'
  }));
  const fallbackTestCases = recommendedNextTests.map((item, index) => ({
    title: `Follow-up QA check ${index + 1}`,
    objective: item,
    priority: 'P2',
    type: 'regression',
    sourceFinding: 'AI recommended next test',
    dataNeeded: 'Standard QA test data.',
    steps: [
      'Open the page or flow captured in the TestPilot session.',
      item,
      'Observe network, console, and visible UI behavior while completing the flow.'
    ],
    expectedResult: 'The flow completes without confirmed TestPilot defects or user-facing regressions.'
  }));

  return {
    qaHealth,
    executiveSummary: text(source.executiveSummary, 'AI reviewed the sanitized TestPilot session.'),
    actionableIssues,
    likelyFalsePositives: array(source.likelyFalsePositives).map((item) => ({
      title: text(item?.title),
      reason: text(item?.reason)
    })),
    needsReview: array(source.needsReview).map((item) => ({
      title: text(item?.title),
      whatToVerify: text(item?.whatToVerify)
    })),
    recommendedNextTests,
    testCases: testCases.length ? testCases : fallbackTestCases,
    bugReportDrafts: bugReportDrafts.length ? bugReportDrafts : fallbackBugDrafts,
    managerSummary: text(source.managerSummary, 'No manager summary was provided by the model.'),
    developerSummary: text(source.developerSummary, 'No developer summary was provided by the model.')
  };
}

function parseJsonFromModel(content) {
  try {
    return JSON.parse(content);
  } catch {
    const match = String(content).match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Model did not return JSON.');
    return JSON.parse(match[0]);
  }
}

function parseOptionalJsonFromModel(content) {
  const text = String(content || '').trim();
  if (!text) return '';
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // Plain text chat answers are valid for this endpoint.
      }
    }
    return text;
  }
}

function readJson(req) {
  if (req && typeof req === 'object' && req.body && typeof req.body === 'object') {
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        req.destroy();
        reject(new Error('Request body too large.'));
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, status, payload) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(status).json(payload);
    return;
  }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}
