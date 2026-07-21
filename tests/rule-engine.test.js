const test = require('node:test');
const assert = require('node:assert/strict');
const { createDefaultRuleEngine } = require('../src/shared/ruleEngine.cjs');

function createDocumentFixture() {
  const label = {
    tagName: 'LABEL',
    nodeType: 1,
    getAttribute(name) {
      if (name === 'for') return 'email';
      if (name === 'id') return null;
      return null;
    },
    closest() {
      return null;
    }
  };

  const labeledInput = {
    tagName: 'INPUT',
    nodeType: 1,
    nodeName: 'INPUT',
    id: 'email',
    type: 'email',
    name: 'email',
    getAttribute(name) {
      if (name === 'id') return 'email';
      if (name === 'type') return 'email';
      if (name === 'name') return 'email';
      if (name === 'aria-label' || name === 'aria-labelledby') return null;
      if (name === 'placeholder') return null;
      return null;
    },
    closest(selector) {
      return selector === 'label' ? label : null;
    }
  };

  const unlabeledInput = {
    tagName: 'INPUT',
    nodeType: 1,
    nodeName: 'INPUT',
    id: 'search',
    type: 'text',
    name: 'search',
    getAttribute(name) {
      if (name === 'id') return 'search';
      if (name === 'type') return 'text';
      if (name === 'name') return 'search';
      if (name === 'aria-label' || name === 'aria-labelledby') return null;
      if (name === 'placeholder') return null;
      return null;
    },
    closest(selector) {
      return selector === 'label' ? null : null;
    }
  };

  const duplicateIdOne = {
    tagName: 'DIV',
    nodeType: 1,
    nodeName: 'DIV',
    id: 'dup-id',
    getAttribute(name) {
      if (name === 'id') return 'dup-id';
      return null;
    }
  };

  const duplicateIdTwo = {
    tagName: 'DIV',
    nodeType: 1,
    nodeName: 'DIV',
    id: 'dup-id',
    getAttribute(name) {
      if (name === 'id') return 'dup-id';
      return null;
    }
  };

  const brokenImage = {
    tagName: 'IMG',
    nodeType: 1,
    nodeName: 'IMG',
    currentSrc: 'https://example.test/broken.png',
    src: 'https://example.test/broken.png',
    complete: true,
    naturalWidth: 0,
    getAttribute(name) {
      if (name === 'id') return null;
      return null;
    },
    parentElement: null,
    closest() {
      return null;
    }
  };

  const document = {
    querySelectorAll(selector) {
      if (selector === 'label') return [label];
      if (selector === 'input, textarea, select') return [labeledInput, unlabeledInput];
      if (selector === '[id]') return [duplicateIdOne, duplicateIdTwo];
      return [];
    },
    images: [brokenImage]
  };

  return { document, labeledInput, unlabeledInput, duplicateIdOne, duplicateIdTwo, brokenImage };
}

test('HTTP 4xx/5xx rule creates finding with url, status, method, duration', () => {
  const engine = createDefaultRuleEngine({
    pageUrl: 'https://example.test/app',
    classifyNetworkUrl: () => 'business',
    now: () => 1700000000000
  });

  const findings = engine.evaluate({
    kind: 'network',
    payload: {
      method: 'POST',
      url: 'https://example.test/api/users',
      status: 404,
      durationMs: 120
    }
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, 'http-errors');
  assert.equal(findings[0].severity, 'high');
  assert.equal(findings[0].evidence.url, 'https://example.test/api/users');
  assert.equal(findings[0].evidence.method, 'POST');
  assert.equal(findings[0].evidence.status, 404);
  assert.equal(findings[0].evidence.durationMs, 120);
});

test('HTTP rule suppresses known third-party blocklist domains', () => {
  const engine = createDefaultRuleEngine({
    pageUrl: 'https://example.test/app',
    classifyNetworkUrl: () => 'business',
    now: () => 1700000000000
  });

  const findings = engine.evaluate({
    kind: 'network',
    payload: {
      method: 'GET',
      url: 'https://stats.g.doubleclick.net/collect',
      status: 500,
      durationMs: 40
    }
  });

  assert.equal(findings.length, 0);
});

test('HTTP 5xx rule returns critical severity', () => {
  const engine = createDefaultRuleEngine({
    pageUrl: 'https://example.test/app',
    classifyNetworkUrl: () => 'business',
    now: () => 1700000000000
  });

  const findings = engine.evaluate({
    kind: 'network',
    payload: {
      method: 'GET',
      url: 'https://example.test/api/orders',
      status: 503,
      durationMs: 200
    }
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'critical');
  assert.equal(findings[0].evidence.status, 503);
});

test('console.error rule creates finding and truncates message to 200 chars', () => {
  const engine = createDefaultRuleEngine({ now: () => 1700000000001 });
  const findings = engine.evaluate({
    kind: 'console',
    payload: {
      level: 'error',
      message: 'x'.repeat(260),
      url: 'https://example.test/page'
    }
  });

  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, 'console-errors');
  assert.equal(findings[0].severity, 'high');
  assert.equal(findings[0].evidence.message.length, 200);
  assert.equal(findings[0].evidence.url, 'https://example.test/page');
});

test('missing-label rule creates finding with element XPath', () => {
  const { document } = createDocumentFixture();
  const engine = createDefaultRuleEngine({ document, pageUrl: 'https://example.test/form', now: () => 1700000000002 });

  const findings = engine.evaluate({
    kind: 'ui-scan',
    payload: { document }
  });

  const missingLabel = findings.find((finding) => finding.rule === 'missing-labels');
  assert.ok(missingLabel);
  assert.equal(missingLabel.severity, 'medium');
  assert.equal(missingLabel.evidence.xpath, '//input[@id="search"]');
});

test('duplicate-id rule creates finding listing duplicated IDs', () => {
  const { document } = createDocumentFixture();
  const engine = createDefaultRuleEngine({ document, pageUrl: 'https://example.test/form', now: () => 1700000000002 });

  const findings = engine.evaluate({
    kind: 'ui-scan',
    payload: { document }
  });

  const duplicateId = findings.find((finding) => finding.rule === 'duplicate-ids');
  assert.ok(duplicateId);
  assert.equal(duplicateId.severity, 'high');
  assert.equal(duplicateId.evidence.id, 'dup-id');
  assert.equal(duplicateId.evidence.duplicateCount, 2);
  assert.deepEqual(duplicateId.evidence.ids, ['dup-id']);
});

test('broken-image rule creates finding with src URL', () => {
  const { document } = createDocumentFixture();
  const engine = createDefaultRuleEngine({ document, pageUrl: 'https://example.test/form', now: () => 1700000000002 });

  const findings = engine.evaluate({
    kind: 'ui-scan',
    payload: { document }
  });

  const brokenImage = findings.find((finding) => finding.rule === 'broken-images');
  assert.ok(brokenImage);
  assert.equal(brokenImage.severity, 'medium');
  assert.equal(brokenImage.evidence.src, 'https://example.test/broken.png');
  assert.equal(typeof brokenImage.evidence.xpath, 'string');
});

test('RuleEngine does not emit duplicate findings for the same observation', () => {
  const engine = createDefaultRuleEngine({ now: () => 1700000000003 });
  const observation = {
    kind: 'console',
    payload: {
      level: 'error',
      message: 'Repeated console failure',
      url: 'https://example.test/page'
    }
  };

  const first = engine.evaluate(observation);
  const second = engine.evaluate(observation);

  assert.equal(first.length, 1);
  assert.equal(second.length, 0);
});
