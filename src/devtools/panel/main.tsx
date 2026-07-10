import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const rootElement = document.getElementById('testpilotReactRoot');

if (rootElement) {
  const root = createRoot(rootElement);
  flushSync(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });
}
