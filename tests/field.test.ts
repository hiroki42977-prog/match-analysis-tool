import { expect, test } from 'vitest';
import { mapPageSvg, positionFieldSvg } from '../src/pitch/field';
import { sheetPitchSvg } from '../src/pitch/sheet';

test('position field: green horizontal pitch with white lines', () => {
  const svg = positionFieldSvg();
  expect(svg).toContain('viewBox="0 0 115 78"');
  expect(svg).toMatch(/<rect[^>]*fill="#2f8f4e"/);
  expect(svg).toContain('stroke="#ffffff"');
  expect(svg.match(/<circle/g)!.length).toBeGreaterThanOrEqual(4); // センターサークル＋点3つ
});

test('map page: logo box on page 1, label, nested map on turf', () => {
  const map = sheetPitchSvg({ label: '1st', arrows: [], marks: [] }, 'green');
  const a = mapPageSvg('1st', map, true);
  expect(a).toContain('viewBox="0 0 720 380"');
  expect(a).toContain('>チームロゴ<');
  expect(a).toContain('>1st<');
  expect(a).toContain('<svg x="153.5" y="50" width="521" height="330"');
  const b = mapPageSvg('2nd', map, false);
  expect(b).toContain('viewBox="0 0 720 330"');
  expect(b).toContain('>2nd<');
  expect(b).toContain('y="0" width="521"');
  expect(b).not.toContain('チームロゴ');
});
