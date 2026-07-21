const { sanitizeCapturedMetadata } = require('./redaction.cjs');

exports.buildContextBuilderMessage = function buildContextBuilderMessage({
  event,
  findings = [],
  sessionId = null,
  pageUrl = '',
  extra = {}
}) {
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
};

function resolveSource(value) {
  const resolved = typeof value === 'function' ? value() : value;
  return Array.isArray(resolved) ? resolved : [];
}

function toRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { value: value };
  return sanitizeCapturedMetadata(value);
}

function normalizeEvidenceItem(value, source) {
  const record = toRecord(value);
  const timestamp = Number(record.timestamp || record.createdAt || record.time || Date.now());
  return {
    ...record,
    source,
    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now()
  };
}

function countCategory(items, category) {
  return items.filter((item) => String(item.category || '').toLowerCase() === category).length;
}

function estimateTokensFromText(value) {
  return Math.max(1, Math.ceil(String(value || '').length / 4));
}

function estimateTokensFromJson(value) {
  try {
    return estimateTokensFromText(JSON.stringify(value));
  } catch {
    return estimateTokensFromText(String(value || ''));
  }
}

function buildTokenEstimateTarget(value) {
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

function truncateTextToApproximateTokens(value, maxTokens) {
  const maxChars = Math.max(0, Math.floor(maxTokens * 4));
  return String(value || '').slice(0, maxChars);
}

function cloneStructuredEvidence(base) {
  return JSON.parse(JSON.stringify(base));
}

function finalizeStructuredEvidence(value) {
  const redacted = sanitizeCapturedMetadata(value);
  redacted.tokenEstimate = value.tokenEstimate;
  redacted.maxTokens = value.maxTokens;
  redacted.truncated = value.truncated;
  redacted.truncationSummary = value.truncationSummary;
  if (value.truncation) {
    redacted.truncation = {
      ...redacted.truncation,
      estimatedTokens: value.truncation.estimatedTokens,
      maxTokens: value.truncation.maxTokens,
      summary: value.truncation.summary
    };
  }
  return redacted;
}

function buildTruncationSummary(base, maxTokens, keptCounts, droppedCounts) {
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

function truncateStructuredEvidence(base, maxTokens) {
  const working = cloneStructuredEvidence(base);
  const keptCounts = {
    domObservations: (working.domObservations || []).length,
    networkFindings: (working.networkFindings || []).length,
    consoleLogs: (working.consoleLogs || []).length,
    ruleResults: (working.ruleResults || []).length,
    findings: (working.findings || []).length
  };
  const droppedCounts = {
    domObservations: 0,
    networkFindings: 0,
    consoleLogs: 0,
    ruleResults: 0,
    findings: 0
  };

  const trimArray = (key) => {
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
    const summaryOnly = {
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

function ContextBuilder(options) {
  this.options = options || {};
}

ContextBuilder.prototype.build = function build() {
  const domObservations = resolveSource(this.options.domObservations).map((item) => normalizeEvidenceItem(item, 'dom-observation'));
  const networkFindings = resolveSource(this.options.networkFindings).map((item) => normalizeEvidenceItem(item, 'network-finding'));
  const consoleLogs = resolveSource(this.options.consoleLogs).map((item) => normalizeEvidenceItem(item, 'console-log'));
  const ruleResults = resolveSource(this.options.ruleResults).map((item) => normalizeEvidenceItem(item, 'rule-result'));
  const findings = [].concat(domObservations, networkFindings, consoleLogs, ruleResults);

  const maxTokens = Number.isFinite(Number(this.options.maxTokens)) && Number(this.options.maxTokens) > 0
    ? Number(this.options.maxTokens)
    : 1200;

  const base = {
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
  if (base.tokenEstimate <= maxTokens) return finalizeStructuredEvidence(base);

  return finalizeStructuredEvidence(truncateStructuredEvidence(base, maxTokens));
};

ContextBuilder.prototype.toJSON = function toJSON() {
  return this.build();
};

exports.ContextBuilder = ContextBuilder;

exports.createContextBuilderMessageBus = function createContextBuilderMessageBus() {
  const subscribers = new Set();

  return {
    subscribe(listener) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    publish(message) {
      for (const listener of subscribers) {
        listener(message);
      }
    }
  };
};
