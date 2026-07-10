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
- `http://localhost:8787` returns backend status JSON.
- Health endpoint is available at `http://localhost:8787/api/health`.
- If Ollama/model is not available, the UI should show a clean backend/model error instead of breaking.

In another terminal, run:

```bash
cd ai-backend
npm run health
```

Expected:

- The command says whether the backend root, health route, and Ollama/model are ready.
- If Ollama is not ready, the backend can still be running while `ai.ok` is false.

### Load the extension

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Enable Developer mode.
4. Click `Load unpacked`.
5. Select the project root folder that contains `manifest.json`: `buglens-extension`.
6. Do not select `ai-backend`, `devtools`, `popup`, or any subfolder.
7. Open a normal web page, not `chrome://`, Chrome Web Store, or browser internal pages.
8. Reload the page if it was already open before installing the extension.
9. Open DevTools and select `TestPilot`; it may be under the DevTools `»` overflow menu.

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
- With `Local Backend`, response text streams into the assistant message as the local model writes tokens.
- If backend is down, it shows a clear local fallback response.

Pass:

- Chat response references the current session/page evidence when available.

Fail:

- Chat runs agent actions, returns the same irrelevant answer every time, waits silently for the full local LLM response, or crashes on backend timeout.

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
- Agent shows a live progress bubble while it works.
- Agent focuses and highlights each field it is filling.
- Agent clears/types safe dummy data visibly instead of silently setting final values.
- Chat progress says which field is being cleared, typed into, selected, checked, or observed.
- Agent submits only when the detected submit control is safe.
- Result includes pass/fail/needs-review summary.
- Validation messages, route changes, API calls, and console events are linked when they occur.

Pass:

- Action log shows each step and linked API/console evidence within the action window.

Fail:

- Agent silently changes fields with no live status, types sensitive data, submits a risky payment/checkout/delete/account-creation action without approval, or claims pass/fail without evidence.

## 9A. Agent Permission Prompt

Test command:

```text
Test the signup form with valid dummy data.
```

Steps:

1. Open a staging/test signup page with a visible `Create account`, `Register`, or `Sign up` submit button.
2. Start a session and reload.
3. Switch to `Agent`.
4. Send the command above.
5. Watch the chat progress.
6. When TestPilot asks for permission, click `Cancel`.
7. Run the command again and click `Continue Once`.
8. Run another similar safe form-validation command and click `Allow Similar This Session`.

Expected:

- Agent fills safe dummy fields visibly before any serious submit.
- The live Agent card tells the tester which field is being cleared, typed, selected, checked, or observed.
- Plain form `Submit`, `Continue`, `Save`, `Send`, login, signup, checkout, and order buttons pause with one consolidated `Permission required` card.
- The card explains why approval is needed, lists prepared inputs, and shows the next action.
- `Cancel` stops the action.
- `Continue Once` continues only the exact preflighted task.
- `Allow Similar This Session` is available only for rememberable non-destructive form-submit style actions.
- After allowing similar actions for the session, the Agent can continue similar safe actions on the same page path without repeatedly prompting.
- Approval is scoped to the exact pending submit/continue action. A different risky step must ask again.
- After approval, the Agent resumes from the pending action instead of rerunning the whole plan from the top.
- The final Agent response includes outcome, evidence confidence, observed action results, inputs used, and next steps.

Pass:

- No serious action runs before tester approval.
- Form submit/continue buttons do not click before tester approval.

Fail:

- TestPilot clicks a risky submit/create/save/payment/logout/delete action without asking first.
- TestPilot clicks a form `Submit` or `Continue` button without asking first.
- The final Agent response does not show the safe inputs that were applied.
- Payment, destructive, logout, file upload, and external-navigation actions become permanently auto-approved.

## 9B. Chat Scroll And Menu Overlay

Steps:

1. Run an Agent command that produces a long response.
2. Scroll upward inside the chat transcript while the Agent is still updating.
3. Confirm the transcript does not jump back to the newest message until you scroll near the bottom or send another message.
4. Open `Menu`.
5. Scroll the current tab content behind the menu.

Expected:

- Manual transcript scroll position is respected while Agent progress updates.
- Sending a new message still moves the transcript to the bottom.
- The menu drawer stays fixed on the right.
- The menu scrolls inside itself if its own content is taller than the viewport.
- The tab content behind the open menu does not scroll.

## 9C. Agent Deterministic Foundation Examples

Run each command on a staging page with matching controls.

Commands and expected behavior:

- `only change the first input`
  Expected: Agent resolves target `first input`, changes exactly one visible input/textarea, does not submit.

- `try signup`
  Expected: Agent resolves target `signup link`, highlights/clicks the signup link or button if visible and same-site safe.

- `try continuing with google`
  Expected: Agent resolves target `google button` and asks confirmation because OAuth/social login is not auto-run.

