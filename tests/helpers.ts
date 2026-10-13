import type { PlayEvent } from '../src/domain/types';

let seq = 0;
export function ev(over: Partial<PlayEvent> = {}): PlayEvent {
  seq++;
  return {
    id: `e${seq}`,
    matchId: 'm1',
    half: '1H',
    playerId: 'p1',
    type: 'pass',
    subtype: 'forward',
    foot: null,
    success: true,
    startZone: { lane: 3, col: 3 },
    endZone: { lane: 3, col: 4 },
    passDirectionOverride: null,
    videoTimeSec: seq,
    createdAt: '2026-10-13T00:00:00.000Z',
    ...over,
  };
}
