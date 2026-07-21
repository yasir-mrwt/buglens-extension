import { sanitizeCapturedMetadata } from './redaction';

export interface StructuredEvidenceJSON {
  event: string;
  sessionId?: string | null;
  pageUrl?: string;
  timestamp?: number;
  domObservations?: Array<Record<string, unknown>>;
  networkFindings?: Array<Record<string, unknown>>;
  consoleLogs?: Array<Record<string, unknown>>;
  ruleResults?: Array<Record<string, unknown>>;
  findings: Array<Record<string, unknown>>;
  counts: {
    total: number;
    actionable: number;
    needsReview: number;
    frameworkNoise: number;
  };
  tokenEstimate?: number;
  maxTokens?: number;
  truncated?: boolean;
  truncationSummary?: string;
  truncation?: {
    kept: {
      domObservations: number;
      networkFindings: number;
      consoleLogs: number;
      ruleResults: number;
      findings: number;
    };
    dropped: {
      domObservations: number;
      networkFindings: number;
      consoleLogs: number;
      ruleResults: number;
      findings: number;
    };
    estimatedTokens: number;
    maxTokens: number;
    summary: string;
  };
  metadata?: Record<string, unknown>;
}

type EvidenceSourceValue = Array<Record<string, unknown>> | (() => Array<Record<string, unknown>> | null | undefined);

export interface ContextBuilderSources {
  domObservations?: EvidenceSourceValue;
  networkFindings?: EvidenceSourceValue;
  consoleLogs?: EvidenceSourceValue;
  ruleResults?: EvidenceSourceValue;
}

export interface ContextBuilderOptions extends ContextBuilderSources {
  event: string;
  sessionId?: string | null;
  pageUrl?: string;
  metadata?: Record<string, unknown>;
  maxTokens?: number;
}

function resolveSource(value?: EvidenceSourceValue) {
  const resolved = typeof value === 'function' ? value() : value;
  return Array.isArray(resolved) ? resolved : [];
}

function toRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { value };
  return sanitizeCapturedMetadata(value as Record<string, unknown>) as Record<string, unknown>;
}

function normalizeEvidenceItem(value: unknown, source: string) {
  const record = toRecord(value) as Record<string, unknown>;
  const timestamp = Number(record.timestamp || record.createdAt || record.time || Date.now());
  return {
    ...record,
    source,
    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now()
  };
}

function countCategory(items: Array<Record<string, unknown>>, category: string) {
  return items.filter((item) => String(item.category || '').toLowerCase() === category).length;
}

function estimateTokensFromText(value: string) {
  return Math.max(1, Math.ceil(String(value || '').length / 4));
}

function estimateTokensFromJson(value: unknown) {
  try {
    return estimateTokensFromText(JSON.stringify(value));
  } catch {
    return estimateTokensFromText(String(value || ''));
  }
}

function buildTokenEstimateTarget(value: StructuredEvidenceJSON) {
  const {
    tokenEstimate: _tokenEstimate,
    maxTokens: _maxTokens,
    truncated: _truncated,
    truncationSummary: _truncationSummary,
    truncation: _truncation,
    ...payload
  } = value;
  return payload;
}

function truncateTextToApproximateTokens(value: string, maxTokens: number) {
  const maxChars = Math.max(0, Math.floor(maxTokens * 4));
  return String(value || '').slice(0, maxChars);
}

function cloneStructuredEvidence(base: StructuredEvidenceJSON) {
  return JSON.parse(JSON.stringify(base)) as StructuredEvidenceJSON;
}

function finalizeStructuredEvidence(value: StructuredEvidenceJSON) {
  const redacted = sanitizeCapturedMetadata(value as any) as any as StructuredEvidenceJSON;
  redacted.tokenEstimate = value.tokenEstimate;
  redacted.maxTokens = value.maxTokens;
  redacted.truncated = value.truncated;
  redacted.truncationSummary = value.truncationSummary;
  if (value.truncation) {
    redacted.truncation = {
      kept: value.truncation.kept,
      dropped: value.truncation.dropped,
      estimatedTokens: value.truncation.estimatedTokens,
      maxTokens: value.truncation.maxTokens,
      summary: value.truncation.summary
    };
  }
  return redacted;
}

function buildTruncationSummary(base: StructuredEvidenceJSON, maxTokens: number, keptCounts: Record<string, number>, droppedCounts: Record<string, number>) {
  const summaryParts = [
    `Estimated ${base.tokenEstimate || 0} tokens`,
    `limited to ${maxTokens} tokens`,
    `kept ${keptCounts.domObservations} DOM, ${keptCounts.networkFindings} network, ${keptCounts.consoleLogs} console, ${keptCounts.ruleResults} rule result(s)`
  ];
  const droppedTotal = droppedCounts.domObservations + droppedCounts.networkFindings + droppedCounts.consoleLogs + droppedCounts.ruleResults;
  if (droppedTotal > 0) {
    summaryParts.push(`dropped ${droppedTotal} item(s)`);
  }
  return summaryParts.join('; ');
}

