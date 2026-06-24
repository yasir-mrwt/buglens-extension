const fs = require('fs');

const html = fs.readFileSync('devtools/panel.html', 'utf8');
const css = fs.readFileSync('devtools/panel.css', 'utf8');
const js = fs.readFileSync('devtools/panel.js', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function between(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert(startIndex >= 0, `Missing start marker: ${start}`);
  assert(endIndex > startIndex, `Missing end marker after: ${start}`);
  return source.slice(startIndex, endIndex);
}

const chatPanel = between(
  html,
  '<section class="ai-panel ai-only testpilot-chat-panel">',
  '<header class="page-heading test-cases-only">'
);

assert(!/test-cases-panel|bug-reports-panel|report-builder/.test(chatPanel), 'Chat panel contains non-chat tool panels.');
assert(/id="aiChatMessages"/.test(chatPanel), 'Chat panel is missing the message scroller.');
assert(/id="aiChatForm"/.test(chatPanel), 'Chat panel is missing the fixed composer form.');

assert(/body\[data-active-view="ai"\] \.content[\s\S]*overflow:\s*hidden/.test(css), 'AI view does not contain page-level overflow.');
assert(/\.testpilot-chat-messages[\s\S]*overflow-y:\s*auto/.test(css), 'Chat messages do not own vertical scrolling.');
assert(/\.testpilot-chat-messages[\s\S]*overflow-x:\s*hidden/.test(css), 'Chat messages may allow horizontal scrolling.');
assert(/\.testpilot-composer[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*40px/.test(css), 'Composer input/send layout is not locked.');
assert(/@media \(max-width:\s*760px\)[\s\S]*\.testpilot-chat-panel[\s\S]*width:\s*100%/.test(css), 'Narrow DevTools chat panel rule is missing.');
assert(/\.report-builder-grid[\s\S]*grid-template-columns/.test(css), 'Report builder layout styles are missing.');

assert(/viewVisibilityRules[\s\S]*'test-cases': \['test-cases-only'\]/.test(js), 'Test Cases view isolation rule is missing.');
assert(/viewVisibilityRules[\s\S]*'bug-reports': \['bug-reports-only'\]/.test(js), 'Bug Reports view isolation rule is missing.');
assert(/streamLocalBackendChat/.test(js), 'Local backend streaming chat function is missing.');
assert(/updateIssueReviewStatus/.test(js), 'False-positive review controls are not wired.');
assert(/buildReportBuilderMarkdown/.test(js), 'Report builder export path is missing.');

console.log('Responsive UI smoke test passed.');
