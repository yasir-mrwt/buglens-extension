const fs = require('fs');
const vm = require('vm');

class FakeElement {
  constructor(tagName, options = {}) {
    this.tagName = tagName.toUpperCase();
    this.nodeType = 1;
    this.id = options.id || '';
    this.classList = options.classes || [];
    this.childNodes = options.childNodes || [];
    this.children = [];
    this.parentElement = null;
    this.innerText = options.text || '';
    this.textContent = options.text || '';
    this.clientWidth = options.clientWidth || options.rect.width;
    this.clientHeight = options.clientHeight || options.rect.height;
    this.scrollWidth = options.scrollWidth || this.clientWidth;
    this.scrollHeight = options.scrollHeight || this.clientHeight;
    this._rect = options.rect;
    this._style = options.style;
    this._attrs = options.attrs || {};
    this.type = options.type || this._attrs.type || '';
    this.value = options.value || '';
    this.required = Boolean(options.required);
    this.disabled = Boolean(options.disabled);
    this.checked = Boolean(options.checked);
    this.style = {};
    this.clicked = false;
  }

  getBoundingClientRect() {
    const rect = this._rect;
    return {
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top
    };
  }

  querySelector() {
    return null;
  }

  contains(element) {
    return this === element || this.children.includes(element);
  }

  closest(selector) {
    if (selector === 'label' && this.tagName === 'LABEL') return this;
    return null;
  }

  matches(selector) {
    const tag = this.tagName.toLowerCase();
    if (selector.includes(tag)) return true;
    if (selector.includes('[role="button"]') && this._attrs.role === 'button') return true;
    if (selector.includes('[onclick]') && this._attrs.onclick) return true;
    return false;
  }

  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this._attrs, name);
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this._attrs, name) ? this._attrs[name] : null;
  }

  focus() {}

  dispatchEvent() {}

  click() {
    this.clicked = true;
  }
}

const canvas = new FakeElement('canvas', {
  id: 'background-canvas',
  rect: { left: 0, top: 0, width: 1280, height: 720 },
  style: {
    display: 'block',
    visibility: 'visible',
    opacity: '1',
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: '0',
    transform: 'none',
    overflow: 'visible',
    overflowX: 'visible',
    overflowY: 'visible',
    textOverflow: 'clip',
    whiteSpace: 'normal'
  }
});

const aboutSection = new FakeElement('section', {
  id: 'about-us',
  text: 'About us content that is intentionally below the fold.',
  rect: { left: 0, top: 900, width: 1200, height: 900 },
  clientWidth: 1200,
  clientHeight: 900,
  scrollWidth: 1200,
  scrollHeight: 1100,
  childNodes: [{ nodeType: 3, textContent: 'About us content' }],
  style: {
    display: 'block',
    visibility: 'visible',
    opacity: '1',
    position: 'relative',
    pointerEvents: 'auto',
    zIndex: 'auto',
    transform: 'none',
    overflow: 'hidden',
    overflowX: 'hidden',
    overflowY: 'hidden',
    textOverflow: 'clip',
    whiteSpace: 'normal'
  }
});

const transformedLabel = new FakeElement('span', {
  classes: ['translate-x-1/2', 'hero-label'],
  text: 'Decorative transformed label',
  rect: { left: -120, top: 80, width: 260, height: 24 },
  childNodes: [{ nodeType: 3, textContent: 'Decorative transformed label' }],
  style: {
    display: 'block',
    visibility: 'visible',
    opacity: '1',
    position: 'relative',
    pointerEvents: 'auto',
    zIndex: '1',
    transform: 'matrix(1, 0, 0, 1, -120, 0)',
    overflow: 'visible',
    overflowX: 'visible',
    overflowY: 'visible',
    textOverflow: 'clip',
    whiteSpace: 'normal'
  }
});

