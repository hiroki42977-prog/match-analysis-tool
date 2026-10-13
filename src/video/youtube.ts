const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com']);

/** YouTube のリンクから動画IDを取り出す。読めなければ null */
export function parseYouTubeId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  let id: string | null = null;
  if (u.hostname === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (HOSTS.has(u.hostname)) {
    const m = u.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)/);
    id = m ? m[1] : u.pathname === '/watch' ? u.searchParams.get('v') : null;
  }
  return id && ID.test(id) ? id : null;
}
