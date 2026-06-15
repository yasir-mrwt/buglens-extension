const inspectedTabId = chrome.devtools.inspectedWindow.tabId;
const port = chrome.runtime.connect({ name: 'buglens-devtools' });
const VERSION = '0.4.0';
const SESSION_STORAGE_KEY = `buglensSession:v4:${inspectedTabId}`;

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
  allowedColors: []
};

const REPORT_LIMITATIONS = [
  'Network capture begins only after the DevTools panel and session are active.',
  'Chrome-restricted pages and Chrome Web Store pages cannot be inspected.',
  'Cross-origin iframe DOM and console details may be unavailable.',
  'Response bodies may be unavailable, encoded, cached, binary, or skipped by size limits.',
  'UI findings are rule-based QA hints, not pixel-perfect visual assertions.'
];

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
  activeView: 'dashboard',
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
  settings: { ...DEFAULT_SETTINGS }
};

let persistTimer = null;
let durationTimer = null;
let toastTimer = null;
let clearConfirmationTimer = null;
let clearConfirmationArmed = false;
let uiScanInProgress = false;

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
  dashboardGuidanceTitle: document.getElementById('dashboardGuidanceTitle'),
  dashboardGuidance: document.getElementById('dashboardGuidance'),
  viewPriorityBtn: document.getElementById('viewPriorityBtn'),
  viewReportsBtn: document.getElementById('viewReportsBtn'),
  quickExportBtn: document.getElementById('quickExportBtn'),
  quickCopyBtn: document.getElementById('quickCopyBtn'),
  actionableCount: document.getElementById('actionableCount'),
  reviewCount: document.getElementById('reviewCount'),
  frameworkCount: document.getElementById('frameworkCount'),
  consoleErrorCount: document.getElementById('consoleErrorCount'),
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

init().catch((error) => {
  console.warn('[BugLens] Panel initialization failed', error);
  state.active = false;
  state.unsupportedReason = 'BugLens could not initialize this panel. Reload the extension, the page, and DevTools.';
  try {
    render();
  } catch {
    // The panel DOM may not be ready enough to render an error state.
  }
});

async function init() {
  port.postMessage({ type: 'BUGLENS_PANEL_INIT', tabId: inspectedTabId });
  port.onMessage.addListener(handlePortMessage);
  bindEvents();
  await loadSettings();
  await restoreSession();
  await refreshInspectedPage();
  if (state.active && state.sessionId) await setContentSession(state.sessionId);
  render();
  registerNetworkListener();
  registerNavigationListener();
  durationTimer = setInterval(renderSessionDuration, 1000);
  window.addEventListener('beforeunload', () => {
    if (durationTimer) clearInterval(durationTimer);
  });
}

function bindEvents() {
  els.startBtn.addEventListener('click', startSession);
  els.stopBtn.addEventListener('click', stopSession);
  els.clearBtn.addEventListener('click', requestClearSession);
  els.uiScanBtn.addEventListener('click', runUiScan);
  for (const button of tabButtons) {
    button.addEventListener('click', () => setActiveView(button.dataset.tab));
    button.addEventListener('keydown', handleTabKeydown);
  }
  els.categoryFilter.addEventListener('change', renderIssues);
  els.severityFilter.addEventListener('change', renderIssues);
  els.searchInput.addEventListener('input', renderIssues);
  els.resetFiltersBtn.addEventListener('click', resetFilters);
  els.exportJsonBtn.addEventListener('click', exportJson);
  els.exportHtmlBtn.addEventListener('click', exportHtml);
  els.exportCsvBtn.addEventListener('click', exportCsv);
  els.copyReportBtn.addEventListener('click', copyBugReport);
  els.saveSettingsBtn.addEventListener('click', saveSettingsFromForm);
  els.resetSettingsBtn.addEventListener('click', resetSettingsToDefaults);
  els.viewPriorityBtn.addEventListener('click', focusPriorityFindings);
  els.viewReportsBtn.addEventListener('click', () => setActiveView('reports'));
  els.quickExportBtn.addEventListener('click', exportHtml);
  els.quickCopyBtn.addEventListener('click', copyBugReport);
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
  if (message.type === 'BUGLENS_CONTENT_EVENT') {
    handleContentEvent(message.payload);
  }
}

