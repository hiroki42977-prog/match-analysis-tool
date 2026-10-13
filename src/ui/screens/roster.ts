import { newId, type Team } from '../../domain/types';
import * as db from '../../storage/db';
import { h } from '../dom';
import { go } from '../router';

let currentTeamId: string | null = null;

export async function rosterScreen(root: HTMLElement) {
  const teams = await db.listTeams();
  if (!teams.find((t) => t.id === currentTeamId)) currentTeamId = teams[0]?.id ?? null;
  const team = teams.find((t) => t.id === currentTeamId) ?? null;
  const rerender = () => { root.replaceChildren(); void rosterScreen(root); };

  const teamName = h('input', { placeholder: 'チーム名', 'aria-label': 'チーム名' }) as HTMLInputElement;
  const addTeam = async () => {
    const name = teamName.value.trim();
    if (!name) return;
    const t: Team = { id: newId(), name };
    await db.saveTeam(t);
    currentTeamId = t.id;
    rerender();
  };

  root.append(
    h('div', { class: 'toolbar' }, h('button', { onclick: () => go('#/') }, '← ホーム'), h('h1', {}, '名簿')),
    teams.length > 1
      ? h('div', { class: 'chips' }, ...teams.map((t) =>
        h('button', { class: t.id === currentTeamId ? 'on' : '', onclick: () => { currentTeamId = t.id; rerender(); } }, t.name)))
      : '',
    h('div', { class: 'form-row' }, teamName, h('button', { onclick: addTeam }, 'チームを追加')),
  );
  if (!team) return;

  const players = await db.listPlayers(team.id);
  const num = h('input', { placeholder: '背番号', 'aria-label': '背番号', inputmode: 'numeric', class: 'num' }) as HTMLInputElement;
  const name = h('input', { placeholder: '名前', 'aria-label': '名前' }) as HTMLInputElement;
  const msg = h('p', { class: 'error' });
  const addPlayer = async () => {
    const n = Number(num.value.trim());
    if (!Number.isInteger(n) || n < 0 || !name.value.trim()) {
      msg.textContent = '背番号（数字）と名前を入れてください';
      return;
    }
    if (players.some((p) => p.number === n)) {
      msg.textContent = `背番号 ${n} はもう登録されています`;
      return;
    }
    await db.savePlayer({ id: newId(), teamId: team.id, number: n, name: name.value.trim() });
    rerender();
  };

  root.append(
    h('h2', {}, team.name),
    h('div', { class: 'form-row' }, num, name, h('button', { class: 'primary', onclick: addPlayer }, '選手を追加')),
    msg,
    h('ul', { class: 'list' }, ...players.map((p) => h('li', { class: 'row' },
      h('span', { class: 'grow' }, `#${p.number} ${p.name}`),
      h('button', {
        class: 'danger',
        'aria-label': `#${p.number} ${p.name} を消す`,
        onclick: async () => { if (confirm(`#${p.number} ${p.name} を名簿から消しますか？`)) { await db.deletePlayer(p.id); rerender(); } },
      }, '消す'),
    ))),
  );
}
