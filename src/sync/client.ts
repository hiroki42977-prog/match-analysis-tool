import type { Settings } from '../domain/types';

export type ScriptResult = { ok: true; data?: unknown } | { ok: false; error: string };

/** Apps Script へ送る。text/plain にして CORS の事前確認を避ける */
export async function postToScript(s: Settings, body: object): Promise<ScriptResult> {
  try {
    const res = await fetch(s.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, token: s.token }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = await res.json();
    return json.ok ? { ok: true, data: json.data } : { ok: false, error: String(json.error ?? '不明なエラー') };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
