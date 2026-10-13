import { test } from '@playwright/test';
import { openRecord, record, setupTeamAndMatch } from './helpers';

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
  await page.getByRole('button', { name: '結果を見る' }).tap();
  await page.locator('.chips').getByRole('button', { name: '#10 山田 太郎' }).tap();
  await page.screenshot({ path: process.env.SHOTS + '/results.png', fullPage: true });
  await page.locator('#heatmap-tabs').getByRole('button', { name: '守備' }).tap();
  await page.locator('#heatmap').screenshot({ path: process.env.SHOTS + '/defense.png' });
  await page.locator('#heatmap-tabs').getByRole('button', { name: 'シュート' }).tap();
  await page.locator('#heatmap').screenshot({ path: process.env.SHOTS + '/shot-tab.png' });
  await page.locator('#overall').screenshot({ path: process.env.SHOTS + '/overall.png' });
  await page.locator('#dribble-map').screenshot({ path: process.env.SHOTS + '/dribble.png' });
});
