import { a as reactExports, j as jsxRuntimeExports, c as clientExports } from "../assets/client.js";
import { d as TESTPILOT_GET_BACKGROUND_STATUS } from "../assets/messages.js";
const checkingStatus = {
  active: false,
  title: "Checking DevTools connection",
  message: "TestPilot is checking for an open panel."
};
function getStatusFromResponse(response) {
  if (!(response == null ? void 0 : response.ok)) {
    return {
      active: false,
      title: "DevTools panel not connected",
      message: "Open DevTools on a normal web page, then select TestPilot."
    };
  }
  const activePanels = response.activePanels || 0;
  const isActive = activePanels > 0;
  return {
    active: isActive,
    title: isActive ? "TestPilot is ready" : "Open the TestPilot panel",
    message: isActive ? `${activePanels} DevTools panel${activePanels === 1 ? "" : "s"} connected.` : "No active TestPilot DevTools panel was detected."
  };
}
function App() {
  const [status, setStatus] = reactExports.useState(checkingStatus);
  reactExports.useEffect(() => {
    chrome.runtime.sendMessage({ type: TESTPILOT_GET_BACKGROUND_STATUS }, (response) => {
      if (chrome.runtime.lastError) {
        setStatus(getStatusFromResponse());
        return;
      }
      setStatus(getStatusFromResponse(response));
    });
  }, []);
  async function openDocs() {
    const url = chrome.runtime.getURL("docs/quick-start.html");
    await chrome.tabs.create({ url });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "popup-shell", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: "../assets/icons/icon48.png", alt: "" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "title-row", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "TestPilot" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "v0.4.1" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Professional QA for Chrome DevTools" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "status-card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `status-dot${status.active ? " active" : ""}`, "aria-hidden": "true" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: status.title }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: status.message })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "eyebrow", children: "Quick workflow" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("ol", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "1" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Open DevTools" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Select the TestPilot panel." })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "2" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Start and reload" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Capture the complete page flow." })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "3" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Review, ask AI, export" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Scan UI, analyze locally, then create a report." })
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "privacy-card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "privacy-indicator", "aria-hidden": "true" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: "Private by design" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Session evidence stays temporary and local. Nothing is uploaded." })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: openDocs, children: "Open Setup Guide" })
  ] });
}
const rootElement = document.getElementById("testpilotPopupRoot");
if (rootElement) {
  clientExports.createRoot(rootElement).render(
    /* @__PURE__ */ jsxRuntimeExports.jsx(reactExports.StrictMode, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(App, {}) })
  );
}
