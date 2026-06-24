# TestPilot Working Flow Test Guide

Use this guide to validate the current TestPilot MVP from browser setup through chat, agent actions, evidence capture, generated outputs, and export.

## 1. Local Setup

### Start the local AI backend

```bash
cd ai-backend
npm install
npm start
```

Expected:

- Terminal prints that the TestPilot AI backend is running.
- Health endpoint is available at `http://localhost:8787/api/health`.
- If Ollama/model is not available, the UI should show a clean backend/model error instead of breaking.

### Load the extension

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Enable Developer mode.
4. Click `Load unpacked`.
5. Select the project root: `buglens-extension`.
6. Open a normal web page, not `chrome://`, Chrome Web Store, or browser internal pages.
7. Open DevTools and select `TestPilot`.

Expected:

- TestPilot opens to `Main Chat`.
- The top header shows TestPilot branding.
- The menu button is visible.
- No horizontal scrollbar appears in the panel.

## 2. Chat-First UI

Steps:

1. Open the TestPilot DevTools panel.
2. Resize DevTools wide and narrow.
3. Type a message into the chat box.
4. Press `Enter` or click the send button.
5. Send enough messages to force scrolling.
6. Switch from `Chat` to `Agent`, then back to `Chat`.

Expected:

- Chat is the first view.
- `Chat` and `Agent` buttons appear beside the compact `AI QA Agent` title.
- A small AI badge near the heading shows `Checking`, `Live`, `Offline`, or `Model Error`.
- Input and send button stay aligned at the bottom.
- Messages scroll inside the chat area.
- Switching modes adds a small separator inside the chat history.
- The old Agent starter command block is not shown.
- The page does not horizontally scroll.

Pass:

- Chat remains usable at narrow and wide DevTools widths.

Fail:

- Input overlaps content, send button drops to another row, or horizontal scrolling appears.

## 3. AI Backend Live Status

Steps:

1. Start the panel with the backend stopped.
2. Confirm the compact badge changes to `Offline`.
3. Start the backend with `cd ai-backend && npm start`.
4. Wait up to 30 seconds or click the small retry icon.
5. Switch between `Chat` and `Agent`.
6. Send one chat question.

Expected:

- The panel checks `/api/health` automatically on load, on mode switch, before AI requests, and periodically.
- The large old AI status card is not visible in chat.
- The retry icon appears only when the backend/model is not ready.
- Chat does not invent a fake AI answer when the backend is unreachable.

Pass:

- Badge state updates without needing a large manual `Check AI` section.

Fail:

- User must open another card to check AI health, or an offline backend produces a fake answer.

## 4. AI Provider Settings

Steps:

1. Open `Settings`.
2. Find `AI Provider`.
3. Select `Local Backend`.
4. Leave API key empty.
5. Click `Test Connection`.
6. Save settings, reload the extension, and reopen DevTools.

Expected:

- Provider defaults to `Local Backend`.
- API key is not required for Local Backend.
- Status changes to `Live` when `http://localhost:8787/api/health` is reachable.
- API key fields are masked/preserved after save and reload.
- The compact chat header updates without showing a large AI status card.

Hosted provider smoke test:

1. Select `OpenAI`, `Grok / xAI`, `Gemini`, `Anthropic Claude`, `OpenRouter`, `Together AI`, or `Mistral`.
2. Enter only the provider API key.
3. Keep Model mode as `Auto / Recommended`.
4. Click `Test Connection`.
5. If the key is invalid, confirm the UI shows a clear authentication/provider error.

Custom provider smoke test:

1. Select `Custom OpenAI-Compatible API`.
2. Enter a chat-completions Base URL and optional API key.
3. Click `Test Connection`.

Expected:

- Test Connection sends only the tiny prompt `Reply with only OK.`
- No page context is sent during connection tests.
- Invalid keys are not logged, exported, sent to content scripts, or shown unmasked.
- Chat, Test Cases, and Bug Reports use the selected provider when it is live.
- If the provider is offline, TestPilot shows an error and does not generate fake AI output.

Note:

- Manifest host permissions include common providers and local development URLs. Arbitrary Custom API hosts may require adding that host to `manifest.json` during development.

## 5. Menu And QA Tools

Steps:

1. Click the menu button in the top-right header.
2. Confirm the drawer opens from the right.
3. Open the `QA Tools` dropdown.
4. Click each regular tab: `Dashboard`, `Network / Findings`, `Console`, `UI Bugs`, `Test Cases`, `Bug Reports`, `Reports`, `Settings`.
5. Reopen the menu from each tab.
6. Click the close `x`.

Expected:

- Drawer opens and closes on every tab.
- QA tools are inside the menu, not a separate sidebar.
- Only the active tab content changes; the main header remains consistent.

