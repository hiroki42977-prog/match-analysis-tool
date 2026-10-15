import { effectivePassDirection } from '../domain/direction';
import { HALF_LABEL, SUBTYPE_LABEL, TYPE_LABEL } from '../domain/labels';
import type { Match, PlayEvent, Player } from '../domain/types';
import { videoOf } from '../domain/videos';
import { parseYouTubeId } from '../video/youtube';

export type RowValue = string | number | boolean;

/** 設計書 8章「記録一覧」の列（Apps Script の Code.gs にも同じものがある） */
export const LOG_HEADERS = ['記録ID', '試合日', '対戦相手', '形式', '前後半', '背番号', '名前', 'プレー', '種類', '足', '成功', '始点レーン', '始点ゾーン', '終点レーン', '終点ゾーン', '向きの手修正', '再生位置（秒）', '映像リンク', '記録日時'];

export function videoLink(url: string, sec: number): string {
  return `https://www.youtube.com/watch?v=${parseYouTubeId(url) ?? ''}&t=${Math.floor(sec)}s`;
}

export function eventRow(e: PlayEvent, m: Match, p: Player): RowValue[] {
  const kind = e.type === 'pass' ? effectivePassDirection(e) : e.subtype;
  return [
    e.id, m.date, m.opponent, m.format === '11' ? '11人制' : '8人制', HALF_LABEL[e.half], p.number, p.name,
    TYPE_LABEL[e.type], SUBTYPE_LABEL[kind], e.foot ?? '', e.success ? '成功' : '失敗',
    e.startZone.lane, e.startZone.col, e.endZone?.lane ?? '', e.endZone?.col ?? '',
    e.passDirectionOverride ? SUBTYPE_LABEL[e.passDirectionOverride] : '',
    e.videoTimeSec, videoLink(videoOf(m, e.videoId).url, e.videoTimeSec), e.createdAt,
  ];
}

function cell(v: RowValue): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function eventsToCsv(rows: RowValue[][]): string {
  return '﻿' + [LOG_HEADERS, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
