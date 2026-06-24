# TestPilot

TestPilot is a lightweight, local-first Chrome DevTools QA assistant. It separates actionable defects from findings that need review, framework noise, informational observations, and passed checks, then exports professional HTML, JSON, or CSV evidence. Optional AI analysis can review a sanitized session summary through a local backend that keeps provider keys server-side.

TestPilot is intentionally designed for **one active inspected page and one QA session at a time**. It is not a crawler, cloud dashboard, cross-tab monitor, or background testing service.

## Core Features

- Guided dashboard with session status, recommended next action, capture health, and priority findings
- Keyboard-navigable Dashboard, Findings, UI Bugs, AI Chat, Reports, and Settings views
- QA health score based only on actionable and review findings
- Failed, slow, duplicate, malformed, and potentially risky API detection
- Next.js RSC and route-data classification, including successful `_rsc` requests
- Page-level `console.error`, `console.warn`, runtime error, and rejected-promise capture
- Manual, bounded UI consistency scan with decorative and transformed-element noise reduction
- Duplicate issue grouping and severity ordering
- Temporary session recovery through `chrome.storage.session`
- Sensitive-data redaction before display, storage, and export
- Local HTML, normalized JSON, and Google Sheets-friendly CSV reports
- Compact finding cards with copy-ready bug descriptions and expandable evidence
- Optional AI Chat powered by a local Ollama backend
- Clear confirmation, filter reset, settings reset, and action feedback
- Unsupported-page and unavailable-content-script states
- Reload and SPA route timeline tracking

## Interface

TestPilot uses a responsive, neutral DevTools workspace:

- The AI Chat view opens first and uses a TestPilot-style agent workspace with QA tools inside the right-side menu.
- The secondary workspace still separates Dashboard, Findings, UI Bugs, Reports, and Settings for evidence review.
- The sticky session bar keeps the inspected page, capture status, elapsed time, session controls, and report export visible.
- Dashboard shows compact health, actionable, review, noise, console, UI, and AI readiness cards.
- API findings show compact method, status, duration, severity, category, and confidence badges before expandable evidence.
- Findings are unified and filterable by type, category, severity, and search text.
- AI Chat is a dedicated agent-style chat tab. Report AI artifacts can analyze the session, suggest tests, draft bugs, and add selected chat notes to reports.
- Reports use format cards that explain when to choose HTML, CSV, JSON, or a copied QA summary.
- Settings use grouped controls, helper text, and accessible switches.
- The same menu button works across Chat, Dashboard, Findings, Console, UI Bugs, Reports, and Settings; cards wrap into fewer columns at narrow DevTools widths.

## Privacy and Storage

TestPilot performs analysis inside the browser extension.

- Captured QA data is not sent to any server or external API.
- AI is optional and sends only a small sanitized session summary to `http://localhost:8787` when the tester clicks an AI action.
- Session results use `chrome.storage.session`, not long-term browser history.
- Harmless rule preferences use `chrome.storage.local`.
- Reports are created only when the tester explicitly exports them.
- Response snippets are disabled by default.
- Tokens, cookies, authorization values, passwords, secrets, and sensitive query parameters are redacted with `[REDACTED]`.
- AI payloads exclude cookies, authorization headers, tokens, passwords, raw request/response headers, request/response bodies, personal data, and screenshots.

Stopping a session pauses capture but keeps results available for review and export. **Clear** removes the temporary session. Chrome also removes session storage when the browser session ends.

## Requirements

- Google Chrome 116 or newer
- A normal `http://` or `https://` page that extensions are allowed to inspect
- No Node.js, package installation, server, or build command is required

## Install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the cloned or downloaded `testpilot-extension` project folder.

5. Confirm **TestPilot QA Agent** appears without manifest errors.
6. Reload any page that was already open before the extension was installed.

After editing extension files, click the extension's **Reload** button on `chrome://extensions`, then reload the inspected page and reopen DevTools.

## Use TestPilot

1. Open the application page you want to test.
2. Open Chrome DevTools with `F12`, `Ctrl+Shift+I`, or `Cmd+Option+I`.
3. Open the **TestPilot** panel. It may be under the DevTools `»` menu.
4. Click **Start Session**.
5. Reload the inspected page when TestPilot shows **Needs Reload**.
6. Perform the manual QA flow.
7. Click **Scan UI** from Findings when you want to inspect the current visible screen.
8. Review actionable findings first, then inspect needs-review or framework observations where useful.
9. Optionally use **AI Chat** prompts such as **Which issues are real bugs?**, **Generate bug reports**, or **Generate regression checklist**.
10. Click **Stop** when the flow is complete.
11. Export HTML, JSON, or CSV, or copy the QA summary.

