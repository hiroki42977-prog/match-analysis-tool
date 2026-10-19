import { SHEET } from './perspective';

/** SVG 文字列をキャンバスの指定の場所に描く。ブラウザ専用 */
export async function drawSvg(ctx: CanvasRenderingContext2D, svg: string, x: number, y: number, w: number, h: number): Promise<void> {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    await new Promise<void>((ok, ng) => {
      img.onload = () => ok();
      img.onerror = () => ng(new Error('図を画像にできませんでした'));
      img.src = url;
    });
    ctx.drawImage(img, x, y, w, h);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** SVG 文字列を PNG にして base64（"data:" より後ろ）で返す。ブラウザ専用 */
export async function svgToPngBase64(svg: string, widthPx = 1050): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = Math.round(widthPx * 76 / 113);
  await drawSvg(canvas.getContext('2d')!, svg, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png').split(',')[1];
}

/** 見本の形の図を、スプレッドシートの画像の大きさ（横長 113:76）の白い画像の真ん中に置いて PNG にする */
export async function sheetPngBase64(svg: string): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 1050;
  canvas.height = Math.round(1050 * 76 / 113);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const w = Math.min(canvas.width, canvas.height * SHEET.w / SHEET.h);
  const h = w * SHEET.h / SHEET.w;
  await drawSvg(ctx, svg, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  return canvas.toDataURL('image/png').split(',')[1];
}
