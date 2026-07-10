// @ts-nocheck
(() => {
  const PAGE_CONSOLE_SOURCE = 'testpilot-page-console-listener';
  const MAX_ISSUES_PER_RULE_DEFAULT = 25;
  const MAX_UI_ISSUES_DEFAULT = 200;
  const MAX_UI_NODES_DEFAULT = 4000;
  const MAX_SELECTED_TEXT_LENGTH = 5000;
  const MAX_VISIBLE_SUMMARY_LENGTH = 3000;
  const MAX_AGENT_ELEMENTS = 80;
  const AGENT_TYPE_DELAY_MS = 38;
  const ALLOWED_AGENT_ACTIONS = new Set(['click', 'type', 'clear', 'select', 'check', 'uncheck', 'scroll', 'highlight', 'wait', 'observe', 'navigate']);
  const SAFE_DUMMY_VALUES = {
    email: 'invalid-email',
    validEmail: 'qa.test@example.com',
    password: 'TestPilot#12345',
    invalidPassword: '123',
    name: 'QA Test User',
    phone: '1234567890',
    invalidPhone: 'abc',
    message: 'This is a QA validation test.',
    search: 'test',
    generic: 'test'
  };
  let activeSessionId = null;

  function sendToExtension(kind, payload) {
    try {
      chrome.runtime.sendMessage({
        source: 'testpilot-content',
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

  document.addEventListener('click', (event) => {
    const target = event.target && event.target.closest
      ? event.target.closest('button, a, input, select, textarea, [role="button"], [onclick]')
      : event.target;
    if (!target) return;
    const actionType = target.tagName && target.tagName.toLowerCase() === 'a' ? 'click-link' : 'click';
    sendUserAction(actionType, target, {
      href: target.getAttribute ? target.getAttribute('href') : null,
      download: target.hasAttribute && target.hasAttribute('download')
    });
  }, true);

  document.addEventListener('submit', (event) => {
    sendUserAction('submit', event.target, {
      method: event.target && event.target.method,
      action: event.target && event.target.action
    });
  }, true);

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!target || !target.matches || !target.matches('input, select, textarea')) return;
    sendUserAction(target.type === 'file' ? 'file-upload' : 'input-change', target, {
      inputType: target.type || target.tagName.toLowerCase(),
      name: target.name || null
    });
  }, true);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== 'object') return false;

    if (message.type === 'TESTPILOT_RUN_UI_SCAN') {
      const settings = message.settings || {};
      runWhenIdle(() => runUiScan(settings))
        .then((scan) => sendResponse({ ok: true, scan }))
        .catch((error) => sendResponse({
          ok: false,
          error: error && error.message ? error.message : 'UI scan failed.'
        }));
      return true;
    }

    if (message.type === 'TESTPILOT_PING_CONTENT') {
      sendResponse({ ok: true, url: location.href });
      return true;
    }

    if (message.type === 'TESTPILOT_SET_SESSION') {
      activeSessionId = typeof message.sessionId === 'string' ? message.sessionId : null;
      sendResponse({ ok: true, sessionId: activeSessionId });
      return true;
    }

    if (message.type === 'TESTPILOT_CAPTURE_PAGE_CONTEXT') {
      try {
        const context = capturePageContext(message.mode || 'selection');
        sendResponse({ ok: true, context });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error && error.message ? error.message : 'Page context capture failed.'
        });
      }
      return true;
    }

    if (message.type === 'TESTPILOT_GET_AGENT_CONTEXT') {
      try {
        sendResponse({ ok: true, context: extractAgentPageContext() });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error && error.message ? error.message : 'Agent page context extraction failed.'
        });
      }
      return true;
    }

    if (message.type === 'TESTPILOT_RUN_AGENT') {
      runWhenIdle(() => runAgentWorkflow(message.command || '', message.options || {}))
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error) => sendResponse({
          ok: false,
          error: error && error.message ? error.message : 'Agent workflow failed.'
        }));
      return true;
    }

    return false;
  });

  async function runAgentWorkflow(command, options = {}) {
    const userCommand = sanitizePageText(command, 1000);
    const pageContext = extractAgentPageContext();
    const dataStrategy = detectDataStrategy(userCommand);
    const taskType = classifyAgentTask(userCommand, pageContext, dataStrategy);
    const requestKey = buildAgentRequestKey({
      sessionId: activeSessionId || options.sessionId || '',
      pageUrl: pageContext.url,
      mode: options.mode || 'agent',
      userMessage: userCommand,
      taskType,
      dataStrategy,
      pageContextHash: pageContext.contextHash
    });
    const fallbackPlan = buildAgentPlan(userCommand, taskType, pageContext, { ...options, dataStrategy });
    const plan = normalizeStructuredAgentPlan(options.structuredPlan, fallbackPlan, taskType, pageContext);
    const approvalValid = isAgentApprovalTokenValid(options.approval, requestKey);
    const resumeFromStepIndex = approvalValid
      ? Math.min(Math.max(0, Number(options.approval.resumeFromStepIndex || 0)), plan.steps.length)
      : 0;
    emitAgentEvent('started', {
      requestKey,
      command: userCommand,
      taskType,
      dataStrategy,
      summary: plan.summary,
      totalSteps: plan.steps.length
    });
    emitAgentEvent('plan-ready', {
      requestKey,
      taskType,
      summary: plan.summary,
      steps: plan.steps.map((step, index) => describeAgentStepForEvent(step, index, pageContext))
    });
    const safety = validateAgentPlan(plan, pageContext, options.approval, requestKey);
    const actionResults = approvalValid
      ? sanitizePreviousAgentActionResults(options.approval.previousActionResults)
      : [];
    if (safety.approved) {
      emitAgentEvent('approval-granted', {
        requestKey,
        taskType,
        summary: resumeFromStepIndex > 0
          ? `Tester approved once. Resuming at step ${resumeFromStepIndex + 1}.`
          : 'Tester approved the preflighted serious action once. Continuing safely.'
      });
    }

    if (!safety.ok) {
      const result = evaluateAgentResult(plan, actionResults, observeAgentPage(pageContext), safety);
      const approvalRequest = buildAgentApprovalRequest(userCommand, requestKey, taskType, safety, actionResults, plan, null, pageContext);
      emitAgentEvent(safety.requiresConfirmation ? 'permission-required' : 'blocked', {
        requestKey,
        command: userCommand,
        taskType,
        summary: result.summary,
        needsConfirmation: safety.needsConfirmation || [],
        blocked: safety.blocked || [],
        approval: approvalRequest
      });
      return {
        command: userCommand,
        taskType,
        dataStrategy,
        requestKey,
        pageContext: compactAgentContextForResponse(pageContext),
        plan: { ...plan, riskLevel: safety.requiresConfirmation ? 'needs_confirmation' : 'blocked' },
        safety,
        approval: approvalRequest,
        actionResults,
        result
      };
    }

    for (let index = resumeFromStepIndex; index < plan.steps.length; index += 1) {
      const step = plan.steps[index];
      const confirmation = getAgentStepConfirmation(step, pageContext);
      if (confirmation && !isAgentStepApproved(step, pageContext, options.approval, requestKey)) {
        const pauseSafety = {
          ...safety,
          ok: false,
          requiresConfirmation: true,
          needsConfirmation: [confirmation.reason],
          blocked: []
        };
        const result = {
          status: 'blocked',
          summary: 'Agent paused before a serious action and is waiting for tester approval.',
          passedChecks: actionResults.filter((item) => item.success).map((item) => `${item.action}: ${item.message}`),
          failedChecks: [],
          evidence: [confirmation.reason],
          recommendedNextSteps: ['Approve once to continue this exact task, or cancel and use a narrower command.']
        };
        const approvalRequest = buildAgentApprovalRequest(userCommand, requestKey, taskType, pauseSafety, actionResults, plan, step, pageContext, index);
        emitAgentEvent('permission-required', {
          requestKey,
          command: userCommand,
          taskType,
          summary: result.summary,
          needsConfirmation: pauseSafety.needsConfirmation,
          blocked: [],
          approval: approvalRequest
        });
        return {
          command: userCommand,
          taskType,
          dataStrategy,
          requestKey,
          pageContext: compactAgentContextForResponse(pageContext),
          plan: { ...plan, riskLevel: 'needs_confirmation' },
          safety: pauseSafety,
          approval: approvalRequest,
          actionResults,
          observation: observeAgentPage(pageContext),
          result
        };
      }
      emitAgentEvent('step-started', {
        requestKey,
        ...describeAgentStepForEvent(step, index, pageContext)
      });
      const actionResult = await executeAgentStep(step, index, pageContext, requestKey);
      actionResults.push(actionResult);
      emitAgentEvent('step-completed', {
        requestKey,
        stepIndex: index,
        action: actionResult.action,
        targetIndex: actionResult.targetIndex,
        targetLabel: actionResult.targetLabel,
        success: actionResult.success,
        message: actionResult.message,
        valuePreview: actionResult.valuePreview || '',
        expectedObservation: step.expectedObservation || ''
      });
      if (!actionResult.success && ['click', 'type', 'select', 'check', 'uncheck', 'navigate'].includes(step.action)) break;
      if (['click', 'navigate', 'select'].includes(step.action)) await waitForAgent(350);
    }

    const observation = observeAgentPage(pageContext);
    const result = evaluateAgentResult(plan, actionResults, observation, safety);
    emitAgentEvent('completed', {
      requestKey,
      taskType,
      status: result.status,
      summary: result.summary,
      passed: actionResults.filter((item) => item.success).length,
      failed: actionResults.filter((item) => !item.success).length
    });
    return {
      command: userCommand,
      taskType,
      dataStrategy,
      requestKey,
      pageContext: compactAgentContextForResponse(pageContext),
      plan,
      safety,
      actionResults,
      observation,
      result
    };
  }

  function emitAgentEvent(event, payload = {}) {
    sendToExtension('agent-event', {
      event,
      requestKey: payload.requestKey || '',
      timestamp: Date.now(),
      url: location.href,
      ...payload
    });
  }

  function describeAgentStepForEvent(step, index, context) {
    const target = step.targetIndex ? (context.elements || []).find((item) => item.index === step.targetIndex) : null;
    return {
      stepIndex: index,
      stepNumber: index + 1,
      action: step.action,
      targetIndex: step.targetIndex || null,
      targetLabel: target ? sanitizePageText(target.label || target.text || target.placeholder || target.role, 120) : '',
      reason: step.reason || 'QA step',
      expectedObservation: step.expectedObservation || '',
      valuePreview: step.action === 'type' ? maskAgentTypedValue(step.value, target) : ''
    };
  }

  function buildAgentApprovalRequest(command, requestKey, taskType, safety, actionResults = [], plan = {}, pendingStep = null, context = {}, pendingStepIndex = null) {
    const confirmation = pendingStep ? getAgentStepConfirmation(pendingStep, context) : null;
    const stepFingerprint = pendingStep ? getAgentStepApprovalFingerprint(pendingStep, context, confirmation) : '';
    const resumeFromStepIndex = Number.isFinite(Number(pendingStepIndex)) ? Number(pendingStepIndex) : 0;
    return {
      command,
      requestKey,
      taskType,
      stepFingerprint,
      resumeFromStepIndex,
      reasons: [...(safety.needsConfirmation || []), ...(safety.blocked || [])].slice(0, 8),
      warning: 'Review the filled inputs below. TestPilot will continue only after tester approval.',
      inputSummary: summarizeAgentInputsForApproval(actionResults),
      previousActionResults: summarizeAgentActionResultsForApproval(actionResults),
      pendingAction: pendingStep ? describeAgentStepForEvent(pendingStep, resumeFromStepIndex, context) : null,
      rememberable: Boolean(confirmation && confirmation.rememberable),
      preferenceScope: confirmation ? {
        category: confirmation.category,
        taskType,
        pageOrigin: safePageOrigin(context.url || location.href),
        pagePath: safePagePath(context.url || location.href),
        targetLabel: confirmation.targetLabel || ''
      } : null
    };
  }

  function summarizeAgentActionResultsForApproval(actionResults = []) {
    return actionResults.slice(0, 12).map((item) => ({
      stepIndex: Number(item.stepIndex || 0),
      action: sanitizePageText(item.action || '', 40),
      targetIndex: item.targetIndex || null,
      targetLabel: sanitizePageText(item.targetLabel || '', 120),
      success: Boolean(item.success),
      message: sanitizePageText(item.message || '', 260),
      valuePreview: sanitizePageText(item.valuePreview || '', 200),
      timestamp: item.timestamp || Date.now(),
      startedAt: item.startedAt || item.timestamp || Date.now(),
      completedAt: item.completedAt || Date.now()
    }));
  }

  function sanitizePreviousAgentActionResults(actionResults = []) {
    if (!Array.isArray(actionResults)) return [];
    return actionResults.slice(0, 12).map((item) => ({
      stepIndex: Number(item.stepIndex || 0),
      action: sanitizePageText(item.action || '', 40),
      targetIndex: item.targetIndex || null,
      targetLabel: sanitizePageText(item.targetLabel || '', 120),
      success: Boolean(item.success),
      message: sanitizePageText(item.message || '', 260),
      valuePreview: sanitizePageText(item.valuePreview || '', 200),
      timestamp: Number(item.timestamp || item.startedAt || Date.now()),
      startedAt: Number(item.startedAt || item.timestamp || Date.now()),
      completedAt: Number(item.completedAt || Date.now())
    }));
  }

  function summarizeAgentInputsForApproval(actionResults = []) {
    return actionResults
      .filter((item) => ['type', 'select', 'check', 'uncheck', 'clear'].includes(item.action))
      .map((item) => ({
        action: item.action,
        targetIndex: item.targetIndex || null,
        targetLabel: item.targetLabel || (item.targetIndex ? `Target #${item.targetIndex}` : 'Target field'),
        valuePreview: item.valuePreview || (item.action === 'clear' ? '(cleared)' : ''),
        success: Boolean(item.success)
      }))
      .slice(0, 12);
  }

  function safePageOrigin(url) {
    try {
      return new URL(url || location.href).origin;
    } catch {
      return '';
    }
  }

  function safePagePath(url) {
    try {
      const parsed = new URL(url || location.href);
      return `${parsed.pathname}${parsed.search ? '?query' : ''}`;
    } catch {
      return '';
    }
  }

  function extractAgentPageContext() {
    const candidates = getAgentCandidateElements();
    const elements = candidates.map((element, index) => describeAgentElement(element, index + 1)).filter(Boolean);
    const forms = Array.from(document.querySelectorAll('form')).filter((form) => isVisibleElement(form, false)).slice(0, 8).map((form, formIndex) => {
      const contained = elements.filter((item) => item.selectorHint && form.contains && form.contains(getElementBySelector(item.selectorHint)));
      return {
        index: formIndex + 1,
        name: sanitizePageText(form.getAttribute('name') || form.getAttribute('id') || getShortText(form), 120),
        fields: contained.filter((item) => ['input', 'textarea', 'select', 'checkbox', 'radio', 'upload'].includes(item.role)).map((item) => item.index),
        submitButtons: contained.filter((item) => item.role === 'button' && /submit|log in|login|sign in|sign up|send|save|continue|place|search/i.test(`${item.text || ''} ${item.label || ''}`)).map((item) => item.index)
      };
    });
    const headings = getVisibleHeadings();
    const visibleAlerts = getVisibleAlertTexts();
    const importantText = getImportantVisibleText();
    const pageType = inferAgentPageType(elements, forms, headings, importantText);
    const availableSafeActions = inferAvailableSafeActions(elements);
    const summary = sanitizePageText([
      document.title ? `Title: ${document.title}` : '',
      pageType ? `Page type: ${pageType}` : '',
      headings.length ? `Headings: ${headings.join(' | ')}` : '',
      importantText.length ? `Visible text: ${importantText.join(' | ')}` : '',
      elements.length ? `${elements.length} visible interactive or QA-relevant elements indexed.` : 'No obvious visible interactive elements indexed.',
      visibleAlerts.length ? `Visible alerts: ${visibleAlerts.join(' | ')}` : ''
    ].filter(Boolean).join(' '), 900);
    return {
      url: location.href,
      title: document.title || '',
      summary,
      pageType,
      headings,
      importantText,
      visibleAlerts,
      elements,
      forms,
      availableSafeActions,
      contextHash: simpleHash(JSON.stringify({
        url: location.href,
        title: document.title || '',
        pageType,
        headings,
        importantText,
        elements: elements.map((item) => [item.index, item.role, item.label, item.text, item.placeholder, item.type]),
        forms
      }))
    };
  }

  function getAgentCandidateElements() {
    const selector = [
      'button',
      'a',
      'input',
      'textarea',
      'select',
      'summary',
      '[role="button"]',
      '[role="link"]',
      '[role="tab"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[aria-expanded]',
      '[onclick]',
      'table',
      '[role="table"]',
      '[role="dialog"]',
      'dialog'
    ].join(',');
    const seen = new Set();
    return Array.from(document.querySelectorAll(selector))
      .filter((element) => {
        if (!element || seen.has(element)) return false;
        seen.add(element);
        return isVisibleElement(element, true);
      })
      .slice(0, MAX_AGENT_ELEMENTS);
  }

  function describeAgentElement(element, index) {
    const tag = element.tagName.toLowerCase();
    const inputType = tag === 'input' ? String(element.type || 'text').toLowerCase() : '';
    const role = inferAgentRole(element, tag, inputType);
    const selectorHint = getSelector(element);
    const label = getElementLabel(element) || getAssociatedLabel(element);
    return {
      index,
      role,
      text: sanitizePageText(getShortText(element), 120),
      label: sanitizePageText(label, 120),
      placeholder: sanitizePageText(element.getAttribute && element.getAttribute('placeholder') || '', 120),
      type: inputType || tag,
      required: Boolean(element.required || element.getAttribute && element.getAttribute('aria-required') === 'true'),
      disabled: Boolean(element.disabled || element.getAttribute && element.getAttribute('aria-disabled') === 'true'),
      visible: true,
      selectorHint,
      href: tag === 'a' ? sanitizePageText(element.getAttribute('href') || '', 240) : undefined
    };
  }

  function inferAgentRole(element, tag, inputType) {
    const text = `${getShortText(element)} ${getElementLabel(element)} ${element.getAttribute && (element.getAttribute('aria-label') || element.getAttribute('class') || '')}`.toLowerCase();
    if (tag === 'table' || element.getAttribute && element.getAttribute('role') === 'table') return 'table';
    if (tag === 'textarea') return 'textarea';
    if (tag === 'select') return 'select';
    if (tag === 'a' && element.hasAttribute && element.hasAttribute('download')) return 'download';
    if (tag === 'a') return 'link';
    if (tag === 'input' && inputType === 'file') return 'upload';
    if (tag === 'input' && ['button', 'submit', 'reset'].includes(inputType)) return 'button';
    if (tag === 'input' && inputType === 'checkbox') return 'checkbox';
    if (tag === 'input' && inputType === 'radio') return 'radio';
    if (tag === 'input') return 'input';
    if (element.getAttribute && element.getAttribute('role') === 'tab') return 'tab';
    if (tag === 'summary' || element.getAttribute && element.hasAttribute('aria-expanded')) {
      if (/accordion|faq|expand|collapse/.test(text)) return 'accordion';
    }
    if (/modal|dialog|popup|open/.test(text)) return 'modal_trigger';
    if (/next|previous|prev|page \d|pagination/.test(text)) return 'pagination';
    if (tag === 'button' || element.getAttribute && ['button', 'checkbox', 'radio'].includes(element.getAttribute('role'))) return 'button';
    return 'other';
  }

  function detectDataStrategy(command) {
    const value = String(command || '').toLowerCase();
    const asksEmpty = /\b(empty|required|blank|missing)\b/.test(value);
    const asksInvalid = /\b(invalid|fake|wrong|negative|bad|dummy login|fake email|fake emails)\b/.test(value);
    const asksValid = /\b(valid|real|realistic|signup|sign up|register|account|create account|dummy account)\b/.test(value);
    const hasProvidedData = /(?:email|username|password|phone|name)\s*[:=]\s*\S+/i.test(String(command || ''));
    if (asksEmpty && asksInvalid) return 'fake_invalid';
    if (asksEmpty) return 'empty';
    if (asksInvalid) return asksValid ? 'fake_invalid' : 'invalid';
    if (asksValid) return hasProvidedData ? 'real_user_provided' : 'valid_dummy';
    return 'unknown';
  }

  function classifyAgentTask(command, context, dataStrategy = 'unknown') {
    const value = String(command || '').toLowerCase();
    if (/highlight|show.*interactive|index.*element|interactive element/.test(value)) return 'highlight_interactions';
    if (/summari[sz]e|describe.*page|page summary/.test(value)) return 'page_summary';
    if (/generate.*test|test case|qa scenario/.test(value)) return 'test_case_generation';
    if (/bug report|create.*bug|draft.*bug|jira|github issue/.test(value)) return 'bug_report_generation';
    if (/accessib|a11y|alt text|label|heading/.test(value)) return 'accessibility_check';
    if (/signup|sign up|register|account|create account/.test(value) && ['invalid', 'fake_invalid'].includes(dataStrategy)) return 'invalid_signup_validation';
    if (/signup|sign up|register|account|create account/.test(value) && ['valid_dummy', 'real_user_provided'].includes(dataStrategy)) return 'valid_dummy_data_flow';
    if (/empty|required|blank/.test(value) && /invalid|fake|dummy|wrong/.test(value) && /field|form|input|login|signup|sign up|email|credential/.test(value)) return 'login_validation';
    if (/empty|required|blank/.test(value) && /field|form|input|login|signup|sign up/.test(value)) return 'required_field_validation';
    if (/invalid|fake|dummy|wrong/.test(value) && /email|credential|login|password/.test(value)) return 'invalid_login_test';
    if (['valid_dummy', 'real_user_provided'].includes(dataStrategy) && /login|form|password|contact/.test(value)) return 'valid_dummy_data_flow';
    if (/login|signup|sign up|form|password|contact/.test(value)) return 'form_validation';
    if (/search/.test(value)) return 'search_test';
    if (/filter|dropdown|select|category|sort/.test(value)) return 'filter_test';
    if (/modal|dialog|popup/.test(value)) return 'modal_test';
    if (/tab/.test(value)) return 'tab_test';
    if (/accordion|faq|expand|collapse/.test(value)) return 'accordion_test';
    if (/table|row|column/.test(value)) return 'table_test';
    if (/pagination|next page|previous page|pager/.test(value)) return 'pagination_test';
    if (/upload/.test(value)) return 'upload_test';
    if (/download/.test(value)) return 'download_test';
    if (/link|navigation|nav|menu/.test(value)) return 'link_navigation_test';
    if (/button|cta|click/.test(value)) return 'button_test';
    if (context.forms && context.forms.length) return 'form_validation';
    return 'general_page_validation';
  }

  function getImportantVisibleText() {
    return Array.from(document.querySelectorAll('main, h1, h2, h3, [role="main"], [role="alert"], [role="status"], .error, .success, .message'))
      .filter((element) => isVisibleElement(element, true))
      .map((element) => sanitizePageText(getShortText(element), 180))
      .filter(Boolean)
      .slice(0, 8);
  }

  function inferAgentPageType(elements, forms, headings, importantText) {
    const haystack = [
      document.title || '',
      ...(headings || []),
      ...(importantText || []),
      ...(elements || []).map((item) => `${item.role} ${item.label || ''} ${item.text || ''} ${item.placeholder || ''}`)
    ].join(' ').toLowerCase();
    if (/sign up|signup|register|create account|join/.test(haystack)) return 'signup';
    if (/login|log in|sign in|password/.test(haystack)) return 'login';
    if (/search|results|filter/.test(haystack)) return 'search';
    if (/cart|checkout|payment|billing/.test(haystack)) return 'checkout';
    if (/table|pagination|next page|previous page/.test(haystack)) return 'listing';
    if (forms && forms.length) return 'form';
    return 'general';
  }

  function inferAvailableSafeActions(elements) {
    const roles = new Set((elements || []).map((item) => item.role));
    return [
      roles.has('button') ? 'click safe buttons' : '',
      roles.has('link') ? 'test safe same-site links' : '',
      roles.has('input') || roles.has('textarea') ? 'type safe QA data' : '',
      roles.has('select') ? 'select safe options' : '',
      roles.has('checkbox') || roles.has('radio') ? 'toggle safe choices' : '',
      roles.has('table') ? 'review table/list content' : '',
      roles.has('pagination') ? 'test pagination' : ''
    ].filter(Boolean);
  }

  function buildAgentPlan(command, taskType, context, options = {}) {
    const dataStrategy = options.dataStrategy || 'unknown';
    const steps = [];
    const targetElements = [];
    const addStep = (step) => {
      if (step.targetIndex) targetElements.push(step.targetIndex);
      steps.push(step);
    };
    const elements = context.elements || [];
    const first = (predicate) => elements.find((item) => predicate(item) && !item.disabled);
    const many = (predicate, limit = 4) => elements.filter((item) => predicate(item) && !item.disabled).slice(0, limit);
    const primaryForm = context.forms && context.forms[0];
    const formFields = () => (primaryForm
      ? primaryForm.fields.map((index) => elements.find((item) => item.index === index)).filter(Boolean)
      : elements.filter((item) => ['input', 'textarea', 'select', 'checkbox', 'radio'].includes(item.role) && !item.disabled).slice(0, 6));
    const submitButton = () => (primaryForm ? primaryForm.submitButtons : []).map((index) => elements.find((item) => item.index === index)).find(Boolean)
      || first((item) => item.role === 'button' && /submit|log in|login|sign in|sign up|send|continue|save|search|place/i.test(`${item.text || ''} ${item.label || ''}`));

    if (taskType === 'highlight_interactions') {
      for (const item of many((element) => ['button', 'link', 'input', 'select', 'textarea', 'checkbox', 'radio', 'tab', 'accordion', 'pagination'].includes(element.role), 12)) {
        addStep({ action: 'highlight', targetIndex: item.index, reason: 'Highlight this visible interactive element with its index.', expectedObservation: 'Element is visibly outlined for QA review.' });
      }
      addStep({ action: 'observe', reason: 'Summarize highlighted interactive coverage.', expectedObservation: 'Important interactive elements are indexed without typing or clicking.' });
    } else if (taskType === 'required_field_validation') {
      const fields = formFields();
      for (const field of fields.slice(0, 6)) {
        if (['input', 'textarea'].includes(field.role)) {
          addStep({ action: 'clear', targetIndex: field.index, reason: 'Clear required field before empty-submit validation.', expectedObservation: 'Field is empty.' });
        } else if (['checkbox', 'radio'].includes(field.role)) {
          addStep({ action: 'uncheck', targetIndex: field.index, reason: 'Leave required choice unselected for validation.', expectedObservation: 'Choice is unselected.' });
        }
      }
      const submit = submitButton();
      if (submit) addStep({ action: 'click', targetIndex: submit.index, reason: 'Submit empty required fields safely.', expectedObservation: 'Required-field validation appears and submission is blocked.' });
      addStep({ action: 'observe', reason: 'Observe required-field validation evidence.', expectedObservation: 'Required field messages or invalid field state are visible.' });
    } else if (taskType === 'invalid_login_test' || taskType === 'invalid_signup_validation' || taskType === 'login_validation') {
      const fields = formFields();
      const submit = submitButton();
      if (taskType === 'login_validation') {
        for (const field of fields.slice(0, 5)) {
          if (['input', 'textarea'].includes(field.role)) addStep({ action: 'clear', targetIndex: field.index, reason: 'Clear field for empty-login validation.', expectedObservation: 'Field is empty.' });
        }
        if (submit) addStep({ action: 'click', targetIndex: submit.index, reason: 'Submit empty login form to check required validation.', expectedObservation: 'Required-field validation appears.' });
        addStep({ action: 'observe', reason: 'Observe empty-field validation before entering invalid data.', expectedObservation: 'Required validation is visible or marked needs-review.' });
      }
      const emailField = fields.find((field) => /email|user|login/.test(`${field.type || ''} ${field.label || ''} ${field.placeholder || ''}`.toLowerCase())) || fields.find((field) => field.role === 'input');
      const passwordField = fields.find((field) => /password/.test(`${field.type || ''} ${field.label || ''} ${field.placeholder || ''}`.toLowerCase()));
      const phoneField = fields.find((field) => /phone|tel|mobile/.test(`${field.type || ''} ${field.label || ''} ${field.placeholder || ''}`.toLowerCase()));
      if (emailField) {
        addStep({ action: 'clear', targetIndex: emailField.index, reason: 'Clear email/login field before invalid-email test.', expectedObservation: 'Email/login field is empty.' });
        addStep({ action: 'type', targetIndex: emailField.index, value: SAFE_DUMMY_VALUES.email, reason: 'Enter invalid safe email value.', expectedObservation: 'Invalid email value is entered.' });
      }
      if (passwordField) {
        addStep({ action: 'clear', targetIndex: passwordField.index, reason: 'Clear password field before dummy credential test.', expectedObservation: 'Password field is empty.' });
        addStep({ action: 'type', targetIndex: passwordField.index, value: SAFE_DUMMY_VALUES.invalidPassword, reason: 'Enter intentionally weak safe password value.', expectedObservation: 'Weak password value is entered.' });
      }
      if (phoneField) {
        addStep({ action: 'clear', targetIndex: phoneField.index, reason: 'Clear phone field before invalid phone test.', expectedObservation: 'Phone field is empty.' });
        addStep({ action: 'type', targetIndex: phoneField.index, value: SAFE_DUMMY_VALUES.invalidPhone, reason: 'Enter invalid safe phone value.', expectedObservation: 'Invalid phone value is entered.' });
      }
      if (submit) addStep({ action: 'click', targetIndex: submit.index, reason: 'Submit safe dummy credentials to observe login validation.', expectedObservation: 'Invalid credential, validation, route, API, or console evidence appears.' });
      addStep({ action: 'observe', reason: 'Observe invalid login result.', expectedObservation: 'Invalid email/credential evidence is visible or linked to API/console activity.' });
    } else if (taskType === 'valid_dummy_data_flow') {
      const fields = formFields();
      for (const field of fields.slice(0, 7)) {
        if (field.role === 'select') {
          addStep({ action: 'select', targetIndex: field.index, value: '__FIRST_SAFE_OPTION__', reason: 'Select a safe option for valid dummy data flow.', expectedObservation: 'Field accepts a safe option.' });
        } else if (['checkbox', 'radio'].includes(field.role)) {
          addStep({ action: 'check', targetIndex: field.index, reason: 'Select safe required option for valid dummy data flow.', expectedObservation: 'Option becomes selected.' });
        } else if (['input', 'textarea'].includes(field.role)) {
          addStep({ action: 'clear', targetIndex: field.index, reason: 'Clear field before valid dummy QA input.', expectedObservation: 'Field is empty.' });
          addStep({ action: 'type', targetIndex: field.index, value: validDummyValueForField(field), reason: realDataDisclaimer(dataStrategy), expectedObservation: 'Valid-looking dummy QA value is entered.' });
        }
      }
      const submit = submitButton();
      if (submit) addStep({ action: 'click', targetIndex: submit.index, reason: 'Submit valid-looking dummy QA data because the prompt requested valid/real/signup testing.', expectedObservation: 'Success, validation, route, API, or console evidence appears.' });
      addStep({ action: 'observe', reason: 'Observe valid dummy data result.', expectedObservation: 'Success/error/result evidence is visible or linked to API/console activity.' });
    } else if (taskType === 'form_validation') {
      const fields = formFields();
      for (const field of fields.slice(0, 5)) {
        if (field.role === 'select') {
          addStep({ action: 'select', targetIndex: field.index, value: '__FIRST_SAFE_OPTION__', reason: 'Select a safe non-empty option for form validation.', expectedObservation: 'Field accepts a test option.' });
        } else if (['checkbox', 'radio'].includes(field.role)) {
          addStep({ action: 'check', targetIndex: field.index, reason: 'Select required option safely.', expectedObservation: 'Option becomes selected.' });
        } else if (['input', 'textarea'].includes(field.role)) {
          addStep({ action: 'clear', targetIndex: field.index, reason: 'Clear field before QA input.', expectedObservation: 'Field is empty.' });
          addStep({ action: 'type', targetIndex: field.index, value: dataStrategy === 'valid_dummy' ? validDummyValueForField(field) : dummyValueForField(field), reason: dataStrategy === 'valid_dummy' ? 'Enter valid-looking dummy QA test data.' : 'Enter safe QA test data.', expectedObservation: 'Field accepts safe QA value.' });
        }
      }
      const submit = submitButton();
      if (submit) addStep({ action: 'click', targetIndex: submit.index, reason: 'Submit safe dummy form data to check validation behavior.', expectedObservation: 'Validation, error, success, or route state becomes visible.' });
      addStep({ action: 'observe', reason: 'Observe validation messages and page state after form interaction.', expectedObservation: 'Validation evidence is visible or marked needs-review.' });
    } else if (taskType === 'search_test') {
      const search = first((item) => ['input', 'textarea'].includes(item.role) && /search|query|keyword/.test(`${item.label || ''} ${item.placeholder || ''} ${item.text || ''} ${item.type || ''}`));
      const button = first((item) => item.role === 'button' && /search|go|submit/.test(`${item.text || ''} ${item.label || ''}`));
      if (search) {
        addStep({ action: 'clear', targetIndex: search.index, reason: 'Clear search input.', expectedObservation: 'Search input is empty.' });
        addStep({ action: 'type', targetIndex: search.index, value: SAFE_DUMMY_VALUES.search, reason: 'Enter safe search query.', expectedObservation: 'Search query is entered.' });
      }
      if (button) addStep({ action: 'click', targetIndex: button.index, reason: 'Submit the search query.', expectedObservation: 'Results, no-results state, or URL change appears.' });
      addStep({ action: 'observe', reason: 'Observe search results or feedback.', expectedObservation: 'Search produces visible evidence.' });
    } else if (taskType === 'filter_test') {
      const filter = first((item) => item.role === 'select' || /filter|sort|category/.test(`${item.text || ''} ${item.label || ''}`));
      if (filter) addStep({ action: filter.role === 'select' ? 'select' : 'click', targetIndex: filter.index, value: '__FIRST_SAFE_OPTION__', reason: 'Change visible filter safely.', expectedObservation: 'List, table, URL, or selected state changes.' });
      addStep({ action: 'observe', reason: 'Observe filtered result state.', expectedObservation: 'Filter change is visible or needs review.' });
    } else if (taskType === 'modal_test') {
      const trigger = first((item) => ['modal_trigger', 'button', 'link'].includes(item.role) && /modal|dialog|popup|open|view|details/.test(`${item.text || ''} ${item.label || ''}`));
      if (trigger) addStep({ action: 'click', targetIndex: trigger.index, reason: 'Open modal/dialog safely.', expectedObservation: 'Dialog or modal content appears.' });
      addStep({ action: 'observe', reason: 'Observe modal state.', expectedObservation: 'Modal opens with visible content.' });
      const close = first((item) => ['button', 'link'].includes(item.role) && /close|dismiss|cancel|×|x/.test(`${item.text || ''} ${item.label || ''}`));
      if (close) addStep({ action: 'click', targetIndex: close.index, reason: 'Close modal if a safe close control is visible.', expectedObservation: 'Dialog closes.' });
    } else if (taskType === 'pagination_test') {
      const next = first((item) => ['button', 'link', 'pagination'].includes(item.role) && /next|›|»|page 2/.test(`${item.text || ''} ${item.label || ''}`));
      if (next) addStep({ action: 'click', targetIndex: next.index, reason: 'Move to the next page of results safely.', expectedObservation: 'URL, active page, or table rows change.' });
      addStep({ action: 'observe', reason: 'Observe pagination result.', expectedObservation: 'Pagination state changes or needs review.' });
    } else if (taskType === 'link_navigation_test') {
      const link = first((item) => item.role === 'link' && isSafeAgentLink(item.href));
      if (link) addStep({ action: 'click', targetIndex: link.index, reason: 'Click a safe same-site navigation link.', expectedObservation: 'Route, hash, or page state changes.' });
      addStep({ action: 'observe', reason: 'Observe navigation result.', expectedObservation: 'Navigation evidence is visible.' });
    } else if (taskType === 'accessibility_check') {
      addStep({ action: 'observe', reason: 'Inspect visible accessibility signals.', expectedObservation: 'Missing labels, alt text, headings, or link text are reported.' });
    } else if (taskType === 'page_summary') {
      addStep({ action: 'observe', reason: 'Summarize visible page context without changing the page.', expectedObservation: 'Headings, messages, forms, and interactive elements are summarized.' });
    } else if (taskType === 'test_case_generation') {
      addStep({ action: 'observe', reason: 'Collect page evidence to generate task-specific test cases.', expectedObservation: 'Relevant page elements and visible states are available for test case drafting.' });
    } else if (taskType === 'bug_report_generation') {
      addStep({ action: 'observe', reason: 'Collect visible evidence for a bug report draft.', expectedObservation: 'Current page evidence is summarized without inventing missing defects.' });
    } else if (taskType === 'table_test') {
      const table = first((item) => item.role === 'table');
      if (table) addStep({ action: 'highlight', targetIndex: table.index, reason: 'Highlight table for QA review.', expectedObservation: 'Table is visible and highlighted.' });
      addStep({ action: 'observe', reason: 'Observe table rows and controls.', expectedObservation: 'Table structure is available for review.' });
    } else {
      for (const item of many((element) => ['button', 'link', 'input', 'select', 'textarea', 'checkbox', 'radio'].includes(element.role), 5)) {
        addStep({ action: 'highlight', targetIndex: item.index, reason: 'Highlight important interactive element for QA review.', expectedObservation: 'Element is visible and indexed.' });
      }
      addStep({ action: 'observe', reason: 'Observe general page quality and visible feedback.', expectedObservation: 'Important interactions and issues are summarized.' });
    }

    return {
      summary: `Run ${taskType.replaceAll('_', ' ')} with ${dataStrategy} data strategy for: ${command || 'current page'}`,
      taskType,
      dataStrategy,
      riskLevel: 'safe',
      targetElements: Array.from(new Set(targetElements)),
      steps: steps.slice(0, 12),
      expectedOutcome: expectedOutcomeForTask(taskType)
    };
  }

  function normalizeStructuredAgentPlan(candidatePlan, fallbackPlan, taskType, context) {
    if (!candidatePlan || typeof candidatePlan !== 'object' || !Array.isArray(candidatePlan.steps)) {
      return fallbackPlan;
    }

    const availableTargets = new Set((context.elements || []).map((item) => item.index));
    const normalizedSteps = candidatePlan.steps
      .slice(0, 12)
      .map((step) => normalizeStructuredAgentStep(step, availableTargets))
      .filter(Boolean);

    if (!normalizedSteps.length) return fallbackPlan;
    const targetElements = normalizedSteps
      .map((step) => step.targetIndex)
      .filter(Boolean);

    return {
      summary: sanitizePageText(candidatePlan.summary || fallbackPlan.summary || `Run ${taskType.replaceAll('_', ' ')}`, 300),
      taskType: sanitizePageText(candidatePlan.taskType || taskType, 80),
      dataStrategy: fallbackPlan.dataStrategy || 'unknown',
      riskLevel: 'safe',
      targetElements: Array.from(new Set(targetElements)),
      steps: normalizedSteps,
      expectedOutcome: sanitizePageText(candidatePlan.expectedOutcome || fallbackPlan.expectedOutcome || expectedOutcomeForTask(taskType), 300),
      source: 'structured-json'
    };
  }

  function normalizeStructuredAgentStep(step, availableTargets) {
    if (!step || typeof step !== 'object') return null;
    const action = String(step.action || '').toLowerCase().trim();
    if (!ALLOWED_AGENT_ACTIONS.has(action)) return null;
    const targetIndex = Number(step.targetIndex || 0);
    const requiresTarget = !['observe', 'wait', 'scroll'].includes(action);
    if (requiresTarget && (!Number.isFinite(targetIndex) || !availableTargets.has(targetIndex))) return null;
    return {
      action,
      targetIndex: Number.isFinite(targetIndex) && targetIndex > 0 ? targetIndex : undefined,
      value: sanitizeStructuredStepValue(action, step.value),
      url: action === 'navigate' ? sanitizePageText(step.url || '', 300) : undefined,
      reason: sanitizePageText(step.reason || 'Structured QA step.', 220),
      expectedObservation: sanitizePageText(step.expectedObservation || 'Observe page evidence after this step.', 220)
    };
  }

  function sanitizeStructuredStepValue(action, value) {
    if (action === 'wait' || action === 'scroll') return Math.min(3000, Math.max(0, Number(value) || 0));
    if (action === 'select' && value === '__FIRST_SAFE_OPTION__') return value;
    return sanitizePageText(String(value || SAFE_DUMMY_VALUES.generic), 200);
  }

  function validateAgentPlan(plan, context, approval = {}, requestKey = '') {
    const blocked = [];
    const confirmations = [];
    const approvalGranted = isAgentApprovalTokenValid(approval, requestKey);
    const indexed = new Map((context.elements || []).map((item) => [item.index, item]));
    for (const step of plan.steps || []) {
      const target = step.targetIndex ? indexed.get(step.targetIndex) : null;
      if (step.targetIndex && !target) blocked.push(`Step target #${step.targetIndex} is not available.`);
      if (target && target.disabled) blocked.push(`Target #${target.index} is disabled.`);
      const confirmation = getAgentStepConfirmation(step, context);
      if (confirmation) {
        confirmations.push({
          reason: confirmation.reason,
          fingerprint: getAgentStepApprovalFingerprint(step, context, confirmation)
        });
      }
    }
    const unresolvedConfirmation = approvalGranted
      ? confirmations.filter((item) => item.fingerprint !== approval.stepFingerprint).map((item) => item.reason)
      : confirmations.map((item) => item.reason);
    return {
      ok: blocked.length === 0,
      blocked,
      requiresConfirmation: unresolvedConfirmation.length > 0,
      needsConfirmation: unresolvedConfirmation,
      approved: approvalGranted && confirmations.length > unresolvedConfirmation.length
    };
  }

  function isAgentApprovalTokenValid(approval, requestKey) {
    return Boolean(approval
      && approval.approved === true
      && approval.requestKey
      && String(approval.requestKey) === String(requestKey || '')
      && typeof approval.stepFingerprint === 'string'
      && approval.stepFingerprint);
  }

  function isAgentStepApproved(step, context, approval, requestKey) {
    if (!isAgentApprovalTokenValid(approval, requestKey)) return false;
    return getAgentStepApprovalFingerprint(step, context) === approval.stepFingerprint;
  }

  function getAgentStepConfirmationReason(step, context) {
    return getAgentStepConfirmation(step, context)?.reason || '';
  }

  function getAgentStepConfirmation(step, context) {
    const target = step.targetIndex ? (context.elements || []).find((item) => item.index === step.targetIndex) : null;
    const text = `${target?.text || ''} ${target?.label || ''} ${step.value || ''} ${step.url || ''}`.toLowerCase();
    const targetLabel = target?.text || target?.label || target?.placeholder || step.action;
    if (target && target.role === 'upload') {
      return {
        reason: `File upload requires explicit tester confirmation for target #${target.index}.`,
        category: 'file-upload',
        rememberable: false,
        targetLabel
      };
    }
    if (step.action === 'navigate' && step.url && !isSafeAgentLink(step.url)) {
      return {
        reason: `External navigation requires confirmation: ${step.url}`,
        category: 'external-navigation',
        rememberable: false,
        targetLabel: step.url
      };
    }
    if (target && target.role === 'link' && target.href && !isSafeAgentLink(target.href)) {
      return {
        reason: `External or unsafe link requires confirmation: ${target.href}`,
        category: 'external-navigation',
        rememberable: false,
        targetLabel: target.href
      };
    }
    if (isAgentFormSubmitAction(step, target, context)) {
      const destructive = isHighRiskAgentActionText(text);
      return {
        reason: `Form submit/continue requires approval for target #${target?.index || 'unknown'}: ${targetLabel}`,
        category: destructive ? 'high-risk-action' : 'form-submit',
        rememberable: !destructive,
        targetLabel
      };
    }
    if (['click', 'navigate', 'select', 'check', 'uncheck'].includes(step.action)
      && /delete|remove|destroy|logout|log out|sign out|reset password|payment|checkout|pay now|purchase|subscribe|bank|billing|create account|register|sign up|signup|save changes|confirm order|place order/.test(text)) {
      const destructive = isHighRiskAgentActionText(text);
      return {
        reason: `Serious action requires approval for target #${target?.index || 'unknown'}: ${targetLabel}`,
        category: destructive ? 'high-risk-action' : 'form-submit',
        rememberable: !destructive,
        targetLabel
      };
    }
    return null;
  }

  function isAgentFormSubmitAction(step, target, context) {
    if (!step || step.action !== 'click' || !target) return false;
    const text = `${target.text || ''} ${target.label || ''} ${target.type || ''}`.toLowerCase();
    const formSubmitTargets = new Set((context.forms || []).flatMap((form) => form.submitButtons || []));
    if (formSubmitTargets.has(target.index)) return true;
    if (target.role !== 'button') return false;
    if (/search|filter|sort|close|cancel|back|previous|prev|menu|tab/.test(text)) return false;
    return /submit|continue|next|send|save|log in|login|sign in|sign up|signup|register|create account|place order|checkout|pay|purchase|apply/.test(text);
  }

  function isHighRiskAgentActionText(text) {
    return /delete|remove|destroy|logout|log out|sign out|reset password|payment|checkout|pay now|purchase|subscribe|bank|billing|confirm order|place order/.test(String(text || '').toLowerCase());
  }

  function getAgentStepApprovalFingerprint(step, context, confirmation = null) {
    const target = step && step.targetIndex ? (context.elements || []).find((item) => item.index === step.targetIndex) : null;
    const resolvedConfirmation = confirmation || getAgentStepConfirmation(step, context) || {};
    return simpleHash(JSON.stringify({
      action: step?.action || '',
      targetIndex: step?.targetIndex || null,
      targetLabel: resolvedConfirmation.targetLabel || target?.label || target?.text || '',
      category: resolvedConfirmation.category || '',
      url: step?.url || ''
    }));
  }

  async function executeAgentStep(step, stepIndex, context, requestKey) {
    const target = step.targetIndex ? (context.elements || []).find((item) => item.index === step.targetIndex) : null;
    const element = target ? getElementBySelector(target.selectorHint) : null;
    const startedAt = Date.now();
    const base = {
      stepIndex,
      action: step.action,
      targetIndex: step.targetIndex || null,
      targetLabel: target ? (target.label || target.text || target.role) : '',
      timestamp: startedAt,
      startedAt
    };
    const finish = (result) => ({ ...base, ...result, completedAt: Date.now() });
    try {
      if (step.action === 'observe') {
        const observation = observeAgentPage(context);
        return finish({ success: true, message: formatObservationMessage(observation), observedText: observation.evidence });
      }
      if (step.action === 'wait') {
        await waitForAgent(Number(step.value) || 500);
        return finish({ success: true, message: 'Wait completed.' });
      }
      if (!element && step.action !== 'scroll') return finish({ success: false, message: 'Target element was not found on the page.' });
      if (element && !isVisibleElement(element, true)) return finish({ success: false, message: 'Target element is hidden or outside the visible viewport.' });
      if (element && (element.disabled || element.getAttribute && element.getAttribute('aria-disabled') === 'true')) {
        return finish({ success: false, message: 'Target element is disabled.' });
      }
      if (step.action === 'highlight') {
        highlightAgentElement(element);
        return finish({ success: true, message: 'Element highlighted for QA review.' });
      }
      if (step.action === 'scroll') {
        window.scrollBy({ top: Number(step.value) || Math.round(window.innerHeight * 0.6), behavior: 'smooth' });
        return finish({ success: true, message: 'Page scrolled.' });
      }
      if (step.action === 'clear') {
        highlightAgentElement(element, 900);
        setElementValue(element, '');
        emitAgentEvent('field-updated', {
          requestKey,
          stepIndex,
          targetIndex: step.targetIndex || null,
          targetLabel: base.targetLabel,
          action: 'clear',
          valuePreview: '',
          message: 'Field cleared.'
        });
        return finish({ success: true, message: 'Field cleared.', valuePreview: '' });
      }
      if (step.action === 'type') {
        const value = sanitizePageText(step.value || SAFE_DUMMY_VALUES.generic, 200);
        highlightAgentElement(element, Math.max(1200, value.length * AGENT_TYPE_DELAY_MS + 800));
        await setElementValueAnimated(element, value, {
          requestKey,
          stepIndex,
          targetIndex: step.targetIndex || null,
          targetLabel: base.targetLabel,
          target,
          reason: step.reason
        });
        return finish({
          success: true,
          message: `Entered ${maskAgentTypedValue(value, target)} into ${base.targetLabel || 'target field'}.`,
          valuePreview: maskAgentTypedValue(value, target)
        });
      }
      if (step.action === 'select') {
        highlightAgentElement(element, 1000);
        const selected = selectSafeOption(element, step.value);
        emitAgentEvent('field-updated', {
          requestKey,
          stepIndex,
          targetIndex: step.targetIndex || null,
          targetLabel: base.targetLabel,
          action: 'select',
          valuePreview: selected.valuePreview || '',
          message: selected.message
        });
        return finish({ success: selected.ok, message: selected.message, valuePreview: selected.valuePreview || '' });
      }
      if (step.action === 'check' || step.action === 'uncheck') {
        highlightAgentElement(element, 1000);
        element.checked = step.action === 'check';
        dispatchAgentInputEvents(element);
        emitAgentEvent('field-updated', {
          requestKey,
          stepIndex,
          targetIndex: step.targetIndex || null,
          targetLabel: base.targetLabel,
          action: step.action,
          valuePreview: step.action === 'check' ? 'checked' : 'unchecked',
          message: `Control ${step.action === 'check' ? 'checked' : 'unchecked'}.`
        });
        return finish({
          success: true,
          message: `Control ${step.action === 'check' ? 'checked' : 'unchecked'}.`,
          valuePreview: step.action === 'check' ? 'checked' : 'unchecked'
        });
      }
      if (step.action === 'click') {
        highlightAgentElement(element, 900);
        element.scrollIntoView?.({ block: 'center', inline: 'center' });
        await waitForAgent(80);
        element.click();
        await waitForAgent(350);
        const observation = observeAgentPage(context);
        return finish({ success: true, message: `Clicked safe target. ${formatObservationMessage(observation)}`, observedText: observation.evidence });
      }
      if (step.action === 'navigate') {
        if (!isSafeAgentLink(step.url)) return finish({ success: false, message: 'Unsafe navigation was blocked.' });
        location.href = new URL(step.url, location.href).href;
        return finish({ success: true, message: 'Safe navigation started.' });
      }
      return finish({ success: false, message: `Unsupported action: ${step.action}` });
    } catch (error) {
      return finish({ success: false, message: error && error.message ? error.message : 'Step failed.' });
    }
  }

  function observeAgentPage(context) {
    const alerts = getVisibleAlertTexts();
    const validation = getFieldValidationEvidence();
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"], dialog, [aria-modal="true"]'))
      .filter((element) => isVisibleElement(element, true))
      .map((element) => sanitizePageText(getShortText(element), 160))
      .filter(Boolean)
      .slice(0, 5);
    const tables = Array.from(document.querySelectorAll('table, [role="table"]'))
      .filter((element) => isVisibleElement(element, true))
      .map((table) => `${table.querySelectorAll ? table.querySelectorAll('tr, [role="row"]').length : 0} visible row(s)`)
      .slice(0, 3);
    const resultSignals = getResultCountSignals();
    const buttonSignals = getButtonStateSignals();
    const accessibility = getAccessibilityObservations();
    const evidence = [
      `URL: ${location.href}`,
      document.title ? `Title: ${document.title}` : '',
      alerts.length ? `Visible messages: ${alerts.join(' | ')}` : '',
      validation.length ? `Field validation: ${validation.join(' | ')}` : '',
      dialogs.length ? `Visible dialogs: ${dialogs.join(' | ')}` : '',
      tables.length ? `Tables: ${tables.join(' | ')}` : '',
      resultSignals.length ? `Results/lists: ${resultSignals.join(' | ')}` : '',
      buttonSignals.length ? `Button states: ${buttonSignals.join(' | ')}` : '',
      accessibility.length ? `Accessibility observations: ${accessibility.join(' | ')}` : ''
    ].filter(Boolean);
    return {
      url: location.href,
      title: document.title || '',
      visibleAlerts: alerts,
      fieldValidation: validation,
      visibleDialogs: dialogs,
      tableSignals: tables,
      resultSignals,
      buttonSignals,
      accessibility,
      evidence
    };
  }

  function formatObservationMessage(observation) {
    const lines = [];
    if (observation.fieldValidation && observation.fieldValidation.length) lines.push(...observation.fieldValidation);
    if (observation.visibleAlerts && observation.visibleAlerts.length) lines.push(...observation.visibleAlerts.map((item) => `Visible message: ${item}`));
    if (observation.visibleDialogs && observation.visibleDialogs.length) lines.push(...observation.visibleDialogs.map((item) => `Dialog visible: ${item}`));
    if (observation.resultSignals && observation.resultSignals.length) lines.push(...observation.resultSignals);
    if (observation.tableSignals && observation.tableSignals.length) lines.push(...observation.tableSignals.map((item) => `Table signal: ${item}`));
    if (observation.buttonSignals && observation.buttonSignals.length) lines.push(...observation.buttonSignals);
    if (observation.accessibility && observation.accessibility.length) lines.push(...observation.accessibility);
    if (!lines.length) lines.push(`No visible validation, dialog, toast, list, or table change detected on ${location.href}.`);
    return lines.slice(0, 8).join(' ');
  }

  function getFieldValidationEvidence() {
    const issues = [];
    for (const field of Array.from(document.querySelectorAll('input, textarea, select')).filter((el) => isVisibleElement(el, true)).slice(0, 20)) {
      if (field.type === 'hidden') continue;
      const label = getAssociatedLabel(field) || getElementLabel(field) || field.getAttribute('placeholder') || field.getAttribute('name') || field.id || field.tagName.toLowerCase();
      const validationMessage = typeof field.validationMessage === 'string' ? field.validationMessage : '';
      const invalid = field.getAttribute('aria-invalid') === 'true' || (typeof field.checkValidity === 'function' && !field.checkValidity());
      const describedBy = getDescribedByText(field);
      if (validationMessage) {
        issues.push(`${sanitizePageText(label, 80)} displayed "${sanitizePageText(validationMessage, 140)}"`);
      } else if (describedBy) {
        issues.push(`${sanitizePageText(label, 80)} described by "${sanitizePageText(describedBy, 140)}"`);
      } else if (invalid) {
        issues.push(`${sanitizePageText(label, 80)} is marked invalid`);
      }
    }
    return issues.slice(0, 8);
  }

  function getDescribedByText(field) {
    const ids = String(field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    const texts = [];
    for (const id of ids.slice(0, 4)) {
      const element = getElementBySelector(`#${cssEscape(id)}`);
      if (element && isVisibleElement(element, true)) texts.push(getShortText(element));
    }
    return sanitizePageText(texts.filter(Boolean).join(' | '), 180);
  }

  function getResultCountSignals() {
    const selector = [
      '[role="status"]',
      '[aria-live]',
      '[class*="result"]',
      '[class*="empty"]',
      '[class*="no-result"]',
      'ul',
      'ol',
      '[role="list"]'
    ].join(',');
    return Array.from(document.querySelectorAll(selector))
      .filter((element) => isVisibleElement(element, true))
      .map((element) => {
        const text = sanitizePageText(getShortText(element), 120);
        const itemCount = element.querySelectorAll ? element.querySelectorAll('li, [role="listitem"], article, tr').length : 0;
        if (text && /result|found|empty|no\s+results?|success|error|invalid/i.test(text)) return `Visible result text: ${text}`;
        if (itemCount > 0) return `${element.tagName.toLowerCase()} contains ${itemCount} visible item(s)`;
        return '';
      })
      .filter(Boolean)
      .slice(0, 5);
  }

  function getButtonStateSignals() {
    return Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]'))
      .filter((element) => isVisibleElement(element, true))
      .slice(0, 12)
      .map((element) => {
        const label = sanitizePageText(getShortText(element) || getElementLabel(element) || element.getAttribute('value') || 'button', 80);
        if (element.disabled || element.getAttribute('aria-disabled') === 'true') return `${label} is disabled`;
        if (element.getAttribute('aria-busy') === 'true') return `${label} is busy`;
        return '';
      })
      .filter(Boolean)
      .slice(0, 5);
  }

  function evaluateAgentResult(plan, actionResults, observation, safety) {
    if (safety && !safety.ok) {
      return {
        status: safety.requiresConfirmation ? 'blocked' : 'blocked',
        summary: safety.requiresConfirmation
          ? 'Agent stopped before execution because the plan needs tester confirmation.'
          : 'Agent stopped before execution because the plan was unsafe or invalid.',
        passedChecks: [],
        failedChecks: safety.blocked || [],
        evidence: [...(safety.needsConfirmation || []), ...(safety.blocked || [])],
        recommendedNextSteps: ['Review the blocked action and run a narrower, safer command.']
      };
    }
    const failures = actionResults.filter((item) => !item.success);
    const successCount = actionResults.filter((item) => item.success).length;
    const evidence = [...(observation?.evidence || []), ...actionResults.map((item) => `${item.action}: ${item.message}`)].slice(0, 12);
    const hasVisibleValidation = Boolean(
      (observation.fieldValidation && observation.fieldValidation.length)
      || (observation.visibleAlerts && observation.visibleAlerts.length)
    );
    const hasInteractionEvidence = Boolean(
      hasVisibleValidation
      || (observation.visibleDialogs && observation.visibleDialogs.length)
      || (observation.resultSignals && observation.resultSignals.length)
      || (observation.tableSignals && observation.tableSignals.length)
      || (observation.buttonSignals && observation.buttonSignals.length)
    );
    let status = failures.length ? 'failed' : 'needs_review';
    let summary = failures.length
      ? `${failures.length} agent step${failures.length === 1 ? '' : 's'} failed and needs review.`
      : `Agent completed ${successCount} step${successCount === 1 ? '' : 's'}; review the observations before filing.`;
    if (plan.taskType === 'highlight_interactions' && !failures.length) {
      const highlighted = actionResults.filter((item) => item.action === 'highlight' && item.success).length;
      status = highlighted ? 'passed' : 'needs_review';
      summary = highlighted
        ? `Highlighted ${highlighted} visible interactive element${highlighted === 1 ? '' : 's'} without typing or clicking.`
        : 'No visible interactive elements were available to highlight.';
    } else if (['form_validation', 'required_field_validation', 'invalid_login_test', 'invalid_signup_validation', 'login_validation'].includes(plan.taskType) && !failures.length) {
      if (hasVisibleValidation) {
        status = 'passed';
        summary = 'Validation produced visible field, alert, or message evidence with safe QA data.';
      } else {
        status = 'needs_review';
        summary = 'Form interaction completed, but no visible validation, success, or failure message was detected.';
      }
    } else if (plan.taskType === 'valid_dummy_data_flow' && !failures.length) {
      const validationText = [...(observation.fieldValidation || []), ...(observation.visibleAlerts || [])].join(' ').toLowerCase();
      if (/invalid email|include an '@'|valid email|email.*invalid/.test(validationText)) {
        status = 'failed';
        summary = 'Valid-looking dummy data was submitted, but the page still showed email validation evidence.';
      } else if (/success|created|registered|welcome|saved|submitted|thank you/.test(validationText)) {
        status = 'passed';
        summary = 'Valid-looking dummy data produced visible success evidence.';
      } else {
        status = 'needs_review';
        summary = 'Valid-looking dummy data was entered, but success or failure evidence was not clear.';
      }
    } else if (plan.taskType === 'accessibility_check') {
      status = observation.accessibility.length ? 'failed' : 'passed';
      summary = observation.accessibility.length
        ? `${observation.accessibility.length} accessibility observation${observation.accessibility.length === 1 ? '' : 's'} found.`
        : 'No basic visible accessibility issues were detected by the agent.';
    } else if (!failures.length && ['modal_test', 'pagination_test', 'link_navigation_test', 'search_test', 'filter_test'].includes(plan.taskType)) {
      status = hasInteractionEvidence ? 'needs_review' : 'needs_review';
      summary = hasInteractionEvidence
        ? 'Agent executed the interaction and captured visible evidence. Confirm expected behavior before filing.'
        : 'Agent executed the interaction, but visible evidence was weak. Manual review is required.';
    } else if (!failures.length && ['page_summary', 'test_case_generation', 'bug_report_generation'].includes(plan.taskType)) {
      status = 'needs_review';
      summary = 'Agent collected visible page evidence without changing the page.';
    }
    return {
      status,
      summary,
      passedChecks: actionResults.filter((item) => item.success).map((item) => `${item.action}: ${item.message}`),
      failedChecks: failures.map((item) => `${item.action}: ${item.message}`),
      evidence,
      recommendedNextSteps: recommendedNextStepsForAgent(plan.taskType, status)
    };
  }

  function getAccessibilityObservations() {
    const issues = [];
    for (const input of Array.from(document.querySelectorAll('input, textarea, select')).filter((el) => isVisibleElement(el, true)).slice(0, 20)) {
      if (input.type === 'hidden') continue;
      if (!getAssociatedLabel(input) && !input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby') && !input.getAttribute('placeholder')) {
        issues.push(`Unlabeled ${input.tagName.toLowerCase()} ${getSelector(input)}`);
      }
    }
    for (const img of Array.from(document.images || []).filter((el) => isVisibleElement(el, true)).slice(0, 20)) {
      if (!img.getAttribute('alt')) issues.push(`Image missing alt ${getSelector(img)}`);
    }
    for (const button of Array.from(document.querySelectorAll('button, [role="button"]')).filter((el) => isVisibleElement(el, true)).slice(0, 20)) {
      if (!getShortText(button) && !getElementLabel(button)) issues.push(`Button missing accessible name ${getSelector(button)}`);
    }
    return issues.slice(0, 10);
  }

  function recommendedNextStepsForAgent(taskType, status) {
    if (status === 'passed') return ['Re-run after code changes or at another viewport for confidence.'];
    if (taskType === 'accessibility_check') return ['Fix listed accessibility observations, then run UI Scan for reportable evidence.'];
    if (status === 'failed') return ['Review the failed step, inspect the target element, and retry with a narrower command.'];
    return ['Manually confirm the observed behavior, then generate test cases or a bug report from the latest agent result.'];
  }

  function compactAgentContextForResponse(context) {
    return {
      url: context.url,
      title: context.title,
      pageType: context.pageType,
      contextHash: context.contextHash,
      summary: context.summary,
      headings: context.headings,
      importantText: context.importantText,
      visibleAlerts: context.visibleAlerts,
      availableSafeActions: context.availableSafeActions,
      elements: (context.elements || []).slice(0, 40),
      forms: context.forms || []
    };
  }

  function dummyValueForField(field) {
    const hint = `${field.type || ''} ${field.label || ''} ${field.placeholder || ''} ${field.text || ''}`.toLowerCase();
    if (/email/.test(hint)) return SAFE_DUMMY_VALUES.email;
    if (/password/.test(hint)) return SAFE_DUMMY_VALUES.invalidPassword;
    if (/phone|tel|mobile/.test(hint)) return SAFE_DUMMY_VALUES.invalidPhone;
    if (/name|first|last|user/.test(hint)) return SAFE_DUMMY_VALUES.name;
    if (/message|comment|description|textarea/.test(hint) || field.role === 'textarea') return SAFE_DUMMY_VALUES.message;
    if (/search|query|keyword/.test(hint)) return SAFE_DUMMY_VALUES.search;
    return SAFE_DUMMY_VALUES.generic;
  }

  function validDummyValueForField(field) {
    const hint = `${field.type || ''} ${field.label || ''} ${field.placeholder || ''} ${field.text || ''}`.toLowerCase();
    if (/email/.test(hint)) return makeUniqueQaEmail();
    if (/password/.test(hint)) return SAFE_DUMMY_VALUES.password;
    if (/phone|tel|mobile/.test(hint)) return SAFE_DUMMY_VALUES.phone;
    if (/name|first|last|user/.test(hint)) return SAFE_DUMMY_VALUES.name;
    if (/message|comment|description|textarea/.test(hint) || field.role === 'textarea') return SAFE_DUMMY_VALUES.message;
    if (/search|query|keyword/.test(hint)) return SAFE_DUMMY_VALUES.search;
    return SAFE_DUMMY_VALUES.generic;
  }

  function makeUniqueQaEmail() {
    return `qa.test+${Date.now()}@example.com`;
  }

  function realDataDisclaimer(dataStrategy) {
    return dataStrategy === 'real_user_provided'
      ? 'Use safe realistic dummy QA data instead of private real user credentials.'
      : 'Enter valid-looking dummy QA data requested by the prompt.';
  }

  function expectedOutcomeForTask(taskType) {
    return {
      highlight_interactions: 'Visible interactive elements are highlighted with indexes without typing, clicking, or submitting.',
      required_field_validation: 'Submitting empty required fields produces visible validation or invalid field state.',
      invalid_login_test: 'Safe dummy credentials produce validation, login failure, route, API, or console evidence.',
      invalid_signup_validation: 'Invalid signup data produces validation, route, API, or console evidence.',
      valid_dummy_data_flow: 'Valid-looking dummy QA data produces success, validation, route, API, or console evidence.',
      login_validation: 'Empty-field, invalid-email, and dummy-credential checks are performed separately with evidence.',
      form_validation: 'Visible validation, success, disabled state, or route feedback is observed after safe form input.',
      button_test: 'Safe button click produces visible state change, modal, feedback, or needs-review evidence.',
      link_navigation_test: 'Safe same-site link changes route, hash, title, or visible page state.',
      search_test: 'Search query changes results, URL, no-results state, or visible feedback.',
      filter_test: 'Filter control changes selected state, results, table, or list.',
      modal_test: 'Modal opens with visible content and can be closed when a close control exists.',
      tab_test: 'Tab selection changes visible panel state.',
      accordion_test: 'Accordion expands or collapses visible content.',
      table_test: 'Table structure and controls are visible for QA review.',
      pagination_test: 'Pagination changes page, active state, URL, or visible rows.',
      upload_test: 'Upload is blocked unless explicitly confirmed.',
      download_test: 'Download link is identified but not triggered automatically unless safe.',
      accessibility_check: 'Visible accessibility basics are inspected and concrete observations are reported.',
      page_summary: 'Visible page context is summarized without changing the page.',
      test_case_generation: 'Page evidence is collected for test case drafting.',
      bug_report_generation: 'Visible evidence is collected for a bug report draft.',
      general_page_validation: 'Important interactions are highlighted and observable page evidence is summarized.'
    }[taskType] || 'Agent observes page state and reports evidence.';
  }

  function getElementBySelector(selector) {
    if (!selector || !document.querySelector) return null;
    try {
      return document.querySelector(selector);
    } catch {
      return null;
    }
  }

  function getAssociatedLabel(element) {
    if (!element || !element.getAttribute) return '';
    const id = element.getAttribute('id');
    if (id && document.querySelector) {
      try {
        const label = document.querySelector(`label[for="${cssEscape(id)}"]`);
        if (label) return getShortText(label);
      } catch {
        // Ignore malformed labels.
      }
    }
    const wrapped = element.closest && element.closest('label');
    return wrapped ? getShortText(wrapped) : '';
  }

  function isSafeAgentLink(href) {
    const value = String(href || '').trim();
    if (!value || value === '#') return false;
    if (/^(javascript|data|blob):/i.test(value)) return false;
    try {
      const url = new URL(value, location.href);
      const current = new URL(location.href);
      return url.origin === current.origin;
    } catch {
      return false;
    }
  }

  function buildAgentRequestKey(parts) {
    return simpleHash([
      parts.sessionId || '',
      parts.pageUrl || '',
      parts.mode || 'agent',
      parts.userMessage || '',
      parts.taskType || '',
      parts.dataStrategy || 'unknown',
      parts.pageContextHash || ''
    ].join('|'));
  }

  function simpleHash(input) {
    const text = String(input || '');
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  function waitForAgent(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
  }

  function highlightAgentElement(element, durationMs = 1800) {
    if (!element || !element.style) return;
    const previousOutline = element.style.outline;
    const previousOutlineOffset = element.style.outlineOffset;
    const previousBoxShadow = element.style.boxShadow;
    element.style.outline = '3px solid #2563eb';
    element.style.outlineOffset = '2px';
    element.style.boxShadow = '0 0 0 5px rgba(37, 99, 235, 0.18)';
    setTimeout(() => {
      try {
        element.style.outline = previousOutline;
        element.style.outlineOffset = previousOutlineOffset;
        element.style.boxShadow = previousBoxShadow;
      } catch {
        // Element may have been removed.
      }
    }, Math.max(300, Number(durationMs) || 1800));
  }

  function setElementValue(element, value) {
    if (!element) return;
    element.focus?.();
    const prototype = element.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement && window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement && window.HTMLInputElement.prototype;
    const descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value') : null;
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
    dispatchAgentInputEvents(element);
  }

  async function setElementValueAnimated(element, value, meta = {}) {
    if (!element) return;
    element.scrollIntoView?.({ block: 'center', inline: 'center' });
    element.focus?.();
    setElementValue(element, '');
    await waitForAgent(90);
    const text = String(value || '');
    let current = '';
    const target = meta.target || null;
    for (const char of text) {
      current += char;
      setElementValue(element, current);
      emitAgentEvent('field-updated', {
        requestKey: meta.requestKey || '',
        stepIndex: meta.stepIndex,
        targetIndex: meta.targetIndex || null,
        targetLabel: meta.targetLabel || '',
        action: 'type',
        valuePreview: maskAgentTypedValue(current, target),
        message: `Typing ${maskAgentTypedValue(current, target)} into ${meta.targetLabel || 'field'}.`,
        reason: meta.reason || ''
      });
      await waitForAgent(AGENT_TYPE_DELAY_MS);
    }
    dispatchAgentInputEvents(element);
  }

  function maskAgentTypedValue(value, target) {
    const text = String(value || '');
    const hint = `${target?.type || ''} ${target?.label || ''} ${target?.placeholder || ''}`.toLowerCase();
    if (/password|secret|token|api/.test(hint)) return '••••••••';
    if (text.length > 36) return `${text.slice(0, 18)}…${text.slice(-8)}`;
    return text;
  }

  function dispatchAgentInputEvents(element) {
    try {
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } catch {
      // Some host pages override event constructors; ignore if dispatch fails.
    }
  }

  function selectSafeOption(element, requestedValue) {
    if (!element || element.tagName.toLowerCase() !== 'select') {
      return { ok: false, message: 'Target is not a select control.' };
    }
    const options = Array.from(element.options || []);
    const next = requestedValue && requestedValue !== '__FIRST_SAFE_OPTION__'
      ? options.find((option) => option.value === requestedValue && !option.disabled)
      : options.find((option) => !option.disabled && String(option.value || option.textContent || '').trim());
    if (!next) return { ok: false, message: 'No safe selectable option was available.' };
    element.value = next.value;
    dispatchAgentInputEvents(element);
    const valuePreview = sanitizePageText(next.textContent || next.value, 80);
    return { ok: true, message: `Selected option "${valuePreview}".`, valuePreview };
  }

  function capturePageContext(mode) {
    const normalizedMode = mode === 'visible-summary' ? 'visible-summary' : 'selection';
    const selectedText = getSelectedText();
    if (normalizedMode === 'selection') {
      if (!selectedText) throw new Error('Select text on the page first, then capture it.');
      return {
        type: 'selected-text',
        selectedText: sanitizePageText(selectedText, MAX_SELECTED_TEXT_LENGTH),
        title: document.title || '',
        url: location.href,
        clickedElementText: sanitizePageText(getActiveElementText(), 500),
        capturedAt: Date.now()
      };
    }

    const headings = getVisibleHeadings();
    const visibleAlerts = getVisibleAlertTexts();
    const activeText = getActiveElementText();
    const summary = [
      document.title ? `Title: ${document.title}` : '',
      headings.length ? `Visible headings: ${headings.join(' | ')}` : '',
      visibleAlerts.length ? `Visible alerts/errors: ${visibleAlerts.join(' | ')}` : '',
      activeText ? `Focused/selected element: ${activeText}` : '',
      selectedText ? `Selected text: ${selectedText}` : ''
    ].filter(Boolean).join('\n');

    return {
      type: 'visible-summary',
      summary: sanitizePageText(summary, MAX_VISIBLE_SUMMARY_LENGTH),
      title: document.title || '',
      url: location.href,
      headings,
      visibleAlerts,
      clickedElementText: sanitizePageText(activeText, 500),
      capturedAt: Date.now()
    };
  }

  function getSelectedText() {
    try {
      return String(window.getSelection && window.getSelection().toString() || '').trim();
    } catch {
      return '';
    }
  }

  function getVisibleHeadings() {
    return Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"]'))
      .filter((element) => isVisibleElement(element, true))
      .map((element) => sanitizePageText(getShortText(element), 160))
      .filter(Boolean)
      .slice(0, 8);
  }

  function getVisibleAlertTexts() {
    const selector = [
      '[role="alert"]',
      '[aria-live]',
      '.error',
      '.errors',
      '.alert',
      '.warning',
      '.toast',
      '.notification',
      '.message',
      '.validation',
      '[class*="error"]',
      '[class*="alert"]',
      '[class*="toast"]'
    ].join(',');
    return Array.from(document.querySelectorAll(selector))
      .filter((element) => isVisibleElement(element, true))
      .map((element) => sanitizePageText(getShortText(element), 220))
      .filter(Boolean)
      .slice(0, 10);
  }

  function getActiveElementText() {
    const element = document.activeElement;
    if (!element || element === document.body || element === document.documentElement) return '';
    return getShortText(element);
  }

  function sanitizePageText(value, maxLength) {
    let output = String(value || '').replace(/\s+/g, ' ').trim();
    output = output.replace(/(authorization\s*[:=]\s*)(bearer\s+)?[a-z0-9._\-+/=]+/gi, '$1[REDACTED]');
    output = output.replace(/\bbearer\s+[a-z0-9._\-+/=]+/gi, 'Bearer [REDACTED]');
    output = output.replace(/((?:access_token|refresh_token|id_token|token|password|api_key|secret)=)([^&\s]+)/gi, '$1[REDACTED]');
    output = output.replace(/("?(?:access_token|refresh_token|id_token|token|password|api_key|secret)"?\s*[:=]\s*")([^"&\s]+)(")/gi, '$1[REDACTED]$3');
    return output.slice(0, maxLength);
  }

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

    for (const anchor of Array.from(document.querySelectorAll('a')).slice(0, maxUiNodes)) {
      if (!isVisibleElement(anchor, visibleViewportOnly)) continue;
      const selector = getSelector(anchor);
      const href = anchor.getAttribute('href');
      const linkText = getShortText(anchor);
      const rect = getRect(anchor);
      if (href === null || String(href).trim() === '') {
        addIssue(
          'missing-link-href',
          'medium',
          'Visible link is missing href',
          'A visible anchor is styled or exposed as a link but does not provide a destination.',
          {
            selector,
            text: linkText,
            href,
            rect
          },
          {
            category: 'needs-review',
            confidence: 'high',
            userImpact: 'Keyboard, screen-reader, or mouse users may not be able to navigate from this link.',
            recommendation: 'Add a valid href or replace the element with a button if it performs an in-page action.'
          }
        );
        continue;
      }

      const linkProblem = getHrefProblem(href);
      if (linkProblem) {
        addIssue(
          linkProblem.ruleId,
          linkProblem.severity,
          linkProblem.title,
          linkProblem.description,
          {
            selector,
            text: linkText,
            href,
            rect,
            reason: linkProblem.reason
          },
          {
            category: linkProblem.category,
            confidence: linkProblem.confidence,
            userImpact: linkProblem.userImpact,
            recommendation: linkProblem.recommendation
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

  function sendUserAction(type, element, extra = {}) {
    if (!activeSessionId || !element) return;
    sendToExtension('user-action', {
      type,
      label: getShortText(element) || getElementLabel(element),
      selector: getSelector(element),
      url: location.href,
      timestamp: Date.now(),
      ...sanitizeActionExtra(extra)
    });
  }

  function sanitizeActionExtra(extra) {
    const output = {};
    for (const [key, value] of Object.entries(extra || {})) {
      if (typeof value === 'boolean' || typeof value === 'number') {
        output[key] = value;
      } else if (value !== undefined && value !== null) {
        output[key] = String(value).slice(0, 240);
      } else {
        output[key] = null;
      }
    }
    return output;
  }

  function getElementLabel(element) {
    if (!element || !element.getAttribute) return '';
    return element.getAttribute('aria-label')
      || element.getAttribute('title')
      || element.getAttribute('name')
      || element.getAttribute('id')
      || element.tagName.toLowerCase();
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

  function getHrefProblem(href) {
    const value = String(href || '').trim();
    const lower = value.toLowerCase();
    if (value === '#') {
      return {
        ruleId: 'placeholder-link-href',
        severity: 'low',
        category: 'needs-review',
        confidence: 'medium',
        title: 'Visible link uses placeholder href',
        description: 'A visible link points to # and may not navigate anywhere meaningful.',
        reason: 'href is #',
        userImpact: 'Users may click a link that does not navigate to the expected destination.',
        recommendation: 'Replace the placeholder with a real destination or convert the control to a button.'
      };
    }
    if (value.startsWith('#') && value.length > 1) {
      const targetId = value.slice(1);
      let decodedTarget = targetId;
      try {
        decodedTarget = decodeURIComponent(targetId);
      } catch {
        decodedTarget = targetId;
      }
      if (!document.getElementById(decodedTarget)) {
        return {
          ruleId: 'missing-anchor-target',
          severity: 'medium',
          category: 'needs-review',
          confidence: 'high',
          title: 'Anchor link target is missing',
          description: 'A visible same-page link points to an element id that does not exist on the page.',
          reason: `No element found with id "${decodedTarget}"`,
          userImpact: 'Users may click the link and remain on the same screen without reaching the expected section.',
          recommendation: 'Add the matching target id or update the href to the correct section.'
        };
      }
    }
    if (lower.startsWith('javascript:')) {
      return {
        ruleId: 'javascript-link-href',
        severity: 'medium',
        category: 'needs-review',
        confidence: 'high',
        title: 'Visible link uses javascript href',
        description: 'A visible link uses a javascript: URL instead of a normal destination.',
        reason: 'href starts with javascript:',
        userImpact: 'The link may be inaccessible, blocked by policy, or confusing for assistive technology.',
        recommendation: 'Use a button for script actions or provide a real link destination.'
      };
    }
    if (/^(?:http|https):$/i.test(value) || /^(?:http|https):\/?$/i.test(value)) {
      return {
        ruleId: 'invalid-link-href',
        severity: 'medium',
        category: 'needs-review',
        confidence: 'high',
        title: 'Visible link has invalid href',
        description: 'A visible link has an incomplete URL and may fail navigation.',
        reason: 'href is an incomplete URL',
        userImpact: 'Users may be sent to a broken or unintended destination.',
        recommendation: 'Replace the href with a complete, valid URL or route.'
      };
    }
    if (/^(?:mailto|tel):$/i.test(value)) {
      return {
        ruleId: 'invalid-link-href',
        severity: 'medium',
        category: 'needs-review',
        confidence: 'high',
        title: 'Visible link has invalid href',
        description: 'A visible mail or telephone link is missing its destination.',
        reason: 'href has a protocol but no value',
        userImpact: 'Users may be unable to contact or navigate from this link.',
        recommendation: 'Add the missing email address, phone number, or valid destination.'
      };
    }
    try {
      // Relative paths, hash links with targets, mailto, tel, and absolute URLs are valid here.
      new URL(value, location.href);
    } catch {
      return {
        ruleId: 'invalid-link-href',
        severity: 'medium',
        category: 'needs-review',
        confidence: 'medium',
        title: 'Visible link has invalid href',
        description: 'A visible link contains a href value that cannot be parsed as a URL.',
        reason: 'URL parsing failed',
        userImpact: 'Users may be unable to navigate from this link.',
        recommendation: 'Fix the malformed href value and retest navigation.'
      };
    }
    return null;
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
