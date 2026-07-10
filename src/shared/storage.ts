import type { TestPilotSettings } from './settings';

export const TESTPILOT_SETTINGS_KEY = 'testpilotSettings';
export const SESSION_STORAGE_PREFIX = 'testpilotSession:v4:';
export const LOCAL_SESSION_BACKUP_PREFIX = 'testpilotSessionBackup:v4:';

export type StoredSessionSnapshot = {
  active?: boolean;
  sessionId?: string | null;
  [key: string]: unknown;
};

export type StoredSettingsRecord = {
  [TESTPILOT_SETTINGS_KEY]?: Partial<TestPilotSettings>;
};

export function sessionStorageKey(tabId: number) {
  return `${SESSION_STORAGE_PREFIX}${tabId}`;
}

export function isLegacySessionStorageKey(key: string) {
  return key.startsWith('testpilotSession:') && !key.startsWith(SESSION_STORAGE_PREFIX);
}
