import { rate, type Count, type HalfStats, type PlayerStats } from '../domain/stats';

/** 見本の2ページ目の数字の表。[前半, 後半] */
export interface StatRow { label: string; success: [number, number]; fail: [number, number]; total: [number, number] }
export interface StatBlock { title: string; successLabel: string; failLabel: string; totalLabel: string; rows: StatRow[]; rate: [string, string] }

const pct = (c: Count) => {
  const r = rate(c);
  return r === null ? '-' : `${Math.round(r * 100)}%`;
};

type Pick = (h: HalfStats) => Count;

function block(name: string, totalLabel: string, items: [string, Pick][], total: Pick, s: PlayerStats): StatBlock {
  const row = (label: string, get: Pick): StatRow => {
    const a = get(s['1H']);
    const b = get(s['2H']);
    return { label, success: [a.success, b.success], fail: [a.fail, b.fail], total: [a.success + a.fail, b.success + b.fail] };
  };
  return {
    title: `${name}成功率`, successLabel: `${name}成功`, failLabel: `${name}失敗`, totalLabel,
    rows: [...items.map(([l, g]) => row(l, g)), row('合計', total)],
    rate: [pct(total(s['1H'])), pct(total(s['2H']))],
  };
}

// シュートは、枠内＝成功の行、枠外＝失敗の行に数を入れる
const on = (n: number): Count => ({ success: n, fail: 0 });
const off = (n: number): Count => ({ success: 0, fail: n });

export function statBlocks(s: PlayerStats): StatBlock[] {
  return [
    block('パス', '総パス数', [['前', (h) => h.pass.forward], ['横', (h) => h.pass.lateral], ['後', (h) => h.pass.backward]], (h) => h.pass.total, s),
    block('ドリブル', '総ドリブル数', [['レガテ', (h) => h.dribble.regate], ['コンドゥクシオン', (h) => h.dribble.conduccion], ['プロテクシオン', (h) => h.dribble.proteccion]], (h) => h.dribble.total, s),
    block('守備', '総守備数', [['ボール奪取', (h) => h.defense.ball_recovery], ['1vs1', (h) => h.defense.one_vs_one], ['空中戦', (h) => h.defense.aerial]], (h) => h.defense.total, s),
    block('シュート', '総シュート数', [
      ['枠内(R)', (h) => on(h.shot.onR)], ['枠内(L)', (h) => on(h.shot.onL)], ['枠外(R)', (h) => off(h.shot.offR)], ['枠外(L)', (h) => off(h.shot.offL)],
    ], (h) => h.shot.total, s),
  ];
}
