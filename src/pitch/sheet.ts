import type { Zone } from '../domain/types';
import { PITCH } from './geometry';
import { project, SHEET } from './perspective';
import { spread, zoneSlots, type Pt } from './render';

/**
 * 見本の資料と同じ見た目のピッチの図（白地・黒い線・縦向きの台形）。
 * 印は手書きのメモのとおり：パス＝緑/赤の矢印、コンドゥクシオン＝青/赤の波線、
 * レガーテ・プロテクション・1対1・空中戦＝丸に文字、ボール奪取＝サッカーボール、シュート＝○/×
 */
export type SheetIcon = 'L' | 'P' | '1' | '空' | 'ball' | 'shot-on' | 'shot-off';
export interface SheetArrow { from: Zone; to: Zone; kind: 'pass' | 'conduccion'; success: boolean }
export interface SheetMark { zone: Zone; icon: SheetIcon; success: boolean }
export interface SheetPitchOptions { label: '1st' | '2nd'; arrows: SheetArrow[]; marks: SheetMark[] }

const INK = '#111111';
const PASS_OK = '#1fd655';
const FAIL = '#ff2a2a';
const BLUE = '#1f3dff';
const GRASS = '#2f8f4e';
const WHITE = '#ffffff';

/** 図の地の色。white は PDF・結果画面、green はスプレッドシート用 */
export type Ground = 'white' | 'green';
const lineColor = (g: Ground) => (g === 'green' ? WHITE : INK);
const passOk = (g: Ground) => (g === 'green' ? WHITE : PASS_OK);

const f = (n: number) => +n.toFixed(2);
const P = (x: number, y: number) => project(x, y);

/** 平らな座標の点の列を、台形に写した折れ線にする */
function poly(pts: [number, number][], close = false): string {
  return pts.map(([x, y], i) => {
    const p = P(x, y);
    return `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`;
  }).join(' ') + (close ? ' Z' : '');
}

const rect = (x0: number, y0: number, x1: number, y1: number) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true);

/** 円や弧（平らな座標で 48 点に分けて写す） */
function arc(cx: number, cy: number, r: number, from = 0, to = 2 * Math.PI): string {
  const n = 48;
  return poly(Array.from({ length: n + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
  }));
}

function markings(ground: Ground): string {
  const { w, h } = PITCH;
  // ペナルティアークは、ペナルティエリアの外に出る部分だけ
  const arcA = Math.acos(5.5 / 9.15);
  const d = [
    rect(0, 0, w, h),
    poly([[w / 2, 0], [w / 2, h]]),
    arc(w / 2, h / 2, 9.15),
    rect(0, 13.84, 16.5, 54.16), rect(w - 16.5, 13.84, w, 54.16),
    rect(0, 24.84, 5.5, 43.16), rect(w - 5.5, 24.84, w, 43.16),
    rect(-2, 30.34, 0, 37.66), rect(w, 30.34, w + 2, 37.66),
    arc(11, h / 2, 9.15, -arcA, arcA), arc(w - 11, h / 2, 9.15, Math.PI - arcA, Math.PI + arcA),
    arc(0, 0, 1, 0, Math.PI / 2), arc(0, h, 1, -Math.PI / 2, 0),
    arc(w, 0, 1, Math.PI / 2, Math.PI), arc(w, h, 1, Math.PI, 1.5 * Math.PI),
  ].join(' ');
  const ink = lineColor(ground);
  const spots = [[11, h / 2], [w / 2, h / 2], [w - 11, h / 2]]
    .map(([x, y]) => { const p = P(x, y); return `<circle cx="${f(p.x)}" cy="${f(p.y)}" r=".45" fill="${ink}"/>`; }).join('');
  return `<path d="${d}" fill="none" stroke="${ink}" stroke-width=".3" stroke-linejoin="round"/>${spots}`;
}

function zoneLines(ground: Ground): string {
  const ink = lineColor(ground);
  const fade = ground === 'green' ? ' stroke-opacity=".55"' : '';
  const line = (a: Pt, b: Pt) => `<line class="zone-line" x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" stroke="${ink}"${fade} stroke-width=".25" stroke-dasharray="1.2 1"/>`;
  const lanes = [1, 2, 3, 4].map((k) => line(P(0, (k * PITCH.h) / 5), P(PITCH.w, (k * PITCH.h) / 5)));
  const cols = [1, 2, 4, 5].map((c) => line(P((c * PITCH.w) / 6, 0), P((c * PITCH.w) / 6, PITCH.h)));
  return lanes.join('') + cols.join('');
}

