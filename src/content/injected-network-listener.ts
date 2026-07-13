// @ts-nocheck
(() => {
  if (window.__TESTPILOT_NETWORK_LISTENER_INSTALLED__) return;
  window.__TESTPILOT_NETWORK_LISTENER_INSTALLED__ = true;

  const SOURCE = 'testpilot-page-network-listener';
  const MAX_BODY_LENGTH = 2000;

  function safeSerialize(value, depth = 0) {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return value.slice(0, MAX_BODY_LENGTH);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'bigint') return `${String(value).slice(0, MAX_BODY_LENGTH)}n`;
    if (typeof value === 'function') return '[Function]';
    if (depth > 2) return '[Object]';
    if (Array.isArray(value)) return value.slice(0, 10).map((item) => safeSerialize(item, depth + 1));
    if (typeof value === 'object') {
      const result = {};
      for (const key of Object.keys(value).slice(0, 20)) {
        try {
          result[key] = safeSerialize(value[key], depth + 1);
        } catch {
          result[key] = '[Unserializable]';
        }
      }
      return result;
    }
    return String(value);
  }

  function emit(payload) {
    try {
      window.postMessage({
        source: SOURCE,
        payload: {
          ...payload,
          url: location.href,
          timestamp: Date.now()
        }
      }, '*');
    } catch {
      // Ignore page-context injection failures.
    }
  }

  function getRequestDetails(input, init) {
    const method = init && init.method ? String(init.method).toUpperCase() : 'GET';
    const headers = init && init.headers ? safeSerialize(init.headers) : null;
    const body = init && 'body' in init ? safeSerialize(init.body) : null;
    return {
      method,
      headers,
      body,
      input: typeof input === 'string' ? input : safeSerialize(input)
    };
  }

  function wrapFetch() {
    const originalFetch = window.fetch;
    if (typeof originalFetch !== 'function') return;

    window.fetch = function testpilotFetch(...args) {
      const startTime = performance.now();
      const requestInfo = getRequestDetails(args[0], args[1]);
      const requestId = `fetch:${Date.now()}:${Math.random().toString(16).slice(2)}`;
      emit({
        channel: 'network',
        kind: 'request',
        requestId,
        type: 'fetch',
        ...requestInfo
      });

      return Promise.resolve(originalFetch.apply(this, args))
        .then((response) => {
          emit({
            channel: 'network',
            kind: 'response',
            requestId,
            type: 'fetch',
            status: response && typeof response.status === 'number' ? response.status : null,
            ok: response && typeof response.ok === 'boolean' ? response.ok : null,
            durationMs: Math.round(performance.now() - startTime),
            headers: response && response.headers ? safeSerialize(response.headers) : null
          });
          return response;
        })
        .catch((error) => {
          emit({
            channel: 'network',
            kind: 'error',
            requestId,
            type: 'fetch',
            durationMs: Math.round(performance.now() - startTime),
            errorMessage: error && error.message ? String(error.message).slice(0, MAX_BODY_LENGTH) : 'Fetch failed'
          });
          throw error;
        });
    };
  }

  function wrapXHR() {
    const xhrPrototype = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
    if (!xhrPrototype) return;

    const originalOpen = xhrPrototype.open;
    const originalSend = xhrPrototype.send;

    xhrPrototype.open = function testpilotOpen(method, url, async, user, password) {
      this.__testpilotRequestMeta = {
        method: method ? String(method).toUpperCase() : 'GET',
        url: typeof url === 'string' ? url : String(url),
        startedAt: performance.now()
      };
      return originalOpen.apply(this, [method, url, async, user, password]);
    };

    xhrPrototype.send = function testpilotSend(body) {
      const meta = this.__testpilotRequestMeta || {};
      const requestId = `xhr:${Date.now()}:${Math.random().toString(16).slice(2)}`;
      emit({
        channel: 'network',
        kind: 'request',
        requestId,
        type: 'xhr',
        method: meta.method || 'GET',
        input: meta.url || '',
        body: safeSerialize(body)
      });

      const onReadyStateChange = () => {
        if (this.readyState !== 4) return;
        emit({
          channel: 'network',
          kind: 'response',
          requestId,
          type: 'xhr',
          status: this.status,
          ok: this.status >= 200 && this.status < 300,
          durationMs: Math.round(performance.now() - (meta.startedAt || performance.now())),
          headers: safeSerialize(this.getAllResponseHeaders ? this.getAllResponseHeaders() : null)
        });
      };

      this.addEventListener('readystatechange', onReadyStateChange);
      return originalSend.apply(this, [body]);
    };
  }

  wrapFetch();
  wrapXHR();
})();
