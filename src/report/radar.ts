import type { RadarValues } from '../domain/stats';

// 軸は見本と同じく 上＝パス、右＝ドリブル、下＝守備、左＝シュート
const AXES: { key: keyof RadarValues; label: string; dx: number; dy: number }[] = [
  { key: 'pass', label: 'パス', dx: 0, dy: -1 },
  { key: 'dribble', label: 'ドリブル', dx: 1, dy: 0 },
  { key: 'defense', label: '守備', dx: 0, dy: 1 },
  { key: 'shot', label: 'シュート', dx: -1, dy: 0 },
];
const CX = 50;
const CY = 44;
const R = 28;
const f = (n: number) => +n.toFixed(2);
const points = (k: (i: number) => number) => AXES.map((a, i) => `${f(CX + a.dx * R * k(i))},${f(CY + a.dy * R * k(i))}`).join(' ');

/** 前半・後半のレーダーチャート（0〜100%、20% ごとの目盛り）。値が無い軸は真ん中 */
export function radarSvg(v: RadarValues, title: '前半' | '後半' | '全体', color: string): string {
  const grid = [20, 40, 60, 80, 100].map((lv) => `<polygon class="grid" data-level="${lv}" points="${points(() => lv / 100)}" fill="none" stroke="#d0d0d0" stroke-width=".3"/>`).join('');
  const ticks = [20, 40, 60, 80, 100].map((lv) => `<text x="${f(CX - 1)}" y="${f(CY - R * lv / 100 + 1)}" font-size="2.4" fill="#888888" text-anchor="end">${lv}%</text>`).join('');
  const spokes = AXES.map((a) => `<line x1="${CX}" y1="${CY}" x2="${f(CX + a.dx * R)}" y2="${f(CY + a.dy * R)}" stroke="#d0d0d0" stroke-width=".3"/>`).join('');
  const labels = AXES.map((a) => `<text x="${f(CX + a.dx * (R + 3))}" y="${f(CY + a.dy * (R + 3) + (a.dy > 0 ? 2.5 : a.dy < 0 ? 0 : 1))}" font-size="3" fill="#555555" text-anchor="${a.dx > 0 ? 'start' : a.dx < 0 ? 'end' : 'middle'}">${a.label}</text>`).join('');
  const value = `<polygon class="value" points="${points((i) => (v[AXES[i].key] ?? 0) / 100)}" fill="${color}" fill-opacity=".45" stroke="${color}" stroke-width=".6"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" font-family="-apple-system, 'Hiragino Sans', sans-serif">`
    + `<text x="50" y="6" font-size="4.5" font-weight="700" fill="#333333" text-anchor="middle">${title}</text>`
    + `${grid}${spokes}${value}${ticks}${labels}</svg>`;
}
