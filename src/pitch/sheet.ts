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

function markings(): string {
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
  const spots = [[11, h / 2], [w / 2, h / 2], [w - 11, h / 2]]
    .map(([x, y]) => { const p = P(x, y); return `<circle cx="${f(p.x)}" cy="${f(p.y)}" r=".45" fill="${INK}"/>`; }).join('');
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width=".3" stroke-linejoin="round"/>${spots}`;
}

function zoneLines(): string {
  const line = (a: Pt, b: Pt) => `<line class="zone-line" x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" stroke="${INK}" stroke-width=".25" stroke-dasharray="1.2 1"/>`;
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

const arrowColor = (a: SheetArrow) => (!a.success ? FAIL : a.kind === 'pass' ? PASS_OK : BLUE);
const markerId = (c: string) => `ah${c.slice(1)}`;

function arrowLayer(arrows: SheetArrow[]): string {
  const pos = spread(arrows.map((a) => ({ from: a.from, to: a.to, kind: a.kind === 'pass' ? 'pass' : 'dribble', success: a.success })));
  return arrows.map((a, i) => {
    const flatP = pos[i].p;
    let flatQ = pos[i].q;
    // 同じマスの中で終わるときも向きが分かるよう、少し前（相手ゴール側）へ伸ばす
    if (Math.hypot(flatQ.x - flatP.x, flatQ.y - flatP.y) < 3) flatQ = { x: flatP.x + 6, y: flatP.y };
    const p = P(flatP.x, flatP.y);
    const q = P(flatQ.x, flatQ.y);
    const c = arrowColor(a);
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

function icon(m: SheetMark, cx: number, cy: number): string {
  const c = m.success ? BLUE : FAIL;
  switch (m.icon) {
    case 'ball':
      return ball(cx, cy, m.success ? INK : FAIL);
    case 'shot-on':
      return `<circle cx="${f(cx)}" cy="${f(cy)}" r="1" fill="none" stroke="${INK}" stroke-width=".35"/>`;
    case 'shot-off': {
      const k = 0.9;
      return `<line x1="${f(cx - k)}" y1="${f(cy - k)}" x2="${f(cx + k)}" y2="${f(cy + k)}" stroke="${INK}" stroke-width=".35"/>`
        + `<line x1="${f(cx - k)}" y1="${f(cy + k)}" x2="${f(cx + k)}" y2="${f(cy - k)}" stroke="${INK}" stroke-width=".35"/>`;
    }
    default:
      return `<circle cx="${f(cx)}" cy="${f(cy)}" r="1.5" fill="#ffffff" stroke="${c}" stroke-width=".25"/>`
        + `<text x="${f(cx)}" y="${f(cy + 0.65)}" font-size="1.8" font-weight="700" fill="${c}" text-anchor="middle">${m.icon}</text>`;
  }
}

/** 印をマスごとにまとめて、マスの中に散らして置く */
function markLayer(marks: SheetMark[]): string {
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
      out.push(`<g class="sheet-mark" data-icon="${m.icon}" data-ok="${m.success ? 1 : 0}" data-cx="${f(p.x)}" data-cy="${f(p.y)}">${icon(m, p.x, p.y)}</g>`);
    });
  }
  return out.join('');
}

function defs(): string {
  return `<defs>${[PASS_OK, FAIL, BLUE].map((c) => `<marker id="${markerId(c)}" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="${c}"/></marker>`).join('')}</defs>`;
}

export function sheetPitchSvg(o: SheetPitchOptions): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SHEET.w} ${SHEET.h}" font-family="-apple-system, 'Hiragino Sans', sans-serif">`
    + `${defs()}<rect x="0" y="0" width="${SHEET.w}" height="${SHEET.h}" fill="#ffffff"/>`
    + `<text x="2" y="8" font-size="5" font-weight="500" fill="${INK}">${o.label}</text>`
    + `${markings()}${zoneLines()}${arrowLayer(o.arrows)}${markLayer(o.marks)}</svg>`;
}
