import type { ZoneCell } from '../domain/stats';
import type { Zone } from '../domain/types';
import { PITCH, zoneCenter, zoneRect } from './geometry';

export type DribbleMove = 'regate' | 'conduccion' | 'proteccion';
/**
 * パスはまっすぐな矢印、ドリブルは動きに合わせた線（レガーテ＝ジグザグ、コンドゥクシオン＝波線、プロテクション＝くるくる）。
 * 成功は白、失敗は赤い破線。始点には●を付ける
 */
export interface Arrow { from: Zone; to: Zone; kind: 'pass' | 'dribble'; success: boolean; move?: DribbleMove }

/** 守備・シュートの印。1プレー＝1つ。白＝成功、赤＝失敗 */
export interface Mark { zone: Zone; shape: 'circle' | 'triangle' | 'square' | 'diamond'; success: boolean }
export type Glyph = 'pass-ok' | 'pass-ng' | 'zigzag' | 'wave' | 'coil' | 'circle' | 'triangle' | 'square' | 'diamond' | 'ok' | 'ng';
export interface LegendItem { glyph: Glyph; label: string }
export interface PitchOptions { highlight?: Zone[]; heat?: ZoneCell[]; arrows?: Arrow[]; marks?: Mark[]; legend?: LegendItem[][]; title?: string }

// PNG 変換でもそのまま描けるよう、色はすべて属性で直接指定する
const GRASS = '#2f8f4e';
const GRASS_STRIPE = '#349a54';
const LINE = '#ffffff';
const ARROW = '#ffffff';
const ARROW_FAIL = '#ff4d4f';
const INK = '#0b3d1f';
const INK_FAIL = '#b42318';
// 赤は芝の緑と明るさが近く見えにくいので、下に暗い縁取りを敷く
const HALO = 'rgba(0,0,0,.45)';

const f = (n: number) => +n.toFixed(2);

function markings(): string {
  const { w, h } = PITCH;
  const stripes = [0, 2, 4].map((c) => `<rect x="${f(c * w / 6)}" y="0" width="${f(w / 6)}" height="${h}" fill="${GRASS_STRIPE}"/>`).join('');
  return `${stripes}<g fill="none" stroke="${LINE}" stroke-width=".5">
<rect x="0" y="0" width="${w}" height="${h}"/><line x1="52.5" y1="0" x2="52.5" y2="${h}"/><circle cx="52.5" cy="34" r="9.15"/>
<rect x="0" y="13.84" width="16.5" height="40.32"/><rect x="88.5" y="13.84" width="16.5" height="40.32"/>
<rect x="0" y="24.84" width="5.5" height="18.32"/><rect x="99.5" y="24.84" width="5.5" height="18.32"/>
<rect x="-2" y="30.34" width="2" height="7.32"/><rect x="105" y="30.34" width="2" height="7.32"/>
<path d="M16.5 26.7 A9.15 9.15 0 0 1 16.5 41.3"/><path d="M88.5 26.7 A9.15 9.15 0 0 0 88.5 41.3"/></g>
<g fill="${LINE}"><circle cx="52.5" cy="34" r=".6"/><circle cx="11" cy="34" r=".5"/><circle cx="94" cy="34" r=".5"/></g>`;
}

