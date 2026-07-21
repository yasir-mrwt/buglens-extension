import { SidebarToggle } from './SidebarToggle';
import { PageContextBar } from './PageContextBar';

export function PanelShell() {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="../assets/icons/icon48.png" alt="" />
          <div>
            <div className="brand-name">
              <strong>TestPilot</strong>
              <span>v0.4.1</span>
            </div>
            <p>AI QA Agent</p>
          </div>
        </div>
        {/* Sidebar is intentionally hidden to keep QA controls in the top menu only */}
        <div className="sidebar-footer">
          <span className="privacy-dot" aria-hidden="true" />
          <div>
            <strong>Local processing</strong>
            <p>No captured data is uploaded.</p>
          </div>
        </div>
      </aside>
      <section className="workspace">
        <header id="sessionBanner" className="topbar banner idle">
          <div className="topbar-main">
            <div className="session-context">
              <div className="testpilot-header-brand">
                <span className="testpilot-brandmark" aria-hidden="true">↗</span>
                <strong>TestPilot</strong>
                <span id="testPilotCurrentView" className="testpilot-current-view" aria-label="Main Chat">
                  <span data-view-title="ai">Main Chat</span>
                  <span data-view-title="dashboard">Dashboard</span>
                  <span data-view-title="findings">Network / Findings</span>
                  <span data-view-title="console">Console</span>
                  <span data-view-title="ui">UI Bugs</span>
                  <span data-view-title="test-cases">Test Cases</span>
                  <span data-view-title="bug-reports">Bug Reports</span>
                  <span data-view-title="reports">Reports</span>
                  <span data-view-title="settings">Settings</span>
                </span>
              </div>
              <div className="session-title-row">
                <span id="sessionDot" className="status-dot" aria-hidden="true" />
                <strong id="sessionStatus">Not Started</strong>
                <span className="separator" aria-hidden="true" />
                <span id="sessionDuration">00:00</span>
              </div>
              <PageContextBar />
              <p id="sessionHint">Start a session, then reload the page for complete network coverage.</p>
            </div>
            <SidebarToggle>
                <button role="menuitem" data-tab="ai">Main Chat</button>
                <details className="qa-menu-group">
                  <summary>QA Tools</summary>
                  <button type="button" data-qa-action="generate-test-cases">
                    <svg className="qa-menu-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1" /></svg>
                    <span>Generate Test Cases</span>
                  </button>
                  <button type="button" data-qa-action="generate-bug-report">
                    <svg className="qa-menu-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7" /></svg>
                    <span>Generate Bug Report</span>
                  </button>
                  <button type="button" data-qa-action="accessibility">
                    <svg className="qa-menu-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx={12} cy={5} r={2} /><path d="M5 10h14M12 7v7M8 22l4-8 4 8" /></svg>
                    <span>Accessibility / UI Scan</span>
                  </button>
                </details>
                <button role="menuitem" data-tab="dashboard">Dashboard</button>
                <button role="menuitem" data-tab="findings">Network / Findings</button>
                <button role="menuitem" data-tab="console">Console</button>
                <button role="menuitem" data-tab="ui">UI Bugs</button>
                <button role="menuitem" data-tab="test-cases">Test Cases</button>
                <button role="menuitem" data-tab="bug-reports">Bug Reports</button>
                <button role="menuitem" data-tab="reports">Reports</button>
                <button role="menuitem" data-tab="settings">Settings</button>
            </SidebarToggle>
            <nav className="top-workflow-tabs" aria-label="Quick sections">
              <button type="button" data-shortcut-tab="dashboard">Dashboard</button>
              <button type="button" data-shortcut-tab="findings">Findings</button>
              <button type="button" data-shortcut-tab="ui">UI Bugs</button>
              <button type="button" data-shortcut-tab="ai">Main Chat</button>
              <button type="button" data-shortcut-tab="test-cases">Test Cases</button>
              <button type="button" data-shortcut-tab="bug-reports">Bug Reports</button>
              <button type="button" data-shortcut-tab="reports">Reports</button>
            </nav>
          </div>
          <div className="actions" aria-label="Session actions">
            <button id="startBtn" className="primary">Start</button>
            <button id="stopBtn" disabled>Stop</button>
            <button id="clearBtn" className="danger-quiet">Clear</button>
            <button id="quickExportBtn">Export</button>
          </div>
        </header>
        <div id="toastRegion" className="toast-region" role="status" aria-live="polite" aria-atomic="true" />
        <main className="content">
          <header className="page-heading dashboard-only">
            <div>
              <p className="eyebrow">Session overview</p>
              <h1>QA Dashboard</h1>
              <p>Understand page health, confirmed findings, and capture coverage at a glance.</p>
            </div>
          </header>
          <section className="dashboard-layout dashboard-only">
            <article className="health-card">
              <div className="health-card-header">
                <div>
                  <span className="eyebrow">QA health</span>
                  <h2 id="healthLabel">Excellent</h2>
                </div>
                <span className="health-score-badge"><strong id="healthScore">100</strong>/100</span>
              </div>
              <div id="healthMeter" className="health-meter" style={{ '--score': 100 } as React.CSSProperties} aria-hidden="true">
                <span />
              </div>
              <p id="healthSummary">Framework observations do not reduce this score.</p>
              <div className="health-breakdown">
                <span><strong id="healthActionableMetric">0</strong> Actionable</span>
                <span><strong id="healthReviewMetric">0</strong> Review</span>
                <span><strong id="healthNoiseMetric">0</strong> Noise</span>
              </div>
            </article>
            <article className="guidance-card">
              <div className="guidance-copy">
                <span className="eyebrow">Recommended next step</span>
                <h2 id="dashboardGuidanceTitle">Start a focused QA session</h2>
                <p id="dashboardGuidance">Capture one page or user flow at a time for a cleaner report.</p>
              </div>
              <span className="next-step-chip">Next best action</span>
              <div className="guidance-actions">
                <button id="viewPriorityBtn" className="primary">Review Findings</button>
                <button id="uiScanBtn">Run UI Scan</button>
                <button id="viewAiBtn">Analyze with AI</button>
                <button id="viewReportsBtn">Open Reports</button>
                <button id="quickCopyBtn">Copy Summary</button>
              </div>
            </article>
          </section>
          <section className="summary-grid dashboard-only">
            <article className="summary-card actionable"><span>Actionable Issues</span><strong id="actionableCount">0</strong><small>Confirmed user impact</small></article>
            <article className="summary-card review"><span>Needs Review</span><strong id="reviewCount">0</strong><small>Manual confirmation</small></article>
            <article className="summary-card framework"><span>Noise / Ignored</span><strong id="frameworkCount">0</strong><small>Not counted as issues</small></article>
            <article className="summary-card console"><span>Console Status</span><strong id="consoleErrorCount">0</strong><small>Errors observed</small></article>
            <article className="summary-card scan"><span>UI Scan</span><strong id="uiScanSummary">Ready</strong><small>Manual visual checks</small></article>
            <article className="summary-card ai"><span>AI Assistant</span><strong id="aiStatusSummary">Off</strong><small>Optional local analysis</small></article>
          </section>
          <section className="capture-grid dashboard-only" aria-label="Capture status">
            <article><span className="capture-icon">N</span><div><span>Network capture</span><strong id="networkStatus">Not started</strong></div></article>
            <article><span className="capture-icon">C</span><div><span>Console capture</span><strong id="consoleStatus">Checking</strong></div></article>
            <article><span className="capture-icon">U</span><div><span>UI scanner</span><strong id="uiStatus">Ready</strong></div></article>
            <article><span className="capture-icon">T</span><div><span>Last update</span><strong id="lastUpdated">Never</strong></div></article>
          </section>
          <header className="page-heading findings-only">
            <div>
              <p className="eyebrow">Unified review</p>
              <h1>Findings</h1>
              <p>Review actionable items, manual-review observations, and noise in one filtered list.</p>
            </div>
          </header>
          <section className="api-breakdown findings-only">
            <article><span>Business APIs</span><strong id="businessApiCount">0</strong><small>Application endpoints</small></article>
            <article><span>Framework/Internal</span><strong id="frameworkRequestCount">0</strong><small>RSC and prefetch</small></article>
            <article><span>Static Assets</span><strong id="staticRequestCount">0</strong><small>Scripts and media</small></article>
            <article><span>Documents</span><strong id="documentRequestCount">0</strong><small>Pages and navigation</small></article>
            <article><span>Passed Requests</span><strong id="passedRequestCount">0</strong><small>Successful responses</small></article>
          </section>
          <aside className="info-callout findings-only">
            <div>
              <strong>Framework traffic is hidden by default</strong>
              <p>Next.js route-data observations remain available through the Category filter and do not affect QA health.</p>
            </div>
          </aside>
          <header className="page-heading console-only">
            <div>
              <p className="eyebrow">Runtime quality</p>
              <h1>Console</h1>
              <p>Review page errors, warnings, rejected promises, and repeated runtime messages.</p>
            </div>
          </header>
          <section className="console-overview console-only">
            <article><span>Errors</span><strong id="consoleErrorMetric">0</strong><small>console.error and runtime failures</small></article>
            <article><span>Warnings</span><strong id="consoleWarningMetric">0</strong><small>console.warn messages</small></article>
            <article><span>Repeated</span><strong id="consoleRepeatedMetric">0</strong><small>Grouped duplicate messages</small></article>
          </section>
          <header className="page-heading ui-only">
            <div>
              <p className="eyebrow">Visual quality</p>
              <h1>UI Scan</h1>
              <p>Run focused checks on the visible screen and manually confirm uncertain visual observations.</p>
            </div>
          </header>
          <section className="ui-scan-overview ui-only">
            <article><span>Last scan</span><strong id="uiLastScan">Not run</strong><small id="uiScanMetrics">No scan completed</small></article>
            <article><span>Elements scanned</span><strong id="uiScannedCount">0</strong><small>Visible DOM nodes</small></article>
            <article><span>Skipped</span><strong id="uiSkippedCount">0</strong><small>Outside scan scope</small></article>
            <article><span>Viewport</span><strong id="uiViewportMetric">Unknown</strong><small>Current inspected page</small></article>
            <article><span>Ignored decoration</span><strong id="uiIgnoredCount">0</strong><small>Background and decorative layers</small></article>
          </section>
          <aside className="info-callout ui-only">
            <div>
              <strong>Visual checks require tester judgment</strong>
              <p>Open a finding to see why it was flagged, possible false-positive context, and what to verify manually.</p>
            </div>
          </aside>
          <section className="toolbar findings-only">
            <label>
              Type
              <select id="typeFilter">
                <option value="all">All types</option>
                <option value="api">API</option>
                <option value="console">Console</option>
                <option value="ui">UI</option>
                <option value="noise">Noise</option>
              </select>
            </label>
            <label>
              Category
              <select id="categoryFilter">
                <option value="counted">Actionable + Needs Review</option>
                <option value="actionable">Actionable Only</option>
                <option value="needs-review">Needs Review</option>
                <option value="framework-noise">Framework Noise</option>
                <option value="informational">Informational</option>
                <option value="passed">Passed</option>
                <option value="all">All Findings</option>
              </select>
            </label>
            <label>
              Severity
              <select id="severityFilter">
                <option value="all">All severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="info">Info</option>
              </select>
            </label>
            <label className="search-label">
              Search findings
              <input id="searchInput" type="search" placeholder="Search URL, title, message, or selector" />
            </label>
            <button id="resetFiltersBtn" className="toolbar-button">Reset</button>
          </section>
          <section id="findingsPanel" className="issues-panel findings-only">
            <div className="panel-head">
              <div>
                <h2 id="findingsHeading">Priority Findings</h2>
                <p>Open a row for technical evidence and filing guidance.</p>
              </div>
              <span id="issueCountText">0 findings</span>
            </div>
            <div id="emptyState" className="empty-state">
              <span id="emptyIcon" className="empty-icon neutral" aria-hidden="true">i</span>
              <strong>No findings yet</strong>
              <p>Start a session, reload the page, perform your QA flow, then run a UI scan.</p>
            </div>
            <div id="issuesList" className="issues-list" />
          </section>
          <section className="ai-panel ai-only testpilot-chat-panel">
            <article className="testpilot-chat-card">
              <header className="testpilot-chat-head">
                <div className="testpilot-chat-copy">
                  <div className="testpilot-chat-title-row">
                    <h1>AI QA Agent</h1>
                    <div className="testpilot-mode-toggle" aria-label="Chat mode">
                      <button id="testPilotChatModeBtn" className="active" type="button">Chat</button>
                      <button id="testPilotAgentModeBtn" type="button">Agent</button>
                    </div>
                    <div className="testpilot-live-status" aria-live="polite">
                      <span id="aiStatusPill" className="status-pill">Checking</span>
                      <button id="checkAiBtn" className="testpilot-retry-ai hidden" type="button" aria-label="Retry local AI connection">↻</button>
                    </div>
                  </div>
                </div>
              </header>
              <div id="aiChatMessages" className="testpilot-chat-messages" aria-live="polite">
                <div className="testpilot-empty-chat">Tell TestPilot what to test on this page.</div>
              </div>
              <form id="aiChatForm" className="testpilot-composer">
                <textarea id="aiChatInput" rows={2} placeholder="Ask about this QA session..." defaultValue={""} />
                <button id="sendAiChatBtn" className="primary testpilot-send" type="submit" aria-label="Send">➤</button>
              </form>
            </article>
          </section>
          <header className="page-heading test-cases-only">
            <div>
              <p className="eyebrow">Generated QA coverage</p>
              <h1>Test Cases</h1>
              <p>Generate, copy, and export scenarios from current page context, findings, and latest Agent evidence.</p>
            </div>
          </header>
          <section className="test-cases-panel test-cases-only">
            <article className="test-cases-controls">
              <label>
                Test type
                <select id="testCaseTypeSelect">
                  <option>All Types</option>
                  <option>Functional</option>
                  <option>Negative</option>
                  <option>Edge Cases</option>
                  <option>Regression</option>
                  <option>Smoke</option>
                </select>
              </label>
              <label>
                Format
                <select id="testCaseFormatSelect">
                  <option>Step-by-step</option>
                  <option>Gherkin</option>
                  <option>Markdown table</option>
                </select>
              </label>
              <div className="test-cases-actions">
                <button id="generateTestCasesTabBtn" className="primary" type="button">Generate</button>
                <button id="copyTestCasesBtn" type="button">Copy</button>
                <button id="exportTestCasesMarkdownBtn" type="button">Export Markdown</button>
                <button id="clearTestCasesBtn" type="button">Clear</button>
              </div>
            </article>
            <div id="testCasesStatus" className="test-cases-status">No generated test cases yet.</div>
            <div id="testCasesOutput" className="test-cases-output empty">
              <strong>Ready to generate</strong>
              <p>Start a session and run Agent or manual QA first for richer, page-specific test cases.</p>
            </div>
          </section>
          <header className="page-heading bug-reports-only">
            <div>
              <p className="eyebrow">Generated defect drafts</p>
              <h1>Bug Reports</h1>
              <p>Generate clean, evidence-based bug drafts from confirmed findings and latest Agent results.</p>
            </div>
          </header>
          <section className="bug-reports-panel bug-reports-only">
            <article className="bug-reports-controls">
              <div>
                <span className="eyebrow">Draft controls</span>
                <h2>Bug report generator</h2>
                <p>Use this panel for AI-assisted bug drafts. Use Reports for full session exports.</p>
              </div>
              <div className="bug-reports-actions">
                <button id="generateBugReportTabBtn" className="primary" type="button">Generate</button>
                <button id="copyBugReportDraftsBtn" type="button">Copy</button>
                <button id="exportBugReportMarkdownBtn" type="button">Export Markdown</button>
                <button id="exportBugReportJsonBtn" type="button">Export JSON</button>
                <button id="clearBugReportsBtn" type="button">Clear</button>
              </div>
            </article>
            <div id="bugReportsStatus" className="bug-reports-status">No generated bug reports yet.</div>
            <div id="bugReportsOutput" className="bug-reports-output empty">
              <strong>Ready to draft</strong>
              <p>Capture findings or run Agent first, then generate bug reports from real evidence.</p>
            </div>
          </section>
          <header className="page-heading reports-only">
            <div>
              <p className="eyebrow">Shareable evidence</p>
              <h1>Reports</h1>
              <p>Choose the format that best fits review, tracking, or developer debugging.</p>
            </div>
            <span className="privacy-pill">Redacted locally</span>
          </header>
          <section className="report-summary-grid reports-only">
            <article><span>QA health</span><strong id="reportHealth">100/100</strong></article>
            <article><span>Actionable</span><strong id="reportActionable">0</strong></article>
            <article><span>Needs review</span><strong id="reportReview">0</strong></article>
            <article><span>Captured routes</span><strong id="reportRoutes">0</strong></article>
          </section>
          <section className="report-panel reports-only">
            <div id="reportPreview" className="report-preview" />
            <article className="report-builder">
              <div className="report-builder-head">
                <div>
                  <span className="eyebrow">Report builder</span>
                  <h2>Ready-to-file bug draft</h2>
                  <p>Edit the draft before copying it into Jira, Linear, Slack, or a QA handoff.</p>
                </div>
                <div className="report-builder-actions">
                  <button id="refreshReportBuilderBtn" type="button">Refresh Draft</button>
                  <button id="copyReportBuilderBtn" type="button">Copy Draft</button>
                  <button id="downloadReportBuilderBtn" type="button">Export Markdown</button>
                </div>
              </div>
              <div className="report-builder-grid">
                <label>Title<input id="reportBuilderTitle" type="text" placeholder="No confirmed defect selected yet" /></label>
                <label>Severity<select id="reportBuilderSeverity"><option>needs review</option><option>critical</option><option>high</option><option>medium</option><option>low</option></select></label>
                <label>Status<select id="reportBuilderStatus"><option>needs review</option><option>confirmed</option><option>ignored</option></select></label>
                <label className="wide-field">Summary<textarea id="reportBuilderSummary" rows={3} placeholder="Short defect summary" defaultValue={""} /></label>
                <label className="wide-field">Steps to reproduce<textarea id="reportBuilderSteps" rows={5} placeholder="1. Open the tested page..." defaultValue={""} /></label>
                <label className="wide-field">Expected result<textarea id="reportBuilderExpected" rows={2} placeholder="What should happen" defaultValue={""} /></label>
                <label className="wide-field">Actual result<textarea id="reportBuilderActual" rows={2} placeholder="What happened instead" defaultValue={""} /></label>
                <label className="wide-field">Evidence<textarea id="reportBuilderEvidence" rows={4} placeholder="Sanitized TestPilot evidence" defaultValue={""} /></label>
              </div>
            </article>
            <div className="export-grid">
              <article className="export-card">
                <span className="file-type">HTML</span>
                <div><h2>HTML Report</h2><p>Best for sharing a readable QA review with teams and managers.</p></div>
                <button id="exportHtmlBtn" className="primary">Download HTML</button>
              </article>
              <article className="export-card">
                <span className="file-type">CSV</span>
                <div><h2>CSV for Google Sheets</h2><p>Best for QA tracking with concise evidence and recommendation columns.</p></div>
                <button id="exportCsvBtn">Download CSV</button>
              </article>
              <article className="export-card">
                <span className="file-type">JSON</span>
                <div><h2>JSON Report</h2><p>Best for developers, automation, and complete machine-readable evidence.</p></div>
                <button id="exportJsonBtn">Download JSON</button>
              </article>
              <article className="export-card">
                <span className="file-type">TEXT</span>
                <div><h2>Copy QA Summary</h2><p>Best for a quick update in Slack, Jira, Linear, or a pull request.</p></div>
                <button id="copyReportBtn">Copy Summary</button>
              </article>
              <article className="export-card ai-export-card">
                <span className="file-type">AI</span>
                <div><h2>AI Artifacts</h2><p>Download generated test cases, bug drafts, or analysis for QA handoff.</p></div>
                <div className="export-card-actions">
                  <button id="downloadAiMarkdownReportBtn">Markdown</button>
                  <button id="downloadAiJsonReportBtn">JSON</button>
                </div>
              </article>
            </div>
            <p className="privacy-note">Exports are generated on this device. Sensitive values are redacted before report creation.</p>
          </section>
          <header className="page-heading settings-only">
            <div>
              <p className="eyebrow">Configuration</p>
              <h1>Settings</h1>
              <p>Adjust capture, filtering, UI scan, and report behavior without changing the privacy model.</p>
            </div>
            <button id="resetSettingsBtn">Reset Defaults</button>
          </header>
          <section className="settings-panel settings-only">
            <fieldset>
              <legend>Capture</legend>
              <p className="group-description">Control optional evidence capture. Redaction and temporary storage remain enabled.</p>
              <div className="settings-grid">
                <label className="setting-row">
                  <span><strong>Response body capture</strong><small>Store short redacted response snippets when Chrome makes them available.</small></span>
                  <input id="captureResponseBody" type="checkbox" />
                </label>
                <div className="setting-row readonly-setting">
                  <span><strong>Sensitive-data redaction</strong><small>Authorization, cookies, tokens, and secrets are removed.</small></span>
                  <span className="status-pill success">Enabled</span>
                </div>
                <div className="setting-row readonly-setting">
                  <span><strong>Session-only evidence</strong><small>Captured results are not stored as long-term browser history.</small></span>
                  <span className="status-pill success">Enabled</span>
                </div>
              </div>
            </fieldset>
            <fieldset>
              <legend>API thresholds</legend>
              <p className="group-description">Tune performance and duplicate-call rules for your application.</p>
              <div className="settings-grid numeric-grid">
                <label>Slow API threshold<input id="slowApiMs" type="number" min={100} step={100} defaultValue={1000} /><span>ms</span></label>
                <label>Very slow threshold<input id="verySlowApiMs" type="number" min={500} step={100} defaultValue={3000} /><span>ms</span></label>
                <label>Duplicate window<input id="duplicateWindowMs" type="number" min={100} step={100} defaultValue={2000} /><span>ms</span></label>
                <label>Response preview limit<input id="maxBodyPreviewBytes" type="number" min={1000} max={20000} step={1000} defaultValue={10000} /><span>bytes</span></label>
              </div>
            </fieldset>
            <fieldset>
              <legend>AI Provider</legend>
              <p className="group-description">Choose a local model or your own provider key. API keys stay in Chrome local storage and are never sent to inspected pages.</p>
              <div className="settings-grid ai-provider-grid">
                <label className="setting-row ai-provider-field">
                  <span><strong>Provider</strong><small>Most hosted providers only need an API key. Model stays on Auto by default.</small></span>
                  <select id="aiProviderSelect">
                    <option value="local-backend">Local Backend</option>
                    <option value="ollama-direct">Ollama Direct</option>
                    <option value="openai">OpenAI</option>
                    <option value="grok">Grok / xAI</option>
                    <option value="gemini">Gemini</option>
                    <option value="anthropic">Anthropic Claude</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="together">Together AI</option>
                    <option value="mistral">Mistral</option>
                    <option value="custom-openai-compatible">Custom OpenAI-Compatible API</option>
                    <option value="custom-api">Custom API</option>
                  </select>
                </label>
                <label className="setting-row ai-provider-field">
                  <span><strong>API Key</strong><small id="aiApiKeyHelp">Not required for Local Backend.</small></span>
                  <input id="aiApiKeyInput" type="password" autoComplete="off" placeholder="No API key required" />
                </label>
                <div className="setting-row readonly-setting">
                  <span><strong>Connection Status</strong><small id="aiProviderStatusText">Provider has not been checked yet.</small></span>
                  <span id="aiProviderStatusPill" className="status-pill">Not Configured</span>
                </div>
                <div className="setting-row ai-provider-actions">
                  <span><strong>Provider Actions</strong><small>Use a tiny test prompt. No page context is sent.</small></span>
                  <div>
                    <button id="testAiProviderBtn" type="button">Test Connection</button>
                    <button id="clearAiApiKeyBtn" type="button">Clear API Key</button>
                  </div>
                </div>
                <div className="setting-row readonly-setting">
                  <span><strong>Payload safety</strong><small>Only sanitized summaries are sent. Raw headers, bodies, cookies, and tokens are excluded.</small></span>
                  <span className="status-pill success">Enabled</span>
                </div>
              </div>
              <details className="advanced-settings">
                <summary>Advanced Settings</summary>
                <div className="settings-grid numeric-grid settings-subgrid">
                  <label className="wide-field">Base URL<input id="aiBaseUrlInput" type="url" placeholder="Auto / provider default" /><small>Required for Custom API providers. Leave blank for provider defaults.</small></label>
                  <label>Model mode<select id="aiModelModeSelect"><option value="auto">Auto / Recommended</option><option value="custom">Custom</option></select></label>
                  <label>Model override<input id="aiModelInput" type="text" placeholder="Auto / Recommended" /></label>
                  <label>Context mode<select id="aiContextModeSelect"><option value="fast">Fast</option><option value="balanced">Balanced</option><option value="deep">Deep</option></select></label>
                  <label>Temperature<input id="aiTemperatureInput" type="number" min={0} max={2} step="0.1" defaultValue="0.2" /></label>
                  <label>Max tokens<input id="aiMaxTokensInput" type="number" min={32} max={12000} step={32} defaultValue={900} /></label>
                </div>
              </details>
            </fieldset>
            <fieldset>
              <legend>Filtering</legend>
              <p className="group-description">Keep speculative framework behavior separate from confirmed application defects.</p>
              <div className="settings-grid">
                <label className="setting-row"><span><strong>Hide framework noise by default</strong><small>Keep Next.js route-data observations out of the main finding list.</small></span><input id="hideFrameworkNoise" type="checkbox" defaultChecked /></label>
                <label className="setting-row"><span><strong>Show Next.js prefetch findings</strong><small>Make framework route-data observations visible in normal filtering.</small></span><input id="showNextPrefetchFindings" type="checkbox" /></label>
                <label className="setting-row"><span><strong>Treat matching prefetch failures as review items</strong><small>Promote framework traffic only when related failure evidence exists.</small></span><input id="treatFrameworkPrefetchAsIssue" type="checkbox" /></label>
              </div>
            </fieldset>
            <fieldset>
              <legend>UI Scan</legend>
              <p className="group-description">Keep scans bounded and focused on visible, user-relevant interface elements.</p>
              <div className="settings-grid">
                <label className="setting-row"><span><strong>Visible viewport only</strong><small>Ignore content that is currently outside the tester's screen.</small></span><input id="uiVisibleViewportOnly" type="checkbox" defaultChecked /></label>
                <label className="setting-row"><span><strong>Include decorative elements</strong><small>Also inspect backgrounds, canvases, and non-interactive decoration.</small></span><input id="uiIncludeDecorativeElements" type="checkbox" /></label>
              </div>
              <div className="settings-grid numeric-grid settings-subgrid">
                <label>Maximum UI nodes<input id="maxUiNodes" type="number" min={500} max={10000} step={500} defaultValue={4000} /></label>
                <label>Findings per rule<input id="maxIssuesPerRule" type="number" min={1} max={100} defaultValue={25} /></label>
                <label className="wide-field">Allowed color tokens<textarea id="allowedColors" placeholder="#000000
    #ffffff
    #2563eb" defaultValue={""} /><small>Optional. Enter one CSS color per line.</small></label>
              </div>
            </fieldset>
            <fieldset>
              <legend>Reports</legend>
              <p className="group-description">Choose which observations and export formats are available.</p>
              <div className="settings-grid">
                <label className="setting-row"><span><strong>Include framework noise</strong><small>Keep framework observations in exported evidence without counting them as issues.</small></span><input id="exportFrameworkNoise" type="checkbox" defaultChecked /></label>
                <label className="setting-row"><span><strong>Enable CSV export</strong><small>Allow spreadsheet-friendly report downloads for Google Sheets.</small></span><input id="csvExportEnabled" type="checkbox" defaultChecked /></label>
              </div>
            </fieldset>
            <div className="settings-footer">
              <p>Changes are stored locally as extension preferences.</p>
              <button id="saveSettingsBtn" className="primary">Save Settings</button>
            </div>
          </section>
          <section className="compatibility-hooks" hidden aria-hidden="true">
            <h2 id="aiStatusTitle">Local AI: Not checked</h2>
            <p id="aiStatusText">Start ai-backend with npm start. TestPilot checks the connection automatically.</p>
            <input id="aiBackendUrl" type="url" defaultValue="http://localhost:8787" />
            <pre id="aiConnectionLog">Backend not checked yet.</pre>
            <div id="aiOutput" className="empty" />
            <button id="analyzeAiBtn" type="button">Analyze Session</button>
            <button id="generateTestsBtn" type="button">Generate Test Cases</button>
            <button id="generateBugsBtn" type="button">Generate Bug Report</button>
            <button id="copyAiSummaryBtn" type="button">Copy AI Summary</button>
            <button id="downloadAiMarkdownBtn" type="button">Download AI Markdown</button>
            <button id="downloadAiJsonBtn" type="button">Download AI JSON</button>
            <label>
              Include AI summary
              <input id="includeAiSummaryInReport" type="checkbox" />
            </label>
            <div id="testPilotAgentNotice" />
            <div id="testPilotAgentCommands" />
          </section>
        </main>
      </section>
    </div>
  );
}
