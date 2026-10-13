import { effectivePassDirection } from '../domain/direction';
import { SUBTYPE_LABEL } from '../domain/labels';
import type { PlayEvent, Zone } from '../domain/types';

const LANE = ['', '左', '左HS', '中', '右HS', '右'];

export function zoneText(z: Zone): string {
  return `${LANE[z.lane]}・${z.col}`;
}

/** 例: 「パス(前) 成功」「レガーテ 失敗」「枠内L」 */
export function playText(e: PlayEvent): string {
  if (e.type === 'shot') return `${SUBTYPE_LABEL[e.subtype]}${e.foot ?? ''}`;
  const name = e.type === 'pass' ? `パス(${SUBTYPE_LABEL[effectivePassDirection(e)]})` : SUBTYPE_LABEL[e.subtype];
  return `${name} ${e.success ? '成功' : '失敗'}`;
}

export function placeText(e: PlayEvent): string {
  return e.endZone ? `${zoneText(e.startZone)} → ${zoneText(e.endZone)}` : zoneText(e.startZone);
}