- `why is login button broken`
  Expected: Agent uses answer/inspect mode, observes evidence, and does not click/type unless the tester asks for action.

- `try with symbols in name`
  Expected: Agent resolves a name/first text field when visible, types symbol data into that field, and does not use a generic stale form plan.

Expected debug/evidence fields:

- Agent live output includes state changes such as classifying, snapshotting, planning, executing, observing, evaluating, completed, blocked, or awaiting confirmation.
- Final Agent result includes `promptId`, `taskId`, and `planHash`.
- New prompt produces a new planHash.
- Page change produces a new planHash.
- New data strategy produces a new planHash.
- Old pending approval is cancelled when a new Agent prompt is sent.

Pass:

- Prompt-specific commands do not reuse stale/default plans.
- Missing target is reported as not captured/no action, not silently replaced by a generic form flow.

Fail:

- `only change the first input` modifies multiple fields.
- `try signup` fills a form instead of targeting signup.
- `try continuing with google` clicks OAuth without confirmation.
- A one-time approval continues a previous prompt after a new prompt was sent.

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
- Agent response includes `Outcome`, `Evidence confidence`, `Evidence summary`, a safe plan, observed action results, passed checks, failed checks, and recommended next steps.
- The response says when evidence is weak instead of presenting a needs-review result as a confirmed bug.
- Bug report/test generation can use latest agent evidence.

Pass:

- API/console evidence appears only when it occurs near the action timestamp.

Fail:

- The report shows all raw logs with no action relationship, or no linked evidence appears after a known failing action.
- Agent claims a pass/fail without action evidence, linked evidence, or tester review guidance.

## 13. False-Positive Controls

Steps:

1. Capture at least one finding.
2. Open `Network / Findings` or `UI Bugs`.
3. On a finding, click `Real Bug`.
4. Confirm the category/count updates as actionable.
5. Click `Needs Review`.
6. Confirm it remains counted but is marked for tester confirmation.
7. Click `Ignore`.
8. Open `Reports` and export JSON/HTML.

Expected:

- `Real Bug`, `Needs Review`, and `Ignore` buttons appear on each finding.
- The active tester decision is visually highlighted.
- Ignored findings move out of the health score and appear as informational/ignored report context.
- Confirmed findings remain reportable and influence generated bug drafts.
- Exported reports include `reviewStatus` and `reviewedAt`.

Pass:

- Tester decisions persist after reload and affect dashboard counts, report builder drafts, and exports.

Fail:

- Buttons only change styling, ignored items still lower the score, or exports lose the tester decision.

## 14. Test Case Generation Tab

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

## 15. Bug Report Generation

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

## 16. Report Builder

Steps:

1. Capture a finding or generate a bug report draft.
2. Open `Reports`.
3. Review the `Ready-to-file bug draft` panel.
4. Edit the title, severity, status, summary, steps, expected result, actual result, or evidence.
5. Click `Copy Draft`.
6. Click `Export Markdown`.
7. Click `Refresh Draft`.
8. Export HTML and JSON.

Expected:

- The builder auto-fills from the strongest current evidence: generated bug draft, confirmed finding, needs-review finding, or latest Agent result.
- Manual edits are not overwritten during normal rendering.
- `Refresh Draft` intentionally rebuilds from current evidence.
- Copy/export produces a clean Markdown bug draft.
- JSON/HTML reports include the report-builder draft.

Pass:

- The draft is useful for Jira/Linear after tester review and does not expose secrets.

Fail:

- Builder is empty despite reportable evidence, edits disappear unexpectedly, or exported reports omit the draft.

## 17. Accessibility / UI Scan

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

## 18. Export And Copy

Steps:

1. Complete a session with at least one finding or agent result.
2. Open `Reports`.
3. Export JSON, HTML, or CSV.
4. Inspect the JSON export.

Expected:

- Export includes session details, findings, redaction notice, limitations, and latest agent result.
- Export includes the report-builder draft when present.
- Sensitive query values, tokens, cookies, auth headers, and passwords are redacted.

Pass:

- Exported JSON contains `latestAgentResult` when an agent run happened.

Fail:

- Export exposes secrets or loses the latest agent result.

## 19. Automated Checks

Run these after code changes:

