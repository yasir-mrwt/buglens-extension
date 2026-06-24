const portsByTabId = new Map();
const SESSION_STORAGE_PREFIX = 'testpilotSession:v4:';
const CONTEXT_MENU_SEND_SELECTION = 'testpilot-send-selection-to-ai';
const MAX_CONTEXT_MENU_SELECTION = 5000;

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

function addPort(tabId, port) {
  if (!portsByTabId.has(tabId)) portsByTabId.set(tabId, new Set());
  portsByTabId.get(tabId).add(port);
}

function removePort(tabId, port) {
  const ports = portsByTabId.get(tabId);
  if (!ports) return;
  ports.delete(port);
  if (ports.size === 0) portsByTabId.delete(tabId);
}

function relayToPanels(tabId, payload) {
  const ports = portsByTabId.get(tabId);
  if (!ports) return;
  for (const port of ports) {
    try {
      port.postMessage(payload);
    } catch (error) {
      console.warn('[TestPilot] Failed to relay message to panel', error);
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_SEND_SELECTION,
    title: 'Send selected text to TestPilot AI',
    contexts: ['selection']
  });
  chrome.storage.local.get('testpilotSettings', (stored) => {
    chrome.storage.local.set({
      testpilotSettings: {
        ...DEFAULT_SETTINGS,
        ...(stored.testpilotSettings || {})
      }
    });
  });
  chrome.storage.session.get(null, (stored) => {
    const legacyKeys = Object.keys(stored || {}).filter((key) => (
      key.startsWith('testpilotSession:') && !key.startsWith(SESSION_STORAGE_PREFIX)
    ));
    if (legacyKeys.length > 0) chrome.storage.session.remove(legacyKeys);
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || typeof tab.id !== 'number') return;
  if (info.menuItemId !== CONTEXT_MENU_SEND_SELECTION) return;
  const selectedText = sanitizeContextMenuText(info.selectionText || '', MAX_CONTEXT_MENU_SELECTION);
  if (!selectedText) return;
  relayToPanels(tab.id, {
    type: 'TESTPILOT_CONTENT_EVENT',
    tabId: tab.id,
    payload: {
      source: 'testpilot-content',
      kind: 'page-context',
      sessionId: null,
      payload: {
        type: 'selected-text',
        sourceLabel: 'Selected page text',
        selectedText,
        title: tab.title || '',
        url: tab.url || '',
        capturedAt: Date.now()
      }
    }
  });
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'testpilot-devtools') return;

  let connectedTabId = null;

  port.onMessage.addListener((message) => {
    if (!message || typeof message !== 'object') return;

    if (message.type === 'TESTPILOT_PANEL_INIT') {
      connectedTabId = Number(message.tabId);
      addPort(connectedTabId, port);
      port.postMessage({
        type: 'TESTPILOT_BACKGROUND_READY',
        tabId: connectedTabId
      });
    }
  });

  port.onDisconnect.addListener(() => {
    if (connectedTabId !== null) removePort(connectedTabId, port);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;

  if (message.source === 'testpilot-content') {
    const tabId = sender.tab && sender.tab.id;
    if (typeof tabId === 'number') {
      const storageKey = `${SESSION_STORAGE_PREFIX}${tabId}`;
      chrome.storage.session.get(storageKey, (stored) => {
        const session = stored[storageKey];
        const sessionId = session && session.active ? session.sessionId : message.sessionId;
        relayToPanels(tabId, {
          type: 'TESTPILOT_CONTENT_EVENT',
          tabId,
          payload: {
            ...message,
            sessionId
          }
        });
        sendResponse({ ok: true });
      });
      return true;
    }
  }

  if (message.type === 'TESTPILOT_GET_BACKGROUND_STATUS') {
    sendResponse({ ok: true, activePanels: portsByTabId.size });
    return true;
  }

  return false;
});

function sanitizeContextMenuText(value, maxLength) {
  let output = String(value || '').replace(/\s+/g, ' ').trim();
  output = output.replace(/(authorization\s*[:=]\s*)(bearer\s+)?[a-z0-9._\-+/=]+/gi, '$1[REDACTED]');
  output = output.replace(/\bbearer\s+[a-z0-9._\-+/=]+/gi, 'Bearer [REDACTED]');
  output = output.replace(/((?:access_token|refresh_token|id_token|token|password|api_key|secret)=)([^&\s]+)/gi, '$1[REDACTED]');
  return output.slice(0, maxLength);
}
