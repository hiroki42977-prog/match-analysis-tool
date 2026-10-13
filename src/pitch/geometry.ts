import type { Zone } from '../domain/types';

/** ピッチの大きさ（メートル）。横向きで右が攻める向き */
export const PITCH = { w: 105, h: 68 };
const COL_W = PITCH.w / 6;
const LANE_H = PITCH.h / 5;

export function zoneRect(z: Zone): { x: number; y: number; w: number; h: number } {
  return { x: +((z.col - 1) * COL_W).toFixed(4), y: +((z.lane - 1) * LANE_H).toFixed(4), w: COL_W, h: LANE_H };
}

export function zoneAt(x: number, y: number): Zone | null {
  if (x < 0 || y < 0 || x > PITCH.w || y > PITCH.h) return null;
  return { lane: Math.min(5, Math.floor(y / LANE_H) + 1), col: Math.min(6, Math.floor(x / COL_W) + 1) };
}

export function zoneCenter(z: Zone): { x: number; y: number } {
  const r = zoneRect(z);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}