function zoneLines(): string {
  const xs = [1, 2, 3, 4, 5].filter((c) => c !== 3).map((c) => f(c * PITCH.w / 6));
  const ys = [1, 2, 3, 4].map((l) => f(l * PITCH.h / 5));
  return `<g stroke="rgba(255,255,255,.75)" stroke-width=".35" stroke-dasharray="1.2 1">${xs
    .map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="${PITCH.h}"/>`).join('')}${ys
    .map((y) => `<line x1="0" y1="${y}" x2="${PITCH.w}" y2="${y}"/>`).join('')}</g>`;
}

const pct = (r: number | null) => (r === null ? '-' : `${Math.round(r * 100)}%`);

/** マスを本数の多さで白く塗る（一番少ないマスでも文字が読める濃さにする） */
function shade(r: { x: number; y: number; w: number; h: number }, count: number, max: number): string {
  const a = 0.4 + 0.5 * (count / max);
  return `<rect x="${f(r.x + .4)}" y="${f(r.y + .4)}" width="${f(r.w - .8)}" height="${f(r.h - .8)}" rx=".8" fill="#ffffff" fill-opacity="${f(a)}"/>`;
}

function heatLayer(cells: ZoneCell[]): string {
  const max = Math.max(0, ...cells.map((c) => c.count));
  return cells.filter((c) => c.count > 0).map((c) => {
    const r = zoneRect(c);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const fail = c.count - c.success;
    // 成功（白）と失敗（赤）の割合の棒
    const bw = 12;
    const okW = bw * (c.success / c.count);
    const bx = cx - bw / 2;
    const by = cy + 3.2;
    const bar = `<rect x="${f(bx - .3)}" y="${f(by - .3)}" width="${f(bw + .6)}" height="2.2" rx=".5" fill="${INK}" fill-opacity=".55"/>`
      + (c.success ? `<rect class="bar-ok" x="${f(bx)}" y="${f(by)}" width="${f(okW)}" height="1.6" fill="#ffffff"/>` : '')
      + (fail ? `<rect class="bar-ng" x="${f(bx + okW)}" y="${f(by)}" width="${f(bw - okW)}" height="1.6" fill="${ARROW_FAIL}"/>` : '');
    return shade(r, c.count, max)
      + `<text x="${f(cx)}" y="${f(cy - 2.4)}" font-size="3" font-weight="700" fill="${INK}" text-anchor="middle">${c.count}本 ${pct(c.rate)}</text>`
      + `<text x="${f(cx)}" y="${f(cy + 1.6)}" font-size="2.7" font-weight="700" text-anchor="middle"><tspan fill="${INK}">○${c.success}</tspan><tspan fill="${INK_FAIL}" dx="2">×${fail}</tspan></text>`
      + bar;
  }).join('');
}

type Pt = { x: number; y: number };
const STYLE: Record<DribbleMove, 'zigzag' | 'wave' | 'coil'> = { regate: 'zigzag', conduccion: 'wave', proteccion: 'coil' };

/** 印の形を1つ描く */
function markShape(shape: Mark['shape'], cx: number, cy: number, size: number, attrs: string): string {
  if (shape === 'circle') return `<circle class="mark" cx="${f(cx)}" cy="${f(cy)}" r="${f(size)}" ${attrs}/>`;
  if (shape === 'square') return `<rect class="mark" x="${f(cx - size * .9)}" y="${f(cy - size * .9)}" width="${f(size * 1.8)}" height="${f(size * 1.8)}" ${attrs}/>`;
  const pts = shape === 'triangle'
    ? [[cx, cy - size * 1.15], [cx + size * 1.1, cy + size * .85], [cx - size * 1.1, cy + size * .85]]
    : [[cx, cy - size * 1.25], [cx + size * 1.1, cy], [cx, cy + size * 1.25], [cx - size * 1.1, cy]];
  return `<polygon class="mark" data-shape="${shape}" points="${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}" ${attrs}/>`;
}

/** 印をマスの中に並べる（数に合わせて列と行を決める） */
function markLayer(marks: Mark[]): string {
  const groups = new Map<string, Mark[]>();
  for (const m of marks) {
    const k = `${m.zone.lane}-${m.zone.col}`;
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }
  const out: string[] = [];
  for (const list of groups.values()) {
    const r = zoneRect(list[0].zone);
    const cols = Math.ceil(Math.sqrt(list.length * 1.3));
    const rows = Math.ceil(list.length / cols);
    const cw = (r.w - 2) / cols;
    const ch = (r.h - 2) / rows;
    const size = Math.min(1.6, cw * 0.32, ch * 0.32);
    list.forEach((m, i) => {
      const cx = r.x + 1 + cw * (i % cols + 0.5);
      const cy = r.y + 1 + ch * (Math.floor(i / cols) + 0.5);
      const fill = m.success ? '#ffffff' : ARROW_FAIL;
      out.push(markShape(m.shape, cx, cy, size, `data-cx="${f(cx)}" data-cy="${f(cy)}" fill="${fill}" stroke="${HALO}" stroke-width=".4"`));
    });
  }
  return out.join('');
}

/** 同じマスから出る矢印を、マスの中で少しずつずらす量（始点・終点を同じだけ動かす） */
function offsets(arrows: Arrow[]): { dx: number; dy: number }[] {
  const groups = new Map<string, number[]>();
  arrows.forEach((a, i) => {
    const k = `${a.from.lane}-${a.from.col}`;
    groups.set(k, [...(groups.get(k) ?? []), i]);
  });
  const out = arrows.map(() => ({ dx: 0, dy: 0 }));
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    const radius = Math.min(4.5, 1.6 + idx.length * 0.5);
    idx.forEach((i, n) => {
      const t = (2 * Math.PI * n) / idx.length - Math.PI / 2;
      out[i] = { dx: radius * 1.25 * Math.cos(t), dy: radius * Math.sin(t) };
    });
  }
  return out;
}

/**
 * p から q へ向かうドリブルの線。tail が正なら、最後をまっすぐにして矢じりの向きをそろえる。
 * zigzag＝角のあるジグザグ、wave＝なめらかな波、coil＝くるくる巻く線
 */
function dribblePath(style: 'zigzag' | 'wave' | 'coil', p: Pt, q: Pt, tail: number): string {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const at = (along: number, side: number) => `${f(p.x + ux * along - uy * side)} ${f(p.y + uy * along + ux * side)}`;
  const body = Math.max(0.1, len - tail - 0.6);
  const pts: string[] = [`M${at(0, 0)}`];
  if (style === 'zigzag') {
    const n = Math.max(4, Math.round(body / 1.5));
    for (let i = 1; i <= n; i++) pts.push(`L${at((body * i) / n, i === n ? 0 : i % 2 ? 1.2 : -1.2)}`);
  } else if (style === 'wave') {
    const steps = Math.max(12, Math.round(body / 0.4));
    for (let i = 1; i <= steps; i++) {
      const d = (body * i) / steps;
      pts.push(`L${at(d, 1.1 * Math.sin((d / 5) * 2 * Math.PI))}`);
    }
  } else {
    const loops = Math.max(2, Math.round(body / 4));
    const steps = loops * 24;
    const a = 1.3;
    for (let i = 1; i <= steps; i++) {
      const u = i / steps;
      const t = 2 * Math.PI * loops * u;
      pts.push(`L${at(body * u - a * Math.sin(t), a * (1 - Math.cos(t)))}`);
    }
  }
  if (tail > 0) pts.push(`L${at(len - tail, 0)}`);
  return pts.join(' ');
}

/** 矢印の線と、始点の●を分けて返す */
function arrowLayer(arrows: Arrow[]): { lines: string; dots: string } {
  const shift = offsets(arrows);
  const parts = arrows.map((a, i) => {
    const dribble = a.kind === 'dribble';
    const width = dribble ? 0.8 : 0.6;
    const color = a.success ? ARROW : ARROW_FAIL;
    const dash = a.success ? '' : dribble ? ' stroke-dasharray="2.8 1.6"' : ' stroke-dasharray="1.6 1.2"';
    const c0 = zoneCenter(a.from);
    const same = a.from.lane === a.to.lane && a.from.col === a.to.col;
    if (same && !dribble) {
      const halo = a.success ? '' : `<circle cx="${f(c0.x)}" cy="${f(c0.y)}" r="1.4" fill="none" stroke="${HALO}" stroke-width="${f(width + .7)}"/>`;
      return { line: `${halo}<circle cx="${f(c0.x)}" cy="${f(c0.y)}" r="1.4" fill="none" stroke="${color}" stroke-width="${width}" stroke-opacity=".9"${dash}/>`, dot: '' };
    }
    // 同じマスの中のドリブルも線の形が分かるよう、マスの中に短い線を描く
    const c1 = same ? { x: c0.x + 5.5, y: c0.y } : zoneCenter(a.to);
    const start = same ? { x: c0.x - 5.5, y: c0.y } : c0;
    const p = { x: start.x + shift[i].dx, y: start.y + shift[i].dy };
    const q = { x: c1.x + shift[i].dx, y: c1.y + shift[i].dy };
    const marker = `url(#ah${a.success ? '' : '-red'})`;
    let body: string;
    if (dribble) {
      const d = dribblePath(STYLE[a.move ?? 'conduccion'], p, q, 1.6);
      const halo = a.success ? '' : `<path d="${d}" fill="none" stroke="${HALO}" stroke-width="${f(width + .7)}" stroke-linejoin="round"/>`;
      body = `${halo}<path class="dribble" data-style="${STYLE[a.move ?? 'conduccion']}" d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-opacity=".9" stroke-linejoin="round"${dash} marker-end="${marker}"/>`;
    } else {
      // 終点の少し手前で止めて矢じりを見せる
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const k = (Math.hypot(dx, dy) - 2) / Math.hypot(dx, dy);
      const x2 = f(p.x + dx * k);
      const y2 = f(p.y + dy * k);
      const halo = a.success ? '' : `<line x1="${f(p.x)}" y1="${f(p.y)}" x2="${x2}" y2="${y2}" stroke="${HALO}" stroke-width="${f(width + .7)}" stroke-linecap="round"/>`;
      body = `${halo}<line x1="${f(p.x)}" y1="${f(p.y)}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-opacity=".9" stroke-linecap="round"${dash} marker-end="${marker}"/>`;
    }
    // 始点の●（重なっても、どこから出たか分かるように）
    const dot = `<circle class="start" cx="${f(p.x)}" cy="${f(p.y)}" r="1" fill="${color}" stroke="${HALO}" stroke-width=".35"/>`;
    return { line: body, dot };
  });
  return { lines: parts.map((x) => x.line).join(''), dots: parts.map((x) => x.dot).join('') };
}

