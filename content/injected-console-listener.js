(() => {
  if (window.__BUGLENS_CONSOLE_LISTENER_INSTALLED__) return;
  window.__BUGLENS_CONSOLE_LISTENER_INSTALLED__ = true;

  const SOURCE = 'buglens-page-console-listener';
  const MAX_ARG_LENGTH = 1500;

  function safeSerialize(value, depth = 0) {
    try {
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack
        };
      }

      if (value === null || value === undefined) return value;
      if (typeof value === 'string') return value.slice(0, MAX_ARG_LENGTH);
      if (typeof value === 'number' || typeof value === 'boolean') return value;
      if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
      if (depth > 2) return '[Object]';

      if (Array.isArray(value)) {
        return value.slice(0, 10).map((item) => safeSerialize(item, depth + 1));
      }

      if (typeof value === 'object') {
        const result = {};
        for (const key of Object.keys(value).slice(0, 20)) {
          result[key] = safeSerialize(value[key], depth + 1);
        }
        return result;
      }

      return String(value).slice(0, MAX_ARG_LENGTH);
    } catch (error) {
      return '[Unserializable value]';
    }
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
    } catch (error) {
      // Do not break host app logging.
    }
  }

  function normalizeArgs(args) {
    return Array.from(args).map((arg) => safeSerialize(arg));
  }

  const originalConsole = {};
  for (const level of ['error', 'warn']) {
    originalConsole[level] = console[level];
    console[level] = function buglensConsoleProxy(...args) {
      emit({
        channel: 'console',
        level,
        message: args.map((arg) => {
          if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
          if (typeof arg === 'string') return arg;
          try { return JSON.stringify(safeSerialize(arg)); } catch { return String(arg); }
        }).join(' '),
        args: normalizeArgs(args),
        stack: new Error().stack || null
      });
      return originalConsole[level].apply(console, args);
    };
  }

  window.addEventListener('error', (event) => {
    emit({
      channel: 'runtime',
      level: 'error',
      message: event.message || 'Unhandled window error',
      filename: event.filename || null,
      lineno: event.lineno || null,
      colno: event.colno || null,
      stack: event.error && event.error.stack ? event.error.stack : null
    });
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    emit({
      channel: 'promise',
      level: 'error',
      message: reason instanceof Error ? `${reason.name}: ${reason.message}` : `Unhandled promise rejection: ${String(reason)}`,
      stack: reason instanceof Error ? reason.stack : null,
      args: [safeSerialize(reason)]
    });
  }, true);
})();
