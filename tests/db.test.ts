import 'fake-indexeddb/auto';
import { beforeEach, expect, test } from 'vitest';
import * as db from '../src/storage/db';
import { ev } from './helpers';

let n = 0;
beforeEach(async () => {
  await db.openDb(`test-${++n}`);
});

test('teams and players (sorted by number)', async () => {
  await db.saveTeam({ id: 't1', name: 'サンプルFC' });
  await db.savePlayer({ id: 'p2', teamId: 't1', number: 10, name: '山田' });
  await db.savePlayer({ id: 'p1', teamId: 't1', number: 7, name: '佐藤' });
  await db.savePlayer({ id: 'p3', teamId: 't2', number: 1, name: '別' });
  expect(await db.listTeams()).toEqual([{ id: 't1', name: 'サンプルFC' }]);
  expect((await db.listPlayers('t1')).map((p) => p.number)).toEqual([7, 10]);
  await db.deletePlayer('p1');
  expect((await db.listPlayers('t1')).map((p) => p.id)).toEqual(['p2']);
});

test('matches newest first', async () => {
  const m = (id: string, date: string) => ({ id, teamId: 't1', date, opponent: 'X', format: '8' as const, videos: [{ id: 'v1', url: 'https://youtu.be/abcDEF12345', half: '1H' as const }], playerIds: [] });
  await db.saveMatch(m('a', '2026-09-01'));
  await db.saveMatch(m('b', '2026-10-13'));
  expect((await db.listMatches()).map((x) => x.id)).toEqual(['b', 'a']);
  expect((await db.getMatch('a'))?.date).toBe('2026-09-01');
});

test('old match (videoUrl only) is upgraded once and saved', async () => {
  await db.saveMatch({ id: 'old', teamId: 't1', date: '2026-10-01', opponent: 'X', format: '8', videoUrl: 'https://youtu.be/abcDEF12345', playerIds: [] } as never);
  const first = await db.getMatch('old');
  expect(first?.videos).toHaveLength(1);
  expect(first?.videos[0].url).toBe('https://youtu.be/abcDEF12345');
  expect((await db.getMatch('old'))?.videos[0].id).toBe(first?.videos[0].id);
  expect((await db.listMatches())[0].videos[0].id).toBe(first?.videos[0].id);
});

test('events filtered by match/player, ordered 1H→2H then time', async () => {
  await db.saveEvent(ev({ id: 'x1', half: '2H', videoTimeSec: 5 }));
  await db.saveEvent(ev({ id: 'x2', half: '1H', videoTimeSec: 900 }));
  await db.saveEvent(ev({ id: 'x3', half: '1H', videoTimeSec: 10 }));
  await db.saveEvent(ev({ id: 'x4', playerId: 'other' }));
  await db.saveEvent(ev({ id: 'x5', matchId: 'other' }));
  expect((await db.listEvents('m1', 'p1')).map((e) => e.id)).toEqual(['x3', 'x2', 'x1']);
  expect((await db.listEvents('m1')).length).toBe(4);
  await db.deleteEvent('x2');
  expect((await db.listEvents('m1', 'p1')).map((e) => e.id)).toEqual(['x3', 'x1']);
});

test('progress per match+player', async () => {
  await db.saveProgress({ matchId: 'm1', playerId: 'p1', videoTimeSec: 42, half: '2H' });
  expect(await db.getProgress('m1', 'p1')).toEqual({ matchId: 'm1', playerId: 'p1', videoTimeSec: 42, half: '2H' });
  expect(await db.getProgress('m1', 'p2')).toBeUndefined();
});

test('queue ops in seq order, update and remove', async () => {
  await db.addOp({ kind: 'upsertEvent', eventId: 'a', row: [1], attempts: 0, createdAt: 't' });
  await db.addOp({ kind: 'deleteEvent', eventId: 'b', attempts: 0, createdAt: 't' });
  const ops = await db.listOps();
  expect(ops.map((o) => o.eventId)).toEqual(['a', 'b']);
  await db.updateOp({ ...ops[0], attempts: 2 });
  await db.removeOp(ops[1].seq!);
  expect(await db.listOps()).toEqual([{ ...ops[0], attempts: 2 }]);
});

test('settings', async () => {
  expect(await db.getSettings()).toBeUndefined();
  await db.saveSettings({ endpoint: 'https://x', token: 'k' });
  expect(await db.getSettings()).toEqual({ endpoint: 'https://x', token: 'k' });
});

test('countPlayerEvents across matches', async () => {
  await db.saveEvent(ev({ id: 'y1', matchId: 'a', playerId: 'p9' }));
  await db.saveEvent(ev({ id: 'y2', matchId: 'b', playerId: 'p9' }));
  await db.saveEvent(ev({ id: 'y3', matchId: 'b', playerId: 'p8' }));
  expect(await db.countPlayerEvents('p9')).toBe(2);
  expect(await db.countPlayerEvents('none')).toBe(0);
});

import { openDB } from 'idb';
import { emptyMatchReport, emptyPlayerReport } from '../src/domain/report';

test('reports: empty at first, saved per match and per player', async () => {
  expect(await db.getMatchReport('m1')).toEqual(emptyMatchReport('m1'));
  expect(await db.getPlayerReport('m1', 'p1')).toEqual(emptyPlayerReport('m1', 'p1'));
  await db.saveMatchReport({ ...emptyMatchReport('m1'), venue: '市民グラウンド' });
  await db.savePlayerReport({ ...emptyPlayerReport('m1', 'p1'), comment: 'よかった' });
  expect((await db.getMatchReport('m1')).venue).toBe('市民グラウンド');
  expect((await db.getPlayerReport('m1', 'p1')).comment).toBe('よかった');
  expect((await db.getPlayerReport('m1', 'p2')).comment).toBe('');
});

test('opening a version-1 database keeps everything', async () => {
  const name = `v1-${++n}`;
  const old = await openDB(name, 1, {
    upgrade(d) {
      d.createObjectStore('teams', { keyPath: 'id' });
      d.createObjectStore('players', { keyPath: 'id' }).createIndex('teamId', 'teamId');
      d.createObjectStore('matches', { keyPath: 'id' });
      d.createObjectStore('events', { keyPath: 'id' }).createIndex('matchId', 'matchId');
      d.createObjectStore('progress', { keyPath: ['matchId', 'playerId'] });
      d.createObjectStore('queue', { keyPath: 'seq', autoIncrement: true });
      d.createObjectStore('settings');
    },
  });
  await old.put('teams', { id: 't1', name: 'サンプルFC' });
  await old.put('players', { id: 'p1', teamId: 't1', number: 10, name: '山田' });
  await old.put('matches', { id: 'm1', teamId: 't1', date: '2026-10-01', opponent: 'X', format: '8', videos: [{ id: 'v1', url: 'https://youtu.be/abcDEF12345', half: '1H' }], playerIds: ['p1'] });
  await old.put('events', ev({ id: 'old-e' }));
  old.close();

  await db.openDb(name);
  expect(await db.listTeams()).toEqual([{ id: 't1', name: 'サンプルFC' }]);
  expect((await db.listPlayers('t1')).map((p) => p.id)).toEqual(['p1']);
  expect((await db.getMatch('m1'))?.opponent).toBe('X');
  expect((await db.listEvents('m1')).map((e) => e.id)).toEqual(['old-e']);
  expect(await db.getMatchReport('m1')).toEqual(emptyMatchReport('m1'));
});
