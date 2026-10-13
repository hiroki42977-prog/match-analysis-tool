import { radarValues, rate, type Count, type HalfStats, type PlayerStats } from '../domain/stats';
import type { Half } from '../domain/types';

export type Cell = string | number | null;
export interface StatsSheet {
  values: Cell[][];
  percentRanges: string[];
  radar: { dataRange: string; anchors: Record<Half, string> };
}

const WIDTH = 11;
const BLOCK_START = 20; // パスの見出しは20行目

const pad = (r: Cell[]): Cell[] => [...r, ...Array(WIDTH - r.length).fill(null)];

type CountRow = { label: string; get: (h: HalfStats) => Count };

export function buildStatsSheet(title: string, s: PlayerStats): StatsSheet {
  const rows: Cell[][] = [[title], []];
  const r1 = radarValues(s['1H']);
  const r2 = radarValues(s['2H']);
  rows.push(
    ['項目', '前半', '後半'],
    ['パス', r1.pass, r2.pass],
    ['ドリブル', r1.dribble, r2.dribble],
    ['シュート（枠内）', r1.shot, r2.shot],
    ['守備', r1.defense, r2.defense],
  );
  while (rows.length < BLOCK_START - 1) rows.push([]);

  const percentRanges: string[] = [];
  const countBlock = (name: string, items: CountRow[]) => {
    const head = rows.length + 2; // 1始まりの行番号で、最初のデータ行
    rows.push([`${name}成功`, '前半', '後半', null, `${name}失敗`, '前半', '後半', null, `${name}成功率`, '前半', '後半']);
    for (const it of items) {
      const a = it.get(s['1H']);
      const b = it.get(s['2H']);
      rows.push([it.label, a.success, b.success, null, it.label, a.fail, b.fail, null, it.label, rate(a), rate(b)]);
    }
    percentRanges.push(`J${head}:K${head + items.length - 1}`);
    rows.push([]);
  };

  countBlock('パス', [
    { label: '前', get: (h) => h.pass.forward },
    { label: '横', get: (h) => h.pass.lateral },
    { label: '後ろ', get: (h) => h.pass.backward },
    { label: '合計', get: (h) => h.pass.total },
  ]);
  countBlock('ドリブル', [
    { label: 'レガーテ', get: (h) => h.dribble.regate },
    { label: 'コンドゥクシオン', get: (h) => h.dribble.conduccion },
    { label: 'プロテクション', get: (h) => h.dribble.proteccion },
    { label: '合計', get: (h) => h.dribble.total },
  ]);
  countBlock('守備', [
    { label: 'ボール奪取', get: (h) => h.defense.ball_recovery },
    { label: '1vs1', get: (h) => h.defense.one_vs_one },
    { label: '空中戦', get: (h) => h.defense.aerial },
    { label: '合計', get: (h) => h.defense.total },
  ]);

  // シュート: 成功の表は枠内、失敗の表は枠外の数（それ以外の行は0）
  rows.push(['シュート成功', '前半', '後半', null, 'シュート失敗', '前半', '後半']);
  const shotRows: [string, 'onR' | 'onL' | 'offR' | 'offL'][] = [['枠内(R)', 'onR'], ['枠内(L)', 'onL'], ['枠外(R)', 'offR'], ['枠外(L)', 'offL']];
  for (const [label, key] of shotRows) {
    const on = key.startsWith('on');
    const a = s['1H'].shot[key];
    const b = s['2H'].shot[key];
    rows.push([label, on ? a : 0, on ? b : 0, null, label, on ? 0 : a, on ? 0 : b]);
  }

  return { values: rows.map(pad), percentRanges, radar: { dataRange: 'A3:C7', anchors: { '1H': 'E2', '2H': 'I2' } } };
}
