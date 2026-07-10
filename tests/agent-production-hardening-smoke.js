const fs = require('fs');

const panelHtml = fs.readFileSync('devtools/panel.html', 'utf8');
const panelJs = fs.readFileSync('devtools/panel.js', 'utf8');
const panelCss = fs.readFileSync('devtools/panel.css', 'utf8');
const content = fs.readFileSync('content/content-script.js', 'utf8');
const backend = fs.readFileSync('ai-backend/server.js', 'utf8');
const fixture = fs.readFileSync('tests/fixtures/testpilot-harness.html', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const id of [
  'headerAiStatus',
  'headerAgentState',
  'headerContextMode',
  'stopAgentBtn',
  'debugDrawerBtn',
  'debugDrawer',
  'debugSessionId',
  'debugPromptId',
  'debugTaskId',
  'debugPlanHash',
  'debugEvidenceIds',
  'debugPlanJson',
  'debugActionTrace'
]) {
  assert(panelHtml.includes(`id="${id}"`), `Missing Phase 3 UI control: ${id}`);
}

assert(/toggleDebugDrawer/.test(panelJs), 'Debug drawer toggle is not wired.');
assert(/renderDebugDrawer/.test(panelJs), 'Debug drawer render function is missing.');
assert(/updateAgentRunDebugState/.test(panelJs), 'Agent run debug state is not updated from events.');
assert(/markAgentRunStopped/.test(panelJs), 'Stop Agent state handling is missing.');
assert(/TESTPILOT_CANCEL_AGENT/.test(panelJs), 'Stop Agent does not send cancellation to content script.');
assert(/exportTestCasesJson/.test(panelJs), 'Test case JSON export is missing.');
assert(/Evidence IDs:/.test(panelJs), 'Bug report evidence IDs are not rendered/exported.');
assert(/Needs-review warning/.test(panelJs), 'Bug reports do not warn on weak evidence.');
assert(/buildSessionEvidenceCards/.test(panelJs), 'Session evidence-card retrieval is missing.');
assert(/compactAgentRunForStorage/.test(panelJs), 'Agent debug storage is not bounded.');
assert(/maskApiKey/.test(panelJs), 'API key masking support is missing.');
assert(/redactObject/.test(panelJs), 'Export redaction hook is missing.');

assert(/\.debug-drawer/.test(panelCss), 'Debug drawer styles are missing.');
assert(/\.topbar-status-strip/.test(panelCss), 'Compact header status styles are missing.');
assert(/\.bug-draft-warning/.test(panelCss), 'Bug draft warning styles are missing.');

for (const name of [
  'SessionRagRetriever',
  'GroundedPlanner',
  'AgentToolRegistry',
  'captureAgentActionSnapshot',
  'validateAgentClaims'
]) {
  assert(content.includes(name), `${name} missing from content script.`);
}

for (const promptPattern of [
  /target === 'signup link'/,
  /target === 'google button'/,
  /target === 'first input'/,
  /dataStrategy === 'symbols'/,
  /invalid_login_test/,
  /valid_dummy_data_flow/,
  /highlight_interactions/
]) {
  assert(promptPattern.test(content), `Regression prompt support missing: ${promptPattern}`);
}

assert(/Use retrieved evidence cards first/.test(backend), 'Backend prompt does not prioritize evidence cards.');
assert(/Return valid JSON only/.test(backend), 'Backend JSON-only structured prompt reminder is missing.');

for (const fixtureNeedle of [
  'id="loginForm"',
  'id="signupForm"',
  'id="googleLogin"',
  'id="contactForm"',
  'id="searchBox"',
  'id="categoryFilter"',
  'id="demoModal"',
  'role="tablist"',
  'id="nextPage"',
  'id="brokenHref"',
  'id="apiFailure"',
  'id="consoleError"',
  'Harness console error for TestPilot capture'
]) {
  assert(fixture.includes(fixtureNeedle), `Harness fixture missing ${fixtureNeedle}`);
}

console.log('Agent production hardening smoke test passed.');
