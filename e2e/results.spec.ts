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

  // 図: 見本の資料と同じく 1st・2nd の2枚だけ
  await expect(page.locator('.figures .figure')).toHaveCount(2);
  await expect(page.locator('#map-1H')).toContainText('1st');
  await expect(page.locator('#map-2H')).toContainText('2nd');
  // 前半: パス3本＋コンドゥクシオン1本の矢印、奪取とシュートの印
  await expect(page.locator('#map-1H .arrow')).toHaveCount(4);
  await expect(page.locator('#map-1H .sheet-mark[data-icon="ball"]')).toHaveCount(1);
  await expect(page.locator('#map-1H .sheet-mark[data-icon="shot-on"]')).toHaveCount(1);
  await expect(page.locator('#map-2H .arrow')).toHaveCount(0);
  // 凡例は 1st の上に1回だけ
  await expect(page.locator('.figures .sheet-legend')).toHaveCount(1);
  await expect(page.locator('.figures .sheet-legend .legend-item')).toHaveCount(9);
  const legendY = (await page.locator('.sheet-legend').boundingBox())!.y;
  expect(legendY).toBeLessThan((await page.locator('#map-1H').boundingBox())!.y);

  // 図は画面の横幅いっぱい（iPad 横向き 1180px で 1000px 以上）
  for (const id of ['#map-1H', '#heatmap']) {
    const box = (await page.locator(`${id} svg`).first().boundingBox())!;
    expect(box.width, id).toBeGreaterThan(1000);
    expect(box.height, id).toBeLessThan(720);
  }

  // 場所ごとの本数（パス・ドリブル）
  await expect(page.locator('#heatmap')).toContainText('3本');

  // チーム全体
  await expect(page.locator('#team-table')).toContainText('#7 佐藤 一郎');

  // CSV
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV 書き出し' }).tap()]);
  const csv = readFileSync((await download.path())!, 'utf8');
  expect(csv.startsWith('﻿記録ID,試合日,対戦相手')).toBe(true);
  expect(csv.trim().split('\r\n')).toHaveLength(8);

  // PDF（今選んでいる選手1人分）
  // iPad では共有はボタンを押した直後にしか開けないため、作るボタンと保存するボタンを分ける
  await page.getByRole('button', { name: 'PDF 書き出し' }).tap();
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF を保存' }).tap()]);
  expect(pdf.suggestedFilename()).toMatch(/_vs_.*\.pdf$/);
  const pdfText = readFileSync((await pdf.path())!, 'latin1');
  expect(pdfText.startsWith('%PDF')).toBe(true);
  expect(pdfText.match(/\/Type \/Page[^s]/g)).toHaveLength(2);
  // A4縦（幅 595 × 高さ 842 ポイント）
  expect(pdfText).toMatch(/\/MediaBox \[0 0 595\.\d+ 841\.\d+\]/);

  // レポート作成
  await page.getByRole('button', { name: 'レポート作成' }).tap();
  await expect(page.getByText('2人分のレポートを作りました')).toBeVisible({ timeout: 20_000 });
  const reports = bodies.filter((b) => b.action === 'buildSheet') as Record<string, any>[];
  expect(reports).toHaveLength(2);
  expect(reports.map((r) => r.playerFileName).sort()).toEqual(['#10 山田 太郎（サンプルFC）', '#7 佐藤 一郎（サンプルFC）']);
  for (const r of reports) {
    expect(r.tabName).toMatch(/^\d+\/\d+ vs テストFC$/);
    expect(r.layout.version).toBe(1);
    expect(r.layout.toolImages).toHaveLength(6);
    for (const img of [...r.layout.toolImages, ...r.layout.frameImages]) expect(img.pngBase64.startsWith('iVBOR')).toBe(true);
  }
});

test('pdf can be made with no second-half records and no report input', async ({ page }) => {
  await setupTeamAndMatch(page);
  await openRecord(page, '#10 山田 太郎');
  await record(page, 'パス', [[3, 2], [3, 4]]);
  await page.getByRole('button', { name: '結果を見る' }).tap();
  await page.getByRole('button', { name: 'PDF 書き出し' }).tap();
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF を保存' }).tap()]);
  const pdfText = readFileSync((await pdf.path())!, 'latin1');
  expect(pdfText.match(/\/Type \/Page[^s]/g)).toHaveLength(2);
  expect(pdfText).toMatch(/\/MediaBox \[0 0 595\.\d+ 841\.\d+\]/);
});
