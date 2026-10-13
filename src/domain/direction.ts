import type { PassSub, PlayEvent, Zone } from './types';

/** 要件 5.1: 列の差で前・横・後ろを決める */
export function passDirection(start: Zone, end: Zone): PassSub {
  const diff = end.col - start.col;
  if (diff > 0) return 'forward';
  if (diff < 0) return 'backward';
  return 'lateral';
}

export function effectivePassDirection(e: PlayEvent): PassSub {
  return e.passDirectionOverride ?? (e.subtype as PassSub);
}
