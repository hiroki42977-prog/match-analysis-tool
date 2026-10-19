import './style.css';
import * as db from './storage/db';
import { startAutoFlush } from './sync/queue';
import { route, startRouter } from './ui/router';
import { homeScreen } from './ui/screens/home';
import { matchFormScreen } from './ui/screens/matchForm';
import { eventListScreen } from './ui/screens/eventList';
import { playerSelectScreen } from './ui/screens/playerSelect';
import { recordScreen } from './ui/screens/record';
import { reportFormScreen } from './ui/screens/reportForm';
import { resultsScreen } from './ui/screens/results';
import { rosterScreen } from './ui/screens/roster';
import { settingsScreen } from './ui/screens/settings';

/** 画面が白いままにならないよう、開けないときは理由と次の手を出す */
function notice(text: string) {
  const app = document.getElementById('app')!;
  const p = document.createElement('p');
  p.className = 'error';
  p.textContent = text;
  app.replaceChildren(p);
}

void (async () => {
  try {
    await db.openDb('match-analysis', {
      onBlocked: () => notice('前の版のアプリが別のタブで開いたままです。ほかのタブを閉じると、自動で開きます。'),
      onVersionChange: () => location.reload(),
    });
  } catch (e) {
    notice(`記録を開けませんでした。もう一度読み込んでください（${e instanceof Error ? e.message : e}）`);
    return;
  }
  route('/', homeScreen);
  route('/roster', rosterScreen);
  route('/settings', settingsScreen);
  route('/match/new', matchFormScreen);
  route('/match/:id/edit', matchFormScreen);
  route('/match/:id/record/:playerId', recordScreen);
  route('/match/:id/list/:playerId', eventListScreen);
  route('/match/:id/results', resultsScreen);
  route('/match/:id/report/:playerId', reportFormScreen);
  route('/match/:id', playerSelectScreen);
  startRouter(document.getElementById('app')!);

  // 未送信の件数が変わったら画面に知らせる
  startAutoFlush(db.getSettings, (pending) => window.dispatchEvent(new CustomEvent('pending', { detail: pending })));
})();