const LEGEND_FONT = 2.6;

/** 凡例の絵を1つ描く（x は左端、y は行の中心） */
const glyphWidth = (g: Glyph) => (g === 'zigzag' || g === 'wave' || g === 'coil' ? 10 : 6);

function glyphSvg(g: Glyph, x: number, y: number): string {
  const w = glyphWidth(g);
  const attrs = `fill="#ffffff" stroke="${HALO}" stroke-width=".4"`;
  switch (g) {
    case 'pass-ok':
    case 'pass-ng': {
      const ok = g === 'pass-ok';
      const c = ok ? ARROW : ARROW_FAIL;
      return `<line x1="${f(x + .6)}" y1="${f(y)}" x2="${f(x + w - 1.6)}" y2="${f(y)}" stroke="${c}" stroke-width=".6"${ok ? '' : ' stroke-dasharray="1.2 .9"'} marker-end="url(#ah${ok ? '' : '-red'})"/>`
        + `<circle cx="${f(x + .6)}" cy="${f(y)}" r=".8" fill="${c}" stroke="${HALO}" stroke-width=".3"/>`;
    }
    case 'zigzag':
    case 'wave':
    case 'coil':
      return `<path d="${dribblePath(g, { x, y }, { x: x + w, y }, 0)}" fill="none" stroke="#ffffff" stroke-width=".7" stroke-linejoin="round"/>`;
    case 'circle':
    case 'triangle':
    case 'square':
    case 'diamond':
      return markShape(g, x + w / 2, y, 1.3, attrs).replace('class="mark"', 'class="glyph"');
    case 'ok':
    case 'ng':
      return `<rect x="${f(x + 1.5)}" y="${f(y - 1.5)}" width="3" height="3" rx=".5" fill="${g === 'ok' ? '#ffffff' : ARROW_FAIL}" stroke="${HALO}" stroke-width=".3"/>`;
  }
}

