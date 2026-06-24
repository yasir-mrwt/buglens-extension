const inspectedTabId = chrome.devtools.inspectedWindow.tabId;
const port = chrome.runtime.connect({ name: 'testpilot-devtools' });
const VERSION = '0.4.1';
const SESSION_STORAGE_KEY = `testpilotSession:v4:${inspectedTabId}`;

const AI_PROVIDER_DEFAULTS = {
  'local-backend': {
    label: 'Local Backend',
    baseUrl: 'http://localhost:8787',
    model: 'auto',
    needsApiKey: false,
    adapter: 'local-backend'
  },
  'ollama-direct': {
    label: 'Ollama Direct',
    baseUrl: 'http://localhost:11434/v1/chat/completions',
    model: 'auto',
    recommendedModel: 'llama3.2:3b',
    needsApiKey: false,
    adapter: 'openai-compatible'
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'auto',
    recommendedModel: 'gpt-4o-mini',
    needsApiKey: true,
    adapter: 'openai-compatible'
  },
  grok: {
    label: 'Grok / xAI',
    baseUrl: 'https://api.x.ai/v1/chat/completions',
    model: 'auto',
    recommendedModel: 'grok-3-mini',
    needsApiKey: true,
    adapter: 'openai-compatible'
  },
  gemini: {
    label: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    model: 'auto',
    recommendedModel: 'gemini-1.5-flash',
    needsApiKey: true,
    adapter: 'gemini'
  },
  anthropic: {
    label: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    model: 'auto',
    recommendedModel: 'claude-3-5-haiku-latest',
    needsApiKey: true,
    adapter: 'anthropic'
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'auto',
    recommendedModel: 'openai/gpt-4o-mini',
    needsApiKey: true,
    adapter: 'openai-compatible'
  },
  together: {
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1/chat/completions',
    model: 'auto',
    recommendedModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
    needsApiKey: true,
    adapter: 'openai-compatible'
  },
  mistral: {
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1/chat/completions',
    model: 'auto',
    recommendedModel: 'mistral-small-latest',
    needsApiKey: true,
    adapter: 'openai-compatible'
  },
  'custom-openai-compatible': {
    label: 'Custom OpenAI-Compatible API',
    baseUrl: '',
    model: 'auto',
    needsApiKey: false,
    adapter: 'openai-compatible'
  },
  'custom-api': {
    label: 'Custom API',
    baseUrl: '',
    model: 'auto',
    needsApiKey: false,
    adapter: 'custom-api'
  }
};

const DEFAULT_AI_PROVIDER_SETTINGS = {
  provider: 'local-backend',
  apiKey: '',
  baseUrl: AI_PROVIDER_DEFAULTS['local-backend'].baseUrl,
  modelMode: 'auto',
  model: '',
  temperature: 0.2,
  maxTokens: 900,
  status: 'not_configured',
  lastCheckedAt: null,
  lastError: '',
  usage: null
};

const DEFAULT_SETTINGS = {
  slowApiMs: 1000,
  verySlowApiMs: 3000,
  duplicateWindowMs: 2000,
  maxBodyPreviewBytes: 10000,
  maxApiIssues: 500,
  maxConsoleIssues: 300,
  maxUiIssues: 200,
  maxUiNodes: 4000,
  maxIssuesPerRule: 25,
  captureResponseBody: false,
  hideFrameworkNoise: true,
  showNextPrefetchFindings: false,
  treatFrameworkPrefetchAsIssue: false,
  uiVisibleViewportOnly: true,
  uiIncludeDecorativeElements: false,
  exportFrameworkNoise: true,
  csvExportEnabled: true,
  aiContextMode: 'fast',
  aiBackendUrl: 'http://localhost:8787',
  aiProvider: { ...DEFAULT_AI_PROVIDER_SETTINGS },
  includeAiSummaryInReport: false,
  allowedColors: []
};

const REPORT_LIMITATIONS = [
  'Network capture begins only after the DevTools panel and session are active.',
  'Chrome-restricted pages and Chrome Web Store pages cannot be inspected.',
  'Cross-origin iframe DOM and console details may be unavailable.',
  'Response bodies may be unavailable, encoded, cached, binary, or skipped by size limits.',
  'UI findings are rule-based QA hints, not pixel-perfect visual assertions.'
];

const MAX_PERSISTED_URLS = 80;
const MAX_PERSISTED_TIMELINE_EVENTS = 120;
const MAX_PERSISTED_ISSUES = 300;
const MAX_PERSISTED_AI_LOGS = 20;
const MAX_STORAGE_STRING_LENGTH = 2000;
const AGENT_EVIDENCE_WINDOW_MS = 5000;
const MAX_RECENT_EVIDENCE_EVENTS = 120;
const AI_HEALTH_INTERVAL_MS = 25000;
const AUTO_UI_SCAN_COOLDOWN_MS = 10000;

const SENSITIVE_KEYS = [
  'authorization',
  'cookie',
  'set-cookie',
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'password',
  'passwd',
  'secret',
  'api_key',
  'apikey',
  'x-api-key',
  'client_secret',
  'session',
  'csrf',
  'xsrf',
  'bearer',
  'jwt'
];

const state = {
  activeView: 'ai',
  sessionId: null,
  active: false,
  startedAt: null,
  endedAt: null,
  pageUrl: '',
  capturedUrls: [],
  timeline: [],
  reloadObserved: false,
  lastUpdatedAt: null,
  unsupportedReason: '',
  capabilities: {
    network: true,
    console: false,
    ui: false
  },
  environment: {
    userAgent: '',
    viewport: { width: 0, height: 0 }
  },
  uiStats: {
    scans: 0,
    scannedElements: 0,
    skippedElements: 0,
    ignoredDecorativeElements: 0,
    hitNodeLimit: false,
    lastDurationMs: null,
    lastScannedElements: 0,
    lastSkippedElements: 0,
    lastIgnoredDecorativeElements: 0,
    lastCompletedAt: null
  },
  droppedIssues: { api: 0, console: 0, ui: 0 },
  issues: [],
  networkStats: {
    total: 0,
    api: 0,
    framework: 0,
    static: 0,
    documents: 0,
    passed: 0,
    failed: 0,
    slow: 0
  },
  duplicateCache: new Map(),
  ai: {
    status: 'not-configured',
    lastCheckedAt: null,
    analysis: null,
    lastTask: '',
    activeMode: 'analysis',
    chatMessages: [],
    lastAgentResult: null,
    error: '',
    log: ['Backend not checked yet. Start ai-backend with npm start, then click Check AI.']
  },
  settings: { ...DEFAULT_SETTINGS }
};

let persistTimer = null;
let durationTimer = null;
let toastTimer = null;
let clearConfirmationTimer = null;
let clearConfirmationArmed = false;
let uiScanInProgress = false;
let aiChatBusy = false;
let recentEvidenceEvents = [];
let aiHealthTimer = null;
let autoUiScanTimer = null;
let lastAutoUiScanAt = 0;
let aiApiKeyTouched = false;
let reportBuilderDirty = false;

const els = {
  startBtn: document.getElementById('startBtn'),
  stopBtn: document.getElementById('stopBtn'),
  uiScanBtn: document.getElementById('uiScanBtn'),
  clearBtn: document.getElementById('clearBtn'),
  sessionBanner: document.getElementById('sessionBanner'),
  sessionDot: document.getElementById('sessionDot'),
  sessionStatus: document.getElementById('sessionStatus'),
  sessionHint: document.getElementById('sessionHint'),
  sessionDuration: document.getElementById('sessionDuration'),
  currentUrl: document.getElementById('currentUrl'),
  healthScore: document.getElementById('healthScore'),
  healthMeter: document.getElementById('healthMeter'),
  healthLabel: document.getElementById('healthLabel'),
  healthSummary: document.getElementById('healthSummary'),
  healthActionableMetric: document.getElementById('healthActionableMetric'),
  healthReviewMetric: document.getElementById('healthReviewMetric'),
  healthNoiseMetric: document.getElementById('healthNoiseMetric'),
  dashboardGuidanceTitle: document.getElementById('dashboardGuidanceTitle'),
  dashboardGuidance: document.getElementById('dashboardGuidance'),
  viewPriorityBtn: document.getElementById('viewPriorityBtn'),
  viewAiBtn: document.getElementById('viewAiBtn'),
  viewReportsBtn: document.getElementById('viewReportsBtn'),
  quickExportBtn: document.getElementById('quickExportBtn'),
  quickCopyBtn: document.getElementById('quickCopyBtn'),
  actionableCount: document.getElementById('actionableCount'),
  reviewCount: document.getElementById('reviewCount'),
  frameworkCount: document.getElementById('frameworkCount'),
  consoleErrorCount: document.getElementById('consoleErrorCount'),
  aiStatusSummary: document.getElementById('aiStatusSummary'),
  consoleErrorMetric: document.getElementById('consoleErrorMetric'),
  consoleWarningMetric: document.getElementById('consoleWarningMetric'),
  consoleRepeatedMetric: document.getElementById('consoleRepeatedMetric'),
  uiScanSummary: document.getElementById('uiScanSummary'),
  businessApiCount: document.getElementById('businessApiCount'),
  frameworkRequestCount: document.getElementById('frameworkRequestCount'),
  staticRequestCount: document.getElementById('staticRequestCount'),
  documentRequestCount: document.getElementById('documentRequestCount'),
  passedRequestCount: document.getElementById('passedRequestCount'),
  uiScanMetrics: document.getElementById('uiScanMetrics'),
  uiLastScan: document.getElementById('uiLastScan'),
  uiScannedCount: document.getElementById('uiScannedCount'),
  uiSkippedCount: document.getElementById('uiSkippedCount'),
  uiViewportMetric: document.getElementById('uiViewportMetric'),
  uiIgnoredCount: document.getElementById('uiIgnoredCount'),
  networkStatus: document.getElementById('networkStatus'),
  consoleStatus: document.getElementById('consoleStatus'),
  uiStatus: document.getElementById('uiStatus'),
  lastUpdated: document.getElementById('lastUpdated'),
  typeFilter: document.getElementById('typeFilter'),
  categoryFilter: document.getElementById('categoryFilter'),
  severityFilter: document.getElementById('severityFilter'),
  searchInput: document.getElementById('searchInput'),
  resetFiltersBtn: document.getElementById('resetFiltersBtn'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  exportHtmlBtn: document.getElementById('exportHtmlBtn'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  copyReportBtn: document.getElementById('copyReportBtn'),
  reportPreview: document.getElementById('reportPreview'),
  reportHealth: document.getElementById('reportHealth'),
  reportActionable: document.getElementById('reportActionable'),
  reportReview: document.getElementById('reportReview'),
  reportRoutes: document.getElementById('reportRoutes'),
  reportBuilderTitle: document.getElementById('reportBuilderTitle'),
  reportBuilderSeverity: document.getElementById('reportBuilderSeverity'),
  reportBuilderStatus: document.getElementById('reportBuilderStatus'),
  reportBuilderSummary: document.getElementById('reportBuilderSummary'),
  reportBuilderSteps: document.getElementById('reportBuilderSteps'),
  reportBuilderExpected: document.getElementById('reportBuilderExpected'),
  reportBuilderActual: document.getElementById('reportBuilderActual'),
  reportBuilderEvidence: document.getElementById('reportBuilderEvidence'),
  refreshReportBuilderBtn: document.getElementById('refreshReportBuilderBtn'),
  copyReportBuilderBtn: document.getElementById('copyReportBuilderBtn'),
  downloadReportBuilderBtn: document.getElementById('downloadReportBuilderBtn'),
  aiStatusPill: document.getElementById('aiStatusPill'),
  testPilotCurrentView: document.getElementById('testPilotCurrentView'),
  aiStatusTitle: document.getElementById('aiStatusTitle'),
  aiStatusText: document.getElementById('aiStatusText'),
  aiBackendUrl: document.getElementById('aiBackendUrl'),
  aiConnectionLog: document.getElementById('aiConnectionLog'),
  aiProviderSelect: document.getElementById('aiProviderSelect'),
  aiApiKeyInput: document.getElementById('aiApiKeyInput'),
  aiApiKeyHelp: document.getElementById('aiApiKeyHelp'),
  clearAiApiKeyBtn: document.getElementById('clearAiApiKeyBtn'),
  aiProviderStatusText: document.getElementById('aiProviderStatusText'),
  aiProviderStatusPill: document.getElementById('aiProviderStatusPill'),
  testAiProviderBtn: document.getElementById('testAiProviderBtn'),
  aiBaseUrlInput: document.getElementById('aiBaseUrlInput'),
  aiModelModeSelect: document.getElementById('aiModelModeSelect'),
  aiModelInput: document.getElementById('aiModelInput'),
  aiContextModeSelect: document.getElementById('aiContextModeSelect'),
  aiTemperatureInput: document.getElementById('aiTemperatureInput'),
  aiMaxTokensInput: document.getElementById('aiMaxTokensInput'),
  checkAiBtn: document.getElementById('checkAiBtn'),
  analyzeAiBtn: document.getElementById('analyzeAiBtn'),
  generateTestsBtn: document.getElementById('generateTestsBtn'),
  generateBugsBtn: document.getElementById('generateBugsBtn'),
  copyAiSummaryBtn: document.getElementById('copyAiSummaryBtn'),
  downloadAiMarkdownBtn: document.getElementById('downloadAiMarkdownBtn'),
  downloadAiJsonBtn: document.getElementById('downloadAiJsonBtn'),
  downloadAiMarkdownReportBtn: document.getElementById('downloadAiMarkdownReportBtn'),
  downloadAiJsonReportBtn: document.getElementById('downloadAiJsonReportBtn'),
  includeAiSummaryInReport: document.getElementById('includeAiSummaryInReport'),
  aiOutput: document.getElementById('aiOutput'),
  aiChatForm: document.getElementById('aiChatForm'),
  aiChatInput: document.getElementById('aiChatInput'),
  aiChatMessages: document.getElementById('aiChatMessages'),
  sendAiChatBtn: document.getElementById('sendAiChatBtn'),
  testPilotChatModeBtn: document.getElementById('testPilotChatModeBtn'),
  testPilotAgentModeBtn: document.getElementById('testPilotAgentModeBtn'),
  testPilotAgentNotice: document.getElementById('testPilotAgentNotice'),
  testPilotAgentCommands: document.getElementById('testPilotAgentCommands'),
  testCaseTypeSelect: document.getElementById('testCaseTypeSelect'),
  testCaseFormatSelect: document.getElementById('testCaseFormatSelect'),
  generateTestCasesTabBtn: document.getElementById('generateTestCasesTabBtn'),
  copyTestCasesBtn: document.getElementById('copyTestCasesBtn'),
  exportTestCasesMarkdownBtn: document.getElementById('exportTestCasesMarkdownBtn'),
  clearTestCasesBtn: document.getElementById('clearTestCasesBtn'),
  testCasesStatus: document.getElementById('testCasesStatus'),
  testCasesOutput: document.getElementById('testCasesOutput'),
  generateBugReportTabBtn: document.getElementById('generateBugReportTabBtn'),
  copyBugReportDraftsBtn: document.getElementById('copyBugReportDraftsBtn'),
  exportBugReportMarkdownBtn: document.getElementById('exportBugReportMarkdownBtn'),
  exportBugReportJsonBtn: document.getElementById('exportBugReportJsonBtn'),
  clearBugReportsBtn: document.getElementById('clearBugReportsBtn'),
  bugReportsStatus: document.getElementById('bugReportsStatus'),
  bugReportsOutput: document.getElementById('bugReportsOutput'),
  findingsHeading: document.getElementById('findingsHeading'),
  slowApiMs: document.getElementById('slowApiMs'),
  verySlowApiMs: document.getElementById('verySlowApiMs'),
  duplicateWindowMs: document.getElementById('duplicateWindowMs'),
  maxBodyPreviewBytes: document.getElementById('maxBodyPreviewBytes'),
  maxUiNodes: document.getElementById('maxUiNodes'),
  maxIssuesPerRule: document.getElementById('maxIssuesPerRule'),
  captureResponseBody: document.getElementById('captureResponseBody'),
  hideFrameworkNoise: document.getElementById('hideFrameworkNoise'),
  showNextPrefetchFindings: document.getElementById('showNextPrefetchFindings'),
  treatFrameworkPrefetchAsIssue: document.getElementById('treatFrameworkPrefetchAsIssue'),
  uiVisibleViewportOnly: document.getElementById('uiVisibleViewportOnly'),
  uiIncludeDecorativeElements: document.getElementById('uiIncludeDecorativeElements'),
  exportFrameworkNoise: document.getElementById('exportFrameworkNoise'),
  csvExportEnabled: document.getElementById('csvExportEnabled'),
  allowedColors: document.getElementById('allowedColors'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  resetSettingsBtn: document.getElementById('resetSettingsBtn'),
  toastRegion: document.getElementById('toastRegion'),
  findingsPanel: document.getElementById('findingsPanel'),
  emptyIcon: document.getElementById('emptyIcon'),
  emptyState: document.getElementById('emptyState'),
  issuesList: document.getElementById('issuesList'),
  issueCountText: document.getElementById('issueCountText')
};

const tabButtons = typeof document.querySelectorAll === 'function'
  ? Array.from(document.querySelectorAll('[data-tab]'))
  : [];
const shortcutTabButtons = typeof document.querySelectorAll === 'function'
  ? Array.from(document.querySelectorAll('[data-shortcut-tab]'))
  : [];
const menuToggleBtn = document.getElementById('menuToggleBtn');
const menuCloseBtn = document.getElementById('menuCloseBtn');
const workspaceNav = document.getElementById('workspaceNav');
const aiModeButtons = typeof document.querySelectorAll === 'function'
  ? Array.from(document.querySelectorAll('[data-ai-mode]'))
  : [];
const qaActionButtons = typeof document.querySelectorAll === 'function'
  ? Array.from(document.querySelectorAll('[data-qa-action]'))
  : [];
const agentCommandButtons = typeof document.querySelectorAll === 'function'
  ? Array.from(document.querySelectorAll('[data-agent-command]'))
  : [];
const viewVisibilityRules = {
  ai: ['ai-only'],
  dashboard: ['dashboard-only'],
  findings: ['findings-only'],
  api: ['api-only', 'findings-only'],
  console: ['console-only', 'findings-only'],
  ui: ['ui-only', 'findings-only'],
  'test-cases': ['test-cases-only'],
  'bug-reports': ['bug-reports-only'],
  reports: ['reports-only'],
  settings: ['settings-only']
};
const viewScopedClasses = Array.from(new Set(Object.values(viewVisibilityRules).flat()));

init().catch((error) => {
  console.warn('[TestPilot] Panel initialization failed', error);
  state.active = false;
  state.unsupportedReason = 'TestPilot could not initialize this panel. Reload the extension, the page, and DevTools.';
  try {
    render();
  } catch {
    // The panel DOM may not be ready enough to render an error state.
  }
});

async function init() {
  port.postMessage({ type: 'TESTPILOT_PANEL_INIT', tabId: inspectedTabId });
  port.onMessage.addListener(handlePortMessage);
  bindEvents();
  setActiveView(state.activeView);
  await loadSettings();
  await restoreSession();
  await refreshInspectedPage();
  if (state.active && state.sessionId) await setContentSession(state.sessionId);
  render();
  registerNetworkListener();
  registerNavigationListener();
  void checkAiHealth({ silent: true, reason: 'panel-load' });
  aiHealthTimer = setInterval(() => {
    void checkAiHealth({ silent: true, reason: 'periodic' });
  }, AI_HEALTH_INTERVAL_MS);
  durationTimer = setInterval(renderSessionDuration, 1000);
  window.addEventListener('beforeunload', () => {
    if (durationTimer) clearInterval(durationTimer);
    if (aiHealthTimer) clearInterval(aiHealthTimer);
    if (autoUiScanTimer) clearTimeout(autoUiScanTimer);
  });
}

function bindEvents() {
  els.startBtn.addEventListener('click', startSession);
  els.stopBtn.addEventListener('click', stopSession);
  els.clearBtn.addEventListener('click', requestClearSession);
  els.uiScanBtn.addEventListener('click', runUiScan);
  if (menuToggleBtn && workspaceNav) {
    menuToggleBtn.addEventListener('click', toggleMenu);
  }
  if (menuCloseBtn) {
    menuCloseBtn.addEventListener('click', () => toggleMenu(false));
  }
  for (const button of tabButtons) {
    button.addEventListener('click', () => {
      setActiveView(button.dataset.tab);
      if (workspaceNav?.contains(button)) toggleMenu(false);
    });
    button.addEventListener('keydown', handleTabKeydown);
  }
  for (const button of shortcutTabButtons) {
    button.addEventListener('click', () => setActiveView(button.dataset.shortcutTab));
  }
  for (const button of aiModeButtons) {
    button.addEventListener('click', () => {
      state.ai.activeMode = button.dataset.aiMode || 'analysis';
      renderAiState();
      schedulePersist();
    });
  }
  for (const button of qaActionButtons) {
    button.addEventListener('click', () => handleQaMenuAction(button.dataset.qaAction));
  }
  for (const button of agentCommandButtons) {
    button.addEventListener('click', () => {
      setTestPilotChatMode('agent');
      setActiveView('ai');
      void submitAiChat(button.dataset.agentCommand || button.textContent || '');
    });
  }
  els.testPilotChatModeBtn.addEventListener('click', () => setTestPilotChatMode('chat'));
  els.testPilotAgentModeBtn.addEventListener('click', () => setTestPilotChatMode('agent'));
  els.aiChatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitAiChat(els.aiChatInput.value);
  });
  els.aiChatInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    if (!els.sendAiChatBtn.disabled) void submitAiChat(els.aiChatInput.value);
  });
  els.typeFilter.addEventListener('change', renderIssues);
  els.categoryFilter.addEventListener('change', renderIssues);
  els.severityFilter.addEventListener('change', renderIssues);
  els.searchInput.addEventListener('input', renderIssues);
  els.resetFiltersBtn.addEventListener('click', resetFilters);
  els.exportJsonBtn.addEventListener('click', exportJson);
  els.exportHtmlBtn.addEventListener('click', exportHtml);
  els.exportCsvBtn.addEventListener('click', exportCsv);
  els.copyReportBtn.addEventListener('click', copyBugReport);
  els.refreshReportBuilderBtn?.addEventListener('click', () => populateReportBuilderDraft({ force: true, notify: true }));
  els.copyReportBuilderBtn?.addEventListener('click', copyReportBuilderDraft);
  els.downloadReportBuilderBtn?.addEventListener('click', downloadReportBuilderDraft);
  for (const field of [
    els.reportBuilderTitle,
    els.reportBuilderSeverity,
    els.reportBuilderStatus,
    els.reportBuilderSummary,
    els.reportBuilderSteps,
    els.reportBuilderExpected,
    els.reportBuilderActual,
    els.reportBuilderEvidence
  ]) {
    field?.addEventListener('input', () => {
      reportBuilderDirty = true;
    });
    field?.addEventListener('change', () => {
      reportBuilderDirty = true;
    });
  }
  els.saveSettingsBtn.addEventListener('click', saveSettingsFromForm);
  els.resetSettingsBtn.addEventListener('click', resetSettingsToDefaults);
  els.viewPriorityBtn.addEventListener('click', focusPriorityFindings);
  els.viewAiBtn.addEventListener('click', () => setActiveView('ai'));
  els.viewReportsBtn.addEventListener('click', () => setActiveView('reports'));
  els.quickExportBtn.addEventListener('click', exportHtml);
  els.quickCopyBtn.addEventListener('click', copyBugReport);
  els.checkAiBtn.addEventListener('click', () => checkAiHealth({ silent: false, reason: 'manual' }));
  els.analyzeAiBtn?.addEventListener('click', () => runAiTask('analyze-session'));
  els.generateTestsBtn?.addEventListener('click', () => runAiTask('generate-test-cases'));
  els.generateBugsBtn?.addEventListener('click', () => runAiTask('generate-bug-report'));
  els.copyAiSummaryBtn?.addEventListener('click', copyAiSummary);
  els.downloadAiMarkdownBtn?.addEventListener('click', downloadAiMarkdown);
  els.downloadAiJsonBtn?.addEventListener('click', downloadAiJson);
  els.downloadAiMarkdownReportBtn.addEventListener('click', downloadAiMarkdown);
  els.downloadAiJsonReportBtn.addEventListener('click', downloadAiJson);
  els.aiProviderSelect?.addEventListener('change', handleAiProviderFormChange);
  els.aiModelModeSelect?.addEventListener('change', handleAiProviderFormChange);
  els.aiApiKeyInput?.addEventListener('input', () => {
    aiApiKeyTouched = true;
    updateAiProviderFormHelp();
  });
  els.aiBaseUrlInput?.addEventListener('input', updateAiProviderFormHelp);
  els.clearAiApiKeyBtn?.addEventListener('click', clearAiApiKey);
  els.testAiProviderBtn?.addEventListener('click', () => checkAiHealth({ silent: false, reason: 'manual-provider-test', force: true }));
  els.generateTestCasesTabBtn?.addEventListener('click', () => runAiTask('generate-test-cases', { source: 'test-cases-tab' }));
  els.copyTestCasesBtn?.addEventListener('click', copyTestCases);
  els.exportTestCasesMarkdownBtn?.addEventListener('click', exportTestCasesMarkdown);
  els.clearTestCasesBtn?.addEventListener('click', clearTestCases);
  els.testCaseTypeSelect?.addEventListener('change', renderTestCasesState);
  els.testCaseFormatSelect?.addEventListener('change', renderTestCasesState);
  els.generateBugReportTabBtn?.addEventListener('click', () => runAiTask('generate-bug-report', { source: 'bug-reports-tab' }));
  els.copyBugReportDraftsBtn?.addEventListener('click', copyBugReportDrafts);
  els.exportBugReportMarkdownBtn?.addEventListener('click', exportBugReportMarkdown);
  els.exportBugReportJsonBtn?.addEventListener('click', exportBugReportJson);
  els.clearBugReportsBtn?.addEventListener('click', clearBugReports);
}

function handleAiProviderFormChange() {
  state.settings.aiProvider = readAiProviderSettingsFromForm();
  aiApiKeyTouched = false;
  writeAiProviderSettingsToForm();
}

function updateAiProviderFormHelp() {
  const settings = readAiProviderSettingsFromForm();
  const defaults = AI_PROVIDER_DEFAULTS[settings.provider] || AI_PROVIDER_DEFAULTS['local-backend'];
  if (els.aiApiKeyHelp) {
    if (defaults.needsApiKey && !settings.apiKey) {
      els.aiApiKeyHelp.textContent = 'Required before this provider can be tested.';
    } else if (settings.apiKey) {
      els.aiApiKeyHelp.textContent = `Saved key will be masked as ${maskApiKey(settings.apiKey)}.`;
    } else {
      els.aiApiKeyHelp.textContent = 'Not required for this provider.';
    }
  }
  if (els.aiModelInput) els.aiModelInput.disabled = settings.modelMode !== 'custom';
}

function clearAiApiKey() {
  aiApiKeyTouched = true;
  if (els.aiApiKeyInput) {
    els.aiApiKeyInput.value = '';
    els.aiApiKeyInput.placeholder = 'API key cleared. Save settings to apply.';
  }
  state.settings.aiProvider = {
    ...normalizeAiProviderSettings(state.settings.aiProvider),
    apiKey: '',
    status: 'not_configured',
    lastError: 'API key cleared.'
  };
  renderAiProviderStatus();
  showToast('API key cleared locally. Save settings to persist.', 'success');
}

function handleTabKeydown(event) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const currentIndex = tabButtons.indexOf(event.currentTarget);
  let nextIndex = currentIndex;
  if (event.key === 'Home') nextIndex = 0;
  if (event.key === 'End') nextIndex = tabButtons.length - 1;
  if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabButtons.length;
  if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabButtons.length) % tabButtons.length;
  const next = tabButtons[nextIndex];
  if (!next) return;
  setActiveView(next.dataset.tab);
  if (typeof next.focus === 'function') next.focus();
}

function handlePortMessage(message) {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'TESTPILOT_CONTENT_EVENT') {
    handleContentEvent(message.payload);
  }
}

async function loadSettings() {
  const stored = await chrome.storage.local.get('testpilotSettings');
  state.settings = normalizeSettings({ ...DEFAULT_SETTINGS, ...(stored.testpilotSettings || {}) });
  writeSettingsToForm();
}

function normalizeSettings(settings) {
  const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  merged.aiProvider = normalizeAiProviderSettings(merged.aiProvider || {
    provider: 'local-backend',
    baseUrl: merged.aiBackendUrl || DEFAULT_SETTINGS.aiBackendUrl
  });
  merged.aiBackendUrl = getAiProviderBaseUrl(merged.aiProvider);
  return merged;
}

function normalizeAiProviderSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  const provider = AI_PROVIDER_DEFAULTS[source.provider] ? source.provider : 'local-backend';
  const defaults = AI_PROVIDER_DEFAULTS[provider];
  const modelMode = source.modelMode === 'custom' ? 'custom' : 'auto';
  const baseUrl = String(source.baseUrl || defaults.baseUrl || '').trim();
  const maxTokens = clampNumber(source.maxTokens, 32, 12000, DEFAULT_AI_PROVIDER_SETTINGS.maxTokens);
  const temperature = clampNumber(source.temperature, 0, 2, DEFAULT_AI_PROVIDER_SETTINGS.temperature);
  return {
    ...DEFAULT_AI_PROVIDER_SETTINGS,
    provider,
    apiKey: String(source.apiKey || ''),
    baseUrl,
    modelMode,
    model: modelMode === 'custom' ? String(source.model || '').trim() : '',
    temperature,
    maxTokens,
    status: normalizeProviderStatus(source.status),
    lastCheckedAt: Number(source.lastCheckedAt || 0) || null,
    lastError: String(source.lastError || ''),
    usage: source.usage && typeof source.usage === 'object' ? source.usage : null
  };
}

function normalizeProviderStatus(status) {
  return ['live', 'checking', 'offline', 'model_error', 'not_configured'].includes(status)
    ? status
    : 'not_configured';
}

