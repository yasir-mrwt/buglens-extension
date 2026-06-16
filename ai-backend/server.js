import http from 'node:http';
import fs from 'node:fs';

loadEnvFile();

const CONFIG = {
  provider: process.env.AI_PROVIDER || 'ollama',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2:3b',
  modelTimeoutMs: Number(process.env.AI_MODEL_TIMEOUT_MS || 25000),
  port: Number(process.env.PORT || 8787)
};

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

class AIProvider {
  async health() {
    throw new Error('AIProvider.health is not implemented.');
  }

  async completeJson() {
    throw new Error('AIProvider.completeJson is not implemented.');
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
}

class OpenAIProvider extends AIProvider {
  async health() {
    return { ok: false, provider: 'openai', configured: false, note: 'OpenAI provider placeholder only. No API keys are used by BugLens.' };
  }

  async completeJson() {
    throw new Error('OpenAI provider is a future placeholder and is not configured.');
  }
}

const provider = CONFIG.provider === 'ollama'
  ? new OllamaProvider({ baseUrl: CONFIG.ollamaBaseUrl, model: CONFIG.ollamaModel })
  : new OpenAIProvider();

const server = http.createServer(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (req.method === 'GET' && req.url === '/api/health') {
      const health = await getProviderHealth();
      sendJson(res, 200, {
        ok: true,
        service: 'buglens-ai-backend',
        provider: CONFIG.provider,
        model: CONFIG.ollamaModel,
        ai: health
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/ai/analyze-session') {
      await handleAi(req, res, 'analyze-session');
      return;
    }

    if (req.method === 'POST' && req.url === '/api/ai/generate-bug-report') {
      await handleAi(req, res, 'generate-bug-report');
      return;
    }

    if (req.method === 'POST' && req.url === '/api/ai/generate-test-cases') {
      await handleAi(req, res, 'generate-test-cases');
      return;
    }

    sendJson(res, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || 'Internal server error' });
  }
});

server.listen(CONFIG.port, () => {
  console.log('BugLens AI backend is running.');
  console.log(`Backend URL: http://localhost:${CONFIG.port}`);
  console.log(`Health check: http://localhost:${CONFIG.port}/api/health`);
  console.log(`Provider: ${CONFIG.provider}; model: ${CONFIG.ollamaModel}`);
});

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
    'analyze-session': 'Analyze the BugLens QA session, separate real issues from likely false positives, and recommend practical next tests.',
    'generate-test-cases': 'Generate concrete QA test cases. Each test case must have a title, objective, priority, type, source finding, data needed, step-by-step actions, and one expected result. Prefer evidence-driven tests over generic advice.',
    'generate-bug-report': 'Generate concise bug report drafts only for confirmed or high-confidence issues. If evidence is uncertain, put it in needsReview instead of inventing a bug.'
  }[task] || 'Analyze the BugLens QA session.';

  return [
    'You are BugLens AI, a careful QA assistant embedded in a Chrome DevTools extension.',
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
  const safe = JSON.parse(JSON.stringify(session || {}));
  delete safe.rawHeaders;
  delete safe.requestHeaders;
  delete safe.responseHeaders;
  delete safe.requestBody;
  delete safe.responseBody;
  delete safe.cookies;
  delete safe.authorization;
  return safe;
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
      `BugLens reviewed the sanitized session for ${pageUrl}.`,
      hasActionable ? `${actionable.length} actionable finding(s) should be prioritized.` : 'No confirmed actionable defects were present in the sanitized summary.',
      hasReview ? `${needsReview.length} observation(s) need manual confirmation.` : ''
    ].filter(Boolean).join(' '),
    actionableIssues: actionable.slice(0, 8).map((issue) => ({
      title: issue.title || 'Actionable BugLens finding',
      severity: issue.severity || 'medium',
      reason: issue.evidenceSummary || issue.description || 'BugLens captured actionable evidence.',
      recommendation: issue.recommendation || 'Reproduce the flow and fix the confirmed behavior.'
    })),
    likelyFalsePositives: buildLikelyFalsePositives(session),
    needsReview: needsReview.slice(0, 8).map((issue) => ({
      title: issue.title || 'BugLens observation needs review',
      whatToVerify: issue.recommendation || issue.evidenceSummary || 'Confirm whether this is visible and user-impacting before filing.'
    })),
    recommendedNextTests,
    testCases,
    bugReportDrafts,
    managerSummary: hasActionable
      ? 'BugLens found evidence that should be reviewed before release. Prioritize confirmed actionable issues, then validate manual-review observations.'
      : 'BugLens did not find confirmed actionable defects in the sanitized session. Complete the generated follow-up tests for confidence.',
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
      objective: finding.description || finding.evidenceSummary || finding.recommendation || 'Verify the captured BugLens observation.',
      priority,
      type,
      sourceFinding: finding.title || 'BugLens session',
      dataNeeded: 'Use a normal QA account and any existing test data required for this page.',
      steps: [
        `Open ${pageUrl}.`,
        'Start BugLens, reload the page, and perform the exact user flow under test.',
        finding.recommendation || finding.evidenceSummary || 'Observe the behavior related to the captured finding.',
        'Confirm whether network, console, and visible UI evidence matches the expected result.'
      ],
      expectedResult: expectedForFinding(finding)
    };
  });

  return cases.length ? cases : [{
    title: 'P2 smoke test: page loads cleanly',
    objective: 'Confirm the captured page can complete the core user flow without new BugLens findings.',
    priority: 'P2',
    type: 'regression',
    sourceFinding: 'No specific finding',
    dataNeeded: 'Standard QA test data.',
    steps: [
      `Open ${pageUrl}.`,
      'Start BugLens and reload the page.',
      'Complete the primary user flow for this page.',
      'Review BugLens Findings, AI Analysis, and Reports.'
    ],
    expectedResult: 'No confirmed actionable API, console, or UI defects are captured.'
  }];
}

