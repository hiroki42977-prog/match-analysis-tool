import { expect, test } from 'vitest';
import type { Match, Player } from '../src/domain/types';
import { pdfFileName } from '../src/report/pdf';

const match: Match = { id: 'm1', teamId: 't1', date: '2026-10-13', opponent: 'テストFC', format: '8', videos: [{ id: 'v1', url: '', half: '1H' }], playerIds: ['p1'] };
const player: Player = { id: 'p1', teamId: 't1', number: 10, name: '山田 太郎' };

test('pdf file name: date, opponent, number and name', () => {
  expect(pdfFileName(match, player)).toBe('2026-10-13_vs_テストFC_#10山田 太郎.pdf');
});

test('slashes in names do not break the file name', () => {
  expect(pdfFileName({ ...match, opponent: 'A/B\\C' }, player)).toBe('2026-10-13_vs_A-B-C_#10山田 太郎.pdf');
});
