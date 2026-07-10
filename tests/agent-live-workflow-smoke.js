const fs = require('fs');

const content = fs.readFileSync('content/content-script.js', 'utf8');
const panel = fs.readFileSync('devtools/panel.js', 'utf8');
const css = fs.readFileSync('devtools/panel.css', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(/emitAgentEvent\('started'/.test(content), 'Agent does not emit a started event.');
assert(/emitAgentEvent\('plan-ready'/.test(content), 'Agent does not emit a plan-ready event.');
assert(/emitAgentEvent\('step-started'/.test(content), 'Agent does not emit step-started events.');
assert(/emitAgentEvent\('field-updated'/.test(content), 'Agent does not emit field-updated events.');
assert(/emitAgentEvent\('permission-required'/.test(content), 'Agent does not emit permission-required events.');
assert(/setElementValueAnimated/.test(content), 'Agent field filling is not animated.');
assert(/AGENT_TYPE_DELAY_MS/.test(content), 'Agent typing delay is missing.');
assert(/getAgentStepConfirmationReason/.test(content), 'Agent serious-action confirmation check is missing.');
assert(/isAgentFormSubmitAction/.test(content), 'Agent does not detect submit/continue form actions for approval.');
assert(/Form submit\/continue requires approval/.test(content), 'Agent form-submit approval reason is missing.');
assert(/inputSummary:\s*summarizeAgentInputsForApproval/.test(content), 'Agent approval payload does not include prepared inputs.');
assert(/rememberable:\s*Boolean/.test(content), 'Agent approval payload does not expose rememberable actions.');
assert(/preferenceScope/.test(content), 'Agent approval payload does not include a preference scope.');
assert(/approval\.approved === true/.test(content), 'Agent approval token validation is missing.');
assert(/String\(approval\.requestKey\) === String\(requestKey \|\| ''\)/.test(content), 'Agent approval is not tied to the original request key.');
assert(/stepFingerprint/.test(content), 'Agent approval is not scoped to a specific step fingerprint.');
assert(/getAgentStepApprovalFingerprint/.test(content), 'Agent step approval fingerprint helper is missing.');
assert(/resumeFromStepIndex/.test(content), 'Agent approval does not resume from the pending step.');
assert(/sanitizePreviousAgentActionResults/.test(content), 'Agent approved resume does not preserve previous safe actions.');
assert(/pagePath:\s*safePagePath/.test(content), 'Agent session approval scope does not include page path.');
for (const moduleName of [
  'SessionManager',
  'PageSnapshotService',
  'EvidenceStore',
  'IntentClassifier',
  'TargetResolver',
  'DataStrategyResolver',
  'SafetyValidator',
  'PlanHashService',
  'AgentStateMachine',
  'DebugTraceService',
  'SessionRagRetriever',
  'GroundedPlanner',
  'AgentToolRegistry'
]) {
  assert(new RegExp(`const ${moduleName}`).test(content), `${moduleName} module is missing.`);
}
assert(/evidenceCards/.test(content), 'Agent does not carry retrieved evidence cards.');
assert(/evidence-retrieved/.test(content), 'Agent does not emit evidence retrieval events.');
assert(/targetEvidenceId/.test(content), 'Agent steps are not tied to target evidence IDs.');
assert(/validateAgentToolStep/.test(content), 'Agent executor does not validate controlled tool actions.');
assert(/captureAgentActionSnapshot/.test(content), 'Agent observation engine does not capture before/after snapshots.');
assert(/diffAgentActionSnapshots/.test(content), 'Agent observation engine does not diff action snapshots.');
assert(/getAgentConsoleEventsInWindow/.test(content), 'Agent does not correlate console events near action windows.');
assert(/validateAgentClaims/.test(content), 'Agent claim validator is missing.');
assert(/formatValidatedAgentOutput/.test(content), 'Agent final validated output formatter is missing.');
assert(/Status:[\s\S]*User Requirement:[\s\S]*What I Did:[\s\S]*Evidence:[\s\S]*Needs Review:/m.test(content), 'Agent final output does not use the Phase 2 report sections.');
assert(/planHash/.test(content), 'Agent planHash is missing.');
assert(/promptId/.test(content), 'Agent promptId is missing.');
assert(/taskId/.test(content), 'Agent taskId is missing.');
assert(/target === 'first input'/.test(content), 'Target resolver does not handle first input.');
assert(/target === 'signup link'/.test(content), 'Target resolver does not handle signup link.');
assert(/target === 'google button'/.test(content), 'Target resolver does not handle Google/OAuth button.');
assert(/dataStrategy === 'symbols'/.test(content), 'Data strategy does not handle symbols.');
assert(/full login\|complete login\|try \.\*login\|login with\|clio login/.test(content), 'Agent does not route full login prompts to valid dummy login flow.');
assert(/maybeAddLoginContinuationSteps/.test(content), 'Agent does not continue two-step login flows after password appears.');
assert(/SAFE_DUMMY_VALUES\.password/.test(content), 'Agent does not type safe password values for login flows.');
assert(/completedSafety/.test(content), 'Agent completion does not clear resolved confirmation state.');
assert(/TESTPILOT_CANCEL_AGENT/.test(content), 'Agent cancel message is missing.');

assert(/handleAgentEvent/.test(panel), 'Panel does not consume Agent events.');
assert(/buildSessionEvidenceCards/.test(panel), 'Panel AI context does not retrieve compact evidence cards.');
assert(/evidenceCards/.test(panel), 'Panel AI context does not expose evidence cards to model tasks.');
assert(/result\.finalOutput/.test(panel), 'Panel does not render claim-validated Agent output first.');
assert(/State:/.test(panel), 'Panel does not render Agent state changes.');
assert(/Retrieved grounded evidence before planning/.test(panel), 'Panel does not render Agent evidence retrieval progress.');
assert(/renderAgentLiveMessage/.test(panel), 'Panel does not render live Agent progress.');
assert(/renderAgentPermissionMessage/.test(panel), 'Panel does not render Agent permission prompts.');
assert(/approveAgentPermission/.test(panel), 'Panel does not wire Agent approval.');
assert(/denyAgentPermission/.test(panel), 'Panel does not wire Agent cancellation.');
assert(/Continue Once/.test(panel), 'Agent one-time approval button copy is missing.');
assert(/Allow Similar This Session/.test(panel), 'Agent session preference approval button copy is missing.');
assert(/agentApprovalPreferences/.test(panel), 'Agent session approval preference store is missing.');
assert(/buildAgentApprovalPreferenceKey/.test(panel), 'Agent approval preference scoping is missing.');
assert(/cancelPendingAgentApprovalsForNewPrompt/.test(panel), 'Panel does not cancel stale approvals when a new prompt is sent.');
assert(/TESTPILOT_CANCEL_AGENT/.test(panel), 'Panel does not send Agent cancel messages.');
assert(/stepFingerprint: approval\.stepFingerprint/.test(panel), 'Panel does not return the approved step fingerprint.');
assert(/previousActionResults/.test(panel), 'Panel does not return previous action evidence on approval.');
assert(/continue automatically from here after approval/.test(panel), 'Permission card does not explain automatic continuation.');
assert(/Cancelled by tester\. No serious action was performed\./.test(panel), 'Agent cancellation confirmation is missing.');
assert(/forceNextAiChatScroll/.test(panel), 'Chat scroll guard is missing.');
assert(/distanceFromBottom/.test(panel), 'Chat render does not preserve manual scroll position.');
assert(/const shouldStickToBottom = wasNearBottom;/.test(panel), 'Chat render still forces scroll for new messages.');
assert(/buildAgentUsedInputs/.test(panel), 'Agent input summary builder is missing.');
assert(/Inputs used:/.test(panel), 'Agent final result does not include inputs used.');
assert(/LOCAL_SESSION_STORAGE_KEY/.test(panel), 'Session local backup key is missing.');
assert(/setStoredSessionSnapshot/.test(panel), 'Session persistence fallback helper is missing.');
assert(!/actual\.innerHTML/.test(panel), 'Bug draft actual-result rendering still uses innerHTML.');

assert(/\.ai-chat-message\.agent-live/.test(css), 'Agent live message styling is missing.');
assert(/\.topbar-status-strip\s*\{[\s\S]*display:\s*none\s*!important/.test(css), 'Noisy topbar AI/Agent/Mode chips are still visible.');
assert(/\.ai-chat-message\.agent-permission/.test(css), 'Agent permission styling is missing.');
assert(/\.agent-permission-actions/.test(css), 'Agent permission action styling is missing.');
assert(/\.agent-permission-inputs/.test(css), 'Agent prepared input styling is missing.');
assert(/body\.menu-open/.test(css), 'Menu open body lock styling is missing.');
assert(/overscroll-behavior:\s*contain/.test(css), 'Menu overlay does not contain scroll behavior.');

console.log('Agent live workflow smoke test passed.');
