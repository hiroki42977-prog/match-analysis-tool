import { expect, test } from 'vitest';
import type { Match } from '../src/domain/types';
import { upgradeMatch, videoLabel, videoOf } from '../src/domain/videos';

const base = { id: 'm1', teamId: 't1', date: '2026-10-15', opponent: 'X', format: '8' as const, playerIds: [] };
const three: Match = { ...base, videos: [
  { id: 'v1', url: 'https://youtu.be/aaaaaaaaaaa', half: '1H' },
  { id: 'v2', url: 'https://youtu.be/bbbbbbbbbbb', half: '1H' },
  { id: 'v3', url: 'https://youtu.be/ccccccccccc', half: '2H' },
] };

test('old match with only videoUrl becomes one first-half video', () => {
  const r = upgradeMatch({ ...base, videoUrl: 'https://youtu.be/abcDEF12345' });
  expect(r.changed).toBe(true);
  expect(r.match.videos).toHaveLength(1);
  expect(r.match.videos[0]).toMatchObject({ url: 'https://youtu.be/abcDEF12345', half: '1H' });
  expect(r.match.videos[0].id).toBeTruthy();
  expect('videoUrl' in r.match).toBe(false);
});

test('match that already has videos is left as is', () => {
  const r = upgradeMatch(three);
  expect(r.changed).toBe(false);
  expect(r.match.videos).toEqual(three.videos);
});

test('videoOf falls back to the first video', () => {
  expect(videoOf(three, undefined).id).toBe('v1');
  expect(videoOf(three, '消えたID').id).toBe('v1');
  expect(videoOf(three, 'v2').id).toBe('v2');
});

test('videoLabel numbers videos with their half', () => {
  expect(three.videos.map((v) => videoLabel(three, v))).toEqual(['①前半', '②前半', '③後半']);
});
