import { expect, test } from 'vitest';
import { sheetFigures } from '../src/report/build';
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
