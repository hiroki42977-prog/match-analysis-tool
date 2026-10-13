import { expect, test } from '@playwright/test';
import { APP, openRecord, record, setupTeamAndMatch } from './helpers';

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
});

test('double tap on 取消 removes only one record', async ({ page }) => {
  await setupTeamAndMatch(page);
  await openRecord(page);
  await record(page, 'ボール奪取', [[2, 2]]);
  await record(page, '1対1', [[2, 3]]);
  await record(page, '空中戦', [[2, 4]]);
  await expect(page.getByText('この選手の記録 3件')).toBeVisible();
  const box = (await page.locator('#recent li').first().getByRole('button', { name: '取消' }).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(150);
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(300);
  await expect(page.getByText('この選手の記録 2件')).toBeVisible();
});
