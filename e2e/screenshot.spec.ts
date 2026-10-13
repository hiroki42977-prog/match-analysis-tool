import { test } from '@playwright/test';
import { openRecord, record, setupTeamAndMatch } from './helpers';

test('screenshot: record screen', async ({ page }) => {
  test.skip(!process.env.SHOTS, 'SHOTS=1 のときだけ撮る');
  await setupTeamAndMatch(page);
  await openRecord(page);
  await record(page, 'パス', [[3, 2], [3, 4]]);
  await record(page, 'レガーテ', [[1, 4], [1, 5]], true);
  await page.getByRole('button', { name: 'パス', exact: true }).tap();
  await page.locator('#pitch rect[data-lane="3"][data-col="3"]').tap();
  await page.screenshot({ path: process.env.SHOTS + '/record.png' });
});
