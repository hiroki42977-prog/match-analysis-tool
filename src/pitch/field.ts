import { PITCH } from './geometry';

const M = 5; // 周りの余白
const W = PITCH.w;
const H = PITCH.h;
const LINE = '#ffffff';
const GRASS = '#2f8f4e';
const f = (n: number) => +n.toFixed(2);

/** ポジション図用の、横向きの緑のグラウンド（白い線、周りに余白 5） */
export function positionFieldSvg(): string {
  const cy = M + H / 2;
  const pa = { d: 16.5, h: 40.32 };
  const ga = { d: 5.5, h: 18.32 };
  const st = `fill="none" stroke="${LINE}" stroke-width=".4"`;
  const left = M;
  const right = M + W;
  const arcDy = Math.sqrt(9.15 ** 2 - (pa.d - 11) ** 2); // ペナルティエリアの外に出る弧の半分の高さ
  const side = (x0: number, dir: 1 | -1) => {
    const edge = (d: number) => f(x0 + dir * d);
    const rectX = (d: number) => f(dir > 0 ? x0 : x0 - d);
    return `<rect x="${rectX(pa.d)}" y="${f(cy - pa.h / 2)}" width="${pa.d}" height="${pa.h}" ${st}/>`
      + `<rect x="${rectX(ga.d)}" y="${f(cy - ga.h / 2)}" width="${ga.d}" height="${ga.h}" ${st}/>`
      + `<rect x="${rectX(2) - (dir > 0 ? 2 : -2)}" y="${f(cy - 3.66)}" width="2" height="7.32" ${st}/>`
      + `<path d="M${edge(pa.d)} ${f(cy - arcDy)} A9.15 9.15 0 0 ${dir > 0 ? 1 : 0} ${edge(pa.d)} ${f(cy + arcDy)}" ${st}/>`
      + `<circle cx="${edge(11)}" cy="${cy}" r=".5" fill="${LINE}"/>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W + M * 2} ${H + M * 2}">`
    + `<rect x="0" y="0" width="${W + M * 2}" height="${H + M * 2}" fill="${GRASS}"/>`
    + `<rect x="${left}" y="${M}" width="${W}" height="${H}" ${st}/>`
    + `<line x1="${M + W / 2}" y1="${M}" x2="${M + W / 2}" y2="${M + H}" stroke="${LINE}" stroke-width=".4"/>`
    + `<circle cx="${M + W / 2}" cy="${cy}" r="9.15" ${st}/>`
    + `<circle cx="${M + W / 2}" cy="${cy}" r=".5" fill="${LINE}"/>`
    + `${side(left, 1)}${side(right, -1)}</svg>`;
}

const PANEL_W = 720;
const PANEL_H = 350;
const BAND_H = 20;
const MAP_W = 490;
const MAP_H = Math.round(MAP_W * 76 / 120);

/** 濃い灰色の見出し帯＋プレーマップ（入れ子の SVG）＋外枠 */
export function mapPanelSvg(title: string, mapSvg: string): string {
  const x = (PANEL_W - MAP_W) / 2;
  const nested = mapSvg.replace('<svg ', `<svg x="${x}" y="${BAND_H + 4}" width="${MAP_W}" height="${MAP_H}" `);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PANEL_W} ${PANEL_H}" font-family="-apple-system, 'Hiragino Sans', sans-serif">`
    + `<rect x="0" y="0" width="${PANEL_W}" height="${PANEL_H}" fill="#ffffff"/>`
    + `<rect x="0" y="0" width="${PANEL_W}" height="${BAND_H}" fill="#4a4a4a"/>`
    + `<text x="${PANEL_W / 2}" y="14" font-size="11" fill="#6fe3cf" text-anchor="middle">${title}</text>`
    + nested
    + `<rect x=".5" y=".5" width="${PANEL_W - 1}" height="${PANEL_H - 1}" fill="none" stroke="#555555" stroke-width="1"/></svg>`;
}
