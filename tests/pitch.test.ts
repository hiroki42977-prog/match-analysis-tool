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

test('pass arrows: white solid / red dashed, with a start dot', () => {
  const ok = pitchSvg({ arrows: [{ from: { lane: 1, col: 1 }, to: { lane: 1, col: 3 }, kind: 'pass', success: true }] });
  expect(ok).toMatch(/<line[^>]*stroke="#ffffff"[^>]*marker-end="url\(#ah\)"/);
  expect(count(ok, /class="start"/g)).toBe(1);
  expect(ok).toMatch(/<circle class="start"[^>]*fill="#ffffff"/);
  const ng = pitchSvg({ arrows: [{ from: { lane: 1, col: 1 }, to: { lane: 1, col: 3 }, kind: 'pass', success: false }] });
  expect(ng).toMatch(/<line[^>]*stroke="#ff4d4f"[^>]*stroke-dasharray[^>]*marker-end="url\(#ah-red\)"/);
  expect(ng).toMatch(/<circle class="start"[^>]*fill="#ff4d4f"/);
});

test('arrows from the same zone are shifted apart', () => {
  const svg = pitchSvg({ arrows: [
    { from: { lane: 3, col: 2 }, to: { lane: 3, col: 4 }, kind: 'pass', success: true },
    { from: { lane: 3, col: 2 }, to: { lane: 2, col: 4 }, kind: 'pass', success: true },
    { from: { lane: 3, col: 2 }, to: { lane: 4, col: 4 }, kind: 'pass', success: false },
  ] });
  const starts = [...svg.matchAll(/<circle class="start" cx="([\d.]+)" cy="([\d.]+)"/g)].map((m) => `${m[1]},${m[2]}`);
  expect(starts).toHaveLength(3);
  expect(new Set(starts).size).toBe(3);
});

test('loop (same zone) arrows draw a ring, no start dot', () => {
  const base = count(pitchSvg({}), /<circle/g);
  const sameOk = pitchSvg({ arrows: [{ from: { lane: 2, col: 2 }, to: { lane: 2, col: 2 }, kind: 'pass', success: true }] });
  expect(count(sameOk, /<circle/g)).toBe(base + 1);
  const sameNg = pitchSvg({ arrows: [{ from: { lane: 2, col: 2 }, to: { lane: 2, col: 2 }, kind: 'pass', success: false }] });
  expect(count(sameNg, /<circle/g)).toBe(base + 2); // 暗い縁取り＋赤い丸
});

test('heat cells show ○/× counts and a success/fail bar', () => {
  const heat: ZoneCell[] = [{ lane: 2, col: 2, count: 4, success: 3, rate: 0.75 }, { lane: 1, col: 1, count: 1, success: 0, rate: 0 }];
  const svg = pitchSvg({ heat });
  expect(svg).toContain('4本 75%');
  expect(svg).toContain('○3');
  expect(svg).toContain('×1');
  expect(svg).toContain('1本 0%');
  expect(count(svg, /<rect class="bar-ok"/g)).toBe(1); // 成功0本のマスは白い棒なし
  expect(count(svg, /<rect class="bar-ng"/g)).toBe(2);
});

test('highlight marks zone', () => {
  expect(pitchSvg({ highlight: [{ lane: 3, col: 3 }] })).toMatch(/data-lane="3" data-col="3"[^>]*class="zone on"/);
});

test('marks: shape by kind, white = success / red = failure, spread inside the zone', () => {
  const z = { lane: 2, col: 2 };
  const svg = pitchSvg({ marks: [
    { zone: z, shape: 'circle', success: true },
    { zone: z, shape: 'triangle', success: false },
    { zone: z, shape: 'square', success: true },
    { zone: z, shape: 'diamond', success: false },
  ] });
  expect(count(svg, /class="mark"/g)).toBe(4);
  expect(svg).toMatch(/<circle class="mark"[^>]*fill="#ffffff"/);
  expect(svg).toMatch(/<polygon class="mark" data-shape="triangle"[^>]*fill="#ff4d4f"/);
  expect(svg).toMatch(/<rect class="mark"[^>]*fill="#ffffff"/);
  expect(svg).toMatch(/<polygon class="mark" data-shape="diamond"[^>]*fill="#ff4d4f"/);
  const xs = [...svg.matchAll(/data-cx="([\d.]+)" data-cy="([\d.]+)"/g)].map((m) => `${m[1]},${m[2]}`);
  expect(new Set(xs).size).toBe(4);
  for (const p of xs) {
    const [x, y] = p.split(',').map(Number);
    expect(x).toBeGreaterThan(17.5);
    expect(x).toBeLessThan(35);
    expect(y).toBeGreaterThan(13.6);
    expect(y).toBeLessThan(27.2);
  }
});


