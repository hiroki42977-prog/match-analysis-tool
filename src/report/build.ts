import { computeStats, rate } from '../domain/stats';
import type { Match, PlayEvent, PlayType, Player } from '../domain/types';
import type { Arrow, DribbleMove, LegendItem, Mark, PitchOptions } from '../pitch/render';
import { pitchSvg } from '../pitch/render';
import { svgToPngBase64 } from '../pitch/png';
import * as db from '../storage/db';
import { postToScript } from '../sync/client';
import { buildStatsSheet, type StatsSheet } from './layout';

export interface ReportImage { label: string; pngBase64: string }
export interface ReportPayload {
  action: 'buildReport';
  playerFileName: string;
  statsTabName: string;
  mapTabName: string;
  stats: StatsSheet;
  images: ReportImage[];
}

export function reportNames(m: Match, p: Player, teamName: string): Pick<ReportPayload, 'playerFileName' | 'statsTabName' | 'mapTabName'> {
  const [, mm, dd] = m.date.split('-').map(Number);
  const base = `${mm}/${dd} vs ${m.opponent}`;
  return { playerFileName: `#${p.number} ${p.name}（${teamName}）`, statsTabName: `${base} スタッツ`, mapTabName: `${base} マップ` };
}

const DEFENSE_SHAPE: Record<string, Mark['shape']> = { ball_recovery: 'circle', one_vs_one: 'triangle', aerial: 'square' };

export function defenseMarks(events: PlayEvent[], color?: 'yellow'): Mark[] {
  return events.filter((e) => e.type === 'defense')
    .map((e) => ({ zone: e.startZone, shape: DEFENSE_SHAPE[e.subtype], success: e.success, ...(color ? { color } : {}) }));
}

export function shotMarks(events: PlayEvent[]): Mark[] {
  return events.filter((e) => e.type === 'shot').map((e) => ({ zone: e.startZone, shape: e.foot === 'L' ? 'diamond' : 'circle', success: e.subtype === 'on_target' }));
}

export function passArrows(events: PlayEvent[]): Arrow[] {
  return events.filter((e) => e.type === 'pass' && e.endZone).map((e) => ({ from: e.startZone, to: e.endZone!, kind: 'pass', success: e.success }));
}

export function dribbleArrows(events: PlayEvent[]): Arrow[] {
  return events.filter((e) => e.type === 'dribble' && e.endZone)
    .map((e) => ({ from: e.startZone, to: e.endZone!, kind: 'dribble', success: e.success, move: e.subtype as DribbleMove }));
}

type SummaryKind = 'pass' | 'dribble' | 'defense' | 'shot' | 'overall';
type FigureKey = 'overall-1H' | 'overall-2H' | 'pass' | 'dribble-1H' | 'dribble-2H' | 'defense' | 'shot';
const NAME: Record<Exclude<SummaryKind, 'overall'>, string> = { pass: 'パス', dribble: 'ドリブル', defense: '守備', shot: 'シュート' };

function countOf(events: PlayEvent[], type: PlayType) {
  const list = events.filter((e) => e.type === type);
  const r = rate({ success: list.filter((e) => e.success).length, fail: list.filter((e) => !e.success).length });
  return { n: list.length, pct: r === null ? '' : `${Math.round(r * 100)}%` };
}

/** 図の上に出す一言まとめ（例: 「パス 12本・成功 75%」） */
export function summary(kind: SummaryKind, events: PlayEvent[]): string {
  if (kind === 'overall') {
    return (['pass', 'dribble', 'defense'] as const).map((t) => {
      const c = countOf(events, t);
      return c.n ? `${NAME[t]} ${c.n}本 ${c.pct}` : `${NAME[t]} 0本`;
    }).join('・');
  }
  const c = countOf(events, kind);
  if (!c.n) return `${NAME[kind]} 0本`;
  return `${NAME[kind]} ${c.n}本・${kind === 'shot' ? '枠内' : '成功'} ${c.pct}`;
}

const OK_NG: LegendItem[] = [{ glyph: 'ok', label: '成功' }, { glyph: 'ng', label: '失敗' }];
const DRIBBLE_ITEMS: LegendItem[] = [{ glyph: 'zigzag', label: 'レガーテ' }, { glyph: 'wave', label: 'コンドゥクシオン' }, { glyph: 'coil', label: 'プロテクション' }];

