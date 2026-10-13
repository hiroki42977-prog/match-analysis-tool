import * as db from '../../storage/db';
import { h } from '../dom';
import { go } from '../router';

export async function playerSelectScreen(root: HTMLElement, params: Record<string, string>) {
  const m = await db.getMatch(params.id);
  if (!m) return go('#/');
  const [players, events] = await Promise.all([db.listPlayers(m.teamId), db.listEvents(m.id)]);
  const inMatch = players.filter((p) => m.playerIds.includes(p.id));
  root.append(
    h('div', { class: 'toolbar' },
      h('button', { onclick: () => go('#/') }, '← ホーム'),
      h('h1', {}, `${m.date} vs ${m.opponent} ・ ${m.format}人制`),
      h('span', { class: 'spacer' }),
      h('button', { onclick: () => go(`#/match/${m.id}/edit`) }, '試合を直す'),
      h('button', { class: 'primary', onclick: () => go(`#/match/${m.id}/results`) }, '結果を見る'),
    ),
    h('p', { class: 'muted' }, '追う選手を選んでください'),
    h('div', { class: 'player-grid' }, ...inMatch.map((p) => {
      const n = events.filter((e) => e.playerId === p.id).length;
      return h('button', { class: 'player', onclick: () => go(`#/match/${m.id}/record/${p.id}`) },
        h('span', { class: 'name' }, `#${p.number} ${p.name}`), h('span', { class: 'muted' }, ` 記録 ${n}件`));
    })),
  );
}
