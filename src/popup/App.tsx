import { useEffect, useState } from 'react';
import { TESTPILOT_GET_BACKGROUND_STATUS, type BackgroundStatusResponse } from '../shared/messages';

type PopupStatus = {
  active: boolean;
  title: string;
  message: string;
};

const checkingStatus: PopupStatus = {
  active: false,
  title: 'Checking DevTools connection',
  message: 'TestPilot is checking for an open panel.'
};

function getStatusFromResponse(response?: Partial<BackgroundStatusResponse>): PopupStatus {
  if (!response?.ok) {
    return {
      active: false,
      title: 'DevTools panel not connected',
      message: 'Open DevTools on a normal web page, then select TestPilot.'
    };
  }

  const activePanels = response.activePanels || 0;
  const isActive = activePanels > 0;
  return {
    active: isActive,
    title: isActive ? 'TestPilot is ready' : 'Open the TestPilot panel',
    message: isActive
      ? `${activePanels} DevTools panel${activePanels === 1 ? '' : 's'} connected.`
      : 'No active TestPilot DevTools panel was detected.'
  };
}

export function App() {
  const [status, setStatus] = useState<PopupStatus>(checkingStatus);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: TESTPILOT_GET_BACKGROUND_STATUS }, (response?: Partial<BackgroundStatusResponse>) => {
      if (chrome.runtime.lastError) {
        setStatus(getStatusFromResponse());
        return;
      }
      setStatus(getStatusFromResponse(response));
    });
  }, []);

  async function openDocs() {
    const url = chrome.runtime.getURL('docs/quick-start.html');
    await chrome.tabs.create({ url });
  }

  return (
    <section className="popup-shell">
      <header>
        <img src="../assets/icons/icon48.png" alt="" />
        <div>
          <div className="title-row">
            <h1>TestPilot</h1>
            <span>v0.4.1</span>
          </div>
          <p>Professional QA for Chrome DevTools</p>
        </div>
      </header>

      <section className="status-card">
        <span className={`status-dot${status.active ? ' active' : ''}`} aria-hidden="true" />
        <div>
          <strong>{status.title}</strong>
          <p>{status.message}</p>
        </div>
      </section>

      <section className="card">
        <span className="eyebrow">Quick workflow</span>
        <ol>
          <li><span>1</span><div><strong>Open DevTools</strong><p>Select the TestPilot panel.</p></div></li>
          <li><span>2</span><div><strong>Start and reload</strong><p>Capture the complete page flow.</p></div></li>
          <li><span>3</span><div><strong>Review, ask AI, export</strong><p>Scan UI, analyze locally, then create a report.</p></div></li>
        </ol>
      </section>

      <section className="privacy-card">
        <span className="privacy-indicator" aria-hidden="true" />
        <div>
          <strong>Private by design</strong>
          <p>Session evidence stays temporary and local. Nothing is uploaded.</p>
        </div>
      </section>

      <button type="button" onClick={openDocs}>Open Setup Guide</button>
    </section>
  );
}
