import './style.css';
import * as db from './storage/db';
import { startAutoFlush } from './sync/queue';
import { route, startRouter } from './ui/router';
import { homeScreen } from './ui/screens/home';
import { matchFormScreen } from './ui/screens/matchForm';
import { eventListScreen } from './ui/screens/eventList';
import { playerSelectScreen } from './ui/screens/playerSelect';
import { recordScreen } from './ui/screens/record';
import { rosterScreen } from './ui/screens/roster';
import { settingsScreen } from './ui/screens/settings';

void (async () => {
  await db.openDb();
  route('/', homeScreen);
  route('/roster', rosterScreen);
  route('/settings', settingsScreen);
  route('/match/new', matchFormScreen);
  route('/match/:id/edit', matchFormScreen);
  route('/match/:id/record/:playerId', recordScreen);
  route('/match/:id/list/:playerId', eventListScreen);
  route('/match/:id', playerSelectScreen);
  startRouter(document.getElementById('app')!);

  // 未送信の件数が変わったら画面に知らせる
  startAutoFlush(db.getSettings, (pending) => window.dispatchEvent(new CustomEvent('pending', { detail: pending })));
})();
