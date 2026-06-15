document.getElementById('openDocsBtn').addEventListener('click', async () => {
  const url = chrome.runtime.getURL('docs/quick-start.html');
  await chrome.tabs.create({ url });
});

chrome.runtime.sendMessage({ type: 'BUGLENS_GET_BACKGROUND_STATUS' }, (response) => {
  const status = document.getElementById('status');
  const statusTitle = document.getElementById('statusTitle');
  const statusDot = document.getElementById('statusDot');
  if (chrome.runtime.lastError || !response || !response.ok) {
    statusTitle.textContent = 'DevTools panel not connected';
    status.textContent = 'Open DevTools on a normal web page, then select BugLens.';
    return;
  }
  const isActive = response.activePanels > 0;
  statusDot.classList.toggle('active', isActive);
  statusTitle.textContent = isActive ? 'BugLens is ready' : 'Open the BugLens panel';
  status.textContent = isActive
    ? `${response.activePanels} DevTools panel${response.activePanels === 1 ? '' : 's'} connected.`
    : 'No active BugLens DevTools panel was detected.';
});
