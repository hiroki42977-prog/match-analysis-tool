import { test } from '@playwright/test';
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
  for (const k of ['overall-1H', 'pass', 'dribble-1H', 'defense', 'shot']) {
    await page.locator(`#map-${k}`).screenshot({ path: process.env.SHOTS + `/map-${k}.png` });
  }
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