function buildFallbackBugDrafts(session, actionable, needsReview) {
  const pageUrl = session.pageUrl || 'the tested page';
  const candidates = actionable.length ? actionable : needsReview.slice(0, 3);
  return candidates.slice(0, 8).map((finding) => ({
    title: finding.title || 'BugLens captured issue',
    severity: finding.severity || (finding.category === 'needs-review' ? 'needs review' : 'medium'),
    stepsToReproduce: [
      `Open ${pageUrl}.`,
      'Start BugLens and reload the page.',
      'Repeat the tested user flow that produced this evidence.',
      'Review the matching BugLens finding and confirm the behavior.'
    ],
    expectedResult: expectedForFinding(finding),
    actualResult: finding.description || finding.evidenceSummary || 'BugLens captured evidence that differs from the expected behavior.',
    evidenceSummary: finding.evidenceSummary || finding.recommendation || 'Sanitized BugLens finding evidence.'
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
    objective: text(item?.objective, 'Verify the behavior described by BugLens evidence.'),
    priority: text(item?.priority, 'P2'),
    type: text(item?.type, 'functional'),
    sourceFinding: text(item?.sourceFinding, 'BugLens session'),
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
    title: item.title || 'BugLens actionable issue',
    severity: item.severity || 'needs review',
    stepsToReproduce: [
      'Open the page captured in the BugLens session.',
      'Start BugLens, reload the page, and repeat the tested user flow.',
      'Observe the evidence described in the BugLens finding.'
    ],
    expectedResult: item.recommendation || 'The tested flow completes without user-facing defects.',
    actualResult: item.reason || 'BugLens captured evidence that requires developer review.',
    evidenceSummary: item.reason || 'Actionable BugLens finding.'
  }));
  const fallbackTestCases = recommendedNextTests.map((item, index) => ({
    title: `Follow-up QA check ${index + 1}`,
    objective: item,
    priority: 'P2',
    type: 'regression',
    sourceFinding: 'AI recommended next test',
    dataNeeded: 'Standard QA test data.',
    steps: [
      'Open the page or flow captured in the BugLens session.',
      item,
      'Observe network, console, and visible UI behavior while completing the flow.'
    ],
    expectedResult: 'The flow completes without confirmed BugLens defects or user-facing regressions.'
  }));

  return {
    qaHealth,
    executiveSummary: text(source.executiveSummary, 'AI reviewed the sanitized BugLens session.'),
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

function readJson(req) {
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
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}