test('dribble line shape follows the move: zigzag / wave / coil', () => {
  const one = (move: 'regate' | 'conduccion' | 'proteccion', success = true) =>
    pitchSvg({ arrows: [{ from: { lane: 2, col: 1 }, to: { lane: 2, col: 4 }, kind: 'dribble', success, move }] });
  expect(one('regate')).toMatch(/<path class="dribble" data-style="zigzag"/);
  expect(one('conduccion')).toMatch(/<path class="dribble" data-style="wave"/);
  expect(one('proteccion')).toMatch(/<path class="dribble" data-style="coil"/);
  expect(one('regate', false)).toMatch(/<path class="dribble"[^>]*stroke="#ff4d4f"[^>]*stroke-dasharray/);
  expect(one('conduccion')).not.toMatch(/<line[^>]*marker-end/);
  expect(one('conduccion')).not.toContain('class="tag"');
});

test('dribble inside one zone still shows its line shape', () => {
  const svg = pitchSvg({ arrows: [{ from: { lane: 4, col: 4 }, to: { lane: 4, col: 4 }, kind: 'dribble', success: true, move: 'proteccion' }] });
  expect(svg).toMatch(/<path class="dribble" data-style="coil"/);
});

test('legend rows are drawn under a shrunk pitch, keeping the 113x76 frame', () => {
  const svg = pitchSvg({ legend: [[{ glyph: 'pass-ok', label: '成功' }, { glyph: 'pass-ng', label: '失敗' }]] });
  expect(svg).toContain('viewBox="-4 -4 113 76"');
  expect(svg).toMatch(/<svg x="[\d.-]+" y="-4" width="[\d.]+" height="[\d.]+" viewBox="-4 -4 113 76"/);
  expect(count(svg, /class="legend-item"/g)).toBe(2);
  expect(svg).toContain('>成功</text>');
  expect(svg).toContain('>失敗</text>');
  expect(count(pitchSvg({}), /<svg /g)).toBe(1); // 凡例なしなら入れ子にしない
});

test('every legend glyph renders', () => {
  const glyphs = ['pass-ok', 'pass-ng', 'zigzag', 'wave', 'coil', 'circle', 'triangle', 'square', 'diamond', 'ok', 'ng'] as const;
  const svg = pitchSvg({ legend: [glyphs.map((g) => ({ glyph: g, label: g }))] });
  expect(count(svg, /class="legend-item"/g)).toBe(glyphs.length);
});

test('a long legend row is shrunk to fit inside the frame', () => {
  const items = ['レガーテ', 'コンドゥクシオン', 'プロテクション', '成功', '失敗', 'ボール奪取'].map((label) => ({ glyph: 'wave' as const, label }));
  const svg = pitchSvg({ legend: [items] });
  const g = svg.match(/<g class="legend-row" transform="translate\(([\d.-]+) [\d.-]+\) scale\(([\d.]+)\)"/)!;
  const x = Number(g[1]);
  const scale = Number(g[2]);
  expect(scale).toBeLessThan(1);
  expect(x).toBeGreaterThanOrEqual(-4);
});

test('arrows ending in the same zone end at different points', () => {
  const svg = pitchSvg({ arrows: [
    { from: { lane: 1, col: 1 }, to: { lane: 1, col: 4 }, kind: 'pass', success: true },
    { from: { lane: 1, col: 2 }, to: { lane: 1, col: 4 }, kind: 'pass', success: true },
  ] });
  const ends = [...svg.matchAll(/<line x1="[\d.]+" y1="[\d.]+" x2="([\d.]+)" y2="([\d.]+)"[^>]*marker-end/g)].map((m) => `${m[1]},${m[2]}`);
  expect(ends).toHaveLength(2);
  expect(new Set(ends).size).toBe(2);
});

test('spread start points stay inside their zone', () => {
  const arrows = Array.from({ length: 6 }, (_, i) => ({ from: { lane: 3, col: 2 }, to: { lane: 1 + (i % 5), col: 5 }, kind: 'pass' as const, success: true }));
  const svg = pitchSvg({ arrows });
  for (const m of svg.matchAll(/<circle class="start" cx="([\d.]+)" cy="([\d.]+)"/g)) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    expect(x).toBeGreaterThan(17.5);
    expect(x).toBeLessThan(35);
    expect(y).toBeGreaterThan(27.2);
    expect(y).toBeLessThan(40.8);
  }
});