let messageListener;
let bodyElements = [canvas, aboutSection, transformedLabel];
const document = {
  documentElement: { scrollWidth: 1280 },
  images: [],
  querySelectorAll(selector) {
    if (selector === 'body *') return bodyElements;
    if (selector === 'a') return bodyElements.filter((element) => element.tagName === 'A');
    if (selector === 'form') return bodyElements.filter((element) => element.tagName === 'FORM');
    if (selector.includes('button')
      || selector.includes('input')
      || selector.includes('textarea')
      || selector.includes('select')
      || selector.includes('[role="button"]')) {
      return bodyElements.filter((element) => ['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName));
    }
    return [];
  },
  querySelector(selector) {
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      return bodyElements.find((element) => element.id === id) || null;
    }
    return null;
  },
  addEventListener() {},
  getElementById(id) {
    return bodyElements.find((element) => element.id === id) || null;
  }
};

const context = {
  chrome: {
    runtime: {
      lastError: null,
      sendMessage() {},
      onMessage: {
        addListener(listener) {
          messageListener = listener;
        }
      }
    }
  },
  window: {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    addEventListener() {},
    CSS: { escape(value) { return value; } },
    HTMLInputElement: FakeElement,
    HTMLTextAreaElement: FakeElement,
    scrollBy() {}
  },
  document,
  location: { href: 'https://example.test/' },
  performance: { now: (() => { let value = 0; return () => value += 5; })() },
  getComputedStyle(element) {
    return element._style;
  },
  Element: FakeElement,
  Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
  setTimeout,
  Event: class Event {
    constructor(type) {
      this.type = type;
    }
  },
  console
};

vm.createContext(context);
vm.runInContext(fs.readFileSync('content/content-script.js', 'utf8'), context, {
  filename: 'content/content-script.js'
});

function scan() {
  return new Promise((resolve, reject) => {
    messageListener({
      type: 'TESTPILOT_RUN_UI_SCAN',
      settings: {
        uiVisibleViewportOnly: true,
        uiIncludeDecorativeElements: false,
        maxUiNodes: 4000,
        maxUiIssues: 200,
        maxIssuesPerRule: 25
      }
    }, {}, (response) => {
      if (!response.ok) {
        reject(new Error(response.error || 'UI scan failed.'));
        return;
      }
      resolve(response.scan);
    });
  });
}

(async () => {
  const cleanScan = await scan();
  if (cleanScan.issues.length !== 0) {
    throw new Error(`Expected no UI findings, received ${cleanScan.issues.length}.`);
  }
  if (cleanScan.ignoredDecorativeCount !== 1) {
    throw new Error('Decorative background canvas was not ignored.');
  }

  const overflowingPanel = new FakeElement('article', {
    classes: ['w-[120%]', 'content-panel', 'overflow-test'],
    text: 'Meaningful visible content',
    rect: { left: 0, top: 120, width: 1420, height: 180 },
    childNodes: [{ nodeType: 3, textContent: 'Meaningful visible content' }],
    style: {
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      position: 'relative',
      pointerEvents: 'auto',
      zIndex: 'auto',
      transform: 'none',
      overflow: 'visible',
      overflowX: 'visible',
      overflowY: 'visible',
      textOverflow: 'clip',
      whiteSpace: 'normal'
    }
  });
  bodyElements = [overflowingPanel];
  const overflowScan = await scan();
  const overflowFinding = overflowScan.issues.find((issue) => issue.evidence.ruleId === 'element-viewport-overflow');
  if (!overflowFinding) {
    throw new Error('Meaningful visible viewport overflow was not detected.');
  }
  if (overflowFinding.evidence.selector !== 'article.content-panel') {
    throw new Error(`Expected a concise stable selector, received ${overflowFinding.evidence.selector}.`);
  }

  const missingHref = new FakeElement('a', {
    text: 'Broken CTA',
    attrs: {},
    rect: { left: 30, top: 140, width: 120, height: 36 },
    childNodes: [{ nodeType: 3, textContent: 'Broken CTA' }],
    style: {
      display: 'inline-block',
      visibility: 'visible',
      opacity: '1',
      position: 'relative',
      pointerEvents: 'auto',
      zIndex: 'auto',
      transform: 'none',
      overflow: 'visible',
      overflowX: 'visible',
      overflowY: 'visible',
      textOverflow: 'clip',
      whiteSpace: 'normal'
    }
  });
  const missingTarget = new FakeElement('a', {
    text: 'Jump to pricing',
    attrs: { href: '#pricing' },
    rect: { left: 30, top: 190, width: 140, height: 36 },
    childNodes: [{ nodeType: 3, textContent: 'Jump to pricing' }],
    style: missingHref._style
  });
  bodyElements = [missingHref, missingTarget];
  const linkScan = await scan();
  if (!linkScan.issues.some((issue) => issue.evidence.ruleId === 'missing-link-href')) {
    throw new Error('Visible anchor without href was not detected.');
  }
  if (!linkScan.issues.some((issue) => issue.evidence.ruleId === 'missing-anchor-target')) {
    throw new Error('Visible hash link with missing target was not detected.');
  }

  const emailInput = new FakeElement('input', {
    id: 'email',
    type: 'email',
    attrs: { id: 'email', type: 'email', placeholder: 'Email' },
    rect: { left: 30, top: 140, width: 220, height: 36 },
    style: missingHref._style
  });
  const submitButton = new FakeElement('button', {
    id: 'submit',
    text: 'Submit',
    attrs: { id: 'submit' },
    rect: { left: 30, top: 190, width: 110, height: 36 },
    childNodes: [{ nodeType: 3, textContent: 'Submit' }],
    style: missingHref._style
  });
  bodyElements = [emailInput, submitButton];
  const agentResult = await new Promise((resolve, reject) => {
    messageListener({
      type: 'TESTPILOT_RUN_AGENT',
      command: 'Validate this login form',
      options: {}
    }, {}, (response) => {
      if (!response.ok) {
        reject(new Error(response.error || 'Agent workflow failed.'));
        return;
      }
      resolve(response.result);
    });
  });
  if (agentResult.taskType !== 'form_validation') {
    throw new Error(`Expected form_validation task, received ${agentResult.taskType}.`);
  }
  if (!agentResult.plan.steps.some((step) => step.action === 'type')) {
    throw new Error('Agent did not plan safe typing for form validation.');
  }
  if (!emailInput.value) {
    throw new Error('Agent did not enter safe QA data into the input.');
  }

  console.log('UI scanner regression test passed.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
