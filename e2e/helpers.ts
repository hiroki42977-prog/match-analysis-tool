import { expect, type Page } from '@playwright/test';

export const APP = './?fakeVideo=1';

export async function setupTeamAndMatch(page: Page) {
  await page.goto(APP + '#/roster');
  await page.getByPlaceholder('チーム名').fill('サンプルFC');
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
  await page.getByLabel('YouTube のリンク ①').fill('https://youtu.be/abcDEF12345');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByRole('button', { name: /#10 山田 太郎/ })).toBeVisible();
}

/** 試合の登録画面で、リンクの行を1本足して入れる */
export async function addVideo(page: Page, url: string, half: '前半' | '後半') {
  await page.getByRole('button', { name: '＋ リンクを足す' }).click();
  const row = page.locator('.video-row').last();
  await row.getByRole('textbox').fill(url);
  await row.getByRole('button', { name: half, exact: true }).click();
}

/** 試合を3本のリンク（①前半 ②前半 ③後半）で作り直す。選手選びの画面で終わる */
export async function setupThreeVideoMatch(page: Page) {
  await setupTeamAndMatch(page);
  await page.getByRole('button', { name: '試合を直す' }).click();
  await addVideo(page, 'https://youtu.be/bbbBBB22222', '前半');
  await addVideo(page, 'https://youtu.be/cccCCC33333', '後半');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByRole('button', { name: /#10 山田 太郎/ })).toBeVisible();
}

export const ENDPOINT = 'https://script.google.com/macros/s/TEST/exec';

/** Apps Script の代わりに受け取り、届いた中身を貯める */
export async function fakeScript(page: Page) {
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/script.google.com/**', async (route) => {
    bodies.push(JSON.parse(route.request().postData() ?? '{}'));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  return bodies;
}

export async function saveSettings(page: Page) {
  await page.goto(APP + '#/settings');
  await page.getByLabel('Apps Script の URL').fill(ENDPOINT);
  await page.getByLabel('合言葉').fill('secret');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('保存しました')).toBeVisible();
}

export async function openRecord(page: Page, player = '#10 山田 太郎') {
  await page.getByRole('button', { name: new RegExp(player) }).click();
  await expect(page.getByText('プレーを選んでください')).toBeVisible();
}

export const zone = (page: Page, lane: number, col: number) => page.locator(`#pitch rect[data-lane="${lane}"][data-col="${col}"]`);

const SHOTS = ['枠内R', '枠内L', '枠外R', '枠外L'];

/** プレーのボタン（シュート以外は ○＝成功・×＝失敗）→ マスの順に押す */
export async function record(page: Page, play: string, zones: [number, number][], fail = false) {
  const name = SHOTS.includes(play) ? play : `${play} ${fail ? '×' : '○'}`;
  await page.getByRole('button', { name, exact: true }).tap();
  for (const [l, c] of zones) await zone(page, l, c).tap();
}
