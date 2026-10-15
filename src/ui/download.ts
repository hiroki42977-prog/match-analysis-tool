/**
 * ファイル（CSV・PDF など）を iPad に保存する。
 * ホーム画面から開いたアプリではダウンロードのリンクが動かないことがあるため、共有シート（「ファイルに保存」など）を使う。
 */
export async function saveFile(data: BlobPart, name: string, type: string): Promise<'share' | 'download'> {
  const nav = navigator as Navigator & { standalone?: boolean };
  const standalone = nav.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const file = new File([data], name, { type });
  if (standalone && nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file] });
    return 'share';
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'download';
}
