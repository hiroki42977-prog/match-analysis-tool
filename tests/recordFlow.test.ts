import { expect, test } from 'vitest';
import { hint, INITIAL_FLOW, PAD_BUTTONS, PLAY_BUTTONS, step, type FlowAction, type FlowState } from '../src/domain/recordFlow';

function run(actions: FlowAction[], s: FlowState = INITIAL_FLOW) {
  let draft = null;
  for (const a of actions) {
    const r = step(s, a);
    s = r.state;
    if (r.draft) draft = r.draft;
  }
  return { state: s, draft };
}

test('play names', () => {
  expect(PLAY_BUTTONS.map((b) => b.label)).toEqual([
    'パス', 'レガーテ', 'コンドゥクシオン', 'プロテクション', 'ボール奪取', '1対1', '空中戦', '枠内R', '枠内L', '枠外R', '枠外L',
  ]);
});

test('pad has ○ and × for each play and plain shot buttons', () => {
  expect(PAD_BUTTONS.map((b) => b.label)).toEqual([
    'パス ○', 'パス ×', 'レガーテ ○', 'レガーテ ×',
    'コンドゥクシオン ○', 'コンドゥクシオン ×', 'プロテクション ○', 'プロテクション ×',
    'ボール奪取 ○', 'ボール奪取 ×', '1対1 ○', '1対1 ×',
    '空中戦 ○', '空中戦 ×', null, null,
    '枠内R', '枠内L', '枠外R', '枠外L',
  ].map((l) => l ?? ''));
  expect(PAD_BUTTONS[1]).toMatchObject({ button: 'pass', failed: true });
  expect(PAD_BUTTONS[16]).toMatchObject({ button: 'onR', failed: false });
});

test('pass ○: play → start → end', () => {
  const r = run([
    { kind: 'play', button: 'pass', failed: false, timeSec: 100 },
    { kind: 'zone', zone: { lane: 3, col: 2 } },
    { kind: 'zone', zone: { lane: 3, col: 4 } },
  ]);
  expect(r.draft).toEqual({
    type: 'pass', subtype: 'forward', success: true, startZone: { lane: 3, col: 2 }, endZone: { lane: 3, col: 4 }, foot: null, videoTimeSec: 100,
  });
  expect(r.state).toEqual(INITIAL_FLOW);
});

test('× button saves a failure with the same number of taps', () => {
  const r = run([
    { kind: 'play', button: 'regate', failed: true, timeSec: 5 },
    { kind: 'zone', zone: { lane: 1, col: 4 } },
    { kind: 'zone', zone: { lane: 1, col: 5 } },
  ]);
  expect(r.draft).toMatchObject({ type: 'dribble', subtype: 'regate', success: false });
  expect(r.state).toEqual(INITIAL_FLOW);
});

test('defense completes with one zone', () => {
  const r = run([{ kind: 'play', button: 'aerial', failed: false, timeSec: 1 }, { kind: 'zone', zone: { lane: 2, col: 2 } }]);
  expect(r.draft).toMatchObject({ type: 'defense', subtype: 'aerial', endZone: null, success: true, foot: null });
  const f = run([{ kind: 'play', button: 'aerial', failed: true, timeSec: 1 }, { kind: 'zone', zone: { lane: 2, col: 2 } }]);
  expect(f.draft).toMatchObject({ success: false });
});

test('shot: button decides success and foot', () => {
  const r = run([{ kind: 'play', button: 'offL', failed: false, timeSec: 9 }, { kind: 'zone', zone: { lane: 3, col: 6 } }]);
  expect(r.draft).toEqual({
    type: 'shot', subtype: 'off_target', foot: 'L', success: false, startZone: { lane: 3, col: 6 }, endZone: null, videoTimeSec: 9,
  });
  const on = run([{ kind: 'play', button: 'onR', failed: false, timeSec: 9 }, { kind: 'zone', zone: { lane: 3, col: 6 } }]);
  expect(on.draft).toMatchObject({ subtype: 'on_target', foot: 'R', success: true });
});

test('same button again cancels; ○ ↔ × switches', () => {
  expect(run([
    { kind: 'play', button: 'pass', failed: true, timeSec: 1 },
    { kind: 'play', button: 'pass', failed: true, timeSec: 2 },
  ]).state).toEqual(INITIAL_FLOW);
  const sw = run([
    { kind: 'play', button: 'pass', failed: false, timeSec: 1 },
    { kind: 'zone', zone: { lane: 1, col: 1 } },
    { kind: 'play', button: 'pass', failed: true, timeSec: 2 },
  ]);
  expect(sw.state).toEqual({ button: 'pass', failed: true, start: null, timeSec: 2 });
});

test('ignores zone tap after completion', () => {
  const done = run([{ kind: 'play', button: 'aerial', failed: false, timeSec: 1 }, { kind: 'zone', zone: { lane: 2, col: 2 } }]);
  const again = step(done.state, { kind: 'zone', zone: { lane: 2, col: 2 } });
  expect(again.draft).toBeNull();
  expect(again.state).toEqual(INITIAL_FLOW);
});

test('zone ignored without button', () => {
  expect(step(INITIAL_FLOW, { kind: 'zone', zone: { lane: 1, col: 1 } })).toEqual({ state: INITIAL_FLOW, draft: null });
});

test('hint texts', () => {
  expect(hint(INITIAL_FLOW)).toBe('プレーを選んでください');
  const p = run([{ kind: 'play', button: 'pass', failed: false, timeSec: 1 }]).state;
  expect(hint(p)).toBe('パス ○ ― 始点ゾーンを押してください');
  expect(hint(step(p, { kind: 'zone', zone: { lane: 1, col: 1 } }).state)).toBe('パス ○ ― 終点ゾーンを押してください');
  expect(hint(run([{ kind: 'play', button: 'ball_recovery', failed: true, timeSec: 1 }]).state)).toBe('ボール奪取 × ― 場所を押してください');
  expect(hint(run([{ kind: 'play', button: 'onR', failed: false, timeSec: 1 }]).state)).toBe('枠内R ― 打った場所を押してください');
});
