import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

globalThis.fetch = async (url, init = {}) => {
  const value = String(url || '');
  if (value.endsWith('/api/tags')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ models: [{ name: 'llama3.2:3b' }] }),
      text: async () => JSON.stringify({ models: [{ name: 'llama3.2:3b' }] })
    };
  }
  if (value.includes('/v1/chat/completions')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ answer: 'Mocked AI response.' }) } }]
      }),
      text: async () => ''
    };
  }
  if (value.includes('/api/chat')) {
    return {
      ok: true,
      status: 200,
      body: null,
      json: async () => ({ answer: 'Mocked streamed answer.' }),
      text: async () => ''
    };
  }
  return {
    ok: false,
    status: 404,
    json: async () => ({}),
    text: async () => 'Not found'
  };
};

const { app } = await import('../dist/server.js');

test('GET / returns backend status payload', async () => {
  const res = await request(app).get('/');

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.service, 'testpilot-ai-backend');
  assert.equal(typeof res.body.backendUrl, 'string');
});

test('GET /api/health returns health payload', async () => {
  const res = await request(app).get('/api/health');

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.service, 'testpilot-ai-backend');
  assert.ok(res.body.ai);
});

test('POST /api/ai/analyze-session returns analysis envelope', async () => {
  const res = await request(app)
    .post('/api/ai/analyze-session')
    .send({ session: { page: { url: 'https://example.com' } } });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.task, 'analyze-session');
  assert.ok(res.body.analysis);
});

test('POST /api/ai/generate-bug-report returns analysis envelope', async () => {
  const res = await request(app)
    .post('/api/ai/generate-bug-report')
    .send({ session: { page: { url: 'https://example.com' } } });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.task, 'generate-bug-report');
  assert.ok(res.body.analysis);
});

test('POST /api/ai/generate-test-cases returns analysis envelope', async () => {
  const res = await request(app)
    .post('/api/ai/generate-test-cases')
    .send({ session: { page: { url: 'https://example.com' } } });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.task, 'generate-test-cases');
  assert.ok(res.body.analysis);
});

test('POST /api/ai/chat returns chat response', async () => {
  const res = await request(app)
    .post('/api/ai/chat')
    .send({
      message: 'Summarize findings',
      context: { pageUrl: 'https://example.com', actionableFindings: [] },
      history: []
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(typeof res.body.answer, 'string');
});

test('POST /api/chat alias returns chat response', async () => {
  const res = await request(app)
    .post('/api/chat')
    .send({
      question: 'What should I test next?',
      context: { pageUrl: 'https://example.com', actionableFindings: [] },
      history: []
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(typeof res.body.answer, 'string');
});

test('POST /api/ai/chat-stream returns SSE response', async () => {
  const res = await request(app)
    .post('/api/ai/chat-stream')
    .set('Accept', 'text/event-stream')
    .send({
      message: 'Give me quick QA guidance',
      context: { pageUrl: 'https://example.com', actionableFindings: [] },
      history: []
    });

  assert.equal(res.status, 200);
  assert.match(String(res.headers['content-type'] || ''), /text\/event-stream/i);
  assert.match(String(res.text || ''), /event: done/);
});

test('POST /api/chat-stream alias returns SSE response', async () => {
  const res = await request(app)
    .post('/api/chat-stream')
    .set('Accept', 'text/event-stream')
    .send({
      question: 'Give me quick QA guidance',
      context: { pageUrl: 'https://example.com', actionableFindings: [] },
      history: []
    });

  assert.equal(res.status, 200);
  assert.match(String(res.headers['content-type'] || ''), /text\/event-stream/i);
  assert.match(String(res.text || ''), /event: done/);
});

test('Unknown route returns 404', async () => {
  const res = await request(app).get('/unknown-route');

  assert.equal(res.status, 404);
  assert.equal(res.body.ok, false);
});

test('Validation error returns 400 with details', async () => {
  const res = await request(app)
    .post('/api/ai/chat')
    .send({ history: [{ role: 'assistant', content: 'x'.repeat(5001) }] });

  assert.equal(res.status, 400);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error, 'Invalid request body.');
  assert.ok(Array.isArray(res.body.details));
  assert.ok(res.body.details.length > 0);
});