function truncateStructuredEvidence(base: StructuredEvidenceJSON, maxTokens: number) {
  const working = cloneStructuredEvidence(base);
  const keptCounts = {
    domObservations: working.domObservations?.length || 0,
    networkFindings: working.networkFindings?.length || 0,
    consoleLogs: working.consoleLogs?.length || 0,
    ruleResults: working.ruleResults?.length || 0,
    findings: working.findings?.length || 0
  };
  const droppedCounts = {
    domObservations: 0,
    networkFindings: 0,
    consoleLogs: 0,
    ruleResults: 0,
    findings: 0
  };

  const trimArray = (key: 'domObservations' | 'networkFindings' | 'consoleLogs' | 'ruleResults' | 'findings') => {
    const source = Array.isArray(working[key]) ? working[key] : [];
    while (source.length && estimateTokensFromJson(buildTokenEstimateTarget(working)) > maxTokens) {
      source.pop();
      droppedCounts[key] += 1;
    }
    working[key] = source;
    keptCounts[key] = source.length;
  };

  trimArray('findings');
  trimArray('domObservations');
  trimArray('networkFindings');
  trimArray('consoleLogs');
  trimArray('ruleResults');

  if (estimateTokensFromJson(buildTokenEstimateTarget(working)) > maxTokens) {
    const summaryOnly: StructuredEvidenceJSON = {
      event: working.event,
      findings: [],
      counts: working.counts,
      tokenEstimate: 0,
      maxTokens,
      truncated: true,
      truncationSummary: `Truncated to fit ${maxTokens} token budget.`
    };
    const summaryTokens = estimateTokensFromJson(buildTokenEstimateTarget(summaryOnly));
    const summaryText = summaryOnly.truncationSummary || `Truncated to fit ${maxTokens} token budget.`;
    summaryOnly.tokenEstimate = Math.min(summaryTokens, maxTokens);
    summaryOnly.truncation = {
      kept: {
        domObservations: 0,
        networkFindings: 0,
        consoleLogs: 0,
        ruleResults: 0,
        findings: 0
      },
      dropped: droppedCounts,
      estimatedTokens: summaryTokens,
      maxTokens,
      summary: summaryText
    };
    return summaryOnly;
  }

  const estimatedTokens = estimateTokensFromJson(buildTokenEstimateTarget(working));
  working.tokenEstimate = Math.min(estimatedTokens, maxTokens);
  working.maxTokens = maxTokens;
  working.truncated = true;
  working.truncation = {
    kept: keptCounts,
    dropped: droppedCounts,
    estimatedTokens,
    maxTokens,
    summary: buildTruncationSummary(working, maxTokens, keptCounts, droppedCounts)
  };
  working.truncationSummary = working.truncation.summary;
  return working;
}

export class ContextBuilder {
  private readonly options: ContextBuilderOptions;

  constructor(options: ContextBuilderOptions) {
    this.options = options;
  }

  build(): StructuredEvidenceJSON {
    const domObservations = resolveSource(this.options.domObservations).map((item) => normalizeEvidenceItem(item, 'dom-observation'));
    const networkFindings = resolveSource(this.options.networkFindings).map((item) => normalizeEvidenceItem(item, 'network-finding'));
    const consoleLogs = resolveSource(this.options.consoleLogs).map((item) => normalizeEvidenceItem(item, 'console-log'));
    const ruleResults = resolveSource(this.options.ruleResults).map((item) => normalizeEvidenceItem(item, 'rule-result'));
    const findings = [...domObservations, ...networkFindings, ...consoleLogs, ...ruleResults];
    const maxTokens = Number.isFinite(Number(this.options.maxTokens)) && Number(this.options.maxTokens) > 0
      ? Number(this.options.maxTokens)
      : 1200;

    const base: StructuredEvidenceJSON = {
      event: this.options.event,
      sessionId: this.options.sessionId ?? null,
      pageUrl: this.options.pageUrl || '',
      timestamp: Date.now(),
      domObservations,
      networkFindings,
      consoleLogs,
      ruleResults,
      findings,
      counts: {
        total: findings.length,
        actionable: countCategory(findings, 'actionable'),
        needsReview: countCategory(findings, 'needs-review'),
        frameworkNoise: countCategory(findings, 'framework-noise')
      },
      metadata: this.options.metadata || {},
      tokenEstimate: 0,
      maxTokens
    };

    base.tokenEstimate = estimateTokensFromJson(buildTokenEstimateTarget(base));
    if (base.tokenEstimate <= maxTokens) {
      return finalizeStructuredEvidence(base);
    }

    return finalizeStructuredEvidence(truncateStructuredEvidence(base, maxTokens));
  }

  toJSON(): StructuredEvidenceJSON {
    return this.build();
  }
}

export type ContextBuilderMessage = {
  event: string;
  sessionId?: string | null;
  pageUrl?: string;
  payload: {
    findings: Array<Record<string, unknown>>;
    counts: {
      total: number;
      actionable: number;
      needsReview: number;
      frameworkNoise: number;
    };
    [key: string]: unknown;
  };
};

export function buildContextBuilderMessage({
  event,
  findings = [],
  sessionId = null,
  pageUrl = '',
  extra = {}
}: {
  event: string;
  findings?: Array<Record<string, unknown>>;
  sessionId?: string | null;
  pageUrl?: string;
  extra?: Record<string, unknown>;
}): ContextBuilderMessage {
  const counts = {
    total: findings.length,
    actionable: findings.filter((item) => item.category === 'actionable').length,
    needsReview: findings.filter((item) => item.category === 'needs-review').length,
    frameworkNoise: findings.filter((item) => item.category === 'framework-noise').length
  };

  return {
    event,
    sessionId,
    pageUrl,
    payload: {
      findings,
      counts,
      ...extra
    }
  };
}

export function createContextBuilderMessageBus() {
  const subscribers = new Set<(message: ContextBuilderMessage) => void>();

  return {
    subscribe(listener: (message: ContextBuilderMessage) => void) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    publish(message: ContextBuilderMessage) {
      for (const listener of subscribers) {
        listener(message);
      }
    }
  };
}