export interface MapFigure { key: FigureKey; title: string; summary: string; svg: PitchOptions }

const OVERALL_LEGEND: LegendItem[][] = [
  [{ glyph: 'pass-ok', label: 'パス' }, ...DRIBBLE_ITEMS],
  [{ glyph: 'circle', label: '奪取', color: 'yellow' }, { glyph: 'triangle', label: '1対1', color: 'yellow' }, { glyph: 'square', label: '空中戦', color: 'yellow' }, ...OK_NG],
];

/**
 * レポートと結果画面で使う図。線が混み合う全体マップとドリブルは前半・後半に分ける。
 * 凡例は図の中に絵で入る
 */
export function mapFigures(events: PlayEvent[]): MapFigure[] {
  const halves = [['1H', '前半'], ['2H', '後半']] as const;
  const overall = halves.map(([h, label]): MapFigure => {
    const ev = events.filter((e) => e.half === h);
    return { key: `overall-${h}`, title: `全体マップ（${label}）`, summary: summary('overall', ev), svg: {
      arrows: [...passArrows(ev), ...dribbleArrows(ev)], marks: defenseMarks(ev, 'yellow'), legend: OVERALL_LEGEND,
    } };
  });
  const dribble = halves.map(([h, label]): MapFigure => {
    const ev = events.filter((e) => e.half === h);
    return { key: `dribble-${h}`, title: `ドリブル（${label}）`, summary: summary('dribble', ev), svg: {
      arrows: dribbleArrows(ev), legend: [DRIBBLE_ITEMS, OK_NG],
    } };
  });
  return [
    ...overall,
    { key: 'pass', title: 'パス', summary: summary('pass', events), svg: {
      arrows: passArrows(events), legend: [[{ glyph: 'pass-ok', label: '成功' }, { glyph: 'pass-ng', label: '失敗' }]],
    } },
    ...dribble,
    { key: 'defense', title: '守備', summary: summary('defense', events), svg: {
      marks: defenseMarks(events), legend: [[{ glyph: 'circle', label: 'ボール奪取' }, { glyph: 'triangle', label: '1対1' }, { glyph: 'square', label: '空中戦' }, ...OK_NG]],
    } },
    { key: 'shot', title: 'シュート', summary: summary('shot', events), svg: {
      marks: shotMarks(events), legend: [[{ glyph: 'circle', label: '右足 R' }, { glyph: 'diamond', label: '左足 L' }, { glyph: 'ok', label: '枠内' }, { glyph: 'ng', label: '枠外' }]],
    } },
  ];
}

/** その試合で記録がある選手全員分のレポートを、1人ずつ Apps Script に送る */
export async function buildReports(
  matchId: string,
  onProgress: (done: number, total: number, name: string) => void,
): Promise<{ ok: number; failed: { name: string; error: string }[] }> {
  const settings = await db.getSettings();
  if (!settings?.endpoint) throw new Error('送信先が未設定です。設定画面で Apps Script の URL と合言葉を入れてください');
  const m = (await db.getMatch(matchId))!;
  const team = (await db.listTeams()).find((t) => t.id === m.teamId);
  const players = await db.listPlayers(m.teamId);
  const events = await db.listEvents(matchId);
  const targets = players.filter((p) => events.some((e) => e.playerId === p.id));

  let ok = 0;
  const failed: { name: string; error: string }[] = [];
  for (const [i, p] of targets.entries()) {
    const name = `#${p.number} ${p.name}`;
    onProgress(i, targets.length, name);
    const mine = events.filter((e) => e.playerId === p.id);
    const title = `${name} ｜ ${m.date} vs ${m.opponent} ｜ ${m.format}人制`;
    const images: ReportImage[] = [];
    for (const fig of mapFigures(mine)) {
      images.push({ label: `${fig.title}　${fig.summary}`, pngBase64: await svgToPngBase64(pitchSvg(fig.svg)) });
    }
    const payload: ReportPayload = {
      action: 'buildReport',
      ...reportNames(m, p, team?.name ?? ''),
      stats: buildStatsSheet(title, computeStats(mine)),
      images,
    };
    const r = await postToScript(settings, payload);
    if (r.ok) ok++;
    else failed.push({ name, error: r.error });
  }
  onProgress(targets.length, targets.length, '');
  return { ok, failed };
}
