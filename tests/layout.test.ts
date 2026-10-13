import { expect, test } from 'vitest';
import { buildStatsSheet } from '../src/report/layout';
import { computeStats } from '../src/domain/stats';
import { ev } from './helpers';

const stats = computeStats([
  ev({ half: '1H', subtype: 'forward', success: true }),
  ev({ half: '1H', subtype: 'forward', success: true }),
  ev({ half: '1H', subtype: 'forward', success: false }),
  ev({ half: '2H', type: 'shot', subtype: 'off_target', foot: 'L', success: false, endZone: null }),
  ev({ half: '2H', type: 'shot', subtype: 'on_target', foot: 'R', success: true, endZone: null }),
]);
const sheet = buildStatsSheet('#10 山田 太郎 ｜ 2026-10-13 vs テストFC ｜ 8人制', stats);
const v = sheet.values;

test('rectangle of 11 columns with title', () => {
  expect(v.every((r) => r.length === 11)).toBe(true);
  expect(v[0][0]).toBe('#10 山田 太郎 ｜ 2026-10-13 vs テストFC ｜ 8人制');
});

test('radar table A3:C7', () => {
  expect(v[2].slice(0, 3)).toEqual(['項目', '前半', '後半']);
  expect(v[3][0]).toBe('パス');
  expect(v[3][1]).toBeCloseTo(66.67, 1);
  expect(v[3][2]).toBeNull();
  expect(v[5].slice(0, 3)).toEqual(['シュート（枠内）', null, 50]);
  expect(sheet.radar).toEqual({ dataRange: 'A3:C7', anchors: { '1H': 'E2', '2H': 'I2' } });
});

test('pass block at row 20', () => {
  expect(v[19]).toEqual(['パス成功', '前半', '後半', null, 'パス失敗', '前半', '後半', null, 'パス成功率', '前半', '後半']);
  expect(v[20][0]).toBe('前');
  expect(v[20].slice(1, 3)).toEqual([2, 0]);
  expect(v[20].slice(5, 7)).toEqual([1, 0]);
  expect(v[20][9]).toBeCloseTo(0.667, 2);
  expect(v[20][10]).toBeNull();
  expect(v[23][0]).toBe('合計');
  expect(sheet.percentRanges).toContain('J21:K24');
});

test('blocks order and defense label 1vs1', () => {
  const heads = v.map((r) => r[0]);
  expect(heads.indexOf('ドリブル成功')).toBe(25);
  expect(heads.indexOf('守備成功')).toBe(31);
  expect(heads.indexOf('1vs1')).toBe(33);
  expect(heads.indexOf('シュート成功')).toBe(37);
});

test('shot tables', () => {
  const at = v.findIndex((r) => r[0] === 'シュート成功');
  expect(v[at]).toEqual(['シュート成功', '前半', '後半', null, 'シュート失敗', '前半', '後半', null, null, null, null]);
  expect(v.slice(at + 1, at + 5).map((r) => r[0])).toEqual(['枠内(R)', '枠内(L)', '枠外(R)', '枠外(L)']);
  expect(v[at + 1].slice(1, 3)).toEqual([0, 1]); // 枠内(R) 成功
  expect(v[at + 4].slice(1, 3)).toEqual([0, 0]); // 枠外(L) 成功の表は0
  expect(v[at + 4].slice(5, 7)).toEqual([0, 1]); // 枠外(L) 失敗
  expect(v[at + 1].slice(5, 7)).toEqual([0, 0]); // 枠内(R) 失敗の表は0
});
