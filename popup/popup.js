document.getElementById('openDocsBtn').addEventListener('click', async () => {
  const url = chrome.runtime.getURL('docs/quick-start.html');
  await chrome.tabs.create({ url });
});

chrome.runtime.sendMessage({ type: 'TESTPILOT_GET_BACKGROUND_STATUS' }, (response) => {
  const status = document.getElementById('status');
  const statusTitle = document.getElementById('statusTitle');
  const statusDot = document.getElementById('statusDot');
  if (chrome.runtime.lastError || !response || !response.ok) {
    statusTitle.textContent = 'DevTools panel not connected';
    status.textContent = 'Open DevTools on a normal web page, then select TestPilot.';
    return;
  }
  const isActive = response.activePanels > 0;
  statusDot.classList.toggle('active', isActive);
  statusTitle.textContent = isActive ? 'TestPilot is ready' : 'Open the TestPilot panel';
  status.textContent = isActive
    ? `${response.activePanels} DevTools panel${response.activePanels === 1 ? '' : 's'} connected.`
    : 'No active TestPilot DevTools panel was detected.';
});