/** 見本のような細かい波線（画面の上での波。奥でも同じ細かさ） */
function wavePath(p: Pt, q: Pt, tail: number): string {
  const len = Math.hypot(q.x - p.x, q.y - p.y);
  const ux = (q.x - p.x) / len;
  const uy = (q.y - p.y) / len;
  const body = Math.max(0.1, len - tail);
  const steps = Math.max(12, Math.round(body / 0.2));
  const pts = [`M${f(p.x)} ${f(p.y)}`];
  for (let i = 1; i <= steps; i++) {
    const d = (body * i) / steps;
    const side = 0.45 * Math.sin((d / 1.4) * 2 * Math.PI);
    pts.push(`L${f(p.x + ux * d - uy * side)} ${f(p.y + uy * d + ux * side)}`);
  }
  pts.push(`L${f(q.x)} ${f(q.y)}`);
  return pts.join(' ');
}

const arrowColor = (a: SheetArrow, g: Ground) => (!a.success ? FAIL : a.kind === 'pass' ? passOk(g) : BLUE);
const markerId = (c: string) => `ah${c.slice(1)}`;

function arrowLayer(arrows: SheetArrow[], ground: Ground): string {
  const pos = spread(arrows.map((a) => ({ from: a.from, to: a.to, kind: a.kind === 'pass' ? 'pass' : 'dribble', success: a.success })));
  return arrows.map((a, i) => {
    const flatP = pos[i].p;
    let flatQ = pos[i].q;
    // 同じマスの中で終わるときも向きが分かるよう、少し前（相手ゴール側）へ伸ばす
    if (Math.hypot(flatQ.x - flatP.x, flatQ.y - flatP.y) < 3) flatQ = { x: flatP.x + 6, y: flatP.y };
    const p = P(flatP.x, flatP.y);
    const q = P(flatQ.x, flatQ.y);
    const c = arrowColor(a, ground);
    const head = `class="arrow" data-kind="${a.kind}" data-ok="${a.success ? 1 : 0}"`;
    const paint = `fill="none" stroke="${c}" stroke-width=".35" stroke-linecap="round" marker-end="url(#${markerId(c)})"`;
    if (a.kind === 'pass') return `<line ${head} x1="${f(p.x)}" y1="${f(p.y)}" x2="${f(q.x)}" y2="${f(q.y)}" ${paint}/>`;
    return `<path ${head} d="${wavePath(p, q, 1)}" ${paint} stroke-linejoin="round"/>`;
  }).join('');
}

