import { scoreTotal, type MatchReport, type PlayerReport } from '../domain/report';
import { computeStats, radarValues } from '../domain/stats';
import type { Match, PlayEvent, Player, Team } from '../domain/types';
import { drawSvg } from '../pitch/png';
import { SHEET } from '../pitch/perspective';
import { sheetPitchSvg } from '../pitch/sheet';
import { sheetFigures } from './build';
import { radarSvg } from './radar';
import { statBlocks, type StatBlock } from './sheetTables';
import { fitLines, jpDate } from './text';

export interface ReportPdfInput { match: Match; player: Player; team: Team; events: PlayEvent[]; matchReport: MatchReport; playerReport: PlayerReport }

// A4縦を約200dpiで描く
export const PAGE = { w: 1654, h: 2339 } as const;
const FONT = "-apple-system, 'Hiragino Sans', sans-serif";
const MARGIN = 90;
const INK = '#111111';
const BAND = '#4a4a4a';
const BAND_TEXT = '#6fe3cf';
const LABEL_BG = '#5a5a5a';
const RULE = '#bdbdbd';

type Ctx = CanvasRenderingContext2D;

function text(ctx: Ctx, s: string, x: number, y: number, o: { size: number; bold?: boolean; color?: string; align?: CanvasTextAlign } = { size: 20 }) {
  ctx.font = `${o.bold ? 'bold ' : ''}${o.size}px ${FONT}`;
  ctx.fillStyle = o.color ?? INK;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

/** 枠の幅に入らないときは文字を小さくして書く */
function fitText(ctx: Ctx, s: string, x: number, y: number, maxW: number, o: { size: number; bold?: boolean; color?: string; align?: CanvasTextAlign }) {
  let size = o.size;
  for (; size > 10; size--) {
    ctx.font = `${o.bold ? 'bold ' : ''}${size}px ${FONT}`;
    if (ctx.measureText(s).width <= maxW) break;
  }
  text(ctx, s, x, y, { ...o, size });
}

function cell(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/** 灰色の見出しの帯（コメント・次節の課題） */
function grayBand(ctx: Ctx, label: string, x: number, y: number, w: number) {
  cell(ctx, x, y, w, 44, '#b8b8b8');
  text(ctx, label, x + w / 2, y + 22, { size: 24, bold: true, align: 'center' });
}

async function loadImage(src: string | undefined): Promise<HTMLImageElement | null> {
  if (!src) return null;
  const img = new Image();
  return new Promise((ok) => {
    img.onload = () => ok(img);
    // 読めない画像は枠だけにして、PDF づくりは止めない
    img.onerror = () => ok(null);
    img.src = src;
  });
}

/** 画像を枠の中に縦横比を保って入れる。無いときは薄い枠だけ */
async function picture(ctx: Ctx, src: string | undefined, x: number, y: number, w: number, h: number) {
  const img = await loadImage(src);
  if (img) {
    const k = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * k;
    const dh = img.naturalHeight * k;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  } else {
    ctx.strokeStyle = '#d9d9d9';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }
}

/** 1ページ目：チーム名、1st・2nd の図、コメント、次節の課題 */
export async function drawPage1(ctx: Ctx, d: ReportPdfInput): Promise<void> {
  text(ctx, d.team.name, PAGE.w / 2, 85, { size: 40, bold: true, align: 'center' });
  const pw = 1240;
  const ph = pw * SHEET.h / SHEET.w;
  let y = 120;
  for (const fig of sheetFigures(d.events)) {
    await drawSvg(ctx, sheetPitchSvg(fig.svg), (PAGE.w - pw) / 2, y, pw, ph);
    y += ph + 10;
  }

  const bx = 160;
  const bw = PAGE.w - bx * 2;
  y += 10;
  grayBand(ctx, 'コメント', bx, y, bw);
  y += 44;
  const boxH = 280;
  cell(ctx, bx, y, bw, boxH, '#ffffff');
  // 入らないときは文字を小さくし、それでも入らない分は「…」で切る
  for (const size of [26, 22, 18]) {
    ctx.font = `${size}px ${FONT}`;
    const lineH = size * 1.45;
    const maxLines = Math.floor((boxH - 30) / lineH);
    const lines = fitLines(d.playerReport.comment, bw - 60, maxLines, (s) => ctx.measureText(s).width);
    const fits = lines.length < maxLines || !lines[lines.length - 1].endsWith('…') || size === 18;
    if (!fits) continue;
    const top = y + boxH / 2 - ((lines.length - 1) * lineH) / 2;
    lines.forEach((l, i) => text(ctx, l, PAGE.w / 2, top + i * lineH, { size, align: 'center' }));
    break;
  }
  y += boxH + 20;
  grayBand(ctx, '次節の課題', bx, y, bw);
  y += 44;
  for (const [label, v] of [['攻撃', d.playerReport.nextAttack], ['守備', d.playerReport.nextDefense]]) {
    cell(ctx, bx, y, bw, 48, '#ffffff');
    fitText(ctx, `${label}:${v}`, PAGE.w / 2, y + 24, bw - 40, { size: 22, align: 'center' });
    y += 48;
  }
}

/** 数字の表を1つ描き、描いた高さを返す */
function statTable(ctx: Ctx, b: StatBlock, x: number, y: number, w: number): number {
  const y0 = y;
  const cw = w / 10;
  const rh = 28;
  cell(ctx, x, y, w, 36, BAND);
  text(ctx, b.title, x + w / 2, y + 18, { size: 20, color: BAND_TEXT, align: 'center' });
  y += 36;
  // 見出しの行：成功・失敗・総数・成功率
  for (const [label, from, span] of [[b.successLabel, 0, 3], [b.failLabel, 3, 3], [b.totalLabel, 6, 2], ['成功率', 8, 2]] as const) {
    cell(ctx, x + from * cw, y, span * cw, rh, BAND);
    text(ctx, label, x + (from + span / 2) * cw, y + rh / 2, { size: 18, color: BAND_TEXT, align: 'center' });
  }
  y += rh;
  ['', '前半', '後半', '', '前半', '後半', '前半', '後半', '前半', '後半'].forEach((s, i) => {
    cell(ctx, x + i * cw, y, cw, rh, '#ffffff');
    text(ctx, s, x + (i + 0.5) * cw, y + rh / 2, { size: 18, align: 'center' });
  });
  y += rh;
  const top = y;
  b.rows.forEach((r, n) => {
    const bg = n % 2 ? '#ffffff' : '#f4f4f4';
    [r.label, r.success[0], r.success[1], r.label, r.fail[0], r.fail[1], r.total[0], r.total[1]].forEach((v, i) => {
      cell(ctx, x + i * cw, y, cw, rh, bg);
      fitText(ctx, String(v), x + (i + 0.5) * cw, y + rh / 2, cw - 8, { size: 18, align: 'center' });
    });
    y += rh;
  });
  // 成功率は行を結合して、前半・後半それぞれ1つの値
  b.rate.forEach((v, i) => {
    cell(ctx, x + (8 + i) * cw, top, cw, y - top, '#f4f4f4');
    text(ctx, v, x + (8.5 + i) * cw, (top + y) / 2, { size: 20, align: 'center' });
  });
  return y - y0;
}

/** 2ページ目：写真・エンブレム・スコア、情報の表、レーダー、数字の表 */
export async function drawPage2(ctx: Ctx, d: ReportPdfInput): Promise<void> {
  const { match: m, player: p, matchReport: mr, playerReport: pr } = d;
  text(ctx, d.team.name, PAGE.w / 2, 70, { size: 40, bold: true, align: 'center' });
  text(ctx, jpDate(m.date), PAGE.w - MARGIN, 70, { size: 24, align: 'right' });

  // 顔写真、エンブレム「vs」相手のエンブレム、スコア
  await picture(ctx, p.photo, MARGIN, 130, 200, 260);
  await picture(ctx, d.team.emblem, 330, 160, 200, 200);
  text(ctx, 'vs', 570, 260, { size: 32, bold: true, align: 'center' });
  await picture(ctx, mr.opponentEmblem, 610, 160, 200, 200);
  const total = scoreTotal(mr);
  const score = (a: string, b: string) => (a || b ? `${a}-${b}` : '');
  text(ctx, '【スコア】', 880, 180, { size: 28, bold: true });
  text(ctx, `1st  ${score(mr.score['1H'].us, mr.score['1H'].them)}`, 900, 230, { size: 26 });
  text(ctx, `2nd  ${score(mr.score['2H'].us, mr.score['2H'].them)}`, 900, 275, { size: 26 });
  text(ctx, `Total  ${score(total.us, total.them)}`, 900, 320, { size: 26, bold: true });

  // 情報の表（見出し・値・見出し・値）
  const left: [string, string][] = [
    ['名前', p.name], ['Pコンディション', pr.pCondition], ['Mコンディション', pr.mCondition], ['評価1st', pr.eval1H], ['評価2nd', pr.eval2H],
    ['出場ポジション', pr.position], ['出場時間', pr.playTime], ['個人テーマ（攻撃）', pr.themeAttack], ['個人テーマ（守備）', pr.themeDefense], ['分析者', pr.analyst],
  ];
  const right: [string, string][] = [
    ['試合条件', mr.matchCondition], ['試合時間', mr.matchTime], ['試合会場', mr.venue], ['キックオフ時間', mr.kickoff], ['天候', mr.weather],
    ['ピッチコンディション', mr.pitchCondition], ['システム', mr.system], ['相手システム', mr.opponentSystem], ['得点', pr.goals], ['アシスト', pr.assists],
  ];
  const tw = PAGE.w - MARGIN * 2;
  const cols = [MARGIN, MARGIN + 300, MARGIN + tw / 2, MARGIN + tw / 2 + 300];
  const vw = tw / 2 - 300;
  let y = 420;
  for (let i = 0; i < 10; i++) {
    for (const [side, rows] of [[0, left], [2, right]] as const) {
      const [label, value] = rows[i];
      cell(ctx, cols[side], y, 300, 40, LABEL_BG);
      fitText(ctx, label, cols[side] + 150, y + 20, 284, { size: 20, color: '#ffffff', align: 'center' });
      cell(ctx, cols[side + 1], y, vw, 40, '#ffffff');
      fitText(ctx, value, cols[side + 1] + vw / 2, y + 20, vw - 16, { size: 20, align: 'center' });
    }
    y += 40;
  }

  // レーダーチャート（前半・後半）
  const s = computeStats(d.events);
  y += 30;
  const rw = 500;
  const rh = rw * 80 / 100;
  await drawSvg(ctx, radarSvg(radarValues(s['1H']), '前半', '#5bc0eb'), MARGIN + tw / 4 - rw / 2, y, rw, rh);
  await drawSvg(ctx, radarSvg(radarValues(s['2H']), '後半', '#2ecc71'), MARGIN + (tw * 3) / 4 - rw / 2, y, rw, rh);
  y += rh + 30;

  for (const b of statBlocks(s)) y += statTable(ctx, b, MARGIN, y, tw);
}