To test another unrelated page, stop or clear the current session and start a new one. SPA route changes can remain in one flow, but TestPilot warns when a session contains several routes.

## Agent Workflow MVP

Agent mode turns the chat surface into a safe page tester for the active inspected tab.

1. Open **AI Chat**.
2. Switch from **Chat** to **Agent**.
3. Use a starter command or type a command such as:
   - `Validate this login form`
   - `Test the search box`
   - `Check all important buttons`
   - `Validate this modal`
   - `Check if pagination works`
   - `Audit this page for accessibility issues`
4. TestPilot extracts compact page context, classifies the task, creates a structured plan, validates safety, executes allowed actions, observes the page, and returns a pass/fail/needs-review summary.

Safety rules:

- Uses dummy QA values only.
- Blocks destructive, payment, logout, password reset, upload, unsafe external navigation, hidden, and disabled targets.
- Acts only on the current inspected tab.
- Does not claim a pass without visible evidence.

Agent outputs are reused by generated test cases and bug report drafts when available.

For the complete manual validation checklist, use [docs/working-flow-test.md](docs/working-flow-test.md).

## Validate The Agent Flow

Use a normal test or staging page, not production checkout or account settings.

| Item | How to test | Expected result |
| --- | --- | --- |
| Intent classifier | Ask `Test the search box`, `Validate this login form`, and `Audit this page for accessibility issues`. | Response shows task types like `search test`, `form validation`, or `accessibility check`. |
| Page context extraction | Ask `Highlight all interactive elements on this page.` | Agent reports indexed visible elements and highlights safe targets. |
| Structured plan | Run any Agent command. | Response includes a numbered `Plan` with actions and target indexes. |
| Safety validator | Ask it to click a logout, delete, payment, upload, or external link control. | Agent blocks the action or marks it as requiring confirmation. |
| Form validation | Open a test form and ask `Validate this login form`. | Agent enters safe dummy data, submits when safe, and reports validation/success/needs-review evidence. |
| Search | Ask `Test the search box`. | Agent types `test`, submits if a safe search control exists, and reports observed result state. |
| Buttons | Ask `Check all important buttons`. | Agent highlights or safely clicks non-destructive visible buttons and returns action results. |
| Links | Ask `Check navigation links`. | Agent only tests safe same-site links; unsafe external links are blocked. |
| Modal | Ask `Validate this modal`. | Agent clicks a visible modal trigger, observes dialog content, and closes it if a safe close control exists. |
| Table / pagination | Ask `Validate this table` or `Check if pagination works`. | Agent highlights table evidence or safely tests next/previous controls. |
| Accessibility basics | Ask `Audit this page for accessibility issues`. | Agent reports missing labels, missing image alt text, empty button names, or a clean pass when none are visible. |
| Output reuse | After an Agent run, choose Menu -> QA Tools -> Generate Test Cases or Generate Bug Report. | Generated artifacts include the latest agent result when no stronger findings exist. |

## Recommended QA Workflow

```text
Start Session
Reload page
Perform one focused test flow
Review Actionable and Needs Review findings
Scan the final visible UI state
Optionally ask AI Chat to explain real bugs, ignored noise, and next tests
Stop Session
Export HTML for review, JSON for tooling, or CSV for Google Sheets
Clear before testing another page or flow
```

Network capture starts only after the TestPilot DevTools panel and session are active. Reloading after **Start Session** gives the most complete network evidence.

## API and Network Validation

TestPilot analyzes API-like DevTools network entries and can report:

- HTTP `4xx` and `5xx` responses
- Requests with no HTTP response status
- Slow and very slow APIs
- Duplicate calls within the configured time window
- Failed Next.js route prefetches, grouped by logical destination route
- Empty JSON responses
- Invalid JSON responses
- Missing or unexpected `content-type`
- Missing common cache guidance on successful GET responses
- Sensitive query parameters
- Empty write-request payloads that need review
- Redacted request and response headers
- Safe response-body status: available, unavailable, disabled, skipped binary, or skipped too large

Default limits:

```text
Slow API                 1000 ms
Very slow API            3000 ms
Duplicate window         2000 ms
Response preview         10000 bytes
API issue limit          500 unique issues
```

Body data is optional. Missing, binary, encoded, cached, or oversized content does not stop analysis or report generation.

