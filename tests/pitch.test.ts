import { expect, test } from 'vitest';
import { zoneAt, zoneCenter, zoneRect } from '../src/pitch/geometry';
import { pitchSvg } from '../src/pitch/render';
import type { ZoneCell } from '../src/domain/stats';

test('zoneRect / zoneCenter', () => {
  expect(zoneRect({ lane: 1, col: 1 })).toEqual({ x: 0, y: 0, w: 17.5, h: 13.6 });
  expect(zoneRect({ lane: 5, col: 6 })).toEqual({ x: 87.5, y: 54.4, w: 17.5, h: 13.6 });
  expect(zoneCenter({ lane: 3, col: 4 }).x).toBeCloseTo(61.25);
  expect(zoneCenter({ lane: 3, col: 4 }).y).toBeCloseTo(34);
});

test('zoneAt', () => {
  expect(zoneAt(52.4, 34)).toEqual({ lane: 3, col: 3 });
  expect(zoneAt(52.6, 34)).toEqual({ lane: 3, col: 4 });
  expect(zoneAt(104.9, 67.9)).toEqual({ lane: 5, col: 6 });
  expect(zoneAt(-1, 10)).toBeNull();
  expect(zoneAt(10, 68.5)).toBeNull();
});

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('30 tappable zone rects', () => {
  expect(count(pitchSvg({}), /<rect[^>]*data-lane=/g)).toBe(30);
});

test('arrows', () => {
  const base = count(pitchSvg({}), /<circle/g);
  const dashed = pitchSvg({ arrows: [{ from: { lane: 1, col: 1 }, to: { lane: 1, col: 3 }, style: 'dashed' }] });
  expect(dashed).toContain('stroke-dasharray');
  expect(dashed).toContain('marker-end');
  const same = pitchSvg({ arrows: [{ from: { lane: 2, col: 2 }, to: { lane: 2, col: 2 }, style: 'solid' }] });
  expect(count(same, /<circle/g)).toBe(base + 1);
});

test('heat labels', () => {
  const heat: ZoneCell[] = [{ lane: 2, col: 2, count: 3, success: 2, rate: 2 / 3 }, { lane: 1, col: 1, count: 1, success: 0, rate: 0 }];
  const svg = pitchSvg({ heat });
  expect(svg).toContain('3本');
  expect(svg).toContain('67%');
  expect(svg).toContain('0%');
});

test('highlight marks zone', () => {
  expect(pitchSvg({ highlight: [{ lane: 3, col: 3 }] })).toMatch(/data-lane="3" data-col="3"[^>]*class="zone on"/);
});
