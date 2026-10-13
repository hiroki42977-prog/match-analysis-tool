import { expect, test } from 'vitest';
import { computeStats, radarValues, rate, zoneCells } from '../src/domain/stats';
import { ev } from './helpers';

test('rate is null when denominator is 0', () => {
  expect(rate({ success: 0, fail: 0 })).toBeNull();
  expect(rate({ success: 3, fail: 1 })).toBe(0.75);
});

test('pass counts by effective direction', () => {
  const s = computeStats([
    ev({ subtype: 'forward', success: true }),
    ev({ subtype: 'forward', success: false }),
    ev({ subtype: 'forward', passDirectionOverride: 'lateral', success: true }),
  ]);
  expect(s.all.pass.forward).toEqual({ success: 1, fail: 1 });
  expect(s.all.pass.lateral).toEqual({ success: 1, fail: 0 });
  expect(s.all.pass.backward).toEqual({ success: 0, fail: 0 });
  expect(s.all.pass.total).toEqual({ success: 2, fail: 1 });
});

test('empty half gives zeros and null radar', () => {
  const s = computeStats([ev({ half: '1H' })]);
  expect(s['2H'].pass.total).toEqual({ success: 0, fail: 0 });
  expect(s['2H'].dribble.total).toEqual({ success: 0, fail: 0 });
  expect(radarValues(s['2H'])).toEqual({ pass: null, dribble: null, shot: null, defense: null });
  expect(radarValues(s['1H']).pass).toBe(100);
});

test('dribble and defense by subtype with totals', () => {
  const s = computeStats([
    ev({ type: 'dribble', subtype: 'regate', success: false }),
    ev({ type: 'dribble', subtype: 'proteccion', success: true }),
    ev({ type: 'defense', subtype: 'one_vs_one', success: true, endZone: null }),
  ]);
  expect(s.all.dribble.regate).toEqual({ success: 0, fail: 1 });
  expect(s.all.dribble.total).toEqual({ success: 1, fail: 1 });
  expect(s.all.defense.one_vs_one).toEqual({ success: 1, fail: 0 });
  expect(s.all.defense.total).toEqual({ success: 1, fail: 0 });
});

test('shots by target and foot', () => {
  const shot = (subtype: 'on_target' | 'off_target', foot: 'R' | 'L') =>
    ev({ type: 'shot', subtype, foot, success: subtype === 'on_target', endZone: null });
  const s = computeStats([shot('on_target', 'R'), shot('on_target', 'L'), shot('off_target', 'R')]);
  expect(s.all.shot).toEqual({ onR: 1, onL: 1, offR: 1, offL: 0, total: { success: 2, fail: 1 } });
  expect(radarValues(s.all).shot).toBeCloseTo(66.67, 1);
});

test('zoneCells counts by start zone, always 30 cells', () => {
  const cells = zoneCells(
    [
      ev({ type: 'dribble', subtype: 'regate', startZone: { lane: 2, col: 3 }, success: true }),
      ev({ type: 'dribble', subtype: 'regate', startZone: { lane: 2, col: 3 }, endZone: { lane: 4, col: 6 }, success: false }),
      ev({ type: 'pass', startZone: { lane: 2, col: 3 } }),
    ],
    'dribble',
  );
  expect(cells).toHaveLength(30);
  expect(cells[0]).toMatchObject({ lane: 1, col: 1 });
  expect(cells[6 + 2]).toEqual({ lane: 2, col: 3, count: 2, success: 1, rate: 0.5 });
  expect(cells.filter((c) => c.count === 0).every((c) => c.rate === null)).toBe(true);
  expect(cells.reduce((n, c) => n + c.count, 0)).toBe(2);
});

import { overallCells } from '../src/domain/stats';

test('overallCells counts pass/dribble/defense per start zone, shots excluded', () => {
  const z = { lane: 2, col: 3 };
  const cells = overallCells([
    ev({ type: 'pass', startZone: z, success: true }),
    ev({ type: 'pass', startZone: z, success: false }),
    ev({ type: 'dribble', subtype: 'regate', startZone: z, success: true }),
    ev({ type: 'defense', subtype: 'aerial', startZone: z, endZone: null, success: true }),
    ev({ type: 'shot', subtype: 'on_target', foot: 'R', startZone: z, endZone: null, success: true }),
  ]);
  expect(cells).toHaveLength(30);
  expect(cells[6 + 2]).toEqual({ lane: 2, col: 3, pass: 2, dribble: 1, defense: 1, count: 4, success: 3, rate: 0.75 });
  expect(cells[0]).toEqual({ lane: 1, col: 1, pass: 0, dribble: 0, defense: 0, count: 0, success: 0, rate: null });
});
