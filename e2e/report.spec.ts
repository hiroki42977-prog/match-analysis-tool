import { expect, type Page, test } from '@playwright/test';
import { openRecord, record, setupTeamAndMatch } from './helpers';

/** 2人とも記録を1件ずつ入れて、結果画面で #10 を選んだところで止める */
async function toResults(page: Page) {
  await setupTeamAndMatch(page);
  const matchUrl = page.url();
  await openRecord(page, '#7 佐藤 一郎');
  await record(page, 'パス', [[3, 2], [3, 4]]);
  await page.goto(matchUrl);
  await openRecord(page, '#10 山田 太郎');
  await record(page, 'パス', [[3, 2], [3, 4]]);
  await page.getByRole('button', { name: '結果を見る' }).tap();
  await page.locator('.chips').getByRole('button', { name: '#10 山田 太郎' }).tap();
}

test('report form: values are kept after reopening', async ({ page }) => {
  await toResults(page);
  await page.getByRole('button', { name: 'レポート入力' }).tap();
  await expect(page.getByRole('heading', { name: 'レポート入力 #10 山田 太郎' })).toBeVisible();

  await page.getByLabel('コメント').fill('1行目\n2行目');
  await page.getByLabel('試合会場').fill('市民グラウンド');
  await page.getByLabel('評価（前半）').fill('A');
  await page.getByLabel('スコア 前半 自チーム').fill('1');
  await page.getByLabel('スコア 前半 相手').fill('2');
  await page.getByLabel('スコア 後半 自チーム').fill('1');
  await page.getByLabel('スコア 後半 相手').fill('3');
  await expect(page.locator('#score-total')).toHaveText('2-5');

  await page.reload();
  await expect(page.getByLabel('コメント')).toHaveValue('1行目\n2行目');
  await expect(page.getByLabel('試合会場')).toHaveValue('市民グラウンド');
  await expect(page.getByLabel('評価（前半）')).toHaveValue('A');
  await expect(page.locator('#score-total')).toHaveText('2-5');

  await page.getByRole('button', { name: '← 結果に戻る' }).tap();
  await expect(page.getByRole('heading', { name: /結果/ })).toBeVisible();
});

test('match fields are shared, player fields are not', async ({ page }) => {
  await toResults(page);
  await page.getByRole('button', { name: 'レポート入力' }).tap();
  await page.getByLabel('試合会場').fill('市民グラウンド');
  await page.getByLabel('コメント').fill('#10 へのコメント');
  await page.getByRole('button', { name: '← 結果に戻る' }).tap();
  await page.locator('.chips').getByRole('button', { name: '#7 佐藤 一郎' }).tap();
  await page.getByRole('button', { name: 'レポート入力' }).tap();
  await expect(page.getByRole('heading', { name: 'レポート入力 #7 佐藤 一郎' })).toBeVisible();
  await expect(page.getByLabel('試合会場')).toHaveValue('市民グラウンド');
  await expect(page.getByLabel('コメント')).toHaveValue('');
});

test('photo is shrunk and shown', async ({ page }) => {
  await toResults(page);
  await page.getByRole('button', { name: 'レポート入力' }).tap();
  // 3000×2000 の大きな写真を、テストの中で作る
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 3000;
    c.height = 2000;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#3366cc';
    ctx.fillRect(0, 0, 3000, 2000);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('顔写真').setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  const img = page.locator('img[alt="顔写真"]');
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => Math.max(el.naturalWidth, el.naturalHeight))).toBeLessThanOrEqual(600);

  await page.reload();
  await expect(page.locator('img[alt="顔写真"]')).toBeVisible();
  await page.getByRole('button', { name: '顔写真を消す' }).tap();
  await expect(page.locator('img[alt="顔写真"]')).toHaveCount(0);
});

test('a file that is not an image shows a message', async ({ page }) => {
  await toResults(page);
  await page.getByRole('button', { name: 'レポート入力' }).tap();
  await page.getByLabel('相手のエンブレム').setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await expect(page.getByText('画像を読み込めませんでした')).toBeVisible();
});

test('coming back from the report form keeps the chosen player for the PDF', async ({ page }) => {
  await toResults(page);
  await page.getByRole('button', { name: 'レポート入力' }).tap();
  await page.getByLabel('コメント').fill('#10 へのコメント');
  await page.getByRole('button', { name: '← 結果に戻る' }).tap();
  // 選手を選び直さずに PDF を作る
  await expect(page.locator('.chips button.on')).toHaveText('#10 山田 太郎');
  await page.getByRole('button', { name: 'PDF 書き出し' }).tap();
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF を保存' }).tap()]);
  expect(pdf.suggestedFilename()).toContain('#10山田 太郎');
});
