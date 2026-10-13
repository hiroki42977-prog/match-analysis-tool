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

  // 図: 全体マップ（絵だけ）、パス、ドリブル、守備、シュート。上に一言まとめ
  await expect(page.locator('#map-pass .summary')).toHaveText('パス 3本・成功 67%');
  await expect(page.locator('#map-overall-1H .summary')).toHaveText('パス 3本 67%・ドリブル 1本 100%・守備 1本 100%');
  await expect(page.locator('#map-overall-1H')).not.toContainText('パ3');
  await expect(page.locator('#map-overall-1H .mark')).toHaveCount(1);
  await expect(page.locator('#map-overall-1H path.dribble[data-style="wave"]')).toHaveCount(1);
  await expect(page.locator('#map-overall-2H .summary')).toHaveText('パス 0本・ドリブル 0本・守備 0本');
  await expect(page.locator('#map-defense .mark')).toHaveCount(1);
  await expect(page.locator('#map-shot .mark')).toHaveCount(1);
  await expect(page.locator('#map-dribble-1H .legend-item')).toHaveCount(5);

  // 場所ごとの本数（パス・ドリブル）
  await expect(page.locator('#heatmap')).toContainText('3本');

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
    expect(r.images).toHaveLength(7);
    expect(r.images[0].label).toContain('全体マップ（前半）');
    for (const img of r.images) expect(img.pngBase64.startsWith('iVBOR')).toBe(true);
    expect(r.stats.values[19][0]).toBe('パス成功');
    expect(r.statsTabName).toMatch(/^\d+\/\d+ vs テストFC スタッツ$/);
  }
});
