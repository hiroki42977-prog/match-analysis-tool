import { hint, INITIAL_FLOW, PLAY_BUTTONS, step, type EventDraft, type FlowAction, type FlowState } from '../domain/recordFlow';
import { pitchSvg } from '../pitch/render';
import { h, svgEl } from './dom';

/** プレーのボタン・失敗・ヒント・ピッチ。記録画面と記録一覧の「直す」で使う */
export function recordPad(opts: { getTime: () => number; onDraft: (d: EventDraft) => void }) {
  let state: FlowState = INITIAL_FLOW;
  let disabledMsg: string | null = null;
  const hintEl = h('p', { class: 'hint', 'aria-live': 'polite' });
  const pitch = h('div', { id: 'pitch', class: 'pitch' });
  const playBtns = PLAY_BUTTONS.map((b) => h('button', { class: 'play', 'data-id': b.id, onclick: () => dispatch({ kind: 'play', button: b.id, timeSec: opts.getTime() }) }, b.label));
  const failBtn = h('button', { class: 'play fail', onclick: () => dispatch({ kind: 'toggleFail' }) }, '失敗');
  const buttons = [...playBtns.slice(0, 7), failBtn, ...playBtns.slice(7)];

  function paint() {
    hintEl.textContent = disabledMsg ?? hint(state);
    for (const b of buttons) b.toggleAttribute('disabled', disabledMsg !== null);
    pitch.classList.toggle('disabled', disabledMsg !== null);
    playBtns.forEach((b) => b.classList.toggle('on', b.dataset.id === state.button));
    failBtn.classList.toggle('on', state.failed);
    pitch.replaceChildren(svgEl(pitchSvg({ highlight: state.start ? [state.start] : [] })));
  }

  function dispatch(a: FlowAction) {
    const r = step(state, a);
    state = r.state;
    paint();
    if (r.draft) opts.onDraft(r.draft);
  }

  pitch.addEventListener('click', (ev) => {
    const rect = (ev.target as Element).closest('rect[data-lane]');
    if (rect && disabledMsg === null) dispatch({ kind: 'zone', zone: { lane: Number(rect.getAttribute('data-lane')), col: Number(rect.getAttribute('data-col')) } });
  });

  paint();
  return {
    el: h('div', { class: 'pad' }, h('div', { class: 'play-grid' }, ...buttons), hintEl, pitch),
    reset: () => dispatch({ kind: 'reset' }),
    /** null で押せるようにする。文字を渡すと、その文字を出して押せなくする */
    setDisabled: (msg: string | null) => { disabledMsg = msg; paint(); },
  };
}
