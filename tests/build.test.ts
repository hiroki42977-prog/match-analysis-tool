import { expect, test } from 'vitest';
import { sheetError, sheetFigures, sheetNames, sheetSvgs } from '../src/report/build';
import { computeStats } from '../src/domain/stats';
import type { Match, Player } from '../src/domain/types';
import { LEGEND_SIZE } from '../src/pitch/sheet';
import { ev } from './helpers';

test('sheet figures: always 1st and 2nd', () => {
  expect(sheetFigures([])).toEqual([
    { key: '1H', label: '1st', svg: { label: '1st', arrows: [], marks: [] } },
    { key: '2H', label: '2nd', svg: { label: '2nd', arrows: [], marks: [] } },
  ]);
});

test('sheet figures: each play goes to the right shape', () => {
  const evs = [
    ev({ type: 'pass', success: true }),
    ev({ type: 'pass', success: false }),
    ev({ type: 'dribble', subtype: 'conduccion' }),
    ev({ type: 'dribble', subtype: 'regate', startZone: { lane: 2, col: 2 }, endZone: { lane: 2, col: 3 } }),
    ev({ type: 'dribble', subtype: 'proteccion' }),
    ev({ type: 'defense', subtype: 'ball_recovery', endZone: null }),
    ev({ type: 'defense', subtype: 'one_vs_one', endZone: null, success: false }),
    ev({ type: 'defense', subtype: 'aerial', endZone: null }),
    ev({ type: 'shot', subtype: 'on_target', foot: 'R', success: true, endZone: null }),
    ev({ type: 'shot', subtype: 'off_target', foot: 'L', success: false, endZone: null }),
  ];
  const [first, second] = sheetFigures(evs);
  expect(first.svg.arrows.map((a) => [a.kind, a.success])).toEqual([['pass', true], ['pass', false], ['conduccion', true]]);
  expect(first.svg.marks.map((m) => [m.icon, m.success])).toEqual([
    ['L', true], ['P', true], ['ball', true], ['1', false], ['空', true], ['shot-on', true], ['shot-off', false],
  ]);
  // レガーテは始めたマスに置く
  expect(first.svg.marks[0].zone).toEqual({ lane: 2, col: 2 });
  expect(second.svg).toEqual({ label: '2nd', arrows: [], marks: [] });
});

test('sheet figures: halves are split', () => {
  const [first, second] = sheetFigures([ev({ half: '1H' }), ev({ half: '2H' }), ev({ half: '2H' })]);
  expect(first.svg.arrows).toHaveLength(1);
  expect(second.svg.arrows).toHaveLength(2);
});

test('sheet names', () => {
  const m = { date: '2026-10-19', opponent: 'テストFC' } as Match;
  expect(sheetNames(m, { number: 10, name: '山田 太郎' } as Player, 'サンプルFC'))
    .toEqual({ playerFileName: '#10 山田 太郎（サンプルFC）', tabName: '10/19 vs テストFC' });
});

test('old receiver error is explained', () => {
  expect(sheetError('知らない操作です: buildSheet')).toContain('貼り替えが必要です');
  expect(sheetError('合言葉が違います')).toBe('合言葉が違います');
});

test('a non-JSON reply (Apps Script timed out) is explained', () => {
  const slow = '受け取り係の処理に時間がかかりすぎました。少し待ってから、もう一度「レポート作成」を押してください';
  expect(sheetError('The string did not match the expected pattern.')).toBe(slow);
  expect(sheetError("Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON")).toBe(slow);
  expect(sheetError('通信できませんでした')).toBe('通信できませんでした');
});

test('sheet svgs: green maps, three radars, under 1M pixels', () => {
  const evs = [ev({ half: '1H', type: 'pass', success: true })];
  const s = sheetSvgs(evs, computeStats(evs));
  expect(s.map1st.svg).toContain('>1st<');
  expect(s.map2nd.svg).toContain('#2a6a2a');      // 後半0件でも緑のピッチ
  expect(s.radarAll.svg).toContain('>全体<');
  for (const v of Object.values(s)) expect(v.w * v.scale * v.h * v.scale).toBeLessThan(1_000_000);
});

test('sheet svgs: sizes match the image slots of the sheet', () => {
  const s = sheetSvgs([], computeStats([]));
  const size = (k: keyof typeof s) => [s[k].w, s[k].h, s[k].scale];
  expect(size('radar1H')).toEqual([220, 176, 2]);
  expect(size('radar2H')).toEqual([220, 176, 2]);
  expect(size('radarAll')).toEqual([210, 168, 2]);
  expect(size('map1st')).toEqual([720, 380, 1.5]);
  expect(size('map2nd')).toEqual([720, 330, 1.5]);
  expect(size('legend')).toEqual([Math.round((18 * LEGEND_SIZE.w) / LEGEND_SIZE.h), 18, 2]);
  expect(size('field')).toEqual([396, 269, 2]);
  expect(s.map1st.svg).toContain('チームロゴ');
  expect(s.map2nd.svg).not.toContain('チームロゴ');
});
