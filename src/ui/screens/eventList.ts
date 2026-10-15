import { HALF_LABEL } from '../../domain/labels';
import type { EventDraft } from '../../domain/recordFlow';
import type { PlayEvent } from '../../domain/types';
import { eventRow } from '../../report/rows';
import * as db from '../../storage/db';
import { queueDelete, queueUpsert, requestFlush } from '../../sync/queue';
import { formatTime, h } from '../dom';
import { placeText, playText } from '../eventText';
import { recordPad } from '../recordPad';
import { go } from '../router';

export async function eventListScreen(root: HTMLElement, params: Record<string, string>) {
  const m = await db.getMatch(params.id);
  const p = (await db.listPlayers(m?.teamId ?? '')).find((x) => x.id === params.playerId);
  if (!m || !p) return go('#/');
  const listEl = h('ul', { id: 'events', class: 'list' });
  const editor = h('div', { class: 'editor' });

  async function paint() {
    const events = await db.listEvents(m!.id, p!.id);
    listEl.replaceChildren(...events.map((e) => h('li', { class: 'row' },
      h('button', {
        class: 'jump grow',
        onclick: async () => {
          // ほかのリンクの「どこまで見たか」は残す
          const prev = await db.getProgress(m!.id, p!.id);
          await db.saveProgress({ matchId: m!.id, playerId: p!.id, videoId: e.videoId, videoTimeSec: e.videoTimeSec, half: e.half, positions: prev?.positions }); go(`#/match/${m!.id}/record/${p!.id}`); },
      }, h('span', { class: 'time' }, `${HALF_LABEL[e.half]} ${formatTime(e.videoTimeSec)}`), ` ${playText(e)}　`, h('small', { class: 'muted' }, placeText(e))),
      h('button', { onclick: () => edit(e) }, '直す'),
      h('button', {
        class: 'danger',
        onclick: async () => {
          if (!confirm('この記録を消しますか？')) return;
          await db.deleteEvent(e.id);
          await queueDelete(e.id);
          requestFlush();
          await paint();
        },
      }, '消す'),
    )));
    if (events.length === 0) listEl.replaceChildren(h('li', { class: 'muted' }, 'まだ記録がありません'));
  }

  function edit(e: PlayEvent) {
    const pad = recordPad({
      getTime: () => e.videoTimeSec,
      onDraft: async (d: EventDraft) => {
        const next: PlayEvent = { ...e, ...d, videoTimeSec: e.videoTimeSec, passDirectionOverride: null };
        await db.saveEvent(next);
        await queueUpsert(next.id, eventRow(next, m!, p!));
        requestFlush();
        editor.replaceChildren();
        await paint();
      },
    });
    editor.replaceChildren(h('div', { class: 'panel' },
      h('div', { class: 'toolbar' },
        h('strong', {}, `${HALF_LABEL[e.half]} ${formatTime(e.videoTimeSec)} の記録を直しています（もう一度押し直してください）`),
        h('span', { class: 'spacer' }),
        h('button', { onclick: () => editor.replaceChildren() }, 'やめる')),
      pad.el));
  }

  root.append(
    h('div', { class: 'toolbar' },
      h('button', { onclick: () => go(`#/match/${m.id}/record/${p.id}`) }, '← 記録画面'),
      h('h1', {}, `#${p.number} ${p.name} の記録一覧`)),
    h('p', { class: 'muted' }, '行を押すと、映像がその場面から始まります'),
    editor,
    listEl,
  );
  await paint();
}