TestPilot treats Next.js RSC and speculative route-data requests separately from normal business APIs. Successful `_rsc` payloads are tracked as framework/internal traffic instead of passed business APIs. Failed prefetches are grouped into one `framework-noise`/`info` finding, retain their unique route count, and do not reduce QA health or increase the main issue count by default. Non-JSON byte-range probes are excluded from API duplicate detection.

API failures are also classified by QA relevance. TestPilot distinguishes user-triggered APIs, page-critical APIs, background APIs, polling or heartbeat calls, prefetches, analytics, third-party widgets, framework/internal requests, static assets, document navigations, and unknown requests that need review. User actions are correlated with nearby network traffic so clicks and form submissions are treated more fairly than passive background traffic.

The API view separately tracks business APIs, framework/internal requests, static assets, document/navigation requests, and passed requests.

## Console Validation

The page-context listener captures:

- `console.error`
- `console.warn`
- Unhandled runtime errors
- Unhandled promise rejections
- Message, source file, line, column, stack, URL, and timestamp when available

Matching console issues are fingerprinted and shown once with a duplicate count. The default unique console issue limit is 300.

Console errors and warnings default to **Needs Review** unless there is confirmed user-facing impact. This keeps runtime noise from destroying QA health on SPA homepages that still work correctly.

## UI Scanner

The UI scan runs only when the tester clicks **Scan UI**. There is no continuous DOM polling.

Checks include:

- Horizontal document overflow
- Elements extending beyond the viewport
- Broken images
- Missing image alt text
- Small clickable targets
- Likely clipped text
- Large fixed or sticky elements that may cover content
- Inconsistent button sizing and styling
- Colors outside the optional allowed-color list

The scanner defaults to the current visible viewport, 4,000 visible nodes, 200 unique UI findings, and 25 findings per rule. Decorative canvases, backgrounds, pointer-events-none elements, low-opacity layers, transformed labels, minor edge differences, and offscreen layout sections are ignored by default. Viewport overflow must exceed a meaningful threshold, and text clipping requires meaningful hidden overflow on a visible leaf text element. Evidence selectors prefer short stable classes over long utility-class paths. These checks remain practical QA hints, not pixel-perfect assertions.

## Reports

### HTML

The standalone HTML report includes:

- Executive summary and QA health
- Separate Actionable, Needs Review, Framework Noise, and Passed sections
- Tool version and tested page
- Session time and reload status
- Severity and issue-type summaries
- API, console, and UI statistics
- Detailed redacted evidence
- Duplicate counts
- Suggested bug text
- Privacy and known-limitations notes

### JSON

The JSON report uses a normalized schema with:

- Session ID, status, routes, timeline, duration, and storage mode
- User agent and viewport
- Counts by severity and issue type
- Network, console, UI, and dropped-limit statistics
- Separate `issues`, `observations`, `frameworkNoise`, `passedChecks`, and `ignoredFindings`
- Finding category, confidence, user impact, recommendation, evidence, and count flags

### CSV

CSV exports use a UTF-8 BOM and concise one-line evidence summaries so the file opens cleanly in Google Sheets. Raw request headers and large JSON evidence are intentionally excluded.

## Settings

The DevTools **Settings** section groups network, UI scanner, noise, and reporting controls. It supports:

- Slow API threshold
- Very slow API threshold
- Duplicate-call window
- Response preview byte limit
- Maximum UI nodes per scan
- Maximum UI issues per rule
- Optional response snippet capture
- Hide or show framework noise
- Optional promotion of prefetch failures to needs-review issues
- AI Chat enablement and report-summary inclusion
- Ignore, critical API, and background API URL pattern lists
- UI scan strictness
- Visible-viewport-only UI scanning
- Optional decorative-element scanning
- Framework-noise export control
- CSV export control
- Optional allowed color tokens

Settings persist locally and can be restored to professional defaults in one click. Captured session evidence does not become long-term history.

## Local AI Backend

TestPilot AI is optional. The extension works normally when the backend is not running.

Development architecture:

```text
TestPilot Extension
Local TestPilot AI Backend: http://localhost:8787
Ollama: http://localhost:11434
Model: llama3.2:3b
```

Start Ollama and the backend:

```bash
ollama pull llama3.2:3b
cd ai-backend
npm start
```

Health check:

```bash
curl http://localhost:8787/api/health
```

AI endpoints:

```text
GET  /api/health
POST /api/ai/analyze-session
POST /api/ai/chat
POST /api/ai/generate-bug-report
POST /api/ai/generate-test-cases
```

