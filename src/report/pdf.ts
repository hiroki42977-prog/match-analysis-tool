import type { Match, Player } from '../domain/types';
import { drawPage1, drawPage2, PAGE, type ReportPdfInput } from './pages';

const safe = (s: string) => s.replace(/[/\\]/g, '-');

export function pdfFileName(m: Match, p: Player): string {
  return `${m.date}_vs_${safe(m.opponent)}_#${p.number}${safe(p.name)}.pdf`;
}

/**
 * 見本の資料と同じ A4縦2ページの PDF を作る。ブラウザ専用。
 * PDF 用の日本語フォントを持たなくて済むよう、ページ全体をキャンバスに描いた画像を貼る
 */
export async function buildReportPdf(d: ReportPdfInput): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const canvas = document.createElement('canvas');
  canvas.width = PAGE.w;
  canvas.height = PAGE.h;
  const ctx = canvas.getContext('2d')!;
  for (const [i, draw] of [drawPage1, drawPage2].entries()) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAGE.w, PAGE.h);
    await draw(ctx, d);
    if (i > 0) doc.addPage();
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
  }
  return doc.output('blob');
}