async function loadSettings() {
  const stored = await chrome.storage.local.get('buglensSettings');
  state.settings = { ...DEFAULT_SETTINGS, ...(stored.buglensSettings || {}) };
  writeSettingsToForm();
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
  els.allowedColors.value = (state.settings.allowedColors || []).join('\n');
}

async function saveSettingsFromForm() {
  const settings = readSettingsFromForm();
  state.settings = settings;
  await chrome.storage.local.set({ buglensSettings: settings });
  setTemporaryText(els.saveSettingsBtn, 'Saved');
  showToast('Settings saved locally.', 'success');
  render();
}

async function resetSettingsToDefaults() {
  state.settings = { ...DEFAULT_SETTINGS };
  writeSettingsToForm();
  await chrome.storage.local.set({ buglensSettings: state.settings });
  showToast('Default settings restored.', 'success');
  render();
}

function readSettingsFromForm() {
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
    allowedColors: els.allowedColors.value
      .split(/\n|,/) 
      .map((item) => item.trim())
      .filter(Boolean)
  };
}

function setActiveView(view) {
  const allowed = ['dashboard', 'api', 'console', 'ui', 'reports', 'settings'];
  state.activeView = allowed.includes(view) ? view : 'dashboard';
  if (document.body && document.body.dataset) document.body.dataset.activeView = state.activeView;
  for (const button of tabButtons) {
    const isActive = button.dataset.tab === state.activeView;
    button.classList.toggle('active', isActive);
    if (typeof button.setAttribute === 'function') {
      button.setAttribute('aria-selected', String(isActive));
      button.setAttribute('tabindex', isActive ? '0' : '-1');
    }
  }

  if (state.activeView === 'api' && state.settings.hideFrameworkNoise) {
    els.categoryFilter.value = 'counted';
  } else if (state.activeView === 'dashboard') {
    els.categoryFilter.value = 'counted';
  }
  render();
}

function resetFilters() {
  els.categoryFilter.value = 'counted';
  els.severityFilter.value = 'all';
  els.searchInput.value = '';
  renderIssues();
  showToast('Finding filters reset.', 'success');
}

function focusPriorityFindings() {
  setActiveView('dashboard');
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
    state.settings = { ...DEFAULT_SETTINGS, ...(saved.settings || state.settings || {}) };
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
    console.warn('[BugLens] Session restore failed', error);
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
  const result = await sendTabMessage({ type: 'BUGLENS_PING_CONTENT' });
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
  state.settings = readSettingsFromForm();
  await chrome.storage.local.set({ buglensSettings: state.settings });
  await setContentSession(state.sessionId);
  await persistSession();
  render();
  showToast('Session started. Reload the inspected page for complete capture.', 'success');
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
    type: 'BUGLENS_SET_SESSION',
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

  const serializable = {
    sessionId: state.sessionId,
    active: state.active,
    startedAt: state.startedAt,
    endedAt: state.endedAt,
    pageUrl: state.pageUrl,
    capturedUrls: state.capturedUrls,
    timeline: state.timeline,
    reloadObserved: state.reloadObserved,
    lastUpdatedAt: state.lastUpdatedAt,
    unsupportedReason: state.unsupportedReason,
    capabilities: state.capabilities,
    environment: state.environment,
    uiStats: state.uiStats,
    droppedIssues: state.droppedIssues,
    issues: state.issues,
    networkStats: state.networkStats
  };

  try {
    await chrome.storage.session.set({ [SESSION_STORAGE_KEY]: serializable });
  } catch (error) {
    console.warn('[BugLens] Session persistence failed', error);
  }
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
    }, 500);
  });
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
  render();
}

