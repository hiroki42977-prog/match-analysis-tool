import { expect, test } from '@playwright/test';
import { APP, fakeScript, openRecord, record, saveSettings, setupTeamAndMatch, setupThreeVideoMatch, zone } from './helpers';

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
});

test('records pass, failed dribble, shot; fixes and undoes', async ({ page }) => {
  const bodies = await fakeScript(page);
  await saveSettings(page);
  await setupTeamAndMatch(page);
  await openRecord(page);
  const recent = page.locator('#recent');

  await page.getByRole('button', { name: 'パス ○', exact: true }).tap();
  await expect(page.getByText('パス ○ ― 始点ゾーンを押してください')).toBeVisible();
  await zone(page, 3, 2).tap();
  await expect(page.getByText('パス ○ ― 終点ゾーンを押してください')).toBeVisible();
  await zone(page, 3, 4).tap();
  await expect(recent.locator('li').first()).toContainText('パス(前) 成功');

  await record(page, 'レガーテ', [[1, 4], [1, 5]], true);
  await expect(recent.locator('li').first()).toContainText('レガーテ 失敗');
  await record(page, '枠内L', [[3, 6]]);
  await expect(recent.locator('li').first()).toContainText('枠内L');
  await expect(page.getByText('この選手の記録 3件')).toBeVisible();

  // 最後のマスの2度押しは1件だけ
  await page.getByRole('button', { name: '空中戦 ○', exact: true }).tap();
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
  await page.getByRole('button', { name: 'パス ○', exact: true }).tap();
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

const tab = (page: import('@playwright/test').Page, name: string) => page.locator('#video-tabs').getByRole('button', { name, exact: true });
const halfBtn = (page: import('@playwright/test').Page, name: '前半' | '後半') => page.locator('.controls').getByRole('button', { name, exact: true });

test('one link: no video tabs', async ({ page }) => {
  await setupTeamAndMatch(page);
  await openRecord(page);
  await expect(page.locator('#video-tabs')).toHaveCount(0);
});

test('switching to a second-half link sets the half and is remembered', async ({ page }) => {
  await setupThreeVideoMatch(page);
  await openRecord(page);
  await expect(page.locator('#video-tabs button')).toHaveText(['①前半', '②前半', '③後半']);
  await expect(tab(page, '①前半')).toHaveClass(/on/);
  await tab(page, '③後半').tap();
  await expect(tab(page, '③後半')).toHaveClass(/on/);
  await expect(halfBtn(page, '後半')).toHaveClass(/on/);
  await expect(page.getByText('映像の準備中…')).toHaveCount(0);
  await record(page, 'パス', [[3, 2], [3, 4]]);
  await expect(page.getByText('この選手の記録 1件')).toBeVisible();
  await page.getByRole('button', { name: '記録一覧' }).tap();
  await expect(page.locator('#events li').first()).toContainText('後半');
  await page.getByRole('button', { name: '← 記録画面' }).tap();
  await expect(tab(page, '③後半')).toHaveClass(/on/);
});

test('jumping from the list opens the link the event was recorded on', async ({ page }) => {
  await setupThreeVideoMatch(page);
  await openRecord(page);
  await tab(page, '②前半').tap();
  await expect(page.getByText('映像の準備中…')).toHaveCount(0);
  await record(page, '枠内R', [[3, 6]]);
  await tab(page, '③後半').tap();
  await expect(tab(page, '③後半')).toHaveClass(/on/);
  await page.getByRole('button', { name: '記録一覧' }).tap();
  await page.locator('#events li').first().getByRole('button').first().tap();
  await expect(tab(page, '②前半')).toHaveClass(/on/);
  await expect(halfBtn(page, '前半')).toHaveClass(/on/);
});

test('progress on a removed link starts from the first link', async ({ page }) => {
  await setupThreeVideoMatch(page);
  await openRecord(page);
  await tab(page, '③後半').tap();
  await expect(tab(page, '③後半')).toHaveClass(/on/);
  await page.getByRole('button', { name: '選手を変える' }).tap();
  await page.getByRole('button', { name: '試合を直す' }).click();
  await page.locator('.video-row').nth(2).getByRole('button', { name: '消す' }).click();
  await page.getByRole('button', { name: '保存' }).click();
  await openRecord(page);
  await expect(page.locator('#video-tabs button')).toHaveText(['①前半', '②前半']);
  await expect(tab(page, '①前半')).toHaveClass(/on/);
});

test('a match saved in the old form (one videoUrl) still records', async ({ page }) => {
  await setupTeamAndMatch(page);
  const matchId = page.url().split('#/match/')[1];
  await page.evaluate(async (id) => {
    const req = indexedDB.open('match-analysis');
    const d: IDBDatabase = await new Promise((ok) => { req.onsuccess = () => ok(req.result); });
    const store = () => d.transaction('matches', 'readwrite').objectStore('matches');
    const m: Record<string, unknown> & { videos: { url: string }[] } = await new Promise((ok) => {
      const g = store().get(id);
      g.onsuccess = () => ok(g.result);
    });
    const { videos, ...rest } = m;
    await new Promise((ok) => { store().put({ ...rest, videoUrl: videos[0].url }).onsuccess = ok; });
  }, matchId);
  await page.goto(APP + `#/match/${matchId}`);
  await openRecord(page);
  await expect(page.locator('#video-tabs')).toHaveCount(0);
  await record(page, 'パス', [[3, 2], [3, 4]]);
  await expect(page.getByText('この選手の記録 1件')).toBeVisible();
});

test('switching back to a link continues from where it was', async ({ page }) => {
  await setupThreeVideoMatch(page);
  await openRecord(page);
  await expect(page.getByText('映像の準備中…')).toHaveCount(0);
  // ①を少し進めて止める
  await page.getByRole('button', { name: '▶' }).tap();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: '❚❚' }).tap();
  await tab(page, '②前半').tap();
  await expect(page.getByText('映像の準備中…')).toHaveCount(0);
  await record(page, '枠内R', [[3, 6]]);
  await expect(page.locator('#recent li').first().locator('.time')).toHaveText('0:00');
  // 画面を出て入り直しても、①は続きから
  await page.getByRole('button', { name: '選手を変える' }).tap();
  await openRecord(page);
  await tab(page, '①前半').tap();
  await expect(page.getByText('映像の準備中…')).toHaveCount(0);
  await record(page, '枠内L', [[3, 6]]);
  await expect(page.locator('#recent li').first().locator('.time')).not.toHaveText('0:00');
});
