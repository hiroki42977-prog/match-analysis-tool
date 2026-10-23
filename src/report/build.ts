import { computeStats, radarValues, type PlayerStats } from '../domain/stats';
import type { Half, Match, PlayEvent, Player } from '../domain/types';
import { LEGEND_SIZE, sheetLegendSvg, sheetPitchSvg, type SheetArrow, type SheetIcon, type SheetMark, type SheetPitchOptions } from '../pitch/sheet';
import { positionFieldSvg, mapPageSvg } from '../pitch/field';
import { svgPngBase64 } from '../pitch/png';
import { radarSvg } from './radar';
import { buildSheetLayout, type SheetPngs } from './sheetLayout';
import * as db from '../storage/db';
import { postToScript } from '../sync/client';

/** シートのファイル名（選手ごと）とタブ名（試合ごと） */
export function sheetNames(m: Match, p: Player, teamName: string): { playerFileName: string; tabName: string } {
  const [, mm, dd] = m.date.split('-').map(Number);
  return { playerFileName: `#${p.number} ${p.name}（${teamName}）`, tabName: `${mm}/${dd} vs ${m.opponent}` };
}

/** 古い受け取り係（Apps Script）は buildSheet を知らないので、貼り替えが必要だと伝える。
 *  時間切れのときは返事が JSON でなく画面（HTML）になり、読めないエラーになるので言い換える */
export function sheetError(error: string): string {
  if (error.includes('知らない操作です')) return '受け取り係（Apps Script）の貼り替えが必要です。設置手順.md の「受け取り係を新しくする」を見てください';
  if (/JSON|did not match the expected pattern|Unexpected token/.test(error)) {
    return '受け取り係の処理に時間がかかりすぎました。少し待ってから、もう一度「レポート作成」を押してください';
  }
  return error;
}

export interface SheetSvg { svg: string; w: number; h: number; scale: number }

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

/** シートに貼る7枚の図（SVG と PNG にする大きさ）。純粋な関数 */
export function sheetSvgs(events: PlayEvent[], stats: PlayerStats): Record<keyof SheetPngs, SheetSvg> {
  const [f1, f2] = sheetFigures(events);
  const radar = (k: '1H' | '2H' | 'all', title: '前半' | '後半' | '全体', color: string): SheetSvg =>
    ({ svg: radarSvg(radarValues(stats[k]), title, color), w: k === 'all' ? 210 : 220, h: k === 'all' ? 168 : 176, scale: 2 });
  const map = (f: SheetFigure): SheetSvg =>
    ({ svg: mapPageSvg(f.label, sheetPitchSvg(f.svg, 'green'), f.label === '1st'), w: 720, h: f.label === '1st' ? 380 : 330, scale: 1.5 });
  return {
    radar1H: radar('1H', '前半', '#5bc0eb'),
    radar2H: radar('2H', '後半', '#2ecc71'),
    radarAll: radar('all', '全体', '#f39c12'),
    map1st: map(f1),
    map2nd: map(f2),
    legend: { svg: sheetLegendSvg('green'), w: Math.round((18 * LEGEND_SIZE.w) / LEGEND_SIZE.h), h: 18, scale: 2 },
    field: { svg: positionFieldSvg(), w: 396, h: 269, scale: 2 },
  };
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
    const svgs = sheetSvgs(mine, computeStats(mine));
    const png = {} as SheetPngs;
    for (const key of Object.keys(svgs) as (keyof SheetPngs)[]) {
      const v = svgs[key];
      png[key] = await svgPngBase64(v.svg, v.w, v.h, v.scale);
    }
    const payload = { action: 'buildSheet', ...sheetNames(m, p, team?.name ?? ''), layout: buildSheetLayout(computeStats(mine), png) };
    const r = await postToScript(settings, payload);
    if (r.ok) ok++;
    else failed.push({ name, error: sheetError(r.error) });
  }
  onProgress(targets.length, targets.length, '');
  return { ok, failed };
}
