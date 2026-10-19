import { PITCH } from './geometry';

/** 見本の資料と同じ、縦向き・斜め上から見たピッチの図の大きさ（viewBox） */
export const SHEET = { w: 120, h: 76 } as const;

// 台形の位置。上の辺の幅は下の辺の 0.55 倍（見本の写真から測った値）
const BOTTOM = 71;
const TOP = 6;
const CX = 60;
const WIDTH = 100;
const R = 0.55;
const A = 1 / R - 1;

/**
 * 平らなピッチの座標（x＝0〜105 で自陣ゴール→相手ゴール、y＝0〜68 でレーン1側が0）を、
 * 上が相手ゴールの台形の座標へ写す。奥ほど横も縦も縮む
 */
export function project(x: number, y: number): { x: number; y: number } {
  const s = x / PITCH.w;
  const z = 1 + A * s;
  const t = (1 / z - 1 / (1 + A)) / (1 - 1 / (1 + A));
  return { x: CX + ((y - PITCH.h / 2) / PITCH.h) * WIDTH / z, y: TOP + (BOTTOM - TOP) * t };
}
