const fs = require('fs');
const vm = require('vm');

function element(id) {
  return {
    id,
    value: id === 'categoryFilter' ? 'counted' : (id === 'severityFilter' ? 'all' : ''),
    checked: false,
    disabled: false,
    textContent: '',
    innerHTML: '',
    classList: { toggle() {} },
    addEventListener() {},
    append() {},
    appendChild() {},
    remove() {},
    click() {},
    querySelector() { return element('child'); }
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
          userAgent: 'BugLens test',
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
  setTimeout,
  clearTimeout,
  setInterval() { return 1; },
  clearInterval() {}
};

vm.createContext(context);

const panelSource = fs.readFileSync('devtools/panel.js', 'utf8');
const testSource = `
state.active = true;
state.sessionId = 'network-test';
state.startedAt = Date.now();
state.pageUrl = 'https://example.test/';

function makeEntry(url, requestHeaders, status, mimeType, resourceType = 'fetch') {
  return {
    request: { method: 'GET', url, headers: requestHeaders },
    response: {
      status,
      statusText: status === 404 ? 'Not Found' : 'Partial Content',
      headers: [{ name: 'content-type', value: mimeType }],
      content: { mimeType, size: 64 }
    },
    resourceType,
    time: 25,
    getContent(callback) { callback(mimeType.includes('json') ? '{}' : '', ''); }
  };
}

const prefetchHeaders = [
  { name: 'next-router-prefetch', value: '1' },
  { name: 'rsc', value: '1' },
  { name: 'next-router-segment-prefetch', value: '/privacy-policy' }
];

processNetworkEntry(makeEntry(
  'https://example.test/privacy-policy/__next.privacy-policy.txt?_rsc=one',
  prefetchHeaders,
  404,
  'text/html'
));
processNetworkEntry(makeEntry(
  'https://example.test/services/__next.services.__PAGE__.txt?_rsc=three',
  [
    { name: 'next-router-prefetch', value: '1' },
    { name: 'rsc', value: '1' },
    { name: 'next-router-segment-prefetch', value: '/services/__PAGE__' }
  ],
  404,
  'text/html'
));
processNetworkEntry(makeEntry(
  'https://example.test/privacy-policy/__next.privacy-policy.__PAGE__.txt?_rsc=two',
  [...prefetchHeaders, { name: 'next-router-segment-prefetch', value: '/privacy-policy/__PAGE__' }],
  404,
  'text/html'
));
processNetworkEntry(makeEntry(
  'https://example.test/index.txt?_rsc=root',
  [],
  200,
  'text/x-component'
));

const rangeHeaders = [{ name: 'range', value: 'bytes=0-63' }];
processNetworkEntry(makeEntry('https://example.test/', rangeHeaders, 206, 'text/html'));
processNetworkEntry(makeEntry('https://example.test/', rangeHeaders, 206, 'text/html'));
processNetworkEntry(makeEntry('https://example.test/api/users', [], 200, 'application/json'));

globalThis.__report = buildReport();
globalThis.__html = renderHtmlReport(globalThis.__report);
globalThis.__csv = buildCsvReport(globalThis.__report);
processNetworkEntry(makeEntry(
  'https://example.test/services',
  [],
  404,
  'text/html',
  'document'
));
globalThis.__promotedReport = buildReport();
globalThis.__migrated = consolidateStoredFindings([
  {
    type: 'api',
    severity: 'high',
    title: 'GET old Next payload returned 404',
    description: 'Legacy report finding',
    evidence: {
      url: 'https://example.test/blog/__next.blog.__PAGE__.txt?_rsc=old',
      status: 404,
      requestHeaders: [
        { name: 'rsc', value: '1' },
        { name: 'next-router-prefetch', value: '1' },
        { name: 'next-router-segment-prefetch', value: '/blog/__PAGE__' }
      ]
    }
  },
  {
    type: 'api',
    severity: 'high',
    title: 'GET another old Next payload returned 404',
    description: 'Legacy report finding',
    evidence: {
      url: 'https://example.test/privacy/__next.privacy.__PAGE__.txt?_rsc=old',
      status: 404,
      requestHeaders: [
        { name: 'rsc', value: '1' },
        { name: 'next-router-prefetch', value: '1' },
        { name: 'next-router-segment-prefetch', value: '/privacy/__PAGE__' }
      ]
    }
  },
  {
    type: 'api',
    severity: 'medium',
    title: 'Possible duplicate API call: GET /',
    evidence: {
      mimeType: 'text/html',
      requestHeaders: [{ name: 'Range', value: 'bytes=0-63' }]
    }
  },
  {
    type: 'ui',
    severity: 'medium',
    title: 'Large fixed or sticky element may cover content',
    evidence: {
      ruleId: 'large-fixed-overlay',
      selector: 'canvas#background-canvas'
    }
  },
  {
    type: 'ui',
    severity: 'medium',
    title: 'Possible clipped text',
    evidence: {
      ruleId: 'text-clipping',
      selector: '#about-us',
      rect: { y: 900, height: 900 },
      viewport: { height: 720 }
    }
  }
].map(migrateStoredIssue));
chrome.runtime.lastError = { message: 'Could not establish connection. Receiving end does not exist.' };
sendTabMessage({ type: 'BUGLENS_PING_CONTENT' }).then((result) => {
  globalThis.__messageErrorResult = result;
  chrome.runtime.lastError = null;
});
`;

vm.runInContext(`${panelSource}\n${testSource}`, context, {
  filename: 'devtools/panel.js'
});

setTimeout(() => {
  const issues = context.__report.frameworkNoise;
  if (issues.length !== 1) {
    throw new Error(`Expected one grouped issue, received ${issues.length}.`);
  }

  const issue = issues[0];
  if (issue.title !== 'Next.js route prefetch errors detected for 2 routes') {
    throw new Error(`Unexpected issue title: ${issue.title}`);
  }
  if (issue.category !== 'framework-noise' || issue.severity !== 'info' || issue.duplicateCount !== 3) {
    throw new Error('Prefetch failures were not grouped as framework noise.');
  }
  if (context.__report.summary.totalIssues !== 0) {
    throw new Error('Framework noise incorrectly increased the main issue count.');
  }
  if (context.__report.summary.frameworkNoise !== 2) {
    throw new Error('Framework noise route count was not summarized correctly.');
  }
  if (context.__report.summary.network.api !== 1 || context.__report.summary.network.framework !== 4) {
    throw new Error('Range probes or successful Next.js route data were incorrectly classified as APIs.');
  }
  const passedFinding = context.__report.findings.find((finding) => finding.category === 'passed');
  if (!passedFinding) {
    throw new Error('Successful business API requests were not available through the Passed filter.');
  }
  if (JSON.stringify(passedFinding.evidence).includes('index.txt')) {
    throw new Error('Successful Next.js route data leaked into the Passed business API finding.');
  }
  for (const heading of ['Executive Summary', 'Actionable Issues', 'Needs Review', 'Framework Noise / Ignored Findings', 'Passed Checks', 'Raw Evidence Appendix']) {
    if (!context.__html.includes(heading)) throw new Error(`HTML report is missing ${heading}.`);
  }
  if (!context.__csv.startsWith('"Finding ID","Category","Type"')) {
    throw new Error('CSV report does not contain the expected Google Sheets-friendly header.');
  }
  if (!context.__csv.includes('"framework-noise"') || context.__csv.includes('"requestHeaders"')) {
    throw new Error('CSV classification or evidence summary is incorrect.');
  }
  if (context.__promotedReport.summary.needsReview !== 1 || context.__promotedReport.summary.totalIssues !== 1) {
    throw new Error('A matching failed document navigation did not promote the framework finding.');
  }
  if (context.__migrated.length !== 1
    || context.__migrated[0].category !== 'framework-noise'
    || context.__migrated[0].evidence.routeCount !== 2) {
    throw new Error('Legacy Next.js findings were not migrated into one framework observation.');
  }
  if (!context.__messageErrorResult
    || context.__messageErrorResult.ok
    || !context.__messageErrorResult.error.includes('Receiving end does not exist')) {
    throw new Error('Tab messaging errors were not safely consumed.');
  }

  console.log('Network analyzer regression test passed.');
}, 25);
