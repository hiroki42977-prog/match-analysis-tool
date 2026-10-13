import { computeStats, zoneCells } from '../domain/stats';
import type { Match, PlayEvent, Player } from '../domain/types';
import type { Arrow } from '../pitch/render';
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

export function passArrows(events: PlayEvent[]): Arrow[] {
  return events.filter((e) => e.type === 'pass' && e.endZone).map((e) => ({ from: e.startZone, to: e.endZone!, style: e.success ? 'solid' : 'dashed' }));
}

export function dribbleArrows(events: PlayEvent[]): Arrow[] {
  return events.filter((e) => e.type === 'dribble' && e.endZone).map((e) => ({ from: e.startZone, to: e.endZone!, style: 'thick' }));
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
      { label: 'パス（実線＝成功・破線＝失敗）', pngBase64: await svgToPngBase64(pitchSvg({ arrows: passArrows(mine) })) },
      { label: 'ドリブル', pngBase64: await svgToPngBase64(pitchSvg({ arrows: dribbleArrows(mine) })) },
      { label: '守備のヒートマップ', pngBase64: await svgToPngBase64(pitchSvg({ heat: zoneCells(mine, 'defense') })) },
      { label: 'シュートのヒートマップ', pngBase64: await svgToPngBase64(pitchSvg({ heat: zoneCells(mine, 'shot') })) },
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
