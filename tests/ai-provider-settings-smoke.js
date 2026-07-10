const fs = require('fs');
const vm = require('vm');

function element(id) {
  return {
    id,
    value: '',
    checked: false,
    disabled: false,
    textContent: '',
    innerHTML: '',
    dataset: {},
    style: {},
    classList: { toggle() {}, contains() { return false; } },
    addEventListener() {},
    append() {},
    appendChild() {},
    remove() {},
    removeAttribute() {},
    setAttribute() {},
    click() {},
    querySelector() { return element('child'); },
    replaceChildren() {}
  };
}

const elements = new Map();
const document = {
  body: element('body'),
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, element(id));
    return elements.get(id);
  },
  createElement: element,
  createTextNode(text) {
    return { textContent: text };
  },
  querySelectorAll() {
    return [];
  }
};

const port = {
  postMessage() {},
  onMessage: { addListener() {} },
  onDisconnect: { addListener() {} }
};

const chrome = {
  runtime: { connect() { return port; }, lastError: null },
  storage: {
    local: { async get() { return {}; }, async set() {} },
    session: { async get() { return {}; }, async set() {}, async remove() {} }
  },
  tabs: {
    sendMessage(_tabId, _message, callback) {
      callback({ ok: true });
    }
  },
  devtools: {
    inspectedWindow: {
      tabId: 1,
      eval(_expression, callback) {
        callback({
          url: 'https://example.test/',
          userAgent: 'TestPilot test',
          viewport: { width: 1280, height: 720 }
        }, null);
      }
    },
    network: {
      onRequestFinished: { addListener() {} },
      onNavigated: { addListener() {} }
    }
  }
};

const context = {
  chrome,
  document,
  window: { addEventListener() {} },
  navigator: { clipboard: { async writeText() {} } },
  crypto: require('crypto').webcrypto,
  URL,
  Blob,
  console,
  fetch() {
    throw new Error('Network should not be called by provider settings smoke test.');
  },
  setTimeout,
  clearTimeout,
  setInterval() { return 1; },
  clearInterval() {}
};

vm.createContext(context);

const panelSource = fs.readFileSync('src/devtools/panel/panelController.ts', 'utf8');
const testSource = `
state.settings = normalizeSettings({
  ...DEFAULT_SETTINGS,
  aiProvider: {
    provider: 'openai',
    apiKey: 'sk-test-secret-1234',
    status: 'live',
    lastCheckedAt: Date.now()
  }
});
state.sessionId = 'provider-test';
state.startedAt = Date.now();
state.pageUrl = 'https://example.test/?token=super-secret';

globalThis.__masked = maskApiKey(state.settings.aiProvider.apiKey);
globalThis.__reportSettings = serializeSettingsForReport();
globalThis.__contentSettings = buildContentScriptSettings();
globalThis.__messages = buildProviderChatMessages('Summarize this session.');
globalThis.__missingKeyError = '';
try {
  validateAiProviderSettings({ provider: 'openai', apiKey: '' });
} catch (error) {
  globalThis.__missingKeyError = error.message;
}
validateAiProviderSettings({ provider: 'local-backend', apiKey: '' });
`;

vm.runInContext(`${panelSource}\n${testSource}`, context, { filename: 'src/devtools/panel/panelController.ts' });

if (!context.__masked.includes('••••')) {
  throw new Error('API key mask does not hide the stored key.');
}

const reportJson = JSON.stringify(context.__reportSettings);
if (reportJson.includes('sk-test-secret-1234')) {
  throw new Error('Report settings leaked the raw provider API key.');
}
if (!reportJson.includes('sk-••••••••1234')) {
  throw new Error('Report settings did not preserve masked key metadata.');
}

const contentJson = JSON.stringify(context.__contentSettings);
if (/apiKey|aiProvider|sk-test-secret/i.test(contentJson)) {
  throw new Error('Content-script settings include AI provider secrets.');
}

const messageJson = JSON.stringify(context.__messages);
if (messageJson.includes('sk-test-secret-1234') || messageJson.includes('super-secret')) {
  throw new Error('Provider chat context leaked API keys or sensitive query values.');
}

if (!/requires an API key/i.test(context.__missingKeyError)) {
  throw new Error('Hosted provider validation did not reject a missing API key.');
}

console.log('AI provider settings security smoke test passed.');
