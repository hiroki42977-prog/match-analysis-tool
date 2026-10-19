import { computeStats, rate, zoneCells, type Count, type HalfStats } from '../../domain/stats';
import type { PlayEvent, PlayType, Player } from '../../domain/types';
import { pitchSvg } from '../../pitch/render';
import { sheetPitchSvg } from '../../pitch/sheet';
import { buildReports, sheetFigures } from '../../report/build';
import { pageHeading, pdfFileName, buildFiguresPdf } from '../../report/pdf';
import { eventRow, eventsToCsv } from '../../report/rows';
import * as db from '../../storage/db';
import { h, svgEl } from '../dom';
import { saveFile } from '../download';
import { go } from '../router';

const pct = (c: Count) => {
  const r = rate(c);
  return r === null ? '-' : `${Math.round(r * 100)}%`;
};
const cnt = (c: Count) => `${c.success}/${c.success + c.fail} ${pct(c)}`;

type Line = { label: string; get: (h: HalfStats) => Count | number };
const SECTIONS: { name: string; lines: Line[] }[] = [
  { name: 'パス', lines: [
    { label: '前', get: (x) => x.pass.forward }, { label: '横', get: (x) => x.pass.lateral },
    { label: '後ろ', get: (x) => x.pass.backward }, { label: 'パス 合計', get: (x) => x.pass.total }] },
  { name: 'ドリブル', lines: [
    { label: 'レガーテ', get: (x) => x.dribble.regate }, { label: 'コンドゥクシオン', get: (x) => x.dribble.conduccion },
    { label: 'プロテクション', get: (x) => x.dribble.proteccion }, { label: 'ドリブル 合計', get: (x) => x.dribble.total }] },
  { name: '守備', lines: [
    { label: 'ボール奪取', get: (x) => x.defense.ball_recovery }, { label: '1対1', get: (x) => x.defense.one_vs_one },
    { label: '空中戦', get: (x) => x.defense.aerial }, { label: '守備 合計', get: (x) => x.defense.total }] },
  { name: 'シュート', lines: [
    { label: '枠内R', get: (x) => x.shot.onR }, { label: '枠内L', get: (x) => x.shot.onL },
    { label: '枠外R', get: (x) => x.shot.offR }, { label: '枠外L', get: (x) => x.shot.offL },
    { label: 'シュート 枠内率', get: (x) => x.shot.total }] },
];

function statsTable(events: PlayEvent[]): HTMLElement {
  const s = computeStats(events);
  const show = (v: Count | number) => (typeof v === 'number' ? `${v}本` : cnt(v));
  return h('table', { id: 'player-stats', class: 'stats' },
    h('thead', {}, h('tr', {}, h('th', {}, 'プレー'), h('th', {}, '前半'), h('th', {}, '後半'), h('th', {}, '合計'))),
    h('tbody', {}, ...SECTIONS.flatMap((sec) => [
      h('tr', { class: 'sec' }, h('th', { colspan: 4 }, sec.name)),
      ...sec.lines.map((l) => h('tr', { class: l.label.includes(' ') ? 'total' : '' },
        h('th', {}, l.label), h('td', {}, show(l.get(s['1H']))), h('td', {}, show(l.get(s['2H']))), h('td', {}, show(l.get(s.all))))),
    ])),
  );
}

function teamTable(players: Player[], events: PlayEvent[]): HTMLElement {
  return h('table', { id: 'team-table', class: 'stats' },
    h('thead', {}, h('tr', {}, h('th', {}, '選手'), h('th', {}, 'パス'), h('th', {}, 'ドリブル'), h('th', {}, '守備'), h('th', {}, 'シュート（枠内）'))),
    h('tbody', {}, ...players.map((p) => {
      const s = computeStats(events.filter((e) => e.playerId === p.id)).all;
      return h('tr', {}, h('th', {}, `#${p.number} ${p.name}`),
        h('td', {}, cnt(s.pass.total)), h('td', {}, cnt(s.dribble.total)), h('td', {}, cnt(s.defense.total)), h('td', {}, cnt(s.shot.total)));
    })),
  );
}

const HEAT_TABS: { type: PlayType; label: string }[] = [{ type: 'pass', label: 'パス' }, { type: 'dribble', label: 'ドリブル' }];