function writeSettingsToForm() {
  els.slowApiMs.value = String(state.settings.slowApiMs);
  els.verySlowApiMs.value = String(state.settings.verySlowApiMs);
  els.duplicateWindowMs.value = String(state.settings.duplicateWindowMs);
  els.maxBodyPreviewBytes.value = String(state.settings.maxBodyPreviewBytes);
  els.maxUiNodes.value = String(state.settings.maxUiNodes);
  els.maxIssuesPerRule.value = String(state.settings.maxIssuesPerRule);
  els.captureResponseBody.checked = Boolean(state.settings.captureResponseBody);
  els.hideFrameworkNoise.checked = Boolean(state.settings.hideFrameworkNoise);
  els.showNextPrefetchFindings.checked = Boolean(state.settings.showNextPrefetchFindings);
  els.treatFrameworkPrefetchAsIssue.checked = Boolean(state.settings.treatFrameworkPrefetchAsIssue);
  els.uiVisibleViewportOnly.checked = Boolean(state.settings.uiVisibleViewportOnly);
  els.uiIncludeDecorativeElements.checked = Boolean(state.settings.uiIncludeDecorativeElements);
  els.exportFrameworkNoise.checked = Boolean(state.settings.exportFrameworkNoise);
  els.csvExportEnabled.checked = Boolean(state.settings.csvExportEnabled);
  if (els.aiBackendUrl) els.aiBackendUrl.value = String(state.settings.aiBackendUrl || DEFAULT_SETTINGS.aiBackendUrl);
  if (els.includeAiSummaryInReport) els.includeAiSummaryInReport.checked = Boolean(state.settings.includeAiSummaryInReport);
  writeAiProviderSettingsToForm();
  els.allowedColors.value = (state.settings.allowedColors || []).join('\n');
}

function writeAiProviderSettingsToForm() {
  const settings = normalizeAiProviderSettings(state.settings.aiProvider);
  state.settings.aiProvider = settings;
  const defaults = AI_PROVIDER_DEFAULTS[settings.provider] || AI_PROVIDER_DEFAULTS['local-backend'];
  if (els.aiProviderSelect) els.aiProviderSelect.value = settings.provider;
  if (els.aiApiKeyInput) {
    els.aiApiKeyInput.value = '';
    els.aiApiKeyInput.placeholder = settings.apiKey
      ? maskApiKey(settings.apiKey)
      : (defaults.needsApiKey ? 'Paste provider API key' : 'No API key required');
  }
  if (els.aiApiKeyHelp) {
    els.aiApiKeyHelp.textContent = defaults.needsApiKey
      ? 'Required for this hosted provider. Stored only in Chrome local storage.'
      : 'Not required for this provider.';
  }
  if (els.aiBaseUrlInput) els.aiBaseUrlInput.value = settings.baseUrl || defaults.baseUrl || '';
  if (els.aiModelModeSelect) els.aiModelModeSelect.value = settings.modelMode || 'auto';
  if (els.aiModelInput) {
    els.aiModelInput.value = settings.model || '';
    els.aiModelInput.placeholder = defaults.recommendedModel
      ? `Auto / Recommended: ${defaults.recommendedModel}`
      : 'Auto / Recommended';
    els.aiModelInput.disabled = settings.modelMode !== 'custom';
  }
  if (els.aiContextModeSelect) els.aiContextModeSelect.value = ['fast', 'balanced', 'deep'].includes(state.settings.aiContextMode) ? state.settings.aiContextMode : 'fast';
  if (els.aiTemperatureInput) els.aiTemperatureInput.value = String(settings.temperature ?? DEFAULT_AI_PROVIDER_SETTINGS.temperature);
  if (els.aiMaxTokensInput) els.aiMaxTokensInput.value = String(settings.maxTokens ?? DEFAULT_AI_PROVIDER_SETTINGS.maxTokens);
  renderAiProviderStatus();
}

function maskApiKey(value) {
  const text = String(value || '');
  if (!text) return '';
  const tail = text.slice(-4);
  const prefix = (text.split(/[-_]/)[0] || text.slice(0, 3)).slice(0, 8);
  return `${prefix || 'key'}-${'•'.repeat(8)}${tail}`;
}

async function saveSettingsFromForm() {
  const settings = readSettingsFromForm();
  state.settings = normalizeSettings(settings);
  await chrome.storage.local.set({ testpilotSettings: state.settings });
  aiApiKeyTouched = false;
  writeSettingsToForm();
  setTemporaryText(els.saveSettingsBtn, 'Saved');
  showToast('Settings saved locally.', 'success');
  void checkAiHealth({ silent: true, reason: 'settings-saved', force: true });
  render();
}

async function resetSettingsToDefaults() {
  state.settings = normalizeSettings({ ...DEFAULT_SETTINGS });
  aiApiKeyTouched = false;
  writeSettingsToForm();
  await chrome.storage.local.set({ testpilotSettings: state.settings });
  showToast('Default settings restored.', 'success');
  render();
}

function readSettingsFromForm() {
  const aiProvider = readAiProviderSettingsFromForm();
  return {
    ...DEFAULT_SETTINGS,
    ...state.settings,
    slowApiMs: numberOrDefault(els.slowApiMs.value, DEFAULT_SETTINGS.slowApiMs),
    verySlowApiMs: numberOrDefault(els.verySlowApiMs.value, DEFAULT_SETTINGS.verySlowApiMs),
    duplicateWindowMs: numberOrDefault(els.duplicateWindowMs.value, DEFAULT_SETTINGS.duplicateWindowMs),
    maxBodyPreviewBytes: clampNumber(els.maxBodyPreviewBytes.value, 1000, 20000, DEFAULT_SETTINGS.maxBodyPreviewBytes),
    maxUiNodes: clampNumber(els.maxUiNodes.value, 500, 10000, DEFAULT_SETTINGS.maxUiNodes),
    maxIssuesPerRule: numberOrDefault(els.maxIssuesPerRule.value, DEFAULT_SETTINGS.maxIssuesPerRule),
    captureResponseBody: Boolean(els.captureResponseBody.checked),
    hideFrameworkNoise: Boolean(els.hideFrameworkNoise.checked),
    showNextPrefetchFindings: Boolean(els.showNextPrefetchFindings.checked),
    treatFrameworkPrefetchAsIssue: Boolean(els.treatFrameworkPrefetchAsIssue.checked),
    uiVisibleViewportOnly: Boolean(els.uiVisibleViewportOnly.checked),
    uiIncludeDecorativeElements: Boolean(els.uiIncludeDecorativeElements.checked),
    exportFrameworkNoise: Boolean(els.exportFrameworkNoise.checked),
    csvExportEnabled: Boolean(els.csvExportEnabled.checked),
    aiProvider,
    aiContextMode: ['fast', 'balanced', 'deep'].includes(els.aiContextModeSelect?.value)
      ? els.aiContextModeSelect.value
      : 'fast',
    aiBackendUrl: getAiProviderBaseUrl(aiProvider),
    includeAiSummaryInReport: els.includeAiSummaryInReport
      ? Boolean(els.includeAiSummaryInReport.checked)
      : Boolean(state.settings.includeAiSummaryInReport),
    allowedColors: els.allowedColors.value
      .split(/\n|,/) 
      .map((item) => item.trim())
      .filter(Boolean)
  };
}

function readAiProviderSettingsFromForm() {
  const previous = normalizeAiProviderSettings(state.settings.aiProvider);
  const provider = AI_PROVIDER_DEFAULTS[els.aiProviderSelect?.value]
    ? els.aiProviderSelect.value
    : previous.provider;
  const defaults = AI_PROVIDER_DEFAULTS[provider] || AI_PROVIDER_DEFAULTS['local-backend'];
  const rawApiKey = String(els.aiApiKeyInput?.value || '').trim();
  const apiKey = aiApiKeyTouched ? rawApiKey : previous.apiKey;
  const modelMode = els.aiModelModeSelect?.value === 'custom' ? 'custom' : 'auto';
  return normalizeAiProviderSettings({
    ...previous,
    provider,
    apiKey,
    baseUrl: String(els.aiBaseUrlInput?.value || defaults.baseUrl || '').trim(),
    modelMode,
    model: modelMode === 'custom' ? String(els.aiModelInput?.value || '').trim() : '',
    temperature: els.aiTemperatureInput?.value,
    maxTokens: els.aiMaxTokensInput?.value,
    status: previous.provider === provider ? previous.status : 'not_configured',
    lastCheckedAt: previous.provider === provider ? previous.lastCheckedAt : null,
    lastError: previous.provider === provider ? previous.lastError : '',
    usage: previous.provider === provider ? previous.usage : null
  });
}

function getAiProviderBaseUrl(settings = state.settings.aiProvider) {
  const providerSettings = normalizeAiProviderSettings(settings);
  const defaults = AI_PROVIDER_DEFAULTS[providerSettings.provider] || AI_PROVIDER_DEFAULTS['local-backend'];
  return normalizeBackendUrl(providerSettings.baseUrl || defaults.baseUrl || DEFAULT_SETTINGS.aiBackendUrl);
}

function setActiveView(view) {
  const allowed = ['dashboard', 'findings', 'console', 'ui', 'ai', 'test-cases', 'bug-reports', 'reports', 'settings'];
  state.activeView = allowed.includes(view) ? view : 'ai';
  if (document.body && document.body.dataset) document.body.dataset.activeView = state.activeView;
  applyActiveViewVisibility();
  updateTestPilotCurrentView();
  for (const button of tabButtons) {
    const isActive = button.dataset.tab === state.activeView;
    button.classList.toggle('active', isActive);
    if (typeof button.setAttribute === 'function') {
      button.setAttribute('aria-selected', String(isActive));
      button.setAttribute('tabindex', isActive ? '0' : '-1');
    }
  }
  for (const button of shortcutTabButtons) {
    button.classList.toggle('active', button.dataset.shortcutTab === state.activeView);
  }

  toggleMenu(false);

  if (state.activeView === 'findings' && state.settings.hideFrameworkNoise) {
    els.categoryFilter.value = 'counted';
    els.typeFilter.value = 'all';
  } else if (state.activeView === 'ui') {
    els.categoryFilter.value = 'all';
    els.typeFilter.value = 'ui';
  } else if (state.activeView === 'dashboard') {
    els.categoryFilter.value = 'counted';
    els.typeFilter.value = 'all';
  }
  render();
}

function applyActiveViewVisibility() {
  if (typeof document.querySelectorAll !== 'function') return;
  const visibleClasses = new Set(viewVisibilityRules[state.activeView] || viewVisibilityRules.ai);
  for (const className of viewScopedClasses) {
    const shouldShow = visibleClasses.has(className);
    for (const element of document.querySelectorAll(`.${className}`)) {
      if (shouldShow) {
        element.removeAttribute('hidden');
      } else {
        element.setAttribute('hidden', '');
      }
    }
  }

  if (state.activeView === 'ui') {
    for (const selector of ['.page-heading.findings-only', '.api-breakdown.findings-only', '.info-callout.findings-only']) {
      for (const element of document.querySelectorAll(selector)) element.setAttribute('hidden', '');
    }
  }
}

function updateTestPilotCurrentView() {
  if (!els.testPilotCurrentView) return;
  const labels = {
    ai: 'Main Chat',
    dashboard: 'Dashboard',
    findings: 'Network / Findings',
    console: 'Console',
    ui: 'UI Bugs',
    'test-cases': 'Test Cases',
    'bug-reports': 'Bug Reports',
    reports: 'Reports',
    settings: 'Settings'
  };
  const label = labels[state.activeView] || 'Main Chat';
  if (typeof els.testPilotCurrentView.setAttribute === 'function') {
    els.testPilotCurrentView.setAttribute('aria-label', label);
  }
  if (els.testPilotCurrentView.dataset) {
    els.testPilotCurrentView.dataset.currentView = state.activeView;
  } else {
    els.testPilotCurrentView.textContent = label;
  }
}

function resetFilters() {
  els.typeFilter.value = 'all';
  els.categoryFilter.value = 'counted';
  els.severityFilter.value = 'all';
  els.searchInput.value = '';
  renderIssues();
  showToast('Finding filters reset.', 'success');
}

function toggleMenu() {
  if (!workspaceNav || !menuToggleBtn) return;
  const shouldOpen = arguments.length ? Boolean(arguments[0]) : !workspaceNav.classList.contains('open');
  workspaceNav.classList.toggle('open', shouldOpen);
  if (typeof menuToggleBtn.setAttribute === 'function') {
    menuToggleBtn.setAttribute('aria-expanded', String(shouldOpen));
  }
  if (menuToggleBtn.classList && typeof menuToggleBtn.classList.toggle === 'function') {
    menuToggleBtn.classList.toggle('active', shouldOpen);
  }
}

function setTestPilotChatMode(mode) {
  const activeMode = mode === 'agent' ? 'agent' : 'chat';
  const previousMode = document.body?.dataset?.testpilotMode || 'chat';
  if (document.body && document.body.dataset) document.body.dataset.testpilotMode = activeMode;
  els.testPilotChatModeBtn.classList.toggle('active', activeMode === 'chat');
  els.testPilotAgentModeBtn.classList.toggle('active', activeMode === 'agent');
  els.aiChatInput.placeholder = activeMode === 'agent'
    ? 'Tell the agent exactly what to test on this page...'
    : 'Ask about this QA session...';
  if (previousMode !== activeMode) {
    addChatModeSeparator(activeMode);
  }
  void checkAiHealth({ silent: true, reason: `${activeMode}-mode` });
}

function addChatModeSeparator(mode) {
  state.ai.chatMessages = Array.isArray(state.ai.chatMessages) ? state.ai.chatMessages : [];
  state.ai.chatMessages.push({
    role: 'system',
    type: 'separator',
    text: mode === 'agent'
      ? 'Switched to Agent mode. TestPilot can inspect the page, take safe actions, and report evidence.'
      : 'Switched to Chat mode. Ask questions about the current QA session and captured evidence.',
    timestamp: Date.now()
  });
  state.ai.chatMessages = state.ai.chatMessages.slice(-24);
  schedulePersist();
  renderAiChatMessages();
}

function scheduleAutoUiScan(reason) {
  if (!state.active || uiScanInProgress) return;
  const now = Date.now();
  if (now - lastAutoUiScanAt < AUTO_UI_SCAN_COOLDOWN_MS) return;
  lastAutoUiScanAt = now;
  if (autoUiScanTimer) clearTimeout(autoUiScanTimer);
  els.uiStatus.textContent = 'Auto scan queued';
  autoUiScanTimer = setTimeout(() => {
    autoUiScanTimer = null;
    void runUiScan({ automatic: true, reason });
  }, 900);
}

async function handleQaMenuAction(action) {
  toggleMenu(false);
  if (action === 'generate-test-cases') {
    setActiveView('test-cases');
    await runAiTask('generate-test-cases', { source: 'test-cases-menu' });
    return;
  }
  if (action === 'generate-bug-report') {
    setActiveView('bug-reports');
    await runAiTask('generate-bug-report', { source: 'bug-reports-menu' });
    return;
  }
  if (action === 'accessibility') {
    setActiveView('ui');
    await runUiScan();
  }
}

function focusPriorityFindings() {
  setActiveView('findings');
  resetFilters();
  if (els.findingsPanel && typeof els.findingsPanel.scrollIntoView === 'function') {
    els.findingsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function numberOrDefault(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeBackendUrl(value) {
  const text = String(value || '').trim().replace(/\/+$/, '');
  return text || DEFAULT_SETTINGS.aiBackendUrl;
}

function createEmptyNetworkStats() {
  return {
    total: 0,
    api: 0,
    framework: 0,
    static: 0,
    documents: 0,
    passed: 0,
    failed: 0,
    slow: 0
  };
}

async function restoreSession() {
  try {
    const stored = await chrome.storage.session.get(SESSION_STORAGE_KEY);
    const saved = stored[SESSION_STORAGE_KEY];
    if (!saved || typeof saved !== 'object') return;

    Object.assign(state, {
      sessionId: saved.sessionId || null,
      active: Boolean(saved.active),
      startedAt: saved.startedAt || null,
      endedAt: saved.endedAt || null,
      pageUrl: typeof saved.pageUrl === 'string' ? saved.pageUrl : '',
      capturedUrls: Array.isArray(saved.capturedUrls) ? saved.capturedUrls : [],
      timeline: Array.isArray(saved.timeline) ? saved.timeline : [],
      reloadObserved: Boolean(saved.reloadObserved),
      lastUpdatedAt: saved.lastUpdatedAt || null,
      unsupportedReason: typeof saved.unsupportedReason === 'string' ? saved.unsupportedReason : ''
    });
    state.settings = normalizeSettings({ ...DEFAULT_SETTINGS, ...(saved.settings || state.settings || {}) });
    state.capabilities = { network: true, console: false, ui: false, ...(saved.capabilities || {}) };
    state.environment = { userAgent: '', viewport: { width: 0, height: 0 }, ...(saved.environment || {}) };
    state.uiStats = {
      scans: 0,
      scannedElements: 0,
      skippedElements: 0,
      ignoredDecorativeElements: 0,
      hitNodeLimit: false,
      lastDurationMs: null,
      lastScannedElements: 0,
      lastSkippedElements: 0,
      lastIgnoredDecorativeElements: 0,
      lastCompletedAt: null,
      ...(saved.uiStats || {})
    };
    const savedNetworkStats = saved.networkStats && typeof saved.networkStats === 'object'
      ? saved.networkStats
      : {};
    state.networkStats = { ...createEmptyNetworkStats(), ...savedNetworkStats };
    state.droppedIssues = { api: 0, console: 0, ui: 0, ...(saved.droppedIssues || {}) };
    state.ai = { ...state.ai, ...(saved.ai || {}) };
    if (!Array.isArray(state.ai.log) || state.ai.log.length === 0) {
      state.ai.log = ['Backend not checked yet. Start ai-backend with npm start, then click Check AI.'];
    }
    state.issues = consolidateStoredFindings(Array.isArray(saved.issues) ? saved.issues.map(migrateStoredIssue) : []);
    if (!Object.prototype.hasOwnProperty.call(savedNetworkStats, 'framework')) {
      const migratedFrameworkRequests = state.issues
        .filter((issue) => issue.evidence && issue.evidence.category === 'framework-prefetch')
        .reduce((total, issue) => total + Number(issue.count || 1), 0);
      state.networkStats.framework = migratedFrameworkRequests;
      state.networkStats.api = Math.max(0, state.networkStats.api - migratedFrameworkRequests);
    }
    state.duplicateCache = new Map();
  } catch (error) {
    console.warn('[TestPilot] Session restore failed', error);
  }
}

async function refreshInspectedPage() {
  try {
    const page = await evaluateInInspectedPage(`(() => ({
      url: location.href,
      userAgent: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight }
    }))()`);
    state.pageUrl = page.url || state.pageUrl;
    state.environment = {
      userAgent: page.userAgent || '',
      viewport: page.viewport || { width: 0, height: 0 }
    };
    state.unsupportedReason = getUnsupportedReason(state.pageUrl);

    if (state.unsupportedReason) {
      state.capabilities.console = false;
      state.capabilities.ui = false;
    } else {
      const contentAvailable = await isContentScriptAvailable();
      state.capabilities.console = contentAvailable;
      state.capabilities.ui = contentAvailable;
    }
  } catch (error) {
    state.unsupportedReason = 'The inspected page metadata is unavailable. Reload the page and reopen DevTools.';
  }
}

async function isContentScriptAvailable() {
  const result = await sendTabMessage({ type: 'TESTPILOT_PING_CONTENT' });
  return Boolean(result.ok && result.response && result.response.ok);
}

function evaluateInInspectedPage(expression) {
  return new Promise((resolve, reject) => {
    chrome.devtools.inspectedWindow.eval(expression, (result, exceptionInfo) => {
      if (exceptionInfo && exceptionInfo.isException) {
        reject(new Error(exceptionInfo.description || exceptionInfo.value || 'Inspected page evaluation failed.'));
        return;
      }
      resolve(result || {});
    });
  });
}

function getUnsupportedReason(url) {
  const value = String(url || '').toLowerCase();
  if (/^(chrome|edge|about|devtools|view-source):/.test(value)) {
    return 'Chrome internal and browser-managed pages cannot be inspected by extensions.';
  }
  if (value.startsWith('https://chromewebstore.google.com/') || value.startsWith('https://chrome.google.com/webstore/')) {
    return 'Chrome blocks extensions from inspecting Chrome Web Store pages.';
  }
  return '';
}

async function startSession() {
  await refreshInspectedPage();
  if (state.unsupportedReason) {
    render();
    showToast(state.unsupportedReason, 'error');
    return;
  }

  state.sessionId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
  state.active = true;
  state.startedAt = Date.now();
  state.endedAt = null;
  state.capturedUrls = state.pageUrl ? [state.pageUrl] : [];
  state.timeline = [{
    type: 'session-started',
    timestamp: state.startedAt,
    pageUrl: state.pageUrl
  }];
  state.reloadObserved = false;
  state.lastUpdatedAt = state.startedAt;
  state.uiStats = {
    scans: 0,
    scannedElements: 0,
    skippedElements: 0,
    ignoredDecorativeElements: 0,
    hitNodeLimit: false,
    lastDurationMs: null,
    lastScannedElements: 0,
    lastSkippedElements: 0,
    lastIgnoredDecorativeElements: 0,
    lastCompletedAt: null
  };
  state.droppedIssues = { api: 0, console: 0, ui: 0 };
  state.issues = [];
  state.networkStats = createEmptyNetworkStats();
  state.duplicateCache = new Map();
  recentEvidenceEvents = [];
  lastAutoUiScanAt = 0;
  state.ai = {
    status: 'not-configured',
    lastCheckedAt: null,
    analysis: null,
    lastTask: '',
    activeMode: 'analysis',
    error: '',
    log: ['New QA session started. AI is optional; click Check AI before analysis.']
  };
  state.settings = readSettingsFromForm();
  await chrome.storage.local.set({ testpilotSettings: state.settings });
  await setContentSession(state.sessionId);
  await persistSession();
  render();
  showToast('Session started. Reload the inspected page for complete capture.', 'success');
  scheduleAutoUiScan('session start');
}

function stopSession() {
  state.active = false;
  state.endedAt = Date.now();
  state.lastUpdatedAt = state.endedAt;
  state.timeline.push({ type: 'session-stopped', timestamp: state.endedAt, pageUrl: state.pageUrl });
  void setContentSession(null);
  schedulePersist();
  render();
  showToast('Session stopped. Results are ready to review or export.', 'success');
}

function requestClearSession() {
  if (!state.startedAt && state.issues.length === 0) {
    showToast('There is no session data to clear.');
    return;
  }

  if (clearConfirmationArmed) {
    clearConfirmationArmed = false;
    if (clearConfirmationTimer) clearTimeout(clearConfirmationTimer);
    els.clearBtn.textContent = 'Clear';
    void clearSession();
    return;
  }

  clearConfirmationArmed = true;
  els.clearBtn.textContent = 'Confirm Clear';
  showToast('Click Confirm Clear to remove this temporary session.');
  clearConfirmationTimer = setTimeout(() => {
    clearConfirmationArmed = false;
    els.clearBtn.textContent = 'Clear';
  }, 3500);
}

async function clearSession() {
  state.sessionId = null;
  state.active = false;
  state.startedAt = null;
  state.endedAt = null;
  state.capturedUrls = state.pageUrl ? [state.pageUrl] : [];
  state.timeline = [];
  state.reloadObserved = false;
  state.lastUpdatedAt = null;
  state.uiStats = {
    scans: 0,
    scannedElements: 0,
    skippedElements: 0,
    ignoredDecorativeElements: 0,
    hitNodeLimit: false,
    lastDurationMs: null,
    lastScannedElements: 0,
    lastSkippedElements: 0,
    lastIgnoredDecorativeElements: 0,
    lastCompletedAt: null
  };
  state.droppedIssues = { api: 0, console: 0, ui: 0 };
  state.issues = [];
  state.networkStats = createEmptyNetworkStats();
  state.duplicateCache = new Map();
  recentEvidenceEvents = [];
  await setContentSession(null);
  await chrome.storage.session.remove(SESSION_STORAGE_KEY);
  render();
  showToast('Temporary session cleared.', 'success');
}

function schedulePersist() {
  if (!state.sessionId) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(persistSession, 150);
}

async function setContentSession(sessionId) {
  await sendTabMessage({
    type: 'TESTPILOT_SET_SESSION',
    sessionId
  });
}

function sendTabMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(inspectedTabId, message, (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          resolve({
            ok: false,
            response: null,
            error: runtimeError.message || 'The inspected page content script is unavailable.'
          });
          return;
        }
        resolve({ ok: true, response, error: null });
      });
    } catch (error) {
      resolve({
        ok: false,
        response: null,
        error: error && error.message ? error.message : 'The inspected page content script is unavailable.'
      });
    }
  });
}

async function persistSession() {
  persistTimer = null;
  if (!state.sessionId) return;

  try {
    const serializable = buildSessionSnapshot();
    await chrome.storage.session.set({ [SESSION_STORAGE_KEY]: serializable });
  } catch (error) {
    console.warn('[TestPilot] Session persistence failed:', error && error.message ? error.message : error);
  }
}

function buildSessionSnapshot() {
  return sanitizeForStorage({
    sessionId: state.sessionId,
    active: state.active,
    startedAt: state.startedAt,
    endedAt: state.endedAt,
    pageUrl: state.pageUrl,
    capturedUrls: boundedArray(state.capturedUrls, MAX_PERSISTED_URLS),
    timeline: boundedArray(state.timeline, MAX_PERSISTED_TIMELINE_EVENTS),
    reloadObserved: state.reloadObserved,
    lastUpdatedAt: state.lastUpdatedAt,
    unsupportedReason: state.unsupportedReason,
    capabilities: state.capabilities,
    environment: state.environment,
    uiStats: state.uiStats,
    droppedIssues: state.droppedIssues,
    issues: boundedArray(state.issues, MAX_PERSISTED_ISSUES).map(compactIssueForStorage),
    networkStats: state.networkStats,
    ai: compactAiStateForStorage(state.ai)
  });
}

function compactIssueForStorage(issue) {
  if (!issue || typeof issue !== 'object') return null;
  return {
    type: issue.type,
    category: issue.category,
    severity: issue.severity,
    confidence: issue.confidence,
    title: issue.title,
    description: issue.description,
    userImpact: issue.userImpact,
    recommendation: issue.recommendation,
    includeInIssueCount: issue.includeInIssueCount,
    includeInReport: issue.includeInReport,
    reviewStatus: issue.reviewStatus || 'auto',
    reviewedAt: issue.reviewedAt || null,
    evidence: compactStorageValue(issue.evidence, 0),
    url: issue.url,
    timestamp: issue.timestamp,
    duplicateKey: issue.duplicateKey,
    count: issue.count,
    firstSeenAt: issue.firstSeenAt,
    lastSeenAt: issue.lastSeenAt
  };
}

function compactAiStateForStorage(ai) {
  const safeAi = ai && typeof ai === 'object' ? ai : {};
  return {
    status: safeAi.status || 'not-configured',
    lastCheckedAt: safeAi.lastCheckedAt || null,
    analysis: compactStorageValue(safeAi.analysis, 0),
    lastTask: safeAi.lastTask || '',
    activeMode: normalizeAiMode(safeAi.activeMode),
    chatMessages: boundedArray(safeAi.chatMessages, 20).map((message) => ({
      role: ['user', 'assistant', 'system'].includes(message && message.role) ? message.role : 'assistant',
      type: message && message.type === 'separator' ? 'separator' : undefined,
      text: String(message && message.text ? message.text : '').slice(0, MAX_STORAGE_STRING_LENGTH),
      timestamp: message && message.timestamp ? message.timestamp : Date.now(),
      streaming: false
    })),
    lastAgentResult: compactStorageValue(safeAi.lastAgentResult, 0),
    error: safeAi.error || '',
    log: boundedArray(safeAi.log, MAX_PERSISTED_AI_LOGS)
  };
}

function boundedArray(value, limit) {
  if (!Array.isArray(value)) return [];
  return value.slice(Math.max(0, value.length - limit));
}

function sanitizeForStorage(value) {
  return JSON.parse(JSON.stringify(compactStorageValue(value, 0)));
}

function compactStorageValue(value, depth, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactText(value, MAX_STORAGE_STRING_LENGTH);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'symbol' || typeof value === 'function') return String(value);
  if (depth > 5) return '[Object]';
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, 40).map((item) => compactStorageValue(item, depth + 1, seen));
  }

  const output = {};
  for (const [key, item] of Object.entries(value).slice(0, 40)) {
    if (isSensitiveKey(key)) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = compactStorageValue(item, depth + 1, seen);
    }
  }
  return output;
}

function registerNetworkListener() {
  chrome.devtools.network.onRequestFinished.addListener((entry) => {
    if (!state.active) return;
    processNetworkEntry(entry);
  });
}

function registerNavigationListener() {
  chrome.devtools.network.onNavigated.addListener((url) => {
    const previousUrl = state.pageUrl;
    state.pageUrl = url || state.pageUrl;
    state.unsupportedReason = getUnsupportedReason(state.pageUrl);
    if (!state.active) {
      render();
      return;
    }

    state.reloadObserved = true;
    state.lastUpdatedAt = Date.now();
    if (state.pageUrl && !state.capturedUrls.includes(state.pageUrl)) {
      state.capturedUrls.push(state.pageUrl);
    }
    state.timeline.push({
      type: previousUrl === state.pageUrl ? 'page-reloaded' : 'route-changed',
      timestamp: state.lastUpdatedAt,
      from: previousUrl,
      pageUrl: state.pageUrl
    });
    schedulePersist();
    render();
    setTimeout(async () => {
      await refreshInspectedPage();
      if (state.active && state.sessionId) await setContentSession(state.sessionId);
      render();
      scheduleAutoUiScan('page navigation');
    }, 500);
  });
}

function recordRecentEvidenceEvent(event) {
  if (!state.active || !event || typeof event !== 'object') return;
  const normalized = {
    type: event.type || 'event',
    timestamp: Number(event.timestamp || Date.now()),
    title: redactText(String(event.title || 'TestPilot evidence'), 180),
    summary: redactText(String(event.summary || ''), 500),
    severity: event.severity || 'info',
    url: event.url ? redactUrl(event.url) : '',
    evidence: compactStorageValue(redactObject(event.evidence || {}), 0)
  };
  recentEvidenceEvents.push(normalized);
  recentEvidenceEvents = recentEvidenceEvents
    .filter((item) => item.timestamp >= Date.now() - 10 * 60 * 1000)
    .slice(-MAX_RECENT_EVIDENCE_EVENTS);
}

