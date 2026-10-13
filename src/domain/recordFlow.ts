import { passDirection } from './direction';
import type { PlayEvent, Zone } from './types';

export type PlayButton = 'pass' | 'regate' | 'conduccion' | 'proteccion' | 'ball_recovery'
  | 'one_vs_one' | 'aerial' | 'onR' | 'onL' | 'offR' | 'offL';

/** 設計書 5章の並び順（「失敗」ボタンは画面側で8番目に差し込む） */
export const PLAY_BUTTONS: { id: PlayButton; label: string }[] = [
  { id: 'pass', label: 'パス' },
  { id: 'regate', label: 'レガーテ' },
  { id: 'conduccion', label: 'コンドゥクシオン' },
  { id: 'proteccion', label: 'プロテクション' },
  { id: 'ball_recovery', label: 'ボール奪取' },
  { id: 'one_vs_one', label: '1対1' },
  { id: 'aerial', label: '空中戦' },
  { id: 'onR', label: '枠内R' },
  { id: 'onL', label: '枠内L' },
  { id: 'offR', label: '枠外R' },
  { id: 'offL', label: '枠外L' },
];

export interface FlowState { button: PlayButton | null; failed: boolean; start: Zone | null; timeSec: number | null }
export const INITIAL_FLOW: FlowState = Object.freeze({ button: null, failed: false, start: null, timeSec: null }) as FlowState;

export type FlowAction =
  | { kind: 'play'; button: PlayButton; timeSec: number }
  | { kind: 'toggleFail' }
  | { kind: 'zone'; zone: Zone }
  | { kind: 'reset' };

export type EventDraft = Pick<PlayEvent, 'type' | 'subtype' | 'foot' | 'success' | 'startZone' | 'endZone' | 'videoTimeSec'>;

const SHOTS = { onR: ['on_target', 'R'], onL: ['on_target', 'L'], offR: ['off_target', 'R'], offL: ['off_target', 'L'] } as const;
const isShot = (b: PlayButton): b is keyof typeof SHOTS => b in SHOTS;

export function needsEnd(b: PlayButton): boolean {
  return b === 'pass' || b === 'regate' || b === 'conduccion' || b === 'proteccion';
}

function label(b: PlayButton): string {
  return PLAY_BUTTONS.find((x) => x.id === b)!.label;
}

function toDraft(s: FlowState, start: Zone, end: Zone | null): EventDraft {
  const b = s.button!;
  const base = { startZone: start, endZone: end, videoTimeSec: s.timeSec ?? 0 };
  if (isShot(b)) {
    const [subtype, foot] = SHOTS[b];
    return { ...base, type: 'shot', subtype, foot, success: subtype === 'on_target' };
  }
  const success = !s.failed;
  if (b === 'pass') return { ...base, type: 'pass', subtype: passDirection(start, end!), foot: null, success };
  if (needsEnd(b)) return { ...base, type: 'dribble', subtype: b as EventDraft['subtype'], foot: null, success };
  return { ...base, type: 'defense', subtype: b as EventDraft['subtype'], foot: null, success };
}

const none = (state: FlowState) => ({ state, draft: null });

export function step(s: FlowState, a: FlowAction): { state: FlowState; draft: EventDraft | null } {
  switch (a.kind) {
    case 'reset':
      return none(INITIAL_FLOW);
    case 'play':
      if (s.button === a.button) return none(INITIAL_FLOW);
      return none({ button: a.button, failed: false, start: null, timeSec: a.timeSec });
    case 'toggleFail':
      if (!s.button || isShot(s.button)) return none(s);
      return none({ ...s, failed: !s.failed });
    case 'zone':
      if (!s.button) return none(s);
      if (needsEnd(s.button) && !s.start) return none({ ...s, start: a.zone });
      if (needsEnd(s.button)) return { state: INITIAL_FLOW, draft: toDraft(s, s.start!, a.zone) };
      return { state: INITIAL_FLOW, draft: toDraft(s, a.zone, null) };
  }
}

export function hint(s: FlowState): string {
  if (!s.button) return 'プレーを選んでください';
  const name = label(s.button);
  if (isShot(s.button)) return `${name} ― 打った場所を押してください`;
  if (!needsEnd(s.button)) return `${name} ― 場所を押してください`;
  return `${name} ― ${s.start ? '終点' : '始点'}ゾーンを押してください`;
}
