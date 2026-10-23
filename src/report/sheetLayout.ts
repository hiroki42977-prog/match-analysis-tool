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
  toolRange: 'A20:T51';
  tool: SheetCell[];
  toolImages: SheetImage[];
}

// 行の高さ（px）。ここ1か所で直す
const tableHeights = (): number[] => {
  const out: number[] = [];
  [4, 4, 4, 5].forEach((n, i) => {
    out.push(17, 15, 15, ...Array(n).fill(16));
    if (i < 3) out.push(3);
  });
  return out;
};
// 本物のスプレッドシート（A4・縦・幅に合わせる・余白 標準）で1ページに入るのは約1090px だったので、各ページ 1060px 前後にする
export const ROW_HEIGHTS: readonly number[] = [
  30, ...Array(5).fill(26), ...Array(10).fill(23), 3, 190, 3,
  ...tableHeights(),
  380, 22, 330, 20, 110, 20, 90, 90,
];
const COL_WIDTHS: readonly number[] = Array(20).fill(36);

const BAND = '#4a4a4a';
const MINT = '#6fe3cf';
const GREEN = '#2f8f4e';
const STRIPE = '#f4f4f4';
const band: CellStyle = { bg: BAND, color: MINT };
const label: CellStyle = { ...band, size: 6, wrap: true };
const blank: CellStyle = { wrap: true, valign: 'top', align: 'left' };
const itemBlank: CellStyle = { ...blank, size: 7 };

const colName = (c: number) => String.fromCharCode(64 + c); // 1 -> A
const a1 = (c1: number, r1: number, c2 = c1, r2 = r1) =>
  c1 === c2 && r1 === r2 ? `${colName(c1)}${r1}` : `${colName(c1)}${r1}:${colName(c2)}${r2}`;

function buildFrame(): SheetCell[] {
  const f: SheetCell[] = [];
  const add = (range: string, style: CellStyle = {}, value?: string | number) =>
    f.push(value === undefined ? { range, style } : { range, value, style });
  add('H1:M1', { color: '#999999', size: 8, align: 'left', valign: 'top' }, 'チームロゴ');
  add('A2:B6', { ...blank, color: '#999999', size: 8 }, '写真');
  add('C2:D6', blank);
  add('E2:E6', { bold: true, size: 11 }, 'vs');
  add('F2:G6', blank);
  add('H2:I2', label, 'スコア');
  (['1st', '2nd', 'Total'] as const).forEach((t, i) => {
    add(`H${3 + i}`, { size: 8 }, t);
    add(`I${3 + i}`, itemBlank);
  });
  add('H6:I6', itemBlank);
  add('J2:T16', { bg: GREEN });
  const left = ['名前', 'Pコンディション', 'Mコンディション', '評価1st', '評価2nd', '出場ポジション', '個人テーマ（攻撃）', '個人テーマ（守備）', '分析官', 'アシスタント'];
  const right = ['試合条件', '試合時間', '出場時間', '試合会場', 'キックオフ時間', '天候', 'ピッチコンディション', 'システム', '得点', 'アシスト'];
  for (let i = 0; i < 10; i++) {
    const r = 7 + i;
    add(`A${r}:B${r}`, label, left[i]);
    add(`C${r}:E${r}`, itemBlank);
    add(`F${r}:G${r}`, label, right[i]);
    add(`H${r}:I${r}`, itemBlank);
  }
  // 52・54行目は2ページ目の大きな画像だけ。セルは置かない
  add('D53:T53', { bg: '#2a6a2a' });
  const head: CellStyle = { bg: '#d9d9d9', bold: true, size: 9 };
  add('D55:T55', head, 'コメント');
  add('D56:T56', blank);
  add('D57:T57', head, '次節の課題');
  add('D58:E58', { bold: true, size: 9 }, '攻撃');
  add('F58:T58', blank);
  add('D59:E59', { bold: true, size: 9 }, '守備');
  add('F59:T59', blank);
  return f;
}