function processNetworkEntry(entry) {
  state.networkStats.total += 1;
  state.lastUpdatedAt = Date.now();

  const request = entry.request || {};
  const response = entry.response || {};
  const method = request.method || 'GET';
  const url = request.url || '';
  const status = Number(response.status || 0);
  const mimeType = response.content && response.content.mimeType ? response.content.mimeType : '';
  const resourceType = entry._resourceType || entry.resourceType || '';
  const durationMs = Math.round(Number(entry.time || 0));
  const frameworkPrefetch = getFrameworkPrefetch(request, url);
  const requestClass = classifyNetworkRequest({ url, method, mimeType, resourceType, request, response, frameworkPrefetch });

  if (requestClass === 'framework') {
    state.networkStats.framework += 1;
    if (status >= 400) {
      state.networkStats.failed += 1;
      const treatAsIssue = Boolean(state.settings.treatFrameworkPrefetchAsIssue);
      addIssue({
        type: 'api',
        category: treatAsIssue ? 'needs-review' : 'framework-noise',
        severity: treatAsIssue ? 'medium' : 'info',
        confidence: 'high',
        title: 'Next.js route prefetch errors detected for 1 route',
        description: 'Speculative Next.js route-data requests failed. No user-facing navigation failure was confirmed.',
        userImpact: 'No confirmed user-facing impact. Client-side navigation may fall back to a full page load or become slower.',
        recommendation: 'Investigate only if clicking links is broken, visibly slow, or produces a document or console failure.',
        includeInIssueCount: treatAsIssue,
        includeInReport: true,
        evidence: {
          method,
          url: redactUrl(url),
          pageUrl: state.pageUrl,
          status,
          statusText: response.statusText || '',
          durationMs,
          resourceType,
          category: 'framework-prefetch',
          framework: frameworkPrefetch.framework,
          logicalRoute: frameworkPrefetch.route,
          routes: [frameworkPrefetch.route],
          routeCount: 1,
          speculative: true
        }
      });
    } else {
      state.networkStats.passed += 1;
    }
    schedulePersist();
    render();
    return;
  }

  if (requestClass !== 'api') {
    state.networkStats[requestClass] += 1;
    if (status >= 400 || status === 0) {
      state.networkStats.failed += 1;
      if (requestClass === 'documents' && String(resourceType).toLowerCase() === 'document') {
        const route = normalizeDocumentRoute(url);
        const promoted = promoteFrameworkFindingForRoute(route, status);
        if (!promoted) {
          addIssue({
            type: 'api',
            category: 'actionable',
            severity: status >= 500 ? 'critical' : 'high',
            confidence: 'high',
            title: `Page navigation failed: ${route} returned ${status || 'a network error'}`,
            description: 'A top-level document navigation failed, confirming a user-facing route problem.',
            userImpact: 'Users may be unable to open the requested page.',
            recommendation: 'Fix the route, deployment rewrite, or server response and verify direct and client-side navigation.',
            evidence: {
              category: 'document-navigation',
              method,
              url: redactUrl(url),
              pageUrl: state.pageUrl,
              logicalRoute: route,
              status,
              statusText: response.statusText || '',
              resourceType
            }
          });
        }
      }
    } else state.networkStats.passed += 1;
    schedulePersist();
    render();
    return;
  }
  state.networkStats.api += 1;

  const contentType = getHeaderValue(response.headers || [], 'content-type');
  const contentLength = Number(getHeaderValue(response.headers || [], 'content-length') || response.content?.size || 0);
  const binaryResponse = isBinaryResponse(mimeType || contentType);
  let bodyStatus = state.settings.captureResponseBody ? 'Unavailable' : 'Capture Disabled';
  if (binaryResponse) bodyStatus = 'Skipped Binary';
  if (contentLength > state.settings.maxBodyPreviewBytes) bodyStatus = 'Skipped Too Large';

  const baseEvidence = {
    method,
    url: redactUrl(url),
    pageUrl: state.pageUrl,
    status,
    statusText: response.statusText || '',
    durationMs,
    resourceType,
    requestHeaders: redactHeaders(request.headers || []),
    responseHeaders: redactHeaders(response.headers || []),
    mimeType,
    contentLength,
    bodyStatus,
    requestBody: redactText(request.postData && request.postData.text ? request.postData.text : '')
  };

  recordRecentEvidenceEvent({
    type: 'api',
    timestamp: Date.now(),
    title: `${method} ${shortUrlPath(url)} ${status || 'no status'}`,
    summary: `${method} ${shortUrlPath(url)} returned ${status || 'no HTTP status'} in ${durationMs}ms`,
    severity: status >= 500 ? 'critical' : (status >= 400 || status === 0 ? 'high' : (durationMs >= state.settings.slowApiMs ? 'medium' : 'info')),
    url,
    evidence: {
      method,
      url: redactUrl(url),
      status,
      durationMs,
      resourceType,
      bodyStatus
    }
  });

  if (status >= 500) {
    state.networkStats.failed += 1;
    addIssue({
      type: 'api',
      category: 'actionable',
      severity: 'critical',
      title: `${method} ${shortUrlPath(url)} returned ${status}`,
      description: 'Server-side API failure detected during the QA session.',
      userImpact: 'A required business operation or data request may fail for the tester.',
      recommendation: 'Reproduce the user action, inspect the server error, and verify the endpoint contract.',
      evidence: baseEvidence
    });
  } else if (status >= 400) {
    state.networkStats.failed += 1;
    addIssue({
      type: 'api',
      category: 'actionable',
      severity: 'high',
      title: `${method} ${shortUrlPath(url)} returned ${status}`,
      description: 'Client/auth/API error detected during the QA session.',
      userImpact: 'The requested business operation or required data may be unavailable.',
      recommendation: 'Confirm the expected status and correct the request, authorization, or endpoint behavior.',
      evidence: baseEvidence
    });
  } else if (status === 0) {
    state.networkStats.failed += 1;
    addIssue({
      type: 'api',
      category: 'actionable',
      severity: 'high',
      title: `${method} ${shortUrlPath(url)} failed to complete`,
      description: 'Network request appears to have failed before receiving a valid HTTP response.',
      userImpact: 'The application may not receive data required for the tested flow.',
      recommendation: 'Check connectivity, CORS, endpoint availability, and browser network details.',
      evidence: { ...baseEvidence, error: response._error || 'No HTTP response status was available.' }
    });
  }

  if (durationMs >= state.settings.verySlowApiMs) {
    state.networkStats.slow += 1;
    addIssue({
      type: 'api',
      category: 'needs-review',
      severity: 'high',
      title: `Very slow API: ${method} ${shortUrlPath(url)}`,
      description: `API took ${durationMs}ms, which is above the configured very-slow threshold.`,
      userImpact: 'The tested action may feel delayed or time out on slower connections.',
      recommendation: 'Profile the endpoint and verify the delay is reproducible during the user flow.',
      evidence: { ...baseEvidence, thresholdMs: state.settings.verySlowApiMs }
    });
  } else if (durationMs >= state.settings.slowApiMs) {
    state.networkStats.slow += 1;
    addIssue({
      type: 'api',
      category: 'needs-review',
      severity: 'medium',
      title: `Slow API: ${method} ${shortUrlPath(url)}`,
      description: `API took ${durationMs}ms, which is above the configured slow threshold.`,
      userImpact: 'The tested interaction may feel slower than expected.',
      recommendation: 'Review endpoint latency and confirm whether it affects the user experience.',
      evidence: { ...baseEvidence, thresholdMs: state.settings.slowApiMs }
    });
  }

  const sensitiveQueryKeys = getSensitiveQueryKeys(url);
  if (sensitiveQueryKeys.length > 0) {
    addIssue({
      type: 'api',
      category: 'actionable',
      severity: 'high',
      title: `Sensitive data in query string: ${shortUrlPath(url)}`,
      description: 'Potentially sensitive values were sent in URL query parameters.',
      userImpact: 'Sensitive data can leak through browser history, logs, analytics, or referrer headers.',
      recommendation: 'Move sensitive values to protected headers or request bodies.',
      evidence: { ...baseEvidence, sensitiveQueryKeys }
    });
  }

  const jsonExpected = expectsJson(url, mimeType, contentType);
  if (jsonExpected && status >= 200 && status < 300 && !contentType) {
    addIssue({
      type: 'api',
      category: 'needs-review',
      severity: 'medium',
      confidence: 'medium',
      title: `Missing content-type: ${method} ${shortUrlPath(url)}`,
      description: 'The response appears to be API data but did not declare a content-type header.',
      userImpact: 'Clients or intermediaries may parse the response incorrectly.',
      recommendation: 'Return the expected JSON content-type when this endpoint is intended to provide JSON.',
      evidence: baseEvidence
    });
  } else if (jsonExpected && contentType && !String(contentType).toLowerCase().includes('json')) {
    addIssue({
      type: 'api',
      category: 'needs-review',
      severity: 'medium',
      confidence: 'medium',
      title: `Unexpected content-type: ${method} ${shortUrlPath(url)}`,
      description: 'The endpoint appears to return JSON but declared a different response content type.',
      userImpact: 'The frontend may reject or misinterpret the response.',
      recommendation: 'Align the response body and declared content type.',
      evidence: baseEvidence
    });
  }

  if (method.toUpperCase() === 'GET'
    && status >= 200
    && status < 300
    && !hasHeader(response.headers || [], 'cache-control')
    && !hasHeader(response.headers || [], 'etag')
    && !hasHeader(response.headers || [], 'expires')) {
    addIssue({
      type: 'api',
      category: 'informational',
      severity: 'low',
      confidence: 'low',
      title: `No cache guidance: GET ${shortUrlPath(url)}`,
      description: 'A successful GET response did not expose common cache-related headers. This may be intentional.',
      userImpact: 'No confirmed defect; caching may be less efficient.',
      recommendation: 'Review caching policy only if this endpoint is safely cacheable.',
      evidence: baseEvidence
    });
  }

  if (jsonExpected
    && status >= 200
    && status < 300
    && !binaryResponse
    && contentLength <= state.settings.maxBodyPreviewBytes) {
    entry.getContent((body, encoding) => {
      const bodyText = typeof body === 'string' ? body : '';
      const trimmed = bodyText.trim();
      const responseEvidence = {
        ...baseEvidence,
        bodyStatus: bodyText ? 'Available' : 'Unavailable',
        bodyEncoding: encoding || null,
        responseSnippet: state.settings.captureResponseBody && bodyText
          ? redactText(bodyText, state.settings.maxBodyPreviewBytes)
          : (bodyText ? '[Capture disabled]' : '[BODY_UNAVAILABLE]')
      };

      if (!trimmed && !['204', '205'].includes(String(status))) {
        addIssue({
          type: 'api',
          category: 'actionable',
          severity: 'medium',
          title: `Empty JSON response: ${method} ${shortUrlPath(url)}`,
          description: 'API response was expected to contain JSON but returned an empty body.',
          userImpact: 'The frontend may not receive required data.',
          recommendation: 'Return the expected payload or document the empty-response contract.',
          evidence: responseEvidence
        });
        render();
        return;
      }

      if (trimmed) {
        try {
          JSON.parse(trimmed);
        } catch (error) {
          addIssue({
            type: 'api',
            category: 'actionable',
            severity: 'high',
            title: `Invalid JSON response: ${method} ${shortUrlPath(url)}`,
            description: 'Response content-type suggests JSON, but the body could not be parsed as valid JSON.',
            userImpact: 'The frontend can fail while parsing the response.',
            recommendation: 'Return valid JSON and add response-contract coverage.',
            evidence: {
              ...responseEvidence,
              parseError: error.message,
            }
          });
          render();
        }
      }
    });
  }

  const unsafePayloadMethod = ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase());
  if (unsafePayloadMethod && !request.postData && !hasHeader(request.headers || [], 'content-length')) {
    addIssue({
      type: 'api',
      category: 'needs-review',
      severity: 'low',
      title: `Empty request payload: ${method} ${shortUrlPath(url)}`,
      description: 'A write API did not include a visible request body. This may be valid, but should be reviewed.',
      userImpact: 'The operation may submit incomplete data, though an empty body can be intentional.',
      recommendation: 'Confirm the endpoint contract and submitted payload.',
      evidence: baseEvidence
    });
  }

  checkDuplicateCall(method, url, request.postData && request.postData.text ? request.postData.text : '', baseEvidence);
  if (status > 0 && status < 400) {
    state.networkStats.passed += 1;
    addIssue({
      type: 'api',
      category: 'passed',
      severity: 'info',
      confidence: 'high',
      title: 'Business API requests completed successfully',
      description: 'Business API requests returned successful or redirect responses during this session.',
      userImpact: 'The captured API request completed without an HTTP failure.',
      recommendation: 'No action is required.',
      includeInIssueCount: false,
      evidence: {
        category: 'passed-api',
        method,
        status,
        durationMs,
        url: redactUrl(url)
      }
    });
  }
  schedulePersist();
  render();
}

function normalizeDocumentRoute(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.length > 1 ? parsed.pathname.replace(/\/$/, '') : parsed.pathname;
  } catch {
    return String(url || '/').split('?')[0] || '/';
  }
}

function promoteFrameworkFindingForRoute(route, status) {
  const finding = state.issues.find((issue) => (
    issue.evidence
    && issue.evidence.category === 'framework-prefetch'
    && Array.isArray(issue.evidence.routes)
    && issue.evidence.routes.includes(route)
  ));
  if (!finding) return false;

  const confirmedRoutes = new Set([...(finding.evidence.confirmedFailedRoutes || []), route]);
  finding.category = 'needs-review';
  finding.severity = 'medium';
  finding.includeInIssueCount = true;
  finding.userImpact = 'A matching document navigation also failed, so users may be unable to open one or more routes.';
  finding.recommendation = 'Investigate the confirmed route failure and verify direct and client-side navigation after deployment.';
  finding.title = `Next.js route failure confirmed: ${route}`;
  finding.evidence.confirmedFailedRoutes = Array.from(confirmedRoutes);
  finding.evidence.confirmedDocumentStatus = status;
  finding.lastSeenAt = Date.now();
  return true;
}

function isBinaryResponse(mimeType) {
  const value = String(mimeType || '').toLowerCase();
  return /^(image|audio|video|font)\//.test(value)
    || value.includes('application/octet-stream')
    || value.includes('application/pdf')
    || value.includes('application/zip');
}

function checkDuplicateCall(method, url, body, evidence) {
  const key = `${method}:${stripCacheBusters(url)}:${simpleHash(body || '')}`;
  const now = Date.now();
  const previous = state.duplicateCache.get(key);
  state.duplicateCache.set(key, { at: now, count: previous ? previous.count + 1 : 1 });

  if (previous && now - previous.at <= state.settings.duplicateWindowMs) {
    addIssue({
      type: 'api',
      category: 'needs-review',
      severity: 'medium',
      title: `Possible duplicate API call: ${method} ${shortUrlPath(url)}`,
      description: 'The same API request was repeated in a short time window. This may indicate unnecessary duplicate calls.',
      userImpact: 'Repeated calls can waste bandwidth, duplicate work, or trigger repeated side effects.',
      recommendation: 'Confirm the calls are unnecessary before changing request behavior.',
      evidence: {
        ...evidence,
        duplicateWindowMs: state.settings.duplicateWindowMs,
        duplicateCount: previous.count + 1
      }
    });
  }
}

function handleContentEvent(message) {
  if (!state.active) return;
  if (!message || message.kind !== 'console') return;
  if (!state.sessionId || message.sessionId !== state.sessionId) return;
  const payload = message.payload || {};
  if (payload.timestamp && state.startedAt && payload.timestamp < state.startedAt) return;
  state.lastUpdatedAt = Date.now();
  const issue = analyzeConsolePayload(payload);
  addIssue(issue);
  recordRecentEvidenceEvent({
    type: 'console',
    timestamp: payload.timestamp || Date.now(),
    title: issue.title,
    summary: issue.description || issue.title,
    severity: issue.severity,
    url: payload.url || state.pageUrl,
    evidence: issue.evidence
  });
  render();
}

function analyzeConsolePayload(payload) {
  const level = payload.level || 'error';
  const message = redactText(String(payload.message || 'Console issue detected'), 500);
  const isRuntime = payload.channel === 'runtime' || payload.channel === 'promise';
  const severity = level === 'error' ? (isRuntime ? 'high' : 'medium') : 'low';

  return {
    type: 'console',
    category: 'needs-review',
    severity,
    confidence: isRuntime ? 'medium' : 'low',
    title: `${level.toUpperCase()}: ${message.slice(0, 90)}`,
    description: isRuntime
      ? 'Runtime JavaScript error detected in the page context.'
      : 'Console warning/error detected during the QA session.',
    evidence: redactObject({
      channel: payload.channel,
      level,
      message,
      filename: payload.filename || null,
      lineno: payload.lineno || null,
      colno: payload.colno || null,
      stack: payload.stack || null,
      args: payload.args || []
    }),
    url: payload.url || state.pageUrl,
    timestamp: payload.timestamp || Date.now()
  };
}

async function runUiScan(options = {}) {
  const automatic = Boolean(options.automatic);
  if (!state.active) {
    els.sessionHint.textContent = 'Start a session before running a UI scan so the result belongs to a report.';
    if (!automatic) showToast('Start a session before running the UI scan.', 'error');
    return;
  }
  if (state.unsupportedReason || !state.capabilities.ui) {
    els.sessionHint.textContent = state.unsupportedReason || 'UI scanner is unavailable. Reload the inspected page to reconnect it.';
    els.uiStatus.textContent = 'Unavailable';
    if (!automatic) showToast('UI scanner is unavailable. Reload the inspected page.', 'error');
    return;
  }

  state.settings = readSettingsFromForm();
  await chrome.storage.local.set({ testpilotSettings: state.settings });
  uiScanInProgress = true;
  setScanButtonState(true);
  els.uiStatus.textContent = automatic ? 'Auto scanning' : 'Scanning';

  try {
    const result = await sendTabMessage({
      type: 'TESTPILOT_RUN_UI_SCAN',
      settings: buildContentScriptSettings()
    });
    const response = result.response;

    if (!result.ok || !response || !response.ok) {
      throw new Error(
        (response && response.error)
        || result.error
        || 'No UI scan response from content script. Try reloading the inspected page.'
      );
    }

    const scan = response.scan || {};
    const issues = Array.isArray(scan.issues) ? scan.issues : [];
    state.uiStats.scans += 1;
    state.uiStats.scannedElements += Number(scan.scannedElementCount || 0);
    state.uiStats.skippedElements += Number(scan.skippedElementCount || 0);
    state.uiStats.ignoredDecorativeElements += Number(scan.ignoredDecorativeCount || 0);
    state.uiStats.hitNodeLimit = state.uiStats.hitNodeLimit || Boolean(scan.hitNodeLimit);
    state.uiStats.lastDurationMs = Number(scan.durationMs || 0);
    state.uiStats.lastScannedElements = Number(scan.scannedElementCount || 0);
    state.uiStats.lastSkippedElements = Number(scan.skippedElementCount || 0);
    state.uiStats.lastIgnoredDecorativeElements = Number(scan.ignoredDecorativeCount || 0);
    state.uiStats.lastCompletedAt = Date.now();
    state.lastUpdatedAt = Date.now();
    for (const issue of issues) {
      addIssue({
        ...issue,
        evidence: {
          ...(issue.evidence || {}),
          viewport: scan.viewport,
          scanDurationMs: scan.durationMs,
          scannedElementCount: scan.scannedElementCount,
          skippedElementCount: scan.skippedElementCount,
          hitNodeLimit: scan.hitNodeLimit,
          droppedIssueCount: scan.droppedIssueCount,
          ignoredDecorativeCount: scan.ignoredDecorativeCount
        }
      });
    }

    if (issues.length === 0) {
      state.timeline.push({
        type: automatic ? 'auto-ui-scan-completed' : 'ui-scan-completed',
        timestamp: state.lastUpdatedAt,
        pageUrl: state.pageUrl,
        issueCount: 0,
        scannedElementCount: scan.scannedElementCount || 0
      });
    }
    els.uiStatus.textContent = scan.hitNodeLimit
      ? `Complete (limit ${scan.maxUiNodes})`
      : `Complete (${scan.scannedElementCount || 0} nodes)`;
    if (!automatic) {
      showToast(
        issues.length
          ? `UI scan completed with ${issues.length} finding${issues.length === 1 ? '' : 's'}.`
          : 'UI scan completed with no findings.',
        'success'
      );
    }
  } catch (error) {
    addIssue({
      type: 'ui',
      severity: 'medium',
      title: 'UI scan could not run',
      description: error.message || 'Content script was unavailable for this page.',
      evidence: {
        inspectedTabId,
        hint: 'Reload the page after installing/enabling the extension. Chrome internal pages cannot be scanned.'
      }
    });
    els.uiStatus.textContent = automatic ? 'Auto scan failed' : 'Unavailable';
    if (!automatic) showToast(error.message || 'UI scan could not run.', 'error');
  } finally {
    uiScanInProgress = false;
    setScanButtonState(false);
    schedulePersist();
    render();
  }
}

function buildContentScriptSettings() {
  const settings = normalizeSettings(state.settings);
  return {
    uiVisibleViewportOnly: settings.uiVisibleViewportOnly,
    uiIncludeDecorativeElements: settings.uiIncludeDecorativeElements,
    maxUiNodes: settings.maxUiNodes,
    maxIssuesPerRule: settings.maxIssuesPerRule,
    allowedColors: settings.allowedColors
  };
}

function setScanButtonState(scanning) {
  els.uiScanBtn.disabled = scanning;
  els.uiScanBtn.textContent = scanning ? 'Scanning...' : 'Run UI Scan';
}

function addIssue(issue) {
  const normalized = normalizeIssue(issue);
  const duplicateKey = getIssueDuplicateKey(normalized);
  const existing = state.issues.find((item) => item.duplicateKey === duplicateKey);

  if (existing) {
    existing.count += 1;
    existing.lastSeenAt = Date.now();
    if (normalized.evidence) {
      existing.evidence = { ...existing.evidence, lastEvidence: normalized.evidence };
      if (existing.category === 'framework-noise' || existing.evidence.category === 'framework-prefetch') {
        const routes = new Set([
          ...(existing.evidence.routes || []),
          ...(normalized.evidence.routes || []),
          normalized.evidence.logicalRoute
        ].filter(Boolean));
        existing.evidence.routes = Array.from(routes).sort();
        existing.evidence.routeCount = routes.size;
        existing.title = `Next.js route prefetch errors detected for ${routes.size} route${routes.size === 1 ? '' : 's'}`;
      }
    }
    state.lastUpdatedAt = Date.now();
    schedulePersist();
    return existing;
  }

  const typeLimit = {
    api: state.settings.maxApiIssues,
    console: state.settings.maxConsoleIssues,
    ui: state.settings.maxUiIssues
  }[normalized.type];
  const currentTypeCount = state.issues.filter((item) => item.type === normalized.type).length;
  if (currentTypeCount >= typeLimit) {
    state.droppedIssues[normalized.type] += 1;
    schedulePersist();
    return null;
  }

  const storedIssue = {
    ...normalized,
    duplicateKey,
    count: 1,
    firstSeenAt: Date.now(),
    lastSeenAt: Date.now()
  };
  state.issues.push(storedIssue);
  state.lastUpdatedAt = Date.now();
  schedulePersist();
  return storedIssue;
}

function normalizeIssue(issue) {
  const type = ['api', 'console', 'ui'].includes(issue.type) ? issue.type : 'ui';
  const requestedSeverity = ['critical', 'high', 'medium', 'low', 'info'].includes(issue.severity) ? issue.severity : 'low';
  const category = normalizeFindingCategory(issue.category, type, requestedSeverity, issue.evidence);
  const severity = category === 'framework-noise' ? 'info' : requestedSeverity;
  const timestamp = issue.timestamp || Date.now();
  const rawUrl = typeof issue.url === 'string' ? issue.url : getEvidenceUrl(issue.evidence) || '';
  const url = redactUrl(rawUrl);
  let title = redactText(String(issue.title || 'TestPilot issue'), 180);
  let description = redactText(String(issue.description || ''), 1000);
  const evidence = redactObject(issue.evidence || {});
  if (category === 'framework-noise') {
    const route = inferNextRouteFromEvidence(evidence);
    evidence.category = 'framework-prefetch';
    evidence.framework = 'Next.js';
    evidence.logicalRoute = route;
    evidence.routes = Array.from(new Set([...(evidence.routes || []), route].filter(Boolean)));
    evidence.routeCount = evidence.routes.length;
    evidence.speculative = true;
    title = `Next.js route prefetch errors detected for ${evidence.routeCount} route${evidence.routeCount === 1 ? '' : 's'}`;
    description = 'Speculative Next.js route-data requests failed. No user-facing navigation failure was confirmed.';
  }

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    type,
    category,
    severity,
    confidence: ['high', 'medium', 'low'].includes(issue.confidence) ? issue.confidence : 'high',
    title,
    description,
    userImpact: redactText(String(issue.userImpact || defaultUserImpact(category)), 800),
    recommendation: redactText(String(issue.recommendation || defaultRecommendation(category)), 800),
    includeInIssueCount: typeof issue.includeInIssueCount === 'boolean'
      ? issue.includeInIssueCount
      : category === 'actionable' || category === 'needs-review',
    includeInReport: typeof issue.includeInReport === 'boolean' ? issue.includeInReport : true,
    reviewStatus: ['confirmed', 'needs-review', 'ignored', 'auto'].includes(issue.reviewStatus)
      ? issue.reviewStatus
      : 'auto',
    reviewedAt: issue.reviewedAt || null,
    evidence,
    url,
    timestamp,
    suggestedBugText: issue.suggestedBugText || buildSuggestedBugText({
      type,
      category,
      severity,
      title,
      description,
      userImpact: issue.userImpact || defaultUserImpact(category),
      recommendation: issue.recommendation || defaultRecommendation(category),
      evidence,
      url
    })
  };
}

function migrateStoredIssue(issue) {
  const normalized = normalizeIssue(issue);
  return {
    ...normalized,
    id: issue.id || normalized.id,
    duplicateKey: normalized.evidence.category === 'framework-prefetch'
      ? getIssueDuplicateKey(normalized)
      : (issue.duplicateKey || getIssueDuplicateKey(normalized)),
    count: Number(issue.count || 1),
    firstSeenAt: Number(issue.firstSeenAt || issue.timestamp || Date.now()),
    lastSeenAt: Number(issue.lastSeenAt || issue.timestamp || Date.now())
  };
}

function consolidateStoredFindings(findings) {
  const consolidated = [];
  for (const finding of findings) {
    if (shouldDropStoredFinding(finding)) continue;
    const existing = consolidated.find((item) => item.duplicateKey === finding.duplicateKey);
    if (!existing) {
      consolidated.push(finding);
      continue;
    }

    existing.count += finding.count;
    existing.firstSeenAt = Math.min(existing.firstSeenAt, finding.firstSeenAt);
    existing.lastSeenAt = Math.max(existing.lastSeenAt, finding.lastSeenAt);
    if (finding.evidence.category === 'framework-prefetch') {
      const routes = new Set([
        ...(existing.evidence.routes || []),
        existing.evidence.logicalRoute,
        ...(finding.evidence.routes || []),
        finding.evidence.logicalRoute
      ].filter(Boolean));
      existing.evidence.routes = Array.from(routes).sort();
      existing.evidence.routeCount = routes.size;
      existing.title = `Next.js route prefetch errors detected for ${routes.size} route${routes.size === 1 ? '' : 's'}`;
    }
  }
  return consolidated;
}

