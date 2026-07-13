export function buildXPathSelector(element: Element | null | undefined) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return '';

  const parts: string[] = [];
  let current: Element | null | undefined = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
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

export function createInputBatcher(delayMs: number, emit: (target: unknown) => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latestTarget: unknown = null;

  return {
    schedule(target: unknown) {
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
