const { buildXPathSelector } = require('./observation.cjs');

function simpleHash(input) {
  let hash = 0;
  const text = String(input || '');
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function now(context) {
  return typeof context.now === 'function' ? context.now() : Date.now();
}

const THIRD_PARTY_HTTP_BLOCKLIST = [
  'googletagmanager.com',
  'google-analytics.com',
  'doubleclick.net',
  'segment.io',
  'mixpanel.com',
  'hotjar.com',
  'fullstory.com',
  'amplitude.com',
  'intercom.io',
  'clarity.ms',
  'sentry.io',
  'facebook.com',
  'stats.g.doubleclick.net'
];

function makeFinding(rule, severity, title, evidence, context, extra = {}) {
  return {
    id: simpleHash(JSON.stringify([rule, severity, title, evidence])),
    rule,
    severity,
    title,
    evidence,
    timestamp: now(context),
    ...extra
  };
}

function truncate(value, length) {
  return String(value || '').trim().slice(0, Math.max(0, length));
}

function shortUrl(url) {
  const text = String(url || '').trim();
  if (!text) return 'unknown url';
  try {
    const parsed = new URL(text);
    const path = `${parsed.pathname}${parsed.search}` || '/';
    return `${parsed.host}${path}`.slice(0, 140);
  } catch {
    return text.slice(0, 140);
  }
}

function isBusinessUrl(url, context) {
  if (!context.classifyNetworkUrl) return true;
  const category = context.classifyNetworkUrl(url, context.pageUrl || null);
  return category === 'business';
}

function isBlockedThirdPartyUrl(url) {
  const value = String(url || '').trim();
  if (!value) return false;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    return THIRD_PARTY_HTTP_BLOCKLIST.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`));
  } catch {
    return false;
  }
}

function getDocument(context, observation) {
  if (observation.payload && observation.payload.document) return observation.payload.document;
  return context.document || null;
}

function hasAssociatedLabel(element, document) {
  if (!element || !document) return false;
  const id = element.getAttribute && element.getAttribute('id') || element.id;
  if (id) {
    const labels = Array.from(document.querySelectorAll('label'));
    if (labels.some((label) => label.getAttribute && label.getAttribute('for') === id)) return true;
  }
  if (element.closest && element.closest('label')) return true;
  if (element.getAttribute && element.getAttribute('aria-label')) return true;
  if (element.getAttribute && element.getAttribute('aria-labelledby')) return true;
  return false;
}

function getAttributeValue(element, name) {
  if (!element || typeof element !== 'object') return null;
  if (typeof element.getAttribute === 'function') return element.getAttribute(name);
  return typeof element[name] === 'string' ? String(element[name]) : null;
}

function getElementProperty(element, name) {
  if (!element || typeof element !== 'object') return null;
  return element[name] ?? null;
}

function toElementArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : Array.from(value);
}

function createHttpErrorRule() {
  const seen = new Set();
  return {
    id: 'http-errors',
    evaluate(observation, context) {
      if (observation.kind !== 'network') return [];
      const payload = observation.payload || {};
      const status = Number(payload.status || 0);
      if (status < 400 || status > 599) return [];
      const url = String(payload.url || payload.input || observation.pageUrl || context.pageUrl || '').trim();
      if (isBlockedThirdPartyUrl(url)) return [];
      if (!isBusinessUrl(url, context)) return [];
      const method = String(payload.method || 'GET').toUpperCase();
      const durationMs = Number(payload.durationMs || 0);
      const key = JSON.stringify([method, url, status, durationMs]);
      if (seen.has(key)) return [];
      seen.add(key);
      const severity = status >= 500 ? 'critical' : 'high';
      return [makeFinding('http-errors', severity, `${method} ${shortUrl(url)} returned ${status}`, {
        url,
        method,
        status,
        durationMs
      }, context, {
        type: 'api',
        category: 'actionable',
        description: 'HTTP request returned a client or server error.'
      })];
    }
  };
}

function createConsoleErrorRule() {
  const seen = new Set();
  return {
    id: 'console-errors',
    evaluate(observation, context) {
      if (observation.kind !== 'console') return [];
      const payload = observation.payload || {};
      const level = String(payload.level || '').toLowerCase();
      if (level !== 'error') return [];
      const message = truncate(String(payload.message || 'Console error detected.'), 200);
      const key = JSON.stringify([message, payload.filename || '', payload.lineno || '', payload.colno || '']);
      if (seen.has(key)) return [];
      seen.add(key);
      return [makeFinding('console-errors', 'high', `Console error: ${truncate(message, 80)}`, {
        message,
        channel: payload.channel || null,
        filename: payload.filename || null,
        lineno: payload.lineno || null,
        colno: payload.colno || null,
        url: payload.url || observation.pageUrl || context.pageUrl || ''
      }, context, {
        type: 'console',
        category: 'actionable',
        description: 'console.error() or an equivalent error-level console event was observed.'
      })];
    }
  };
}

function createMissingLabelRule() {
  const seen = new Set();
  return {
    id: 'missing-labels',
    evaluate(observation, context) {
      if (!['dom-mutation', 'session-start', 'ui-scan'].includes(observation.kind)) return [];
      const document = getDocument(context, observation);
      if (!document || typeof document.querySelectorAll !== 'function') return [];
      const findings = [];
      const fields = toElementArray(document.querySelectorAll('input, textarea, select'));
      for (const element of fields) {
        const tagName = String(getElementProperty(element, 'tagName') || '').toLowerCase();
        if (!tagName || (tagName === 'input' && String(getAttributeValue(element, 'type') || getElementProperty(element, 'type') || '').toLowerCase() === 'hidden')) continue;
        if (hasAssociatedLabel(element, document)) continue;
        const xpath = buildXPathSelector(element);
        const key = xpath || `${tagName}:${String(getAttributeValue(element, 'id') || getElementProperty(element, 'id') || '')}:${String(getAttributeValue(element, 'name') || getElementProperty(element, 'name') || '')}`;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        findings.push(makeFinding('missing-labels', 'medium', `Form field missing label: ${xpath || tagName}`, {
          xpath,
          tagName,
          id: getAttributeValue(element, 'id') || getElementProperty(element, 'id') || null,
          name: getAttributeValue(element, 'name') || getElementProperty(element, 'name') || null,
          type: getAttributeValue(element, 'type') || getElementProperty(element, 'type') || null
        }, context, {
          type: 'ui',
          category: 'needs-review',
          description: 'A form control does not have an associated label.'
        }));
      }
      return findings;
    }
  };
}

function createDuplicateIdRule() {
  const seen = new Set();
  return {
    id: 'duplicate-ids',
    evaluate(observation, context) {
      if (!['dom-mutation', 'session-start', 'ui-scan'].includes(observation.kind)) return [];
      const document = getDocument(context, observation);
      if (!document || typeof document.querySelectorAll !== 'function') return [];
      const idCounts = new Map();
      for (const element of toElementArray(document.querySelectorAll('[id]'))) {
        const id = String(getAttributeValue(element, 'id') || getElementProperty(element, 'id') || '').trim();
        if (!id) continue;
        idCounts.set(id, (idCounts.get(id) || 0) + 1);
      }
      const findings = [];
      for (const [id, count] of idCounts.entries()) {
        if (count < 2 || seen.has(id)) continue;
        seen.add(id);
        findings.push(makeFinding('duplicate-ids', 'high', `Duplicate element id: ${id}`, {
          id,
          duplicateCount: count,
          ids: [id]
        }, context, {
          type: 'ui',
          category: 'actionable',
          description: 'Multiple elements share the same id value.'
        }));
      }
      return findings;
    }
  };
}

function createBrokenImageRule() {
  const seen = new Set();
  return {
    id: 'broken-images',
    evaluate(observation, context) {
      if (!['dom-mutation', 'session-start', 'ui-scan'].includes(observation.kind)) return [];
      const document = getDocument(context, observation);
      if (!document) return [];
      const images = toElementArray(document.images || []);
      const findings = [];
      for (const image of images) {
        const src = String(getElementProperty(image, 'currentSrc') || getElementProperty(image, 'src') || '').trim();
        if (!src) continue;
        const complete = Boolean(getElementProperty(image, 'complete'));
        const naturalWidth = Number(getElementProperty(image, 'naturalWidth') || 0);
        if (!complete || naturalWidth !== 0 || seen.has(src)) continue;
        seen.add(src);
        findings.push(makeFinding('broken-images', 'medium', `Broken image detected: ${shortUrl(src)}`, {
          src,
          xpath: buildXPathSelector(image),
          naturalWidth
        }, context, {
          type: 'ui',
          category: 'actionable',
          description: 'An image completed loading with no rendered pixels.'
        }));
      }
      return findings;
    }
  };
}

function RuleEngine(context = {}) {
  this.rules = [];
  this.context = context;
}

RuleEngine.prototype.registerRule = function registerRule(rule) {
  this.rules.push(rule);
  return this;
};

RuleEngine.prototype.evaluate = function evaluate(observation) {
  return this.rules.flatMap((rule) => rule.evaluate(observation, this.context));
};

exports.RuleEngine = RuleEngine;

exports.createDefaultRuleEngine = function createDefaultRuleEngine(context = {}) {
  return new RuleEngine(context)
    .registerRule(createHttpErrorRule())
    .registerRule(createConsoleErrorRule())
    .registerRule(createMissingLabelRule())
    .registerRule(createDuplicateIdRule())
    .registerRule(createBrokenImageRule());
};