function shouldDropStoredFinding(finding) {
  const evidence = finding.evidence || {};
  if (finding.title.startsWith('Possible duplicate API call')
    && hasHeader(evidence.requestHeaders || [], 'range')
    && !String(evidence.mimeType || '').toLowerCase().includes('json')) {
    return true;
  }

  const selector = String(evidence.selector || '').toLowerCase();
  if (evidence.ruleId === 'large-fixed-overlay'
    && (selector.includes('canvas') || /(background|particles|decoration|gradient|blob|noise|pattern)/.test(selector))) {
    return true;
  }

  if (evidence.ruleId === 'text-clipping') {
    const viewportHeight = Number(evidence.viewport && evidence.viewport.height);
    const rect = evidence.rect || {};
    const isOffscreen = viewportHeight > 0 && (Number(rect.y) >= viewportHeight || Number(rect.y) + Number(rect.height) <= 0);
    const isLargeContainer = viewportHeight > 0 && Number(rect.height) > viewportHeight * 0.6;
    const leafTextSelector = /(^|[ >])(p|span|a|button|label|li|td|th|h[1-6])(?:[.#:]|$)/i.test(selector);
    if (isOffscreen || isLargeContainer || !leafTextSelector) return true;
  }

  return false;
}

function normalizeFindingCategory(category, type, severity, evidence) {
  const allowed = ['actionable', 'needs-review', 'framework-noise', 'informational', 'passed'];
  if (allowed.includes(category)) return category;
  if (isFrameworkEvidence(evidence)) return 'framework-noise';
  if (type === 'console') return severity === 'low' || severity === 'info' ? 'needs-review' : 'actionable';
  if (type === 'ui') return severity === 'high' ? 'actionable' : 'needs-review';
  if (severity === 'critical' || severity === 'high') return 'actionable';
  if (severity === 'info') return 'informational';
  return 'needs-review';
}

function isFrameworkEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object') return false;
  if (evidence.category === 'framework-prefetch') return true;
  const url = String(evidence.url || '');
  if (/[?&]_rsc=/i.test(url) || /\/__next\.|__PAGE__\.txt/i.test(url)) return true;
  const headers = evidence.requestHeaders || [];
  return getHeaderValue(headers, 'rsc') === '1'
    || getHeaderValue(headers, 'next-router-prefetch') === '1'
    || Boolean(getHeaderValue(headers, 'next-router-segment-prefetch'));
}

function inferNextRouteFromEvidence(evidence) {
  const segment = getHeaderValue(evidence.requestHeaders || [], 'next-router-segment-prefetch');
  return normalizeNextRoute(segment || evidence.logicalRoute || evidence.url || '/');
}

function defaultUserImpact(category) {
  if (category === 'framework-noise') return 'No confirmed user-facing impact.';
  if (category === 'informational' || category === 'passed') return 'No confirmed defect.';
  if (category === 'needs-review') return 'Potential user impact requires manual confirmation.';
  return 'The tested user flow may be affected.';
}

function defaultRecommendation(category) {
  if (category === 'framework-noise') return 'Investigate only if a user-facing failure is reproducible.';
  if (category === 'informational' || category === 'passed') return 'No immediate action is required.';
  if (category === 'needs-review') return 'Review the evidence and reproduce before filing a bug.';
  return 'Reproduce the behavior and fix the confirmed defect.';
}

function getEvidenceUrl(evidence) {
  if (!evidence || typeof evidence !== 'object') return '';
  return evidence.url || '';
}

function getIssueDuplicateKey(issue) {
  const evidence = issue.evidence || {};
  if (issue.category === 'passed') {
    return simpleHash(JSON.stringify([issue.type, issue.category, issue.title]));
  }
  if (evidence.category === 'framework-prefetch' && evidence.logicalRoute) {
    return simpleHash(JSON.stringify([
      issue.type,
      evidence.category,
      evidence.framework
    ]));
  }

  const important = [
    issue.type,
    issue.severity,
    issue.title,
    evidence.method,
    evidence.url,
    evidence.status,
    evidence.selector,
    evidence.ruleId,
    evidence.message,
    evidence.filename,
    evidence.lineno
  ];
  return simpleHash(JSON.stringify(important));
}

function render() {
  els.startBtn.disabled = state.active || Boolean(state.unsupportedReason);
  els.stopBtn.disabled = !state.active;
  const scanDisabled = uiScanInProgress || !state.active || Boolean(state.unsupportedReason) || !state.capabilities.ui;
  els.uiScanBtn.disabled = scanDisabled;
  els.sessionBanner.classList.toggle('active', state.active);
  els.sessionBanner.classList.toggle('idle', !state.active);
  els.sessionBanner.classList.toggle('needs-reload', state.active && !state.reloadObserved);
  els.sessionStatus.textContent = getSessionStatus();
  const dotState = state.unsupportedReason
    ? 'error'
    : (state.active && !state.reloadObserved ? 'warning' : (state.active ? 'running' : 'idle'));
  for (const className of ['running', 'warning', 'error']) {
    els.sessionDot.classList.toggle(className, dotState === className);
  }
  els.currentUrl.textContent = state.pageUrl || 'Unavailable';
  els.sessionHint.textContent = getSessionHint();
  renderSessionDuration();

  const counts = countIssues(state.issues);
  const health = calculateHealthScore(state.issues);
  els.healthScore.textContent = health.score;
  els.healthLabel.textContent = health.label;
  if (els.healthMeter && els.healthMeter.style && typeof els.healthMeter.style.setProperty === 'function') {
    els.healthMeter.style.setProperty('--score', String(health.score));
  }
  els.healthSummary.textContent = getHealthSummaryText(counts, health);
  els.healthActionableMetric.textContent = counts.actionable;
  els.healthReviewMetric.textContent = counts.needsReview;
  els.healthNoiseMetric.textContent = counts.frameworkNoise + counts.informational;
  els.actionableCount.textContent = counts.actionable;
  els.reviewCount.textContent = counts.needsReview;
  els.frameworkCount.textContent = counts.frameworkNoise;
  els.consoleErrorCount.textContent = counts.consoleErrors;
  els.aiStatusSummary.textContent = getAiStatusLabel();
  const consoleFindings = state.issues.filter((issue) => issue.type === 'console');
  els.consoleErrorMetric.textContent = consoleFindings.filter((issue) => issue.evidence && issue.evidence.level === 'error').length;
  els.consoleWarningMetric.textContent = consoleFindings.filter((issue) => (
    issue.evidence && ['warn', 'warning'].includes(issue.evidence.level)
  )).length;
  els.consoleRepeatedMetric.textContent = consoleFindings.reduce(
    (total, issue) => total + Math.max(0, Number(issue.count || 1) - 1),
    0
  );
  els.uiScanSummary.textContent = state.uiStats.scans ? 'Complete' : 'Ready';
  els.businessApiCount.textContent = state.networkStats.api;
  els.frameworkRequestCount.textContent = state.networkStats.framework;
  els.staticRequestCount.textContent = state.networkStats.static;
  els.documentRequestCount.textContent = state.networkStats.documents;
  els.passedRequestCount.textContent = state.networkStats.passed;
  els.uiScanMetrics.textContent = state.uiStats.scans
    ? `${state.uiStats.lastDurationMs || 0} ms · ${state.uiStats.scans} scan${state.uiStats.scans === 1 ? '' : 's'}`
    : 'No scan completed.';
  els.uiLastScan.textContent = state.uiStats.lastCompletedAt
    ? new Date(state.uiStats.lastCompletedAt).toLocaleTimeString()
    : 'Not run';
  els.uiScannedCount.textContent = state.uiStats.lastScannedElements || 0;
  els.uiSkippedCount.textContent = state.uiStats.lastSkippedElements || 0;
  els.uiIgnoredCount.textContent = state.uiStats.lastIgnoredDecorativeElements || 0;
  const viewport = state.environment.viewport || {};
  els.uiViewportMetric.textContent = viewport.width && viewport.height
    ? `${viewport.width} × ${viewport.height}`
    : 'Unknown';
  els.networkStatus.textContent = state.active
    ? (state.reloadObserved ? `Running (${state.networkStats.api} APIs)` : 'Running - reload recommended')
    : (state.startedAt ? 'Stopped' : 'Not started');
  els.consoleStatus.textContent = state.capabilities.console
    ? (state.active ? 'Running' : 'Ready')
    : 'Unavailable - reload page';
  els.uiStatus.textContent = state.capabilities.ui
    ? (state.uiStats.scans ? `Complete (${state.uiStats.scans} scan${state.uiStats.scans === 1 ? '' : 's'})` : 'Ready')
    : 'Unavailable - reload page';
  els.lastUpdated.textContent = state.lastUpdatedAt
    ? new Date(state.lastUpdatedAt).toLocaleTimeString()
    : 'Never';
  const hasSession = Boolean(state.startedAt);
  els.exportHtmlBtn.disabled = !hasSession;
  els.exportJsonBtn.disabled = !hasSession;
  els.exportCsvBtn.disabled = !hasSession || !state.settings.csvExportEnabled;
  els.copyReportBtn.disabled = !hasSession;
  els.quickExportBtn.disabled = !hasSession;
  els.quickCopyBtn.disabled = !hasSession;
  const aiBusy = state.ai.status === 'checking' || state.ai.status === 'analyzing';
  els.checkAiBtn.disabled = aiBusy;
  if (els.analyzeAiBtn) els.analyzeAiBtn.disabled = aiBusy || !hasSession;
  if (els.generateTestsBtn) els.generateTestsBtn.disabled = aiBusy || !hasSession;
  if (els.generateBugsBtn) els.generateBugsBtn.disabled = aiBusy || !hasSession;
  els.sendAiChatBtn.disabled = aiChatBusy;
  if (els.copyAiSummaryBtn) els.copyAiSummaryBtn.disabled = !state.ai.analysis;
  if (els.downloadAiMarkdownBtn) els.downloadAiMarkdownBtn.disabled = !state.ai.analysis;
  if (els.downloadAiJsonBtn) els.downloadAiJsonBtn.disabled = !state.ai.analysis;
  els.downloadAiMarkdownReportBtn.disabled = !state.ai.analysis;
  els.downloadAiJsonReportBtn.disabled = !state.ai.analysis;
  const hasTestCases = getCurrentTestCases().length > 0;
  if (els.generateTestCasesTabBtn) els.generateTestCasesTabBtn.disabled = aiBusy || !hasSession;
  if (els.copyTestCasesBtn) els.copyTestCasesBtn.disabled = !hasTestCases;
  if (els.exportTestCasesMarkdownBtn) els.exportTestCasesMarkdownBtn.disabled = !hasTestCases;
  if (els.clearTestCasesBtn) els.clearTestCasesBtn.disabled = !hasTestCases;
  const hasBugDrafts = getCurrentBugDrafts().length > 0;
  if (els.generateBugReportTabBtn) els.generateBugReportTabBtn.disabled = aiBusy || !hasSession;
  if (els.copyBugReportDraftsBtn) els.copyBugReportDraftsBtn.disabled = !hasBugDrafts;
  if (els.exportBugReportMarkdownBtn) els.exportBugReportMarkdownBtn.disabled = !hasBugDrafts;
  if (els.exportBugReportJsonBtn) els.exportBugReportJsonBtn.disabled = !hasBugDrafts;
  if (els.clearBugReportsBtn) els.clearBugReportsBtn.disabled = !hasBugDrafts;
  if (els.testAiProviderBtn) els.testAiProviderBtn.disabled = aiBusy;
  if (els.clearAiApiKeyBtn) els.clearAiApiKeyBtn.disabled = aiBusy;
  els.viewAiBtn.disabled = !hasSession;
  els.reportHealth.textContent = `${health.score}/100`;
  els.reportActionable.textContent = counts.actionable;
  els.reportReview.textContent = counts.needsReview;
  els.reportRoutes.textContent = new Set(state.capturedUrls.filter(Boolean)).size;
  els.reportPreview.textContent = buildExecutiveSummary(counts, health);
  renderReportBuilderState();
  renderDashboardGuidance(counts);
  renderAiState();

  renderIssues();
}

function getAiStatusLabel() {
  if (state.ai.status === 'ready') return 'AI Live';
  if (state.ai.status === 'analyzing') return 'Running';
  if (state.ai.status === 'complete') return 'AI Live';
  if (state.ai.status === 'failed') {
    return state.ai.error && /provider|model|ollama/i.test(state.ai.error) ? 'Model Error' : 'Offline';
  }
  if (state.ai.status === 'checking') return 'Checking';
  return 'Not Configured';
}

function renderAiProviderStatus() {
  const settings = normalizeAiProviderSettings(state.settings.aiProvider);
  const status = normalizeProviderStatus(settings.status);
  const label = providerStatusLabel(status);
  if (els.aiProviderStatusPill) {
    els.aiProviderStatusPill.textContent = label;
    if (els.aiProviderStatusPill.dataset) els.aiProviderStatusPill.dataset.status = status;
  }
  if (els.aiProviderStatusText) {
    const checked = settings.lastCheckedAt ? ` Last checked ${new Date(settings.lastCheckedAt).toLocaleTimeString()}.` : '';
    const error = settings.lastError ? ` ${settings.lastError}` : '';
    els.aiProviderStatusText.textContent = `${AI_PROVIDER_DEFAULTS[settings.provider]?.label || 'AI provider'} is ${label.toLowerCase()}.${checked}${error}`.trim();
  }
}

function providerStatusLabel(status) {
  return {
    live: 'Live',
    checking: 'Checking',
    offline: 'Offline',
    model_error: 'Model Error',
    not_configured: 'Not Configured'
  }[status] || 'Not Configured';
}

function syncAiStateFromProviderStatus(settings = state.settings.aiProvider) {
  const status = normalizeProviderStatus(settings.status);
  if (status === 'live') {
    state.ai.status = 'ready';
    state.ai.error = '';
  } else if (status === 'checking') {
    state.ai.status = 'checking';
  } else if (status === 'model_error' || status === 'offline') {
    state.ai.status = 'failed';
    state.ai.error = settings.lastError || providerStatusLabel(status);
  } else {
    state.ai.status = 'not-configured';
    state.ai.error = settings.lastError || '';
  }
}

function getHealthSummaryText(counts, health) {
  if (counts.actionable > 0) {
    return `${counts.actionable} confirmed issue${counts.actionable === 1 ? '' : 's'} need attention. Score is based on user-impacting findings only.`;
  }
  if (counts.needsReview > 0) {
    return `${counts.needsReview} observation${counts.needsReview === 1 ? '' : 's'} need manual review before filing. No confirmed defect is counted yet.`;
  }
  if (counts.frameworkNoise + counts.informational > 0) {
    return `${counts.frameworkNoise + counts.informational} noisy or informational observation${counts.frameworkNoise + counts.informational === 1 ? '' : 's'} ignored. QA health remains ${health.label.toLowerCase()}.`;
  }
  return 'No confirmed defects detected. Run the UI scan and AI review when the target screen is ready.';
}

function renderDashboardGuidance(counts) {
  let title = 'Start a focused QA session';
  let copy = 'Capture one page or user flow at a time for a cleaner report.';

  if (state.unsupportedReason) {
    title = 'Open a testable web page';
    copy = state.unsupportedReason;
  } else if (state.active && !state.reloadObserved) {
    title = 'Reload the inspected page';
    copy = 'Reload now to capture early network calls, then perform the user flow you want to test.';
  } else if (counts.actionable > 0) {
    title = `Review ${counts.actionable} actionable finding${counts.actionable === 1 ? '' : 's'}`;
    copy = 'Confirm the highest-severity evidence first, then copy a ready-to-file bug description.';
  } else if (counts.needsReview > 0) {
    title = `Validate ${counts.needsReview} observation${counts.needsReview === 1 ? '' : 's'}`;
    copy = 'These findings need manual confirmation before they should be filed as defects.';
  } else if (state.active && state.uiStats.scans === 0) {
    title = 'Run the UI scan on the current screen';
    copy = 'Network and console capture are active. Scan the visible viewport when the target state is ready.';
  } else if (state.startedAt && !state.active) {
    title = 'Export or share the completed session';
    copy = 'The session is stopped and the temporary results are ready for reporting.';
  } else if (state.active) {
    title = 'Continue the focused test flow';
    copy = 'Capture the important interaction, then stop the session when the flow is complete.';
  }

  els.dashboardGuidanceTitle.textContent = title;
  els.dashboardGuidance.textContent = copy;
  els.viewPriorityBtn.disabled = counts.actionable + counts.needsReview === 0;
  els.viewReportsBtn.disabled = !state.startedAt;
}

function renderAiState() {
  renderAiProviderStatus();
  const statusLabel = getAiStatusLabel();
  els.aiStatusPill.textContent = statusLabel;
  if (els.aiStatusPill.dataset) {
    els.aiStatusPill.dataset.status = state.ai.status || 'not-configured';
  } else if (typeof els.aiStatusPill.setAttribute === 'function') {
    els.aiStatusPill.setAttribute('data-status', state.ai.status || 'not-configured');
  }
  if (els.checkAiBtn) {
    const shouldShowRetry = state.ai.status === 'failed';
    els.checkAiBtn.classList.toggle('hidden', !shouldShowRetry);
  }
  const activeMode = normalizeAiMode(state.ai.activeMode);
  state.ai.activeMode = activeMode;
  for (const button of aiModeButtons) {
    const isActive = button.dataset.aiMode === activeMode;
    button.classList.toggle('active', isActive);
    if (typeof button.setAttribute === 'function') {
      button.setAttribute('aria-selected', String(isActive));
    }
  }
  els.analyzeAiBtn?.classList.toggle('active-task', activeMode === 'analysis');
  els.generateTestsBtn?.classList.toggle('active-task', activeMode === 'test-cases');
  els.generateBugsBtn?.classList.toggle('active-task', activeMode === 'bug-reports');
  const statusTitle = {
    'not-configured': 'Local AI: Not checked',
    checking: 'Local AI: Checking',
    ready: 'Local AI: Connected',
    analyzing: 'Analyzing session',
    complete: 'Analysis complete',
    failed: state.ai.error && /provider|model|ollama/i.test(state.ai.error)
      ? 'Local AI: Model unavailable'
      : 'Local AI: Disconnected'
  }[state.ai.status] || 'AI not configured';

  const statusText = {
    'not-configured': 'Start ai-backend with npm start. TestPilot checks the connection automatically.',
    checking: 'Contacting the local backend.',
    ready: 'Local backend is reachable. Chat can use the local model; Agent actions still run through safe local execution.',
    analyzing: 'Sending a sanitized session summary to the local backend.',
    complete: 'AI analysis is ready and can be copied or included in reports.',
    failed: state.ai.error || 'Local AI backend is not available. Start ai-backend with npm start and retry.'
  }[state.ai.status] || 'Start the local TestPilot AI backend, then check the connection.';

  if (els.aiStatusTitle) els.aiStatusTitle.textContent = statusTitle;
  if (els.aiStatusText) els.aiStatusText.textContent = statusText;
  if (els.aiConnectionLog) {
    els.aiConnectionLog.textContent = Array.isArray(state.ai.log) && state.ai.log.length
      ? state.ai.log.slice(-8).join('\n')
      : 'Backend not checked yet. Start ai-backend with npm start, then click Check AI.';
  }
  renderAiChatMessages();
  renderTestCasesState();
  renderBugReportsState();

  if (!state.ai.analysis) {
    if (els.aiOutput) {
      els.aiOutput.classList.toggle('empty', true);
      els.aiOutput.innerHTML = '<strong>No AI analysis yet</strong><p>AI runs only when you click a button. TestPilot still works without AI.</p>';
    }
    return;
  }

  if (els.aiOutput) {
    els.aiOutput.classList.toggle('empty', false);
    renderAiAnalysis(state.ai.analysis, activeMode);
  }
}

function renderAiChatMessages() {
  if (!els.aiChatMessages) return;
  const messages = Array.isArray(state.ai.chatMessages) ? state.ai.chatMessages : [];
  if (typeof els.aiChatMessages.replaceChildren === 'function') {
    els.aiChatMessages.replaceChildren();
  } else {
    els.aiChatMessages.innerHTML = '';
    if (Array.isArray(els.aiChatMessages.children)) els.aiChatMessages.children.length = 0;
  }
  if (!messages.length && !aiChatBusy) {
    const empty = document.createElement('div');
    empty.className = 'testpilot-empty-chat';
    empty.textContent = 'Tell TestPilot what to test on this page.';
    els.aiChatMessages.appendChild(empty);
    return;
  }

  for (const message of messages) {
    if (message.type === 'separator') {
      const separator = document.createElement('div');
      separator.className = 'ai-chat-separator';
      separator.textContent = message.text || 'Mode changed';
      els.aiChatMessages.appendChild(separator);
      continue;
    }
    const article = document.createElement('article');
    article.className = `ai-chat-message ${message.role === 'user' ? 'user' : 'assistant'}`;
    const label = document.createElement('span');
    label.textContent = message.role === 'user' ? 'Tester' : 'TestPilot AI';
    const body = document.createElement('div');
    body.className = 'ai-chat-message-body';
    body.textContent = message.text || '';
    article.append(label, body);
    els.aiChatMessages.appendChild(article);
  }

  const hasStreamingAssistant = messages.some((message) => message && message.role === 'assistant' && message.streaming);
  if (aiChatBusy && !hasStreamingAssistant) {
    const thinking = document.createElement('article');
    thinking.className = 'ai-chat-message assistant thinking';
    const label = document.createElement('span');
    label.textContent = 'TestPilot AI';
    const body = document.createElement('div');
    body.className = 'ai-chat-message-body';
    body.textContent = 'Thinking';
    thinking.append(label, body);
    els.aiChatMessages.appendChild(thinking);
  }

  els.aiChatMessages.scrollTop = els.aiChatMessages.scrollHeight;
}

async function submitAiChat(value) {
  const question = String(value || '').trim();
  if (!question || aiChatBusy) return;
  els.aiChatInput.value = '';
  state.ai.chatMessages = Array.isArray(state.ai.chatMessages) ? state.ai.chatMessages : [];
  state.ai.chatMessages.push({ role: 'user', text: question, timestamp: Date.now() });
  state.ai.chatMessages = state.ai.chatMessages.slice(-20);
  aiChatBusy = true;
  render();

  if (isTestCaseGenerationPrompt(question)) {
    state.ai.chatMessages.push({
      role: 'assistant',
      text: 'Opening Test Cases and generating scenarios from the current session evidence.',
      timestamp: Date.now()
    });
    aiChatBusy = false;
    state.ai.chatMessages = state.ai.chatMessages.slice(-20);
    setActiveView('test-cases');
    await runAiTask('generate-test-cases', { source: 'chat' });
    return;
  }

  if (isBugReportGenerationPrompt(question)) {
    state.ai.chatMessages.push({
      role: 'assistant',
      text: 'Opening Bug Reports and drafting from the current session evidence.',
      timestamp: Date.now()
    });
    aiChatBusy = false;
    state.ai.chatMessages = state.ai.chatMessages.slice(-20);
    setActiveView('bug-reports');
    await runAiTask('generate-bug-report', { source: 'chat' });
    return;
  }

  if (document.body?.dataset?.testpilotMode === 'agent') {
    void checkAiHealth({ silent: true, reason: 'agent-send' });
    await runAgentCommand(question);
    return;
  }

  try {
    state.settings = readSettingsFromForm();
    await chrome.storage.local.set({ testpilotSettings: state.settings });
    const backendReady = state.ai.status === 'ready' || await checkAiHealth({ silent: true, reason: 'chat-send' });
    if (!backendReady) {
      state.ai.chatMessages.push({
        role: 'assistant',
        text: 'Local AI backend is not available. Start the backend with `cd ai-backend && npm start`, then click Retry or send the message again.',
        timestamp: Date.now()
      });
      return;
    }
    const streamingMessage = createStreamingAssistantMessage();
    const providerResponse = await completeChatWithSelectedProvider(question, {
      onToken(token) {
        streamingMessage.text += token;
        renderAiChatMessages();
      },
      onReplace(text) {
        streamingMessage.text = text;
        renderAiChatMessages();
      }
    });
    streamingMessage.streaming = false;
    streamingMessage.text = String(providerResponse.text || streamingMessage.text || '').trim() || buildLocalChatFallback(question);
    if (providerResponse.usage) recordAiUsage(providerResponse.usage);
    if (providerResponse.fallbackReason) addAiLog(`chat used fallback: ${providerResponse.fallbackReason}`);
  } catch (error) {
    for (const message of state.ai.chatMessages || []) {
      if (message && message.streaming) message.streaming = false;
    }
    state.ai.chatMessages.push({
      role: 'assistant',
      text: `Local AI backend is not available. Start the backend and try again.\n\nReason: ${formatAiError(error)}`,
      timestamp: Date.now()
    });
    addAiLog(`chat failed: ${formatAiError(error)}`);
  } finally {
    aiChatBusy = false;
    state.ai.chatMessages = state.ai.chatMessages.slice(-20);
    schedulePersist();
    render();
  }
}

function createStreamingAssistantMessage() {
  state.ai.chatMessages = Array.isArray(state.ai.chatMessages) ? state.ai.chatMessages : [];
  const message = { role: 'assistant', text: '', timestamp: Date.now(), streaming: true };
  state.ai.chatMessages.push(message);
  state.ai.chatMessages = state.ai.chatMessages.slice(-20);
  renderAiChatMessages();
  return message;
}

async function completeChatWithSelectedProvider(question, options = {}) {
  const providerSettings = normalizeAiProviderSettings(state.settings.aiProvider);
  if (providerSettings.provider === 'local-backend') {
    if (typeof options.onToken === 'function' || typeof options.onReplace === 'function') {
      return streamLocalBackendChat(question, options);
    }
    const context = buildCompactAiSessionSummary('chat');
    const response = await fetchWithTimeout(`${getAiProviderBaseUrl(providerSettings)}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: question,
        mode: 'chat',
        sessionId: state.sessionId,
        pageUrl: state.pageUrl,
        currentUserMessage: question,
        cacheKey: simpleHash(JSON.stringify({
          sessionId: state.sessionId,
          pageUrl: state.pageUrl,
          mode: 'chat',
          userMessage: question,
          context
        })),
        context,
        history: state.ai.chatMessages.slice(-6).map((message) => ({
          role: message.role,
          text: message.text
        }))
      })
    }, 180000);
    if (!response.ok) throw new Error(`AI backend returned ${response.status}`);
    const payload = await response.json().catch(() => ({}));
    return {
      text: String(payload.answer || payload.message || '').trim(),
      raw: payload,
      usage: payload.usage || null,
      fallbackReason: payload.fallback ? (payload.fallbackReason || 'local backend fallback') : ''
    };
  }

  const messages = buildProviderChatMessages(question);
  return completeWithAiProvider({
    settings: providerSettings,
    messages,
    mode: 'chat',
    maxTokens: getProviderMaxTokens('chat'),
    temperature: providerSettings.temperature,
    responseFormat: 'text'
  });
}

async function streamLocalBackendChat(question, options = {}) {
  const providerSettings = normalizeAiProviderSettings(state.settings.aiProvider);
  const context = buildCompactAiSessionSummary('chat');
  const response = await fetchWithTimeout(`${getAiProviderBaseUrl(providerSettings)}/api/ai/chat-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      message: question,
      mode: 'chat',
      sessionId: state.sessionId,
      pageUrl: state.pageUrl,
      currentUserMessage: question,
      context,
      history: state.ai.chatMessages
        .filter((message) => ['user', 'assistant'].includes(message.role) && message.text && !message.streaming)
        .slice(-6)
        .map((message) => ({
          role: message.role,
          text: message.text
        }))
    })
  }, 190000);
  if (!response.ok) throw new Error(`AI backend returned ${response.status}`);
  if (!response.body || typeof response.body.getReader !== 'function') {
    const payload = await response.json().catch(() => ({}));
    return {
      text: String(payload.answer || payload.message || '').trim(),
      raw: payload,
      fallbackReason: payload.fallback ? (payload.fallbackReason || 'local backend fallback') : ''
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalText = '';
  let raw = {};
  let fallbackReason = '';

  const handleEvent = (eventText) => {
    const lines = String(eventText || '').split(/\r?\n/);
    let type = 'message';
    const dataLines = [];
    for (const line of lines) {
      if (line.startsWith('event:')) type = line.slice(6).trim();
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (!dataLines.length) return;
    let data = {};
    try {
      data = JSON.parse(dataLines.join('\n'));
    } catch {
      data = { text: dataLines.join('\n') };
    }
    if (type === 'token') {
      const token = String(data.token || data.text || '');
      if (token) {
        finalText += token;
        options.onToken?.(token);
      }
    } else if (type === 'replace') {
      finalText = String(data.answer || data.text || '');
      options.onReplace?.(finalText);
    } else if (type === 'done') {
      raw = data;
      if (data.answer) finalText = String(data.answer);
      fallbackReason = data.fallbackReason || '';
    } else if (type === 'error') {
      fallbackReason = data.error || 'stream failed';
      if (data.answer) {
        finalText = String(data.answer);
        options.onReplace?.(finalText);
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const parts = buffer.split(/\n\n/);
    buffer = parts.pop() || '';
    for (const part of parts) handleEvent(part);
    if (done) break;
  }
  if (buffer.trim()) handleEvent(buffer);

  return {
    text: finalText.trim(),
    raw,
    fallbackReason
  };
}

function isTestCaseGenerationPrompt(value) {
  const text = String(value || '').toLowerCase();
  return /\b(generate|create|make|write|draft|prepare)\b/.test(text)
    && /\b(test cases?|qa scenarios?|test scenarios?|gherkin|regression tests?|smoke tests?)\b/.test(text);
}

function isBugReportGenerationPrompt(value) {
  const text = String(value || '').toLowerCase();
  return /\b(generate|create|make|write|draft|prepare)\b/.test(text)
    && /\b(bug reports?|defect reports?|issue reports?|jira ticket|bug draft|defect draft)\b/.test(text);
}

async function runAgentCommand(command) {
  try {
    const result = await sendTabMessage({
      type: 'TESTPILOT_RUN_AGENT',
      command,
      options: {
        mode: document.body?.dataset?.testpilotMode || 'agent',
        sessionId: state.sessionId,
        pageUrl: state.pageUrl,
        contextMode: state.settings.aiContextMode || 'fast',
        history: (state.ai.chatMessages || []).slice(-6)
      }
    });
    if (!result.ok || !result.response || !result.response.ok) {
      throw new Error((result.response && result.response.error) || result.error || 'Agent could not connect to the inspected page.');
    }
    await waitForPanel(650);
    const agentResult = linkEvidenceToAgentResult(result.response.result);
    state.ai.lastAgentResult = agentResult;
    state.ai.chatMessages.push({
      role: 'assistant',
      text: formatAgentResultForChat(agentResult),
      timestamp: Date.now()
    });
    addAiLog(`agent ${agentResult.taskType || 'task'} completed: ${agentResult.result?.status || 'needs_review'}`);
  } catch (error) {
    state.ai.chatMessages.push({
      role: 'assistant',
      text: `Agent could not complete the workflow.\n\nReason: ${formatAiError(error)}\n\nReload the inspected page, confirm this is a normal web page, then try a narrower command such as "Test the search box."`,
      timestamp: Date.now()
    });
    addAiLog(`agent failed: ${formatAiError(error)}`);
  } finally {
    aiChatBusy = false;
    state.ai.chatMessages = state.ai.chatMessages.slice(-20);
    schedulePersist();
    render();
  }
}

function waitForPanel(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function linkEvidenceToAgentResult(agentResult) {
  if (!agentResult || typeof agentResult !== 'object') return agentResult;
  const actionResults = Array.isArray(agentResult.actionResults) ? agentResult.actionResults : [];
  if (!actionResults.length) return agentResult;

  const linkedGroups = [];
  const enrichedActions = actionResults.map((action, index) => {
    const actionAt = Number(action.timestamp || 0);
    if (!actionAt) return { ...action, linkedEvidence: [] };
    const nextActionAt = Number(actionResults[index + 1]?.timestamp || 0);
    const windowEnd = nextActionAt
      ? Math.min(actionAt + AGENT_EVIDENCE_WINDOW_MS, nextActionAt + 250)
      : actionAt + AGENT_EVIDENCE_WINDOW_MS;
    const linkedEvidence = recentEvidenceEvents
      .filter((event) => event.timestamp >= actionAt - 250 && event.timestamp <= windowEnd)
      .slice(0, 6)
      .map(formatLinkedEvidenceEvent);
    if (linkedEvidence.length) {
      linkedGroups.push({
        stepIndex: index,
        action: action.action,
        targetIndex: action.targetIndex || null,
        evidence: linkedEvidence
      });
    }
    return { ...action, linkedEvidence };
  });

  const flattenedEvidence = linkedGroups.flatMap((group) => (
    group.evidence.map((event) => `Step ${group.stepIndex + 1} ${group.action}: ${event.summary}`)
  ));
  const existingResult = agentResult.result && typeof agentResult.result === 'object' ? agentResult.result : {};
  const evidence = [
    ...(Array.isArray(existingResult.evidence) ? existingResult.evidence : []),
    ...flattenedEvidence
  ].slice(0, 16);

  return {
    ...agentResult,
    actionResults: enrichedActions,
    linkedEvidence: linkedGroups,
    evidenceQuality: buildAgentEvidenceQuality(enrichedActions, linkedGroups, existingResult),
    result: {
      ...existingResult,
      evidence
    }
  };
}

function buildAgentEvidenceQuality(actionResults, linkedGroups, result = {}) {
  const total = actionResults.length;
  const passed = actionResults.filter((item) => item.success).length;
  const failed = total - passed;
  const linkedCount = linkedGroups.reduce((sum, group) => sum + (group.evidence || []).length, 0);
  const hasFailure = failed > 0 || ['failed', 'needs_review'].includes(result.status);
  const confidence = linkedCount >= 2 || (total > 0 && failed === 0)
    ? 'high'
    : (linkedCount || total ? 'medium' : 'low');
  return {
    confidence,
    actionCount: total,
    passedActions: passed,
    failedActions: failed,
    linkedEvidenceCount: linkedCount,
    filingGuidance: hasFailure
      ? 'Review the failed or needs-review steps and linked evidence before filing.'
      : 'Agent did not confirm a failing behavior. Treat this as passed evidence unless a tester observes otherwise.'
  };
}

function formatLinkedEvidenceEvent(event) {
  const prefix = event.type === 'console' ? 'Console' : 'API';
  return {
    type: event.type,
    severity: event.severity || 'info',
    title: event.title,
    summary: `${prefix}: ${event.summary || event.title}`,
    timestamp: event.timestamp,
    url: event.url,
    evidence: event.evidence
  };
}

function formatAgentResultForChat(agentResult) {
  const result = agentResult.result || {};
  const plan = agentResult.plan || {};
  const actionResults = Array.isArray(agentResult.actionResults) ? agentResult.actionResults : [];
  const quality = agentResult.evidenceQuality || buildAgentEvidenceQuality(actionResults, agentResult.linkedEvidence || [], result);
  const status = String(result.status || 'needs_review').replace(/_/g, ' ');
  const lines = [
    `Outcome: ${status}`,
    `Evidence confidence: ${quality.confidence}`,
    `Task: ${String(agentResult.taskType || plan.taskType || 'general_page_validation').replace(/_/g, ' ')}`,
    `Data Strategy: ${String(agentResult.dataStrategy || plan.dataStrategy || 'unknown').replace(/_/g, ' ')}`,
    '',
    result.summary || plan.summary || 'Agent completed the workflow.',
    ''
  ];
  lines.push(`Evidence summary: ${quality.passedActions}/${quality.actionCount} action(s) passed, ${quality.failedActions} failed, ${quality.linkedEvidenceCount} linked API/console event(s).`);
  lines.push(quality.filingGuidance, '');
  if (plan.steps && plan.steps.length) {
    lines.push('Safe plan:');
    for (const [index, step] of plan.steps.entries()) {
      lines.push(`${index + 1}. Attempt ${step.action}${step.targetIndex ? ` #${step.targetIndex}` : ''} - ${step.reason || 'QA step'}`);
    }
    lines.push('');
  }
  if (actionResults.length) {
    lines.push('Observed action results:');
    for (const item of actionResults) {
      lines.push(`${item.success ? 'PASS' : 'REVIEW'} ${item.action}${item.targetIndex ? ` #${item.targetIndex}` : ''}: ${item.message}`);
      for (const evidence of (item.linkedEvidence || []).slice(0, 3)) {
        lines.push(`  - Linked ${evidence.summary}`);
      }
    }
    lines.push('');
  }
  if (agentResult.linkedEvidence && agentResult.linkedEvidence.length) {
    lines.push('Linked API / console evidence:');
    for (const group of agentResult.linkedEvidence.slice(0, 6)) {
      for (const evidence of group.evidence.slice(0, 3)) {
        lines.push(`- Step ${group.stepIndex + 1}: ${evidence.summary}`);
      }
    }
    lines.push('');
  }
  if (result.evidence && result.evidence.length) {
    lines.push('Evidence:');
    for (const item of result.evidence.slice(0, 6)) lines.push(`- ${item}`);
    lines.push('');
  }
  lines.push('Passed Checks:');
  const passedChecks = Array.isArray(result.passedChecks) ? result.passedChecks : [];
  if (passedChecks.length) {
    for (const item of passedChecks.slice(0, 8)) lines.push(`- ${item}`);
  } else {
    lines.push('- No passed checks were confirmed.');
  }
  lines.push('');

  lines.push('Failed Checks:');
  const failedChecks = Array.isArray(result.failedChecks) ? result.failedChecks : [];
  if (failedChecks.length) {
    for (const item of failedChecks.slice(0, 8)) lines.push(`- ${item}`);
  } else {
    lines.push('- No failed checks were confirmed.');
  }
  lines.push('');

  if (result.recommendedNextSteps && result.recommendedNextSteps.length) {
    lines.push('Recommended Next Steps:');
    for (const item of result.recommendedNextSteps.slice(0, 4)) lines.push(`- ${item}`);
  }
  return lines.join('\n').trim();
}

function buildLocalChatFallback(question, reason = '') {
  const counts = countIssues(state.issues);
  const health = calculateHealthScore(state.issues);
  const prefix = reason ? `Local fallback note: ${reason}\n\n` : '';
  const lower = String(question || '').toLowerCase();
  if (!state.startedAt) {
    return `${prefix}Start a session, reload the inspected page, then repeat the flow you want to test. After that, ask me about API failures, UI bugs, console errors, or report drafts.`;
  }
  if (lower.includes('score') || lower.includes('health')) {
    return `${prefix}Health is ${health.score}/100 (${health.label}). Fix actionable findings first, then manually confirm needs-review items. Noise and framework/internal traffic do not reduce the score.`;
  }
  if (lower.includes('api') || lower.includes('network')) {
    return `${prefix}Current network evidence: ${state.networkStats.api} business API requests, ${state.networkStats.failed} failed requests, and ${counts.actionable} actionable finding(s). Open Network / Findings from the menu to inspect the evidence.`;
  }
  if (lower.includes('ui') || lower.includes('access')) {
    return `${prefix}Run Accessibility / UI Scan from Menu > QA Tools on the exact screen state you want to test. UI findings need tester confirmation before filing.`;
  }
  if (lower.includes('bug') || lower.includes('report')) {
    return `${prefix}Open Reports or use Menu > QA Tools > Generate Bug Report. TestPilot will draft from actionable findings and avoid inventing bugs from uncertain evidence.`;
  }
  return `${prefix}I can help with this TestPilot QA session. Current summary: ${counts.actionable} actionable, ${counts.needsReview} needs review, ${state.networkStats.total} network requests, and ${state.uiStats.scans} UI scan(s).`;
}

function addAiLog(message) {
  const timestamp = new Date().toLocaleTimeString();
  const line = `[${timestamp}] ${message}`;
  state.ai.log = Array.isArray(state.ai.log) ? state.ai.log : [];
  state.ai.log.push(line);
  state.ai.log = state.ai.log.slice(-20);
}

function normalizeAiMode(mode) {
  return ['analysis', 'test-cases', 'bug-reports'].includes(mode) ? mode : 'analysis';
}

function aiModeForTask(task) {
  if (task === 'generate-test-cases') return 'test-cases';
  if (task === 'generate-bug-report') return 'bug-reports';
  return 'analysis';
}

function renderAiAnalysis(analysis, mode = 'analysis') {
  if (!els.aiOutput) return;
  els.aiOutput.innerHTML = '';
  if (mode === 'test-cases') {
    els.aiOutput.append(
      makeAiHero('Generated test cases', 'Downloadable QA scenarios based on the current TestPilot evidence.'),
      makeTestCaseSection(analysis.testCases),
      makeAiSection('Extra recommended checks', analysis.recommendedNextTests)
    );
    return;
  }
  if (mode === 'bug-reports') {
    els.aiOutput.append(
      makeAiHero('Bug report drafts', 'Ready-to-review drafts for confirmed or high-confidence findings.'),
      makeBugDraftSection(analysis.bugReportDrafts),
      makeAiSection('Needs review before filing', analysis.needsReview.map((item) => `${item.title}: ${item.whatToVerify}`))
    );
    return;
  }
  els.aiOutput.append(
    makeAiHero('Session analysis', analysis.executiveSummary),
    makeAiSection('Actionable issues', analysis.actionableIssues.map((item) => `${item.title}: ${item.reason} Recommendation: ${item.recommendation}`)),
    makeAiSection('Likely false positives', analysis.likelyFalsePositives.map((item) => `${item.title}: ${item.reason}`)),
    makeAiSection('Needs review', analysis.needsReview.map((item) => `${item.title}: ${item.whatToVerify}`)),
    makeAiSection('Recommended next tests', analysis.recommendedNextTests),
    makeAiSection('Manager summary', [analysis.managerSummary]),
    makeAiSection('Developer summary', [analysis.developerSummary])
  );
}

function makeAiHero(title, copy) {
  const section = document.createElement('section');
  section.className = 'ai-result-hero';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const p = document.createElement('p');
  p.textContent = copy || 'AI generated this from the sanitized TestPilot session.';
  section.append(heading, p);
  return section;
}

function makeAiSection(title, items) {
  const section = document.createElement('section');
  section.className = 'ai-result-section';
  const heading = document.createElement('h3');
  heading.textContent = title;
  section.appendChild(heading);
  const filtered = (items || []).filter(Boolean);
  if (filtered.length <= 1) {
    const p = document.createElement('p');
    p.textContent = filtered[0] || 'No items.';
    section.appendChild(p);
    return section;
  }
  const list = document.createElement('ul');
  for (const item of filtered) {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  }
  section.appendChild(list);
  return section;
}

function makeTestCaseSection(testCases) {
  const section = document.createElement('section');
  section.className = 'ai-result-section ai-card-list';
  const heading = document.createElement('h3');
  heading.textContent = 'Test cases';
  section.appendChild(heading);
  const items = Array.isArray(testCases) ? testCases : [];
  if (!items.length) {
    const p = document.createElement('p');
    p.textContent = 'No structured test cases were generated. Try Analyze Session first, then Generate Test Cases.';
    section.appendChild(p);
    return section;
  }
  for (const testCase of items) {
    const article = document.createElement('article');
    article.className = 'ai-item-card';
    const title = document.createElement('h4');
    title.textContent = testCase.title || 'Untitled test case';
    const meta = document.createElement('p');
    meta.className = 'ai-item-meta';
    meta.textContent = [testCase.priority, testCase.type, testCase.sourceFinding].filter(Boolean).join(' · ');
    const objective = document.createElement('p');
    objective.textContent = testCase.objective || 'Verify the behavior described by TestPilot evidence.';
    const list = document.createElement('ol');
    for (const step of testCase.steps || []) {
      const li = document.createElement('li');
      li.textContent = step;
      list.appendChild(li);
    }
    const expected = document.createElement('p');
    expected.innerHTML = `<strong>Expected:</strong> ${escapeHtml(testCase.expectedResult || 'The flow works without a confirmed TestPilot issue.')}`;
    article.append(title, meta, objective, list, expected);
    section.appendChild(article);
  }
  return section;
}

function renderTestCasesState() {
  if (!els.testCasesOutput || !els.testCasesStatus) return;
  const isGenerating = state.ai.status === 'analyzing' && state.ai.lastTask === 'generate-test-cases';
  const allCases = getCurrentTestCases();
  const filteredCases = filterTestCasesForSelectedType(allCases);
  const hasCases = allCases.length > 0;
  const format = getSelectedTestCaseFormat();
  const type = getSelectedTestCaseType();

  if (isGenerating) {
    els.testCasesStatus.textContent = 'Generating test cases from the current page context and evidence...';
    els.testCasesOutput.classList.toggle('empty', false);
    els.testCasesOutput.innerHTML = '<div class="test-cases-loader"><span></span><strong>Building QA scenarios</strong><p>TestPilot is using findings, page context, and latest Agent evidence.</p></div>';
    return;
  }

  if (!hasCases) {
    els.testCasesStatus.textContent = 'No generated test cases yet.';
    els.testCasesOutput.classList.toggle('empty', true);
    els.testCasesOutput.innerHTML = '<strong>Ready to generate</strong><p>Start a session and run Agent or manual QA first for richer, page-specific test cases.</p>';
    return;
  }

  els.testCasesStatus.textContent = `${filteredCases.length} of ${allCases.length} test case${allCases.length === 1 ? '' : 's'} shown · ${type} · ${format}`;
  els.testCasesOutput.classList.toggle('empty', false);
  els.testCasesOutput.innerHTML = '';

  if (!filteredCases.length) {
    const empty = document.createElement('article');
    empty.className = 'test-case-card muted';
    empty.innerHTML = '<h3>No matching test cases</h3><p>Change the test type filter or regenerate cases with the selected type.</p>';
    els.testCasesOutput.appendChild(empty);
    return;
  }

  for (const testCase of filteredCases) {
    els.testCasesOutput.appendChild(renderTestCaseCard(testCase));
  }
}

function renderTestCaseCard(testCase) {
  const article = document.createElement('article');
  article.className = 'test-case-card';

  const meta = document.createElement('div');
  meta.className = 'test-case-meta';
  const priority = document.createElement('span');
  priority.textContent = testCase.priority || 'P2';
  const type = document.createElement('span');
  type.textContent = testCase.type || 'functional';
  meta.append(priority, type);

  const title = document.createElement('h3');
  title.textContent = testCase.title || 'Untitled test case';

  const objective = document.createElement('p');
  objective.textContent = testCase.objective || 'Verify the behavior described by TestPilot evidence.';

  const steps = document.createElement('ol');
  for (const step of testCase.steps || []) {
    const item = document.createElement('li');
    item.textContent = step;
    steps.appendChild(item);
  }

  const expected = document.createElement('p');
  expected.className = 'test-case-expected';
  expected.innerHTML = `<strong>Expected:</strong> ${escapeHtml(testCase.expectedResult || 'The flow completes without confirmed defects.')}`;

  const source = document.createElement('small');
  source.textContent = [testCase.sourceFinding, testCase.dataNeeded].filter(Boolean).join(' · ');

  article.append(meta, title, objective, steps, expected, source);
  return article;
}

function getCurrentTestCases() {
  return Array.isArray(state.ai.analysis?.testCases) ? state.ai.analysis.testCases : [];
}

function getSelectedTestCaseType() {
  return String(els.testCaseTypeSelect?.value || 'All Types').trim();
}

function getSelectedTestCaseFormat() {
  return String(els.testCaseFormatSelect?.value || 'Step-by-step').trim();
}

function filterTestCasesForSelectedType(testCases) {
  const selected = getSelectedTestCaseType().toLowerCase();
  if (!selected || selected === 'all types') return testCases;
  return testCases.filter((testCase) => String(testCase.type || '').toLowerCase().includes(selected.replace(/\s+/g, ' ')));
}

function readTestCasePreferences() {
  return {
    type: getSelectedTestCaseType(),
    format: getSelectedTestCaseFormat()
  };
}

function copyTestCases() {
  const testCases = filterTestCasesForSelectedType(getCurrentTestCases());
  if (!testCases.length) {
    showToast('No test cases to copy yet.', 'error');
    return;
  }
  copyText(buildTestCasesMarkdown(testCases), els.copyTestCasesBtn);
}

function exportTestCasesMarkdown() {
  const testCases = filterTestCasesForSelectedType(getCurrentTestCases());
  if (!testCases.length) {
    showToast('No test cases to export yet.', 'error');
    return;
  }
  downloadBlob(buildTestCasesMarkdown(testCases), `testpilot-test-cases-${dateFilePart()}.md`, 'text/markdown;charset=utf-8');
  showToast('Test cases exported.', 'success');
}

function clearTestCases() {
  if (!state.ai.analysis) return;
  state.ai.analysis = {
    ...state.ai.analysis,
    testCases: []
  };
  state.ai.activeMode = 'test-cases';
  schedulePersist();
  render();
  showToast('Test cases cleared.', 'success');
}

function buildTestCasesMarkdown(testCases) {
  const format = getSelectedTestCaseFormat();
  const lines = [
    '# TestPilot Test Cases',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Page: ${state.pageUrl || 'N/A'}`,
    `Type: ${getSelectedTestCaseType()}`,
    `Format: ${format}`,
    ''
  ];

  if (format === 'Gherkin') {
    for (const testCase of testCases) {
      lines.push(`Feature: ${testCase.title || 'TestPilot QA scenario'}`);
      lines.push(`  Scenario: ${testCase.objective || 'Verify captured behavior'}`);
      const steps = Array.isArray(testCase.steps) ? testCase.steps : [];
      steps.forEach((step, index) => {
        const keyword = index === 0 ? 'Given' : (index === steps.length - 1 ? 'Then' : 'When');
        lines.push(`    ${keyword} ${step}`);
      });
      lines.push(`    Then ${testCase.expectedResult || 'the flow should complete without confirmed defects'}`, '');
    }
    return lines.join('\n').trim();
  }

  if (format === 'Markdown table') {
    lines.push('| Priority | Type | Title | Objective | Expected |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const testCase of testCases) {
      lines.push(`| ${markdownCell(testCase.priority || 'P2')} | ${markdownCell(testCase.type || 'functional')} | ${markdownCell(testCase.title || 'Untitled test case')} | ${markdownCell(testCase.objective || '')} | ${markdownCell(testCase.expectedResult || '')} |`);
    }
    return lines.join('\n').trim();
  }

  for (const testCase of testCases) {
    lines.push(`## ${testCase.title || 'Untitled test case'}`);
    lines.push(`- Priority: ${testCase.priority || 'P2'}`);
    lines.push(`- Type: ${testCase.type || 'functional'}`);
    lines.push(`- Source: ${testCase.sourceFinding || 'TestPilot session'}`);
    lines.push(`- Data Needed: ${testCase.dataNeeded || 'Standard QA test data.'}`);
    lines.push('', testCase.objective || 'Verify the behavior described by TestPilot evidence.', '');
    lines.push('Steps:');
    (testCase.steps || []).forEach((step, index) => lines.push(`${index + 1}. ${step}`));
    lines.push('', `Expected Result: ${testCase.expectedResult || 'The flow completes without confirmed defects.'}`, '');
  }
  return lines.join('\n').trim();
}

function markdownCell(value) {
  return String(value ?? '').replace(/\s+/g, ' ').replaceAll('|', '\\|').trim();
}

function renderBugReportsState() {
  if (!els.bugReportsOutput || !els.bugReportsStatus) return;
  const isGenerating = state.ai.status === 'analyzing' && state.ai.lastTask === 'generate-bug-report';
  const drafts = getCurrentBugDrafts();

  if (isGenerating) {
    els.bugReportsStatus.textContent = 'Drafting bug reports from current findings and latest Agent evidence...';
    els.bugReportsOutput.classList.toggle('empty', false);
    els.bugReportsOutput.innerHTML = '<div class="bug-reports-loader"><span></span><strong>Building defect drafts</strong><p>TestPilot is using confirmed evidence and marking weak items for review.</p></div>';
    return;
  }

  if (!drafts.length) {
    els.bugReportsStatus.textContent = 'No generated bug reports yet.';
    els.bugReportsOutput.classList.toggle('empty', true);
    els.bugReportsOutput.innerHTML = '<strong>Ready to draft</strong><p>Capture findings or run Agent first, then generate bug reports from real evidence.</p>';
    return;
  }

  els.bugReportsStatus.textContent = `${drafts.length} bug draft${drafts.length === 1 ? '' : 's'} ready for tester review.`;
  els.bugReportsOutput.classList.toggle('empty', false);
  els.bugReportsOutput.innerHTML = '';
  for (const draft of drafts) {
    els.bugReportsOutput.appendChild(renderBugDraftCard(draft));
  }
}

function renderBugDraftCard(draft) {
  const article = document.createElement('article');
  article.className = 'bug-draft-card';

  const meta = document.createElement('div');
  meta.className = 'bug-draft-meta';
  const severity = document.createElement('span');
  severity.textContent = draft.severity || 'needs review';
  meta.appendChild(severity);

  const title = document.createElement('h3');
  title.textContent = draft.title || 'Untitled bug draft';

  const steps = document.createElement('ol');
  for (const step of draft.stepsToReproduce || []) {
    const item = document.createElement('li');
    item.textContent = step;
    steps.appendChild(item);
  }

  const expected = document.createElement('p');
  expected.innerHTML = `<strong>Expected:</strong> ${escapeHtml(draft.expectedResult || 'Expected behavior was not provided.')}`;
  const actual = document.createElement('p');
  actual.innerHTML = `<strong>Actual:</strong> ${escapeHtml(draft.actualResult || 'Actual behavior was not provided.')}`;
  const evidence = document.createElement('p');
  evidence.className = 'bug-draft-evidence';
  evidence.innerHTML = `<strong>Evidence:</strong> ${escapeHtml(draft.evidenceSummary || 'Evidence summary was not provided.')}`;

  article.append(meta, title);
  if (steps.children.length) article.appendChild(steps);
  article.append(expected, actual, evidence);
  return article;
}

function getCurrentBugDrafts() {
  return Array.isArray(state.ai.analysis?.bugReportDrafts) ? state.ai.analysis.bugReportDrafts : [];
}

function copyBugReportDrafts() {
  const drafts = getCurrentBugDrafts();
  if (!drafts.length) {
    showToast('No bug reports to copy yet.', 'error');
    return;
  }
  copyText(buildBugReportsMarkdown(drafts), els.copyBugReportDraftsBtn);
}

function exportBugReportMarkdown() {
  const drafts = getCurrentBugDrafts();
  if (!drafts.length) {
    showToast('No bug reports to export yet.', 'error');
    return;
  }
  downloadBlob(buildBugReportsMarkdown(drafts), `testpilot-bug-reports-${dateFilePart()}.md`, 'text/markdown;charset=utf-8');
  showToast('Bug report Markdown exported.', 'success');
}

function exportBugReportJson() {
  const drafts = getCurrentBugDrafts();
  if (!drafts.length) {
    showToast('No bug reports to export yet.', 'error');
    return;
  }
  const payload = {
    tool: 'TestPilot',
    version: VERSION,
    generatedAt: new Date().toISOString(),
    pageUrl: state.pageUrl,
    bugReportDrafts: drafts
  };
  downloadBlob(JSON.stringify(payload, null, 2), `testpilot-bug-reports-${dateFilePart()}.json`, 'application/json');
  showToast('Bug report JSON exported.', 'success');
}

function clearBugReports() {
  if (!state.ai.analysis) return;
  state.ai.analysis = {
    ...state.ai.analysis,
    bugReportDrafts: []
  };
  state.ai.activeMode = 'bug-reports';
  schedulePersist();
  render();
  showToast('Bug reports cleared.', 'success');
}

function buildBugReportsMarkdown(drafts) {
  const lines = [
    '# TestPilot Bug Reports',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Page: ${state.pageUrl || 'N/A'}`,
    ''
  ];

  for (const draft of drafts) {
    lines.push(`## ${draft.title || 'Untitled bug draft'}`);
    lines.push(`Severity: ${draft.severity || 'needs review'}`, '');
    lines.push('Steps to Reproduce:');
    (draft.stepsToReproduce || []).forEach((step, index) => lines.push(`${index + 1}. ${step}`));
    lines.push('', `Expected Result: ${draft.expectedResult || 'N/A'}`);
    lines.push(`Actual Result: ${draft.actualResult || 'N/A'}`);
    lines.push(`Evidence: ${draft.evidenceSummary || 'N/A'}`, '');
  }

  return lines.join('\n').trim();
}

function makeBugDraftSection(drafts) {
  const section = document.createElement('section');
  section.className = 'ai-result-section ai-card-list';
  const heading = document.createElement('h3');
  heading.textContent = 'Drafts';
  section.appendChild(heading);
  const items = Array.isArray(drafts) ? drafts : [];
  if (!items.length) {
    const p = document.createElement('p');
    p.textContent = 'No bug drafts were generated because AI did not find confirmed enough evidence.';
    section.appendChild(p);
    return section;
  }
  for (const draft of items) {
    const article = document.createElement('article');
    article.className = 'ai-item-card';
    const title = document.createElement('h4');
    title.textContent = draft.title || 'Untitled bug draft';
    const severity = document.createElement('p');
    severity.className = 'ai-item-meta';
    severity.textContent = `Severity: ${draft.severity || 'needs review'}`;
    const steps = document.createElement('ol');
    for (const step of draft.stepsToReproduce || []) {
      const li = document.createElement('li');
      li.textContent = step;
      steps.appendChild(li);
    }
    const expected = document.createElement('p');
    expected.innerHTML = `<strong>Expected:</strong> ${escapeHtml(draft.expectedResult || 'Expected behavior was not provided.')}`;
    const actual = document.createElement('p');
    actual.innerHTML = `<strong>Actual:</strong> ${escapeHtml(draft.actualResult || 'Actual behavior was not provided.')}`;
    const evidence = document.createElement('p');
    evidence.innerHTML = `<strong>Evidence:</strong> ${escapeHtml(draft.evidenceSummary || 'No evidence summary provided.')}`;
    article.append(title, severity, steps, expected, actual, evidence);
    section.appendChild(article);
  }
  return section;
}

async function checkAiHealth(options = {}) {
  const silent = Boolean(options.silent);
  state.settings = readSettingsFromForm();
  state.settings.aiProvider = {
    ...normalizeAiProviderSettings(state.settings.aiProvider),
    status: 'checking',
    lastError: ''
  };
  syncAiStateFromProviderStatus(state.settings.aiProvider);
  await chrome.storage.local.set({ testpilotSettings: state.settings });
  state.ai.status = 'checking';
  state.ai.error = '';
  const providerLabel = AI_PROVIDER_DEFAULTS[state.settings.aiProvider.provider]?.label || 'AI provider';
  addAiLog(`Checking ${providerLabel}${options.reason ? ` (${options.reason})` : ''}`);
  render();
  try {
    const result = await testAiProviderConnection(state.settings.aiProvider);
    state.ai.lastCheckedAt = Date.now();
    state.settings.aiProvider = {
      ...normalizeAiProviderSettings(state.settings.aiProvider),
      status: 'live',
      lastCheckedAt: state.ai.lastCheckedAt,
      lastError: '',
      usage: result.usage || null
    };
    state.settings.aiBackendUrl = getAiProviderBaseUrl(state.settings.aiProvider);
    syncAiStateFromProviderStatus(state.settings.aiProvider);
    addAiLog(`${providerLabel} is live.`);
    if (!silent) showToast('AI provider is live.', 'success');
    await chrome.storage.local.set({ testpilotSettings: state.settings });
    schedulePersist();
    render();
    return true;
  } catch (error) {
    const message = formatAiError(error);
    const status = /model|not found|unavailable/i.test(message) ? 'model_error' : 'offline';
    state.settings.aiProvider = {
      ...normalizeAiProviderSettings(state.settings.aiProvider),
      status,
      lastCheckedAt: Date.now(),
      lastError: message
    };
    syncAiStateFromProviderStatus(state.settings.aiProvider);
    state.ai.error = message;
    addAiLog(`Connection failed: ${state.ai.error}`);
    if (!silent) showToast('AI provider is not ready.', 'error');
    await chrome.storage.local.set({ testpilotSettings: state.settings });
    schedulePersist();
    render();
    return false;
  }
}

async function testAiProviderConnection(settings) {
  const providerSettings = normalizeAiProviderSettings(settings);
  validateAiProviderSettings(providerSettings);
  if (providerSettings.provider === 'local-backend') {
    const response = await fetchWithTimeout(`${getAiProviderBaseUrl(providerSettings)}/api/health`, { method: 'GET' }, 8000);
    if (!response.ok) throw new Error(`Backend returned ${response.status}`);
    const payload = await response.json().catch(() => ({}));
    if (payload.ai && payload.ai.ok === false) {
      throw new Error(payload.ai.error || payload.ai.note || 'Local model unavailable.');
    }
    return { text: 'OK', raw: payload };
  }

  const response = await completeWithAiProvider({
    settings: providerSettings,
    messages: [
      { role: 'system', content: 'You are a connection test endpoint.' },
      { role: 'user', content: 'Reply with only OK.' }
    ],
    mode: 'chat',
    maxTokens: 8,
    temperature: 0
  });
  if (!/ok/i.test(String(response.text || ''))) {
    throw new Error('Parse failed: provider did not return OK.');
  }
  return response;
}

function validateAiProviderSettings(settings) {
  const providerSettings = normalizeAiProviderSettings(settings);
  const defaults = AI_PROVIDER_DEFAULTS[providerSettings.provider] || AI_PROVIDER_DEFAULTS['local-backend'];
  if (defaults.needsApiKey && !providerSettings.apiKey) {
    throw new Error('Invalid API key: this provider requires an API key.');
  }
  if (['custom-api', 'custom-openai-compatible'].includes(providerSettings.provider) && !providerSettings.baseUrl) {
    throw new Error('Provider unreachable: Base URL is required for custom providers.');
  }
}

function buildProviderChatMessages(question) {
  const context = buildCompactAiSessionSummary('chat');
  const history = (state.ai.chatMessages || [])
    .filter((message) => ['user', 'assistant'].includes(message.role) && message.text)
    .slice(-6)
    .map((message) => ({
      role: message.role,
      content: String(message.text).slice(0, 1200)
    }));
  return [
    {
      role: 'system',
      content: [
        'You are TestPilot, a concise QA assistant inside a Chrome DevTools extension.',
        'Answer only from the provided sanitized QA session context.',
        'Do not invent bugs. If evidence is missing, ask for the next useful test.',
        'Never request or reveal API keys, cookies, passwords, or tokens.'
      ].join(' ')
    },
    ...history,
    {
      role: 'user',
      content: JSON.stringify({
        question,
        context,
        responseStyle: 'Clear, helpful, tester-friendly, no raw logs unless needed.'
      })
    }
  ];
}

function buildProviderTaskMessages(task) {
  const session = buildCompactAiSessionSummary(task);
  if (task === 'generate-test-cases') session.testCasePreferences = readTestCasePreferences();
  const taskLabel = {
    'analyze-session': 'session analysis',
    'generate-test-cases': 'test case generation',
    'generate-bug-report': 'bug report drafting'
  }[task] || task;
  return [
    {
      role: 'system',
      content: [
        `You are TestPilot AI for ${taskLabel}.`,
        'Return only valid JSON matching the requested schema.',
        'Use only the sanitized session evidence.',
        'Do not invent product features, credentials, headers, cookies, tokens, or screenshots.',
        'Mark weak evidence as needs review.'
      ].join(' ')
    },
    {
      role: 'user',
      content: JSON.stringify({
        task,
        schema: getAiAnalysisResponseSchema(task),
        session
      })
    }
  ];
}

function getAiAnalysisResponseSchema(task) {
  return {
    qaHealth: 'excellent|good|needs_review|risky|broken',
    executiveSummary: 'short string',
    actionableIssues: [{ title: 'string', severity: 'string', reason: 'string', recommendation: 'string' }],
    likelyFalsePositives: [{ title: 'string', reason: 'string' }],
    needsReview: [{ title: 'string', whatToVerify: 'string' }],
    recommendedNextTests: ['string'],
    testCases: task === 'generate-test-cases' ? [{
      title: 'string',
      objective: 'string',
      priority: 'P0|P1|P2|P3',
      type: 'functional|negative|edge|regression|smoke|accessibility|performance',
      sourceFinding: 'string',
      dataNeeded: 'string',
      steps: ['string'],
      expectedResult: 'string'
    }] : [],
    bugReportDrafts: task === 'generate-bug-report' ? [{
      title: 'string',
      severity: 'critical|high|medium|low|needs review',
      stepsToReproduce: ['string'],
      expectedResult: 'string',
      actualResult: 'string',
      evidenceSummary: 'string'
    }] : [],
    managerSummary: 'short string',
    developerSummary: 'short string'
  };
}

function buildCompactAiSessionSummary(task) {
  const session = buildAiSessionSummary(task);
  const mode = getAiContextMode(task);
  const limits = {
    fast: { actionable: 5, review: 5, tests: 4, evidence: 4 },
    balanced: { actionable: 8, review: 8, tests: 6, evidence: 6 },
    deep: { actionable: 12, review: 12, tests: 10, evidence: 8 }
  }[mode];
  const compact = {
    ...session,
    contextMode: mode,
    actionableFindings: dedupeAiItems(session.actionableFindings).slice(0, limits.actionable),
    needsReviewFindings: dedupeAiItems(session.needsReviewFindings).slice(0, limits.review),
    recommendedLimits: {
      historyMessages: mode === 'deep' ? 6 : 4,
      rawDomIncluded: false,
      rawHtmlIncluded: false,
      rawHeadersIncluded: false
    }
  };
  if (compact.latestAgentResult) {
    compact.latestAgentResult.actionResults = (compact.latestAgentResult.actionResults || []).slice(0, limits.evidence);
    compact.latestAgentResult.linkedEvidence = (compact.latestAgentResult.linkedEvidence || []).slice(0, limits.evidence);
    compact.latestAgentResult.evidence = (compact.latestAgentResult.evidence || []).slice(0, limits.evidence);
  }
  if (compact.recommendedNextTests) compact.recommendedNextTests = compact.recommendedNextTests.slice(0, limits.tests);
  return redactObject(compact);
}

function getAiContextMode(task) {
  if (task === 'generate-test-cases' || task === 'generate-bug-report') return 'deep';
  return ['fast', 'balanced', 'deep'].includes(state.settings.aiContextMode) ? state.settings.aiContextMode : 'fast';
}

function dedupeAiItems(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = JSON.stringify([item.type, item.title, item.evidenceSummary]).slice(0, 500);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getProviderMaxTokens(task) {
  const base = Number(state.settings.aiProvider?.maxTokens || DEFAULT_AI_PROVIDER_SETTINGS.maxTokens);
  if (task === 'chat') return Math.min(base, 900);
  if (task === 'generate-test-cases' || task === 'generate-bug-report') return Math.max(base, 1800);
  return base;
}

function parseJsonFromText(text) {
  const value = String(text || '').trim();
  if (!value) throw new Error('Parse failed: provider returned empty JSON.');
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Parse failed: provider did not return valid JSON.');
  }
}

function recordAiUsage(usage) {
  const normalized = normalizeProviderUsage(usage);
  if (!normalized) return;
  state.settings.aiProvider = {
    ...normalizeAiProviderSettings(state.settings.aiProvider),
    usage: normalized
  };
  const total = normalized.totalTokens || [normalized.inputTokens, normalized.outputTokens].filter(Boolean).join('/');
  if (total) addAiLog(`Token usage: ${total}`);
}

async function completeWithAiProvider({ settings, messages, mode = 'chat', maxTokens, temperature, responseFormat = 'text' }) {
  const providerSettings = normalizeAiProviderSettings(settings);
  validateAiProviderSettings(providerSettings);
  const defaults = AI_PROVIDER_DEFAULTS[providerSettings.provider] || AI_PROVIDER_DEFAULTS['local-backend'];
  const request = {
    messages: compactAiMessages(messages),
    mode,
    model: getAiProviderModel(providerSettings),
    maxTokens: clampNumber(maxTokens || providerSettings.maxTokens, 32, 12000, providerSettings.maxTokens),
    temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : providerSettings.temperature,
    responseFormat
  };

  if (providerSettings.provider === 'local-backend') {
    throw new Error('Local Backend provider should use local backend endpoints.');
  }
  if (defaults.adapter === 'gemini') return completeWithGemini(providerSettings, request);
  if (defaults.adapter === 'anthropic') return completeWithAnthropic(providerSettings, request);
  if (defaults.adapter === 'custom-api') return completeWithCustomApi(providerSettings, request);
  return completeWithOpenAiCompatible(providerSettings, request);
}

function getAiProviderModel(settings) {
  const providerSettings = normalizeAiProviderSettings(settings);
  if (providerSettings.modelMode === 'custom' && providerSettings.model) return providerSettings.model;
  const defaults = AI_PROVIDER_DEFAULTS[providerSettings.provider] || AI_PROVIDER_DEFAULTS['local-backend'];
  return defaults.recommendedModel || defaults.model || 'auto';
}

function compactAiMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .slice(-6)
    .map((message) => ({
      role: ['system', 'user', 'assistant'].includes(message.role) ? message.role : 'user',
      content: redactText(String(message.content || '')).slice(0, 12000)
    }))
    .filter((message) => message.content);
}

async function completeWithOpenAiCompatible(settings, request) {
  const headers = { 'Content-Type': 'application/json' };
  if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;
  const response = await fetchWithTimeout(getAiProviderBaseUrl(settings), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: request.model,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      response_format: request.responseFormat === 'json' ? { type: 'json_object' } : undefined,
      messages: request.messages
    })
  }, getProviderTimeoutMs(request.mode));
  const payload = await readProviderJson(response, 'OpenAI-compatible provider');
  const text = payload?.choices?.[0]?.message?.content || payload?.choices?.[0]?.text || '';
  if (!text) throw new Error('Parse failed: provider returned an empty response.');
  return { text, raw: payload, usage: normalizeProviderUsage(payload.usage) };
}

async function completeWithGemini(settings, request) {
  const model = encodeURIComponent(request.model || 'gemini-1.5-flash');
  const baseUrl = String(settings.baseUrl || AI_PROVIDER_DEFAULTS.gemini.baseUrl).replace(/\/+$/, '');
  const url = `${baseUrl}/${model}:generateContent?key=${encodeURIComponent(settings.apiKey)}`;
  const system = request.messages.find((message) => message.role === 'system')?.content || '';
  const contents = request.messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }]
    }));
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
        responseMimeType: request.responseFormat === 'json' ? 'application/json' : 'text/plain'
      }
    })
  }, getProviderTimeoutMs(request.mode));
  const payload = await readProviderJson(response, 'Gemini');
  const text = (payload?.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('').trim();
  if (!text) throw new Error('Parse failed: Gemini returned an empty response.');
  const usage = payload.usageMetadata ? {
    inputTokens: payload.usageMetadata.promptTokenCount,
    outputTokens: payload.usageMetadata.candidatesTokenCount,
    totalTokens: payload.usageMetadata.totalTokenCount
  } : null;
  return { text, raw: payload, usage };
}

