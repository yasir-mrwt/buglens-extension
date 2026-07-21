import React from 'react';

type PageContext = {
  title: string;
  url: string;
  status: 'checking' | 'ready' | 'error';
};

const inspectedTabId = chrome.devtools.inspectedWindow.tabId;

function normalizeTitle(tabTitle: string | undefined, url: string) {
  const title = String(tabTitle || '').trim();
  if (title) return title;
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname || 'Untitled page';
  } catch {
    return 'Untitled page';
  }
}

function formatUrl(url: string | undefined) {
  const value = String(url || '').trim();
  return value || 'Unavailable';
}

export function PageContextBar() {
  const [context, setContext] = React.useState<PageContext>({
    title: 'Checking...',
    url: 'Checking...',
    status: 'checking'
  });

  React.useEffect(() => {
    let disposed = false;

    const syncTabContext = () => {
      chrome.tabs.get(inspectedTabId, (tab) => {
        if (disposed) return;
        if (chrome.runtime.lastError || !tab) {
          setContext({
            title: 'Unavailable',
            url: 'Unavailable',
            status: 'error'
          });
          return;
        }

        const url = formatUrl(tab.url);
        setContext({
          title: normalizeTitle(tab.title, url),
          url,
          status: 'ready'
        });
      });
    };

    syncTabContext();

    const handleTabUpdate = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (tabId !== inspectedTabId) return;
      if (!changeInfo.title && !changeInfo.url) return;
      if (disposed) return;

      const url = formatUrl(tab.url || changeInfo.url);
      setContext({
        title: normalizeTitle(tab.title, url),
        url,
        status: 'ready'
      });
    };

    chrome.tabs.onUpdated.addListener(handleTabUpdate);

    return () => {
      disposed = true;
      chrome.tabs.onUpdated.removeListener(handleTabUpdate);
    };
  }, []);

  return (
    <div className="page-context-bar" aria-label="Current page context">
      <span className="page-context-bar-label">Current page</span>
      <strong className="page-context-bar-title">{context.title}</strong>
      <strong id="currentUrl" className="page-context-bar-url" data-status={context.status}>{context.url}</strong>
    </div>
  );
}