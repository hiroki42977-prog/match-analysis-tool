import * as db from '../../storage/db';
import { h } from '../dom';
import { go } from '../router';

export async function homeScreen(root: HTMLElement) {
  const [teams, matches] = await Promise.all([db.listTeams(), db.listMatches()]);
  const nav = h('div', { class: 'toolbar' },
    h('h1', {}, '試合分析'),
    h('span', { class: 'spacer' }),
    h('button', { onclick: () => go('#/roster') }, '名簿'),
    h('button', { onclick: () => go('#/settings') }, '設定'),
  );
  if (teams.length === 0) {
    root.append(nav, h('div', { class: 'empty' },
      h('p', {}, 'まず名簿を登録してください'),
      h('button', { class: 'primary', onclick: () => go('#/roster') }, '名簿を登録する'),
    ));
    return;
  }
  root.append(
    nav,
    h('button', { class: 'primary big', onclick: () => go('#/match/new') }, '＋ 新しい試合'),
    matches.length === 0
      ? h('p', { class: 'muted' }, 'まだ試合がありません')
      : h('ul', { class: 'list' }, ...matches.map((m) =>
        h('li', {}, h('button', { class: 'row', onclick: () => go(`#/match/${m.id}`) },
          h('span', { class: 'date' }, m.date),
          h('span', { class: 'grow' }, `vs ${m.opponent}`),
          h('span', { class: 'muted' }, m.format === '11' ? '11人制' : '8人制'),
        )))),
  );
}