async function completeWithAnthropic(settings, request) {
  const system = request.messages.find((message) => message.role === 'system')?.content || '';
  const messages = request.messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content
    }));
  const response = await fetchWithTimeout(getAiProviderBaseUrl(settings), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: request.model,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      system,
      messages
    })
  }, getProviderTimeoutMs(request.mode));
  const payload = await readProviderJson(response, 'Anthropic');
  const text = (payload?.content || []).map((part) => part.text || '').join('').trim();
  if (!text) throw new Error('Parse failed: Anthropic returned an empty response.');
  return { text, raw: payload, usage: normalizeProviderUsage(payload.usage) };
}

async function completeWithCustomApi(settings, request) {
  const headers = { 'Content-Type': 'application/json' };
  if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;
  const response = await fetchWithTimeout(getAiProviderBaseUrl(settings), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages: request.messages,
      mode: request.mode,
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      responseFormat: request.responseFormat
    })
  }, getProviderTimeoutMs(request.mode));
  const payload = await readProviderJson(response, 'Custom API');
  const text = payload.text || payload.answer || payload.message || payload.content || payload?.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('Parse failed: Custom API returned no text field.');
  return { text: String(text), raw: payload, usage: normalizeProviderUsage(payload.usage) };
}

async function readProviderJson(response, label) {
  const text = await response.text().catch(() => '');
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { text };
  }
  if (!response.ok) {
    const message = payload?.error?.message || payload?.error || payload?.message || text || `${label} returned ${response.status}`;
    if (response.status === 401 || response.status === 403) throw new Error(`Invalid API key: ${String(message).slice(0, 220)}`);
    if (response.status === 404) throw new Error(`Model unavailable: ${String(message).slice(0, 220)}`);
    throw new Error(`Provider unreachable: ${String(message).slice(0, 220)}`);
  }
  return payload;
}

function normalizeProviderUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  return {
    inputTokens: usage.prompt_tokens || usage.input_tokens || usage.inputTokens,
    outputTokens: usage.completion_tokens || usage.output_tokens || usage.outputTokens,
    totalTokens: usage.total_tokens || usage.totalTokens
  };
}

function getProviderTimeoutMs(mode) {
  if (mode === 'chat') return 90000;
  if (mode === 'test-cases' || mode === 'bug-report') return 180000;
  return 60000;
}

async function runAiTask(task, options = {}) {
  if (!state.startedAt) {
    showToast('Start a session before using AI analysis.', 'error');
    return;
  }
  state.settings = readSettingsFromForm();
  await chrome.storage.local.set({ testpilotSettings: state.settings });
  if (task === 'generate-test-cases') {
    setActiveView('test-cases');
  } else if (task === 'generate-bug-report') {
    setActiveView('bug-reports');
  }
  state.ai.status = 'analyzing';
  state.ai.lastTask = task;
  state.ai.activeMode = aiModeForTask(task);
  state.ai.error = '';
  addAiLog(`Running ${task} against ${state.settings.aiBackendUrl}`);
  render();

  const endpoint = {
    'analyze-session': '/api/ai/analyze-session',
    'generate-test-cases': '/api/ai/generate-test-cases',
    'generate-bug-report': '/api/ai/generate-bug-report'
  }[task];

  try {
    const providerReady = await checkAiHealth({ silent: true, reason: options.source || task });
    if (!providerReady) {
      showToast('AI provider is not ready. Check Settings > AI Provider.', 'error');
      return;
    }
    state.ai.status = 'analyzing';
    render();
    const providerSettings = normalizeAiProviderSettings(state.settings.aiProvider);
    let payload = null;
    if (providerSettings.provider === 'local-backend') {
      const session = buildCompactAiSessionSummary(task);
      if (task === 'generate-test-cases') {
        session.testCasePreferences = readTestCasePreferences();
      }
      const response = await fetchWithTimeout(`${getAiProviderBaseUrl(providerSettings)}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session })
      }, 90000);
      if (!response.ok) throw new Error(`AI backend returned ${response.status}`);
      payload = await response.json();
      state.ai.analysis = applyTestCasePreferencesToAnalysis(validateAiAnalysis(payload.analysis || payload), task);
    } else {
      const providerResponse = await completeAiTaskWithSelectedProvider(task);
      payload = providerResponse.raw || {};
      state.ai.analysis = applyTestCasePreferencesToAnalysis(validateAiAnalysis(providerResponse.analysis), task);
      if (providerResponse.usage) recordAiUsage(providerResponse.usage);
    }
    state.ai.status = 'complete';
    state.ai.lastCheckedAt = Date.now();
    if (payload.fallback) {
      addAiLog(`${task} used deterministic fallback: ${payload.fallbackReason || 'Ollama was slow or returned incomplete JSON.'}`);
    }
    addAiLog(`${task} complete.`);
    showToast('AI analysis complete.', 'success');
  } catch (error) {
    const providerSettings = normalizeAiProviderSettings(state.settings.aiProvider);
    if (providerSettings.provider !== 'local-backend') {
      state.ai.status = 'failed';
      state.ai.error = formatAiError(error);
      state.settings.aiProvider = {
        ...providerSettings,
        status: /model|parse/i.test(state.ai.error) ? 'model_error' : 'offline',
        lastError: state.ai.error,
        lastCheckedAt: Date.now()
      };
      addAiLog(`${task} failed: ${state.ai.error}`);
      showToast('AI provider request failed. No fallback output was generated.', 'error');
    } else {
      state.ai.analysis = applyTestCasePreferencesToAnalysis(buildLocalAiFallback(task, error), task);
      state.ai.status = 'complete';
      state.ai.error = '';
      addAiLog(`${task} used local fallback: ${formatAiError(error)}`);
      showToast('AI fallback generated from local findings.', 'success');
    }
  }
  schedulePersist();
  render();
}

async function completeAiTaskWithSelectedProvider(task) {
  const providerSettings = normalizeAiProviderSettings(state.settings.aiProvider);
  const messages = buildProviderTaskMessages(task);
  const response = await completeWithAiProvider({
    settings: providerSettings,
    messages,
    mode: task === 'generate-test-cases' ? 'test-cases' : (task === 'generate-bug-report' ? 'bug-report' : 'chat'),
    maxTokens: getProviderMaxTokens(task),
    temperature: providerSettings.temperature,
    responseFormat: 'json'
  });
  const parsed = parseJsonFromText(response.text);
  return {
    ...response,
    analysis: parsed
  };
}

function applyTestCasePreferencesToAnalysis(analysis, task) {
  if (task !== 'generate-test-cases' || !analysis || !Array.isArray(analysis.testCases)) return analysis;
  const selected = getSelectedTestCaseType();
  if (!selected || selected.toLowerCase() === 'all types') return analysis;
  const normalizedType = selected.toLowerCase();
  return {
    ...analysis,
    testCases: analysis.testCases.map((testCase) => ({
      ...testCase,
      type: String(testCase.type || '').toLowerCase().includes(normalizedType)
        ? testCase.type
        : normalizedType
    }))
  };
}

function formatAiError(error) {
  if (error && error.name === 'AbortError') {
    return 'Request timed out. TestPilot generated a local fallback; restart ai-backend to use the newest backend fallback.';
  }
  const message = error && error.message ? error.message : 'AI request failed.';
  if (/Failed to fetch/i.test(message)) {
    return 'Could not reach the backend. Start ai-backend with npm start and confirm the URL/port.';
  }
  return message;
}

function buildLocalAiFallback(task, error) {
  const session = buildAiSessionSummary(task);
  const actionable = session.actionableFindings || [];
  const needsReview = session.needsReviewFindings || [];
  const findings = [...actionable, ...needsReview].slice(0, 10);
  const recommendedNextTests = buildLocalRecommendedTests(session, findings);
  const testCases = buildLocalTestCases(session, findings, recommendedNextTests);
  const bugReportDrafts = buildLocalBugDrafts(session, actionable, needsReview);
  const hasActionable = actionable.length > 0;
  const hasReview = needsReview.length > 0;
  return validateAiAnalysis({
    qaHealth: hasActionable ? 'risky' : (hasReview ? 'needs_review' : 'good'),
    executiveSummary: `TestPilot generated this locally because AI did not finish: ${formatAiError(error)}`,
    actionableIssues: actionable.slice(0, 8).map((issue) => ({
      title: issue.title,
      severity: issue.severity,
      reason: issue.evidenceSummary || issue.description,
      recommendation: issue.recommendation
    })),
    likelyFalsePositives: session.frameworkNoiseSummary && session.frameworkNoiseSummary.count ? [{
      title: 'Framework/internal route prefetch traffic',
      reason: 'Speculative framework traffic was observed without confirmed user-facing failure.'
    }] : [],
    needsReview: needsReview.slice(0, 8).map((issue) => ({
      title: issue.title,
      whatToVerify: issue.recommendation || issue.evidenceSummary || 'Confirm user impact before filing.'
    })),
    recommendedNextTests,
    testCases,
    bugReportDrafts,
    managerSummary: hasActionable
      ? 'Local fallback found actionable TestPilot evidence that should be reviewed before release.'
      : 'Local fallback did not find confirmed actionable defects. Run the generated checks for confidence.',
    developerSummary: `Local fallback generated ${testCases.length} test case(s) and ${bugReportDrafts.length} bug draft(s).`
  });
}

function buildLocalRecommendedTests(session, findings) {
  const tests = [];
  if (session.latestAgentResult) {
    tests.push(`Re-run agent command "${session.latestAgentResult.command || session.latestAgentResult.taskType}" and confirm status remains ${session.latestAgentResult.status}.`);
  }
  if (session.networkSummary && Number(session.networkSummary.businessApis || 0) > 0) {
    tests.push('Repeat the main user flow and verify business API calls return expected successful responses.');
  }
  if (session.consoleSummary && (Number(session.consoleSummary.errors || 0) > 0 || Number(session.consoleSummary.warnings || 0) > 0)) {
    tests.push('Repeat the flow and verify no meaningful console errors or warnings appear.');
  }
  tests.push(session.uiScanSummary && Number(session.uiScanSummary.scans || 0) > 0
    ? 'Re-run the visible viewport UI scan after fixes and confirm review items are gone.'
    : 'Run a visible viewport UI scan on the target screen after it reaches the intended state.');
  for (const finding of findings.slice(0, 4)) {
    tests.push(`Manually verify "${finding.title || 'captured finding'}" and confirm whether it is reproducible.`);
  }
  return Array.from(new Set(tests)).slice(0, 8);
}

function buildLocalTestCases(session, findings, recommendedNextTests) {
  const pageUrl = session.pageUrl || 'the tested page';
  const agentFinding = session.latestAgentResult ? [{
    title: `Agent ${session.latestAgentResult.taskType} result: ${session.latestAgentResult.status}`,
    type: 'agent',
    severity: session.latestAgentResult.status === 'failed' ? 'high' : 'medium',
    category: session.latestAgentResult.status === 'passed' ? 'passed' : 'needs-review',
    evidenceSummary: session.latestAgentResult.summary,
    recommendation: (session.latestAgentResult.recommendedNextSteps || [])[0] || 'Review the agent evidence and repeat the workflow.'
  }] : [];
  const sources = findings.length ? findings : (agentFinding.length ? agentFinding : recommendedNextTests.map((item, index) => ({
    title: `Follow-up QA check ${index + 1}`,
    type: index === 0 ? 'api' : 'ui',
    severity: 'medium',
    category: 'needs-review',
    evidenceSummary: item,
    recommendation: item
  })));
  return sources.slice(0, 8).map((finding, index) => ({
    title: `${priorityFromFinding(finding)} ${testTypeFromFinding(finding)} check: ${finding.title || `QA follow-up ${index + 1}`}`,
    objective: finding.description || finding.evidenceSummary || finding.recommendation || 'Verify the captured TestPilot observation.',
    priority: priorityFromFinding(finding),
    type: testTypeFromFinding(finding),
    sourceFinding: finding.title || 'TestPilot session',
    dataNeeded: 'Use a normal QA account and existing test data for this page.',
    steps: [
      `Open ${pageUrl}.`,
      'Start TestPilot, reload the page, and perform the user flow under test.',
      finding.recommendation || finding.evidenceSummary || 'Observe the behavior related to the captured finding.',
      'Confirm whether network, console, and visible UI evidence matches the expected result.'
    ],
    expectedResult: expectedResultFromFinding(finding)
  }));
}

function buildLocalBugDrafts(session, actionable, needsReview) {
  const pageUrl = session.pageUrl || 'the tested page';
  const agentCandidate = session.latestAgentResult && ['failed', 'needs_review'].includes(session.latestAgentResult.status) ? [{
    title: `Agent found ${session.latestAgentResult.status.replace('_', ' ')} in ${session.latestAgentResult.taskType}`,
    severity: session.latestAgentResult.status === 'failed' ? 'high' : 'needs review',
    description: session.latestAgentResult.summary,
    evidenceSummary: [
      ...(session.latestAgentResult.evidence || []),
      ...formatLinkedAgentEvidenceForSummary(session.latestAgentResult)
    ].join(' | '),
    recommendation: (session.latestAgentResult.recommendedNextSteps || [])[0]
  }] : [];
  const candidates = actionable.length ? actionable : (needsReview.length ? needsReview.slice(0, 3) : agentCandidate);
  return candidates.slice(0, 8).map((finding) => ({
    title: finding.title || 'TestPilot captured issue',
    severity: finding.severity || (finding.category === 'needs-review' ? 'needs review' : 'medium'),
    stepsToReproduce: [
      `Open ${pageUrl}.`,
      'Start TestPilot and reload the page.',
      'Repeat the tested flow that produced this evidence.',
      'Review the matching TestPilot finding and confirm the behavior.'
    ],
    expectedResult: expectedResultFromFinding(finding),
    actualResult: finding.description || finding.evidenceSummary || 'TestPilot captured evidence that requires review.',
    evidenceSummary: finding.evidenceSummary || finding.recommendation || 'Sanitized TestPilot finding evidence.'
  }));
}

function formatLinkedAgentEvidenceForSummary(agentResult) {
  return (agentResult.linkedEvidence || []).flatMap((group) => (
    (group.evidence || []).slice(0, 3).map((event) => (
      `Step ${Number(group.stepIndex || 0) + 1} ${group.action}: ${event.summary || event.title}`
    ))
  )).slice(0, 8);
}

function priorityFromFinding(finding) {
  if (finding.severity === 'critical') return 'P0';
  if (finding.severity === 'high') return 'P1';
  if (finding.severity === 'medium' || finding.category === 'actionable') return 'P2';
  return 'P3';
}

function testTypeFromFinding(finding) {
  const source = `${finding.type || ''} ${finding.title || ''}`.toLowerCase();
  if (source.includes('ui') || source.includes('visual') || source.includes('layout')) return 'visual';
  if (source.includes('console')) return 'regression';
  if (source.includes('api') || source.includes('network')) return 'functional';
  if (source.includes('slow') || source.includes('performance')) return 'performance';
  return 'regression';
}

function expectedResultFromFinding(finding) {
  if (finding.type === 'api') return 'The relevant API calls complete with expected status, timing, and no duplicate side effects.';
  if (finding.type === 'console') return 'The flow completes without meaningful console errors, runtime errors, or unhandled promise rejections.';
  if (finding.type === 'ui') return 'The visible UI remains readable, aligned, accessible, and usable in the tested viewport.';
  return finding.recommendation || 'The tested flow behaves correctly without confirmed user-facing defects.';
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function buildAiSessionSummary(task) {
  const counts = countIssues(state.issues);
  const health = calculateHealthScore(state.issues);
  const endedAt = state.endedAt || (state.active ? Date.now() : null);
  const sessionDurationMs = state.startedAt && endedAt ? Math.max(0, endedAt - state.startedAt) : null;
  const actionable = state.issues.filter((issue) => issue.category === 'actionable').slice(0, 12).map(summarizeIssueForAi);
  const needsReview = state.issues.filter((issue) => issue.category === 'needs-review').slice(0, 16).map(summarizeIssueForAi);
  const frameworkNoise = state.issues.filter((issue) => issue.category === 'framework-noise');

  return {
    task,
    pageUrl: redactUrl(state.pageUrl),
    sessionDurationMs,
    health,
    counts: {
      actionable: counts.actionable,
      needsReview: counts.needsReview,
      frameworkNoise: counts.frameworkNoise,
      informational: counts.informational,
      consoleErrors: counts.consoleErrors
    },
    actionableFindings: actionable,
    needsReviewFindings: needsReview,
    frameworkNoiseSummary: {
      count: counts.frameworkNoise,
      examples: frameworkNoise.slice(0, 8).map((issue) => ({
        title: issue.title,
        routeCount: issue.evidence && issue.evidence.routeCount,
        evidenceSummary: summarizeIssueEvidenceForAi(issue)
      }))
    },
    consoleSummary: {
      errors: state.issues.filter((issue) => issue.type === 'console' && issue.evidence && issue.evidence.level === 'error').length,
      warnings: state.issues.filter((issue) => issue.type === 'console' && issue.evidence && ['warn', 'warning'].includes(issue.evidence.level)).length,
      repeatedMessages: state.issues.filter((issue) => issue.type === 'console' && Number(issue.count || 1) > 1).length
    },
    uiScanSummary: {
      scans: state.uiStats.scans,
      lastScannedElements: state.uiStats.lastScannedElements,
      lastSkippedElements: state.uiStats.lastSkippedElements,
      ignoredDecorativeElements: state.uiStats.ignoredDecorativeElements,
      hitNodeLimit: state.uiStats.hitNodeLimit
    },
    latestAgentResult: summarizeAgentResultForAi(state.ai.lastAgentResult),
    networkSummary: {
      businessApis: state.networkStats.api,
      frameworkInternal: state.networkStats.framework,
      staticAssets: state.networkStats.static,
      documents: state.networkStats.documents,
      passed: state.networkStats.passed,
      failed: state.networkStats.failed,
      slow: state.networkStats.slow
    },
    environment: {
      viewport: state.environment.viewport,
      userAgentSummary: summarizeUserAgent(state.environment.userAgent)
    },
    privacy: {
      sanitized: true,
      excluded: ['cookies', 'authorization headers', 'tokens', 'passwords', 'raw headers', 'request bodies', 'response bodies', 'screenshots']
    }
  };
}

function summarizeAgentResultForAi(agentResult) {
  if (!agentResult || typeof agentResult !== 'object') return null;
  const result = agentResult.result || {};
  const plan = agentResult.plan || {};
  return {
    command: String(agentResult.command || '').slice(0, 500),
    taskType: agentResult.taskType || plan.taskType || 'general_page_validation',
    dataStrategy: agentResult.dataStrategy || plan.dataStrategy || 'unknown',
    requestKey: agentResult.requestKey || null,
    status: result.status || 'needs_review',
    summary: String(result.summary || plan.summary || '').slice(0, 1000),
    planSummary: String(plan.summary || '').slice(0, 500),
    riskLevel: plan.riskLevel || 'safe',
    evidenceQuality: agentResult.evidenceQuality || null,
    actionResults: (agentResult.actionResults || []).slice(0, 12).map((item) => ({
      action: item.action,
      targetIndex: item.targetIndex,
      targetLabel: item.targetLabel,
      success: Boolean(item.success),
      message: String(item.message || '').slice(0, 300),
      startedAt: item.startedAt || item.timestamp || null,
      completedAt: item.completedAt || null,
      linkedEvidence: (item.linkedEvidence || []).slice(0, 4).map((event) => ({
        type: event.type,
        severity: event.severity,
        summary: String(event.summary || event.title || '').slice(0, 300),
        url: event.url
      }))
    })),
    linkedEvidence: (agentResult.linkedEvidence || []).slice(0, 8).map((group) => ({
      stepIndex: group.stepIndex,
      action: group.action,
      targetIndex: group.targetIndex,
      evidence: (group.evidence || []).slice(0, 4).map((event) => ({
        type: event.type,
        severity: event.severity,
        summary: String(event.summary || event.title || '').slice(0, 300),
        url: event.url
      }))
    })),
    evidence: (result.evidence || []).slice(0, 8).map((item) => String(item).slice(0, 500)),
    recommendedNextSteps: (result.recommendedNextSteps || []).slice(0, 6).map((item) => String(item).slice(0, 300))
  };
}

function summarizeIssueForAi(issue) {
  return {
    type: issue.type,
    category: issue.category,
    severity: issue.severity,
    confidence: issue.confidence,
    title: issue.title,
    description: issue.description,
    userImpact: issue.userImpact,
    recommendation: issue.recommendation,
    pageUrl: issue.url || redactUrl(state.pageUrl),
    duplicateCount: issue.count,
    evidenceSummary: summarizeIssueEvidenceForAi(issue)
  };
}

function summarizeIssueEvidenceForAi(issue) {
  const evidence = issue.evidence || {};
  if (issue.type === 'api') {
    return [
      evidence.method,
      evidence.status ? `status ${evidence.status}` : '',
      evidence.durationMs ? `${evidence.durationMs}ms` : '',
      evidence.logicalRoute || evidence.url
    ].filter(Boolean).join(' ');
  }
  if (issue.type === 'console') {
    return String(evidence.message || issue.description || '').slice(0, 240);
  }
  return [
    evidence.ruleId,
    evidence.selector,
    evidence.text,
    evidence.whyFlagged,
    evidence.falsePositiveNote
  ].filter(Boolean).join(' | ').slice(0, 260);
}

function summarizeUserAgent(value) {
  const text = String(value || '');
  if (!text) return '';
  const browser = text.match(/(Chrome|Firefox|Safari|Edg)\/[\d.]+/);
  const platform = text.match(/\(([^)]+)\)/);
  return [browser && browser[0], platform && platform[1]].filter(Boolean).join(' on ').slice(0, 160);
}

function validateAiAnalysis(value) {
  if (!value || typeof value !== 'object') throw new Error('AI returned an invalid response.');
  const safeArray = (items, mapItem) => Array.isArray(items) ? items.slice(0, 12).map(mapItem).filter(Boolean) : [];
  const text = (item, fallback = '') => {
    const value = String(item ?? '').trim();
    return (value || String(fallback || '')).slice(0, 1200);
  };
  const qaHealth = ['excellent', 'good', 'needs_review', 'risky', 'broken'].includes(value.qaHealth)
    ? value.qaHealth
    : 'needs_review';
  const recommendedNextTests = safeArray(value.recommendedNextTests, (item) => text(item));
  const testCases = safeArray(value.testCases, (item) => ({
    title: text(item && item.title, 'Untitled test case'),
    objective: text(item && item.objective, 'Verify the behavior described by TestPilot evidence.'),
    priority: text(item && item.priority, 'P2'),
    type: text(item && item.type, 'functional'),
    sourceFinding: text(item && item.sourceFinding, 'TestPilot session'),
    dataNeeded: text(item && item.dataNeeded, 'Standard QA account or existing test data.'),
    steps: Array.isArray(item && item.steps) ? item.steps.slice(0, 10).map((step) => text(step)).filter(Boolean) : [],
    expectedResult: text(item && item.expectedResult, 'The flow completes without confirmed API, console, or UI defects.')
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
  const actionableIssues = safeArray(value.actionableIssues, (item) => ({
    title: text(item && item.title),
    severity: text(item && item.severity),
    reason: text(item && item.reason),
    recommendation: text(item && item.recommendation)
  }));
  const bugReportDrafts = safeArray(value.bugReportDrafts, (item) => ({
    title: text(item && item.title),
    severity: text(item && item.severity),
    stepsToReproduce: Array.isArray(item && item.stepsToReproduce) ? item.stepsToReproduce.slice(0, 8).map((step) => text(step)).filter(Boolean) : [],
    expectedResult: text(item && item.expectedResult),
    actualResult: text(item && item.actualResult),
    evidenceSummary: text(item && item.evidenceSummary)
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

  return {
    qaHealth,
    executiveSummary: text(value.executiveSummary, 'AI completed the review but did not provide an executive summary.'),
    actionableIssues,
    likelyFalsePositives: safeArray(value.likelyFalsePositives, (item) => ({
      title: text(item && item.title),
      reason: text(item && item.reason)
    })),
    needsReview: safeArray(value.needsReview, (item) => ({
      title: text(item && item.title),
      whatToVerify: text(item && item.whatToVerify)
    })),
    recommendedNextTests,
    testCases: testCases.length ? testCases : fallbackTestCases,
    bugReportDrafts: bugReportDrafts.length ? bugReportDrafts : fallbackBugDrafts,
    managerSummary: text(value.managerSummary, 'No manager summary was provided by AI.'),
    developerSummary: text(value.developerSummary, 'No developer summary was provided by AI.')
  };
}

function copyAiSummary() {
  if (!state.ai.analysis) {
    showToast('No AI summary to copy yet.', 'error');
    return;
  }
  const analysis = state.ai.analysis;
  const lines = [
    `AI QA Health: ${analysis.qaHealth}`,
    '',
    analysis.executiveSummary,
    '',
    'Recommended next tests:',
    ...analysis.recommendedNextTests.map((item) => `- ${item}`),
    '',
    'Manager summary:',
    analysis.managerSummary,
    '',
    'Developer summary:',
    analysis.developerSummary
  ];
  copyText(lines.join('\n').trim(), els.copyAiSummaryBtn);
}

function downloadAiMarkdown() {
  if (!state.ai.analysis) {
    showToast('No AI output to download yet.', 'error');
    return;
  }
  const mode = normalizeAiMode(state.ai.activeMode);
  const markdown = buildAiMarkdown(state.ai.analysis, mode);
  downloadBlob(markdown, `testpilot-ai-${mode}-${dateFilePart()}.md`, 'text/markdown;charset=utf-8');
  showToast('AI Markdown downloaded.', 'success');
}

function downloadAiJson() {
  if (!state.ai.analysis) {
    showToast('No AI output to download yet.', 'error');
    return;
  }
  const mode = normalizeAiMode(state.ai.activeMode);
  const payload = {
    tool: 'TestPilot',
    version: VERSION,
    generatedAt: new Date().toISOString(),
    mode,
    pageUrl: state.pageUrl,
    aiAnalysis: state.ai.analysis
  };
  downloadBlob(JSON.stringify(payload, null, 2), `testpilot-ai-${mode}-${dateFilePart()}.json`, 'application/json');
  showToast('AI JSON downloaded.', 'success');
}

function buildAiMarkdown(analysis, mode) {
  const lines = [
    `# TestPilot AI ${modeLabel(mode)}`,
    '',
    `Generated: ${new Date().toISOString()}`,
    `Page: ${state.pageUrl || 'N/A'}`,
    `AI QA Health: ${analysis.qaHealth}`,
    ''
  ];

  if (mode === 'test-cases') {
    lines.push('## Test Cases', '');
    for (const testCase of analysis.testCases || []) {
      lines.push(`### ${testCase.title}`);
      lines.push(`- Priority: ${testCase.priority || 'P2'}`);
      lines.push(`- Type: ${testCase.type || 'functional'}`);
      lines.push(`- Source: ${testCase.sourceFinding || 'TestPilot session'}`);
      lines.push(`- Data Needed: ${testCase.dataNeeded || 'Standard QA test data.'}`);
      lines.push('', testCase.objective || 'Verify the behavior described by TestPilot evidence.', '');
      lines.push('Steps:');
      (testCase.steps || []).forEach((step, index) => lines.push(`${index + 1}. ${step}`));
      lines.push('', `Expected Result: ${testCase.expectedResult || 'The flow completes without confirmed defects.'}`, '');
    }
    return lines.join('\n').trim();
  }

  if (mode === 'bug-reports') {
    lines.push('## Bug Report Drafts', '');
    for (const draft of analysis.bugReportDrafts || []) {
      lines.push(`### ${draft.title}`);
      lines.push(`Severity: ${draft.severity || 'needs review'}`, '');
      lines.push('Steps to Reproduce:');
      (draft.stepsToReproduce || []).forEach((step, index) => lines.push(`${index + 1}. ${step}`));
      lines.push('', `Expected Result: ${draft.expectedResult || 'N/A'}`);
      lines.push(`Actual Result: ${draft.actualResult || 'N/A'}`);
      lines.push(`Evidence: ${draft.evidenceSummary || 'N/A'}`, '');
    }
    return lines.join('\n').trim();
  }

  lines.push('## Executive Summary', '', analysis.executiveSummary || 'N/A', '');
  lines.push('## Actionable Issues', '');
  for (const item of analysis.actionableIssues || []) {
    lines.push(`- ${item.title}: ${item.reason} Recommendation: ${item.recommendation}`);
  }
  lines.push('', '## Needs Review', '');
  for (const item of analysis.needsReview || []) {
    lines.push(`- ${item.title}: ${item.whatToVerify}`);
  }
  lines.push('', '## Recommended Next Tests', '');
  for (const item of analysis.recommendedNextTests || []) {
    lines.push(`- ${item}`);
  }
  lines.push('', '## Manager Summary', '', analysis.managerSummary || 'N/A');
  lines.push('', '## Developer Summary', '', analysis.developerSummary || 'N/A');
  return lines.join('\n').trim();
}

function modeLabel(mode) {
  return {
    analysis: 'Analysis',
    'test-cases': 'Test Cases',
    'bug-reports': 'Bug Reports'
  }[mode] || 'Analysis';
}

function getSessionStatus() {
  if (state.unsupportedReason) return 'Unsupported Page';
  if (state.active && !state.reloadObserved) return 'Needs Reload';
  if (state.active) return 'Running';
  if (state.startedAt) return 'Stopped';
  return 'Not Started';
}

function getSessionHint() {
  if (state.unsupportedReason) return state.unsupportedReason;
  if (state.active && !state.reloadObserved) {
    return 'Reload recommended: reload now, then perform your test flow to capture complete network activity.';
  }
  if (state.active && state.capturedUrls.length > 3) {
    return 'This session contains multiple routes. For cleaner reports, test one page or flow per session.';
  }
  if (state.active) {
    return 'Capturing locally for this inspected page. Run the UI scan manually on the screen you want to review.';
  }
  if (state.startedAt) {
    return 'Session stopped. Review or export the temporary results, or start a new session for another page.';
  }
  return 'TestPilot captures one active inspected page at a time. Start a session, reload the page, then test.';
}

function renderSessionDuration() {
  if (!els.sessionDuration) return;
  if (!state.startedAt) {
    els.sessionDuration.textContent = '00:00';
    return;
  }
  const end = state.active ? Date.now() : (state.endedAt || Date.now());
  const totalSeconds = Math.max(0, Math.floor((end - state.startedAt) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  els.sessionDuration.textContent = hours
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function renderIssues() {
  const filtered = getFilteredIssues();
  const counts = countIssues(state.issues);
  els.findingsHeading.textContent = getFindingsHeading();
  els.issueCountText.textContent = `${filtered.length} finding${filtered.length === 1 ? '' : 's'}`;
  els.emptyState.classList.toggle('hidden', filtered.length > 0);
  const emptyTitle = els.emptyState.querySelector('strong');
  const emptyCopy = els.emptyState.querySelector('p');
  if (emptyTitle && emptyCopy) {
    els.emptyIcon.textContent = '✓';
    els.emptyIcon.classList.toggle('neutral', false);
    els.emptyIcon.classList.toggle('error', false);
    if (state.unsupportedReason) {
      els.emptyIcon.textContent = '!';
      els.emptyIcon.classList.toggle('error', true);
      emptyTitle.textContent = 'This page is unsupported.';
      emptyCopy.textContent = state.unsupportedReason;
    } else if (!state.startedAt) {
      els.emptyIcon.textContent = 'i';
      els.emptyIcon.classList.toggle('neutral', true);
      emptyTitle.textContent = 'Start a QA session';
      emptyCopy.textContent = 'Start the session and reload the page for complete API and console coverage.';
    } else if (els.typeFilter.value === 'console' && !state.issues.some((issue) => issue.type === 'console')) {
      emptyTitle.textContent = 'No console errors detected';
      emptyCopy.textContent = 'TestPilot captured console errors, warnings, runtime failures, and unhandled promise rejections during this session.';
    } else if (els.typeFilter.value === 'ui' && state.uiStats.scans === 0) {
      els.emptyIcon.textContent = 'i';
      els.emptyIcon.classList.toggle('neutral', true);
      emptyTitle.textContent = 'UI scan not run yet';
      emptyCopy.textContent = 'Open the screen you want to review, then run a focused UI scan from the dashboard.';
    } else if (els.typeFilter.value === 'ui' && !state.issues.some((issue) => issue.type === 'ui')) {
      emptyTitle.textContent = 'No UI findings on this screen';
      emptyCopy.textContent = 'The latest scan did not detect a confirmed layout, readability, image, or interaction concern.';
    } else if (counts.frameworkNoise > 0 && filtered.length === 0) {
      emptyTitle.textContent = 'No actionable API issues found';
      emptyCopy.textContent = `${counts.frameworkNoise} framework observation${counts.frameworkNoise === 1 ? ' is' : 's are'} hidden and not counted as application issues.`;
    } else if (state.issues.length > 0) {
      els.emptyIcon.textContent = 'i';
      els.emptyIcon.classList.toggle('neutral', true);
      emptyTitle.textContent = 'No findings match these filters.';
      emptyCopy.textContent = 'Reset the filters or choose another category to see the captured evidence.';
    } else {
      emptyTitle.textContent = 'No actionable issues found';
      emptyCopy.textContent = 'TestPilot did not detect a confirmed API, console, or UI problem in this session.';
    }
  }
  els.issuesList.innerHTML = '';

  for (const issue of filtered) {
    els.issuesList.appendChild(renderIssueCard(issue));
  }
}

function getFilteredIssues() {
  const selectedType = state.activeView === 'ui' ? 'ui' : els.typeFilter.value;
  const category = els.categoryFilter.value;
  const severity = els.severityFilter.value;
  const search = els.searchInput.value.trim().toLowerCase();

  return state.issues.filter((issue) => {
    if (selectedType === 'noise' && issue.category !== 'framework-noise' && issue.category !== 'informational') return false;
    if (selectedType !== 'all' && selectedType !== 'noise' && issue.type !== selectedType) return false;
    if (category === 'counted' && !issue.includeInIssueCount) return false;
    if (category !== 'all' && category !== 'counted' && issue.category !== category) return false;
    if (issue.category === 'framework-noise'
      && state.settings.hideFrameworkNoise
      && !state.settings.showNextPrefetchFindings
      && category !== 'framework-noise') return false;
    if (severity !== 'all' && issue.severity !== severity) return false;
    if (!search) return true;
    const haystack = [
      issue.title,
      issue.description,
      issue.url,
      JSON.stringify(issue.evidence || {})
    ].join(' ').toLowerCase();
    return haystack.includes(search);
  }).sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.lastSeenAt - a.lastSeenAt);
}

function getFindingsHeading() {
  if (state.activeView === 'ui') return 'UI Bug Findings';
  return 'Session Findings';
}

function renderIssueCard(issue) {
  const card = document.createElement('article');
  card.className = `issue-card ${issue.category}`;

  const header = document.createElement('header');
  const heading = document.createElement('div');
  heading.className = 'issue-heading';
  const titleBox = document.createElement('div');
  titleBox.className = 'issue-title';

  const typeBadge = document.createElement('span');
  typeBadge.className = `badge ${issue.type}`;
  typeBadge.textContent = issue.type;

  const severityBadge = document.createElement('span');
  severityBadge.className = `badge ${issue.severity}`;
  severityBadge.textContent = issue.severity;

  const categoryBadge = document.createElement('span');
  categoryBadge.className = `badge ${issue.category}`;
  categoryBadge.textContent = issue.category.replace('-', ' ');

  const evidence = issue.evidence || {};
  const evidenceBadges = [];
  if (evidence.method) {
    evidenceBadges.push(makeBadge(String(evidence.method).toUpperCase(), 'method'));
  }
  if (Number.isFinite(Number(evidence.status)) && Number(evidence.status) > 0) {
    const status = Number(evidence.status);
    evidenceBadges.push(makeBadge(String(status), status >= 400 ? 'status-error' : 'status-success'));
  }
  if (evidence.durationMs !== undefined
    && evidence.durationMs !== null
    && Number.isFinite(Number(evidence.durationMs))
    && Number(evidence.durationMs) >= 0) {
    evidenceBadges.push(makeBadge(`${Math.round(Number(evidence.durationMs))} ms`, 'metric'));
  }
  evidenceBadges.push(makeBadge(`${issue.confidence} confidence`, 'confidence'));
  if (issue.reviewStatus && issue.reviewStatus !== 'auto') {
    evidenceBadges.push(makeBadge(`tester ${issue.reviewStatus}`, issue.reviewStatus === 'ignored' ? 'informational' : issue.category));
  }

  const title = document.createElement('h3');
  title.textContent = issue.count > 1 ? `${issue.title} ×${issue.count}` : issue.title;

  titleBox.append(typeBadge, categoryBadge, severityBadge, ...evidenceBadges, title);
  heading.append(titleBox);

  const actions = document.createElement('div');
  actions.className = 'issue-actions';
  const realBtn = document.createElement('button');
  realBtn.textContent = 'Real Bug';
  realBtn.className = issue.reviewStatus === 'confirmed' ? 'active-review' : '';
  realBtn.title = 'Mark this finding as a tester-confirmed bug.';
  realBtn.addEventListener('click', () => updateIssueReviewStatus(issue.id, 'confirmed'));
  const reviewBtn = document.createElement('button');
  reviewBtn.textContent = 'Needs Review';
  reviewBtn.className = issue.reviewStatus === 'needs-review' ? 'active-review' : '';
  reviewBtn.title = 'Keep this finding for manual confirmation.';
  reviewBtn.addEventListener('click', () => updateIssueReviewStatus(issue.id, 'needs-review'));
  const ignoreBtn = document.createElement('button');
  ignoreBtn.textContent = 'Ignore';
  ignoreBtn.className = issue.reviewStatus === 'ignored' ? 'active-review ignored' : '';
  ignoreBtn.title = 'Mark this finding as ignored or likely false positive.';
  ignoreBtn.addEventListener('click', () => updateIssueReviewStatus(issue.id, 'ignored'));
  const copyBtn = document.createElement('button');
  copyBtn.textContent = issue.includeInIssueCount ? 'Copy Bug' : 'Copy Details';
  copyBtn.title = issue.includeInIssueCount
    ? 'Copy a ready-to-file bug description'
    : 'Copy the finding details';
  copyBtn.addEventListener('click', () => copyText(issue.suggestedBugText, copyBtn));
  actions.append(realBtn, reviewBtn, ignoreBtn, copyBtn);

  header.append(heading, actions);

  const description = document.createElement('p');
  description.className = 'issue-description';
  description.textContent = issue.description;

  const context = document.createElement('div');
  context.className = 'issue-context';
  context.append(
    makeContextBlock('User impact', issue.userImpact),
    makeContextBlock('Recommendation', issue.recommendation)
  );

  const meta = document.createElement('div');
  meta.className = 'issue-meta';
  meta.append(
    makeMetaLine('Confidence', issue.confidence),
    makeMetaLine('Seen', issue.count > 1 ? `${issue.count} times` : 'once'),
    makeMetaLine('Last seen', new Date(issue.lastSeenAt).toLocaleTimeString()),
    makeMetaLine('URL', issue.url || issue.evidence.url || 'N/A', 'url-line')
  );

  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'View technical evidence';
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(issue.evidence, null, 2);
  details.append(summary, pre);

  card.append(header, description, context, meta, details);
  return card;
}

function updateIssueReviewStatus(issueId, status) {
  const issue = state.issues.find((item) => item.id === issueId);
  if (!issue) return;
  const nextStatus = ['confirmed', 'needs-review', 'ignored'].includes(status) ? status : 'needs-review';
  issue.reviewStatus = nextStatus;
  issue.reviewedAt = Date.now();

  if (nextStatus === 'confirmed') {
    issue.category = 'actionable';
    issue.includeInIssueCount = true;
    issue.includeInReport = true;
    issue.confidence = issue.confidence === 'low' ? 'medium' : issue.confidence;
    issue.recommendation = issue.recommendation || 'Tester confirmed this finding. File and fix the defect.';
  } else if (nextStatus === 'needs-review') {
    issue.category = 'needs-review';
    issue.includeInIssueCount = true;
    issue.includeInReport = true;
    issue.recommendation = issue.recommendation || 'Manually verify reproducibility before filing.';
  } else {
    issue.category = 'informational';
    issue.severity = issue.severity === 'critical' || issue.severity === 'high' ? 'low' : issue.severity;
    issue.confidence = 'low';
    issue.includeInIssueCount = false;
    issue.includeInReport = true;
    issue.userImpact = 'Tester marked this as ignored or likely false positive.';
    issue.recommendation = 'Keep as context only. Do not file unless new user-impacting evidence appears.';
  }

  issue.suggestedBugText = buildSuggestedBugText(issue);
  state.lastUpdatedAt = Date.now();
  reportBuilderDirty = false;
  populateReportBuilderDraft({ force: true });
  schedulePersist();
  render();
  showToast(`Finding marked ${nextStatus.replace('-', ' ')}.`, 'success');
}

function makeBadge(text, className) {
  const badge = document.createElement('span');
  badge.className = `badge ${className}`;
  badge.textContent = text;
  return badge;
}

function makeContextBlock(label, value) {
  const div = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = label;
  div.append(strong, document.createTextNode(String(value)));
  return div;
}

function makeMetaLine(label, value, className = '') {
  const div = document.createElement('div');
  if (className) div.className = className;
  const strong = document.createElement('strong');
  strong.textContent = `${label}: `;
  div.append(strong, document.createTextNode(String(value)));
  return div;
}

function countIssues(issues) {
  return issues.reduce((acc, issue) => {
    const units = issue.category === 'framework-noise'
      ? Math.max(1, Number(issue.evidence && issue.evidence.routeCount) || (issue.evidence && issue.evidence.routes && issue.evidence.routes.length) || 1)
      : 1;
    if (issue.includeInIssueCount) {
      acc.totalIssues += 1;
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      acc[issue.type] = (acc[issue.type] || 0) + 1;
    }
    if (issue.category === 'actionable') acc.actionable += 1;
    if (issue.category === 'needs-review') acc.needsReview += 1;
    if (issue.category === 'framework-noise') acc.frameworkNoise += units;
    if (issue.category === 'informational') acc.informational += 1;
    if (issue.type === 'console' && issue.evidence && issue.evidence.level === 'error') acc.consoleErrors += 1;
    return acc;
  }, {
    totalIssues: 0,
    actionable: 0,
    needsReview: 0,
    frameworkNoise: 0,
    informational: 0,
    consoleErrors: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    api: 0,
    console: 0,
    ui: 0
  });
}

function calculateHealthScore(issues) {
  let score = 100;
  let actionableCount = 0;
  let needsReviewCount = 0;
  for (const issue of issues) {
    if (issue.category === 'framework-noise' || issue.category === 'informational' || issue.category === 'passed') continue;
    if (issue.category === 'needs-review') {
      needsReviewCount += 1;
      continue;
    }
    actionableCount += 1;
    score -= { critical: 28, high: 16, medium: 8, low: 2, info: 0 }[issue.severity] || 0;
  }
  score -= Math.min(25, needsReviewCount * 2);
  if (actionableCount === 0 && needsReviewCount > 0) score = Math.max(score, 75);
  if (actionableCount === 0 && needsReviewCount === 0) score = Math.max(score, 90);
  score = Math.max(0, Math.round(score));
  const label = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 55 ? 'Needs Review' : score >= 30 ? 'Risky' : 'Broken';
  return { score, label };
}

function buildExecutiveSummary(counts = countIssues(state.issues), health = calculateHealthScore(state.issues)) {
  const severityMessage = counts.critical || counts.high
    ? `${counts.critical} critical and ${counts.high} high counted findings detected.`
    : 'No critical or high counted issues detected.';
  const frameworkMessage = counts.frameworkNoise
    ? ` ${counts.frameworkNoise} framework prefetch route${counts.frameworkNoise === 1 ? '' : 's'} were observed without confirmed user-facing failure.`
    : '';
  return `QA Health: ${health.label} (${health.score}/100). ${severityMessage} ${counts.actionable} actionable, ${counts.needsReview} needs review.${frameworkMessage}`;
}

function severityRank(severity) {
  return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[severity] ?? 9;
}

function classifyNetworkRequest({ url, method, mimeType, resourceType, request, response, frameworkPrefetch }) {
  if (frameworkPrefetch) return 'framework';

  const lowerUrl = String(url).toLowerCase();
  const lowerMime = String(mimeType || '').toLowerCase();
  const lowerResource = String(resourceType || '').toLowerCase();
  const upperMethod = String(method || 'GET').toUpperCase();
  const accept = getHeaderValue(request.headers || [], 'accept');
  const contentType = getHeaderValue(response.headers || [], 'content-type');
  const jsonLike = lowerMime.includes('json')
    || String(accept).toLowerCase().includes('json')
    || String(contentType).toLowerCase().includes('json');
  const htmlLike = lowerMime.includes('html') || String(contentType).toLowerCase().includes('text/html');
  const staticLike = /^(image|font|stylesheet|script|media)$/.test(lowerResource)
    || /\.(?:css|js|mjs|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|mp4|webm|mp3|pdf)(?:\?|$)/i.test(lowerUrl);
  const apiPath = /\/api\/|\/graphql(?:\/|$)|\/rest\/|\/v\d+\//i.test(lowerUrl);
  const writeMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(upperMethod);

  // Browsers and media libraries often use fetch with Range for byte probes.
  // Treating non-JSON probes as APIs creates noisy duplicate-call findings.
  if (hasHeader(request.headers || [], 'range') && !jsonLike) return staticLike ? 'static' : 'documents';
  if (staticLike) return 'static';
  if (htmlLike || lowerResource === 'document') return 'documents';
  if (apiPath || jsonLike || writeMethod) return 'api';
  if ((lowerResource === 'xhr' || lowerResource === 'fetch') && !htmlLike) return 'api';

  return 'documents';
}

function getFrameworkPrefetch(request, url) {
  const headers = request.headers || [];
  const value = String(url || '');
  const segment = getHeaderValue(headers, 'next-router-segment-prefetch');
  const hasPrefetchHeader = getHeaderValue(headers, 'next-router-prefetch') === '1';
  const hasRscHeader = getHeaderValue(headers, 'rsc') === '1';
  const hasRscParam = /[?&]_rsc=/i.test(value);
  const looksLikeNextPayload = /\/__next\.|__PAGE__\.txt/i.test(value);

  if (!hasRscParam && !hasRscHeader && !hasPrefetchHeader && !segment && !looksLikeNextPayload) return null;

  return {
    framework: 'Next.js',
    route: normalizeNextRoute(segment || url)
  };
}

function normalizeNextRoute(value) {
  const raw = String(value || '/');
  let path = raw;
  try {
    path = new URL(raw, state.pageUrl || 'https://testpilot.invalid').pathname;
  } catch {
    path = raw.split('?')[0];
  }

  path = path
    .replace(/\/__next\..*$/i, '')
    .replace(/\/__PAGE__$/i, '')
    .replace(/\/index\.txt$/i, '/')
    .replace(/\/([^/]+)\.txt$/i, '/$1')
    .replace(/\/{2,}/g, '/');

  if (!path.startsWith('/')) path = `/${path}`;
  return path.length > 1 ? path.replace(/\/$/, '') : path;
}

function expectsJson(url, mimeType, contentType) {
  return String(mimeType || '').toLowerCase().includes('json')
    || String(contentType || '').toLowerCase().includes('json')
    || /\/api\/|\/graphql|\/rest\/|\/v\d+\//i.test(String(url));
}

function getHeaderValue(headers, name) {
  const target = String(name).toLowerCase();
  const header = (headers || []).find((item) => String(item.name || '').toLowerCase() === target);
  return header ? header.value : '';
}

function hasHeader(headers, name) {
  return Boolean(getHeaderValue(headers, name));
}

function redactHeaders(headers) {
  return (headers || []).map((header) => {
    const name = header.name || '';
    return {
      name,
      value: isSensitiveKey(name) ? '[REDACTED]' : redactText(header.value || '')
    };
  });
}

function redactObject(value) {
  if (Array.isArray(value)) return value.map(redactObject);
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? redactText(value) : value;
  }

  if (typeof value.name === 'string' && 'value' in value && isSensitiveKey(value.name)) {
    return {
      ...value,
      value: '[REDACTED]'
    };
  }

  const result = {};
  for (const [key, val] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof val === 'string') {
      result[key] = redactText(val);
    } else {
      result[key] = redactObject(val);
    }
  }
  return result;
}

function redactText(text, maxLength = 5000) {
  if (!text) return text;
  let output = String(text);
  output = output.replace(/(authorization\s*[:=]\s*)(bearer\s+)?[a-z0-9._\-+/=]+/gi, '$1[REDACTED]');
  output = output.replace(/\bbearer\s+[a-z0-9._\-+/=]+/gi, 'Bearer [REDACTED]');
  output = output.replace(/("?(?:access_token|refresh_token|id_token|token|password|api_key|secret)"?\s*[:=]\s*")([^"&\s]+)(")/gi, '$1[REDACTED]$3');
  output = output.replace(/((?:access_token|refresh_token|id_token|token|password|api_key|secret)=)([^&\s]+)/gi, '$1[REDACTED]');
  return output.slice(0, maxLength);
}

function isSensitiveKey(key) {
  const lower = String(key).toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => lower.includes(sensitive));
}

function redactUrl(url) {
  try {
    const parsed = new URL(url);
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (isSensitiveKey(key)) parsed.searchParams.set(key, '[REDACTED]');
    }
    return parsed.toString();
  } catch {
    return redactText(url);
  }
}

function getSensitiveQueryKeys(url) {
  try {
    const parsed = new URL(url);
    return Array.from(parsed.searchParams.keys()).filter(isSensitiveKey);
  } catch {
    return [];
  }
}

function shortUrlPath(url) {
  try {
    const parsed = new URL(url);
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (isSensitiveKey(key)) parsed.searchParams.set(key, '[REDACTED]');
    }
    return `${parsed.pathname}${parsed.search ? '?' + parsed.searchParams.toString().slice(0, 50) : ''}`;
  } catch {
    return redactText(String(url), 90);
  }
}

