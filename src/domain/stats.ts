import { effectivePassDirection } from './direction';
import type { DefenseSub, DribbleSub, Half, PassSub, PlayEvent, PlayType } from './types';

export interface Count { success: number; fail: number }

/** 要件 5.2: 成功率。分母0は null（0% にしない） */
export function rate(c: Count): number | null {
  const n = c.success + c.fail;
  return n === 0 ? null : c.success / n;
}

export interface HalfStats {
  pass: Record<PassSub | 'total', Count>;
  dribble: Record<DribbleSub | 'total', Count>;
  defense: Record<DefenseSub | 'total', Count>;
  /** total.success = 枠内, total.fail = 枠外 */
  shot: { onR: number; onL: number; offR: number; offL: number; total: Count };
}
export type PlayerStats = Record<Half | 'all', HalfStats>;

const zero = (): Count => ({ success: 0, fail: 0 });

function emptyHalf(): HalfStats {
  return {
    pass: { forward: zero(), lateral: zero(), backward: zero(), total: zero() },
    dribble: { regate: zero(), conduccion: zero(), proteccion: zero(), total: zero() },
    defense: { ball_recovery: zero(), one_vs_one: zero(), aerial: zero(), total: zero() },
    shot: { onR: 0, onL: 0, offR: 0, offL: 0, total: zero() },
  };
}

function add(c: Count, success: boolean) {
  if (success) c.success++;
  else c.fail++;
}

function addEvent(h: HalfStats, e: PlayEvent) {
  switch (e.type) {
    case 'pass':
      add(h.pass[effectivePassDirection(e)], e.success);
      add(h.pass.total, e.success);
      break;
    case 'dribble':
      add(h.dribble[e.subtype as DribbleSub], e.success);
      add(h.dribble.total, e.success);
      break;
    case 'defense':
      add(h.defense[e.subtype as DefenseSub], e.success);
      add(h.defense.total, e.success);
      break;
    case 'shot': {
      const on = e.subtype === 'on_target';
      const key = `${on ? 'on' : 'off'}${e.foot === 'L' ? 'L' : 'R'}` as 'onR' | 'onL' | 'offR' | 'offL';
      h.shot[key]++;
      add(h.shot.total, on);
      break;
    }
  }
}

export function computeStats(events: PlayEvent[]): PlayerStats {
  const s: PlayerStats = { '1H': emptyHalf(), '2H': emptyHalf(), all: emptyHalf() };
  for (const e of events) {
    addEvent(s[e.half], e);
    addEvent(s.all, e);
  }
  return s;
}

/** レーダーチャートの4軸（0〜100、分母0は null） */
export interface RadarValues { pass: number | null; dribble: number | null; shot: number | null; defense: number | null }

const pct = (c: Count) => {
  const r = rate(c);
  return r === null ? null : r * 100;
};

export function radarValues(h: HalfStats): RadarValues {
  return { pass: pct(h.pass.total), dribble: pct(h.dribble.total), shot: pct(h.shot.total), defense: pct(h.defense.total) };
}

export interface ZoneCell { lane: number; col: number; count: number; success: number; rate: number | null }

/** 始点ゾーンごとの本数と成功率。lane→col の順で常に30件 */
export function zoneCells(events: PlayEvent[], type: PlayType): ZoneCell[] {
  const cells: ZoneCell[] = [];
  for (let lane = 1; lane <= 5; lane++) {
    for (let col = 1; col <= 6; col++) cells.push({ lane, col, count: 0, success: 0, rate: null });
  }
  for (const e of events) {
    if (e.type !== type) continue;
    const c = cells[(e.startZone.lane - 1) * 6 + (e.startZone.col - 1)];
    c.count++;
    if (e.success) c.success++;
  }
  for (const c of cells) c.rate = rate({ success: c.success, fail: c.count - c.success });
  return cells;
}

export interface OverallCell {
  lane: number;
  col: number;
  pass: number;
  dribble: number;
  defense: number;
  count: number;
  success: number;
  rate: number | null;
}

/** 全体マップ用。パス・ドリブル・守備を始点ゾーンごとに数える（シュートは入れない） */
export function overallCells(events: PlayEvent[]): OverallCell[] {
  const cells: OverallCell[] = [];
  for (let lane = 1; lane <= 5; lane++) {
    for (let col = 1; col <= 6; col++) cells.push({ lane, col, pass: 0, dribble: 0, defense: 0, count: 0, success: 0, rate: null });
  }
  for (const e of events) {
    if (e.type === 'shot') continue;
    const c = cells[(e.startZone.lane - 1) * 6 + (e.startZone.col - 1)];
    c[e.type]++;
    c.count++;
    if (e.success) c.success++;
  }
  for (const c of cells) c.rate = rate({ success: c.success, fail: c.count - c.success });
  return cells;
}
