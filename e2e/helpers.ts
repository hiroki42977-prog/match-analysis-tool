import { expect, type Page } from '@playwright/test';

export const APP = '/?fakeVideo=1';

export async function setupTeamAndMatch(page: Page) {
  await page.goto(APP + '#/roster');
  await page.getByPlaceholder('チーム名').fill('吹田南FC');
  await page.getByRole('button', { name: 'チームを追加' }).click();
  for (const [num, name] of [['10', '山田 太郎'], ['7', '佐藤 一郎']]) {
    await page.getByPlaceholder('背番号').fill(num);
    await page.getByPlaceholder('名前').fill(name);
    await page.getByRole('button', { name: '選手を追加' }).click();
  }
  await expect(page.getByText('#10 山田 太郎')).toBeVisible();
  await page.goto(APP + '#/match/new');
  await page.getByLabel('対戦相手').fill('テストFC');
  await page.getByRole('button', { name: '8人制' }).click();
  await page.getByLabel('YouTube のリンク').fill('https://youtu.be/abcDEF12345');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByRole('button', { name: /#10 山田 太郎/ })).toBeVisible();
}
