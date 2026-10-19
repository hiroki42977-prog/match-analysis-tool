import type { Half } from './types';

/** スコア。入力のまま持つので文字（空＝未入力） */
export interface Score { us: string; them: string }

/** 試合ごとに1回入れる、PDF 用の項目（同じ試合のどの選手の画面から入れても同じ値） */
export interface MatchReport {
  matchId: string;
  score: Record<Half, Score>;
  matchCondition: string;
  matchTime: string;
  venue: string;
  kickoff: string;
  weather: string;
  pitchCondition: string;
  system: string;
  opponentSystem: string;
  opponentEmblem?: string;
}

/** 選手ごとに入れる、PDF 用の項目 */
export interface PlayerReport {
  matchId: string;
  playerId: string;
  pCondition: string;
  mCondition: string;
  eval1H: string;
  eval2H: string;
  position: string;
  playTime: string;
  themeAttack: string;
  themeDefense: string;
  analyst: string;
  goals: string;
  assists: string;
  comment: string;
  nextAttack: string;
  nextDefense: string;
}

export function emptyMatchReport(matchId: string): MatchReport {
  return {
    matchId,
    score: { '1H': { us: '', them: '' }, '2H': { us: '', them: '' } },
    matchCondition: '', matchTime: '', venue: '', kickoff: '', weather: '', pitchCondition: '', system: '', opponentSystem: '',
  };
}

export function emptyPlayerReport(matchId: string, playerId: string): PlayerReport {
  return {
    matchId, playerId,
    pCondition: '', mCondition: '', eval1H: '', eval2H: '', position: '', playTime: '', themeAttack: '', themeDefense: '',
    analyst: '', goals: '', assists: '', comment: '', nextAttack: '', nextDefense: '',
  };
}

// iPad の日本語入力で打った全角数字も数える
const num = (s: string) => Number(s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).trim()) || 0;

/** 前半＋後半。何も入っていなければ空。どれか入っていれば、空は0として足す */
export function scoreTotal(r: MatchReport): Score {
  const all = [r.score['1H'].us, r.score['1H'].them, r.score['2H'].us, r.score['2H'].them];
  if (all.every((s) => !s.trim())) return { us: '', them: '' };
  return { us: String(num(r.score['1H'].us) + num(r.score['2H'].us)), them: String(num(r.score['1H'].them) + num(r.score['2H'].them)) };
}
