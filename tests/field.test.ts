import { expect, test } from 'vitest';
import { mapPanelSvg, positionFieldSvg } from '../src/pitch/field';
import { sheetPitchSvg } from '../src/pitch/sheet';

test('position field: green horizontal pitch with white lines', () => {
  const svg = positionFieldSvg();
  expect(svg).toContain('viewBox="0 0 115 78"');
  expect(svg).toMatch(/<rect[^>]*fill="#2f8f4e"/);
  expect(svg).toContain('stroke="#ffffff"');
  expect(svg.match(/<circle/g)!.length).toBeGreaterThanOrEqual(4); // センターサークル＋点3つ
});

test('map panel: band title, nested map, outer border', () => {
  const map = sheetPitchSvg({ label: '1st', arrows: [], marks: [] }, 'green');
  const svg = mapPanelSvg('プレーマップ 1st', map);
  expect(svg).toContain('viewBox="0 0 720 350"');
  expect(svg).toMatch(/<rect[^>]*height="20"[^>]*fill="#4a4a4a"/);
  expect(svg).toContain('>プレーマップ 1st<');
  expect(svg).toMatch(/<svg x="115" y="24" width="490" height="310"/);
  expect(svg).toMatch(/<rect[^>]*fill="none"[^>]*stroke="#555555"/);
});
