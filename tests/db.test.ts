import test from 'node:test';
import assert from 'node:assert/strict';
import indexedDB from 'fake-indexeddb';
import FDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';

globalThis.indexedDB = indexedDB as unknown as IDBFactory;
globalThis.IDBKeyRange = FDBKeyRange as unknown as typeof IDBKeyRange;
globalThis.navigator = {
  storage: {
    estimate: async () => ({ usage: 768, quota: 2048 })
  }
} as any;

import { db, saveSession, getSession, saveFinding, getFindings, saveConversation, getConversation, clearSession, getStorageEstimate } from '../src/shared/db';

test('db CRUD operations and storage estimate', async () => {
  const now = Date.now();
  const sessionId = 'session-test-1';

  await db.delete();

  await saveSession({
    sessionId,
    active: true,
    pageUrl: 'https://example.test/page',
    startedAt: now,
    createdAt: now,
    updatedAt: now,
    data: { foo: 'bar' }
  });

  const session = await getSession(sessionId);
  assert.equal(session?.sessionId, sessionId);
  assert.equal(session?.active, true);
  assert.equal(session?.pageUrl, 'https://example.test/page');

  const findingId = await saveFinding({
    sessionId,
    kind: 'api',
    category: 'actionable',
    title: 'API failure',
    timestamp: now,
    payload: { status: 500 },
    createdAt: now,
    updatedAt: now
  });
  assert.ok(typeof findingId === 'number' && findingId > 0);

  const findings = await getFindings(sessionId);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, 'api');

  const messageId = await saveConversation({
    sessionId,
    role: 'user',
    content: 'Test conversation message',
    timestamp: now,
    metadata: { channel: 'test' }
  });
  assert.ok(typeof messageId === 'number' && messageId > 0);

  const conversation = await getConversation(sessionId);
  assert.equal(conversation.length, 1);
  assert.equal(conversation[0].content, 'Test conversation message');

  const storageEstimate = await getStorageEstimate();
  assert.ok(storageEstimate !== null);
  assert.equal(storageEstimate?.usageBytes, 768);
  assert.equal(storageEstimate?.quotaBytes, 2048);
  assert.equal(storageEstimate?.usagePercent, 38);

  await clearSession(sessionId);

  const deletedSession = await getSession(sessionId);
  assert.equal(deletedSession, undefined);
  assert.equal((await getFindings(sessionId)).length, 0);
  assert.equal((await getConversation(sessionId)).length, 0);
});
