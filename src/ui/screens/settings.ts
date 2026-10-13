import * as db from '../../storage/db';
import { postToScript } from '../../sync/client';
import { h } from '../dom';
import { go } from '../router';

export async function settingsScreen(root: HTMLElement) {
  const s = (await db.getSettings()) ?? { endpoint: '', token: '' };
  const endpoint = h('input', { value: s.endpoint, inputmode: 'url', placeholder: 'https://script.google.com/macros/s/.../exec' }) as HTMLInputElement;
  const token = h('input', { value: s.token, type: 'password', autocomplete: 'off' }) as HTMLInputElement;
  const msg = h('p', { class: 'status' });
  const current = () => ({ endpoint: endpoint.value.trim(), token: token.value.trim() });
  root.append(
    h('div', { class: 'toolbar' }, h('button', { onclick: () => go('#/') }, '← ホーム'), h('h1', {}, '設定')),
    h('div', { class: 'form' },
      h('label', {}, 'Apps Script の URL', endpoint),
      h('label', {}, '合言葉', token),
      h('div', { class: 'form-row' },
        h('button', { class: 'primary', onclick: async () => { await db.saveSettings(current()); msg.textContent = '保存しました'; } }, '保存'),
        h('button', {
          onclick: async () => {
            msg.textContent = '確認中…';
            const r = await postToScript(current(), { action: 'ping' });
            msg.textContent = r.ok ? 'つながりました' : `つながりません：${r.error}`;
          },
        }, '送信テスト'),
      ),
      msg,
    ),
  );
}
