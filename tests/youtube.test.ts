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
