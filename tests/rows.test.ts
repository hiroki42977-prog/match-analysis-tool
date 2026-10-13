import { expect, test } from 'vitest';
import { eventRow, eventsToCsv, LOG_HEADERS, videoLink } from '../src/report/rows';
import type { Match, Player } from '../src/domain/types';
import { ev } from './helpers';

const match: Match = { id: 'm1', teamId: 't1', date: '2026-10-13', opponent: 'テストFC', format: '8', videoUrl: 'https://youtu.be/abcDEF12345', playerIds: ['p1'] };
const player: Player = { id: 'p1', teamId: 't1', number: 10, name: '山田 太郎' };

test('headers are the 19 spec columns', () => {
  expect(LOG_HEADERS).toEqual(['記録ID', '試合日', '対戦相手', '形式', '前後半', '背番号', '名前', 'プレー', '種類', '足', '成功', '始点レーン', '始点ゾーン', '終点レーン', '終点ゾーン', '向きの手修正', '再生位置（秒）', '映像リンク', '記録日時']);
});

test('eventRow for overridden pass', () => {
  const e = ev({ id: 'x', half: '2H', passDirectionOverride: 'lateral', startZone: { lane: 2, col: 3 }, endZone: { lane: 4, col: 4 }, videoTimeSec: 754.6 });
  expect(eventRow(e, match, player)).toEqual([
    'x', '2026-10-13', 'テストFC', '8人制', '後半', 10, '山田 太郎', 'パス', '横', '', '成功', 2, 3, 4, 4, '横', 754.6,
    'https://www.youtube.com/watch?v=abcDEF12345&t=754s', '2026-10-13T00:00:00.000Z',
  ]);
});

test('eventRow for shot', () => {
  const e = ev({ type: 'shot', subtype: 'off_target', foot: 'L', success: false, endZone: null });
  const r = eventRow(e, match, player);
  expect(r.slice(7, 11)).toEqual(['シュート', '枠外', 'L', '失敗']);
  expect(r.slice(13, 16)).toEqual(['', '', '']);
});

test('videoLink floors seconds', () => {
  expect(videoLink('https://youtu.be/abcDEF12345', 0.9)).toBe('https://www.youtube.com/watch?v=abcDEF12345&t=0s');
});

test('csv has BOM, header, CRLF and quoting', () => {
  const csv = eventsToCsv([['a,b', 'say "hi"', 3, true]]);
  expect(csv.startsWith('﻿記録ID,')).toBe(true);
  expect(csv.split('\r\n')[1]).toBe('"a,b","say ""hi""",3,true');
});

import { readFileSync } from 'node:fs';

test('Code.gs has the same log headers', () => {
  const gs = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
  expect(gs).toContain(`['${LOG_HEADERS.join("', '")}']`);
});
