import { expect, test } from 'vitest';
import { computeStats } from '../src/domain/stats';
import { buildSheetLayout, ROW_HEIGHTS } from '../src/report/sheetLayout';
import { ev } from './helpers';

const png = { radar1H: 'r1', radar2H: 'r2', radarAll: 'ra', map1st: 'm1', map2nd: 'm2', legend: 'lg', field: 'fd' };
const stats = computeStats([
  ev({ half: '1H', subtype: 'forward', success: true }),
  ev({ half: '1H', subtype: 'forward', success: false }),
]);
const L = buildSheetLayout(stats, png);
const at = <T extends { range: string }>(cells: T[], range: string) => cells.find((c) => c.range === range);

test('page sizes: 10 columns of 72px, page1 1135px, page2 1134px', () => {
  expect(L.colWidths).toEqual(Array(10).fill(72));
  expect(ROW_HEIGHTS).toHaveLength(61);
  const sum = (a: number, b: number) => ROW_HEIGHTS.slice(a - 1, b).reduce((x, y) => x + y, 0);
  expect(sum(1, 53)).toBe(1135);
  expect(sum(54, 61)).toBe(1134);
});

test('frame: band labels, blanks and logo box', () => {
  expect(at(L.frame, 'A2:B2')).toMatchObject({ value: '写真', style: { bg: '#4a4a4a', color: '#6fe3cf' } });
  expect(at(L.frame, 'D1:G1')?.value).toBe('チームロゴ');
  expect(at(L.frame, 'C10:E10')).toMatchObject({ style: { wrap: true, valign: 'top' } });
  expect(at(L.frame, 'F15:G15')?.value).toBe('ピッチコンディション');
  expect(at(L.frame, 'B61:J61')).toBeDefined();
  expect(L.frame.every((c) => !/^[A-J](2[2-9]|[34]\d|5[0-3])/.test(c.range))).toBe(true); // 表の範囲には書かない
});

test('tool: pass table from statBlocks, rate merged', () => {
  expect(L.toolRange).toBe('A22:J53');
  expect(at(L.tool, 'A22:J22')?.value).toBe('パス成功率');
  expect(at(L.tool, 'A25')?.value).toBe('前');
  expect(at(L.tool, 'B25')?.value).toBe(1);
  expect(at(L.tool, 'E25')?.value).toBe(1);
  expect(at(L.tool, 'I25:I28')?.value).toBe('50%');
  expect(at(L.tool, 'J25:J28')?.value).toBe('-');
  expect(at(L.tool, 'A46:J46')?.value).toBe('シュート成功率');
  expect(at(buildSheetLayout(computeStats([]), png).tool, 'J25:J28')?.value).toBe('-');
});

test('images: keys and places', () => {
  expect(L.frameImages.map((i) => i.key)).toEqual(['frame:field']);
  expect(L.toolImages.map((i) => [i.key, i.col, i.row])).toEqual([
    ['tool:radar-1H', 1, 20], ['tool:radar-2H', 4, 20], ['tool:radar-all', 8, 20],
    ['tool:map-1st', 1, 54], ['tool:legend', 1, 55], ['tool:map-2nd', 1, 56],
  ]);
  expect(L.toolImages.find((i) => i.key === 'tool:map-1st')).toMatchObject({ width: 720, height: 350, pngBase64: 'm1' });
});
