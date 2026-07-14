import Dexie, { Table } from 'dexie';

export type SessionRecord = {
  sessionId: string;
  active: boolean;
  pageUrl?: string;
  startedAt?: number;
  endedAt?: number;
  lastUpdatedAt?: number;
  data?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

export type EvidenceRecord = {
  id?: number;
  sessionId: string;
  kind: string;
  category?: string;
  title?: string;
  summary?: string;
  url?: string;
  timestamp: number;
  payload: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

export type ConversationMessage = {
  id?: number;
  sessionId: string;
  role: 'system' | 'user' | 'assistant' | 'tool' | string;
  content: string;
  metadata?: Record<string, unknown> | null;
  timestamp: number;
};

export type SettingRecord = {
  key: string;
  value: unknown;
};

export class TestPilotDexieDb extends Dexie {
  sessions!: Table<SessionRecord, string>;
  evidence!: Table<EvidenceRecord, number>;
  conversationMessages!: Table<ConversationMessage, number>;
  settings!: Table<SettingRecord, string>;

  constructor() {
    super('TestPilotDexieDb');

    this.version(1).stores({
      sessions: '&sessionId,active,createdAt,updatedAt',
      evidence: '++id,sessionId,kind,category,createdAt',
      conversationMessages: '++id,sessionId,role,timestamp',
      settings: '&key'
    });

    this.version(2).stores({
      sessions: '&sessionId,active,createdAt,updatedAt',
      evidence: '++id,sessionId,kind,category,createdAt',
      conversationMessages: '++id,sessionId,role,timestamp',
      settings: '&key'
    }).upgrade(async (trans) => {
      const now = Date.now();
      await trans.table('sessions').toCollection().modify((record: any) => {
        if (!record.createdAt) record.createdAt = now;
        if (!record.updatedAt) record.updatedAt = record.createdAt;
      });
      await trans.table('evidence').toCollection().modify((record: any) => {
        if (!record.createdAt) record.createdAt = now;
        if (!record.updatedAt) record.updatedAt = record.createdAt;
      });
      await trans.table('conversationMessages').toCollection().modify((record: any) => {
        if (!Object.prototype.hasOwnProperty.call(record, 'metadata')) {
          record.metadata = null;
        }
      });
    });
  }
}

export const db = new TestPilotDexieDb();
export default db;

export async function saveSession(session: SessionRecord) {
  const now = Date.now();
  await db.sessions.put({
    ...session,
    createdAt: session.createdAt || now,
    updatedAt: now
  });
}

export async function getSession(sessionId: string) {
  return db.sessions.get(sessionId);
}

export type FindingRecord = EvidenceRecord;

export async function addEvidence(evidence: EvidenceRecord): Promise<number> {
  const now = Date.now();
  return db.evidence.add({
    ...evidence,
    createdAt: evidence.createdAt || now,
    updatedAt: now
  });
}

export async function getEvidenceForSession(sessionId: string): Promise<EvidenceRecord[]> {
  return db.evidence.where('sessionId').equals(sessionId).toArray();
}

export async function saveFinding(finding: FindingRecord): Promise<number> {
  return addEvidence(finding);
}

export async function getFindings(sessionId: string): Promise<FindingRecord[]> {
  return getEvidenceForSession(sessionId);
}

export async function addConversationMessage(message: ConversationMessage): Promise<number> {
  return db.conversationMessages.add(message);
}

export async function getConversationHistory(sessionId: string): Promise<ConversationMessage[]> {
  return db.conversationMessages.where('sessionId').equals(sessionId).sortBy('timestamp');
}

export async function saveConversation(message: ConversationMessage): Promise<number> {
  return addConversationMessage(message);
}

export async function getConversation(sessionId: string): Promise<ConversationMessage[]> {
  return getConversationHistory(sessionId);
}

export type StorageEstimateResult = {
  usageBytes: number;
  quotaBytes: number;
  usageFraction: number | null;
  usagePercent: number | null;
};

export async function getStorageEstimate(): Promise<StorageEstimateResult | null> {
  if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.estimate !== 'function') {
    return null;
  }

  const estimate = await navigator.storage.estimate();
  const usage = typeof estimate.usage === 'number' ? estimate.usage : 0;
  const quota = typeof estimate.quota === 'number' ? estimate.quota : 0;
  const usageFraction = quota > 0 ? usage / quota : null;
  const usagePercent = usageFraction !== null ? Math.min(100, Math.round(usageFraction * 100)) : null;

  return {
    usageBytes: usage,
    quotaBytes: quota,
    usageFraction,
    usagePercent
  };
}

export async function clearSession(sessionId: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.evidence, db.conversationMessages, async () => {
    await db.sessions.delete(sessionId);
    await db.evidence.where('sessionId').equals(sessionId).delete();
    await db.conversationMessages.where('sessionId').equals(sessionId).delete();
  });
}

export async function saveSetting(key: string, value: unknown) {
  await db.settings.put({ key, value });
}

export async function getSetting(key: string) {
  return db.settings.get(key);
}
