import { expect, test } from '@playwright/test';
import { APP, setupTeamAndMatch } from './helpers';

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
  await page.getByLabel('YouTube のリンク').fill('https://example.com/x');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('YouTube のリンクを貼ってください')).toBeVisible();
  await page.goto(APP + '#/');
  await expect(page.getByText('ダメFC')).toHaveCount(0);
});

test('home asks for roster first when empty', async ({ page }) => {
  await page.goto(APP + '#/');
  await expect(page.getByText('まず名簿を登録してください')).toBeVisible();
});
