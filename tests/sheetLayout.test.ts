import { expect, test } from 'vitest';
import { computeStats } from '../src/domain/stats';
import { buildSheetLayout, ROW_HEIGHTS } from '../src/report/sheetLayout';
import { LEGEND_SIZE } from '../src/pitch/sheet';
import { ev } from './helpers';

const png = { radar1H: 'r1', radar2H: 'r2', radarAll: 'ra', map1st: 'm1', map2nd: 'm2', legend: 'lg', field: 'fd' };
const stats = computeStats([
  ev({ half: '1H', subtype: 'forward', success: true }),
  ev({ half: '1H', subtype: 'forward', success: false }),
]);
const L = buildSheetLayout(stats, png);
const at = <T extends { range: string }>(cells: T[], range: string) => cells.find((c) => c.range === range);
// 範囲の始まりと終わりの行
const rows = (range: string) => range.split(':').map((p) => Number(p.replace(/^[A-Z]+/, '')));

test('page sizes: 20 columns of 36px, page1 1055px, page2 1062px', () => {
  expect(L.colWidths).toEqual(Array(20).fill(36));
  expect(ROW_HEIGHTS).toHaveLength(59);
  expect(L.rowHeights).toEqual([...ROW_HEIGHTS]);
  const sum = (a: number, b: number) => ROW_HEIGHTS.slice(a - 1, b).reduce((x, y) => x + y, 0);
  expect(sum(1, 51)).toBe(1055);
  expect(sum(52, 59)).toBe(1062);
  expect(ROW_HEIGHTS[51]).toBe(380);
});

test('frame: labels, blanks, logo box and position field', () => {
  const label = { bg: '#4a4a4a', color: '#6fe3cf', size: 6, wrap: true };
  expect(at(L.frame, 'A7:B7')).toMatchObject({ value: '名前', style: label });
  expect(at(L.frame, 'A8:B8')?.value).toBe('Pコンディション');
  expect(at(L.frame, 'F10:G10')).toMatchObject({ value: '試合会場', style: label });
  expect(at(L.frame, 'F16:G16')?.value).toBe('アシスト');
  expect(at(L.frame, 'C7:E7')?.style).toEqual({ wrap: true, valign: 'top', align: 'left', size: 7 });
  expect(at(L.frame, 'H16:I16')?.style).toEqual({ wrap: true, valign: 'top', align: 'left', size: 7 });
  // ロゴは担当者が貼る。枠は作らず、1行目は空けておく
  expect(L.frame.filter((c) => rows(c.range)[0] === 1)).toEqual([]);
  expect(at(L.frame, 'A2:B6')).toMatchObject({ value: '写真', style: { wrap: true, valign: 'top', align: 'left', color: '#999999', size: 8 } });
  expect(at(L.frame, 'E2:E6')).toMatchObject({ value: 'vs', style: { bold: true, size: 11 } });
  expect(at(L.frame, 'H2:I2')).toMatchObject({ value: 'スコア', style: label });
  expect(at(L.frame, 'H5')).toMatchObject({ value: 'Total', style: { size: 8 } });
  expect(at(L.frame, 'J2:T16')?.style).toEqual({ bg: '#2f8f4e' });
  expect(at(L.frame, 'D53:T53')?.style).toEqual({ bg: '#2a6a2a' });
  expect(at(L.frame, 'D55:T55')).toMatchObject({ value: 'コメント', style: { bg: '#d9d9d9', bold: true, size: 9 } });
  expect(at(L.frame, 'D57:T57')?.value).toBe('次節の課題');
  expect(at(L.frame, 'D58:E58')).toMatchObject({ value: '攻撃', style: { bold: true, size: 9 } });
  expect(at(L.frame, 'D59:E59')?.value).toBe('守備');
  for (const r of ['D56:T56', 'F58:T58', 'F59:T59']) expect(at(L.frame, r)).toBeDefined();
  // 52・54行目（2ページ目の大きな画像の行）と表の範囲（20〜51行）にはセルを置かない
  for (const c of L.frame) {
    for (const r of rows(c.range)) {
      expect(r === 52 || r === 54).toBe(false);
      expect(r >= 20 && r <= 51).toBe(false);
    }
  }
});