Pass:

- Menu works from all views.

Fail:

- Menu only works on Chat/Agent, drawer gets stuck, or another navbar appears inside tabs.

## 6. Start Session And Capture Page Data

Steps:

1. Click `Start`.
2. Reload the inspected page.
3. Interact with the page normally.
4. Click buttons, submit safe test forms, trigger a console warning/error if your test page supports it.
5. Open `Dashboard`, `Network / Findings`, and `Console`.

Expected:

- Session status changes to running.
- Current page URL is shown.
- Reload is detected.
- Network and console findings appear when relevant.
- Sensitive values are redacted in exported evidence.

Pass:

- Manual capture still works while the new chat UI is active.

Fail:

- No requests are captured after reload, content script is unavailable on a normal page, or console capture breaks.

## 7. Chat Mode

Test command:

```text
Summarize this page for QA testing.
```

Steps:

1. Keep mode set to `Chat`.
2. Send the command above.

Expected:

- TestPilot answers as a QA assistant.
- It does not execute page actions.
- If backend is down, it shows a clear local fallback response.

Pass:

- Chat response references the current session/page evidence when available.

Fail:

- Chat runs agent actions, returns the same irrelevant answer every time, or crashes on backend timeout.

## 8. Agent Mode: Highlight Elements

Test command:

```text
Highlight all interactive elements on this page.
```

Steps:

1. Switch to `Agent`.
2. Send the command.

Expected:

- Safe interactive elements are highlighted.
- Action log lists each highlight step.
- No destructive action runs.

Pass:

- Agent returns `Passed` or `Needs Review` with visible action evidence.

Fail:

- Agent tries checkout/payment/delete/logout actions without confirmation.

## 9. Agent Mode: Form Validation

Test command:

```text
Validate this login form with empty and invalid values.
```

Steps:

1. Open a page with a visible login/contact form.
2. Start a session and reload.
3. Switch to `Agent`.
4. Send the command.

Expected:

- Agent detects fields.
- Agent clears/types safe dummy data.
- Agent submits only when the detected submit control is safe.
- Result includes pass/fail/needs-review summary.
- Validation messages, route changes, API calls, and console events are linked when they occur.

Pass:

- Action log shows each step and linked API/console evidence within the action window.

Fail:

- Agent types sensitive data, submits a risky payment/checkout/delete action, or claims pass/fail without evidence.

## 10. Agent Mode: Search / Filter

Test command:

```text
Test the search box using the query "test".
```

Expected:

- Agent finds a search input when visible.
- It clears and types a safe query.
- It clicks a safe search button when available.
- Result mentions URL/result/no-result/visible feedback evidence.

Pass:

- Agent reports observed result state and any linked API/console activity.

Fail:

- Agent cannot identify an obvious search field or reports invented results.

## 11. Agent Mode: Modal / Button

Test command:

```text
Test opening and closing this modal.
```

Expected:

- Agent clicks a safe visible modal/dialog trigger.
- It observes modal state.
- It tries a safe close button when available.

Pass:

- Result mentions visible dialog evidence or says needs-review if no modal trigger exists.

Fail:

- Agent clicks risky actions or claims the modal opened when no dialog evidence exists.

## 12. API + Console Evidence Linked To Agent Actions

Steps:

1. Use a test page/action that triggers an API request or console warning/error.
2. Start TestPilot and reload.
3. Run an Agent command that clicks the trigger.
4. Read the `Action log` in the chat response.
5. Generate a bug report.

Expected:

- Evidence is linked under the relevant action step.
- Example: `PASS click #4: Clicked safe target` followed by linked API/console evidence.
- Bug report/test generation can use latest agent evidence.

Pass:

- API/console evidence appears only when it occurs near the action timestamp.

Fail:

- The report shows all raw logs with no action relationship, or no linked evidence appears after a known failing action.

## 13. Test Case Generation Tab

Steps:

1. Start a session and reload.
2. Run a chat or agent flow.
3. Open menu.
4. Open `QA Tools`.
5. Click `Generate Test Cases`.
6. Confirm the `Test Cases` tab opens automatically.
7. Change `Test type` and `Format`.
8. Click `Copy`, `Export Markdown`, and `Clear`.
9. From chat, send `Generate test cases for this flow`.

Expected:

- A loader appears in the `Test Cases` tab while generating.
- Test cases reference captured page/session/agent evidence.
- Tests include objective, priority, type, steps, and expected result.
- Type/format selectors update the visible/exported output.
- Chat shows only a short confirmation and does not dump the full test case output.
- Copy writes generated cases to clipboard.
- Export downloads a Markdown file.
- Clear removes generated cases from the tab.
- Backend timeout falls back to local generation.

Pass:

