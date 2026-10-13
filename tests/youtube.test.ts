import { expect, test } from 'vitest';
import { parseYouTubeId } from '../src/video/youtube';

test('parseYouTubeId accepts common forms', () => {
  for (const u of [
    'https://youtu.be/abcDEF12345?t=30',
    'https://www.youtube.com/watch?v=abcDEF12345&t=1m',
    'https://m.youtube.com/watch?v=abcDEF12345',
    'https://www.youtube.com/shorts/abcDEF12345',
    'https://www.youtube.com/live/abcDEF12345',
    '  https://youtube.com/watch?v=abcDEF12345  ',
  ]) expect(parseYouTubeId(u), u).toBe('abcDEF12345');
});

test('parseYouTubeId rejects others', () => {
  for (const u of ['https://example.com/watch?v=abcDEF12345', '', 'abc', 'https://www.youtube.com/watch?v=short']) {
    expect(parseYouTubeId(u), u).toBeNull();
  }
});

import { vi } from 'vitest';
import { createFakePlayer } from '../src/video/youtube';

test('fake player advances only while playing, honors seek and rate', () => {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const p = createFakePlayer(10);
  expect(p.currentTime()).toBe(10);
  p.play();
  now = 2000;
  expect(p.currentTime()).toBe(12);
  p.setRate(2);
  now = 3000;
  expect(p.currentTime()).toBe(14);
  p.pause();
  now = 9000;
  expect(p.currentTime()).toBe(14);
  expect(p.isPlaying()).toBe(false);
  p.seek(4);
  expect(p.currentTime()).toBe(4);
  vi.restoreAllMocks();
});
