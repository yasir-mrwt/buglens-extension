const test = require('node:test');
const assert = require('node:assert/strict');
const { ContextBuilder, createContextBuilderMessageBus, buildContextBuilderMessage } = require('../src/shared/contextBuilder.cjs');

test('ContextBuilder returns empty structured evidence for empty inputs', () => {
  const builder = new ContextBuilder({
    event: 'findings-updated',
    sessionId: 'session-empty',
    pageUrl: 'https://example.test/empty'
  });

  const structured = builder.build();

  assert.equal(structured.event, 'findings-updated');
  assert.equal(structured.sessionId, 'session-empty');
  assert.equal(structured.pageUrl, 'https://example.test/empty');
  assert.equal(structured.tokenEstimate > 0, true);
  assert.equal(structured.truncated, undefined);
  assert.equal(structured.domObservations.length, 0);
  assert.equal(structured.networkFindings.length, 0);
  assert.equal(structured.consoleLogs.length, 0);
  assert.equal(structured.ruleResults.length, 0);
  assert.equal(structured.findings.length, 0);
  assert.equal(structured.counts.total, 0);
  assert.equal(structured.counts.actionable, 0);
  assert.equal(structured.counts.needsReview, 0);
  assert.equal(structured.counts.frameworkNoise, 0);
});

test('ContextBuilder aggregates full inputs into structured evidence json', () => {
  const builder = new ContextBuilder({
    event: 'findings-updated',
    sessionId: 'session-1',
    pageUrl: 'https://example.test/page',
    metadata: {
      authorization: 'Bearer top-secret-token',
      nested: {
        cookie: 'session=abc123',
        request: {
          password: 'hunter2'
        }
      }
    },
    domObservations: [
      { type: 'dom-mutation', category: 'informational', title: 'DOM updated', evidence: { nodeCount: 4 } }
    ],
    networkFindings: [
      { type: 'api', category: 'actionable', severity: 'high', title: 'Broken API', evidence: { status: 500 } }
    ],
    consoleLogs: [
      { type: 'console', category: 'needs-review', severity: 'medium', title: 'Console warning', evidence: { level: 'warn' } }
    ],
    ruleResults: [
      { type: 'ui', category: 'framework-noise', severity: 'info', title: 'Rule result', evidence: { ruleId: 'text-clipping' } }
    ]
  });

  const structured = builder.build();

  assert.equal(structured.event, 'findings-updated');
  assert.equal(structured.sessionId, 'session-1');
  assert.equal(structured.pageUrl, 'https://example.test/page');
  assert.equal(structured.domObservations.length, 1);
  assert.equal(structured.networkFindings.length, 1);
  assert.equal(structured.consoleLogs.length, 1);
  assert.equal(structured.ruleResults.length, 1);
  assert.equal(structured.findings.length, 4);
  assert.equal(structured.counts.total, 4);
  assert.equal(structured.counts.actionable, 1);
  assert.equal(structured.counts.needsReview, 1);
  assert.equal(structured.counts.frameworkNoise, 1);
  assert.equal(structured.findings[0].source, 'dom-observation');
});

test('ContextBuilder truncates at the configured token limit', () => {
  const builder = new ContextBuilder({
    event: 'findings-updated',
    sessionId: 'session-1',
    pageUrl: 'https://example.test/page',
    maxTokens: 40,
    domObservations: [{ type: 'dom-mutation', category: 'informational', title: 'DOM updated', evidence: { note: 'x'.repeat(120) } }],
    networkFindings: [{ type: 'api', category: 'actionable', severity: 'high', title: 'Broken API', evidence: { status: 500, response: 'y'.repeat(180) } }],
    consoleLogs: [{ type: 'console', category: 'needs-review', severity: 'medium', title: 'Console warning', evidence: { level: 'warn', stack: 'z'.repeat(140) } }],
    ruleResults: [{ type: 'ui', category: 'framework-noise', severity: 'info', title: 'Rule result', evidence: { ruleId: 'text-clipping' } }]
  });

  const structured = builder.build();

  assert.equal(structured.maxTokens, 40);
  assert.ok(structured.tokenEstimate <= 40);
  assert.equal(structured.truncated, true);
  assert.ok(typeof structured.truncationSummary === 'string' && structured.truncationSummary.length > 0);
  assert.ok(structured.truncation.dropped.findings > 0 || structured.truncation.dropped.domObservations > 0 || structured.truncation.dropped.networkFindings > 0 || structured.truncation.dropped.consoleLogs > 0 || structured.truncation.dropped.ruleResults > 0);
});

test('ContextBuilder redacts sensitive metadata before returning', () => {
  const builder = new ContextBuilder({
    event: 'findings-updated',
    sessionId: 'session-1',
    pageUrl: 'https://example.test/page',
    metadata: {
      authorization: 'Bearer top-secret-token',
      nested: {
        cookie: 'session=abc123',
        request: {
          password: 'hunter2'
        }
      }
    },
    domObservations: [
      { type: 'dom-mutation', category: 'informational', title: 'DOM updated', evidence: { nodeCount: 4 } }
    ],
    networkFindings: [
      { type: 'api', category: 'actionable', severity: 'high', title: 'Broken API', evidence: { status: 500 } }
    ],
    consoleLogs: [
      { type: 'console', category: 'needs-review', severity: 'medium', title: 'Console warning', evidence: { level: 'warn' } }
    ],
    ruleResults: [
      { type: 'ui', category: 'framework-noise', severity: 'info', title: 'Rule result', evidence: { ruleId: 'text-clipping' } }
    ]
  });

  const structured = builder.build();

  assert.equal(structured.metadata.authorization, '[REDACTED]');
  assert.equal(structured.metadata.nested.cookie, '[REDACTED]');
  assert.equal(structured.metadata.nested.request.password, '[REDACTED]');
});

test('buildContextBuilderMessage includes findings and derived counts', () => {
  const message = buildContextBuilderMessage({
    event: 'findings-updated',
    findings: [
      { type: 'api', category: 'actionable', severity: 'high', title: 'Broken API', description: 'Request failed', evidence: { status: 500 }, url: 'https://example.test/api' },
      { type: 'console', category: 'needs-review', severity: 'medium', title: 'Console warning', description: 'Warning emitted', evidence: { level: 'warn' } }
    ],
    sessionId: 'session-1',
    pageUrl: 'https://example.test/page'
  });

  assert.equal(message.event, 'findings-updated');
  assert.equal(message.sessionId, 'session-1');
  assert.equal(message.payload.findings.length, 2);
  assert.equal(message.payload.counts.actionable, 1);
  assert.equal(message.payload.counts.needsReview, 1);
  assert.equal(message.payload.counts.total, 2);
});

test('createContextBuilderMessageBus publishes messages to subscribers', () => {
  const bus = createContextBuilderMessageBus();
  const received = [];
  bus.subscribe((message) => received.push(message));

  bus.publish(buildContextBuilderMessage({ event: 'findings-updated', findings: [] }));

  assert.equal(received.length, 1);
  assert.equal(received[0].event, 'findings-updated');
});
