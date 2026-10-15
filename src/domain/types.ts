export type Half = '1H' | '2H';
/** lane 1..5（1=左サイド）, col 1..6（1=自陣ゴール側） */
export interface Zone { lane: number; col: number }
export type PlayType = 'pass' | 'dribble' | 'defense' | 'shot';
export type PassSub = 'forward' | 'lateral' | 'backward';
export type DribbleSub = 'regate' | 'conduccion' | 'proteccion';
export type DefenseSub = 'ball_recovery' | 'one_vs_one' | 'aerial';
export type ShotSub = 'on_target' | 'off_target';
export type Foot = 'R' | 'L';

export interface Team { id: string; name: string }
export interface Player { id: string; teamId: string; number: number; name: string }
/** 試合の映像。1試合が複数のリンクに分かれて届くことがあるため、リンクごとに前半・後半を持つ */
export interface MatchVideo { id: string; url: string; half: Half }
export interface Match {
  id: string;
  teamId: string;
  date: string; // YYYY-MM-DD
  opponent: string;
  format: '11' | '8';
  videos: MatchVideo[];
  playerIds: string[];
}
export interface PlayEvent {
  id: string;
  matchId: string;
  half: Half;
  playerId: string;
  type: PlayType;
  subtype: PassSub | DribbleSub | DefenseSub | ShotSub;
  foot: Foot | null;
  success: boolean;
  startZone: Zone;
  endZone: Zone | null;
  passDirectionOverride: PassSub | null;
  /** 記録したリンク。無いとき（前からの記録）は1本目 */
  videoId?: string;
  videoTimeSec: number;
  createdAt: string; // ISO
}
export interface PlayerProgress {
  matchId: string;
  playerId: string;
  videoId?: string;
  videoTimeSec: number;
  half: Half;
  /** リンクごとの、どこまで見たか（秒）。切り替えて戻ったときに続きから始めるため */
  positions?: Record<string, number>;
}
export interface Settings { endpoint: string; token: string }

export function newId(): string {
  return crypto.randomUUID();
}