/** 凡例の1行。枠（幅113）に収まらないときは、行ごと縮める */
function legendRow(items: LegendItem[], y: number): string {
  const widths = items.map((it) => glyphWidth(it.glyph) + 1 + it.label.length * LEGEND_FONT + 3);
  const total = widths.reduce((a, b) => a + b, 0);
  const scale = Math.min(1, 109 / total);
  const left = -4 + (113 - total * scale) / 2;
  let x = 0;
  const body = items.map((it, i) => {
    const out = `<g class="legend-item">${glyphSvg(it.glyph, x, 0)}<text x="${f(x + glyphWidth(it.glyph) + 1)}" y="${f(LEGEND_FONT * .36)}" font-size="${LEGEND_FONT}" fill="#ffffff">${it.label}</text></g>`;
    x += widths[i];
    return out;
  }).join('');
  return `<g class="legend-row" transform="translate(${f(left)} ${f(y)}) scale(${f(scale)})">${body}</g>`;
}

function defs(): string {
  return `<defs><marker id="ah" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="${ARROW}"/></marker>
<marker id="ah-red" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="${ARROW_FAIL}" stroke="${HALO}" stroke-width=".6"/></marker></defs>`;
}

export function pitchSvg(o: PitchOptions): string {
  const arrows = arrowLayer(o.arrows ?? []);
  const on = new Set((o.highlight ?? []).map((z) => `${z.lane}-${z.col}`));
  const zones: string[] = [];
  for (let lane = 1; lane <= 5; lane++) {
    for (let col = 1; col <= 6; col++) {
      const r = zoneRect({ lane, col });
      const hit = on.has(`${lane}-${col}`);
      zones.push(`<rect data-lane="${lane}" data-col="${col}" x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" class="zone${hit ? ' on' : ''}" fill="#ffffff" fill-opacity="${hit ? 0.45 : 0}"/>`);
    }
  }
  const nums = [1, 2, 3, 4, 5, 6].map((c) => `<text x="${f((c - .5) * PITCH.w / 6)}" y="71.2" font-size="3" fill="rgba(255,255,255,.85)" text-anchor="middle">${c}</text>`).join('');
  const title = o.title ? `<text x="0" y="-1" font-size="3" fill="#ffffff">${o.title}</text>` : '';
  const pitch = `<rect x="-4" y="-4" width="113" height="76" rx="2" fill="${GRASS}"/>${markings()}${zoneLines()}
${o.heat ? heatLayer(o.heat) : ''}${arrows.lines}${arrows.dots}${o.marks ? markLayer(o.marks) : ''}${zones.join('')}${nums}
<text x="104" y="-1" font-size="3" fill="rgba(255,255,255,.85)" text-anchor="end">攻める向き →</text>${title}`;
  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 113 76" font-family="-apple-system, 'Hiragino Sans', sans-serif">`;
  const rows = o.legend?.filter((r) => r.length) ?? [];
  if (!rows.length) return `${head}\n${defs()}\n${pitch}</svg>`;
  // 凡例を入れても画像の縦横比（113:76）が変わらないよう、ピッチを縮めて下に凡例の行を置く
  const scale = rows.length === 1 ? 0.88 : 0.8;
  const w = 113 * scale;
  const h = 76 * scale;
  const rowH = (76 - h) / rows.length;
  const legend = rows.map((r, i) => legendRow(r, -4 + h + rowH * (i + .5))).join('');
  return `${head}\n${defs()}\n<rect x="-4" y="-4" width="113" height="76" rx="2" fill="${GRASS}"/>`
    + `<svg x="${f(-4 + (113 - w) / 2)}" y="-4" width="${f(w)}" height="${f(h)}" viewBox="-4 -4 113 76">${pitch}</svg>${legend}</svg>`;
}
