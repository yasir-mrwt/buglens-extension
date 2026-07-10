import { T as TESTPILOT_DEVTOOLS_PORT, a as TESTPILOT_PANEL_INIT, b as TESTPILOT_BACKGROUND_READY, c as TESTPILOT_CONTENT_SOURCE, d as TESTPILOT_GET_BACKGROUND_STATUS, e as TESTPILOT_CONTENT_EVENT } from "../assets/messages.js";
const DEFAULT_SETTINGS = {
  slowApiMs: 1e3,
  verySlowApiMs: 3e3,
  duplicateWindowMs: 2e3,
  maxBodyPreviewBytes: 1e4,
  maxApiIssues: 500,
  maxConsoleIssues: 300,
  maxUiIssues: 200,
  maxUiNodes: 4e3,
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
function mergeSettings(value) {
  return {
    ...DEFAULT_SETTINGS,
    ...value || {}
  };
}
const TESTPILOT_SETTINGS_KEY = "testpilotSettings";
const SESSION_STORAGE_PREFIX = "testpilotSession:v4:";
function sessionStorageKey(tabId) {
  return `${SESSION_STORAGE_PREFIX}${tabId}`;
}
function isLegacySessionStorageKey(key) {
  return key.startsWith("testpilotSession:") && !key.startsWith(SESSION_STORAGE_PREFIX);
}
const portsByTabId = /* @__PURE__ */ new Map();
const CONTEXT_MENU_SEND_SELECTION = "testpilot-send-selection-to-ai";
const MAX_CONTEXT_MENU_SELECTION = 5e3;
console.info("[TestPilot] Background service worker ready.");
function addPort(tabId, port) {
  var _a;
  if (!portsByTabId.has(tabId)) portsByTabId.set(tabId, /* @__PURE__ */ new Set());
  (_a = portsByTabId.get(tabId)) == null ? void 0 : _a.add(port);
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
      console.warn("[TestPilot] Failed to relay message to panel", error);
    }
  }
}
chrome.runtime.onInstalled.addListener(() => {
  console.info("[TestPilot] Background service worker installed.");
  chrome.contextMenus.create({
    id: CONTEXT_MENU_SEND_SELECTION,
    title: "Send selected text to TestPilot AI",
    contexts: ["selection"]
  });
  chrome.storage.local.get(TESTPILOT_SETTINGS_KEY, (stored) => {
    chrome.storage.local.set({
      [TESTPILOT_SETTINGS_KEY]: mergeSettings(stored[TESTPILOT_SETTINGS_KEY])
    });
  });
  chrome.storage.session.get(null, (stored) => {
    const legacyKeys = Object.keys(stored || {}).filter(isLegacySessionStorageKey);
    if (legacyKeys.length > 0) chrome.storage.session.remove(legacyKeys);
  });
});
chrome.runtime.onStartup.addListener(() => {
  console.info("[TestPilot] Background service worker heartbeat.");
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || typeof tab.id !== "number") return;
  if (info.menuItemId !== CONTEXT_MENU_SEND_SELECTION) return;
  const selectedText = sanitizeContextMenuText(info.selectionText || "", MAX_CONTEXT_MENU_SELECTION);
  if (!selectedText) return;
  relayToPanels(tab.id, {
    type: TESTPILOT_CONTENT_EVENT,
    tabId: tab.id,
    payload: {
      source: TESTPILOT_CONTENT_SOURCE,
      kind: "page-context",
      sessionId: null,
      payload: {
        type: "selected-text",
        sourceLabel: "Selected page text",
        selectedText,
        title: tab.title || "",
        url: tab.url || "",
        capturedAt: Date.now()
      }
    }
  });
});
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== TESTPILOT_DEVTOOLS_PORT) return;
  let connectedTabId = null;
  port.onMessage.addListener((message) => {
    if (!message || typeof message !== "object") return;
    if (message.type === TESTPILOT_PANEL_INIT) {
      connectedTabId = Number(message.tabId);
      addPort(connectedTabId, port);
      port.postMessage({
        type: TESTPILOT_BACKGROUND_READY,
        tabId: connectedTabId
      });
    }
  });
  port.onDisconnect.addListener(() => {
    if (connectedTabId !== null) removePort(connectedTabId, port);
  });
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return false;
  if ("source" in message && message.source === TESTPILOT_CONTENT_SOURCE) {
    const contentMessage = message;
    const tabId = sender.tab && sender.tab.id;
    if (typeof tabId === "number") {
      const storageKey = sessionStorageKey(tabId);
      chrome.storage.session.get(storageKey, (stored) => {
        const session = stored[storageKey];
        const sessionId = session && session.active ? session.sessionId : contentMessage.sessionId;
        relayToPanels(tabId, {
          type: TESTPILOT_CONTENT_EVENT,
          tabId,
          payload: {
            ...contentMessage,
            sessionId
          }
        });
        sendResponse({ ok: true });
      });
      return true;
    }
  }
  if (message.type === TESTPILOT_GET_BACKGROUND_STATUS) {
    console.info("[TestPilot] Background service worker heartbeat.");
    sendResponse({ ok: true, activePanels: portsByTabId.size });
    return true;
  }
  return false;
});
function sanitizeContextMenuText(value, maxLength) {
  let output = String(value || "").replace(/\s+/g, " ").trim();
  output = output.replace(/(authorization\s*[:=]\s*)(bearer\s+)?[a-z0-9._\-+/=]+/gi, "$1[REDACTED]");
  output = output.replace(/\bbearer\s+[a-z0-9._\-+/=]+/gi, "Bearer [REDACTED]");
  output = output.replace(/((?:access_token|refresh_token|id_token|token|password|api_key|secret)=)([^&\s]+)/gi, "$1[REDACTED]");
  return output.slice(0, maxLength);
}
