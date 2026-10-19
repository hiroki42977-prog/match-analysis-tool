import { expect, test } from 'vitest';
import { computeStats } from '../src/domain/stats';
import { statBlocks } from '../src/report/sheetTables';
import { ev } from './helpers';

const times = (n: number, over: Parameters<typeof ev>[0]) => Array.from({ length: n }, () => ev(over));
const fwd = { subtype: 'forward' as const };
const lat = { subtype: 'lateral' as const };
const back = { subtype: 'backward' as const };

test('pass block matches the sample numbers', () => {
  const s = computeStats([
    ...times(4, { ...fwd, success: true }), ...times(6, { ...fwd, success: false }),
    ...times(2, { ...lat, success: true }), ...times(2, { ...back, success: true }),
    ...times(2, { ...fwd, success: false, half: '2H' }),
  ]);
  const pass = statBlocks(s)[0];
  expect([pass.title, pass.successLabel, pass.failLabel, pass.totalLabel]).toEqual(['パス成功率', 'パス成功', 'パス失敗', '総パス数']);
  expect(pass.rows.map((r) => r.label)).toEqual(['前', '横', '後', '合計']);
  expect(pass.rows[0]).toEqual({ label: '前', success: [4, 0], fail: [6, 2], total: [10, 2] });
  expect(pass.rows[3]).toEqual({ label: '合計', success: [8, 0], fail: [6, 2], total: [14, 2] });
  expect(pass.rate).toEqual(['57%', '0%']);
});

test('block titles and row labels', () => {
  const b = statBlocks(computeStats([]));
  expect(b.map((x) => x.title)).toEqual(['パス成功率', 'ドリブル成功率', '守備成功率', 'シュート成功率']);
  expect(b.map((x) => x.totalLabel)).toEqual(['総パス数', '総ドリブル数', '総守備数', '総シュート数']);
  expect(b[1].rows.map((r) => r.label)).toEqual(['レガテ', 'コンドゥクシオン', 'プロテクシオン', '合計']);
  expect(b[2].rows.map((r) => r.label)).toEqual(['ボール奪取', '1vs1', '空中戦', '合計']);
  expect(b[3].rows.map((r) => r.label)).toEqual(['枠内(R)', '枠内(L)', '枠外(R)', '枠外(L)', '合計']);
});

test('rate is "-" when nothing was recorded', () => {
  const b = statBlocks(computeStats([ev({ half: '1H' })]));
  expect(b[0].rate).toEqual(['100%', '-']);
});

test('shot rows: success only in on-target rows', () => {
  const s = computeStats([
    ev({ type: 'shot', subtype: 'on_target', foot: 'R', success: true, endZone: null }),
    ev({ type: 'shot', subtype: 'off_target', foot: 'L', success: false, endZone: null }),
  ]);
  const shot = statBlocks(s)[3];
  expect(shot.rows.map((r) => [r.label, r.success[0], r.fail[0], r.total[0]])).toEqual([
    ['枠内(R)', 1, 0, 1], ['枠内(L)', 0, 0, 0], ['枠外(R)', 0, 0, 0], ['枠外(L)', 0, 1, 1], ['合計', 1, 1, 2],
  ]);
  expect(shot.rate).toEqual(['50%', '-']);
});
