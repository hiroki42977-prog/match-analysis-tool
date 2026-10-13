import { expect, test } from 'vitest';
import { effectivePassDirection, passDirection } from '../src/domain/direction';
import { ev } from './helpers';

test('forward/lateral/backward by column diff', () => {
  expect(passDirection({ lane: 3, col: 2 }, { lane: 3, col: 4 })).toBe('forward');
  expect(passDirection({ lane: 1, col: 3 }, { lane: 5, col: 3 })).toBe('lateral');
  expect(passDirection({ lane: 2, col: 5 }, { lane: 2, col: 1 })).toBe('backward');
});

test('override wins', () => {
  expect(effectivePassDirection(ev({ subtype: 'forward', passDirectionOverride: 'lateral' }))).toBe('lateral');
  expect(effectivePassDirection(ev({ subtype: 'forward', passDirectionOverride: null }))).toBe('forward');
});
