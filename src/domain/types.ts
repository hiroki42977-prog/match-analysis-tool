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
export interface Match {
  id: string;
  teamId: string;
  date: string; // YYYY-MM-DD
  opponent: string;
  format: '11' | '8';
  videoUrl: string;
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
  videoTimeSec: number;
  createdAt: string; // ISO
}
export interface PlayerProgress { matchId: string; playerId: string; videoTimeSec: number; half: Half }
export interface Settings { endpoint: string; token: string }

export function newId(): string {
  return crypto.randomUUID();
}