- Generated tests are not generic only; at least one item references captured evidence or latest agent result, and the result stays in the dedicated tab.

Fail:

- Output says no test cases after a real session with evidence, generated tests invent unrelated product features, or the chat thread fills with the full test-case output.

## 14. Bug Report Generation

Steps:

1. Create a known failed/needs-review flow.
2. Run Agent mode or capture API/console/UI evidence.
3. Open menu.
4. Open `QA Tools`.
5. Click `Generate Bug Report`.
6. Confirm the `Bug Reports` tab opens automatically.
7. Click `Copy`, `Export Markdown`, `Export JSON`, and `Clear`.
8. From chat, send `Generate a bug report for this flow`.

Expected:

- A loader appears in the `Bug Reports` tab while drafting.
- Bug draft includes title, severity, environment, steps, expected result, actual result, impact, and evidence.
- If evidence is weak, issue is marked needs-review instead of overclaimed.
- Linked agent API/console evidence is included when available.
- Chat shows only a short confirmation and does not dump the full bug draft output.
- Copy/export actions work from the dedicated panel.

Pass:

- Bug report is useful enough to file after tester confirmation and stays in the dedicated `Bug Reports` tab.

Fail:

- Bug report gives health-score advice instead of a bug draft, invents steps/evidence, or appears below the main chat.

## 15. Accessibility / UI Scan

Steps:

1. Open a page with images, inputs, links, and buttons.
2. Start a session and reload.
3. Open menu.
4. Open `QA Tools`.
5. Click `Accessibility / UI Scan`.
6. Open `UI Bugs`.

Expected:

- Scan detects basic issues such as missing alt text, unlabeled inputs, weak button/link text, heading issues, and suspicious links.
- Results include severity, affected element, selector/evidence, and suggested fix.

Pass:

- Real visible accessibility/UI issues appear; decorative/noise is reduced.

Fail:

- Scan returns nothing on a page with obvious unlabeled inputs/images, or floods the report with decorative false positives.

## 16. Export And Copy

Steps:

1. Complete a session with at least one finding or agent result.
2. Open `Reports`.
3. Export JSON, HTML, or CSV.
4. Inspect the JSON export.

Expected:

- Export includes session details, findings, redaction notice, limitations, and latest agent result.
- Sensitive query values, tokens, cookies, auth headers, and passwords are redacted.

Pass:

- Exported JSON contains `latestAgentResult` when an agent run happened.

Fail:

- Export exposes secrets or loses the latest agent result.

## 17. Automated Checks

Run these after code changes:

```bash
node --check devtools/panel.js
node --check content/content-script.js
node --check background/service-worker.js
node --check ai-backend/server.js
node tests/network-analyzer-smoke.js
node tests/ui-scanner-smoke.js
git diff --check
```

Expected:

- All commands complete without errors.

## Known MVP Limits

- The agent uses safe local deterministic planning for this phase; it does not execute arbitrary LLM-generated actions.
- Cross-origin iframes and browser-restricted pages cannot be fully inspected.
- Network capture starts only after DevTools and the TestPilot session are active.
- Accessibility checks are practical rule-based QA checks, not a full WCAG audit.
- Agent pass/fail depends on visible evidence, API/console correlation, and tester confirmation for ambiguous results.

## Agent Repair Validation Commands

Run these exact prompts in `Agent` mode after starting a session and reloading the inspected page:

| Prompt | Expected plan behavior |
| --- | --- |
| `Highlight all interactive elements on this page.` | `highlight_interactions`; highlights only, no typing, no clicking. |
| `Validate this login form with empty and invalid values.` | `login_validation`; empty submit, invalid email, safe dummy credential check, then observe. |
| `Enter a dummy login and check if it works or not. Try with fake emails.` | `invalid_login_test`; safe dummy values only, then observe validation/API/console evidence. |
| `Create a dummy account. First try invalid data.` | `invalid_signup_validation`; invalid email/weak password/invalid phone where fields exist, then observe. |
| `Now test signup with valid dummy data.` | `valid_dummy_data_flow`; valid-looking dummy name/email/password/phone, never `invalid-email`. |
| `Test the search box using the query "test".` | `search_test`; clear/type query, submit safely, then observe result evidence. |
| `Test opening and closing this modal.` | `modal_test`; safe open, observe dialog, safe close when available. |
| `Check pagination.` | `pagination_test`; safe page/next control, then observe list/table/URL evidence. |
| `Audit accessibility.` | `accessibility_check`; observe accessibility basics without arbitrary clicks. |

Each Agent response should include:

- `Status`
- `Task`
- `Data Strategy`
- `Summary`
- `Evidence`
- `Passed Checks`
- `Failed Checks`
- `Recommended Next Steps`

Reject the run if a prompt above falls back to the old generic form plan for an unrelated task.
