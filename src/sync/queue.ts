import type { Settings } from '../domain/types';
import * as db from '../storage/db';
import type { QueuedOp } from '../storage/db';
import { postToScript } from './client';

type Row = (string | number | boolean)[];

// 送信中の op。送信中に書き換えると、送信後に消されて修正が届かなくなるので触らない
let inFlight: number | null = null;

export async function queueUpsert(eventId: string, row: Row): Promise<void> {
  const pending = (await db.listOps()).find((o) => o.kind === 'upsertEvent' && o.eventId === eventId && o.seq !== inFlight);
  if (pending) await db.updateOp({ ...pending, row });
  else await db.addOp({ kind: 'upsertEvent', eventId, row, attempts: 0, createdAt: new Date().toISOString() });
}

export async function queueDelete(eventId: string): Promise<void> {
  for (const o of await db.listOps()) {
    if (o.kind === 'upsertEvent' && o.eventId === eventId && o.seq !== inFlight) await db.removeOp(o.seq!);
  }
  await db.addOp({ kind: 'deleteEvent', eventId, attempts: 0, createdAt: new Date().toISOString() });
}

export async function pendingCount(): Promise<number> {
  return (await db.listOps()).length;
}

/** 古い順に送る。1件でも失敗したらそこで止め、次回はその件から */
export async function flush(send: (op: QueuedOp) => Promise<boolean>): Promise<{ sent: number; remaining: number }> {
  const ops = await db.listOps();
  let sent = 0;
  for (const op of ops) {
    let ok = false;
    inFlight = op.seq!;
    try {
      ok = await send(op);
    } catch {
      ok = false;
    } finally {
      inFlight = null;
    }
    if (!ok) {
      await db.updateOp({ ...op, attempts: op.attempts + 1 });
      break;
    }
    await db.removeOp(op.seq!);
    sent++;
  }
  return { sent, remaining: ops.length - sent };
}

export function sendOp(s: Settings) {
  return async (op: QueuedOp) => {
    const body = op.kind === 'upsertEvent' ? { action: 'upsertEvent', eventId: op.eventId, row: op.row } : { action: 'deleteEvent', eventId: op.eventId };
    return (await postToScript(s, body)).ok;
  };
}

let running = false;
let again = false;
let timer: ReturnType<typeof setInterval> | null = null;
let kick: (() => void) | null = null;

/** 自動送信を始める。2回目以降の呼び出しは、すぐ1回送るだけ */
export function startAutoFlush(getSettings: () => Promise<Settings | undefined>, onChange: (pending: number) => void): void {
  const run = async () => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      do {
        again = false;
        const s = await getSettings();
        if (s?.endpoint && navigator.onLine !== false) await flush(sendOp(s));
      } while (again);
    } finally {
      running = false;
      onChange(await pendingCount());
    }
  };
  kick = run;
  if (!timer) {
    window.addEventListener('online', () => kick?.());
    timer = setInterval(() => kick?.(), 30_000);
  }
  void run();
}

/** すぐ1回送る（自動送信が始まっていなければ何もしない） */
export function requestFlush(): void {
  kick?.();
}
