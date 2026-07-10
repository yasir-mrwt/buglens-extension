# TestPilot Baseline Audit And Safe Migration Plan

Source prompt: `/Users/yasir/Downloads/01_baseline_audit.md`

Date: 2026-07-10

Status: historical pre-migration audit. The current extension source now lives in React/TypeScript under `src/`; the root manifest loads generated runtime files written by the build.

## Scope

This audit inspected the TestPilot Chrome extension before the React and TypeScript migration work. It is kept as a baseline record, not as the current implementation map.

## Original Architecture Summary

### Extension Runtime

- `manifest.json` is Manifest V3 (`manifest_version: 3`).
- The extension previously loaded as an unpacked Chrome extension from the project root.
- There was no root build tool, bundler, TypeScript config, Vite config, or webpack config.
- The extension UI previously ran directly from checked-in HTML, CSS, and JavaScript files.
- The only previous `package.json` belonged to the optional local AI backend in `ai-backend/`.

### Manifest Entry Points

- `src/background/service-worker.ts` is the Manifest V3 service worker.
- `popup/popup.html` is the toolbar popup.
- `devtools/devtools.html` is the DevTools page.
- `src/devtools/devtools.ts` registers the custom DevTools panel.
- `devtools/panel.html`, `devtools/panel.css`, and `src/devtools/panel/panelController.ts` implement the main TestPilot UI.
- `src/content/injected-console-listener.ts` runs in the page main world at `document_start`.
- `src/content/content-script.ts` runs as the extension content script at `document_start`.
- Icons are loaded from `assets/icons/`.

### Background Service Worker

`src/background/service-worker.ts` owns extension-level coordination:

- Tracks connected DevTools panels by inspected tab ID.
- Initializes default settings in `chrome.storage.local`.
- Removes legacy session keys from `chrome.storage.session`.
- Creates the context menu action for sending selected page text to AI.
- Relays content-script events to the matching DevTools panel.
- Reports whether any TestPilot panels are currently connected.

### DevTools Panel

`src/devtools/panel/panelController.ts` is the largest and most stateful file in the extension. It owns:

- Active session state, timers, persistence, and restore behavior.
- DevTools inspected tab integration.
- Network event capture and classification.
- Console, UI scan, findings, reports, CSV, JSON, and HTML export flows.
- AI provider settings, chat, streaming local backend calls, provider calls, and local fallbacks.
- Agent command dispatch, permission UI, approval resume, and result rendering.
- Most DOM querying, event binding, rendering, and view switching.

`devtools/panel.html` previously contained the full DevTools workspace markup, including:

- Top session/status bar.
- Main chat / agent surface.
- Dashboard.
- Findings.
- Console.
- UI bugs.
- Test cases.
- Bug reports.
- Reports.
- Settings.

`devtools/panel.css` contains the current visual system and responsive layout. The migration should preserve this styling initially.

### Content Scripts

`src/content/injected-console-listener.ts` runs in the page main world and captures:

- `window.error`
- `unhandledrejection`
- Optional proxied `console.error`
- Optional proxied `console.warn`

It posts sanitized console/runtime payloads back to the isolated content script through `window.postMessage`.

`src/content/content-script.ts` owns inspected-page behavior:

- Forwards page console/runtime events to the extension.
- Captures user interactions such as clicks, form submits, and input changes.
- Handles panel messages for UI scans, page context capture, content-script health checks, and agent context extraction.
- Runs the deterministic browser agent workflow for allowed page actions.
- Enforces page-side safety boundaries before actions are executed.

### Popup

`popup/popup.html`, `popup/popup.css`, and `src/popup/main.tsx` provide a small toolbar popup:

- Shows whether a DevTools panel is connected.
- Links to the setup guide.
- Does not own core QA session behavior.

### Optional AI Backend

`ai-backend/` is a separate Node.js service:

- Uses Node.js ESM.
- Provides local AI endpoints and health checks.
- Is not part of the Chrome extension bundle.
- Should remain separate from the React/TypeScript extension migration unless a later prompt explicitly targets backend work.

## Migration Checklist

### Phase 0: Keep Stable

- Keep `manifest.json` as Manifest V3.
- Keep the unpacked extension loading from the project root until a build output strategy is chosen.
- Keep current UI styling visually unchanged during the first migration pass.
- Keep content-script safety checks authoritative for browser actions.
- Keep the local AI backend separate from extension UI build work.

### Phase 1: Add Build Foundation

- Add root package metadata for extension build tooling.
- Add TypeScript configuration for extension code.
- Add a bundler configuration that can output Chrome-loadable files.
- Decide whether the extension will load from `dist/` or keep root-level static files during transition.
- Add a clean development command and a repeatable production build command.
- Add source maps for local debugging if Chrome DevTools debugging remains practical.

### Phase 2: Move UI Surface First

- Convert the DevTools panel UI first because it has the highest UI complexity and the most benefit from React state boundaries.
- Split `src/devtools/panel/panelController.ts` into modules before or during conversion.
- Preserve existing DOM IDs or provide a compatibility layer until all handlers are migrated.
- Keep CSS class names stable at first to avoid visual regression.
- Move `devtools/panel.html` toward a minimal React root while preserving Chrome extension CSP compatibility.

### Phase 3: Type Shared Data Contracts

