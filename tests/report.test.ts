import { expect, test } from 'vitest';
import { emptyMatchReport, scoreTotal, type MatchReport } from '../src/domain/report';

const withScore = (h1: [string, string], h2: [string, string]): MatchReport => ({
  ...emptyMatchReport('m1'),
  score: { '1H': { us: h1[0], them: h1[1] }, '2H': { us: h2[0], them: h2[1] } },
});

test('score total adds halves', () => {
  expect(scoreTotal(withScore(['1', '2'], ['1', '3']))).toEqual({ us: '2', them: '5' });
});

test('score total accepts full-width digits', () => {
  expect(scoreTotal(withScore(['１', '２'], ['1', '']))).toEqual({ us: '2', them: '2' });
});

test('score total is blank when nothing is entered', () => {
  expect(scoreTotal(emptyMatchReport('m1'))).toEqual({ us: '', them: '' });
});
