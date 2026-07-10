import { r as requireReactDom, j as jsxRuntimeExports, c as clientExports, a as reactExports } from "./client.js";
var reactDomExports = requireReactDom();
function PanelShell() {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "app-layout", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("aside", { className: "sidebar", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "sidebar-brand", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: "../assets/icons/icon48.png", alt: "" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "brand-name", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "TestPilot" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "v0.4.1" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "AI QA Agent" })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "sidebar-footer", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "privacy-dot", "aria-hidden": "true" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Local processing" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "No captured data is uploaded." })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "workspace", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { id: "sessionBanner", className: "topbar banner idle", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "topbar-main", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "session-context", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "testpilot-header-brand", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "testpilot-brandmark", "aria-hidden": "true", children: "↗" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "TestPilot" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { id: "testPilotCurrentView", className: "testpilot-current-view", "aria-label": "Main Chat", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "data-view-title": "ai", children: "Main Chat" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "data-view-title": "dashboard", children: "Dashboard" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "data-view-title": "findings", children: "Network / Findings" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "data-view-title": "console", children: "Console" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "data-view-title": "ui", children: "UI Bugs" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "data-view-title": "test-cases", children: "Test Cases" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "data-view-title": "bug-reports", children: "Bug Reports" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "data-view-title": "reports", children: "Reports" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "data-view-title": "settings", children: "Settings" })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "session-title-row", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { id: "sessionDot", className: "status-dot", "aria-hidden": "true" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "sessionStatus", children: "Not Started" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "separator", "aria-hidden": "true" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { id: "sessionDuration", children: "00:00" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "current-url", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Current page" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "currentUrl", children: "Checking..." })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { id: "sessionHint", children: "Start a session, then reload the page for complete network coverage." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "qa-menu-bar", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { id: "menuToggleBtn", className: "menu-toggle", "aria-expanded": "false", "aria-controls": "workspaceNav", type: "button", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "menu-toggle-icon", viewBox: "0 0 24 24", "aria-hidden": "true", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M5 6h14M5 12h14M5 18h14" }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "menu-toggle-label", children: "Menu" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("nav", { id: "workspaceNav", className: "qa-menu", role: "menu", "aria-label": "QA tool sections", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "qa-menu-head", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "TestPilot Menu" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Open manual QA panels or run focused tools." })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "menuCloseBtn", className: "qa-menu-close", type: "button", "aria-label": "Close menu", children: "×" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { role: "menuitem", "data-tab": "ai", children: "Main Chat" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("details", { className: "qa-menu-group", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("summary", { children: "QA Tools" }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", "data-qa-action": "generate-test-cases", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "qa-menu-icon", viewBox: "0 0 24 24", "aria-hidden": "true", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1" }) }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Generate Test Cases" })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", "data-qa-action": "generate-bug-report", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("svg", { className: "qa-menu-icon", viewBox: "0 0 24 24", "aria-hidden": "true", children: /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7" }) }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Generate Bug Report" })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { type: "button", "data-qa-action": "accessibility", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { className: "qa-menu-icon", viewBox: "0 0 24 24", "aria-hidden": "true", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("circle", { cx: 12, cy: 5, r: 2 }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M5 10h14M12 7v7M8 22l4-8 4 8" })
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Accessibility / UI Scan" })
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { role: "menuitem", "data-tab": "dashboard", children: "Dashboard" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { role: "menuitem", "data-tab": "findings", children: "Network / Findings" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { role: "menuitem", "data-tab": "console", children: "Console" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { role: "menuitem", "data-tab": "ui", children: "UI Bugs" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { role: "menuitem", "data-tab": "test-cases", children: "Test Cases" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { role: "menuitem", "data-tab": "bug-reports", children: "Bug Reports" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { role: "menuitem", "data-tab": "reports", children: "Reports" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { role: "menuitem", "data-tab": "settings", children: "Settings" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("nav", { className: "top-workflow-tabs", "aria-label": "Quick sections", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", "data-shortcut-tab": "dashboard", children: "Dashboard" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", "data-shortcut-tab": "findings", children: "Findings" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", "data-shortcut-tab": "ui", children: "UI Bugs" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", "data-shortcut-tab": "ai", children: "Main Chat" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", "data-shortcut-tab": "test-cases", children: "Test Cases" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", "data-shortcut-tab": "bug-reports", children: "Bug Reports" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", "data-shortcut-tab": "reports", children: "Reports" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "actions", "aria-label": "Session actions", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "startBtn", className: "primary", children: "Start" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "stopBtn", disabled: true, children: "Stop" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "clearBtn", className: "danger-quiet", children: "Clear" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "quickExportBtn", children: "Export" })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { id: "toastRegion", className: "toast-region", role: "status", "aria-live": "polite", "aria-atomic": "true" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("main", { className: "content", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("header", { className: "page-heading dashboard-only", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "eyebrow", children: "Session overview" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "QA Dashboard" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Understand page health, confirmed findings, and capture coverage at a glance." })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "dashboard-layout dashboard-only", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { className: "health-card", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "health-card-header", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "eyebrow", children: "QA health" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { id: "healthLabel", children: "Excellent" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "health-score-badge", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "healthScore", children: "100" }),
                "/100"
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { id: "healthMeter", className: "health-meter", style: { "--score": 100 }, "aria-hidden": "true", children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", {}) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { id: "healthSummary", children: "Framework observations do not reduce this score." }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "health-breakdown", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "healthActionableMetric", children: "0" }),
                " Actionable"
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "healthReviewMetric", children: "0" }),
                " Review"
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "healthNoiseMetric", children: "0" }),
                " Noise"
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { className: "guidance-card", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "guidance-copy", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "eyebrow", children: "Recommended next step" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { id: "dashboardGuidanceTitle", children: "Start a focused QA session" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { id: "dashboardGuidance", children: "Capture one page or user flow at a time for a cleaner report." })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "next-step-chip", children: "Next best action" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "guidance-actions", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "viewPriorityBtn", className: "primary", children: "Review Findings" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "uiScanBtn", children: "Run UI Scan" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "viewAiBtn", children: "Analyze with AI" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "viewReportsBtn", children: "Open Reports" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "quickCopyBtn", children: "Copy Summary" })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "summary-grid dashboard-only", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { className: "summary-card actionable", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Actionable Issues" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "actionableCount", children: "0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Confirmed user impact" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { className: "summary-card review", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Needs Review" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "reviewCount", children: "0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Manual confirmation" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { className: "summary-card framework", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Noise / Ignored" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "frameworkCount", children: "0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Not counted as issues" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { className: "summary-card console", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Console Status" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "consoleErrorCount", children: "0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Errors observed" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { className: "summary-card scan", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "UI Scan" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "uiScanSummary", children: "Ready" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Manual visual checks" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { className: "summary-card ai", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "AI Assistant" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "aiStatusSummary", children: "Off" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Optional local analysis" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "capture-grid dashboard-only", "aria-label": "Capture status", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "capture-icon", children: "N" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Network capture" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "networkStatus", children: "Not started" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "capture-icon", children: "C" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Console capture" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "consoleStatus", children: "Checking" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "capture-icon", children: "U" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "UI scanner" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "uiStatus", children: "Ready" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "capture-icon", children: "T" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Last update" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "lastUpdated", children: "Never" })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("header", { className: "page-heading findings-only", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "eyebrow", children: "Unified review" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "Findings" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Review actionable items, manual-review observations, and noise in one filtered list." })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "api-breakdown findings-only", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Business APIs" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "businessApiCount", children: "0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Application endpoints" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Framework/Internal" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "frameworkRequestCount", children: "0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "RSC and prefetch" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Static Assets" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "staticRequestCount", children: "0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Scripts and media" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Documents" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "documentRequestCount", children: "0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Pages and navigation" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Passed Requests" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "passedRequestCount", children: "0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Successful responses" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("aside", { className: "info-callout findings-only", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Framework traffic is hidden by default" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Next.js route-data observations remain available through the Category filter and do not affect QA health." })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("header", { className: "page-heading console-only", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "eyebrow", children: "Runtime quality" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "Console" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Review page errors, warnings, rejected promises, and repeated runtime messages." })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "console-overview console-only", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Errors" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "consoleErrorMetric", children: "0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "console.error and runtime failures" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Warnings" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "consoleWarningMetric", children: "0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "console.warn messages" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Repeated" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "consoleRepeatedMetric", children: "0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Grouped duplicate messages" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("header", { className: "page-heading ui-only", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "eyebrow", children: "Visual quality" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "UI Scan" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Run focused checks on the visible screen and manually confirm uncertain visual observations." })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "ui-scan-overview ui-only", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Last scan" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "uiLastScan", children: "Not run" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("small", { id: "uiScanMetrics", children: "No scan completed" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Elements scanned" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "uiScannedCount", children: "0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Visible DOM nodes" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Skipped" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "uiSkippedCount", children: "0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Outside scan scope" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Viewport" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "uiViewportMetric", children: "Unknown" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Current inspected page" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Ignored decoration" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "uiIgnoredCount", children: "0" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Background and decorative layers" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("aside", { className: "info-callout ui-only", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Visual checks require tester judgment" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Open a finding to see why it was flagged, possible false-positive context, and what to verify manually." })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "toolbar findings-only", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
            "Type",
            /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { id: "typeFilter", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "all", children: "All types" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "api", children: "API" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "console", children: "Console" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "ui", children: "UI" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "noise", children: "Noise" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
            "Category",
            /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { id: "categoryFilter", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "counted", children: "Actionable + Needs Review" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "actionable", children: "Actionable Only" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "needs-review", children: "Needs Review" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "framework-noise", children: "Framework Noise" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "informational", children: "Informational" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "passed", children: "Passed" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "all", children: "All Findings" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
            "Severity",
            /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { id: "severityFilter", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "all", children: "All severities" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "critical", children: "Critical" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "high", children: "High" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "medium", children: "Medium" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "low", children: "Low" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "info", children: "Info" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "search-label", children: [
            "Search findings",
            /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "searchInput", type: "search", placeholder: "Search URL, title, message, or selector" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "resetFiltersBtn", className: "toolbar-button", children: "Reset" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { id: "findingsPanel", className: "issues-panel findings-only", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "panel-head", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { id: "findingsHeading", children: "Priority Findings" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Open a row for technical evidence and filing guidance." })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { id: "issueCountText", children: "0 findings" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { id: "emptyState", className: "empty-state", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { id: "emptyIcon", className: "empty-icon neutral", "aria-hidden": "true", children: "i" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "No findings yet" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Start a session, reload the page, perform your QA flow, then run a UI scan." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { id: "issuesList", className: "issues-list" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("section", { className: "ai-panel ai-only testpilot-chat-panel", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { className: "testpilot-chat-card", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("header", { className: "testpilot-chat-head", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "testpilot-chat-copy", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "testpilot-chat-title-row", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "AI QA Agent" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "testpilot-mode-toggle", "aria-label": "Chat mode", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "testPilotChatModeBtn", className: "active", type: "button", children: "Chat" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "testPilotAgentModeBtn", type: "button", children: "Agent" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "testpilot-live-status", "aria-live": "polite", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { id: "aiStatusPill", className: "status-pill", children: "Checking" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "checkAiBtn", className: "testpilot-retry-ai hidden", type: "button", "aria-label": "Retry local AI connection", children: "↻" })
            ] })
          ] }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { id: "aiChatMessages", className: "testpilot-chat-messages", "aria-live": "polite", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "testpilot-empty-chat", children: "Tell TestPilot what to test on this page." }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { id: "aiChatForm", className: "testpilot-composer", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { id: "aiChatInput", rows: 2, placeholder: "Ask about this QA session...", defaultValue: "" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "sendAiChatBtn", className: "primary testpilot-send", type: "submit", "aria-label": "Send", children: "➤" })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("header", { className: "page-heading test-cases-only", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "eyebrow", children: "Generated QA coverage" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "Test Cases" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Generate, copy, and export scenarios from current page context, findings, and latest Agent evidence." })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "test-cases-panel test-cases-only", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { className: "test-cases-controls", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
              "Test type",
              /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { id: "testCaseTypeSelect", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "All Types" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "Functional" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "Negative" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "Edge Cases" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "Regression" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "Smoke" })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
              "Format",
              /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { id: "testCaseFormatSelect", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "Step-by-step" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "Gherkin" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "Markdown table" })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "test-cases-actions", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "generateTestCasesTabBtn", className: "primary", type: "button", children: "Generate" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "copyTestCasesBtn", type: "button", children: "Copy" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "exportTestCasesMarkdownBtn", type: "button", children: "Export Markdown" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "clearTestCasesBtn", type: "button", children: "Clear" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { id: "testCasesStatus", className: "test-cases-status", children: "No generated test cases yet." }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { id: "testCasesOutput", className: "test-cases-output empty", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Ready to generate" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Start a session and run Agent or manual QA first for richer, page-specific test cases." })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("header", { className: "page-heading bug-reports-only", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "eyebrow", children: "Generated defect drafts" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "Bug Reports" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Generate clean, evidence-based bug drafts from confirmed findings and latest Agent results." })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "bug-reports-panel bug-reports-only", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { className: "bug-reports-controls", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "eyebrow", children: "Draft controls" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Bug report generator" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Use this panel for AI-assisted bug drafts. Use Reports for full session exports." })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bug-reports-actions", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "generateBugReportTabBtn", className: "primary", type: "button", children: "Generate" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "copyBugReportDraftsBtn", type: "button", children: "Copy" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "exportBugReportMarkdownBtn", type: "button", children: "Export Markdown" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "exportBugReportJsonBtn", type: "button", children: "Export JSON" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "clearBugReportsBtn", type: "button", children: "Clear" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { id: "bugReportsStatus", className: "bug-reports-status", children: "No generated bug reports yet." }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { id: "bugReportsOutput", className: "bug-reports-output empty", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Ready to draft" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Capture findings or run Agent first, then generate bug reports from real evidence." })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "page-heading reports-only", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "eyebrow", children: "Shareable evidence" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "Reports" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Choose the format that best fits review, tracking, or developer debugging." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "privacy-pill", children: "Redacted locally" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "report-summary-grid reports-only", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "QA health" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "reportHealth", children: "100/100" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Actionable" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "reportActionable", children: "0" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Needs review" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "reportReview", children: "0" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Captured routes" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { id: "reportRoutes", children: "0" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "report-panel reports-only", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { id: "reportPreview", className: "report-preview" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { className: "report-builder", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "report-builder-head", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "eyebrow", children: "Report builder" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Ready-to-file bug draft" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Edit the draft before copying it into Jira, Linear, Slack, or a QA handoff." })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "report-builder-actions", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "refreshReportBuilderBtn", type: "button", children: "Refresh Draft" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "copyReportBuilderBtn", type: "button", children: "Copy Draft" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "downloadReportBuilderBtn", type: "button", children: "Export Markdown" })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "report-builder-grid", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
                "Title",
                /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "reportBuilderTitle", type: "text", placeholder: "No confirmed defect selected yet" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
                "Severity",
                /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { id: "reportBuilderSeverity", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "needs review" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "critical" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "high" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "medium" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "low" })
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
                "Status",
                /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { id: "reportBuilderStatus", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "needs review" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "confirmed" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { children: "ignored" })
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "wide-field", children: [
                "Summary",
                /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { id: "reportBuilderSummary", rows: 3, placeholder: "Short defect summary", defaultValue: "" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "wide-field", children: [
                "Steps to reproduce",
                /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { id: "reportBuilderSteps", rows: 5, placeholder: "1. Open the tested page...", defaultValue: "" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "wide-field", children: [
                "Expected result",
                /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { id: "reportBuilderExpected", rows: 2, placeholder: "What should happen", defaultValue: "" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "wide-field", children: [
                "Actual result",
                /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { id: "reportBuilderActual", rows: 2, placeholder: "What happened instead", defaultValue: "" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "wide-field", children: [
                "Evidence",
                /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { id: "reportBuilderEvidence", rows: 4, placeholder: "Sanitized TestPilot evidence", defaultValue: "" })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "export-grid", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { className: "export-card", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "file-type", children: "HTML" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "HTML Report" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Best for sharing a readable QA review with teams and managers." })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "exportHtmlBtn", className: "primary", children: "Download HTML" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { className: "export-card", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "file-type", children: "CSV" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "CSV for Google Sheets" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Best for QA tracking with concise evidence and recommendation columns." })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "exportCsvBtn", children: "Download CSV" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { className: "export-card", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "file-type", children: "JSON" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "JSON Report" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Best for developers, automation, and complete machine-readable evidence." })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "exportJsonBtn", children: "Download JSON" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { className: "export-card", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "file-type", children: "TEXT" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Copy QA Summary" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Best for a quick update in Slack, Jira, Linear, or a pull request." })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "copyReportBtn", children: "Copy Summary" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("article", { className: "export-card ai-export-card", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "file-type", children: "AI" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "AI Artifacts" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Download generated test cases, bug drafts, or analysis for QA handoff." })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "export-card-actions", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "downloadAiMarkdownReportBtn", children: "Markdown" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "downloadAiJsonReportBtn", children: "JSON" })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "privacy-note", children: "Exports are generated on this device. Sensitive values are redacted before report creation." })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "page-heading settings-only", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "eyebrow", children: "Configuration" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "Settings" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Adjust capture, filtering, UI scan, and report behavior without changing the privacy model." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "resetSettingsBtn", children: "Reset Defaults" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "settings-panel settings-only", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("fieldset", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("legend", { children: "Capture" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "group-description", children: "Control optional evidence capture. Redaction and temporary storage remain enabled." }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "settings-grid", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "setting-row", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Response body capture" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Store short redacted response snippets when Chrome makes them available." })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "captureResponseBody", type: "checkbox" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "setting-row readonly-setting", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Sensitive-data redaction" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Authorization, cookies, tokens, and secrets are removed." })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "status-pill success", children: "Enabled" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "setting-row readonly-setting", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Session-only evidence" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Captured results are not stored as long-term browser history." })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "status-pill success", children: "Enabled" })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("fieldset", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("legend", { children: "API thresholds" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "group-description", children: "Tune performance and duplicate-call rules for your application." }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "settings-grid numeric-grid", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
                "Slow API threshold",
                /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "slowApiMs", type: "number", min: 100, step: 100, defaultValue: 1e3 }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "ms" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
                "Very slow threshold",
                /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "verySlowApiMs", type: "number", min: 500, step: 100, defaultValue: 3e3 }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "ms" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
                "Duplicate window",
                /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "duplicateWindowMs", type: "number", min: 100, step: 100, defaultValue: 2e3 }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "ms" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
                "Response preview limit",
                /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "maxBodyPreviewBytes", type: "number", min: 1e3, max: 2e4, step: 1e3, defaultValue: 1e4 }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "bytes" })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("fieldset", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("legend", { children: "AI Provider" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "group-description", children: "Choose a local model or your own provider key. API keys stay in Chrome local storage and are never sent to inspected pages." }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "settings-grid ai-provider-grid", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "setting-row ai-provider-field", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Provider" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Most hosted providers only need an API key. Model stays on Auto by default." })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { id: "aiProviderSelect", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "local-backend", children: "Local Backend" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "ollama-direct", children: "Ollama Direct" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "openai", children: "OpenAI" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "grok", children: "Grok / xAI" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "gemini", children: "Gemini" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "anthropic", children: "Anthropic Claude" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "openrouter", children: "OpenRouter" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "together", children: "Together AI" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "mistral", children: "Mistral" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "custom-openai-compatible", children: "Custom OpenAI-Compatible API" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "custom-api", children: "Custom API" })
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "setting-row ai-provider-field", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "API Key" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("small", { id: "aiApiKeyHelp", children: "Not required for Local Backend." })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "aiApiKeyInput", type: "password", autoComplete: "off", placeholder: "No API key required" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "setting-row readonly-setting", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Connection Status" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("small", { id: "aiProviderStatusText", children: "Provider has not been checked yet." })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { id: "aiProviderStatusPill", className: "status-pill", children: "Not Configured" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "setting-row ai-provider-actions", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Provider Actions" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Use a tiny test prompt. No page context is sent." })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "testAiProviderBtn", type: "button", children: "Test Connection" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "clearAiApiKeyBtn", type: "button", children: "Clear API Key" })
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "setting-row readonly-setting", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Payload safety" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Only sanitized summaries are sent. Raw headers, bodies, cookies, and tokens are excluded." })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "status-pill success", children: "Enabled" })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("details", { className: "advanced-settings", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("summary", { children: "Advanced Settings" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "settings-grid numeric-grid settings-subgrid", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "wide-field", children: [
                  "Base URL",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "aiBaseUrlInput", type: "url", placeholder: "Auto / provider default" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Required for Custom API providers. Leave blank for provider defaults." })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
                  "Model mode",
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { id: "aiModelModeSelect", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "auto", children: "Auto / Recommended" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "custom", children: "Custom" })
                  ] })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
                  "Model override",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "aiModelInput", type: "text", placeholder: "Auto / Recommended" })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
                  "Context mode",
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { id: "aiContextModeSelect", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "fast", children: "Fast" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "balanced", children: "Balanced" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "deep", children: "Deep" })
                  ] })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
                  "Temperature",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "aiTemperatureInput", type: "number", min: 0, max: 2, step: "0.1", defaultValue: "0.2" })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
                  "Max tokens",
                  /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "aiMaxTokensInput", type: "number", min: 32, max: 12e3, step: 32, defaultValue: 900 })
                ] })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("fieldset", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("legend", { children: "Filtering" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "group-description", children: "Keep speculative framework behavior separate from confirmed application defects." }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "settings-grid", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "setting-row", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Hide framework noise by default" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Keep Next.js route-data observations out of the main finding list." })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "hideFrameworkNoise", type: "checkbox", defaultChecked: true })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "setting-row", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Show Next.js prefetch findings" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Make framework route-data observations visible in normal filtering." })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "showNextPrefetchFindings", type: "checkbox" })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "setting-row", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Treat matching prefetch failures as review items" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Promote framework traffic only when related failure evidence exists." })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "treatFrameworkPrefetchAsIssue", type: "checkbox" })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("fieldset", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("legend", { children: "UI Scan" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "group-description", children: "Keep scans bounded and focused on visible, user-relevant interface elements." }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "settings-grid", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "setting-row", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Visible viewport only" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Ignore content that is currently outside the tester's screen." })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "uiVisibleViewportOnly", type: "checkbox", defaultChecked: true })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "setting-row", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Include decorative elements" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Also inspect backgrounds, canvases, and non-interactive decoration." })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "uiIncludeDecorativeElements", type: "checkbox" })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "settings-grid numeric-grid settings-subgrid", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
                "Maximum UI nodes",
                /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "maxUiNodes", type: "number", min: 500, max: 1e4, step: 500, defaultValue: 4e3 })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
                "Findings per rule",
                /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "maxIssuesPerRule", type: "number", min: 1, max: 100, defaultValue: 25 })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "wide-field", children: [
                "Allowed color tokens",
                /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { id: "allowedColors", placeholder: "#000000\n    #ffffff\n    #2563eb", defaultValue: "" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Optional. Enter one CSS color per line." })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("fieldset", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("legend", { children: "Reports" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "group-description", children: "Choose which observations and export formats are available." }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "settings-grid", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "setting-row", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Include framework noise" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Keep framework observations in exported evidence without counting them as issues." })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "exportFrameworkNoise", type: "checkbox", defaultChecked: true })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "setting-row", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Enable CSV export" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("small", { children: "Allow spreadsheet-friendly report downloads for Google Sheets." })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "csvExportEnabled", type: "checkbox", defaultChecked: true })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "settings-footer", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Changes are stored locally as extension preferences." }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "saveSettingsBtn", className: "primary", children: "Save Settings" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "compatibility-hooks", hidden: true, "aria-hidden": "true", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { id: "aiStatusTitle", children: "Local AI: Not checked" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { id: "aiStatusText", children: "Start ai-backend with npm start. TestPilot checks the connection automatically." }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "aiBackendUrl", type: "url", defaultValue: "http://localhost:8787" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("pre", { id: "aiConnectionLog", children: "Backend not checked yet." }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { id: "aiOutput", className: "empty" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "analyzeAiBtn", type: "button", children: "Analyze Session" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "generateTestsBtn", type: "button", children: "Generate Test Cases" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "generateBugsBtn", type: "button", children: "Generate Bug Report" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "copyAiSummaryBtn", type: "button", children: "Copy AI Summary" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "downloadAiMarkdownBtn", type: "button", children: "Download AI Markdown" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { id: "downloadAiJsonBtn", type: "button", children: "Download AI JSON" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { children: [
            "Include AI summary",
            /* @__PURE__ */ jsxRuntimeExports.jsx("input", { id: "includeAiSummaryInReport", type: "checkbox" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { id: "testPilotAgentNotice" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { id: "testPilotAgentCommands" })
        ] })
      ] })
    ] })
  ] });
}
function App() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(PanelShell, {});
}
const rootElement = document.getElementById("testpilotReactRoot");
if (rootElement) {
  const root = clientExports.createRoot(rootElement);
  reactDomExports.flushSync(() => {
    root.render(
      /* @__PURE__ */ jsxRuntimeExports.jsx(reactExports.StrictMode, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(App, {}) })
    );
  });
}