function stripCacheBusters(url) {
  try {
    const parsed = new URL(url);
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (/^(t|ts|timestamp|cacheBust|cache_bust|_|v)$/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function simpleHash(input) {
  const str = String(input || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return String(hash);
}

function buildSuggestedBugText(issue) {
  const evidence = issue.evidence || {};
  const lines = [
    `Title: ${issue.title}`,
    `Severity: ${capitalize(issue.severity)}`,
    `Category: ${capitalize(String(issue.category || '').replace('-', ' '))}`,
    `Area: ${capitalize(issue.type)}`,
    `URL: ${issue.url || evidence.url || 'N/A'}`,
    '',
    'Description:',
    issue.description || 'TestPilot detected this issue during a QA session.',
    '',
    'User Impact:',
    issue.userImpact || 'Potential impact requires confirmation.',
    '',
    'Recommendation:',
    issue.recommendation || 'Review and reproduce before filing.',
    '',
    'Evidence:',
    JSON.stringify(evidence, null, 2),
    '',
    'Expected Result:',
    getExpectedResult(issue),
    '',
    'Actual Result:',
    getActualResult(issue)
  ];
  return lines.join('\n');
}

function getExpectedResult(issue) {
  if (issue.type === 'api') return 'API should respond with the expected status, valid response body, and acceptable performance.';
  if (issue.type === 'console') return 'Page should not produce runtime console errors or meaningful warnings during the tested flow.';
  return 'UI should remain consistent, readable, responsive, and free from visual breakage.';
}

function getActualResult(issue) {
  return issue.title;
}

function renderReportBuilderState() {
  if (!els.reportBuilderTitle) return;
  if (!reportBuilderDirty) populateReportBuilderDraft();
  const hasDraft = Boolean(String(els.reportBuilderTitle.value || '').trim());
  if (els.copyReportBuilderBtn) els.copyReportBuilderBtn.disabled = !hasDraft;
  if (els.downloadReportBuilderBtn) els.downloadReportBuilderBtn.disabled = !hasDraft;
}

function populateReportBuilderDraft(options = {}) {
  if (!els.reportBuilderTitle) return;
  if (reportBuilderDirty && !options.force) return;
  const draft = buildReportBuilderDraft();
  writeReportBuilderDraft(draft);
  reportBuilderDirty = false;
  if (options.notify) showToast('Report builder refreshed from current evidence.', 'success');
}

function buildReportBuilderDraft() {
  const bugDraft = getCurrentBugDrafts()[0];
  if (bugDraft) {
    return {
      title: bugDraft.title || 'Untitled bug draft',
      severity: bugDraft.severity || 'needs review',
      status: bugDraft.severity === 'needs review' ? 'needs review' : 'confirmed',
      summary: bugDraft.actualResult || bugDraft.evidenceSummary || 'Generated bug draft requires tester review.',
      steps: (bugDraft.stepsToReproduce || []).map((step, index) => `${index + 1}. ${step}`).join('\n'),
      expected: bugDraft.expectedResult || 'Expected behavior was not provided.',
      actual: bugDraft.actualResult || 'Actual behavior was not provided.',
      evidence: bugDraft.evidenceSummary || 'No evidence summary was provided.'
    };
  }

  const issue = getPrimaryReportIssue();
  if (issue) {
    return {
      title: issue.title,
      severity: issue.reviewStatus === 'ignored' ? 'needs review' : issue.severity,
      status: issue.reviewStatus === 'confirmed'
        ? 'confirmed'
        : (issue.reviewStatus === 'ignored' ? 'ignored' : 'needs review'),
      summary: issue.description || issue.userImpact || 'TestPilot captured a finding for review.',
      steps: [
        `1. Open ${issue.url || state.pageUrl || 'the tested page'}.`,
        '2. Start TestPilot and reload the page.',
        '3. Repeat the tested flow that produced this evidence.',
        '4. Review the matching TestPilot finding.'
      ].join('\n'),
      expected: getExpectedResult(issue),
      actual: getActualResult(issue),
      evidence: summarizeEvidence(serializeFinding(issue))
    };
  }

  const agent = summarizeAgentResultForAi(state.ai.lastAgentResult);
  if (agent) {
    return {
      title: `Agent result: ${String(agent.taskType || 'workflow').replace(/_/g, ' ')}`,
      severity: agent.status === 'failed' ? 'high' : 'needs review',
      status: agent.status === 'passed' ? 'confirmed' : 'needs review',
      summary: agent.summary || 'Agent completed with evidence that needs review.',
      steps: [
        `1. Open ${state.pageUrl || 'the tested page'}.`,
        `2. Run Agent command: ${agent.command || agent.taskType || 'current workflow'}.`,
        '3. Review the action log and linked evidence.'
      ].join('\n'),
      expected: 'The agent workflow should complete safely and the observed page behavior should match the requested test.',
      actual: agent.summary || agent.status || 'Agent result needs review.',
      evidence: [
        ...(agent.evidence || []),
        ...(agent.linkedEvidence || []).flatMap((group) => (group.evidence || []).map((item) => item.summary))
      ].filter(Boolean).slice(0, 8).join('\n')
    };
  }

  return {
    title: '',
    severity: 'needs review',
    status: 'needs review',
    summary: '',
    steps: '',
    expected: '',
    actual: '',
    evidence: ''
  };
}

function getPrimaryReportIssue() {
  const reportable = state.issues
    .filter((issue) => issue.includeInReport && issue.category !== 'framework-noise')
    .sort((a, b) => {
      const statusRank = { confirmed: 0, auto: 1, 'needs-review': 2, ignored: 3 };
      return (statusRank[a.reviewStatus || 'auto'] ?? 1) - (statusRank[b.reviewStatus || 'auto'] ?? 1)
        || severityRank(a.severity) - severityRank(b.severity)
        || b.lastSeenAt - a.lastSeenAt;
    });
  return reportable[0] || null;
}

function writeReportBuilderDraft(draft) {
  els.reportBuilderTitle.value = draft.title || '';
  els.reportBuilderSeverity.value = normalizeReportBuilderOption(els.reportBuilderSeverity, draft.severity || 'needs review');
  els.reportBuilderStatus.value = normalizeReportBuilderOption(els.reportBuilderStatus, draft.status || 'needs review');
  els.reportBuilderSummary.value = draft.summary || '';
  els.reportBuilderSteps.value = draft.steps || '';
  els.reportBuilderExpected.value = draft.expected || '';
  els.reportBuilderActual.value = draft.actual || '';
  els.reportBuilderEvidence.value = draft.evidence || '';
}

function normalizeReportBuilderOption(select, value) {
  const normalized = String(value || '').toLowerCase();
  const options = Array.from(select?.options || []).map((option) => option.value);
  return options.includes(normalized) ? normalized : (options[0] || normalized);
}

function readReportBuilderDraft() {
  return {
    title: String(els.reportBuilderTitle?.value || '').trim(),
    severity: String(els.reportBuilderSeverity?.value || 'needs review').trim(),
    status: String(els.reportBuilderStatus?.value || 'needs review').trim(),
    summary: String(els.reportBuilderSummary?.value || '').trim(),
    stepsToReproduce: String(els.reportBuilderSteps?.value || '').split(/\r?\n/).map((step) => step.trim()).filter(Boolean),
    expectedResult: String(els.reportBuilderExpected?.value || '').trim(),
    actualResult: String(els.reportBuilderActual?.value || '').trim(),
    evidence: String(els.reportBuilderEvidence?.value || '').trim()
  };
}

function buildReportBuilderMarkdown(draft = readReportBuilderDraft()) {
  return [
    `# ${draft.title || 'TestPilot bug draft'}`,
    '',
    `Severity: ${draft.severity || 'needs review'}`,
    `Status: ${draft.status || 'needs review'}`,
    `Page: ${state.pageUrl || 'N/A'}`,
    '',
    '## Summary',
    draft.summary || 'No summary entered.',
    '',
    '## Steps to Reproduce',
    draft.stepsToReproduce.length ? draft.stepsToReproduce.join('\n') : 'No steps entered.',
    '',
    '## Expected Result',
    draft.expectedResult || 'N/A',
    '',
    '## Actual Result',
    draft.actualResult || 'N/A',
    '',
    '## Evidence',
    draft.evidence || 'N/A'
  ].join('\n');
}

function copyReportBuilderDraft() {
  const draft = readReportBuilderDraft();
  if (!draft.title) {
    showToast('No report builder draft to copy yet.', 'error');
    return;
  }
  copyText(buildReportBuilderMarkdown(draft), els.copyReportBuilderBtn);
}

function downloadReportBuilderDraft() {
  const draft = readReportBuilderDraft();
  if (!draft.title) {
    showToast('No report builder draft to export yet.', 'error');
    return;
  }
  downloadBlob(buildReportBuilderMarkdown(draft), `testpilot-bug-draft-${dateFilePart()}.md`, 'text/markdown;charset=utf-8');
  showToast('Bug draft Markdown exported.', 'success');
}

function capitalize(value) {
  return String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
}

function buildReport() {
  const counts = countIssues(state.issues);
  const health = calculateHealthScore(state.issues);
  const endedAt = state.endedAt || (state.active ? Date.now() : null);
  const consoleSummary = state.issues.reduce((summary, issue) => {
    if (issue.type !== 'console') return summary;
    const channel = issue.evidence && issue.evidence.channel;
    const level = issue.evidence && issue.evidence.level;
    if (channel === 'promise') summary.unhandledRejections += 1;
    if (['warn', 'warning'].includes(level)) summary.warnings += 1;
    if (level === 'error') summary.errors += 1;
    return summary;
  }, { errors: 0, warnings: 0, unhandledRejections: 0 });

  const reportable = state.issues.filter((issue) => (
    issue.includeInReport && (issue.category !== 'framework-noise' || state.settings.exportFrameworkNoise)
  ));
  const issues = reportable.filter((issue) => issue.category === 'actionable').map(serializeFinding);
  const observations = reportable
    .filter((issue) => issue.category === 'needs-review' || issue.category === 'informational')
    .map(serializeFinding);
  const frameworkNoise = reportable.filter((issue) => issue.category === 'framework-noise').map(serializeFinding);
  const passedChecks = buildPassedChecks();
  const ignoredFindings = buildIgnoredFindings();

  return {
    tool: 'TestPilot',
    version: VERSION,
    generatedAt: new Date().toISOString(),
    session: {
      id: state.sessionId,
      status: state.active ? 'running' : 'stopped',
      pageUrl: state.pageUrl,
      capturedUrls: state.capturedUrls,
      startedAt: state.startedAt ? new Date(state.startedAt).toISOString() : null,
      stoppedAt: state.endedAt ? new Date(state.endedAt).toISOString() : null,
      durationMs: state.startedAt && endedAt ? Math.max(0, endedAt - state.startedAt) : null,
      reloadObserved: state.reloadObserved,
      singlePageMode: true,
      storageMode: 'session',
      timeline: state.timeline
    },
    environment: state.environment,
    summary: {
      healthScore: health.score,
      healthLabel: health.label,
      executiveSummary: buildExecutiveSummary(counts, health),
      totalIssues: counts.totalIssues,
      actionable: counts.actionable,
      needsReview: counts.needsReview,
      frameworkNoise: counts.frameworkNoise,
      informational: counts.informational,
      bySeverity: {
        critical: counts.critical,
        high: counts.high,
        medium: counts.medium,
        low: counts.low,
        info: counts.info
      },
      byType: {
        api: counts.api,
        console: counts.console,
        ui: counts.ui
      },
      network: state.networkStats,
      console: consoleSummary,
      ui: state.uiStats,
      droppedIssues: state.droppedIssues
    },
    issues,
    observations,
    frameworkNoise,
    passedChecks,
    ignoredFindings,
    findings: reportable.map(serializeFinding),
    reportBuilderDraft: els.reportBuilderTitle ? readReportBuilderDraft() : null,
    aiAnalysis: state.settings.includeAiSummaryInReport && state.ai.analysis ? state.ai.analysis : null,
    latestAgentResult: summarizeAgentResultForAi(state.ai.lastAgentResult),
    redactionNotice: 'Common credentials, tokens, cookies, secrets, and sensitive query values are replaced with [REDACTED].',
    limitations: REPORT_LIMITATIONS,
    settings: serializeSettingsForReport()
  };
}

function serializeSettingsForReport() {
  const settings = normalizeSettings(state.settings);
  return {
    ...settings,
    aiProvider: {
      ...settings.aiProvider,
      apiKey: settings.aiProvider.apiKey ? maskApiKey(settings.aiProvider.apiKey) : '',
      hasApiKey: Boolean(settings.aiProvider.apiKey)
    }
  };
}

function serializeFinding(issue) {
  return {
    id: issue.id,
    fingerprint: issue.duplicateKey,
    type: issue.type,
    category: issue.category,
    severity: issue.severity,
    confidence: issue.confidence,
    title: issue.title,
    description: issue.description,
    userImpact: issue.userImpact,
    recommendation: issue.recommendation,
    includeInIssueCount: issue.includeInIssueCount,
    includeInReport: issue.includeInReport,
    reviewStatus: issue.reviewStatus || 'auto',
    reviewedAt: issue.reviewedAt ? new Date(issue.reviewedAt).toISOString() : null,
    pageUrl: issue.url || state.pageUrl,
    timestamp: new Date(issue.timestamp).toISOString(),
    firstSeenAt: new Date(issue.firstSeenAt).toISOString(),
    lastSeenAt: new Date(issue.lastSeenAt).toISOString(),
    duplicateCount: issue.count,
    evidence: issue.evidence,
    suggestedBugTitle: issue.includeInIssueCount ? issue.title : undefined,
    suggestedBugDescription: issue.includeInIssueCount ? issue.suggestedBugText : undefined,
    suggestedStepsToReproduce: issue.includeInIssueCount ? [
      `Open ${issue.url || state.pageUrl || 'the tested page'}.`,
      'Start TestPilot and reload the page.',
      'Repeat the tested action that produced this evidence.'
    ] : undefined
  };
}

function buildPassedChecks() {
  const checks = [];
  if (!state.issues.some((issue) => issue.type === 'console' && issue.category === 'actionable')) {
    checks.push({ type: 'console', title: 'No actionable console errors detected.' });
  }
  if (!state.issues.some((issue) => issue.type === 'api' && issue.category === 'actionable')) {
    checks.push({ type: 'api', title: 'No actionable business API failures detected.' });
  }
  if (state.uiStats.scans > 0 && !state.issues.some((issue) => issue.type === 'ui' && issue.category === 'actionable')) {
    checks.push({ type: 'ui', title: 'UI scan found no confirmed actionable visual defect.' });
  }
  if (state.reloadObserved) {
    checks.push({ type: 'session', title: 'Page reload was observed after session start.' });
  }
  return checks;
}

function buildIgnoredFindings() {
  const ignored = [];
  const manuallyIgnored = state.issues.filter((issue) => issue.reviewStatus === 'ignored');
  for (const issue of manuallyIgnored.slice(0, 12)) {
    ignored.push({
      type: issue.type,
      title: issue.title,
      count: issue.count || 1,
      reason: 'Tester marked this finding as ignored or likely false positive.'
    });
  }
  if (state.uiStats.ignoredDecorativeElements > 0) {
    ignored.push({
      type: 'ui',
      title: 'Decorative/background elements ignored',
      count: state.uiStats.ignoredDecorativeElements,
      reason: 'Canvas, background, pointer-events-none, low-opacity, and non-interactive decorative elements are excluded by default.'
    });
  }
  if (state.droppedIssues.api + state.droppedIssues.console + state.droppedIssues.ui > 0) {
    ignored.push({
      type: 'limits',
      title: 'Findings dropped by configured limits',
      count: state.droppedIssues.api + state.droppedIssues.console + state.droppedIssues.ui,
      reason: 'Session safety limits prevented additional unique findings from being stored.'
    });
  }
  return ignored;
}

function exportJson() {
  try {
    state.settings = readSettingsFromForm();
    const report = buildReport();
    downloadBlob(JSON.stringify(report, null, 2), `testpilot-report-${dateFilePart()}.json`, 'application/json');
    showToast('JSON report exported.', 'success');
  } catch (error) {
    console.error('[TestPilot] JSON export failed', error);
    setTemporaryText(els.exportJsonBtn, 'Export Failed');
    showToast('JSON report export failed.', 'error');
  }
}

function exportHtml() {
  try {
    state.settings = readSettingsFromForm();
    const report = buildReport();
    const html = renderHtmlReport(report);
    downloadBlob(html, `testpilot-report-${dateFilePart()}.html`, 'text/html');
    showToast('HTML report exported.', 'success');
  } catch (error) {
    console.error('[TestPilot] HTML export failed', error);
    setTemporaryText(els.exportHtmlBtn, 'Export Failed');
    showToast('HTML report export failed.', 'error');
  }
}

function renderHtmlReport(report) {
  const findingCard = (finding, includeEvidence = false) => `
    <article class="finding ${escapeHtml(finding.severity)}">
      <h3>${escapeHtml(finding.title)} ${finding.duplicateCount > 1 ? `×${finding.duplicateCount}` : ''}</h3>
      <p><strong>Category:</strong> ${escapeHtml(finding.category)} &nbsp; <strong>Type:</strong> ${escapeHtml(finding.type)} &nbsp; <strong>Severity:</strong> ${escapeHtml(finding.severity)} &nbsp; <strong>Confidence:</strong> ${escapeHtml(finding.confidence)}</p>
      <p>${escapeHtml(finding.description)}</p>
      <p><strong>User impact:</strong> ${escapeHtml(finding.userImpact)}</p>
      <p><strong>Recommendation:</strong> ${escapeHtml(finding.recommendation)}</p>
      <p><strong>URL:</strong> ${escapeHtml(finding.pageUrl || 'N/A')}</p>
      ${includeEvidence ? `<pre>${escapeHtml(JSON.stringify(finding.evidence, null, 2))}</pre>` : ''}
    </article>
  `;
  const section = (title, findings, emptyText) => `
    <section>
      <h2>${escapeHtml(title)}</h2>
      ${findings.length ? findings.map((finding) => findingCard(finding)).join('') : `<p class="muted">${escapeHtml(emptyText)}</p>`}
    </section>
  `;
  const aiSection = report.aiAnalysis ? `
    <section>
      <h2>AI Assistant Summary</h2>
      <p><strong>AI QA health:</strong> ${escapeHtml(report.aiAnalysis.qaHealth)}</p>
      <p>${escapeHtml(report.aiAnalysis.executiveSummary)}</p>
      <h3>Recommended next tests</h3>
      ${report.aiAnalysis.recommendedNextTests.length
        ? `<ul>${report.aiAnalysis.recommendedNextTests.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
        : '<p class="muted">No AI test suggestions were included.</p>'}
      <h3>Generated test cases</h3>
      ${report.aiAnalysis.testCases && report.aiAnalysis.testCases.length
        ? report.aiAnalysis.testCases.map((testCase) => `
          <article class="finding info">
            <h3>${escapeHtml(testCase.title)}</h3>
            <p><strong>Priority:</strong> ${escapeHtml(testCase.priority)} &nbsp; <strong>Type:</strong> ${escapeHtml(testCase.type)}</p>
            <p><strong>Objective:</strong> ${escapeHtml(testCase.objective)}</p>
            <p><strong>Data needed:</strong> ${escapeHtml(testCase.dataNeeded)}</p>
            <ol>${(testCase.steps || []).map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
            <p><strong>Expected:</strong> ${escapeHtml(testCase.expectedResult)}</p>
          </article>
        `).join('')
        : '<p class="muted">No AI test cases were included.</p>'}
      <h3>Bug report drafts</h3>
      ${report.aiAnalysis.bugReportDrafts.length
        ? report.aiAnalysis.bugReportDrafts.map((draft) => `
          <article class="finding ${escapeHtml(draft.severity || 'info')}">
            <h3>${escapeHtml(draft.title)}</h3>
            <p><strong>Severity:</strong> ${escapeHtml(draft.severity)}</p>
            <p><strong>Expected:</strong> ${escapeHtml(draft.expectedResult)}</p>
            <p><strong>Actual:</strong> ${escapeHtml(draft.actualResult)}</p>
            <p><strong>Evidence:</strong> ${escapeHtml(draft.evidenceSummary)}</p>
          </article>
        `).join('')
        : '<p class="muted">No AI bug drafts were included.</p>'}
      <h3>Manager summary</h3>
      <p>${escapeHtml(report.aiAnalysis.managerSummary || 'N/A')}</p>
      <h3>Developer summary</h3>
      <p>${escapeHtml(report.aiAnalysis.developerSummary || 'N/A')}</p>
    </section>
  ` : '';
  const apiFindings = report.findings.filter((finding) => (
    finding.type === 'api'
    && finding.category !== 'framework-noise'
    && finding.category !== 'passed'
  ));
  const consoleFindings = report.findings.filter((finding) => finding.type === 'console');
  const uiFindings = report.findings.filter((finding) => finding.type === 'ui');
  const rawAppendix = report.findings.map((finding) => findingCard(finding, true)).join('');
  const builder = report.reportBuilderDraft && report.reportBuilderDraft.title ? `
    <section>
      <h2>Ready-to-file draft</h2>
      <article class="finding ${escapeHtml(report.reportBuilderDraft.severity || 'info')}">
        <h3>${escapeHtml(report.reportBuilderDraft.title)}</h3>
        <p><strong>Status:</strong> ${escapeHtml(report.reportBuilderDraft.status || 'needs review')} &nbsp; <strong>Severity:</strong> ${escapeHtml(report.reportBuilderDraft.severity || 'needs review')}</p>
        <p>${escapeHtml(report.reportBuilderDraft.summary || 'No summary entered.')}</p>
        <h3>Steps to reproduce</h3>
        ${report.reportBuilderDraft.stepsToReproduce && report.reportBuilderDraft.stepsToReproduce.length
          ? `<ol>${report.reportBuilderDraft.stepsToReproduce.map((step) => `<li>${escapeHtml(step.replace(/^\d+\.\s*/, ''))}</li>`).join('')}</ol>`
          : '<p class="muted">No steps entered.</p>'}
        <p><strong>Expected:</strong> ${escapeHtml(report.reportBuilderDraft.expectedResult || 'N/A')}</p>
        <p><strong>Actual:</strong> ${escapeHtml(report.reportBuilderDraft.actualResult || 'N/A')}</p>
        <p><strong>Evidence:</strong> ${escapeHtml(report.reportBuilderDraft.evidence || 'N/A')}</p>
      </article>
    </section>
  ` : '';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>TestPilot QA Report ${escapeHtml(report.version)}</title>
  <style>
    * { box-sizing: border-box; }
    body { max-width: 1180px; margin: 0 auto; padding: 32px; font: 14px/1.6 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; background: #f8fafc; }
    header, section { margin-bottom: 16px; padding: 18px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; box-shadow: 0 1px 2px rgba(15, 23, 42, .06); }
    h1, h2, h3, p { margin-top: 0; }
    h1 { margin-bottom: 4px; font-size: 26px; letter-spacing: -.02em; }
    h2 { margin-bottom: 12px; font-size: 18px; }
    h3 { margin-bottom: 6px; font-size: 14px; }
    .report-kicker { margin-bottom: 2px; color: #2563eb; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .report-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 18px; margin-top: 14px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #475569; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: 10px; background: transparent; border: 0; box-shadow: none; padding: 0; }
    .metric { padding: 13px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; }
    .metric span { color: #64748b; font-size: 11px; }
    .metric strong { display: block; margin-top: 3px; font-size: 22px; }
    .finding { margin-top: 10px; padding: 13px 14px; border: 1px solid #e2e8f0; border-left-width: 4px; border-radius: 8px; background: #fff; }
    section .finding { background: #f8fafc; }
    .finding p { margin-bottom: 7px; color: #475569; }
    .critical { border-left-color: #dc2626; }
    .high { border-left-color: #ea580c; }
    .medium { border-left-color: #d97706; }
    .low { border-left-color: #2563eb; }
    .info { border-left-color: #64748b; }
    .notice { color: #475569; }
    .muted { color: #64748b; }
    pre { max-height: 420px; overflow: auto; padding: 12px; border-radius: 8px; color: #e2e8f0; background: #0f172a; font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; }
    @media (max-width: 760px) { body { padding: 16px; } .summary, .report-meta { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 480px) { .summary, .report-meta { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    <p class="report-kicker">Local QA evidence</p>
    <h1>TestPilot QA Report</h1>
    <p class="muted">Professional, redacted QA findings generated locally by TestPilot.</p>
    <div class="report-meta">
      <div><strong>Version:</strong> ${escapeHtml(report.version)}</div>
      <div><strong>Generated:</strong> ${escapeHtml(report.generatedAt)}</div>
      <div><strong>Tested page:</strong> ${escapeHtml(report.session.pageUrl || 'N/A')}</div>
      <div><strong>Session:</strong> ${escapeHtml(report.session.startedAt || 'N/A')} → ${escapeHtml(report.session.stoppedAt || 'Active/Not stopped')}</div>
      <div><strong>Reload observed:</strong> ${report.session.reloadObserved ? 'Yes' : 'No - early network requests may be missing'}</div>
    </div>
  </header>
  <section>
    <h2>Executive Summary</h2>
    <p><strong>QA Health:</strong> ${escapeHtml(report.summary.healthLabel)} (${report.summary.healthScore}/100)</p>
    <p>${escapeHtml(report.summary.executiveSummary)}</p>
  </section>
  ${builder}
  <section class="summary">
    <div class="metric"><span>Total Issues</span><strong>${report.summary.totalIssues}</strong></div>
    <div class="metric"><span>Actionable</span><strong>${report.summary.actionable}</strong></div>
    <div class="metric"><span>Needs Review</span><strong>${report.summary.needsReview}</strong></div>
    <div class="metric"><span>Framework Noise</span><strong>${report.summary.frameworkNoise}</strong></div>
    <div class="metric"><span>Critical</span><strong>${report.summary.bySeverity.critical}</strong></div>
    <div class="metric"><span>High</span><strong>${report.summary.bySeverity.high}</strong></div>
    <div class="metric"><span>API Issues</span><strong>${report.summary.byType.api}</strong></div>
    <div class="metric"><span>Console Issues</span><strong>${report.summary.byType.console}</strong></div>
    <div class="metric"><span>UI Issues</span><strong>${report.summary.byType.ui}</strong></div>
    <div class="metric"><span>Total API Calls</span><strong>${report.summary.network.api}</strong></div>
    <div class="metric"><span>Failed APIs</span><strong>${report.summary.network.failed}</strong></div>
    <div class="metric"><span>Slow APIs</span><strong>${report.summary.network.slow}</strong></div>
    <div class="metric"><span>Console Errors</span><strong>${report.summary.console.errors}</strong></div>
    <div class="metric"><span>UI Elements Scanned</span><strong>${report.summary.ui.scannedElements}</strong></div>
    <div class="metric"><span>Dropped by Limits</span><strong>${report.summary.droppedIssues.api + report.summary.droppedIssues.console + report.summary.droppedIssues.ui}</strong></div>
  </section>
  ${section('Actionable Issues', report.issues, 'No actionable issues detected.')}
  ${section('Needs Review', report.observations.filter((finding) => finding.category === 'needs-review'), 'No findings require manual review.')}
  ${section('API Findings', apiFindings, 'No reportable business API findings.')}
  ${section('Console Findings', consoleFindings, 'No reportable console findings.')}
  ${section('UI Findings', uiFindings, 'No reportable UI findings.')}
  ${aiSection}
  <section>
    <h2>Framework Noise / Ignored Findings</h2>
    ${[...report.frameworkNoise, ...report.observations.filter((finding) => finding.category === 'informational')].length
      ? [...report.frameworkNoise, ...report.observations.filter((finding) => finding.category === 'informational')].map((finding) => findingCard(finding)).join('')
      : '<p class="muted">No framework noise or informational findings were included.</p>'}
    ${report.ignoredFindings.length
      ? `<ul>${report.ignoredFindings.map((finding) => `<li><strong>${escapeHtml(finding.title)}:</strong> ${escapeHtml(finding.reason)} (${finding.count})</li>`).join('')}</ul>`
      : '<p class="muted">No findings were ignored by scanner heuristics or limits.</p>'}
  </section>
  <section>
    <h2>Passed Checks</h2>
    ${report.passedChecks.length ? `<ul>${report.passedChecks.map((check) => `<li>${escapeHtml(check.title)}</li>`).join('')}</ul>` : '<p class="muted">No passed checks recorded.</p>'}
  </section>
  <section>
    <h2>Environment</h2>
    <p><strong>User agent:</strong> ${escapeHtml(report.environment.userAgent || 'N/A')}</p>
    <p><strong>Viewport:</strong> ${escapeHtml(`${report.environment.viewport.width || 0} × ${report.environment.viewport.height || 0}`)}</p>
    <p><strong>Routes captured:</strong> ${escapeHtml(report.session.capturedUrls.join(', ') || 'N/A')}</p>
  </section>
  <section>
    <h2>Raw Evidence Appendix</h2>
    ${rawAppendix || '<p class="muted">No raw findings were recorded.</p>'}
  </section>
  <section class="notice">
    <h2>Privacy and known limitations</h2>
    <p>${escapeHtml(report.redactionNotice)}</p>
    <ul>${report.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
  </section>
</body>
</html>`;
}

function exportCsv() {
  state.settings = readSettingsFromForm();
  if (!state.settings.csvExportEnabled) {
    setTemporaryText(els.exportCsvBtn, 'Disabled');
    showToast('CSV export is disabled in Settings.', 'error');
    return;
  }
  try {
    const report = buildReport();
    const csv = buildCsvReport(report);
    downloadBlob(`\uFEFF${csv}`, `testpilot-report-${dateFilePart()}.csv`, 'text/csv;charset=utf-8');
    showToast('CSV report exported.', 'success');
  } catch (error) {
    console.error('[TestPilot] CSV export failed', error);
    setTemporaryText(els.exportCsvBtn, 'Export Failed');
    showToast('CSV report export failed.', 'error');
  }
}

function buildCsvReport(report) {
  const columns = [
    'Finding ID',
    'Category',
    'Type',
    'Severity',
    'Confidence',
    'Review Status',
    'Title',
    'Page URL',
    'User Impact',
    'Evidence Summary',
    'Recommendation',
    'Include In Issue Count',
    'Timestamp'
  ];
  const rows = report.findings.map((finding) => [
    finding.id,
    finding.category,
    finding.type,
    finding.severity,
    finding.confidence,
    finding.reviewStatus || 'auto',
    finding.title,
    finding.pageUrl,
    finding.userImpact,
    summarizeEvidence(finding),
    finding.recommendation,
    finding.includeInIssueCount,
    finding.timestamp
  ]);
  return [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function summarizeEvidence(finding) {
  const evidence = finding.evidence || {};
  if (finding.category === 'framework-noise') {
    const routeCount = evidence.routeCount || (evidence.routes && evidence.routes.length) || finding.duplicateCount;
    return `${routeCount} speculative Next.js route-data request route(s) returned errors`;
  }
  if (finding.type === 'api') {
    return [evidence.method, evidence.status, evidence.durationMs ? `${evidence.durationMs}ms` : '', evidence.logicalRoute || evidence.url]
      .filter(Boolean)
      .join(' ');
  }
  if (finding.type === 'console') return String(evidence.message || finding.description).slice(0, 240);
  return [evidence.ruleId, evidence.selector, evidence.text].filter(Boolean).join(' | ').slice(0, 240);
}

function csvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ');
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function copyBugReport() {
  const counts = countIssues(state.issues);
  const health = calculateHealthScore(state.issues);
  const priorities = state.issues.filter((issue) => issue.includeInIssueCount);
  const lines = [
    buildExecutiveSummary(counts, health),
    '',
    ...priorities.map((issue, index) => `${index + 1}. [${issue.category}] ${issue.title}`)
  ];
  const text = lines.join('\n').trim();
  copyText(text, els.copyReportBtn);
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    if (button) setTemporaryText(button, 'Copied');
    showToast('Copied to clipboard.', 'success');
  } catch {
    if (button) setTemporaryText(button, 'Copy Failed');
    showToast('Clipboard access failed.', 'error');
  }
}

function setTemporaryText(button, text) {
  if (!button) return;
  const original = button.textContent;
  button.textContent = text;
  setTimeout(() => { button.textContent = original; }, 1200);
}

function showToast(message, tone = '') {
  if (!els.toastRegion) return;
  if (toastTimer) clearTimeout(toastTimer);
  els.toastRegion.textContent = message;
  for (const className of ['visible', 'success', 'error']) {
    els.toastRegion.classList.toggle(className, className === 'visible' || className === tone);
  }
  toastTimer = setTimeout(() => {
    els.toastRegion.classList.toggle('visible', false);
  }, 2600);
}

function dateFilePart() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