```bash
node --check devtools/panel.js
node --check content/content-script.js
node --check background/service-worker.js
node --check ai-backend/server.js
node tests/agent-live-workflow-smoke.js
node tests/agent-production-hardening-smoke.js
node tests/ai-provider-settings-smoke.js
node tests/responsive-ui-smoke.js
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

- `Outcome`
- `Evidence confidence`
- `Evidence summary`
- `Task`
- `Data Strategy`
- `Safe plan`
- `Observed action results`
- `Evidence`
- `Passed Checks`
- `Failed Checks`
- `Recommended Next Steps`

Reject the run if a prompt above falls back to the old generic form plan for an unrelated task.

## 20. Phase 2 Agent RAG / Execution Validation

Use a normal test page with at least one form, one link/button, and one visible validation message path.

Setup:

1. Start `ai-backend` only if you want chat/model responses; the Agent validation below is deterministic and should still run without cloud keys.
2. Load the extension unpacked.
3. Open the target page, open DevTools, open `TestPilot`.
4. Start a session and reload the inspected page.
5. Open `AI QA Agent`, switch to `Agent`.

Run these prompts one at a time:

| Prompt | Expected validation |
| --- | --- |
| `only change the first input` | Plan cites retrieved `DOM-*` evidence, changes only the first input, and final output says `passed` only if the field diff proves only that target changed. |
| `try signup` | Plan targets a captured signup `DOM-*` link/button. If route/modal/message changes are captured, result can pass; otherwise it must be `needs_review`, not generic success. |
| `try continuing with google` | Agent pauses for permission before OAuth/social login and resumes only the same `planHash` / step fingerprint after approval. |
| `why is login button broken` | Agent stays in answer/observe mode and does not click or type. Unsupported claims must say `not captured`. |
| `try with symbols in name` | Agent uses symbol test data only on the resolved field and records the input in the final result. |

Every Agent final answer must include these labels:

- `Status`
- `Task`
- `User Requirement`
- `What I Did`
- `Evidence`
- `Result`
- `Needs Review`
- `Next Step`

Pass:

- `Agent is working` live messages show `Retrieved grounded evidence before planning`.
- Safe plan rows include target `DOM-*` evidence IDs.
- Final output cites `DOM-*`, `ACT-*`, `OBS-*`, `CON-*`, `API-*`, or says `not captured`.
- A click is not marked passed just because the click handler ran; there must be route, modal, visible message, list/table, field, API, or console evidence.
- Starting a new Agent prompt cancels stale pending approval.

Fail:

- Final answer gives broad health-score advice instead of evidence for the prompt.
- Agent reuses an old generic form plan after a new prompt.
- A serious submit/continue/OAuth action runs without approval.
- Output claims an API failure, console error, or page state without an evidence ID or `not captured`.

## 21. Phase 3 Production Hardening Validation

Use the local harness when you need a repeatable MVP check:

```text
tests/fixtures/testpilot-harness.html
```

Open it directly in Chrome, then open DevTools > TestPilot.

Required flow:

1. Start a session.
2. Reload the harness page.
3. Confirm the top header shows compact `AI`, `Agent`, and `Mode` chips.
4. Open `Debug`.
5. Switch chat to `Agent`.
6. Run `only change the first input`.
7. Confirm the debug drawer shows:
   - `sessionId`
   - `promptId`
   - `taskId`
   - `planHash`
   - current state
   - retrieved evidence IDs
   - plan JSON preview
   - action trace
   - provider status
   - context mode
8. Run `try continuing with google`.
9. Confirm the Agent pauses for permission and `Stop Agent` cancels without stopping the session.
10. Run `test login with fake data`.
11. Confirm the final Agent output cites `DOM-*`, `ACT-*`, `OBS-*`, or says `not captured`.
12. Trigger `API failure` and `Console error` buttons on the harness page.
13. Open `Findings`, `Console`, and `Reports` to verify sanitized evidence.

Test Cases tab:

1. Open `Test Cases`.
2. Select each filter: `All Types`, `Functional`, `Negative`, `Edge`, `Regression`, `Smoke`.
3. Click `Generate`.
4. Confirm loader appears while generating.
5. Confirm generated cases reference session evidence or latest Agent result.
6. Click `Copy`, `Export Markdown`, and `Export JSON`.

Bug Reports tab:

1. Open `Bug Reports`.
2. Click `Generate`.
3. Confirm each draft has title, severity, steps, expected, actual, evidence, and evidence IDs.
4. If evidence IDs are missing, confirm the needs-review warning appears.
5. Click `Copy`, `Export Markdown`, and `Export JSON`.

Provider / privacy checks:

1. Stop `ai-backend`.
2. Send a normal Chat message.
3. Expected: TestPilot shows a provider unavailable error, not a fake AI answer.
4. Start `ai-backend` again.
5. Click Check AI or wait for auto-check.
6. Confirm API keys remain masked in Settings and exports do not contain cookies, auth headers, tokens, passwords, or raw secrets.

Pass:

- Main chat stays chat-only; generated test cases and bug reports appear only in their tabs.
- Agent run state shows `idle`, `running`, `waiting`, `blocked`, or `failed`.
- Debug drawer is useful without exposing secrets.
- Stop Agent cancels the Agent run but keeps the QA session alive.
- Exports are redacted and include the latest Agent result when present.

Fail:

- Test cases or bug reports are dumped into the main chat.
- Debug drawer shows raw passwords, tokens, cookies, auth headers, or API keys.
- Provider-offline chat invents a model answer.
- Agent repeats a stale generic form plan for the regression prompts.
