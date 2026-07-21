export function buildXPathSelector(element) {
  if (!element || element.nodeType !== 1) return '';

  const parts = [];
  let current = element;

  while (current && current.nodeType === 1) {
    let part = current.nodeName.toLowerCase();
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((child) => child.nodeName === current.nodeName);
      if (siblings.length > 1) {
        part += `[${siblings.indexOf(current) + 1}]`;
      }
    }

    if (current.id) {
      part += `[@id="${current.id}"]`;
      parts.unshift(part);
      break;
    }

    parts.unshift(part);
    current = parent;
  }

  return parts.length ? `//${parts.join('/')}` : '';
}

export function createInputBatcher(delayMs, emit) {
  let timer = null;
  let latestTarget = null;

  return {
    schedule(target) {
      latestTarget = target;
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = null;
        emit(latestTarget);
        latestTarget = null;
      }, delayMs);
    }
  };
}