The backend is currently locked to local Ollama through `AI_PROVIDER=ollama`, which avoids external API rate limits during normal testing. API keys are never stored in the Chrome extension frontend.

### Page Context and Jira Tickets

The AI Chat tab can attach explicit tester-selected context before asking the model for help:

- Select page text, then click **Capture selected text** or right-click and choose **Send selected text to TestPilot AI**.
- Click **Capture visible summary** to attach visible headings, alerts, validation messages, and focused element text.
- Click **Attach priority finding** to attach the highest-priority TestPilot finding.
- Ask **Generate Jira Ticket** to combine attached page context with TestPilot API, console, UI, environment, and timeline evidence.

Attached context is sanitized, truncated, shown in the AI tab, and included in JSON/HTML reports only as sanitized text. TestPilot does not scrape full page data automatically.

## Known Limitations

- Chrome blocks extensions on `chrome://`, `edge://`, browser settings, DevTools pages, and Chrome Web Store pages.
- Requests made before the panel and session start cannot be captured.
- Cross-origin iframe DOM and console details may be unavailable.
- DevTools may not provide every response body, especially for cached, redirected, binary, encoded, or very large responses.
- UI rules can produce false positives and require tester judgment.
- Closing DevTools stops live DevTools network capture.
- TestPilot does not take screenshots, crawl multiple pages, validate full API schemas, or sync reports to a team service.

## Troubleshooting

### TestPilot panel is missing

Reload the extension on `chrome://extensions`, close and reopen DevTools, then check the DevTools `»` menu.

### Console or UI status says unavailable

Reload the inspected page. Pages opened before installation do not contain the content scripts until they are reloaded.

### No network requests appear

Start the session first, reload the page, and trigger the action again. Keep DevTools open.

### Start Session is disabled

The inspected URL is probably restricted by Chrome. Switch to a normal application page using `http://` or `https://`.

### UI scan reports many low-value findings

Reduce configured color rules, review higher severities first, or lower the maximum issues per rule.

### Changes do not appear

Reload TestPilot on `chrome://extensions`, reload the target page, and reopen the DevTools panel.

## Project Structure

```text
manifest.json                         Manifest V3 configuration
background/service-worker.js          Event relay and preference initialization
content/injected-console-listener.js  Main-world console/error listener
content/content-script.js             Message bridge and bounded UI scanner
devtools/devtools.js                  DevTools panel registration
devtools/panel.html                   Main QA interface
devtools/panel.css                    Panel styling
devtools/panel.js                     Session, analyzers, UI, storage, and reports
popup/                                Quick usage popup
docs/quick-start.html                 In-extension quick-start guide
```

## Redesign Acceptance Criteria

- Visible product copy uses **TestPilot** consistently.
- The DevTools panel opens on the chat-first TestPilot interface.
- The chat surface has a compact header, scrolling messages, and a fixed bottom composer.
- Chat and Agent mode toggles are visible; Agent mode is a UI placeholder only.
- Workspace tabs for Chat, Dashboard, Findings, Console, UI Bugs, Reports, and Settings remain accessible from the shared menu.
- QA tools live inside the shared menu as a dropdown, with Test Cases, Bug Report, and Accessibility actions.
- No permanent QA tools sidebar is shown on wide or narrow DevTools panels.
- The page context indicator shows the inspected page state.
- Local LLM development mode is shown; cloud usage and subscriptions are placeholders only.
- AI context mode can be selected as Fast, Balanced, or Deep.
- Old backend logs and dashboard-heavy controls are hidden from the main chat view.
- The layout remains usable at common DevTools widths without overlapping content.

## Development and Verification

The project uses plain JavaScript, HTML, and CSS with no build step.

Run local static checks:

```bash
for file in \
  background/service-worker.js \
  content/content-script.js \
  content/injected-console-listener.js \
  devtools/devtools.js \
  devtools/panel.js \
  popup/popup.js
do
  node --check "$file"
done

jq empty manifest.json
node tests/network-analyzer-smoke.js
node tests/ui-scanner-smoke.js
```

Browser verification still requires loading the unpacked extension in Chrome. Test a normal web page, start and reload a session, trigger API and console activity, run the UI scan, and export all three report formats.

## Roadmap

- Selector and API ignore rules
- URL-specific expected status and schema rules
- Screenshot evidence
- Accessibility integration
- HAR import/export
- Tester notes and named test steps
- More precise CORS and preflight diagnostics
- Optional same-origin iframe scanning
- Automated browser tests for extension contexts

## Version

`0.4.1`
