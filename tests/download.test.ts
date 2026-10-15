import { afterEach, expect, test, vi } from 'vitest';
import { saveFile } from '../src/ui/download';

afterEach(() => vi.unstubAllGlobals());

test('uses the share sheet in home-screen mode when files can be shared', async () => {
  const share = vi.fn(async () => {});
  vi.stubGlobal('navigator', { standalone: true, canShare: () => true, share });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  const how = await saveFile('a,b', 'x.csv', 'text/csv');
  expect(how).toBe('share');
  expect((share.mock.calls[0] as unknown as [{ files: File[] }])[0].files[0].name).toBe('x.csv');
});

test('falls back to a download link otherwise', async () => {
  const click = vi.fn();
  vi.stubGlobal('navigator', {});
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('document', {
    createElement: () => ({ click, remove() {}, set href(_v: string) {}, set download(_v: string) {} }),
    body: { append() {} },
  });
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL() {} }));
  expect(await saveFile('a,b', 'x.csv', 'text/csv')).toBe('download');
  expect(click).toHaveBeenCalled();
});

