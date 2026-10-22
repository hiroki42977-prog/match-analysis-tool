import { expect, test } from 'vitest';
import { project } from '../src/pitch/perspective';
import { sheetPitchSvg, type SheetMark } from '../src/pitch/sheet';

const close = (p: { x: number; y: number }, x: number, y: number) => {
  expect(p.x).toBeCloseTo(x);
  expect(p.y).toBeCloseTo(y);
};

test('project: corners and halfway line', () => {
  close(project(0, 0), 10, 71);
  close(project(0, 68), 110, 71);
  close(project(105, 0), 32.5, 6);
  close(project(105, 68), 87.5, 6);
  const mid = project(52.5, 34);
  expect(mid.x).toBeCloseTo(60);
  // 奥が縮むので、ハーフウェーラインは真ん中より上
  expect(mid.y).toBeLessThan((71 + 6) / 2);
});

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('white sheet, black lines, dashed zone lines', () => {
  const svg = sheetPitchSvg({ label: '1st', arrows: [], marks: [] });
  expect(svg).not.toContain('#2f8f4e');
  expect(count(svg, /class="zone-line"[^>]*stroke-dasharray/g)).toBe(8);
  expect(svg).toContain('>1st<');
});

test('pass and conduccion colors, no start dots', () => {
  const z = (lane: number, col: number) => ({ lane, col });
  const svg = sheetPitchSvg({ label: '1st', marks: [], arrows: [
    { from: z(3, 2), to: z(3, 4), kind: 'pass', success: true },
    { from: z(2, 2), to: z(2, 4), kind: 'pass', success: false },
    { from: z(4, 2), to: z(4, 4), kind: 'conduccion', success: true },
    { from: z(5, 2), to: z(5, 4), kind: 'conduccion', success: false },
  ] });
  expect(svg).toMatch(/<line class="arrow" data-kind="pass" data-ok="1"[^>]*stroke="#1fd655"/);
  expect(svg).toMatch(/<line class="arrow" data-kind="pass" data-ok="0"[^>]*stroke="#ff2a2a"/);
  expect(svg).toMatch(/<path class="arrow" data-kind="conduccion" data-ok="1"[^>]*stroke="#1f3dff"/);
  expect(svg).toMatch(/<path class="arrow" data-kind="conduccion" data-ok="0"[^>]*stroke="#ff2a2a"/);
  expect(svg).not.toContain('class="start"');
});

const markG = (svg: string, icon: string, ok: boolean) => {
  const m = svg.match(new RegExp(`<g class="sheet-mark" data-icon="${icon}" data-ok="${ok ? 1 : 0}"[^>]*>(.*?)</g>`));
  expect(m, `${icon} ${ok}`).not.toBeNull();
  return m![1];
};

test('icons per handwritten memo', () => {
  const marks: SheetMark[] = (['L', 'P', '1', '空', 'ball', 'shot-on', 'shot-off'] as const)
    .flatMap((icon, i) => [true, false].map((success) => ({ zone: { lane: 1 + (i % 5), col: 1 + (i % 6) }, icon, success })));
  const svg = sheetPitchSvg({ label: '2nd', arrows: [], marks });
  for (const icon of ['L', 'P', '1', '空']) {
    const ok = markG(svg, icon, true);
    expect(ok).toMatch(/<circle[^>]*fill="#ffffff"[^>]*stroke="#1f3dff"/);
    expect(ok).toContain(`>${icon}</text>`);
    expect(markG(svg, icon, false)).toMatch(/<circle[^>]*fill="#ffffff"[^>]*stroke="#ff2a2a"/);
  }
  expect(markG(svg, 'ball', true)).toContain('#111111');
  expect(markG(svg, 'ball', false)).toContain('#ff2a2a');
  expect(markG(svg, 'shot-on', true)).toMatch(/<circle[^>]*stroke="#111111"/);
  expect(count(markG(svg, 'shot-off', false), /<line[^>]*stroke="#111111"/g)).toBe(2);
});

/** その高さでの台形の左右の辺 */
function edges(y: number) {
  const t = (y - 6) / (71 - 6);
  return { left: 32.5 + (10 - 32.5) * t, right: 87.5 + (110 - 87.5) * t };
}

