import type { PlayerStats } from '../domain/stats';
import { LEGEND_SIZE } from '../pitch/sheet';
import { statBlocks } from './sheetTables';

export interface CellStyle { bg?: string; color?: string; bold?: boolean; size?: number; align?: 'left' | 'center' | 'right'; valign?: 'top' | 'middle'; wrap?: boolean }
export interface SheetCell { range: string; value?: string | number; style: CellStyle }
export interface SheetImage { key: string; col: number; row: number; offsetX: number; offsetY: number; width: number; height: number; pngBase64: string }
export interface SheetPngs { radar1H: string; radar2H: string; radarAll: string; map1st: string; map2nd: string; legend: string; field: string }
export interface SheetLayout {
  version: 1;
  colWidths: number[];
  rowHeights: number[];
  frame: SheetCell[];
  frameImages: SheetImage[];
  toolRange: 'A22:J53';
  tool: SheetCell[];
  toolImages: SheetImage[];
}

// 行の高さ（px）。ここ1か所で直す
const tableHeights = (): number[] => {
  const out: number[] = [];
  [4, 4, 4, 5].forEach((n, i) => {
    out.push(17, 15, 15, ...Array(n).fill(17));
    if (i < 3) out.push(3);
  });
  return out;
};
export const ROW_HEIGHTS: readonly number[] = [
  40, 22, ...Array(7).fill(28), ...Array(9).fill(22), 3, 187, 3,
  ...tableHeights(),
  350, 24, 350, 20, 170, 20, 100, 100,
];

const BAND = '#4a4a4a';
const MINT = '#6fe3cf';
const GREEN = '#2f8f4e';
const STRIPE = '#f4f4f4';
const band: CellStyle = { bg: BAND, color: MINT };
const blank: CellStyle = { wrap: true, valign: 'top', align: 'left' };

const colName = (c: number) => String.fromCharCode(64 + c); // 1 -> A
const a1 = (c1: number, r1: number, c2 = c1, r2 = r1) =>
  c1 === c2 && r1 === r2 ? `${colName(c1)}${r1}` : `${colName(c1)}${r1}:${colName(c2)}${r2}`;

function buildFrame(): SheetCell[] {
  const f: SheetCell[] = [];
  const add = (range: string, style: CellStyle = {}, value?: string | number) =>
    f.push(value === undefined ? { range, style } : { range, value, style });
  add('D1:G1', { color: '#999999', size: 8, align: 'left', valign: 'top' }, 'チームロゴ');
  add('A2:B2', band, '写真');
  add('C2:E2', band, '対戦');
  add('F2:J2', band, 'ポジション');
  add('A3:B9', blank);
  add('C3:C5', blank);
  add('D3:D5', { bold: true, size: 12 }, 'vs');
  add('E3:E5', blank);
  add('C6:E6', band, 'スコア');
  (['1st', '2nd', 'Total'] as const).forEach((t, i) => {
    add(`C${7 + i}`, band, t);
    add(`D${7 + i}:E${7 + i}`, blank);
  });
  add('F3:J9', { bg: GREEN });
  const left = ['名前', '映像LINK', '評価 1st', '評価 2nd', '出場ポジ', '個人テーマ（攻）', '個人テーマ（守）', '分析官', 'アシスト・ゴール'];
  const right = ['試合条件', '試合時間', '出場時間', 'KO時間', '天候', 'ピッチコンディション', 'フィジカル', 'メンタル', 'システム'];
  for (let i = 0; i < 9; i++) {
    const r = 10 + i;
    add(`A${r}:B${r}`, { ...band, align: 'left' }, left[i]);
    add(`C${r}:E${r}`, blank);
    add(`F${r}:G${r}`, { ...band, align: 'left' }, right[i]);
    add(`H${r}:J${r}`, blank);
  }
  add('A54:J54', {});
  add('A55:J55', { bg: GREEN });
  add('A56:J56', {});
  add('A57:J57', band, 'コメント');
  add('A58:J58', blank);
  add('A59:J59', band, '次節の課題');
  add('A60', band, '攻');
  add('B60:J60', blank);
  add('A61', band, '守');
  add('B61:J61', blank);
  return f;
}

function buildTool(stats: PlayerStats): SheetCell[] {
  const t: SheetCell[] = [];
  const add = (range: string, style: CellStyle = {}, value?: string | number) =>
    t.push(value === undefined ? { range, style } : { range, value, style });
  let top = 22;
  for (const b of statBlocks(stats)) {
    add(a1(1, top, 10, top), { ...band, size: 11 }, b.title);
    const l = top + 1;
    add(a1(1, l, 3, l), band, b.successLabel);
    add(a1(4, l, 6, l), band, b.failLabel);
    add(a1(7, l, 8, l), band, b.totalLabel);
    add(a1(9, l, 10, l), band, '成功率');
    const h = top + 2;
    ['', '前半', '後半', '', '前半', '後半', '前半', '後半', '前半', '後半'].forEach((v, i) =>
      add(a1(i + 1, h), {}, v === '' ? undefined : v));
    b.rows.forEach((row, k) => {
      const r = top + 3 + k;
      const st: CellStyle = k % 2 === 0 ? { bg: STRIPE } : {};
      const lab: CellStyle = { ...st, ...(row.label.length >= 7 ? { size: 8 } : {}) };
      add(a1(1, r), lab, row.label);
      add(a1(2, r), st, row.success[0]);
      add(a1(3, r), st, row.success[1]);
      add(a1(4, r), lab, row.label);
      add(a1(5, r), st, row.fail[0]);
      add(a1(6, r), st, row.fail[1]);
      add(a1(7, r), st, row.total[0]);
      add(a1(8, r), st, row.total[1]);
    });
    const first = top + 3;
    const last = top + 2 + b.rows.length;
    add(a1(9, first, 9, last), { bg: STRIPE, size: 12 }, b.rate[0]);
    add(a1(10, first, 10, last), { bg: STRIPE, size: 12 }, b.rate[1]);
    top = last + 2; // 次のブロックまで3pxのすき間行をはさむ
  }
  return t;
}

export function buildSheetLayout(stats: PlayerStats, png: SheetPngs): SheetLayout {
  // 左のずれが列の幅（72px）を超えないよう、超えた分は右の列に置き直す
  const img = (key: string, col: number, row: number, offsetX: number, offsetY: number, width: number, height: number, pngBase64: string): SheetImage =>
    ({ key, col: col + Math.floor(offsetX / 72), row, offsetX: offsetX % 72, offsetY, width, height, pngBase64 });
  const lw = Math.round((19 * LEGEND_SIZE.w) / LEGEND_SIZE.h);
  return {
    version: 1,
    colWidths: Array(10).fill(72),
    rowHeights: [...ROW_HEIGHTS],
    frame: buildFrame(),
    frameImages: [img('frame:field', 6, 3, 37, 1, 286, 194, png.field)],
    toolRange: 'A22:J53',
    tool: buildTool(stats),
    toolImages: [
      img('tool:radar-1H', 1, 20, 3, 10, 210, 168, png.radar1H),
      img('tool:radar-2H', 4, 20, 39, 10, 210, 168, png.radar2H),
      img('tool:radar-all', 8, 20, 3, 10, 210, 168, png.radarAll),
      img('tool:map-1st', 1, 54, 0, 0, 720, 350, png.map1st),
      img('tool:legend', 1, 55, Math.round((720 - lw) / 2), 2, lw, 19, png.legend),
      img('tool:map-2nd', 1, 56, 0, 0, 720, 350, png.map2nd),
    ],
  };
}
