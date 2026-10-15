import { expect, test } from '@playwright/test';
import { addVideo, APP, setupTeamAndMatch, setupThreeVideoMatch } from './helpers';

test('roster → match → player select, persists after reload', async ({ page }) => {
  await setupTeamAndMatch(page);
  await expect(page.getByRole('button', { name: /#7 佐藤 一郎/ })).toBeVisible();
  await expect(page.getByText('テストFC')).toBeVisible();
  await page.goto(APP + '#/');
  await page.reload();
  await expect(page.getByText('テストFC')).toBeVisible();
  await expect(page.getByText('8人制')).toBeVisible();
});

test('invalid YouTube link shows error and does not save', async ({ page }) => {
  await setupTeamAndMatch(page);
  await page.goto(APP + '#/match/new');
  await page.getByLabel('対戦相手').fill('ダメFC');
  await page.getByLabel('YouTube のリンク ①').fill('https://example.com/x');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('YouTube のリンクを貼ってください')).toBeVisible();
  await page.goto(APP + '#/');
  await expect(page.getByText('ダメFC')).toHaveCount(0);
});

test('home asks for roster first when empty', async ({ page }) => {
  await page.goto(APP + '#/');
  await expect(page.getByText('まず名簿を登録してください')).toBeVisible();
});

test('several links with halves are saved and shown again', async ({ page }) => {
  await setupThreeVideoMatch(page);
  await page.getByRole('button', { name: '試合を直す' }).click();
  const rows = page.locator('.video-row');
  await expect(rows).toHaveCount(3);
  await expect(page.getByLabel('YouTube のリンク ②')).toHaveValue('https://youtu.be/bbbBBB22222');
  await expect(page.getByLabel('YouTube のリンク ③')).toHaveValue('https://youtu.be/cccCCC33333');
  await expect(rows.nth(0).getByRole('button', { name: '前半', exact: true })).toHaveClass(/on/);
  await expect(rows.nth(1).getByRole('button', { name: '前半', exact: true })).toHaveClass(/on/);
  await expect(rows.nth(2).getByRole('button', { name: '後半', exact: true })).toHaveClass(/on/);
});

test('a new link row takes the half of the row above', async ({ page }) => {
  await setupTeamAndMatch(page);
  await page.getByRole('button', { name: '試合を直す' }).click();
  await addVideo(page, 'https://youtu.be/cccCCC33333', '後半');
  await page.getByRole('button', { name: '＋ リンクを足す' }).click();
  await expect(page.locator('.video-row').nth(2).getByRole('button', { name: '後半', exact: true })).toHaveClass(/on/);
});

test('one bad link among several blocks saving', async ({ page }) => {
  await setupTeamAndMatch(page);
  await page.getByRole('button', { name: '試合を直す' }).click();
  await addVideo(page, 'https://example.com/x', '後半');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('YouTube のリンクを貼ってください')).toBeVisible();
});

test('the last remaining link cannot be removed', async ({ page }) => {
  await setupTeamAndMatch(page);
  await page.getByRole('button', { name: '試合を直す' }).click();
  await expect(page.locator('.video-row').getByRole('button', { name: '消す' })).toHaveCount(0);
});

test('removing a link with records asks first and keeps the records', async ({ page }) => {
  await setupThreeVideoMatch(page);
  const matchId = page.url().split('#/match/')[1];
  // ②のリンクで記録が1件ある状態を作る
  await page.evaluate(async (id) => {
    const req = indexedDB.open('match-analysis');
    const d: IDBDatabase = await new Promise((ok) => { req.onsuccess = () => ok(req.result); });
    const m: { videos: { id: string }[]; playerIds: string[] } = await new Promise((ok) => {
      const g = d.transaction('matches').objectStore('matches').get(id);
      g.onsuccess = () => ok(g.result);
    });
    const players: { id: string; name: string }[] = await new Promise((ok) => {
      const g = d.transaction('players').objectStore('players').getAll();
      g.onsuccess = () => ok(g.result);
    });
    const yamada = players.find((p) => p.name === '山田 太郎')!.id;
    if (!m.playerIds.includes(yamada)) throw new Error('山田さんが出場選手にいない');
    await new Promise((ok) => {
      const t = d.transaction('events', 'readwrite');
      t.objectStore('events').put({ id: 'ev-v2', matchId: id, half: '1H', playerId: yamada, type: 'shot', subtype: 'on_target', foot: 'R', success: true,
        startZone: { lane: 3, col: 6 }, endZone: null, passDirectionOverride: null, videoId: m.videos[1].id, videoTimeSec: 12, createdAt: new Date().toISOString() });
      t.oncomplete = ok;
    });
  }, matchId);
  await page.getByRole('button', { name: '試合を直す' }).click();
  let message = '';
  page.once('dialog', (dlg) => { message = dlg.message(); void dlg.dismiss(); });
  await page.locator('.video-row').nth(1).getByRole('button', { name: '消す' }).click();
  expect(message).toBe('このリンクで記録した1件が映像に飛べなくなります。消しますか？');
  await expect(page.locator('.video-row')).toHaveCount(3);
  page.once('dialog', (dlg) => void dlg.accept());
  await page.locator('.video-row').nth(1).getByRole('button', { name: '消す' }).click();
  await expect(page.locator('.video-row')).toHaveCount(2);
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByRole('button', { name: /#10 山田 太郎/ })).toContainText('記録 1件');
});
