/**
 * 写真を長い辺 maxSide px の JPEG に縮めて data URL で返す。
 * iPad で撮った大きな写真をそのまま保存すると、iPad の保存場所を圧迫するため
 */
export async function shrinkImage(file: File, maxSide = 600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((ok, ng) => {
      img.onload = () => ok();
      img.onerror = () => ng(new Error('画像を読み込めませんでした'));
      img.src = url;
    });
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = canvas.getContext('2d')!;
    // 透明な部分（エンブレムの PNG など）が黒くならないよう白で敷く
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
