import { expect, test } from '@playwright/test';
import { fakeScript, openRecord, record, saveSettings, setupTeamAndMatch, zone } from './helpers';

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
});

test('records pass, failed dribble, shot; fixes and undoes', async ({ page }) => {
  const bodies = await fakeScript(page);
  await saveSettings(page);
  await setupTeamAndMatch(page);
  await openRecord(page);
  const recent = page.locator('#recent');

  await page.getByRole('button', { name: 'パス', exact: true }).tap();
  await expect(page.getByText('パス ― 始点ゾーンを押してください')).toBeVisible();
  await zone(page, 3, 2).tap();
  await expect(page.getByText('パス ― 終点ゾーンを押してください')).toBeVisible();
  await zone(page, 3, 4).tap();
  await expect(recent.locator('li').first()).toContainText('パス(前) 成功');

  await record(page, 'レガーテ', [[1, 4], [1, 5]], true);
  await expect(recent.locator('li').first()).toContainText('レガーテ 失敗');
  await record(page, '枠内L', [[3, 6]]);
  await expect(recent.locator('li').first()).toContainText('枠内L');
  await expect(page.getByText('この選手の記録 3件')).toBeVisible();

  // 最後のマスの2度押しは1件だけ
  await page.getByRole('button', { name: '空中戦', exact: true }).tap();
  await zone(page, 2, 2).tap();
  await zone(page, 2, 2).tap();
  await expect(page.getByText('この選手の記録 4件')).toBeVisible();

  // パスの向きの手修正
  await record(page, 'パス', [[2, 3], [4, 4]]);
  await expect(recent.locator('li').first()).toContainText('パス(前)');
  await recent.locator('li').first().getByRole('button', { name: '横' }).tap();
  await expect(recent.locator('li').first()).toContainText('パス(横)');

  // 取消
  await recent.locator('li').first().getByRole('button', { name: '取消' }).tap();
  await expect(page.getByText('この選手の記録 4件')).toBeVisible();

  await expect(page.getByText('送信済み')).toBeVisible();
  const upserts = bodies.filter((b) => b.action === 'upsertEvent');
  expect(upserts.length).toBeGreaterThanOrEqual(4);
  expect(bodies.every((b) => b.token === 'secret')).toBe(true);
});

test('reload keeps events and resumes position', async ({ page }) => {
  await setupTeamAndMatch(page);
  await openRecord(page);
  await page.getByRole('button', { name: '後半' }).tap();
  await record(page, 'ボール奪取', [[2, 2]]);
  await page.getByRole('button', { name: 'パス', exact: true }).tap();
  await zone(page, 3, 3).tap();
  await page.reload();
  await expect(page.getByText('プレーを選んでください')).toBeVisible();
  await expect(page.getByText('この選手の記録 1件')).toBeVisible();
  await expect(page.getByRole('button', { name: '後半' })).toHaveClass(/on/);
  await expect(page.getByText('送信先が未設定')).toBeVisible();
});

test('offline then online', async ({ page, context }) => {
  const bodies = await fakeScript(page);
  await saveSettings(page);
  await setupTeamAndMatch(page);
  await openRecord(page);
  await context.setOffline(true);
  await record(page, 'ボール奪取', [[2, 2]]);
  await record(page, '1対1', [[2, 3]]);
  await expect(page.getByText('未送信 2件')).toBeVisible();
  expect(bodies.length).toBe(0);
  await context.setOffline(false);
  await expect(page.getByText('送信済み')).toBeVisible({ timeout: 15_000 });
  const ids = bodies.filter((b) => b.action === 'upsertEvent').map((b) => (b.row as unknown[])[8]);
  expect(ids).toEqual(['ボール奪取', '1対1']);
});

test('event list: jump, edit, delete', async ({ page }) => {
  const bodies = await fakeScript(page);
  await saveSettings(page);
  await setupTeamAndMatch(page);
  await openRecord(page);
  await record(page, 'パス', [[3, 2], [3, 4]]);
  await record(page, 'コンドゥクシオン', [[3, 4], [3, 5]]);
  await page.getByRole('button', { name: '記録一覧' }).tap();
  const rows = page.locator('#events li');
  await expect(rows).toHaveCount(2);

  // 直す: 2件目をプロテクション・失敗にする
  await rows.nth(1).getByRole('button', { name: '直す' }).tap();
  await record(page, 'プロテクション', [[2, 4], [2, 5]], true);
  await expect(rows.nth(1)).toContainText('プロテクション 失敗');

  await rows.nth(0).getByRole('button', { name: '消す' }).tap();
  await expect(rows).toHaveCount(1);
  await expect.poll(() => bodies.some((b) => b.action === 'deleteEvent')).toBe(true);

  await rows.nth(0).locator('.jump').tap();
  await expect(page.getByText('プレーを選んでください')).toBeVisible();
});
