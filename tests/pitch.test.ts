import { expect, test } from 'vitest';
import { zoneAt, zoneCenter, zoneRect } from '../src/pitch/geometry';
import { pitchSvg } from '../src/pitch/render';
import type { OverallCell, ZoneCell } from '../src/domain/stats';

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

test('dribble arrows are wavy paths', () => {
  const ok = pitchSvg({ arrows: [{ from: { lane: 2, col: 1 }, to: { lane: 2, col: 4 }, kind: 'dribble', success: true }] });
  expect(ok).not.toMatch(/<line[^>]*marker-end/);
  const d = ok.match(/<path class="dribble" d="([^"]+)"/)![1];
  expect(d.split('L').length).toBeGreaterThan(10);
  const ng = pitchSvg({ arrows: [{ from: { lane: 2, col: 1 }, to: { lane: 2, col: 4 }, kind: 'dribble', success: false }] });
  expect(ng).toMatch(/<path class="dribble"[^>]*stroke="#ff4d4f"[^>]*stroke-dasharray/);
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

test('overall map shows breakdown per zone', () => {
  const overall: OverallCell[] = [{ lane: 2, col: 3, pass: 3, dribble: 2, defense: 1, count: 6, success: 4, rate: 4 / 6 }];
  const svg = pitchSvg({ overall });
  expect(svg).toContain('6本 67%');
  expect(svg).toContain('パ3 ド2 守1');
});

test('highlight marks zone', () => {
  expect(pitchSvg({ highlight: [{ lane: 3, col: 3 }] })).toMatch(/data-lane="3" data-col="3"[^>]*class="zone on"/);
});

test('dribble start dot carries the subtype letter', () => {
  const svg = pitchSvg({ arrows: [{ from: { lane: 2, col: 1 }, to: { lane: 2, col: 4 }, kind: 'dribble', success: true, tag: 'レ' }] });
  expect(svg).toMatch(/<circle class="start"[^>]*r="1.7"/);
  expect(svg).toMatch(/<text class="tag"[^>]*>レ<\/text>/);
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

test('overall labels have no white box, text is outlined instead', () => {
  const overall: OverallCell[] = [{ lane: 2, col: 3, pass: 3, dribble: 2, defense: 1, count: 6, success: 4, rate: 4 / 6 }];
  const svg = pitchSvg({ overall });
  expect(svg).not.toContain('fill-opacity=".88"');
  expect(count(svg, />パ3 ド2 守1<\/text>/g)).toBe(2); // ふち用と本体
  expect(svg).toMatch(/<text[^>]*stroke="#ffffff"[^>]*>パ3 ド2 守1<\/text>/);
});

test('dribble that stays in one zone shows its letter inside the ring', () => {
  const svg = pitchSvg({ arrows: [{ from: { lane: 4, col: 4 }, to: { lane: 4, col: 4 }, kind: 'dribble', success: true, tag: 'レ' }] });
  expect(svg).toMatch(/<text class="tag"[^>]*>レ<\/text>/);
});
