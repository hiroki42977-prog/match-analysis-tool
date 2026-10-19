import type { Match, Player } from '../domain/types';
import { drawSvg } from '../pitch/png';
import { SHEET } from '../pitch/perspective';
import { sheetPitchSvg } from '../pitch/sheet';
import type { SheetFigure } from './build';

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
export async function buildFiguresPdf(figs: SheetFigure[], heading: string): Promise<Blob> {
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
    // 残りの場所に、図の縦横比のまま大きく入れる
    const top = PAD + 70;
    const boxW = W - PAD * 2;
    const boxH = H - top - PAD;
    const w = Math.min(boxW, boxH * SHEET.w / SHEET.h);
    const h = w * SHEET.h / SHEET.w;
    await drawSvg(ctx, sheetPitchSvg(fig.svg), (W - w) / 2, top, w, h);
    if (i > 0) doc.addPage();
    doc.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 297, 210);
  }
  return doc.output('blob');
}
