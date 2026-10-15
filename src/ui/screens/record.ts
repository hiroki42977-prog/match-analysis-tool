import { passDirection } from '../../domain/direction';
import type { EventDraft } from '../../domain/recordFlow';
import { newId, type Half, type PassSub, type PlayEvent } from '../../domain/types';
import { videoOf } from '../../domain/videos';
import { eventRow } from '../../report/rows';
import * as db from '../../storage/db';
import { pendingCount, queueDelete, queueUpsert, requestFlush } from '../../sync/queue';
import { createPlayer, parseYouTubeId, RATES, type VideoPlayer } from '../../video/youtube';
import { formatTime, h } from '../dom';
import { placeText, playText } from '../eventText';
import { recordPad } from '../recordPad';
import { go, type Cleanup } from '../router';

export async function recordScreen(root: HTMLElement, params: Record<string, string>): Promise<Cleanup | void> {
  const m = await db.getMatch(params.id);
  const p = (await db.listPlayers(m?.teamId ?? '')).find((x) => x.id === params.playerId);
  if (!m || !p) return go('#/');
  const progress = await db.getProgress(m.id, p.id);
  let half: Half = progress?.half ?? '1H';
  let events = await db.listEvents(m.id, p.id);

  const videoBox = h('div', { id: 'video', class: 'video' });
  const recentList = h('ul', { id: 'recent', class: 'recent' });
  const status = h('p', { class: 'status' });
  const countEl = h('span', { class: 'muted' });
  let player: VideoPlayer | null = null;
  const time = () => player?.currentTime() ?? 0;

  const saveProgress = () => db.saveProgress({ matchId: m.id, playerId: p.id, videoTimeSec: time(), half });

  async function persist(e: PlayEvent) {
    await db.saveEvent(e);
    await queueUpsert(e.id, eventRow(e, m!, p!));
    requestFlush();
    events = await db.listEvents(m!.id, p!.id);
    paintRecent();
  }

  // 取消の直後は、描き直しで同じ位置に出た次の「取消」を2度押しで消さないよう、少しの間押せなくする
  let removeLockedUntil = 0;
  async function remove(e: PlayEvent) {
    if (Date.now() < removeLockedUntil) return;
    removeLockedUntil = Date.now() + 800;
    await db.deleteEvent(e.id);
    await queueDelete(e.id);
    requestFlush();
    events = await db.listEvents(m!.id, p!.id);
    paintRecent();
  }

  function paintRecent() {
    countEl.textContent = `この選手の記録 ${events.length}件`;
    const latest = [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
    recentList.replaceChildren(...latest.map((e, i) => h('li', {},
      h('span', { class: 'time' }, formatTime(e.videoTimeSec)),
      h('span', { class: 'grow' }, `${playText(e)}　`, h('small', { class: 'muted' }, placeText(e))),
      i === 0 && e.type === 'pass'
        ? h('span', { class: 'dir' }, ...(['forward', 'lateral', 'backward'] as PassSub[]).map((d) => h('button', {
          class: (e.passDirectionOverride ?? e.subtype) === d ? 'on' : '',
          onclick: () => {
            const auto = passDirection(e.startZone, e.endZone!);
            void persist({ ...e, passDirectionOverride: d === auto ? null : d });
          },
        }, { forward: '前', lateral: '横', backward: '後ろ' }[d])))
        : '',
      i === 0 ? h('button', { class: 'danger small', onclick: () => void remove(e) }, '取消') : '',
    )));
  }

  async function paintStatus(n?: number) {
    const s = await db.getSettings();
    const pending = n ?? (await pendingCount());
    status.textContent = !s?.endpoint ? '送信先が未設定（設定画面で入力）' : pending > 0 ? `未送信 ${pending}件` : '送信済み';
  }
  const onPending = (ev: Event) => void paintStatus((ev as CustomEvent<number>).detail);
  window.addEventListener('pending', onPending);

  const pad = recordPad({
    getTime: time,
    onDraft: (d: EventDraft) => void persist({ ...d, id: newId(), matchId: m.id, playerId: p.id, half, passDirectionOverride: null, createdAt: new Date().toISOString() }),
  });

  const playBtn = h('button', { onclick: () => { if (!player) return; if (player.isPlaying()) player.pause(); else player.play(); paintPlay(); } }, '▶');
  const paintPlay = () => { playBtn.textContent = player?.isPlaying() ? '❚❚' : '▶'; };
  let rateIdx = 0;
  const rateBtn = h('button', { onclick: () => { rateIdx = (rateIdx + 1) % RATES.length; player?.setRate(RATES[rateIdx]); rateBtn.textContent = `${RATES[rateIdx]}倍`; } }, '1倍');
  const halfBtns = (['1H', '2H'] as Half[]).map((x) => h('button', {
    class: x === half ? 'on' : '',
    onclick: () => { half = x; halfBtns.forEach((b, i) => b.classList.toggle('on', ['1H', '2H'][i] === x)); void saveProgress(); },
  }, x === '1H' ? '前半' : '後半'));

  root.append(h('div', { class: 'rec' },
    h('div', { class: 'rec-left' },
      videoBox,
      h('div', { class: 'controls' },
        h('button', { onclick: () => player?.seek(time() - 10) }, '◀ 10秒'), playBtn, rateBtn, ...halfBtns),
      h('p', { class: 'label' }, '直前の記録'),
      recentList,
      status,
      h('div', { class: 'controls' },
        h('button', { onclick: () => go(`#/match/${m.id}/list/${p.id}`) }, '記録一覧'),
        h('button', { onclick: () => go(`#/match/${m.id}/results`) }, '結果を見る')),
    ),
    h('div', { class: 'rec-right' },
      h('div', { class: 'who' }, h('strong', { class: 'num' }, `#${p.number}`), h('strong', {}, p.name), h('span', { class: 'spacer' }), countEl,
        h('button', { onclick: () => go(`#/match/${m.id}`) }, '選手を変える')),
      pad.el,
    ),
  ));
  paintRecent();
  void paintStatus();

  // 映像の準備ができるまでは押せなくする（準備前に押すと再生位置が 0:00 で保存されるため）
  pad.setDisabled('映像の準備中…');
  try {
    player = await createPlayer(videoBox, parseYouTubeId(videoOf(m).url) ?? '', progress?.videoTimeSec ?? 0);
    pad.setDisabled(null);
  } catch {
    videoBox.textContent = '映像を読み込めませんでした';
    pad.setDisabled('映像を読み込めませんでした。電波を確かめて、この画面を開き直してください');
  }
  const playTimer = setInterval(paintPlay, 1000);
  const progressTimer = setInterval(() => void saveProgress(), 5000);

  return () => {
    void saveProgress();
    clearInterval(playTimer);
    clearInterval(progressTimer);
    window.removeEventListener('pending', onPending);
    player?.destroy();
  };
}
