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

test('player with records cannot be removed from roster; CSV still works', async ({ page }) => {
  const messages: string[] = [];
  page.removeAllListeners('dialog');
  page.on('dialog', (d) => { messages.push(d.message()); void d.accept(); });
  await setupTeamAndMatch(page);
  await openRecord(page);
  await record(page, 'ボール奪取', [[2, 2]]);
  await page.goto(APP + '#/roster');
  await page.getByRole('button', { name: '#10 山田 太郎 を消す' }).tap();
  await expect.poll(() => messages.join('|')).toContain('記録がある選手は名簿から消せません');
  await expect(page.getByText('#10 山田 太郎')).toBeVisible();
  await page.getByRole('button', { name: '#7 佐藤 一郎 を消す' }).tap();
  await expect(page.getByText('#7 佐藤 一郎')).toHaveCount(0);
});
