import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
// fakeSpreadsheet(): getSheetByName / insertSheet / getSheets / deleteSheet を持つ ss と、
// シートごとに values（A1→値）・images（{ key, removed }）・calls（呼ばれた関数名と引数）を記録する簡単なまね。
// getRange(a1) は merge / setValue / setBackground ... / setBorder / clearContent（範囲の values を消す）を持つ。
import { fakeSpreadsheet, fakeGlobals } from './fakeAppsScript';

const gs = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
const load = () => new Function(...Object.keys(fakeGlobals), `${gs}\nreturn { renderSheet, buildSheet };`)(...Object.values(fakeGlobals));
const layout = {
  version: 1, colWidths: Array(10).fill(72), rowHeights: Array(61).fill(20),
  frame: [{ range: 'A2:B2', value: '写真', style: {} }, { range: 'C10:E10', style: { wrap: true } }],
  frameImages: [{ key: 'frame:field', col: 6, row: 3, offsetX: 0, offsetY: 0, width: 10, height: 10, pngBase64: 'AA==' }],
  toolRange: 'A22:J53',
  tool: [{ range: 'A22:J22', value: 'パス成功率', style: {} }],
  toolImages: ['tool:radar-1H', 'tool:map-1st'].map((key) => ({ key, col: 1, row: 20, offsetX: 0, offsetY: 0, width: 10, height: 10, pngBase64: 'AA==' })),
};

test('new tab gets frame, tool cells and all images', () => {
  const { renderSheet } = load();
  const ss = fakeSpreadsheet();
  expect(renderSheet(ss, '10/19 vs テストFC', layout)).toBe(true);
  const sh = ss.getSheetByName('10/19 vs テストFC');
  expect(sh.values.A2).toBe('写真');
  expect(sh.values.A22).toBe('パス成功率');
  expect(sh.liveImages().map((i: { key: string }) => i.key)).toEqual(['frame:field', 'tool:radar-1H', 'tool:map-1st']);
  expect(sh.calls.some((c: { fn: string }) => c.fn === 'setHiddenGridlines')).toBe(true);
});

test('resend keeps staff text and pictures, replaces only tool images', () => {
  const { renderSheet } = load();
  const ss = fakeSpreadsheet();
  renderSheet(ss, 'T', layout);
  const sh = ss.getSheetByName('T');
  sh.values.C10 = '担当者のメモ';
  sh.addUserImage('');                     // 担当者が貼った写真（代替テキストなし）
  expect(renderSheet(ss, 'T', { ...layout, tool: [{ range: 'A22:J22', value: '更新', style: {} }] })).toBe(false);
  expect(sh.values.C10).toBe('担当者のメモ');
  expect(sh.values.A22).toBe('更新');
  expect(sh.liveImages().map((i: { key: string }) => i.key).sort()).toEqual(['', 'frame:field', 'tool:map-1st', 'tool:radar-1H']);
});

test('first build is retry-safe: a leftover half-made tab is replaced and renamed at the end', () => {
  const { renderSheet } = load();
  const ss = fakeSpreadsheet();
  // 1回目は途中で失敗（読めない範囲）→ 本来の名前のタブはできず、（作成中）だけが残る
  expect(() => renderSheet(ss, 'T', { ...layout, tool: [{ range: '??', value: 'x', style: {} }] })).toThrow();
  expect(ss.getSheetByName('T')).toBeFalsy();
  expect(ss.getSheetByName('T（作成中）')).toBeTruthy();
  // 2回目：残りを消して作り直し、最後に名前を付ける
  expect(renderSheet(ss, 'T', layout)).toBe(true);
  const sh = ss.getSheetByName('T');
  expect(sh.values.A2).toBe('写真');
  expect(sh.values.A22).toBe('パス成功率');
  expect(ss.getSheets().map((s: { getName(): string }) => s.getName())).toEqual(['T']);
});

test('resend clears old tool cells, unmerges the tool range and leaves the frame alone', () => {
  const { renderSheet } = load();
  const ss = fakeSpreadsheet();
  renderSheet(ss, 'T', { ...layout, tool: [...layout.tool, { range: 'A30', value: 'old', style: {} }] });
  const sh = ss.getSheetByName('T');
  sh.values.A2 = 'X';                      // 担当者が枠の文字を書き換えた
  sh.calls = [];
  renderSheet(ss, 'T', layout);
  expect(sh.values.A30).toBeUndefined();
  expect(sh.values.A2).toBe('X');
  expect(sh.calls.some((c: { fn: string; args: unknown[] }) => c.fn === 'breakApart' && c.args[0] === 'A22:J53')).toBe(true);
  expect(sh.calls.some((c: { fn: string; args: unknown[] }) => String(c.args[0]).startsWith('A2:'))).toBe(false);
});

test('version mismatch writes nothing', () => {
  const { buildSheet } = load();
  expect(() => buildSheet({ playerFileName: 'x', tabName: 'T', layout: { ...layout, version: 2 } })).toThrow('版が合いません');
});

test('a tab made with a different layout is kept as （旧） and a new tab is built', () => {
  const { renderSheet } = load();
  const ss = fakeSpreadsheet();
  renderSheet(ss, 'T', layout);
  const old = ss.getSheetByName('T');
  old.values.C10 = '前の形に書いたメモ';
  const next = { ...layout, colWidths: Array(20).fill(36), toolRange: 'A20:T51', tool: [{ range: 'A20:T20', value: '新しい表', style: {} }] };
  expect(renderSheet(ss, 'T', next)).toBe(true);
  expect(old.name).toBe('T（旧）');
  expect(old.values.C10).toBe('前の形に書いたメモ');
  expect(old.calls.some((c: { fn: string; args: unknown[] }) => c.fn === 'breakApart')).toBe(false);
  const fresh = ss.getSheetByName('T');
  expect(fresh).not.toBe(old);
  expect(fresh.values.A20).toBe('新しい表');
  expect(fresh.values.A2).toBe('写真');
  // もう一度前の形のタブができても、名前がぶつからない
  const again = ss.getSheetByName('T');
  again.widths[1] = 72;
  renderSheet(ss, 'T', next);
  expect(again.name).toBe('T（旧2）');
});