function analyzeConsolePayload(payload) {
  const level = payload.level || 'error';
  const message = redactText(String(payload.message || 'Console issue detected'), 500);
  const isRuntime = payload.channel === 'runtime' || payload.channel === 'promise';
  const severity = level === 'error' ? (isRuntime ? 'high' : 'medium') : 'low';

  return {
    type: 'console',
    severity,
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

async function runUiScan() {
  if (!state.active) {
    els.sessionHint.textContent = 'Start a session before running a UI scan so the result belongs to a report.';
    showToast('Start a session before running the UI scan.', 'error');
    return;
  }
  if (state.unsupportedReason || !state.capabilities.ui) {
    els.sessionHint.textContent = state.unsupportedReason || 'UI scanner is unavailable. Reload the inspected page to reconnect it.';
    showToast('UI scanner is unavailable. Reload the inspected page.', 'error');
    return;
  }

  state.settings = readSettingsFromForm();
  await chrome.storage.local.set({ buglensSettings: state.settings });
  uiScanInProgress = true;
  setScanButtonState(true);
  els.uiStatus.textContent = 'Scanning';

  try {
    const result = await sendTabMessage({
      type: 'BUGLENS_RUN_UI_SCAN',
      settings: state.settings
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
        type: 'ui-scan-completed',
        timestamp: state.lastUpdatedAt,
        pageUrl: state.pageUrl,
        issueCount: 0,
        scannedElementCount: scan.scannedElementCount || 0
      });
    }
    els.uiStatus.textContent = scan.hitNodeLimit
      ? `Complete (limit ${scan.maxUiNodes})`
      : `Complete (${scan.scannedElementCount || 0} nodes)`;
    showToast(
      issues.length
        ? `UI scan completed with ${issues.length} finding${issues.length === 1 ? '' : 's'}.`
        : 'UI scan completed with no findings.',
      'success'
    );
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
    els.uiStatus.textContent = 'Unavailable';
    showToast(error.message || 'UI scan could not run.', 'error');
  } finally {
    uiScanInProgress = false;
    setScanButtonState(false);
    schedulePersist();
    render();
  }
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
  let title = redactText(String(issue.title || 'BugLens issue'), 180);
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
  els.actionableCount.textContent = counts.actionable;
  els.reviewCount.textContent = counts.needsReview;
  els.frameworkCount.textContent = counts.frameworkNoise;
  els.consoleErrorCount.textContent = counts.consoleErrors;
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
  els.reportHealth.textContent = `${health.score}/100`;
  els.reportActionable.textContent = counts.actionable;
  els.reportReview.textContent = counts.needsReview;
  els.reportRoutes.textContent = new Set(state.capturedUrls.filter(Boolean)).size;
  els.reportPreview.textContent = buildExecutiveSummary(counts, health);
  renderDashboardGuidance(counts);

  renderIssues();
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
  return 'BugLens captures one active inspected page at a time. Start a session, reload the page, then test.';
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
    } else if (state.activeView === 'console' && !state.issues.some((issue) => issue.type === 'console')) {
      emptyTitle.textContent = 'No console errors detected';
      emptyCopy.textContent = 'BugLens captured console errors, warnings, runtime failures, and unhandled promise rejections during this session.';
    } else if (state.activeView === 'ui' && state.uiStats.scans === 0) {
      els.emptyIcon.textContent = 'i';
      els.emptyIcon.classList.toggle('neutral', true);
      emptyTitle.textContent = 'UI scan not run yet';
      emptyCopy.textContent = 'Open the screen you want to review, then run a focused UI scan.';
    } else if (state.activeView === 'ui' && !state.issues.some((issue) => issue.type === 'ui')) {
      emptyTitle.textContent = 'No UI findings on this screen';
      emptyCopy.textContent = 'The latest scan did not detect a confirmed layout, readability, image, or interaction concern.';
    } else if (state.activeView === 'api' && counts.frameworkNoise > 0 && filtered.length === 0) {
      emptyTitle.textContent = 'No actionable API issues found';
      emptyCopy.textContent = `${counts.frameworkNoise} framework observation${counts.frameworkNoise === 1 ? ' is' : 's are'} hidden and not counted as application issues.`;
    } else if (state.issues.length > 0) {
      els.emptyIcon.textContent = 'i';
      els.emptyIcon.classList.toggle('neutral', true);
      emptyTitle.textContent = 'No findings match these filters.';
      emptyCopy.textContent = 'Reset the filters or choose another category to see the captured evidence.';
    } else {
      emptyTitle.textContent = 'No actionable issues found';
      emptyCopy.textContent = 'BugLens did not detect a confirmed API, console, or UI problem in this session.';
    }
  }
  els.issuesList.innerHTML = '';

  for (const issue of filtered) {
    els.issuesList.appendChild(renderIssueCard(issue));
  }
}

