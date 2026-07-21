import { buildXPathSelector } from './observation';

export type RuleSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface Finding {
  id: string;
  rule: string;
  severity: RuleSeverity;
  title: string;
  evidence: Record<string, unknown>;
  timestamp: number;
  type?: string;
  category?: string;
  description?: string;
  url?: string;
}

export interface RuleObservation {
  kind: string;
  payload?: Record<string, unknown> | null;
  sessionId?: string | null;
  pageUrl?: string;
}

export interface RuleContext {
  document?: any;
  pageUrl?: string;
  classifyNetworkUrl?: (url: string | null | undefined, pageOrigin?: string | null) => string;
  now?: () => number;
}

export interface RuleDefinition {
  id: string;
  evaluate: (observation: RuleObservation, context: RuleContext) => Finding[];
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

function now(context: RuleContext) {
  return typeof context.now === 'function' ? context.now() : Date.now();
}

function simpleHash(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function makeFinding(rule: string, severity: RuleSeverity, title: string, evidence: Record<string, unknown>, context: RuleContext, extra: Partial<Finding> = {}) {
  const identity = JSON.stringify([rule, severity, title, evidence]);
  return {
    id: simpleHash(identity),
    rule,
    severity,
    title,
    evidence,
    timestamp: now(context),
    ...extra
  };
}

function truncate(value: string, length: number) {
  return String(value || '').trim().slice(0, Math.max(0, length));
}

function shortUrl(url: string) {
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

function isBusinessUrl(url: string | null | undefined, context: RuleContext) {
  if (!context.classifyNetworkUrl) return true;
  const category = context.classifyNetworkUrl(url, context.pageUrl || null);
  return category === 'business';
}

function isBlockedThirdPartyUrl(url: string | null | undefined) {
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

function getDocument(context: RuleContext, observation: RuleObservation) {
  const documentFromObservation = observation.payload && typeof observation.payload.document === 'object'
    ? observation.payload.document
    : null;
  return documentFromObservation || context.document || null;
}

function hasAssociatedLabel(element: Element, document: Document) {
  if (!element || !document) return false;
  const id = element.getAttribute('id') || element.id;
  if (id) {
    for (const label of Array.from(document.querySelectorAll('label'))) {
      if (label.getAttribute('for') === id) return true;
    }
  }
  if (element.closest && element.closest('label')) return true;
  if (element.getAttribute('aria-label')) return true;
  if (element.getAttribute('aria-labelledby')) return true;
  return false;
}

function getAttributeValue(element: any, name: string) {
  if (!element || typeof element !== 'object') return null;
  if (typeof element.getAttribute === 'function') return element.getAttribute(name);
  return typeof element[name] === 'string' ? String(element[name]) : null;
}

function getElementProperty(element: any, name: string) {
  if (!element || typeof element !== 'object') return null;
  return element[name] ?? null;
}

function toElementArray(value: any): any[] {
  if (!value) return [];
  return Array.isArray(value) ? value : Array.from(value);
}

function createHttpErrorRule(): RuleDefinition {
  const seen = new Set<string>();
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
      const severity: RuleSeverity = status >= 500 ? 'critical' : 'high';
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

function createConsoleErrorRule(): RuleDefinition {
  const seen = new Set<string>();
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

function createMissingLabelRule(): RuleDefinition {
  const seen = new Set<string>();
  return {
    id: 'missing-labels',
    evaluate(observation, context) {
      if (!['dom-mutation', 'session-start', 'ui-scan'].includes(observation.kind)) return [];
      const document = getDocument(context, observation);
      if (!document || typeof document.querySelectorAll !== 'function') return [];
      const findings: Finding[] = [];
      const fields = toElementArray(document.querySelectorAll('input, textarea, select'));
      for (const element of fields) {
        const tagName = String(getElementProperty(element, 'tagName') || '').toLowerCase();
        if (!tagName || (tagName === 'input' && String(getAttributeValue(element, 'type') || getElementProperty(element, 'type') || '').toLowerCase() === 'hidden')) continue;
        if (hasAssociatedLabel(element, document)) continue;
        const xpath = buildXPathSelector(element as Element);
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

function createDuplicateIdRule(): RuleDefinition {
  const seen = new Set<string>();
  return {
    id: 'duplicate-ids',
    evaluate(observation, context) {
      if (!['dom-mutation', 'session-start', 'ui-scan'].includes(observation.kind)) return [];
      const document = getDocument(context, observation);
      if (!document || typeof document.querySelectorAll !== 'function') return [];
      const idCounts = new Map<string, number>();
      for (const element of toElementArray(document.querySelectorAll('[id]'))) {
        const id = String(getAttributeValue(element, 'id') || getElementProperty(element, 'id') || '').trim();
        if (!id) continue;
        idCounts.set(id, (idCounts.get(id) || 0) + 1);
      }
      const findings: Finding[] = [];
      for (const [id, count] of idCounts.entries()) {
        if (count < 2) continue;
        if (seen.has(id)) continue;
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

function createBrokenImageRule(): RuleDefinition {
  const seen = new Set<string>();
  return {
    id: 'broken-images',
    evaluate(observation, context) {
      if (!['dom-mutation', 'session-start', 'ui-scan'].includes(observation.kind)) return [];
      const document = getDocument(context, observation);
      if (!document) return [];
      const images = toElementArray(document.images || []);
      const findings: Finding[] = [];
      for (const image of images) {
        const src = String(getElementProperty(image, 'currentSrc') || getElementProperty(image, 'src') || '').trim();
        if (!src) continue;
        const complete = Boolean(getElementProperty(image, 'complete'));
        const naturalWidth = Number(getElementProperty(image, 'naturalWidth') || 0);
        if (!complete || naturalWidth !== 0) continue;
        if (seen.has(src)) continue;
        seen.add(src);
        findings.push(makeFinding('broken-images', 'medium', `Broken image detected: ${shortUrl(src)}`, {
          src,
          xpath: buildXPathSelector(image as Element),
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

export class RuleEngine {
  private readonly rules: RuleDefinition[] = [];
  private readonly context: RuleContext;

  constructor(context: RuleContext = {}) {
    this.context = context;
  }

  registerRule(rule: RuleDefinition) {
    this.rules.push(rule);
    return this;
  }

  evaluate(observation: RuleObservation): Finding[] {
    return this.rules.flatMap((rule) => rule.evaluate(observation, this.context));
  }
}

export function createDefaultRuleEngine(context: RuleContext = {}) {
  return new RuleEngine(context)
    .registerRule(createHttpErrorRule())
    .registerRule(createConsoleErrorRule())
    .registerRule(createMissingLabelRule())
    .registerRule(createDuplicateIdRule())
    .registerRule(createBrokenImageRule());
}