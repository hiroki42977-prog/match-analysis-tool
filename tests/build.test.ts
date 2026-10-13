import { expect, test } from 'vitest';
import { defenseMarks, dribbleArrows, shotMarks, summary } from '../src/report/build';
import { ev } from './helpers';

test('dribble arrows carry the move', () => {
  const a = dribbleArrows([
    ev({ type: 'dribble', subtype: 'regate' }),
    ev({ type: 'dribble', subtype: 'conduccion', success: false }),
    ev({ type: 'dribble', subtype: 'proteccion' }),
  ]);
  expect(a.map((x) => x.move)).toEqual(['regate', 'conduccion', 'proteccion']);
  expect(a[1]).toMatchObject({ kind: 'dribble', success: false });
});

test('defense marks: 奪取=circle, 1対1=triangle, 空中戦=square', () => {
  const m = defenseMarks([
    ev({ type: 'defense', subtype: 'ball_recovery', endZone: null }),
    ev({ type: 'defense', subtype: 'one_vs_one', endZone: null, success: false }),
    ev({ type: 'defense', subtype: 'aerial', endZone: null }),
    ev({ type: 'pass' }),
  ]);
  expect(m.map((x) => [x.shape, x.success])).toEqual([['circle', true], ['triangle', false], ['square', true]]);
});

test('shot marks: R=circle, L=diamond, success = on target', () => {
  const m = shotMarks([
    ev({ type: 'shot', subtype: 'on_target', foot: 'R', success: true, endZone: null }),
    ev({ type: 'shot', subtype: 'off_target', foot: 'L', success: false, endZone: null }),
  ]);
  expect(m.map((x) => [x.shape, x.success])).toEqual([['circle', true], ['diamond', false]]);
});

test('one-line summaries', () => {
  const evs = [
    ev({ type: 'pass', success: true }), ev({ type: 'pass', success: true }), ev({ type: 'pass', success: true }), ev({ type: 'pass', success: false }),
    ev({ type: 'dribble', subtype: 'regate', success: false }),
    ev({ type: 'shot', subtype: 'on_target', foot: 'R', success: true, endZone: null }),
    ev({ type: 'shot', subtype: 'off_target', foot: 'L', success: false, endZone: null }),
  ];
  expect(summary('pass', evs)).toBe('パス 4本・成功 75%');
  expect(summary('dribble', evs)).toBe('ドリブル 1本・成功 0%');
  expect(summary('defense', evs)).toBe('守備 0本');
  expect(summary('shot', evs)).toBe('シュート 2本・枠内 50%');
  expect(summary('overall', evs)).toBe('パス 4本 75%・ドリブル 1本 0%・守備 0本');
});

import { mapFigures } from '../src/report/build';

test('overall and dribble maps are split into halves', () => {
  const evs = [
    ev({ half: '1H', type: 'dribble', subtype: 'regate' }),
    ev({ half: '2H', type: 'dribble', subtype: 'regate' }),
    ev({ half: '2H', type: 'dribble', subtype: 'proteccion', success: false }),
  ];
  const figs = mapFigures(evs);
  expect(figs.map((f) => f.key)).toEqual(['overall-1H', 'overall-2H', 'pass', 'dribble-1H', 'dribble-2H', 'defense', 'shot']);
  expect(figs.map((f) => f.title)).toEqual(['全体マップ（前半）', '全体マップ（後半）', 'パス', 'ドリブル（前半）', 'ドリブル（後半）', '守備', 'シュート']);
  expect(figs[3].summary).toBe('ドリブル 1本・成功 100%');
  expect(figs[4].summary).toBe('ドリブル 2本・成功 50%');
  expect(figs[4].svg.arrows).toHaveLength(2);
});