- Add TypeScript types for session snapshots, settings, issues, findings, AI provider settings, agent events, and report structures.
- Extract redaction, classification, report-building, and storage-shaping helpers into typed modules.
- Add focused tests around pure helpers before changing behavior.

### Phase 4: Migrate Non-UI Scripts Carefully

- Migrate `src/background/service-worker.ts` after the panel has stable shared types.
- Migrate `src/content/content-script.ts` only after agent safety behavior is covered by tests or smoke checks.
- Treat `src/content/injected-console-listener.ts` as a special case because it runs in the page main world and must remain small, dependency-light, and host-page-safe.
- Migrate `popup/` last because it is small and low-risk.

### Phase 5: Verification

- Verify `manifest.json` still loads without errors in `chrome://extensions`.
- Open DevTools and confirm the TestPilot panel is created.
- Start a session, reload the inspected page, and confirm network capture.
- Confirm console/runtime events still flow from the page into the panel.
- Run UI scan from the panel.
- Run an Agent command that only highlights or observes the page.
- Export HTML, JSON, and CSV reports.
- Run existing smoke tests in `tests/` where applicable.

## Files That Need To Move Or Change In Later Steps

### Primary React/TypeScript Migration Targets

- `src/devtools/panel/panelController.ts`
- `devtools/panel.html`
- `devtools/panel.css`

These should become the main React/TypeScript app surface. The CSS can remain mostly intact initially, then be reorganized after behavior is stable.

### Shared Extension Logic Candidates

- Network classification helpers currently inside `src/devtools/panel/panelController.ts`
- Finding normalization and deduplication helpers currently inside `src/devtools/panel/panelController.ts`
- Report builders currently inside `src/devtools/panel/panelController.ts`
- AI provider request helpers currently inside `src/devtools/panel/panelController.ts`
- Agent event formatting and approval helpers currently inside `src/devtools/panel/panelController.ts`
- Storage snapshot shaping currently inside `src/devtools/panel/panelController.ts`

These should move into typed modules only when tests or clear boundaries are added.

### Later Migration Targets

- `src/background/service-worker.ts`
- `src/content/content-script.ts`
- `src/content/injected-console-listener.ts`
- `src/popup/main.tsx`
- `popup/popup.html`
- `popup/popup.css`
- `src/devtools/devtools.ts`
- `devtools/devtools.html`

### Configuration And Tooling To Add Later

- Root `package.json`
- `tsconfig.json`
- Bundler config such as `vite.config.ts`
- Build output directory such as `dist/`
- Static asset copy rules for `manifest.json`, icons, docs, popup, content scripts, and DevTools pages
- Lint, format, and smoke test scripts

## Files That Should Not Be Converted In The First UI Pass

- `ai-backend/src/server.ts`
- `ai-backend/src/scripts/health-check.ts`
- `ai-backend/package.json`
- `docs/*`
- `tests/*`
- `assets/icons/*`

The backend is a separate local Node service. Docs, tests, and icon assets should only change when the build workflow or validation workflow changes.

## Risks Before Implementation

### Chrome Extension CSP

React builds must avoid runtime code generation and remote script loading. The generated bundle must be compatible with Manifest V3 CSP rules.

### DevTools API Access

`chrome.devtools.*` APIs are only available from DevTools pages/panels. Shared modules must not assume those APIs exist in content scripts, popup, or background contexts.

### Content Script Isolation

The injected console listener runs in the page main world, while `src/content/content-script.ts` runs in the extension isolated world. A bundler must not merge these into a single runtime file unless the world boundary remains explicit.

### Agent Safety Boundary

The LLM/provider layer must not directly execute page actions. The content script must remain the final validator and executor for allowed browser actions.

### Storage Compatibility

Current session keys use the `testpilotSession:v4:` and `testpilotSessionBackup:v4:` prefixes. Migration should preserve or explicitly migrate those keys to avoid losing active QA sessions unexpectedly.

### Large File Refactor Risk

`src/devtools/panel/panelController.ts` currently centralizes many unrelated responsibilities. A direct one-shot conversion would be risky. The safer path is to extract typed helpers and React components incrementally.

### Styling Regression Risk

`devtools/panel.css` already defines the current UI language and responsive behavior. The first React pass should reuse existing class names and layout rules to avoid visual drift.

### Build Output Decision

The migration keeps the repo root as the Chrome load folder, with manifest entry points aimed at generated root runtime files.

### Host Permissions And Privacy Claims

The manifest currently includes localhost and several AI provider host permissions. Any migration should keep permission scope intentional and ensure UI/privacy text still matches the actual network behavior.

## Recommended Safe Plan

1. Create the build foundation without changing runtime behavior.
2. Copy current extension assets into a build output and verify the generated extension loads.
3. Migrate the DevTools panel shell to React while preserving the current CSS and user-visible layout.
4. Continue splitting `src/devtools/panel/panelController.ts` into typed modules one responsibility at a time.
5. Add tests around pure classification, redaction, reporting, and storage helpers as they are extracted.
6. Migrate background and content scripts after the shared contracts are stable.
7. Update README installation steps only after the load path changes from root to build output.

## Baseline Verdict

The original extension was a working Manifest V3 plain JavaScript/HTML/CSS Chrome DevTools extension. The migration kept browser-agent execution and safety validation anchored in the content script while moving the source structure to React and TypeScript.
