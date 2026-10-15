import { HALF_LABEL } from '../../domain/labels';
import { newId, type Half, type Match, type MatchVideo } from '../../domain/types';
import * as db from '../../storage/db';
import { countOnVideo } from '../../domain/videos';
import { parseYouTubeId } from '../../video/youtube';
import { h, today } from '../dom';
import { go } from '../router';

export async function matchFormScreen(root: HTMLElement, params: Record<string, string>) {
  const teams = await db.listTeams();
  if (teams.length === 0) return go('#/roster');
  const existing = params.id ? await db.getMatch(params.id) : undefined;
  const m: Match = existing ?? { id: newId(), teamId: teams[0].id, date: today(), opponent: '', format: '11', videos: [{ id: newId(), url: '', half: '1H' }], playerIds: [] };
  const isNew = !existing;

  const date = h('input', { type: 'date', value: m.date }) as HTMLInputElement;
  const opponent = h('input', { value: m.opponent }) as HTMLInputElement;
  const recorded = existing ? await db.listEvents(m.id) : [];
  // 1試合が複数のリンクに分かれて届くことがあるため、リンクを何本でも足せて、1本ずつ前半・後半を選ぶ
  let videos: MatchVideo[] = m.videos.map((v) => ({ ...v }));
  const videosBox = h('div', { class: 'videos' });
  const paintVideos = () => {
    videosBox.replaceChildren(...videos.map((v, i) => {
      const halfBtns = (['1H', '2H'] as Half[]).map((x) => h('button', {
        type: 'button',
        class: x === v.half ? 'on' : '',
        onclick: () => { v.half = x; paintVideos(); },
      }, HALF_LABEL[x]));
      return h('div', { class: 'video-row' },
        h('input', {
          value: v.url, inputmode: 'url', placeholder: 'https://youtu.be/...', 'aria-label': `YouTube のリンク ${'①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'[i] ?? i + 1}`,
          oninput: (ev: Event) => { v.url = (ev.target as HTMLInputElement).value; },
        }),
        h('div', { class: 'seg' }, ...halfBtns),
        videos.length > 1 ? h('button', {
          type: 'button',
          class: 'danger',
          onclick: () => {
            const n = countOnVideo({ ...m, videos }, recorded, v.id);
            if (n > 0 && !confirm(`このリンクで記録した${n}件は、一番上のリンクの映像として扱われ、場面がずれます。消しますか？`)) return;
            videos = videos.filter((x) => x !== v);
            paintVideos();
          },
        }, '消す') : null);
    }));
  };
  paintVideos();
  const addVideoBtn = h('button', {
    type: 'button',
    onclick: () => { videos.push({ id: newId(), url: '', half: videos[videos.length - 1]?.half ?? '1H' }); paintVideos(); },
  }, '＋ リンクを足す');
  const msg = h('p', { class: 'error' });
  let format = m.format;
  const formatBtns = (['11', '8'] as const).map((f) => h('button', {
    type: 'button',
    class: f === format ? 'on' : '',
    onclick: () => { format = f; formatBtns.forEach((b, i) => b.classList.toggle('on', ['11', '8'][i] === f)); },
  }, `${f}人制`));

  const teamSel = h('select', {}, ...teams.map((t) => h('option', { value: t.id, selected: t.id === m.teamId }, t.name))) as HTMLSelectElement;
  const playersBox = h('div', { class: 'checks' });
  const loadPlayers = async () => {
    const ps = await db.listPlayers(teamSel.value);
    playersBox.replaceChildren(...ps.map((p) => h('label', { class: 'check' },
      h('input', { type: 'checkbox', value: p.id, checked: isNew || teamSel.value !== m.teamId || m.playerIds.includes(p.id) }),
      `#${p.number} ${p.name}`)));
  };
  teamSel.addEventListener('change', () => void loadPlayers());
  await loadPlayers();

  const save = async () => {
    if (!opponent.value.trim()) { msg.textContent = '対戦相手を入れてください'; return; }
    if (videos.some((v) => !parseYouTubeId(v.url))) { msg.textContent = 'YouTube のリンクを貼ってください'; return; }
    const playerIds = [...playersBox.querySelectorAll<HTMLInputElement>('input:checked')].map((i) => i.value);
    if (playerIds.length === 0) { msg.textContent = '出場選手を1人以上選んでください'; return; }
    await db.saveMatch({ ...m, teamId: teamSel.value, date: date.value || today(), opponent: opponent.value.trim(), format, videos: videos.map((v) => ({ ...v, url: v.url.trim() })), playerIds });
    go(`#/match/${m.id}`);
  };

  root.append(
    h('div', { class: 'toolbar' }, h('button', { onclick: () => go(isNew ? '#/' : `#/match/${m.id}`) }, '← 戻る'), h('h1', {}, isNew ? '新しい試合' : '試合を直す')),
    h('div', { class: 'form' },
      teams.length > 1 ? h('label', {}, 'チーム', teamSel) : null,
      h('label', {}, '日付', date),
      h('label', {}, '対戦相手', opponent),
      h('div', { class: 'field' }, h('span', {}, '形式'), h('div', { class: 'seg' }, ...formatBtns)),
      h('div', { class: 'field' }, h('span', {}, 'YouTube のリンク'), videosBox, addVideoBtn),
      h('div', { class: 'field' }, h('span', {}, '出場選手'), playersBox),
      msg,
      h('button', { class: 'primary big', onclick: save }, '保存'),
    ),
  );
}
