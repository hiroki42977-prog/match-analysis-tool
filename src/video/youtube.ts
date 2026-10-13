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

export interface VideoPlayer {
  currentTime(): number;
  seek(sec: number): void;
  play(): void;
  pause(): void;
  isPlaying(): boolean;
  setRate(r: number): void;
  destroy(): void;
}

export const RATES = [1, 1.5, 2];

/** テスト用。本物の映像なしで時間だけ進む */
export function createFakePlayer(startSec: number): VideoPlayer {
  let base = startSec;
  let since: number | null = null;
  let rate = 1;
  const now = () => (since === null ? base : base + ((performance.now() - since) / 1000) * rate);
  return {
    currentTime: now,
    seek(sec) { base = sec; if (since !== null) since = performance.now(); },
    play() { if (since === null) since = performance.now(); },
    pause() { base = now(); since = null; },
    isPlaying: () => since !== null,
    setRate(r) { base = now(); if (since !== null) since = performance.now(); rate = r; },
    destroy() {},
  };
}

declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void }
}

let apiReady: Promise<void> | null = null;
function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  apiReady ??= new Promise((resolve, reject) => {
    window.onYouTubeIframeAPIReady = () => resolve();
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    // 読み込みに失敗したら、次に開いたときにもう一度試せるよう待ちを捨てる
    s.onerror = () => {
      apiReady = null;
      s.remove();
      reject(new Error('YouTube を読み込めませんでした'));
    };
    document.head.appendChild(s);
  });
  return apiReady;
}

export async function createPlayer(el: HTMLElement, videoId: string, startSec: number): Promise<VideoPlayer> {
  if (location.search.includes('fakeVideo=1')) {
    const delay = Number(new URLSearchParams(location.search).get('fakeDelay') ?? 0);
    if (delay) await new Promise((r) => setTimeout(r, delay));
    el.textContent = 'テスト用の映像';
    return createFakePlayer(startSec);
  }
  await loadApi();
  const target = document.createElement('div');
  el.replaceChildren(target);
  const yt: any = await new Promise((resolve) => {
    const p = new window.YT.Player(target, {
      videoId,
      width: '100%',
      height: '100%',
      // playsinline が無いと iPad で全画面になる
      playerVars: { playsinline: 1, rel: 0, start: Math.floor(startSec) },
      events: { onReady: () => resolve(p) },
    });
  });
  return {
    currentTime: () => yt.getCurrentTime() ?? 0,
    seek: (sec) => yt.seekTo(Math.max(0, sec), true),
    play: () => yt.playVideo(),
    pause: () => yt.pauseVideo(),
    isPlaying: () => yt.getPlayerState() === window.YT.PlayerState.PLAYING,
    setRate: (r) => yt.setPlaybackRate(r),
    destroy: () => yt.destroy(),
  };
}
