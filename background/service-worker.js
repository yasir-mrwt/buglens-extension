const portsByTabId = new Map();
const SESSION_STORAGE_PREFIX = 'buglensSession:v3:';

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
      console.warn('[BugLens] Failed to relay message to panel', error);
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('buglensSettings', (stored) => {
    chrome.storage.local.set({
      buglensSettings: {
        ...DEFAULT_SETTINGS,
        ...(stored.buglensSettings || {})
      }
    });
  });
  chrome.storage.session.get(null, (stored) => {
    const legacyKeys = Object.keys(stored || {}).filter((key) => (
      key.startsWith('buglensSession:') && !key.startsWith(SESSION_STORAGE_PREFIX)
    ));
    if (legacyKeys.length > 0) chrome.storage.session.remove(legacyKeys);
  });
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'buglens-devtools') return;

  let connectedTabId = null;

  port.onMessage.addListener((message) => {
    if (!message || typeof message !== 'object') return;

    if (message.type === 'BUGLENS_PANEL_INIT') {
      connectedTabId = Number(message.tabId);
      addPort(connectedTabId, port);
      port.postMessage({
        type: 'BUGLENS_BACKGROUND_READY',
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

  if (message.source === 'buglens-content') {
    const tabId = sender.tab && sender.tab.id;
    if (typeof tabId === 'number') {
      const storageKey = `${SESSION_STORAGE_PREFIX}${tabId}`;
      chrome.storage.session.get(storageKey, (stored) => {
        const session = stored[storageKey];
        const sessionId = session && session.active ? session.sessionId : message.sessionId;
        relayToPanels(tabId, {
          type: 'BUGLENS_CONTENT_EVENT',
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

  if (message.type === 'BUGLENS_GET_BACKGROUND_STATUS') {
    sendResponse({ ok: true, activePanels: portsByTabId.size });
    return true;
  }

  return false;
});