test('12 marks in one zone stay inside the trapezoid', () => {
  for (const zone of [{ lane: 1, col: 6 }, { lane: 5, col: 1 }, { lane: 1, col: 1 }]) {
    const marks: SheetMark[] = Array.from({ length: 12 }, () => ({ zone, icon: 'ball', success: true }));
    const svg = sheetPitchSvg({ label: '1st', arrows: [], marks });
    const pts = [...svg.matchAll(/class="sheet-mark"[^>]*data-cx="([\d.]+)" data-cy="([\d.]+)"/g)].map((m) => ({ x: +m[1], y: +m[2] }));
    expect(pts).toHaveLength(12);
    for (const p of pts) {
      const e = edges(p.y);
      expect(p.x).toBeGreaterThan(e.left);
      expect(p.x).toBeLessThan(e.right);
      expect(p.y).toBeGreaterThan(6);
      expect(p.y).toBeLessThan(71);
    }
  }
});

test('zone of lane 1 is on the left, col 6 at the top', () => {
  const svg = sheetPitchSvg({ label: '1st', arrows: [], marks: [{ zone: { lane: 1, col: 6 }, icon: 'L', success: true }] });
  const m = svg.match(/class="sheet-mark"[^>]*data-cx="([\d.]+)" data-cy="([\d.]+)"/)!;
  expect(+m[1]).toBeLessThan(60);
  expect(+m[2]).toBeLessThan(38);
});

import { sheetLegendSvg } from '../src/pitch/sheet';

test('legend: every mark in one row, drawn like on the pitch', () => {
  const svg = sheetLegendSvg();
  const items = [...svg.matchAll(/<g class="legend-item" data-icon="([^"]+)"/g)].map((m) => m[1]);
  expect(items).toEqual(['pass', 'conduccion', 'L', 'P', 'ball', '1', '空', 'shot-on', 'shot-off']);
  for (const label of ['パス', 'ドリブル', 'レガーテ', 'プロテクション', '奪取', '1対1', '空中戦', '枠内', '枠外', '成功', '失敗']) {
    expect(svg).toContain(`>${label}</text>`);
  }
  // 成功の色（青・緑）と失敗の色（赤）の見本
  expect(svg).toMatch(/class="swatch-ok"[^>]*fill="#1f3dff"/);
  expect(svg).toMatch(/class="swatch-ok"[^>]*fill="#1fd655"/);
  expect(svg).toMatch(/class="swatch-ng"[^>]*fill="#ff2a2a"/);
  // ピッチの印と同じ描き方（丸に文字は白い中に青のふち）
  expect(svg).toMatch(/data-icon="L"[^>]*>.*?<circle[^>]*fill="#ffffff"[^>]*stroke="#1f3dff"/);
});

test('legend items do not overlap', () => {
  const xs = [...sheetLegendSvg().matchAll(/<g class="legend-item"[^>]*data-x="([\d.]+)" data-w="([\d.]+)"/g)].map((m) => [+m[1], +m[2]]);
  for (let i = 1; i < xs.length; i++) expect(xs[i][0]).toBeGreaterThanOrEqual(xs[i - 1][0] + xs[i - 1][1]);
});

test('green ground: grass trapezoid, white lines, white pass arrows', () => {
  const z = (lane: number, col: number) => ({ lane, col });
  const svg = sheetPitchSvg({ label: '1st', marks: [], arrows: [
    { from: z(3, 2), to: z(3, 4), kind: 'pass', success: true },
    { from: z(2, 2), to: z(2, 4), kind: 'pass', success: false },
  ] }, 'green');
  expect(svg).toContain('fill="#2f8f4e"');
  expect(svg).toMatch(/<line class="arrow" data-kind="pass" data-ok="1"[^>]*stroke="#ffffff"/);
  expect(svg).toMatch(/<line class="arrow" data-kind="pass" data-ok="0"[^>]*stroke="#ff2a2a"/);
  expect(svg).toMatch(/class="zone-line"[^>]*stroke="#ffffff"/);
  expect(svg).not.toContain('#1fd655');
});

test('white ground stays the same as before', () => {
  const o = { label: '2nd' as const, arrows: [], marks: [] };
  expect(sheetPitchSvg(o)).toBe(sheetPitchSvg(o, 'white'));
  expect(sheetPitchSvg(o)).not.toContain('#2f8f4e');
});

test('green legend: grass background, white text, white pass glyph', () => {
  const svg = sheetLegendSvg('green');
  expect(svg).toMatch(/<rect[^>]*fill="#2f8f4e"/);
  expect(svg).toMatch(/fill="#ffffff">パス</);
  expect(svg).not.toContain('#1fd655');
  expect(sheetLegendSvg()).not.toContain('#2f8f4e');
});