/** サッカーボール（白い丸に、真ん中の五角形と5本の線） */
function ball(cx: number, cy: number, c: string): string {
  const r = 1.25;
  const pent = (rad: number) => Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  });
  const inner = pent(0.45);
  const outer = pent(r);
  return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="#ffffff" stroke="${c}" stroke-width=".25"/>`
    + `<polygon points="${inner.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}" fill="${c}"/>`
    + inner.map(([x, y], i) => `<line x1="${f(x)}" y1="${f(y)}" x2="${f(outer[i][0])}" y2="${f(outer[i][1])}" stroke="${c}" stroke-width=".2"/>`).join('');
}

function icon(m: SheetMark, cx: number, cy: number, ground: Ground = 'white'): string {
  const c = m.success ? BLUE : FAIL;
  const ink = lineColor(ground);
  switch (m.icon) {
    case 'ball':
      return ball(cx, cy, m.success ? INK : FAIL);
    case 'shot-on':
      return `<circle cx="${f(cx)}" cy="${f(cy)}" r="1" fill="none" stroke="${ink}" stroke-width=".35"/>`;
    case 'shot-off': {
      const k = 0.9;
      return `<line x1="${f(cx - k)}" y1="${f(cy - k)}" x2="${f(cx + k)}" y2="${f(cy + k)}" stroke="${ink}" stroke-width=".35"/>`
        + `<line x1="${f(cx - k)}" y1="${f(cy + k)}" x2="${f(cx + k)}" y2="${f(cy - k)}" stroke="${ink}" stroke-width=".35"/>`;
    }
    default:
      return `<circle cx="${f(cx)}" cy="${f(cy)}" r="1.5" fill="#ffffff" stroke="${c}" stroke-width=".25"/>`
        + `<text x="${f(cx)}" y="${f(cy + 0.65)}" font-size="1.8" font-weight="700" fill="${c}" text-anchor="middle">${m.icon}</text>`;
  }
}

/** 印をマスごとにまとめて、マスの中に散らして置く */
function markLayer(marks: SheetMark[], ground: Ground): string {
  const groups = new Map<string, SheetMark[]>();
  for (const m of marks) {
    const k = `${m.zone.lane}-${m.zone.col}`;
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }
  const out: string[] = [];
  for (const list of groups.values()) {
    const slots = zoneSlots(list[0].zone, list.length);
    list.forEach((m, i) => {
      const p = P(slots[i].x, slots[i].y);
      out.push(`<g class="sheet-mark" data-icon="${m.icon}" data-ok="${m.success ? 1 : 0}" data-cx="${f(p.x)}" data-cy="${f(p.y)}">${icon(m, p.x, p.y, ground)}</g>`);
    });
  }
  return out.join('');
}

function defs(ground: Ground): string {
  return `<defs>${[passOk(ground), FAIL, BLUE].map((c) => `<marker id="${markerId(c)}" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="${c}"/></marker>`).join('')}</defs>`;
}

export function sheetPitchSvg(o: SheetPitchOptions, ground: Ground = 'white'): string {
  // 緑のときは白地の上に、ピッチの台形（project の四隅）だけを芝色で塗る
  const grass = ground === 'green' ? `<path d="M10 71 L110 71 L87.5 6 L32.5 6 Z" fill="${GRASS}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SHEET.w} ${SHEET.h}" font-family="-apple-system, 'Hiragino Sans', sans-serif">`
    + `${defs(ground)}<rect x="0" y="0" width="${SHEET.w}" height="${SHEET.h}" fill="#ffffff"/>${grass}`
    + `<text x="2" y="8" font-size="5" font-weight="500" fill="${INK}">${o.label}</text>`
    + `${markings(ground)}${zoneLines(ground)}${arrowLayer(o.arrows, ground)}${markLayer(o.marks, ground)}</svg>`;
}

/** 凡例の1つ分。kind はピッチの印と同じ描き方を選ぶ */
type LegendKind = 'pass' | 'conduccion' | SheetIcon;
const LEGEND_ITEMS: [LegendKind, string][] = [
  ['pass', 'パス'], ['conduccion', 'ドリブル'], ['L', 'レガーテ'], ['P', 'プロテクション'], ['ball', '奪取'],
  ['1', '1対1'], ['空', '空中戦'], ['shot-on', '枠内'], ['shot-off', '枠外'],
];
const LF = 2.6;
// 文字の幅の目安（全角は1文字、半角は0.6文字分）
const textW = (s: string) => [...s].reduce((w, c) => w + (c.charCodeAt(0) < 0x100 ? 0.6 : 1) * LF, 0);

function legendGlyph(kind: LegendKind, x: number, y: number, ground: Ground): { svg: string; w: number } {
  if (kind === 'pass' || kind === 'conduccion') {
    const p = { x, y };
    const q = { x: x + 6, y };
    const c = kind === 'pass' ? passOk(ground) : BLUE;
    const paint = `fill="none" stroke="${c}" stroke-width=".35" stroke-linecap="round" marker-end="url(#${markerId(c)})"`;
    return { w: 6, svg: kind === 'pass' ? `<line x1="${x}" y1="${y}" x2="${q.x}" y2="${y}" ${paint}/>` : `<path d="${wavePath(p, q, 1)}" ${paint} stroke-linejoin="round"/>` };
  }
  return { w: 3.2, svg: icon({ zone: { lane: 1, col: 1 }, icon: kind, success: true }, x + 1.6, y, ground) };
}

/** 印の意味を、ピッチの印と同じ絵で1行に並べた凡例。文字は短い名前だけ */
function buildLegend(ground: Ground): { svg: string; w: number; h: number } {
  const h = 6;
  const y = h / 2;
  const text = lineColor(ground);
  let x = 1;
  const parts: string[] = [];
  for (const [kind, label] of LEGEND_ITEMS) {
    const g = legendGlyph(kind, x, y, ground);
    const w = g.w + 0.8 + textW(label);
    parts.push(`<g class="legend-item" data-icon="${kind}" data-x="${f(x)}" data-w="${f(w)}">${g.svg}<text x="${f(x + g.w + 0.8)}" y="${f(y + LF * 0.36)}" font-size="${LF}" fill="${text}">${label}</text></g>`);
    x += w + 2.4;
  }
  // 色の見本：青・緑＝成功、赤＝失敗
  x += 0.6;
  parts.push(`<rect class="swatch-ok" x="${f(x)}" y="${f(y - 1)}" width="2" height="2" fill="${BLUE}"/><rect class="swatch-ok" x="${f(x + 2.2)}" y="${f(y - 1)}" width="2" height="2" fill="${passOk(ground)}"/>`
    + `<text x="${f(x + 5)}" y="${f(y + LF * 0.36)}" font-size="${LF}" fill="${text}">成功</text>`);
  x += 5 + textW('成功') + 2.4;
  parts.push(`<rect class="swatch-ng" x="${f(x)}" y="${f(y - 1)}" width="2" height="2" fill="${FAIL}"/><text x="${f(x + 2.8)}" y="${f(y + LF * 0.36)}" font-size="${LF}" fill="${text}">失敗</text>`);
  x += 2.8 + textW('失敗') + 1;
  const w = f(x);
  const bg = ground === 'green' ? `<rect x="0" y="0" width="${w}" height="${h}" fill="${GRASS}"/>` : '';
  return { w, h, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" font-family="-apple-system, 'Hiragino Sans', sans-serif">${defs(ground)}${bg}${parts.join('')}</svg>` };
}

const LEGEND = buildLegend('white');
const LEGEND_GREEN = buildLegend('green');
/** 凡例の縦横の大きさ（viewBox） */
export const LEGEND_SIZE = { w: LEGEND.w, h: LEGEND.h };
export function sheetLegendSvg(ground: Ground = 'white'): string {
  return (ground === 'green' ? LEGEND_GREEN : LEGEND).svg;
}