test('tool: tables on the 20-column grid, rate merged', () => {
  expect(L.toolRange).toBe('A20:T51');
  expect(at(L.tool, 'A20:T20')).toMatchObject({ value: 'パス成功率', style: { bg: '#4a4a4a', color: '#6fe3cf', size: 10 } });
  expect(at(L.tool, 'A21:F21')?.style).toMatchObject({ size: 9 });
  expect(at(L.tool, 'Q21:T21')?.value).toBe('成功率');
  expect(at(L.tool, 'C22:D22')).toMatchObject({ value: '前半', style: { size: 9 } });
  expect(at(L.tool, 'A23:B23')?.value).toBe('前');
  expect(at(L.tool, 'C23:D23')?.value).toBe(1);
  expect(at(L.tool, 'I23:J23')?.value).toBe(1);
  expect(at(L.tool, 'Q23:R26')).toMatchObject({ value: '50%', style: { bg: '#f4f4f4', size: 12 } });
  expect(at(L.tool, 'S23:T26')?.value).toBe('-');
  expect(at(L.tool, 'A28:T28')?.value).toBe('ドリブル成功率');
  expect(at(L.tool, 'A44:T44')?.value).toBe('シュート成功率');
  expect(at(L.tool, 'Q47:R51')).toBeDefined();
  for (const c of L.tool) for (const r of rows(c.range)) expect(r >= 20 && r <= 51).toBe(true);
});

test('images: keys, places and sizes', () => {
  const lw = Math.round((18 * LEGEND_SIZE.w) / LEGEND_SIZE.h);
  const pick = (i: { key: string; col: number; row: number; offsetX: number; offsetY: number; width: number; height: number }) =>
    [i.key, i.col, i.row, i.offsetX, i.offsetY, i.width, i.height];
  expect(L.frameImages.map(pick)).toEqual([['frame:field', 10, 3, 0, 19, 396, 269]]);
  const lx = Math.floor((612 - lw) / 2);
  expect(L.toolImages.map(pick)).toEqual([
    ['tool:radar-1H', 1, 18, 16, 7, 220, 176],
    ['tool:radar-2H', 8, 18, 16, 7, 220, 176],
    ['tool:radar-all', 15, 18, 3, 11, 210, 168],
    ['tool:map-1st', 1, 52, 0, 0, 720, 380],
    ['tool:legend', 4 + Math.floor(lx / 36), 53, lx % 36, 2, lw, 18],
    ['tool:map-2nd', 1, 54, 0, 0, 720, 330],
  ]);
  expect(L.toolImages.find((i) => i.key === 'tool:map-1st')?.pngBase64).toBe('m1');
});

test('images: offsets stay inside the anchor cell', () => {
  for (const i of [...L.frameImages, ...L.toolImages]) {
    expect(i.offsetX).toBeGreaterThanOrEqual(0);
    expect(i.offsetX).toBeLessThan(36);
    expect(i.offsetY).toBeGreaterThanOrEqual(0);
    expect(i.offsetY).toBeLessThan(ROW_HEIGHTS[i.row - 1]);
  }
});

test('tool: table row labels are centered like the mockup', () => {
  expect(at(L.tool, 'A23:B23')?.style.align).toBeUndefined();
  expect(at(L.tool, 'G23:H23')?.style.align).toBeUndefined();
});

test('magnets: blue on the left and red on the right of the strip under the position field', () => {
  const n = 11;
  const M = buildSheetLayout(stats, png, { blue: Array.from({ length: n }, (_, i) => `b${i + 1}`), red: Array.from({ length: n }, (_, i) => `r${i + 1}`) });
  const mags = M.frameImages.filter((i) => i.key.startsWith('frame:magnet-'));
  expect(mags.map((i) => i.key)).toEqual([
    ...Array.from({ length: n }, (_, i) => `frame:magnet-blue-${i + 1}`),
    ...Array.from({ length: n }, (_, i) => `frame:magnet-red-${i + 1}`),
  ]);
  const top = (r: number) => ROW_HEIGHTS.slice(0, r - 1).reduce((a, b) => a + b, 0);
  const left = (c: number) => (c - 1) * 36;
  const fieldTop = top(2), fieldBottom = top(17), fieldLeft = left(10);
  mags.forEach((m, i) => {
    expect(m.width).toBe(16);
    expect(m.height).toBe(16);
    expect(m.offsetX).toBeLessThan(36);
    expect(m.offsetY).toBeLessThan(ROW_HEIGHTS[m.row - 1]);
    const x = left(m.col) + m.offsetX, y = top(m.row) + m.offsetY;
    expect(y).toBe(fieldBottom - 21);
    expect(y).toBeGreaterThan(fieldTop);
    expect(x).toBe(fieldLeft + (i < n ? 1 + i * 18 : 199 + (i - n) * 18));
  });
  expect(mags.find((m) => m.key === 'frame:magnet-red-3')?.pngBase64).toBe('r3');
  // 8人制なら 1〜8
  const E = buildSheetLayout(stats, png, { blue: ['1', '2', '3', '4', '5', '6', '7', '8'], red: ['1', '2', '3', '4', '5', '6', '7', '8'] });
  expect(E.frameImages.filter((i) => i.key.startsWith('frame:magnet-'))).toHaveLength(16);
});
