import { computeStats } from '../domain/stats';
import type { Half, Match, PlayEvent, Player } from '../domain/types';
import { sheetPitchSvg, type SheetArrow, type SheetIcon, type SheetMark, type SheetPitchOptions } from '../pitch/sheet';
import { sheetPngBase64 } from '../pitch/png';
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

const ICON: Record<string, SheetIcon> = {
  regate: 'L', proteccion: 'P', ball_recovery: 'ball', one_vs_one: '1', aerial: '空', on_target: 'shot-on', off_target: 'shot-off',
};

export interface SheetFigure { key: Half; label: '1st' | '2nd'; svg: SheetPitchOptions }

/** 見本の資料と同じく、前半（1st）・後半（2nd）の2枚に全部のプレーを入れる */
export function sheetFigures(events: PlayEvent[]): SheetFigure[] {
  return ([['1H', '1st'], ['2H', '2nd']] as const).map(([key, label]) => {
    const arrows: SheetArrow[] = [];
    const marks: SheetMark[] = [];
    for (const e of events.filter((x) => x.half === key)) {
      if (e.type === 'pass' && e.endZone) arrows.push({ from: e.startZone, to: e.endZone, kind: 'pass', success: e.success });
      else if (e.type === 'dribble' && e.subtype === 'conduccion' && e.endZone) arrows.push({ from: e.startZone, to: e.endZone, kind: 'conduccion', success: e.success });
      else if (ICON[e.subtype]) marks.push({ zone: e.startZone, icon: ICON[e.subtype], success: e.type === 'shot' ? e.subtype === 'on_target' : e.success });
    }
    return { key, label, svg: { label, arrows, marks } };
  });
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
    for (const fig of sheetFigures(mine)) {
      images.push({ label: fig.label, pngBase64: await sheetPngBase64(sheetPitchSvg(fig.svg)) });
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
