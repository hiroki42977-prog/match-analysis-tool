import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import * as db from '../src/storage/db';
import { flush, pendingCount, queueDelete, queueUpsert } from '../src/sync/queue';

let n = 0;
beforeEach(async () => { await db.openDb(`q-${++n}`); });

test('collapses pending ops', async () => {
  await queueUpsert('a', [1]);
  await queueUpsert('a', [2]);
  let ops = await db.listOps();
  expect(ops).toHaveLength(1);
  expect(ops[0].row).toEqual([2]);
  await queueDelete('a');
  ops = await db.listOps();
  expect(ops.map((o) => [o.kind, o.eventId])).toEqual([['deleteEvent', 'a']]);
  expect(await pendingCount()).toBe(1);
});

test('flush stops at first failure and keeps order', async () => {
  await queueUpsert('a', [1]);
  await queueUpsert('b', [2]);
  await queueUpsert('c', [3]);
  const seen: string[] = [];
  let r = await flush(async (op) => { seen.push(op.eventId); return op.eventId !== 'b'; });
  expect(r).toEqual({ sent: 1, remaining: 2 });
  expect(seen).toEqual(['a', 'b']);
  expect((await db.listOps())[0]).toMatchObject({ eventId: 'b', attempts: 1 });
  seen.length = 0;
  r = await flush(async (op) => { seen.push(op.eventId); return true; });
  expect(seen).toEqual(['b', 'c']);
  expect(r).toEqual({ sent: 2, remaining: 0 });
});

test('flush treats a thrown send as failure', async () => {
  await queueUpsert('a', [1]);
  const r = await flush(async () => { throw new Error('offline'); });
  expect(r).toEqual({ sent: 0, remaining: 1 });
});

test('edit while sending is not lost', async () => {
  await queueUpsert('a', ['v1']);
  const sent: unknown[] = [];
  await flush(async (op) => {
    sent.push(op.row);
    await queueUpsert('a', ['v2']); // 送信中に手修正
    return true;
  });
  const ops = await db.listOps();
  expect(ops.map((o) => o.row)).toEqual([['v2']]);
  await flush(async (op) => { sent.push(op.row); return true; });
  expect(sent).toEqual([['v1'], ['v2']]);
});

test('delete while sending keeps the delete', async () => {
  await queueUpsert('a', ['v1']);
  await flush(async () => {
    await queueDelete('a');
    return false; // 送信失敗
  });
  expect((await db.listOps()).map((o) => [o.kind, o.row ?? null, o.attempts])).toEqual([
    ['upsertEvent', ['v1'], 1],
    ['deleteEvent', null, 0],
  ]);
});