export async function resultsScreen(root: HTMLElement, params: Record<string, string>) {
  const m = await db.getMatch(params.id);
  if (!m) return go('#/');
  const [allPlayers, events] = await Promise.all([db.listPlayers(m.teamId), db.listEvents(m.id)]);
  const players = allPlayers.filter((p) => events.some((e) => e.playerId === p.id));
  let current = players[0]?.id;
  let heatType: PlayType = 'pass';
  const body = h('div', { class: 'results' });
  const reportMsg = h('p', { class: 'status', 'aria-live': 'polite' });

  const csv = async () => {
    const rows = events.map((e) => eventRow(e, m, allPlayers.find((p) => p.id === e.playerId)!));
    try {
      await saveFile(eventsToCsv(rows), `${m.date}_vs_${m.opponent}.csv`, 'text/csv');
    } catch (e) {
      // 共有シートを閉じただけのときは何もしない
      if (!(e instanceof DOMException && e.name === 'AbortError')) reportMsg.textContent = `CSV を保存できませんでした：${e}`;
    }
  };

  const report = async () => {
    reportBtn.setAttribute('disabled', '');
    try {
      const r = await buildReports(m.id, (done, total, name) => {
        if (name) reportMsg.textContent = `${done + 1}/${total}人目 ${name} を作成中…`;
      });
      reportMsg.textContent = `${r.ok}人分のレポートを作りました`
        + (r.failed.length ? `。作れなかった選手：${r.failed.map((f) => `${f.name}（${f.error}）`).join('、')}` : '');
    } catch (e) {
      reportMsg.textContent = e instanceof Error ? e.message : String(e);
    } finally {
      reportBtn.removeAttribute('disabled');
    }
  };
  const reportBtn = h('button', { class: 'primary', onclick: () => void report() }, 'レポート作成');

  // 今選んでいる選手1人分の図を、1ページ1枚の PDF にする。
  // iPad では共有シートはボタンを押した直後にしか開けないので、作り終わったら「PDF を保存」を押してもらう
  const pdf = async () => {
    const p = players.find((x) => x.id === current);
    if (!p) return;
    pdfBtn.setAttribute('disabled', '');
    reportMsg.textContent = 'PDF を作成中…';
    try {
      const blob = await buildFiguresPdf(sheetFigures(events.filter((e) => e.playerId === p.id)), pageHeading(m, p));
      const name = pdfFileName(m, p);
      const save = h('button', { class: 'primary', onclick: () => {
        saveFile(blob, name, 'application/pdf').catch((e) => {
          // 共有シートを閉じただけのときは何もしない
          if (!(e instanceof DOMException && e.name === 'AbortError')) reportMsg.textContent = `PDF を保存できませんでした：${e}`;
        });
      } }, 'PDF を保存');
      reportMsg.replaceChildren(`${name} ができました　`, save);
    } catch (e) {
      reportMsg.textContent = `PDF を作れませんでした：${e instanceof Error ? e.message : e}`;
    } finally {
      pdfBtn.removeAttribute('disabled');
    }
  };
  const pdfBtn = h('button', { onclick: () => void pdf() }, 'PDF 書き出し');

  function paint() {
    if (!current) {
      body.replaceChildren(h('p', { class: 'muted' }, 'まだ記録がありません'));
      return;
    }
    const mine = events.filter((e) => e.playerId === current);
    body.replaceChildren(
      h('div', { class: 'chips' }, ...players.map((p) => h('button', { class: p.id === current ? 'on' : '', onclick: () => { current = p.id; paint(); } }, `#${p.number} ${p.name}`))),
      // 集計表を上に、図はその下に1枚ずつ横幅いっぱいで並べる
      h('section', {}, h('h2', {}, '集計'), statsTable(mine)),
      h('section', { class: 'figures' },
        // 見本の資料と同じく、前半（1st）・後半（2nd）の2枚を縦に並べる
        ...sheetFigures(mine).map((fig) => h('div', { id: `map-${fig.key}`, class: 'figure sheet' }, svgEl(sheetPitchSvg(fig.svg)))),
          h('h2', {}, '場所ごとの本数'),
          h('div', { id: 'heatmap-tabs', class: 'seg' }, ...HEAT_TABS.map((t) => h('button', { class: t.type === heatType ? 'on' : '', onclick: () => { heatType = t.type; paint(); } }, t.label))),
          h('div', { id: 'heatmap', class: 'pitch' }, svgEl(pitchSvg({
            heat: zoneCells(mine, heatType),
            legend: [[{ glyph: 'ok', label: '○ 成功' }, { glyph: 'ng', label: '× 失敗' }]],
          }))),
      ),
      h('h2', {}, 'チーム全体'),
      teamTable(players, events),
    );
  }

  root.append(
    h('div', { class: 'toolbar' },
      h('button', { onclick: () => go(`#/match/${m.id}`) }, '← 選手を選ぶ'),
      h('h1', {}, `結果　${m.date} vs ${m.opponent}`),
      h('span', { class: 'spacer' }),
      h('button', { onclick: () => current && go(`#/match/${m.id}/report/${current}`) }, 'レポート入力'),
      h('button', { onclick: () => void csv() }, 'CSV 書き出し'),
      pdfBtn,
      reportBtn),
    reportMsg,
    body,
  );
  paint();
}
