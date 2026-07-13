const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { sanitizeCapturedMetadata } = require('../src/shared/redaction.cjs');

function startMockServer() {
  const server = http.createServer((req, res) => {
    const statusCode = req.url === '/unauthorized' ? 401 : req.url === '/server-error' ? 500 : 200;
    const requestHeaders = {
      authorization: req.headers.authorization || '',
      cookie: req.headers.cookie || '',
      'x-test': 'present'
    };

    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Set-Cookie': 'session=abc123; HttpOnly',
      'X-Test-Header': 'present'
    });
    res.end(JSON.stringify({ ok: true, requestHeaders, statusCode }));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('sanitizes captured metadata from a mock server across status codes', async () => {
  const server = await startMockServer();
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const responses = [];
    for (const path of ['/ok', '/unauthorized', '/server-error']) {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: {
          Authorization: 'Bearer top-secret-token',
          Cookie: 'session=abc123',
          'X-Test-Header': 'present'
        }
      });
      const body = await response.text();
      responses.push({ path, status: response.status, body });
    }

    for (const response of responses) {
      const payload = sanitizeCapturedMetadata({
        method: 'GET',
        url: `${baseUrl}${response.path}`,
        status: response.status,
        requestHeaders: { authorization: 'Bearer top-secret-token', cookie: 'session=abc123', 'x-test': 'present' },
        responseHeaders: { 'set-cookie': 'session=abc123; HttpOnly', 'x-test-header': 'present' },
        body: response.body
      });

      assert.equal(payload.requestHeaders.authorization, '[REDACTED]');
      assert.equal(payload.requestHeaders.cookie, '[REDACTED]');
      assert.equal(payload.responseHeaders['set-cookie'], '[REDACTED]');
      assert.equal(payload.requestHeaders['x-test'], 'present');
      assert.equal(payload.responseHeaders['x-test-header'], 'present');
      assert.equal(payload.status, response.status);
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
