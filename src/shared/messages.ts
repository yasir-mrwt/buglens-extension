export const TESTPILOT_PANEL_INIT = 'TESTPILOT_PANEL_INIT';
export const TESTPILOT_BACKGROUND_READY = 'TESTPILOT_BACKGROUND_READY';
export const TESTPILOT_CONTENT_EVENT = 'TESTPILOT_CONTENT_EVENT';
export const TESTPILOT_GET_BACKGROUND_STATUS = 'TESTPILOT_GET_BACKGROUND_STATUS';
export const TESTPILOT_CONTENT_SOURCE = 'testpilot-content';
export const TESTPILOT_DEVTOOLS_PORT = 'testpilot-devtools';

export type PanelInitMessage = {
  type: typeof TESTPILOT_PANEL_INIT;
  tabId: number | string;
};

export type BackgroundStatusMessage = {
  type: typeof TESTPILOT_GET_BACKGROUND_STATUS;
};

export type ContentMessage = {
  source: typeof TESTPILOT_CONTENT_SOURCE;
  kind?: string;
  sessionId?: string | null;
  payload?: unknown;
  [key: string]: unknown;
};

export type RuntimeMessage = PanelInitMessage | BackgroundStatusMessage | ContentMessage | Record<string, unknown>;

export type PanelRelayPayload = {
  type: typeof TESTPILOT_CONTENT_EVENT | typeof TESTPILOT_BACKGROUND_READY | string;
  tabId: number;
  payload?: unknown;
};

export type BackgroundStatusResponse = {
  ok: boolean;
  activePanels: number;
};
