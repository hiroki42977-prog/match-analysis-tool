export type Cleanup = () => void;
export type Screen = (root: HTMLElement, params: Record<string, string>) => void | Cleanup | Promise<void | Cleanup>;

const routes: { re: RegExp; keys: string[]; screen: Screen }[] = [];
let cleanup: Cleanup | null = null;
let rootEl: HTMLElement;

export function route(pattern: string, screen: Screen): void {
  const keys: string[] = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ re, keys, screen });
}

export function go(hash: string): void {
  if (location.hash === hash) void render();
  else location.hash = hash;
}

async function render() {
  cleanup?.();
  cleanup = null;
  const path = location.hash.replace(/^#/, '') || '/';
  for (const r of routes) {
    const m = path.match(r.re);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    rootEl.replaceChildren();
    window.scrollTo(0, 0);
    const c = await r.screen(rootEl, params);
    if (c) cleanup = c;
    return;
  }
  go('#/');
}

export function startRouter(root: HTMLElement): void {
  rootEl = root;
  window.addEventListener('hashchange', () => void render());
  void render();
}
