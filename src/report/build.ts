import { computeStats, overallCells } from '../domain/stats';
import type { Match, PlayEvent, Player } from '../domain/types';
import type { Arrow, Mark } from '../pitch/render';
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

export const OVERALL_LABEL = '全体マップ（パ＝パス・ド＝ドリブル・守＝守備／実線＝パス・波線＝ドリブル／白＝成功・赤い破線＝失敗）';

const DRIBBLE_TAG: Record<string, string> = { regate: 'レ', conduccion: 'コ', proteccion: 'プ' };
const DEFENSE_SHAPE: Record<string, Mark['shape']> = { ball_recovery: 'circle', one_vs_one: 'triangle', aerial: 'square' };

export const DRIBBLE_LABEL = 'ドリブル（波線。レ＝レガーテ・コ＝コンドゥクシオン・プ＝プロテクション／白＝成功・赤い破線＝失敗）';
export const DEFENSE_LABEL = '守備（●＝ボール奪取・▲＝1対1・■＝空中戦／白＝成功・赤＝失敗）';
export const SHOT_LABEL = 'シュート（●＝右足 R・◆＝左足 L／白＝枠内・赤＝枠外）';

export function defenseMarks(events: PlayEvent[]): Mark[] {
  return events.filter((e) => e.type === 'defense').map((e) => ({ zone: e.startZone, shape: DEFENSE_SHAPE[e.subtype], success: e.success }));
}

export function shotMarks(events: PlayEvent[]): Mark[] {
  return events.filter((e) => e.type === 'shot').map((e) => ({ zone: e.startZone, shape: e.foot === 'L' ? 'diamond' : 'circle', success: e.subtype === 'on_target' }));
}

export function passArrows(events: PlayEvent[]): Arrow[] {
  return events.filter((e) => e.type === 'pass' && e.endZone).map((e) => ({ from: e.startZone, to: e.endZone!, kind: 'pass', success: e.success }));
}

export function dribbleArrows(events: PlayEvent[]): Arrow[] {
  return events.filter((e) => e.type === 'dribble' && e.endZone).map((e) => ({ from: e.startZone, to: e.endZone!, kind: 'dribble', success: e.success, tag: DRIBBLE_TAG[e.subtype] }));
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
    const images: ReportImage[] = [
      { label: 'パス（白い実線＝成功・赤い破線＝失敗）', pngBase64: await svgToPngBase64(pitchSvg({ arrows: passArrows(mine) })) },
      { label: DRIBBLE_LABEL, pngBase64: await svgToPngBase64(pitchSvg({ arrows: dribbleArrows(mine) })) },
      { label: DEFENSE_LABEL, pngBase64: await svgToPngBase64(pitchSvg({ marks: defenseMarks(mine) })) },
      { label: SHOT_LABEL, pngBase64: await svgToPngBase64(pitchSvg({ marks: shotMarks(mine) })) },
      { label: OVERALL_LABEL, pngBase64: await svgToPngBase64(pitchSvg({ overall: overallCells(mine), arrows: [...passArrows(mine), ...dribbleArrows(mine)] })) },
    ];
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
