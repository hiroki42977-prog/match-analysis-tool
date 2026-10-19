import { openDB, type IDBPDatabase } from 'idb';
import { upgradeMatch, type LegacyMatch } from '../domain/videos';
import { emptyMatchReport, emptyPlayerReport, type MatchReport, type PlayerReport } from '../domain/report';
import type { Match, PlayEvent, Player, PlayerProgress, Settings, Team } from '../domain/types';

export interface QueuedOp {
  seq?: number;
  kind: 'upsertEvent' | 'deleteEvent';
  eventId: string;
  row?: (string | number | boolean)[];
  attempts: number;
  createdAt: string;
}

let dbp: Promise<IDBPDatabase> | null = null;

export interface OpenHooks {
  /** 古い版の画面（別のタブなど）が開いたままで、版を上げられずに待っているとき */
  onBlocked?: () => void;
  /** 新しい版の画面が開こうとして、この接続を閉じたとき（画面を読み込み直す） */
  onVersionChange?: () => void;
}

export async function openDb(name = 'match-analysis', hooks: OpenHooks = {}): Promise<void> {
  // 版2：PDF 用のレポートの保存場所を足した。版1のデータには手を付けない
  dbp = openDB(name, 2, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('teams', { keyPath: 'id' });
        d.createObjectStore('players', { keyPath: 'id' }).createIndex('teamId', 'teamId');
        d.createObjectStore('matches', { keyPath: 'id' });
        d.createObjectStore('events', { keyPath: 'id' }).createIndex('matchId', 'matchId');
        d.createObjectStore('progress', { keyPath: ['matchId', 'playerId'] });
        d.createObjectStore('queue', { keyPath: 'seq', autoIncrement: true });
        d.createObjectStore('settings');
      }
      if (oldVersion < 2) {
        d.createObjectStore('matchReports', { keyPath: 'matchId' });
        d.createObjectStore('playerReports', { keyPath: ['matchId', 'playerId'] });
      }
    },
    blocked() { hooks.onBlocked?.(); },
    // 新しい版を待たせないよう、自分から閉じる
    blocking() {
      void dbp?.then((d) => d.close());
      hooks.onVersionChange?.();
    },
  });
  await dbp;
}

function db(): Promise<IDBPDatabase> {
  if (!dbp) void openDb();
  return dbp!;
}

export async function saveTeam(t: Team) { await (await db()).put('teams', t); }
export async function listTeams(): Promise<Team[]> { return (await db()).getAll('teams'); }

export async function savePlayer(p: Player) { await (await db()).put('players', p); }
export async function deletePlayer(id: string) { await (await db()).delete('players', id); }
export async function listPlayers(teamId: string): Promise<Player[]> {
  const all: Player[] = await (await db()).getAllFromIndex('players', 'teamId', teamId);
  return all.sort((a, b) => a.number - b.number);
}

export async function saveMatch(m: Match) { await (await db()).put('matches', m); }
/** 古い形の試合は読んだときに今の形へ直し、保存し直す */
async function upgraded(m: LegacyMatch): Promise<Match> {
  const r = upgradeMatch(m);
  if (r.changed) await saveMatch(r.match);
  return r.match;
}
export async function getMatch(id: string): Promise<Match | undefined> {
  const m: LegacyMatch | undefined = await (await db()).get('matches', id);
  return m && upgraded(m);
}
export async function listMatches(): Promise<Match[]> {
  const all: LegacyMatch[] = await (await db()).getAll('matches');
  return (await Promise.all(all.map(upgraded))).sort((a, b) => b.date.localeCompare(a.date));
}

export async function saveEvent(e: PlayEvent) { await (await db()).put('events', e); }
export async function deleteEvent(id: string) { await (await db()).delete('events', id); }
export async function listEvents(matchId: string, playerId?: string): Promise<PlayEvent[]> {
  const all: PlayEvent[] = await (await db()).getAllFromIndex('events', 'matchId', matchId);
  return all
    .filter((e) => !playerId || e.playerId === playerId)
    .sort((a, b) => a.half.localeCompare(b.half) || a.videoTimeSec - b.videoTimeSec);
}

export async function saveProgress(p: PlayerProgress) { await (await db()).put('progress', p); }
export async function getProgress(matchId: string, playerId: string): Promise<PlayerProgress | undefined> {
  return (await db()).get('progress', [matchId, playerId]);
}

export async function addOp(op: QueuedOp) { await (await db()).add('queue', op); }
export async function listOps(): Promise<QueuedOp[]> { return (await db()).getAll('queue'); }
export async function updateOp(op: QueuedOp) { await (await db()).put('queue', op); }
export async function removeOp(seq: number) { await (await db()).delete('queue', seq); }

export async function getSettings(): Promise<Settings | undefined> { return (await db()).get('settings', 'main'); }
export async function saveSettings(s: Settings) { await (await db()).put('settings', s, 'main'); }

/** すべての試合を通した、その選手の記録の数 */
export async function countPlayerEvents(playerId: string): Promise<number> {
  const all: PlayEvent[] = await (await db()).getAll('events');
  return all.filter((e) => e.playerId === playerId).length;
}

// あとから項目が増えても欠けないよう、空のものに重ねて返す
export async function getMatchReport(matchId: string): Promise<MatchReport> {
  const r: Partial<MatchReport> | undefined = await (await db()).get('matchReports', matchId);
  const empty = emptyMatchReport(matchId);
  return { ...empty, ...r, score: { ...empty.score, ...r?.score } };
}
export async function saveMatchReport(r: MatchReport) { await (await db()).put('matchReports', r); }

export async function getPlayerReport(matchId: string, playerId: string): Promise<PlayerReport> {
  const r: Partial<PlayerReport> | undefined = await (await db()).get('playerReports', [matchId, playerId]);
  return { ...emptyPlayerReport(matchId, playerId), ...r };
}
export async function savePlayerReport(r: PlayerReport) { await (await db()).put('playerReports', r); }
