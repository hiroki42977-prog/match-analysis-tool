import { HALF_LABEL } from './labels';
import { newId, type Match, type MatchVideo } from './types';

/** 複数リンクに対応する前の形の試合（リンクは videoUrl の1本だけ） */
export type LegacyMatch = Omit<Match, 'videos'> & { videos?: MatchVideo[]; videoUrl?: string };

/** 古い形の試合は、リンク1本を「前半」として引き継ぐ。changed が true なら保存し直す */
export function upgradeMatch(m: LegacyMatch): { match: Match; changed: boolean } {
  const { videoUrl, ...rest } = m;
  if (m.videos?.length) return { match: { ...rest, videos: m.videos }, changed: videoUrl !== undefined };
  return { match: { ...rest, videos: [{ id: newId(), url: videoUrl ?? '', half: '1H' }] }, changed: true };
}

/** 記録・進み具合のリンク。リンクを持たない古い記録や、消されたリンクのときは1本目 */
export function videoOf(m: Match, videoId?: string): MatchVideo {
  return m.videos.find((v) => v.id === videoId) ?? m.videos[0];
}

const NUM = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

/** 例：「①前半」 */
export function videoLabel(m: Match, v: MatchVideo): string {
  const i = m.videos.indexOf(v);
  return `${NUM[i] ?? `(${i + 1})`}${HALF_LABEL[v.half]}`;
}

/** そのリンクで扱われる記録の数（リンクを持たない記録や、消されたリンクの記録は1本目に数える） */
export function countOnVideo(m: Match, events: { videoId?: string }[], videoId: string): number {
  return events.filter((e) => videoOf(m, e.videoId).id === videoId).length;
}
