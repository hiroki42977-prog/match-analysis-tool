import type { Half, PlayType } from './types';

export const SUBTYPE_LABEL: Record<string, string> = {
  forward: '前',
  lateral: '横',
  backward: '後ろ',
  regate: 'レガーテ',
  conduccion: 'コンドゥクシオン',
  proteccion: 'プロテクション',
  ball_recovery: 'ボール奪取',
  one_vs_one: '1対1',
  aerial: '空中戦',
  on_target: '枠内',
  off_target: '枠外',
};

export const TYPE_LABEL: Record<PlayType, string> = {
  pass: 'パス',
  dribble: 'ドリブル',
  defense: '守備',
  shot: 'シュート',
};

export const HALF_LABEL: Record<Half, string> = { '1H': '前半', '2H': '後半' };
