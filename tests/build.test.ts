import { expect, test } from 'vitest';
import { defenseMarks, dribbleArrows, shotMarks } from '../src/report/build';
import { ev } from './helpers';

test('dribble arrows carry subtype letters', () => {
  const a = dribbleArrows([
    ev({ type: 'dribble', subtype: 'regate' }),
    ev({ type: 'dribble', subtype: 'conduccion', success: false }),
    ev({ type: 'dribble', subtype: 'proteccion' }),
  ]);
  expect(a.map((x) => x.tag)).toEqual(['レ', 'コ', 'プ']);
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
