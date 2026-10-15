import type { Match, Player } from '../domain/types';
import { drawSvg } from '../pitch/png';
import { pitchSvg } from '../pitch/render';
import type { MapFigure } from './build';

const safe = (s: string) => s.replace(/[/\\]/g, '-');

export function pdfFileName(m: Match, p: Player): string {
  return `${m.date}_vs_${safe(m.opponent)}_#${p.number}${safe(p.name)}.pdf`;
}

export function pageHeading(m: Match, p: Player): string {
  return `#${p.number} ${p.name}｜${m.date} vs ${m.opponent}`;
}

// A4 横（297×210mm）を約150dpiで描く
const W = 1754;
const H = 1240;
const PAD = 70;
const FONT = "-apple-system, 'Hiragino Sans', sans-serif";

/**
 * 図1枚につき1ページの PDF を作る。ブラウザ専用。
 * PDF 用の日本語フォントを持たなくて済むよう、見出しも図もキャンバスに描いた画像を貼る
 */
export async function buildFiguresPdf(figs: MapFigure[], heading: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  for (const [i, fig] of figs.entries()) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#555555';
    ctx.font = `36px ${FONT}`;
    ctx.textBaseline = 'top';
    ctx.fillText(heading, PAD, PAD);
    ctx.fillStyle = '#111111';
    ctx.font = `bold 54px ${FONT}`;
    ctx.fillText(fig.title, PAD, PAD + 56);
    ctx.font = `38px ${FONT}`;
    ctx.fillText(fig.summary, PAD, PAD + 128);
    // 残りの場所に、図の縦横比（113:76）のまま大きく入れる
    const top = PAD + 196;
    const boxW = W - PAD * 2;
    const boxH = H - top - PAD;
    const w = Math.min(boxW, boxH * 113 / 76);
    const h = w * 76 / 113;
    await drawSvg(ctx, pitchSvg(fig.svg), (W - w) / 2, top, w, h);
    if (i > 0) doc.addPage();
    doc.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 297, 210);
  }
  return doc.output('blob');
}
