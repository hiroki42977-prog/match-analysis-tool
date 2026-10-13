import { expect, test } from 'vitest';
import { hint, INITIAL_FLOW, PLAY_BUTTONS, step, type FlowAction, type FlowState } from '../src/domain/recordFlow';

function run(actions: FlowAction[], s: FlowState = INITIAL_FLOW) {
  let draft = null;
  for (const a of actions) {
    const r = step(s, a);
    s = r.state;
    if (r.draft) draft = r.draft;
  }
  return { state: s, draft };
}

test('button order has 11 play buttons', () => {
  expect(PLAY_BUTTONS.map((b) => b.label)).toEqual([
    'パス', 'レガーテ', 'コンドゥクシオン', 'プロテクション', 'ボール奪取', '1対1', '空中戦', '枠内R', '枠内L', '枠外R', '枠外L',
  ]);
});

test('pass: play → start → end', () => {
  const r = run([
    { kind: 'play', button: 'pass', timeSec: 100 },
    { kind: 'zone', zone: { lane: 3, col: 2 } },
    { kind: 'zone', zone: { lane: 3, col: 4 } },
  ]);
  expect(r.draft).toEqual({
    type: 'pass', subtype: 'forward', success: true, startZone: { lane: 3, col: 2 }, endZone: { lane: 3, col: 4 }, foot: null, videoTimeSec: 100,
  });
  expect(r.state).toEqual(INITIAL_FLOW);
});

test('fail toggle applies and resets after save', () => {
  const r = run([
    { kind: 'play', button: 'regate', timeSec: 5 },
    { kind: 'toggleFail' },
    { kind: 'zone', zone: { lane: 1, col: 4 } },
    { kind: 'zone', zone: { lane: 1, col: 5 } },
  ]);
  expect(r.draft).toMatchObject({ type: 'dribble', subtype: 'regate', success: false });
  expect(r.state.failed).toBe(false);
});

test('toggleFail twice returns to success', () => {
  const r = run([{ kind: 'play', button: 'aerial', timeSec: 1 }, { kind: 'toggleFail' }, { kind: 'toggleFail' }]);
  expect(r.state.failed).toBe(false);
});

test('defense completes with one zone', () => {
  const r = run([{ kind: 'play', button: 'aerial', timeSec: 1 }, { kind: 'zone', zone: { lane: 2, col: 2 } }]);
  expect(r.draft).toMatchObject({ type: 'defense', subtype: 'aerial', endZone: null, success: true, foot: null });
});

test('shot: button decides success and foot; toggleFail ignored', () => {
  const r = run([{ kind: 'play', button: 'offL', timeSec: 9 }, { kind: 'toggleFail' }, { kind: 'zone', zone: { lane: 3, col: 6 } }]);
  expect(r.draft).toEqual({
    type: 'shot', subtype: 'off_target', foot: 'L', success: false, startZone: { lane: 3, col: 6 }, endZone: null, videoTimeSec: 9,
  });
  const on = run([{ kind: 'play', button: 'onR', timeSec: 9 }, { kind: 'zone', zone: { lane: 3, col: 6 } }]);
  expect(on.draft).toMatchObject({ subtype: 'on_target', foot: 'R', success: true });
});

test('same button again cancels; other button switches', () => {
  expect(run([{ kind: 'play', button: 'pass', timeSec: 1 }, { kind: 'play', button: 'pass', timeSec: 2 }]).state).toEqual(INITIAL_FLOW);
  const r = run([
    { kind: 'play', button: 'pass', timeSec: 1 },
    { kind: 'toggleFail' },
    { kind: 'zone', zone: { lane: 1, col: 1 } },
    { kind: 'play', button: 'regate', timeSec: 2 },
  ]);
  expect(r.state).toEqual({ button: 'regate', failed: false, start: null, timeSec: 2 });
});

test('ignores zone tap after completion', () => {
  const done = run([{ kind: 'play', button: 'aerial', timeSec: 1 }, { kind: 'zone', zone: { lane: 2, col: 2 } }]);
  const again = step(done.state, { kind: 'zone', zone: { lane: 2, col: 2 } });
  expect(again.draft).toBeNull();
  expect(again.state).toEqual(INITIAL_FLOW);
});

test('toggleFail and zone ignored without button', () => {
  expect(step(INITIAL_FLOW, { kind: 'toggleFail' })).toEqual({ state: INITIAL_FLOW, draft: null });
  expect(step(INITIAL_FLOW, { kind: 'zone', zone: { lane: 1, col: 1 } })).toEqual({ state: INITIAL_FLOW, draft: null });
});

test('hint texts', () => {
  expect(hint(INITIAL_FLOW)).toBe('プレーを選んでください');
  const p = run([{ kind: 'play', button: 'pass', timeSec: 1 }]).state;
  expect(hint(p)).toBe('パス ― 始点ゾーンを押してください');
  expect(hint(step(p, { kind: 'zone', zone: { lane: 1, col: 1 } }).state)).toBe('パス ― 終点ゾーンを押してください');
  expect(hint(run([{ kind: 'play', button: 'ball_recovery', timeSec: 1 }]).state)).toBe('ボール奪取 ― 場所を押してください');
  expect(hint(run([{ kind: 'play', button: 'onR', timeSec: 1 }]).state)).toBe('枠内R ― 打った場所を押してください');
});
