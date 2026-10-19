import { expect, test } from 'vitest';
import { radarSvg } from '../src/report/radar';

const pts = (s: string) => s.trim().split(/\s+/).map((p) => p.split(',').map(Number));

test('radar: 100% pass reaches the top of the outer grid', () => {
  const svg = radarSvg({ pass: 100, dribble: null, shot: 0, defense: 50 }, '前半', '#5bc0eb');
  const outer = pts(svg.match(/<polygon class="grid" data-level="100" points="([^"]+)"/)![1]);
  const value = pts(svg.match(/<polygon class="value" points="([^"]+)"/)![1]);
  expect(value[0]).toEqual(outer[0]);
  expect(svg).toContain('>前半<');
  for (const label of ['パス', 'ドリブル', '守備', 'シュート']) expect(svg).toContain(`>${label}<`);
  expect(svg.match(/class="grid"/g)).toHaveLength(5);
});

test('radar: null is drawn as the center', () => {
  const svg = radarSvg({ pass: null, dribble: null, shot: null, defense: null }, '後半', '#2ecc71');
  const value = pts(svg.match(/<polygon class="value" points="([^"]+)"/)![1]);
  expect(new Set(value.map((p) => p.join(','))).size).toBe(1);
});
