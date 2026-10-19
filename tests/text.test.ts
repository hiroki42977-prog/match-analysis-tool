import { expect, test } from 'vitest';
import { fitLines, jpDate, wrapText } from '../src/report/text';

const one = (s: string) => s.length;

test('wrapText keeps line breaks and wraps long lines', () => {
  expect(wrapText('あいうえおかき\nくけ', 5, one)).toEqual(['あいうえお', 'かき', 'くけ']);
  expect(wrapText('', 5, one)).toEqual(['']);
});

test('fitLines cuts with …', () => {
  const text = Array.from({ length: 30 }, (_, i) => `${i}行目の文`).join('\n');
  const lines = fitLines(text, 10, 4, one);
  expect(lines).toHaveLength(4);
  expect(lines[3].endsWith('…')).toBe(true);
  expect(one(lines[3])).toBeLessThanOrEqual(10);
  expect(fitLines('短い', 10, 4, one)).toEqual(['短い']);
});

test('jpDate', () => {
  expect(jpDate('2026-09-22')).toBe('2026年9月22日');
});
