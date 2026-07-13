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
