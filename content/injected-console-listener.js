(() => {
  if (window.__BUGLENS_CONSOLE_LISTENER_INSTALLED__) return;
  window.__BUGLENS_CONSOLE_LISTENER_INSTALLED__ = true;

  const SOURCE = 'buglens-page-console-listener';
  const MAX_ARG_LENGTH = 1500;
  const MAX_OBJECT_KEYS = 20;
  const MAX_ARRAY_ITEMS = 10;
  const CAPTURE_CONSOLE_METHODS = window.__BUGLENS_CAPTURE_CONSOLE_METHODS__ === true;

  function isErrorLike(value) {
    return Boolean(value
      && typeof value === 'object'
      && typeof value.name === 'string'
      && typeof value.message === 'string'
      && ('stack' in value || value.name.endsWith('Error')));
  }

  function safeSerialize(value, depth = 0, seen = new WeakSet()) {
    try {
      if (isErrorLike(value)) {
        return {
          name: value.name,
          message: value.message,
          stack: typeof value.stack === 'string' ? value.stack.slice(0, MAX_ARG_LENGTH) : null
        };
      }

      if (value === null || value === undefined) return value;
      if (typeof value === 'string') return value.slice(0, MAX_ARG_LENGTH);
      if (typeof value === 'number' || typeof value === 'boolean') return value;
      if (typeof value === 'bigint') return `${String(value).slice(0, MAX_ARG_LENGTH)}n`;
      if (typeof value === 'symbol') return String(value).slice(0, MAX_ARG_LENGTH);
      if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
      if (depth > 2) return '[Object]';

      if (typeof value === 'object') {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }

      if (Array.isArray(value)) {
        return value.slice(0, MAX_ARRAY_ITEMS).map((item) => safeSerialize(item, depth + 1, seen));
      }

      if (typeof value === 'object') {
        const result = {};
        for (const key of Object.keys(value).slice(0, MAX_OBJECT_KEYS)) {
          try {
            result[key] = safeSerialize(value[key], depth + 1, seen);
          } catch {
            result[key] = '[Unserializable property]';
          }
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
        payload: Object.assign({}, payload, {
          url: location.href,
          timestamp: Date.now()
        })
      }, '*');
    } catch (error) {
      // Do not break host app logging.
    }
  }

  function normalizeArgs(args) {
    return Array.from(args).map((arg) => safeSerialize(arg));
  }

  function stringifyArg(arg) {
    if (isErrorLike(arg)) return `${arg.name}: ${arg.message}`;
    if (typeof arg === 'string') return arg;
    try {
      return JSON.stringify(safeSerialize(arg));
    } catch {
      try {
        return String(arg);
      } catch {
        return '[Unserializable value]';
      }
    }
  }

  function getBestStack(args) {
    for (const arg of args) {
      if (isErrorLike(arg) && typeof arg.stack === 'string') {
        return arg.stack.slice(0, MAX_ARG_LENGTH);
      }
    }
    return null;
  }

  if (CAPTURE_CONSOLE_METHODS) {
    const originalConsole = {};
    for (const level of ['error', 'warn']) {
      originalConsole[level] = console[level];
      console[level] = function buglensConsoleProxy(...args) {
        emit({
          channel: 'console',
          level,
          message: args.map(stringifyArg).join(' ').slice(0, MAX_ARG_LENGTH),
          args: normalizeArgs(args),
          stack: getBestStack(args)
        });
        if (typeof originalConsole[level] === 'function') {
          return Reflect.apply(originalConsole[level], console, args);
        }
        return undefined;
      };
    }
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
    const isError = isErrorLike(reason);
    emit({
      channel: 'promise',
      level: 'error',
      message: isError ? `${reason.name}: ${reason.message}` : `Unhandled promise rejection: ${stringifyArg(reason)}`,
      stack: isError && typeof reason.stack === 'string' ? reason.stack : null,
      args: [safeSerialize(reason)]
    });
  }, true);
})();
