import type { Half } from '../../domain/types';
import type { MatchReport, PlayerReport } from '../../domain/report';
import { scoreTotal } from '../../domain/report';
import * as db from '../../storage/db';
import { h } from '../dom';
import { shrinkImage } from '../image';
import { go } from '../router';

type MatchKey = Exclude<keyof MatchReport, 'matchId' | 'score' | 'opponentEmblem'>;
type PlayerKey = Exclude<keyof PlayerReport, 'matchId' | 'playerId'>;

const MATCH_FIELDS: [MatchKey, string][] = [
  ['matchCondition', '試合条件'], ['matchTime', '試合時間'], ['venue', '試合会場'], ['kickoff', 'キックオフ時間'],
  ['weather', '天候'], ['pitchCondition', 'ピッチコンディション'], ['system', 'システム'], ['opponentSystem', '相手システム'],
];
const PLAYER_FIELDS: [PlayerKey, string][] = [
  ['pCondition', 'Pコンディション'], ['mCondition', 'Mコンディション'], ['eval1H', '評価（前半）'], ['eval2H', '評価（後半）'],
  ['position', '出場ポジション'], ['playTime', '出場時間'], ['themeAttack', '個人テーマ（攻撃）'], ['themeDefense', '個人テーマ（守備）'],
  ['analyst', '分析者'], ['goals', '得点'], ['assists', 'アシスト'],
];

/** PDF に出す項目を入れる画面。文字を打つたびに iPad の中に保存する（保存ボタンは置かない） */
export async function reportFormScreen(root: HTMLElement, params: Record<string, string>) {
  const m = await db.getMatch(params.id);
  if (!m) return go('#/');
  let player = (await db.listPlayers(m.teamId)).find((p) => p.id === params.playerId);
  if (!player) return go(`#/match/${m.id}/results`);
  let team = (await db.listTeams()).find((t) => t.id === m.teamId);
  const mr = await db.getMatchReport(m.id);
  const pr = await db.getPlayerReport(m.id, player.id);
  const saveMr = () => void db.saveMatchReport(mr);
  const savePr = () => void db.savePlayerReport(pr);

  const text = (label: string, value: string, set: (v: string) => void) =>
    h('label', { class: 'field' }, label, h('input', { 'aria-label': label, value, oninput: (e: Event) => set((e.target as HTMLInputElement).value) }));

  const total = h('span', { id: 'score-total' });
  const paintTotal = () => {
    const t = scoreTotal(mr);
    total.textContent = t.us || t.them ? `${t.us}-${t.them}` : '';
  };
  paintTotal();
  const scoreRow = (half: Half, name: string) => h('div', { class: 'score-row' }, h('span', { class: 'score-half' }, name),
    ...(['us', 'them'] as const).map((side) => h('input', {
      class: 'num', inputmode: 'numeric', 'aria-label': `スコア ${name} ${side === 'us' ? '自チーム' : '相手'}`, value: mr.score[half][side],
      oninput: (e: Event) => { mr.score[half][side] = (e.target as HTMLInputElement).value; paintTotal(); saveMr(); },
    })));

  /** 画像の欄。選ぶと縮めて保存し、小さく表示する */
  const imageField = (label: string, get: () => string | undefined, set: (v: string | undefined) => Promise<void>) => {
    const box = h('div', { class: 'image-field' });
    const msg = h('p', { class: 'error' });
    const paint = () => {
      const src = get();
      box.replaceChildren(...(src
        ? [h('img', { src, alt: label }), h('button', { type: 'button', class: 'danger', 'aria-label': `${label}を消す`, onclick: async () => { await set(undefined); paint(); } }, '消す')]
        : [h('span', { class: 'muted' }, 'なし')]));
    };
    paint();
    const input = h('input', { type: 'file', accept: 'image/*', 'aria-label': label, onchange: async (e: Event) => {
      const el = e.target as HTMLInputElement;
      const file = el.files?.[0];
      if (!file) return;
      msg.textContent = '';
      try {
        await set(await shrinkImage(file));
        paint();
      } catch (err) {
        msg.textContent = err instanceof Error ? err.message : String(err);
      } finally {
        el.value = '';
      }
    } });
    return h('div', { class: 'field' }, label, box, input, msg);
  };

  const comment = h('textarea', { 'aria-label': 'コメント', rows: 6, oninput: (e: Event) => { pr.comment = (e.target as HTMLTextAreaElement).value; savePr(); } }) as HTMLTextAreaElement;
  comment.value = pr.comment;

  root.append(
    h('div', { class: 'toolbar' },
      h('button', { onclick: () => go(`#/match/${m.id}/results`) }, '← 結果に戻る'),
      h('h1', {}, `レポート入力 #${player.number} ${player.name}`)),
    h('p', { class: 'muted' }, '入れた内容は PDF に出ます。打つたびに保存されます。'),
    h('h2', {}, '試合の情報（この試合の全員で共通）'),
    h('div', { class: 'field' }, 'スコア（自チーム－相手）', scoreRow('1H', '前半'), scoreRow('2H', '後半'), h('div', { class: 'score-row' }, h('span', { class: 'score-half' }, '合計'), total)),
    h('div', { class: 'report-grid' }, ...MATCH_FIELDS.map(([k, label]) => text(label, mr[k], (v) => { mr[k] = v; saveMr(); }))),
    imageField('相手のエンブレム', () => mr.opponentEmblem, async (v) => { mr.opponentEmblem = v; await db.saveMatchReport(mr); }),
    h('h2', {}, '選手の情報'),
    h('div', { class: 'report-grid' }, ...PLAYER_FIELDS.map(([k, label]) => text(label, pr[k], (v) => { pr[k] = v; savePr(); }))),
    h('label', { class: 'field' }, 'コメント', comment),
    h('div', { class: 'report-grid' },
      text('次節の課題（攻撃）', pr.nextAttack, (v) => { pr.nextAttack = v; savePr(); }),
      text('次節の課題（守備）', pr.nextDefense, (v) => { pr.nextDefense = v; savePr(); })),
    h('h2', {}, '画像（次の試合でも使います）'),
    h('div', { class: 'report-grid' },
      imageField('顔写真', () => player?.photo, async (v) => { player = { ...player!, photo: v }; await db.savePlayer(player); }),
      team ? imageField('自チームのエンブレム', () => team?.emblem, async (v) => { team = { ...team!, emblem: v }; await db.saveTeam(team); }) : null),
  );
}
