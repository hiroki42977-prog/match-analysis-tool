import type { OverallCell, ZoneCell } from '../domain/stats';
import type { Zone } from '../domain/types';
import { PITCH, zoneCenter, zoneRect } from './geometry';

/** パスはまっすぐな矢印、ドリブルは波線の矢印。成功は白、失敗は赤い破線。始点には●を付ける */
export interface Arrow { from: Zone; to: Zone; kind: 'pass' | 'dribble'; success: boolean }
export interface PitchOptions { highlight?: Zone[]; heat?: ZoneCell[]; overall?: OverallCell[]; arrows?: Arrow[]; title?: string }

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

/** 全体マップ: 濃さ＝パス＋ドリブル＋守備の本数 */
function overallShade(cells: OverallCell[]): string {
  const max = Math.max(0, ...cells.map((c) => c.count));
  return cells.filter((c) => c.count > 0).map((c) => shade(zoneRect(c), c.count, max)).join('');
}

/** 全体マップの内訳。矢印に隠れないよう、矢印の上に白い下地付きで出す */
function overallLabels(cells: OverallCell[]): string {
  return cells.filter((c) => c.count > 0).map((c) => {
    const r = zoneRect(c);
    return `<rect x="${f(r.x + .7)}" y="${f(r.y + .7)}" width="11.6" height="6.2" rx=".6" fill="#ffffff" fill-opacity=".88"/>`
      + `<text x="${f(r.x + 1.2)}" y="${f(r.y + 3.3)}" font-size="2.4" font-weight="700" fill="${INK}">${c.count}本 ${pct(c.rate)}</text>`
      + `<text x="${f(r.x + 1.2)}" y="${f(r.y + 6.1)}" font-size="2.2" fill="${INK}">パ${c.pass} ド${c.dribble} 守${c.defense}</text>`;
  }).join('');
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

/** p から q へ向かう波線（最後は少しまっすぐにして矢じりの向きをそろえる） */
function wavyPath(p: { x: number; y: number }, q: { x: number; y: number }): string {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const wave = Math.max(0, len - 2.2);
  const steps = Math.max(12, Math.round(wave / 0.4));
  const pts: string[] = [`M${f(p.x)} ${f(p.y)}`];
  for (let i = 1; i <= steps; i++) {
    const d = (wave * i) / steps;
    const amp = 1.1 * Math.sin((d / 5) * 2 * Math.PI);
    pts.push(`L${f(p.x + ux * d - uy * amp)} ${f(p.y + uy * d + ux * amp)}`);
  }
  pts.push(`L${f(p.x + ux * (len - 1.6))} ${f(p.y + uy * (len - 1.6))}`);
  return pts.join(' ');
}

/** 矢印の線と、始点の●を分けて返す（●は数字の下地より上に描くため） */
function arrowLayer(arrows: Arrow[]): { lines: string; dots: string } {
  const shift = offsets(arrows);
  const parts = arrows.map((a, i) => {
    const dribble = a.kind === 'dribble';
    const width = dribble ? 0.8 : 0.6;
    const color = a.success ? ARROW : ARROW_FAIL;
    const dash = a.success ? '' : dribble ? ' stroke-dasharray="2.8 1.6"' : ' stroke-dasharray="1.6 1.2"';
    const c0 = zoneCenter(a.from);
    if (a.from.lane === a.to.lane && a.from.col === a.to.col) {
      const r = dribble ? 2 : 1.4;
      const halo = a.success ? '' : `<circle cx="${f(c0.x)}" cy="${f(c0.y)}" r="${r}" fill="none" stroke="${HALO}" stroke-width="${f(width + .7)}"/>`;
      return { line: `${halo}<circle cx="${f(c0.x)}" cy="${f(c0.y)}" r="${r}" fill="none" stroke="${color}" stroke-width="${width}" stroke-opacity=".9"${dash}/>`, dot: '' };
    }
    const c1 = zoneCenter(a.to);
    const p = { x: c0.x + shift[i].dx, y: c0.y + shift[i].dy };
    const q = { x: c1.x + shift[i].dx, y: c1.y + shift[i].dy };
    const marker = `url(#ah${a.success ? '' : '-red'})`;
    let body: string;
    if (dribble) {
      const d = wavyPath(p, q);
      const halo = a.success ? '' : `<path d="${d}" fill="none" stroke="${HALO}" stroke-width="${f(width + .7)}" stroke-linejoin="round"/>`;
      body = `${halo}<path class="dribble" d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-opacity=".9" stroke-linejoin="round"${dash} marker-end="${marker}"/>`;
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 113 76" font-family="-apple-system, 'Hiragino Sans', sans-serif">
<defs><marker id="ah" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="${ARROW}"/></marker>
<marker id="ah-red" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="${ARROW_FAIL}" stroke="${HALO}" stroke-width=".6"/></marker></defs>
<rect x="-4" y="-4" width="113" height="76" rx="2" fill="${GRASS}"/>${markings()}${zoneLines()}
${o.heat ? heatLayer(o.heat) : ''}${o.overall ? overallShade(o.overall) : ''}${arrows.lines}${o.overall ? overallLabels(o.overall) : ''}${arrows.dots}${zones.join('')}${nums}
<text x="104" y="-1" font-size="3" fill="rgba(255,255,255,.85)" text-anchor="end">攻める向き →</text>${title}</svg>`;
}
