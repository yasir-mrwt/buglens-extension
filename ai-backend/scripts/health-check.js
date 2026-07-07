import http from 'node:http';
import https from 'node:https';

const baseUrl = normalizeBaseUrl(process.env.TESTPILOT_BACKEND_URL || process.env.AI_BACKEND_URL || 'http://localhost:8787');

async function main() {
  const root = await requestJsonWithLocalhostFallback(baseUrl);
  const health = await requestJsonWithLocalhostFallback(`${baseUrl}/api/health`);

  console.log('TestPilot backend diagnostics');
  console.log(`Backend URL: ${baseUrl}`);
  console.log(`Root: ${root.ok ? 'OK' : 'FAILED'}`);
  console.log(`Health: ${health.ok ? 'OK' : 'FAILED'}`);

  if (health.body && health.body.ai) {
    const ai = health.body.ai;
    console.log(`Provider: ${ai.provider || health.body.provider || 'unknown'}`);
    console.log(`Model: ${ai.model || health.body.model || 'unknown'}`);
    console.log(`Ollama/model: ${ai.ok ? 'OK' : 'NOT READY'}`);
    if (!ai.ok && ai.error) console.log(`Ollama/model error: ${ai.error}`);
  }

  if (!root.ok || !health.ok) {
    console.error('\nBackend is not reachable. Start it with:');
    console.error('  cd ai-backend && npm start');
    if (root.body && root.body.error) console.error(`Root error: ${root.body.error}`);
    if (health.body && health.body.error) console.error(`Health error: ${health.body.error}`);
    process.exit(1);
  }

  if (health.body && health.body.ai && health.body.ai.ok === false) {
    console.error('\nBackend is running, but Ollama/model is not ready. Try:');
    console.error('  ollama serve');
    console.error(`  ollama pull ${health.body.model || 'llama3.2:3b'}`);
    process.exit(2);
  }

  console.log('\nBackend and local model are ready.');
}

function normalizeBaseUrl(value) {
  return String(value || 'http://localhost:8787').replace(/\/+$/, '');
}

async function requestJson(url) {
  return new Promise((resolve) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      resolve({ ok: false, status: 0, body: { error: `Invalid URL: ${url}` } });
      return;
    }

    const client = parsedUrl.protocol === 'https:' ? https : http;
    const request = client.request(parsedUrl, { method: 'GET', timeout: 5000 }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        text += chunk;
      });
      response.on('end', () => {
        let body = {};
        try {
          body = text ? JSON.parse(text) : {};
        } catch {
          body = { text };
        }
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300 && body.ok !== false,
          status: response.statusCode,
          body
        });
      });
    });
    request.on('timeout', () => {
      request.destroy(new Error('Request timed out.'));
    });
    request.on('error', (error) => {
      resolve({
        ok: false,
        status: 0,
        body: { error: error && error.message ? error.message : 'Request failed.' }
      });
    });
    request.end();
  });
}

async function requestJsonWithLocalhostFallback(url) {
  const first = await requestJson(url);
  if (first.ok || !String(url).includes('://localhost')) return first;
  const fallbackUrl = String(url).replace('://localhost', '://127.0.0.1');
  const fallback = await requestJson(fallbackUrl);
  if (fallback.ok) return fallback;
  return {
    ...first,
    body: {
      ...first.body,
      error: `${first.body?.error || 'localhost failed'}; 127.0.0.1 also failed: ${fallback.body?.error || 'request failed'}`
    }
  };
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
