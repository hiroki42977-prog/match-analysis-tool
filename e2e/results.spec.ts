import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { fakeScript, openRecord, record, saveSettings, setupTeamAndMatch } from './helpers';

test('results: stats, heatmap, csv, report', async ({ page }) => {
  const bodies = await fakeScript(page);
  await saveSettings(page);
  await setupTeamAndMatch(page);
  const matchUrl = page.url();

  await openRecord(page, '#10 山田 太郎');
  await record(page, 'パス', [[3, 2], [3, 4]]);
  await record(page, 'パス', [[3, 2], [3, 3]]);
  await record(page, 'パス', [[3, 2], [2, 1]], true);
  await record(page, 'コンドゥクシオン', [[2, 2], [2, 4]]);
  await record(page, 'ボール奪取', [[2, 2]]);
  await record(page, '枠内R', [[3, 6]]);
  await expect(page.getByText('この選手の記録 6件')).toBeVisible();

  await page.goto(matchUrl);
  await openRecord(page, '#7 佐藤 一郎');
  await record(page, '空中戦', [[1, 1]], true);
  await expect(page.getByText('この選手の記録 1件')).toBeVisible();

  await page.getByRole('button', { name: '結果を見る' }).tap();
  await expect(page.getByRole('heading', { name: /結果/ })).toBeVisible();

  // 選手別の表（背番号順で #7 が最初なので #10 を選ぶ）
  await page.locator('.chips').getByRole('button', { name: '#10 山田 太郎' }).tap();
  const stats = page.locator('#player-stats');
  await expect(stats.getByRole('row', { name: /^前/ })).toContainText('2/2');
  await expect(stats.getByRole('row', { name: /パス 合計/ })).toContainText('2/3 67%');
  await expect(stats.getByRole('row', { name: /後ろ/ }).first()).toContainText('0/1 0%');

  // ヒートマップ: パスはゾーン(3,2)に3本
  await expect(page.locator('#heatmap')).toContainText('3本');
  await page.locator('#heatmap-tabs').getByRole('button', { name: '守備' }).tap();
  await expect(page.locator('#heatmap')).toContainText('1本');

  // 全体マップ: ゾーン(3,2)にパス3本、(2,2)にドリブル1本＋守備1本
  await expect(page.locator('#overall')).toContainText('パ3 ド0 守0');
  await expect(page.locator('#overall')).toContainText('パ0 ド1 守1');

  // チーム全体
  await expect(page.locator('#team-table')).toContainText('#7 佐藤 一郎');

  // CSV
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV 書き出し' }).tap()]);
  const csv = readFileSync((await download.path())!, 'utf8');
  expect(csv.startsWith('﻿記録ID,試合日,対戦相手')).toBe(true);
  expect(csv.trim().split('\r\n')).toHaveLength(8);

  // レポート作成
  await page.getByRole('button', { name: 'レポート作成' }).tap();
  await expect(page.getByText('2人分のレポートを作りました')).toBeVisible({ timeout: 20_000 });
  const reports = bodies.filter((b) => b.action === 'buildReport') as Record<string, any>[];
  expect(reports).toHaveLength(2);
  expect(reports.map((r) => r.playerFileName).sort()).toEqual(['#10 山田 太郎（サンプルFC）', '#7 佐藤 一郎（サンプルFC）']);
  for (const r of reports) {
    expect(r.images).toHaveLength(5);
    expect(r.images[4].label).toContain('全体マップ');
    for (const img of r.images) expect(img.pngBase64.startsWith('iVBOR')).toBe(true);
    expect(r.stats.values[19][0]).toBe('パス成功');
    expect(r.statsTabName).toMatch(/^\d+\/\d+ vs テストFC スタッツ$/);
  }
});