function getFilteredIssues() {
  const type = ['api', 'console', 'ui'].includes(state.activeView) ? state.activeView : 'all';
  const category = els.categoryFilter.value;
  const severity = els.severityFilter.value;
  const search = els.searchInput.value.trim().toLowerCase();

  return state.issues.filter((issue) => {
    if (type !== 'all' && issue.type !== type) return false;
    if (state.activeView === 'dashboard' && !issue.includeInIssueCount) return false;
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
  if (state.activeView === 'api') return 'API Findings';
  if (state.activeView === 'console') return 'Console Findings';
  if (state.activeView === 'ui') return 'UI Findings';
  return 'Priority Findings';
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

  const title = document.createElement('h3');
  title.textContent = issue.count > 1 ? `${issue.title} ×${issue.count}` : issue.title;

  titleBox.append(typeBadge, categoryBadge, severityBadge, ...evidenceBadges, title);
  heading.append(titleBox);

  const actions = document.createElement('div');
  actions.className = 'issue-actions';
  const copyBtn = document.createElement('button');
  copyBtn.textContent = issue.includeInIssueCount ? 'Copy Bug' : 'Copy Details';
  copyBtn.title = issue.includeInIssueCount
    ? 'Copy a ready-to-file bug description'
    : 'Copy the finding details';
  copyBtn.addEventListener('click', () => copyText(issue.suggestedBugText, copyBtn));
  actions.append(copyBtn);

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
  for (const issue of issues) {
    if (issue.category === 'framework-noise' || issue.category === 'informational' || issue.category === 'passed') continue;
    if (issue.category === 'needs-review') {
      score -= 3;
      continue;
    }
    score -= { critical: 30, high: 18, medium: 9, low: 3, info: 0 }[issue.severity] || 0;
    if (issue.type === 'console' && issue.evidence && issue.evidence.level === 'error') score -= 5;
  }
  score = Math.max(0, Math.round(score));
  const label = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 55 ? 'Needs Attention' : 'At Risk';
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
    path = new URL(raw, state.pageUrl || 'https://buglens.invalid').pathname;
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
    issue.description || 'BugLens detected this issue during a QA session.',
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
    if (level === 'warn') summary.warnings += 1;
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
    tool: 'BugLens',
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
    redactionNotice: 'Common credentials, tokens, cookies, secrets, and sensitive query values are replaced with [REDACTED].',
    limitations: REPORT_LIMITATIONS,
    settings: state.settings
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
      'Start BugLens and reload the page.',
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
    const report = buildReport();
    downloadBlob(JSON.stringify(report, null, 2), `buglens-report-${dateFilePart()}.json`, 'application/json');
    showToast('JSON report exported.', 'success');
  } catch (error) {
    console.error('[BugLens] JSON export failed', error);
    setTemporaryText(els.exportJsonBtn, 'Export Failed');
    showToast('JSON report export failed.', 'error');
  }
}

function exportHtml() {
  try {
    const report = buildReport();
    const html = renderHtmlReport(report);
    downloadBlob(html, `buglens-report-${dateFilePart()}.html`, 'text/html');
    showToast('HTML report exported.', 'success');
  } catch (error) {
    console.error('[BugLens] HTML export failed', error);
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
  const apiFindings = report.findings.filter((finding) => (
    finding.type === 'api'
    && finding.category !== 'framework-noise'
    && finding.category !== 'passed'
  ));
  const consoleFindings = report.findings.filter((finding) => finding.type === 'console');
  const uiFindings = report.findings.filter((finding) => finding.type === 'ui');
  const rawAppendix = report.findings.map((finding) => findingCard(finding, true)).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>BugLens QA Report ${escapeHtml(report.version)}</title>
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
    <h1>BugLens QA Report</h1>
    <p class="muted">Professional, redacted QA findings generated locally by BugLens.</p>
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
  if (!state.settings.csvExportEnabled) {
    setTemporaryText(els.exportCsvBtn, 'Disabled');
    showToast('CSV export is disabled in Settings.', 'error');
    return;
  }
  try {
    const report = buildReport();
    const csv = buildCsvReport(report);
    downloadBlob(`\uFEFF${csv}`, `buglens-report-${dateFilePart()}.csv`, 'text/csv;charset=utf-8');
    showToast('CSV report exported.', 'success');
  } catch (error) {
    console.error('[BugLens] CSV export failed', error);
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
