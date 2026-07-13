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
