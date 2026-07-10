import {
  TESTPILOT_BACKGROUND_READY,
  TESTPILOT_CONTENT_EVENT,
  TESTPILOT_CONTENT_SOURCE,
  TESTPILOT_DEVTOOLS_PORT,
  TESTPILOT_GET_BACKGROUND_STATUS,
  TESTPILOT_PANEL_INIT,
  type ContentMessage,
  type PanelRelayPayload,
  type RuntimeMessage
} from '../shared/messages';
import { mergeSettings } from '../shared/settings';
import {
  isLegacySessionStorageKey,
  sessionStorageKey,
  TESTPILOT_SETTINGS_KEY,
  type StoredSessionSnapshot,
  type StoredSettingsRecord
} from '../shared/storage';

const portsByTabId = new Map<number, Set<chrome.runtime.Port>>();
const CONTEXT_MENU_SEND_SELECTION = 'testpilot-send-selection-to-ai';
const MAX_CONTEXT_MENU_SELECTION = 5000;

console.info('[TestPilot] Background service worker ready.');

function addPort(tabId: number, port: chrome.runtime.Port) {
  if (!portsByTabId.has(tabId)) portsByTabId.set(tabId, new Set());
  portsByTabId.get(tabId)?.add(port);
}

function removePort(tabId: number, port: chrome.runtime.Port) {
  const ports = portsByTabId.get(tabId);
  if (!ports) return;
  ports.delete(port);
  if (ports.size === 0) portsByTabId.delete(tabId);
}

function relayToPanels(tabId: number, payload: PanelRelayPayload) {
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
  console.info('[TestPilot] Background service worker installed.');
  chrome.contextMenus.create({
    id: CONTEXT_MENU_SEND_SELECTION,
    title: 'Send selected text to TestPilot AI',
    contexts: ['selection']
  });
  chrome.storage.local.get(TESTPILOT_SETTINGS_KEY, (stored: StoredSettingsRecord) => {
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
  console.info('[TestPilot] Background service worker heartbeat.');
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || typeof tab.id !== 'number') return;
  if (info.menuItemId !== CONTEXT_MENU_SEND_SELECTION) return;
  const selectedText = sanitizeContextMenuText(info.selectionText || '', MAX_CONTEXT_MENU_SELECTION);
  if (!selectedText) return;
  relayToPanels(tab.id, {
    type: TESTPILOT_CONTENT_EVENT,
    tabId: tab.id,
    payload: {
      source: TESTPILOT_CONTENT_SOURCE,
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
  if (port.name !== TESTPILOT_DEVTOOLS_PORT) return;

  let connectedTabId: number | null = null;

  port.onMessage.addListener((message: RuntimeMessage) => {
    if (!message || typeof message !== 'object') return;

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

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;

  if ('source' in message && message.source === TESTPILOT_CONTENT_SOURCE) {
    const contentMessage = message as ContentMessage;
    const tabId = sender.tab && sender.tab.id;
    if (typeof tabId === 'number') {
      const storageKey = sessionStorageKey(tabId);
      chrome.storage.session.get(storageKey, (stored) => {
        const session = stored[storageKey] as StoredSessionSnapshot | undefined;
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
    console.info('[TestPilot] Background service worker heartbeat.');
    sendResponse({ ok: true, activePanels: portsByTabId.size });
    return true;
  }

  return false;
});

function sanitizeContextMenuText(value: unknown, maxLength: number) {
  let output = String(value || '').replace(/\s+/g, ' ').trim();
  output = output.replace(/(authorization\s*[:=]\s*)(bearer\s+)?[a-z0-9._\-+/=]+/gi, '$1[REDACTED]');
  output = output.replace(/\bbearer\s+[a-z0-9._\-+/=]+/gi, 'Bearer [REDACTED]');
  output = output.replace(/((?:access_token|refresh_token|id_token|token|password|api_key|secret)=)([^&\s]+)/gi, '$1[REDACTED]');
  return output.slice(0, maxLength);
}
