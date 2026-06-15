(() => {
  const PAGE_CONSOLE_SOURCE = 'buglens-page-console-listener';
  const MAX_ISSUES_PER_RULE_DEFAULT = 25;
  const MAX_UI_ISSUES_DEFAULT = 200;
  const MAX_UI_NODES_DEFAULT = 4000;
  let activeSessionId = null;

  function sendToExtension(kind, payload) {
    try {
      chrome.runtime.sendMessage({
        source: 'buglens-content',
        kind,
        sessionId: activeSessionId,
        payload
      }, () => {
        // Runtime can be unavailable on restricted pages; ignore.
        void chrome.runtime.lastError;
      });
    } catch (error) {
      // Ignore pages where extension messaging is unavailable.
    }
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== PAGE_CONSOLE_SOURCE) return;
    sendToExtension('console', event.data.payload);
  }, false);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== 'object') return false;

    if (message.type === 'BUGLENS_RUN_UI_SCAN') {
      const settings = message.settings || {};
      runWhenIdle(() => runUiScan(settings))
        .then((scan) => sendResponse({ ok: true, scan }))
        .catch((error) => sendResponse({
          ok: false,
          error: error && error.message ? error.message : 'UI scan failed.'
        }));
      return true;
    }

    if (message.type === 'BUGLENS_PING_CONTENT') {
      sendResponse({ ok: true, url: location.href });
      return true;
    }

    if (message.type === 'BUGLENS_SET_SESSION') {
      activeSessionId = typeof message.sessionId === 'string' ? message.sessionId : null;
      sendResponse({ ok: true, sessionId: activeSessionId });
      return true;
    }

    return false;
  });

  function runUiScan(settings) {
    const startedAt = performance.now();
    const maxIssuesPerRule = Number(settings.maxIssuesPerRule) || MAX_ISSUES_PER_RULE_DEFAULT;
    const maxUiIssues = Number(settings.maxUiIssues) || MAX_UI_ISSUES_DEFAULT;
    const maxUiNodes = Number(settings.maxUiNodes) || MAX_UI_NODES_DEFAULT;
    const visibleViewportOnly = settings.uiVisibleViewportOnly !== false;
    const includeDecorativeElements = settings.uiIncludeDecorativeElements === true;
    const allowedColors = Array.isArray(settings.allowedColors) ? settings.allowedColors.map(normalizeColorToken).filter(Boolean) : [];
    const issues = [];
    const ruleCounts = new Map();
    let droppedIssueCount = 0;
    let ignoredDecorativeCount = 0;

    function canAdd(ruleId) {
      const count = ruleCounts.get(ruleId) || 0;
      if (count >= maxIssuesPerRule) return false;
      ruleCounts.set(ruleId, count + 1);
      return true;
    }

    function addIssue(ruleId, severity, title, description, evidence, finding = {}) {
      if (issues.length >= maxUiIssues || !canAdd(ruleId)) {
        droppedIssueCount += 1;
        return;
      }
      issues.push({
        type: 'ui',
        category: finding.category || 'needs-review',
        severity,
        confidence: finding.confidence || 'medium',
        title,
        description,
        userImpact: finding.userImpact || 'Potential visual or interaction impact requires manual confirmation.',
        recommendation: finding.recommendation || 'Review the element in the visible viewport before filing a bug.',
        includeInIssueCount: finding.includeInIssueCount !== false,
        includeInReport: finding.includeInReport !== false,
        evidence: {
          ruleId,
          ...evidence
        },
        url: location.href,
        timestamp: Date.now()
      });
    }

    const docEl = document.documentElement;
    if (docEl && docEl.scrollWidth > window.innerWidth + 8) {
      addIssue(
        'horizontal-overflow',
        'high',
        'Page has horizontal overflow',
        `Document width is ${docEl.scrollWidth}px while viewport width is ${window.innerWidth}px.`,
        {
          viewportWidth: window.innerWidth,
          documentWidth: docEl.scrollWidth,
          selector: 'html'
        },
        {
          category: 'actionable',
          confidence: 'high',
          userImpact: 'Users may need horizontal scrolling or may be unable to reach offscreen content.',
          recommendation: 'Identify the overflowing element and correct its responsive sizing.'
        }
      );
    }

    const allElements = Array.from(document.querySelectorAll('body *'));
    const visibleElements = allElements.filter((element) => isVisibleElement(element, visibleViewportOnly));
    const elements = visibleElements.slice(0, maxUiNodes);
    const skippedElementCount = Math.max(0, allElements.length - elements.length);
    const hitNodeLimit = visibleElements.length > maxUiNodes;

    for (const img of Array.from(document.images).slice(0, maxUiNodes)) {
      if (!isVisibleElement(img, visibleViewportOnly)) continue;
      const selector = getSelector(img);
      if (img.complete && img.naturalWidth === 0) {
        addIssue(
          'broken-image',
          'medium',
          'Broken image detected',
          'An image is visible on the page but failed to load.',
          {
            selector,
            src: img.currentSrc || img.src || null,
            rect: getRect(img)
          },
          {
            category: 'actionable',
            confidence: 'high',
            userImpact: 'Important visual content may be missing.',
            recommendation: 'Fix the image source or loading policy and verify the fallback.'
          }
        );
      }

      if (!img.getAttribute('alt')) {
        addIssue(
          'missing-image-alt',
          'low',
          'Image missing alt text',
          'A visible image does not have an alt attribute.',
          {
            selector,
            src: img.currentSrc || img.src || null,
            rect: getRect(img)
          },
          {
            category: 'needs-review',
            confidence: 'high',
            userImpact: 'Screen-reader users may not receive an equivalent description.',
            recommendation: 'Add meaningful alt text, or an empty alt attribute for decorative images.'
          }
        );
      }
    }

    const clickables = document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [onclick]');
    for (const el of Array.from(clickables).slice(0, maxUiNodes)) {
      if (!isVisibleElement(el, visibleViewportOnly)) continue;
      const rect = el.getBoundingClientRect();
      if ((rect.width > 0 && rect.width < 32) || (rect.height > 0 && rect.height < 32)) {
        addIssue(
          'small-click-target',
          'medium',
          'Small clickable target',
          'A clickable element appears smaller than the recommended comfortable test target size.',
          {
            selector: getSelector(el),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            text: getShortText(el),
            rect: getRect(el)
          },
          {
            category: 'needs-review',
            confidence: 'medium',
            userImpact: 'The control may be difficult to activate on touch devices.',
            recommendation: 'Confirm the effective hit area and enlarge it when necessary.'
          }
        );
      }
    }

    for (const el of elements) {
      const tag = el.tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'svg', 'path'].includes(tag)) continue;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);

      if (!includeDecorativeElements && isDecorativeElement(el, style)) {
        ignoredDecorativeCount += 1;
        continue;
      }

      const leftOverflow = Math.max(0, -rect.left);
      const rightOverflow = Math.max(0, rect.right - window.innerWidth);
      const overflowAmount = Math.max(leftOverflow, rightOverflow);
      const minimumOverflow = Math.max(16, window.innerWidth * 0.02);
      const isInVerticalViewport = rect.bottom > 0 && rect.top < window.innerHeight;
      const isInteractive = el.matches
        ? el.matches('button, a[href], input, select, textarea, [role="button"], [onclick]')
        : false;
      const isMeaningfulElement = rect.width >= 24
        && (isInteractive || hasDirectText(el) || !['span', 'i', 'b', 'small'].includes(tag));
      const isTransformed = Boolean(style.transform && style.transform !== 'none');

      if (overflowAmount > minimumOverflow
        && isInVerticalViewport
        && isMeaningfulElement
        && !isTransformed) {
        addIssue(
          'element-viewport-overflow',
          'medium',
          'Element overflows the viewport',
          'A visible element extends beyond the horizontal viewport.',
          {
            selector: getSelector(el),
            viewportWidth: window.innerWidth,
            overflowAmount: Math.round(overflowAmount),
            rect: getRect(el)
          },
          {
            category: 'needs-review',
            confidence: 'medium',
            userImpact: 'Part of the element may be unavailable in the current viewport.',
            recommendation: 'Confirm the overflow is unintended at this viewport size.'
          }
        );
      }

      if (isTextClippingCandidate(el, style, rect)) {
        const widthOverflow = el.scrollWidth - el.clientWidth;
        const heightOverflow = el.scrollHeight - el.clientHeight;
        const meaningfulOverflow = widthOverflow > Math.max(12, el.clientWidth * 0.05)
          || heightOverflow > Math.max(8, el.clientHeight * 0.15);
        if (meaningfulOverflow) {
          addIssue(
            'text-clipping',
            'medium',
            'Visible text may be clipped',
            'A visible text element has meaningful content overflow hidden outside its bounds.',
            {
              selector: getSelector(el),
              text: getShortText(el),
              clientWidth: el.clientWidth,
              scrollWidth: el.scrollWidth,
              clientHeight: el.clientHeight,
              scrollHeight: el.scrollHeight,
              rect: getRect(el),
              whyFlagged: 'Visible leaf text has overflow hidden or clipped with a meaningful size difference.',
              falsePositiveNote: 'Review animations and intentional truncation before filing a bug.'
            },
            {
              category: 'needs-review',
              confidence: 'medium',
              userImpact: 'Users may be unable to read the complete label or content.',
              recommendation: 'Check the element at this viewport and adjust sizing or overflow only if text is visibly lost.'
            }
          );
        }
      }

      const zIndex = Number.parseInt(style.zIndex, 10);
      const hasForegroundContent = hasDirectText(el) || Boolean(el.querySelector('button, a[href], input, select, textarea'));
      if ((style.position === 'fixed' || style.position === 'sticky')
        && rect.width >= window.innerWidth * 0.8
        && rect.height >= window.innerHeight * 0.4
        && style.pointerEvents !== 'none'
        && Number(style.opacity || 1) > 0.2
        && Number.isFinite(zIndex)
        && zIndex >= 100
        && hasForegroundContent) {
        addIssue(
          'large-fixed-overlay',
          'medium',
          'Large fixed or sticky element may cover content',
          'A large fixed or sticky element occupies a substantial part of the viewport.',
          {
            selector: getSelector(el),
            position: style.position,
            zIndex,
            pointerEvents: style.pointerEvents,
            rect: getRect(el),
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            whyFlagged: 'Large foreground fixed element can intercept interaction.',
            falsePositiveNote: 'Confirm that underlying content is actually blocked.'
          },
          {
            category: 'needs-review',
            confidence: 'medium',
            userImpact: 'The overlay may block reading or interaction with page content.',
            recommendation: 'Confirm click interception and reduce or dismiss the overlay if it blocks the tested flow.'
          }
        );
      }
    }

    if (allowedColors.length > 0) {
      for (const el of elements) {
        const style = getComputedStyle(el);
        const selector = getSelector(el);
        const textColor = normalizeColorToken(style.color);
        const backgroundColor = normalizeColorToken(style.backgroundColor);
        const borderColor = normalizeColorToken(style.borderTopColor);

        if (textColor && !allowedColors.includes(textColor)) {
          addIssue(
            'unexpected-text-color',
            'low',
            'Unexpected text color',
            'An element uses a text color outside the configured allowed color list.',
            { selector, property: 'color', value: textColor, allowedColors, text: getShortText(el), rect: getRect(el) },
            { category: 'informational', confidence: 'low', includeInIssueCount: false }
          );
        }

        if (backgroundColor && backgroundColor !== '#00000000' && backgroundColor !== 'transparent' && !allowedColors.includes(backgroundColor)) {
          addIssue(
            'unexpected-background-color',
            'low',
            'Unexpected background color',
            'An element uses a background color outside the configured allowed color list.',
            { selector, property: 'background-color', value: backgroundColor, allowedColors, rect: getRect(el) },
            { category: 'informational', confidence: 'low', includeInIssueCount: false }
          );
        }

        if (borderColor && style.borderTopStyle !== 'none' && Number.parseFloat(style.borderTopWidth) > 0 && !allowedColors.includes(borderColor)) {
          addIssue(
            'unexpected-border-color',
            'low',
            'Unexpected border color',
            'An element uses a border color outside the configured allowed color list.',
            { selector, property: 'border-color', value: borderColor, allowedColors, rect: getRect(el) },
            { category: 'informational', confidence: 'low', includeInIssueCount: false }
          );
        }
      }
    }

    const buttonGroups = groupButtonStyles(maxUiNodes);
    for (const group of buttonGroups) {
      if (group.variants.length <= 1) continue;
      addIssue(
        'inconsistent-button-styles',
        'low',
        'Inconsistent button styling',
        'Similar buttons appear to use different height, padding, font size, or radius values.',
        {
          groupKey: group.key,
          variants: group.variants.slice(0, 8),
          count: group.count
        },
        {
          category: 'needs-review',
          confidence: 'low',
          userImpact: 'Similar controls may feel visually inconsistent.',
          recommendation: 'Confirm the buttons serve the same role before aligning their design tokens.'
        }
      );
    }

    return {
      url: location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio
      },
      scannedElementCount: elements.length,
      skippedElementCount,
      totalElementCount: allElements.length,
      hitNodeLimit,
      maxUiNodes,
      droppedIssueCount,
      ignoredDecorativeCount,
      durationMs: Math.round(performance.now() - startedAt),
      issues
    };
  }

  function runWhenIdle(task) {
    return new Promise((resolve, reject) => {
      const execute = () => {
        try {
          resolve(task());
        } catch (error) {
          reject(error);
        }
      };

      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(execute, { timeout: 500 });
      } else {
        setTimeout(execute, 0);
      }
    });
  }

  function groupButtonStyles(maxNodes) {
    const groups = new Map();
    const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]'))
      .slice(0, maxNodes)
      .filter((element) => isVisibleElement(element, true));
    for (const button of buttons) {
      const classes = Array.from(button.classList || []).slice(0, 3).join('.');
      const key = classes || button.tagName.toLowerCase();
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      const signature = [
        `h:${Math.round(rect.height)}`,
        `pt:${style.paddingTop}`,
        `pr:${style.paddingRight}`,
        `pb:${style.paddingBottom}`,
        `pl:${style.paddingLeft}`,
        `fs:${style.fontSize}`,
        `br:${style.borderRadius}`
      ].join('|');
      if (!groups.has(key)) groups.set(key, { key, count: 0, signatures: new Map() });
      const group = groups.get(key);
      group.count += 1;
      if (!group.signatures.has(signature)) {
        group.signatures.set(signature, {
          signature,
          selector: getSelector(button),
          text: getShortText(button),
          height: Math.round(rect.height),
          padding: `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`,
          fontSize: style.fontSize,
          borderRadius: style.borderRadius
        });
      }
    }

    return Array.from(groups.values())
      .filter((group) => group.count >= 2 && group.signatures.size > 1)
      .map((group) => ({ key: group.key, count: group.count, variants: Array.from(group.signatures.values()) }));
  }

  function isVisibleElement(el, viewportOnly = false) {
    if (!el || !(el instanceof Element)) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const margin = viewportOnly ? 0 : 500;
    if (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight + margin || rect.left > window.innerWidth + margin) return false;
    return true;
  }

  function isDecorativeElement(el, style) {
    const identity = `${el.id || ''} ${Array.from(el.classList || []).join(' ')}`.toLowerCase();
    const decorativeName = /(background|canvas|particles|decoration|decorative|gradient|blob|noise|pattern)/.test(identity);
    const hasInteractiveChild = Boolean(el.querySelector('button, a[href], input, select, textarea, [role="button"]'));
    const zIndex = Number.parseInt(style.zIndex, 10);
    return el.tagName.toLowerCase() === 'canvas'
      || style.pointerEvents === 'none'
      || (Number.isFinite(zIndex) && zIndex < 0)
      || Number(style.opacity || 1) < 0.15
      || decorativeName
      || (!hasDirectText(el) && !hasInteractiveChild && ['fixed', 'absolute'].includes(style.position));
  }

  function isTextClippingCandidate(el, style, rect) {
    const textTags = new Set(['p', 'span', 'a', 'button', 'label', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
    const tag = el.tagName.toLowerCase();
    if (!textTags.has(tag) || !hasDirectText(el)) return false;
    if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) return false;
    if (rect.height > window.innerHeight * 0.6) return false;
    if (style.transform && style.transform !== 'none') return false;
    if (style.textOverflow === 'ellipsis') return false;
    return style.overflow === 'hidden'
      || style.overflow === 'clip'
      || style.overflowX === 'hidden'
      || style.overflowY === 'hidden'
      || style.whiteSpace === 'nowrap';
  }

  function hasDirectText(el) {
    return Array.from(el.childNodes || []).some((node) => (
      node.nodeType === Node.TEXT_NODE && String(node.textContent || '').trim().length > 0
    ));
  }

  function getRect(el) {
    const rect = el.getBoundingClientRect();
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }

  function hasTextContent(el) {
    const text = getShortText(el);
    return text.length > 0;
  }

  function getShortText(el) {
    return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  function getSelector(el) {
    if (!el || !el.tagName) return 'unknown';
    if (el.id) return `#${cssEscape(el.id)}`;
    const path = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE && path.length < 3) {
      let part = current.tagName.toLowerCase();
      const stableClasses = Array.from(current.classList || [])
        .filter(isStableSelectorClass)
        .slice(0, 2);
      if (stableClasses.length) {
        part += '.' + stableClasses.map(cssEscape).join('.');
      }
      const parent = current.parentElement;
      if (parent && stableClasses.length === 0) {
        const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
      path.unshift(part);
      current = parent;
    }
    return path.join(' > ');
  }

  function isStableSelectorClass(value) {
    const className = String(value || '');
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{1,48}$/.test(className)) return false;
    return !/^(?:m[trblxy]?|p[trblxy]?|w|h|min|max|top|right|bottom|left|translate|rotate|scale|opacity|z|text|bg|border|rounded|flex|grid|gap|space|items|justify|overflow|absolute|relative|fixed|sticky)-/.test(className);
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function normalizeColorToken(color) {
    if (!color || color === 'transparent') return null;
    const value = String(color).trim().toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(value)) {
      return '#' + value.slice(1).split('').map((char) => char + char).join('').toLowerCase();
    }
    if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
    const rgba = value.match(/^rgba?\(([^)]+)\)$/i);
    if (!rgba) return value;
    const parts = rgba[1].split(',').map((part) => part.trim());
    const r = clampColor(Number.parseFloat(parts[0]));
    const g = clampColor(Number.parseFloat(parts[1]));
    const b = clampColor(Number.parseFloat(parts[2]));
    const a = parts.length > 3 ? Number.parseFloat(parts[3]) : 1;
    if (a === 0) return '#00000000';
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function clampColor(value) {
    if (Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(255, Math.round(value)));
  }

  function toHex(value) {
    return value.toString(16).padStart(2, '0');
  }
})();
