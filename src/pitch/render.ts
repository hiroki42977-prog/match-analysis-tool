import type { ZoneCell } from '../domain/stats';
import type { Zone } from '../domain/types';
import { PITCH, zoneCenter, zoneRect } from './geometry';

export interface Arrow { from: Zone; to: Zone; style: 'solid' | 'dashed' | 'thick' }
export interface PitchOptions { highlight?: Zone[]; heat?: ZoneCell[]; arrows?: Arrow[]; title?: string }

// PNG 変換でもそのまま描けるよう、色はすべて属性で直接指定する
const GRASS = '#2f8f4e';
const GRASS_STRIPE = '#349a54';
const LINE = '#ffffff';
const ARROW = '#ffffff';

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

function heatLayer(cells: ZoneCell[]): string {
  const max = Math.max(0, ...cells.map((c) => c.count));
  return cells.filter((c) => c.count > 0).map((c) => {
    const r = zoneRect(c);
    const a = 0.15 + 0.7 * (c.count / max);
    const ink = a > 0.5 ? '#0b3d1f' : '#ffffff';
    const pct = c.rate === null ? '-' : `${Math.round(c.rate * 100)}%`;
    return `<rect x="${f(r.x + .4)}" y="${f(r.y + .4)}" width="${f(r.w - .8)}" height="${f(r.h - .8)}" rx=".8" fill="#ffffff" fill-opacity="${f(a)}"/>`
      + `<text x="${f(r.x + r.w / 2)}" y="${f(r.y + r.h / 2 - .6)}" font-size="3.6" font-weight="700" fill="${ink}" text-anchor="middle">${c.count}本</text>`
      + `<text x="${f(r.x + r.w / 2)}" y="${f(r.y + r.h / 2 + 3.6)}" font-size="3" fill="${ink}" text-anchor="middle">${pct}</text>`;
  }).join('');
}

function arrowLayer(arrows: Arrow[]): string {
  return arrows.map((a) => {
    const p = zoneCenter(a.from);
    const q = zoneCenter(a.to);
    const width = a.style === 'thick' ? 1.6 : 0.6;
    if (a.from.lane === a.to.lane && a.from.col === a.to.col) {
      return `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${a.style === 'thick' ? 2 : 1.4}" fill="none" stroke="${ARROW}" stroke-width="${width}" stroke-opacity=".75"${a.style === 'dashed' ? ' stroke-dasharray="1 .8"' : ''}/>`;
    }
    // 終点の少し手前で止めて矢じりを見せる
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    const k = (len - 2) / len;
    const marker = a.style === 'thick' ? 'url(#ah-thick)' : 'url(#ah)';
    return `<line x1="${f(p.x)}" y1="${f(p.y)}" x2="${f(p.x + dx * k)}" y2="${f(p.y + dy * k)}" stroke="${ARROW}" stroke-width="${width}" stroke-opacity=".75" stroke-linecap="round"${a.style === 'dashed' ? ' stroke-dasharray="1.6 1.2"' : ''} marker-end="${marker}"/>`;
  }).join('');
}

export function pitchSvg(o: PitchOptions): string {
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
<marker id="ah-thick" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="2.4" markerHeight="2.4" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="${ARROW}"/></marker></defs>
<rect x="-4" y="-4" width="113" height="76" rx="2" fill="${GRASS}"/>${markings()}${zoneLines()}
${o.heat ? heatLayer(o.heat) : ''}${o.arrows ? arrowLayer(o.arrows) : ''}${zones.join('')}${nums}
<text x="104" y="-1" font-size="3" fill="rgba(255,255,255,.85)" text-anchor="end">攻める向き →</text>${title}</svg>`;
}