function buildTool(stats: PlayerStats): SheetCell[] {
  const t: SheetCell[] = [];
  // 表の k 列目（1〜10）はシートの 2k-1〜2k 列をつなげて使う
  const add = (k1: number, r1: number, k2: number, r2: number, style: CellStyle = {}, value?: string | number) => {
    const range = a1(2 * k1 - 1, r1, 2 * k2, r2);
    t.push(value === undefined ? { range, style } : { range, value, style });
  };
  let top = 20;
  for (const b of statBlocks(stats)) {
    add(1, top, 10, top, { ...band, size: 10 }, b.title);
    const l = top + 1;
    const lab: CellStyle = { ...band, size: 9 };
    add(1, l, 3, l, lab, b.successLabel);
    add(4, l, 6, l, lab, b.failLabel);
    add(7, l, 8, l, lab, b.totalLabel);
    add(9, l, 10, l, lab, '成功率');
    const h = top + 2;
    ['', '前半', '後半', '', '前半', '後半', '前半', '後半', '前半', '後半'].forEach((v, i) =>
      add(i + 1, h, i + 1, h, { size: 9 }, v === '' ? undefined : v));
    b.rows.forEach((row, k) => {
      const r = top + 3 + k;
      const st: CellStyle = k % 2 === 0 ? { bg: STRIPE } : {};
      const rl: CellStyle = { ...st, ...(row.label.length >= 7 ? { size: 8 } : {}) };
      add(1, r, 1, r, rl, row.label);
      add(2, r, 2, r, st, row.success[0]);
      add(3, r, 3, r, st, row.success[1]);
      add(4, r, 4, r, rl, row.label);
      add(5, r, 5, r, st, row.fail[0]);
      add(6, r, 6, r, st, row.fail[1]);
      add(7, r, 7, r, st, row.total[0]);
      add(8, r, 8, r, st, row.total[1]);
    });
    const first = top + 3;
    const last = top + 2 + b.rows.length;
    add(9, first, 9, last, { bg: STRIPE, size: 12 }, b.rate[0]);
    add(10, first, 10, last, { bg: STRIPE, size: 12 }, b.rate[1]);
    top = last + 2; // 次のブロックまで3pxのすき間行をはさむ
  }
  return t;
}

// 画像のずれが置くセルの幅・高さより大きいと、スプレッドシートで位置が崩れる。
// はみ出す分だけセルを右・下にずらして、ずれをセルの中に収める
function img(key: string, col: number, row: number, offsetX: number, offsetY: number, width: number, height: number, pngBase64: string): SheetImage {
  while (offsetX >= COL_WIDTHS[col - 1]) { offsetX -= COL_WIDTHS[col - 1]; col++; }
  while (offsetY >= ROW_HEIGHTS[row - 1]) { offsetY -= ROW_HEIGHTS[row - 1]; row++; }
  return { key, col, row, offsetX, offsetY, width, height, pngBase64 };
}

// 範囲（列 c1〜c2・行 r1〜r2）の中央に置いたときのずれ（端数は切り捨て）
const center = (c1: number, c2: number, r1: number, r2: number, w: number, h: number) => {
  const sum = (a: readonly number[], i: number, j: number) => a.slice(i - 1, j).reduce((x, y) => x + y, 0);
  return [Math.floor((sum(COL_WIDTHS, c1, c2) - w) / 2), Math.floor((sum(ROW_HEIGHTS, r1, r2) - h) / 2)] as const;
};

export function buildSheetLayout(stats: PlayerStats, png: SheetPngs): SheetLayout {
  const lw = Math.round((18 * LEGEND_SIZE.w) / LEGEND_SIZE.h);
  const field = center(10, 20, 2, 16, 396, 269);
  const r1 = center(1, 7, 18, 18, 220, 176);
  const r2 = center(8, 14, 18, 18, 220, 176);
  const ra = center(15, 20, 18, 18, 210, 168);
  const lg = center(4, 20, 53, 53, lw, 18);
  return {
    version: 1,
    colWidths: [...COL_WIDTHS],
    rowHeights: [...ROW_HEIGHTS],
    frame: buildFrame(),
    frameImages: [img('frame:field', 10, 2, field[0], field[1], 396, 269, png.field)],
    toolRange: 'A20:T51',
    tool: buildTool(stats),
    toolImages: [
      img('tool:radar-1H', 1, 18, r1[0], r1[1], 220, 176, png.radar1H),
      img('tool:radar-2H', 8, 18, r2[0], r2[1], 220, 176, png.radar2H),
      img('tool:radar-all', 15, 18, ra[0], ra[1], 210, 168, png.radarAll),
      img('tool:map-1st', 1, 52, 0, 0, 720, 380, png.map1st),
      img('tool:legend', 4, 53, lg[0], 2, lw, 18, png.legend),
      img('tool:map-2nd', 1, 54, 0, 0, 720, 330, png.map2nd),
    ],
  };
}
