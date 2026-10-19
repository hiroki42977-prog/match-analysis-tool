import { expect, test } from '@playwright/test';
import { copyFileSync } from 'node:fs';
import { openRecord, record, setupTeamAndMatch, setupThreeVideoMatch } from './helpers';

test('screenshot: record screen', async ({ page }) => {
  test.skip(!process.env.SHOTS, 'SHOTS=1 のときだけ撮る');
  await setupTeamAndMatch(page);
  await openRecord(page);
  await record(page, 'パス', [[3, 2], [3, 4]]);
  await record(page, 'レガーテ', [[1, 4], [1, 5]], true);
  await page.getByRole('button', { name: 'パス ○', exact: true }).tap();
  await page.locator('#pitch rect[data-lane="3"][data-col="3"]').tap();
  await page.screenshot({ path: process.env.SHOTS + '/record.png' });
});

test('screenshot: results screen', async ({ page }) => {
  test.skip(!process.env.SHOTS, 'SHOTS=1 のときだけ撮る');
  await setupTeamAndMatch(page);
  await openRecord(page);
  await record(page, 'パス', [[3, 2], [3, 4]]);
  await record(page, 'パス', [[3, 2], [2, 3]]);
  await record(page, 'パス', [[3, 3], [2, 1]], true);
  await record(page, 'コンドゥクシオン', [[2, 2], [2, 4]]);
  await record(page, 'レガーテ', [[4, 4], [4, 4]]);
  await record(page, 'パス', [[3, 2], [4, 3]], true);
  await record(page, 'コンドゥクシオン', [[3, 3], [3, 5]], true);
  await record(page, 'プロテクション', [[2, 2], [1, 3]]);
  await record(page, 'ボール奪取', [[2, 2]]);
  await record(page, '1対1', [[2, 2]], true);
  await record(page, '空中戦', [[2, 2]]);
  await record(page, 'ボール奪取', [[3, 3]], true);
  await record(page, '枠内R', [[3, 6]]);
  await record(page, '枠外L', [[3, 6]]);
  await record(page, '枠外R', [[2, 6]]);
  // 混み合った状態を見るため、同じマスから出るパスとドリブルを足す
  for (const [z, f] of [[[3, 3], [3, 5]], [[3, 3], [2, 5]], [[3, 3], [4, 4]], [[2, 3], [3, 5]], [[4, 3], [3, 5]]] as [number, number][][]) {
    await record(page, 'パス', [z as [number, number], f as [number, number]]);
  }
  await record(page, 'レガーテ', [[3, 3], [3, 4]]);
  await record(page, 'コンドゥクシオン', [[3, 3], [2, 4]]);
  await record(page, 'プロテクション', [[3, 3], [3, 3]]);
  await record(page, 'レガーテ', [[2, 3], [3, 4]], true);
  await page.getByRole('button', { name: '結果を見る' }).tap();
  await page.locator('.chips').getByRole('button', { name: '#10 山田 太郎' }).tap();
  await page.screenshot({ path: process.env.SHOTS + '/results.png', fullPage: true });
  for (const k of ['1H', '2H']) {
    await page.locator(`#map-${k}`).screenshot({ path: process.env.SHOTS + `/map-${k}.png` });
  }
  // PDF の見た目を見本と比べるため、レポート入力に値を入れておく
  await page.getByRole('button', { name: 'レポート入力' }).tap();
  const fills: [string, string][] = [
    ['スコア 前半 自チーム', '1'], ['スコア 前半 相手', '2'], ['スコア 後半 自チーム', '1'], ['スコア 後半 相手', '3'],
    ['試合条件', 'TRM'], ['試合時間', '20m×4'], ['試合会場', '市民グラウンド'], ['キックオフ時間', '10:00'], ['天候', '晴れ'],
    ['ピッチコンディション', '人工芝'], ['システム', '1-3-3-1'], ['相手システム', '1-3-3-1'],
    ['Pコンディション', 'A'], ['Mコンディション', 'A'], ['評価（前半）', 'A'], ['評価（後半）', 'B'], ['出場ポジション', 'CB/DMF'],
    ['出場時間', '80m'], ['個人テーマ（攻撃）', '縦パスを通す'], ['個人テーマ（守備）', '予測して奪う'], ['分析者', 'コーチ'], ['得点', '0'], ['アシスト', '1'],
    ['コメント', 'ビルドアップでのボールの引き出し方が素晴らしかった。\n相手をよく見て、良い立ち位置が取れている。\n身体の向きをもう少し攻撃方向に向けて、半身で受ける癖をつけたい。'],
    ['次節の課題（攻撃）', '相手のライン間で半身で受けてからのターン'], ['次節の課題（守備）', '味方のチャレンジに対するカバーの判断'],
  ];
  for (const [label, v] of fills) await page.getByLabel(label, { exact: true }).fill(v);
  for (const [label, color] of [['顔写真', '#3a7bd5'], ['自チームのエンブレム', '#d4a017'], ['相手のエンブレム', '#1e8e3e']] as const) {
    const b64 = await page.evaluate((c) => {
      const cv = document.createElement('canvas');
      cv.width = 400;
      cv.height = 480;
      const x = cv.getContext('2d')!;
      x.fillStyle = c;
      x.beginPath();
      x.arc(200, 240, 180, 0, Math.PI * 2);
      x.fill();
      return cv.toDataURL('image/png').split(',')[1];
    }, color);
    await page.getByLabel(label).setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
    await expect(page.locator(`img[alt="${label}"]`)).toBeVisible();
  }
  await page.screenshot({ path: process.env.SHOTS + '/report-form.png', fullPage: true });
  await page.getByRole('button', { name: '← 結果に戻る' }).tap();
  await page.locator('.chips').getByRole('button', { name: '#10 山田 太郎' }).tap();
  await page.getByRole('button', { name: 'PDF 書き出し' }).tap();
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF を保存' }).tap()]);
  copyFileSync((await pdf.path())!, process.env.SHOTS + '/figures.pdf');
});

test('screenshot: several links (form and record screen)', async ({ page }) => {
  test.skip(!process.env.SHOTS, 'SHOTS=1 のときだけ撮る');
  await setupThreeVideoMatch(page);
  await page.getByRole('button', { name: '試合を直す' }).click();
  await page.screenshot({ path: process.env.SHOTS + '/form-videos.png', fullPage: true });
  await page.getByRole('button', { name: '← 戻る' }).click();
  await openRecord(page);
  await page.locator('#video-tabs').getByRole('button', { name: '③後半' }).tap();
  await page.screenshot({ path: process.env.SHOTS + '/record-videos.png' });
});
