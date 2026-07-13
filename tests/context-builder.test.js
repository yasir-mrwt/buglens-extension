const test = require('node:test');
const assert = require('node:assert/strict');
const { createContextBuilderMessageBus, buildContextBuilderMessage } = require('../src/shared/contextBuilder.cjs');

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
