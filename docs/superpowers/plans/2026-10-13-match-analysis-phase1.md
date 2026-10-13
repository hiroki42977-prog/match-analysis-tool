# 試合分析ツール フェーズ1 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iPad で YouTube 映像を見ながら1人の選手のプレーを最大4タップで記録し、集計・ヒートマップ・矢印マップを表示し、Google スプレッドシートへ記録一覧の転記と選手別レポートの作成を行う Web アプリを作る。

**Architecture:** フレームワークなしの Vite + TypeScript の静的 Web アプリ。判定・集計・記録の流れ・レポートの表レイアウトは画面から独立した純粋関数にしてテストする。データは IndexedDB に置き、送信は SyncQueue 経由で Google Apps Script（Web アプリ）へ `fetch` する。Apps Script はシートへの書き込みとグラフ・画像の貼り付けだけを行い、数字はすべてアプリ側で計算して渡す。

**Tech Stack:** Vite 6、TypeScript 5（strict）、`idb`（IndexedDB の薄いラッパー）、Vitest + `fake-indexeddb`、Playwright（WebKit）、YouTube IFrame Player API、Google Apps Script、GitHub Pages（GitHub Actions）。

**Spec:** `docs/設計書.md`（要件定義書 `match-analysis-tool-requirements.md` の「5. 判定ルール」「6. データモデル」も正とする）

## Global Constraints

- 画面の文言はすべて日本語。プレー名の表記: パス／レガーテ／コンドゥクシオン／プロテクション／ボール奪取／1対1／空中戦／枠内R／枠内L／枠外R／枠外L。スプレッドシートの守備の行名だけは「1vs1」。
- iPad 横向き（基準 1180×820）が前提。ボタンは最低 44×44px。
- 成功率 = 成功 / (成功 + 失敗)。分母0は空欄（`null`）。0% にしない。
- ゾーン: `{ lane: 1〜5, col: 1〜6 }`。lane 1 = 左サイド（画面の上）、lane 5 = 右サイド（画面の下）、col 1 = 自陣ゴール側（画面の左）、col 6 = 相手ゴール側（画面の右）。レーンは5等分、列は6等分。
- パスの向き: `diff = endCol - startCol`、正→`forward`、0→`lateral`、負→`backward`。`passDirectionOverride` があれば優先。
- Apps Script の URL と合言葉はコードにもリポジトリにも書かない（設定画面で IndexedDB に保存）。
- 依存パッケージは `idb` のみ（開発用を除く）。
- コミットメッセージは日本語で「なぜ変えたか」を書き、末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` を付ける。
- GitHub への push とリポジトリ作成は、実行前にひろきさんに内容を見せて確認を取る。

## Review Focus

1. **最後のゾーンの2度押し**（指が2回触れた）→ 記録は1件だけ。Task 3 のテスト `ignores zone tap after completion` と Task 10 の E2E で固定する。
2. **記録の途中でアプリを閉じた**（プレーを選んで始点だけ押した状態）→ 書きかけは捨て、保存済みの記録と再生位置は残り、続きから開ける。Task 10 の E2E `reload keeps events and resumes position`。
3. **電波が切れて、あとで戻った**→ 未送信の記録が古い順に1回ずつ届き、重複しない。Task 5 のテスト `flush stops at first failure and keeps order` と Task 10 の E2E `offline then online`。
4. **送信前に記録を直した・消した**→ 送る内容がまとまる（変更は最新だけ、削除は追加を打ち消す）。Task 5 のテスト `collapses pending ops`。
5. **いろいろな形の YouTube リンク**（`youtu.be/…`、`watch?v=…&t=…`、`/shorts/…`、`/live/…`、無関係の URL）→ 正しく ID を取り出し、だめなら試合登録画面で「YouTube のリンクを貼ってください」と出す。Task 8 のテスト `parseYouTubeId`。

---

## ファイル構成

```
index.html                     画面の入れ物、PWA 用の meta
public/manifest.webmanifest    ホーム画面に追加したときの名前・アイコン
public/icon-192.png, icon-512.png, apple-touch-icon.png
src/main.ts                    起動、ルーター登録
src/style.css                  色・余白のトークンと共通スタイル
src/domain/types.ts            データの型
src/domain/labels.ts           プレー名など表示用の文言
src/domain/direction.ts        パスの向きの判定
src/domain/stats.ts            集計・成功率・ゾーン別集計・レーダー値
src/domain/recordFlow.ts       記録の押す順番（状態機械）
src/storage/db.ts              IndexedDB の読み書き
src/sync/client.ts             Apps Script への送信
src/sync/queue.ts              SyncQueue（まとめ・送り直し）
src/report/rows.ts             記録一覧の列と行、CSV
src/report/layout.ts           スタッツのタブの表レイアウト
src/report/build.ts            レポート作成（全選手分を送る）
src/pitch/geometry.ts          ゾーンと座標の変換
src/pitch/render.ts            ピッチ図・ヒートマップ・矢印の SVG
src/pitch/png.ts               SVG → PNG(base64)
src/video/youtube.ts           URL の解析、プレーヤー（本物とテスト用）
src/ui/dom.ts                  要素を作る小さな関数
src/ui/router.ts               ハッシュ（#/…）で画面を切り替える
src/ui/screens/home.ts, roster.ts, matchForm.ts, playerSelect.ts,
               record.ts, eventList.ts, results.ts, settings.ts
apps-script/Code.gs            受け取り係
apps-script/設置手順.md          ひろきさん向けの設置手順
tests/*.test.ts                Vitest
e2e/*.spec.ts                  Playwright（WebKit・iPad 横向き）
.github/workflows/deploy.yml   GitHub Pages への公開
```

---

### Task 1: プロジェクトの土台と型、パスの向きの判定

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/domain/types.ts`, `src/domain/labels.ts`, `src/domain/direction.ts`
- Test: `tests/direction.test.ts`

**Interfaces:**
- Produces（`src/domain/types.ts`）:
  ```ts
  export type Half = '1H' | '2H';
  export interface Zone { lane: number; col: number } // lane 1..5, col 1..6
  export type PlayType = 'pass' | 'dribble' | 'defense' | 'shot';
  export type PassSub = 'forward' | 'lateral' | 'backward';
  export type DribbleSub = 'regate' | 'conduccion' | 'proteccion';
  export type DefenseSub = 'ball_recovery' | 'one_vs_one' | 'aerial';
  export type ShotSub = 'on_target' | 'off_target';
  export type Foot = 'R' | 'L';
  export interface Team { id: string; name: string }
  export interface Player { id: string; teamId: string; number: number; name: string }
  export interface Match { id: string; teamId: string; date: string /* YYYY-MM-DD */; opponent: string;
    format: '11' | '8'; videoUrl: string; playerIds: string[] }
  export interface PlayEvent { id: string; matchId: string; half: Half; playerId: string; type: PlayType;
    subtype: PassSub | DribbleSub | DefenseSub | ShotSub; foot: Foot | null; success: boolean;
    startZone: Zone; endZone: Zone | null; passDirectionOverride: PassSub | null;
    videoTimeSec: number; createdAt: string /* ISO */ }
  export interface PlayerProgress { matchId: string; playerId: string; videoTimeSec: number; half: Half }
  export interface Settings { endpoint: string; token: string }
  ```
- Produces（`src/domain/direction.ts`）: `passDirection(start: Zone, end: Zone): PassSub`、`effectivePassDirection(e: PlayEvent): PassSub`（`passDirectionOverride ?? subtype`）
- Produces（`src/domain/labels.ts`）: `SUBTYPE_LABEL: Record<string, string>`（例 `forward: '前'`, `regate: 'レガーテ'`, `one_vs_one: '1対1'`, `on_target: '枠内'`）、`HALF_LABEL: Record<Half, string>`（`'1H': '前半'`）
- 共通: `newId(): string` を `src/domain/types.ts` に置く（`crypto.randomUUID()`）。

- [ ] **Step 1: 土台を作る**
  `npm create vite@6` 相当を手で作る: `package.json` の scripts は `dev`=`vite`、`build`=`tsc --noEmit && vite build`、`test`=`vitest run`、`e2e`=`playwright test`。依存: `idb`。開発用: `vite@6`, `typescript@5`, `vitest`, `fake-indexeddb`, `@playwright/test`。`vite.config.ts` は `base: './'`、`test.environment: 'node'`。`tsconfig.json` は `strict: true`。`.gitignore` は作成済み。

- [ ] **Step 2: 失敗するテストを書く** `tests/direction.test.ts`
  ```ts
  test('forward/lateral/backward by column diff', () => {
    expect(passDirection({lane:3,col:2},{lane:3,col:4})).toBe('forward');
    expect(passDirection({lane:1,col:3},{lane:5,col:3})).toBe('lateral'); // 同じ列でレーン違い
    expect(passDirection({lane:2,col:5},{lane:2,col:1})).toBe('backward');
  });
  test('override wins', () => {
    expect(effectivePassDirection(ev({subtype:'forward', passDirectionOverride:'lateral'}))).toBe('lateral');
    expect(effectivePassDirection(ev({subtype:'forward', passDirectionOverride:null}))).toBe('forward');
  });
  ```
  （`ev()` はテスト内の小さな工場関数。他のテストでも `tests/helpers.ts` に置いて使い回す）

- [ ] **Step 3:** `npm test` → FAIL（関数がない）
- [ ] **Step 4:** `types.ts`, `labels.ts`, `direction.ts` を実装
- [ ] **Step 5:** `npm test` → PASS、`npm run build` → エラーなし
- [ ] **Step 6: コミット** 「判定ルールを1か所で確かめられるよう、土台とパスの向きの判定を作った」

---

### Task 2: 集計（成功率・表・ゾーン別・レーダー）

**Files:**
- Create: `src/domain/stats.ts`
- Test: `tests/stats.test.ts`

**Interfaces:**
- Consumes: Task 1 の型、`effectivePassDirection`
- Produces:
  ```ts
  export interface Count { success: number; fail: number }
  export function rate(c: Count): number | null;           // 0..1、分母0は null
  export interface HalfStats {
    pass: Record<PassSub | 'total', Count>;
    dribble: Record<DribbleSub | 'total', Count>;
    defense: Record<DefenseSub | 'total', Count>;
    shot: { onR: number; onL: number; offR: number; offL: number; total: Count }; // total.success=枠内, fail=枠外
  }
  export type PlayerStats = Record<Half | 'all', HalfStats>;
  export function computeStats(events: PlayEvent[]): PlayerStats;
  export interface RadarValues { pass: number | null; dribble: number | null; shot: number | null; defense: number | null } // 0..100
  export function radarValues(h: HalfStats): RadarValues;
  export interface ZoneCell { lane: number; col: number; count: number; success: number; rate: number | null }
  export function zoneCells(events: PlayEvent[], type: PlayType): ZoneCell[]; // 常に30件、lane→col の順
  ```

- [ ] **Step 1: 失敗するテストを書く**
  - `rate({success:0,fail:0})` は `null`、`rate({success:3,fail:1})` は `0.75`
  - パス3本（前・成功、前・失敗、手修正で横・成功）→ `all.pass.forward = {1,1}`, `lateral = {1,0}`, `total = {2,1}`
  - 前半の記録だけ → `'2H'` の全 `Count` が 0、`radarValues(stats['2H'])` は全部 `null`
  - シュート `on_target/R`, `on_target/L`, `off_target/R` → `onR=1, onL=1, offR=1, offL=0, total={2,1}`、`radarValues().shot` は `66.66…`（`toBeCloseTo(66.67,1)`）
  - `zoneCells` は 30 件。ドリブル2件（始点 lane2/col3、成功と失敗）→ そのセルが `count 2, success 1, rate 0.5`、他は `count 0, rate null`。ゾーン別は**始点**で数える
- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3:** `stats.ts` を実装（`rate` 以外で割り算をしない）
- [ ] **Step 4:** `npm test` → PASS
- [ ] **Step 5: コミット** 「画面・CSV・スプレッドシートが同じ数字を出すよう、集計を1か所にまとめた」

---

### Task 3: 記録の押す順番（状態機械）

**Files:**
- Create: `src/domain/recordFlow.ts`
- Test: `tests/recordFlow.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type PlayButton = 'pass' | 'regate' | 'conduccion' | 'proteccion' | 'ball_recovery'
    | 'one_vs_one' | 'aerial' | 'onR' | 'onL' | 'offR' | 'offL';
  export const PLAY_BUTTONS: { id: PlayButton; label: string }[]; // 設計書 5章の並び順（4列×3段、8番目は「失敗」なので含めない）
  export interface FlowState { button: PlayButton | null; failed: boolean; start: Zone | null; timeSec: number | null }
  export const INITIAL_FLOW: FlowState;
  export type FlowAction = { kind: 'play'; button: PlayButton; timeSec: number }
    | { kind: 'toggleFail' } | { kind: 'zone'; zone: Zone } | { kind: 'reset' };
  export type EventDraft = Pick<PlayEvent, 'type' | 'subtype' | 'foot' | 'success' | 'startZone' | 'endZone' | 'videoTimeSec'>;
  export function step(s: FlowState, a: FlowAction): { state: FlowState; draft: EventDraft | null };
  export function hint(s: FlowState): string;
  export function needsEnd(b: PlayButton): boolean; // pass, regate, conduccion, proteccion
  ```

- [ ] **Step 1: 失敗するテストを書く**
  - パス: play(pass,t=100) → zone(3,2) → zone(3,4) で draft `{type:'pass', subtype:'forward', success:true, startZone:{3,2}, endZone:{3,4}, foot:null, videoTimeSec:100}`、state は `INITIAL_FLOW`
  - 失敗: play(regate) → toggleFail → zone → zone で `success:false`、保存後 `failed` は false に戻る
  - 守備: play(aerial) → zone で完成、`endZone:null`
  - シュート: play(offL) → zone で `{type:'shot', subtype:'off_target', foot:'L', success:false}`。シュート中の `toggleFail` は無視
  - 同じボタンをもう一度 → `INITIAL_FLOW`。別のボタン → そのボタンに切り替わり、`start` と `failed` は消え、`timeSec` は新しい値
  - `ignores zone tap after completion`: 完成直後の `zone` は draft を返さず state も変わらない
  - ボタン未選択での `toggleFail`/`zone` は無視
  - `hint`: 未選択「プレーを選んでください」、pass で始点待ち「パス ― 始点ゾーンを押してください」、終点待ち「パス ― 終点ゾーンを押してください」、守備「ボール奪取 ― 場所を押してください」、シュート「枠内R ― 打った場所を押してください」
- [ ] **Step 2:** `npm test` → FAIL
- [ ] **Step 3:** `recordFlow.ts` を実装（パスの `subtype` は `passDirection` で入れる）
- [ ] **Step 4:** `npm test` → PASS
- [ ] **Step 5: コミット** 「タップの順番を画面から切り離してテストできるよう、記録の流れを状態機械にした」

---

### Task 4: IndexedDB の保存

**Files:**
- Create: `src/storage/db.ts`
- Test: `tests/db.test.ts`（先頭で `import 'fake-indexeddb/auto'`）

**Interfaces:**
- Consumes: Task 1 の型
- Produces（すべて `Promise` を返す。DB 名 `match-analysis`、版 1、ストア: `teams`, `players`(index `teamId`), `matches`, `events`(index `matchId`), `progress`(key `[matchId, playerId]`), `queue`(autoIncrement の `seq`), `settings`(key 固定 `'main'`)）:
  ```ts
  export function openDb(name?: string): Promise<void>; // テストでは毎回別名
  export function saveTeam(t: Team); listTeams(): Promise<Team[]>;
  export function savePlayer(p: Player); deletePlayer(id: string); listPlayers(teamId: string): Promise<Player[]>; // 背番号順
  export function saveMatch(m: Match); getMatch(id: string): Promise<Match | undefined>; listMatches(): Promise<Match[]>; // 日付の新しい順
  export function saveEvent(e: PlayEvent); deleteEvent(id: string);
  export function listEvents(matchId: string, playerId?: string): Promise<PlayEvent[]>; // videoTimeSec 順（前半→後半）
  export function saveProgress(p: PlayerProgress); getProgress(matchId: string, playerId: string): Promise<PlayerProgress | undefined>;
  export interface QueuedOp { seq?: number; kind: 'upsertEvent' | 'deleteEvent'; eventId: string; row?: (string | number | boolean)[]; attempts: number; createdAt: string }
  export function addOp(op: QueuedOp); listOps(): Promise<QueuedOp[]>; // seq 順
  export function updateOp(op: QueuedOp); removeOp(seq: number);
  export function getSettings(): Promise<Settings | undefined>; saveSettings(s: Settings);
  ```
- [ ] **Step 1: 失敗するテストを書く**: 各ストアの保存→読み出し、`listPlayers` が背番号順、`listEvents` が前半→後半・時刻順で別選手を含まない、`listMatches` が新しい順、`listOps` が seq 順
- [ ] **Step 2:** FAIL を確認 → **Step 3:** `idb` で実装 → **Step 4:** PASS
- [ ] **Step 5: コミット** 「途中で閉じても続きから再開できるよう、iPad の中への保存を作った」

---

### Task 5: 記録一覧の行・CSV と、送信キュー

**Files:**
- Create: `src/report/rows.ts`, `src/sync/client.ts`, `src/sync/queue.ts`
- Test: `tests/rows.test.ts`, `tests/queue.test.ts`

**Interfaces:**
- Consumes: Task 1・2・4
- Produces（`rows.ts`）:
  ```ts
  export const LOG_HEADERS: string[]; // 設計書 8章の19列そのまま:
  // 記録ID,試合日,対戦相手,形式,前後半,背番号,名前,プレー,種類,足,成功,始点レーン,始点ゾーン,終点レーン,終点ゾーン,向きの手修正,再生位置（秒）,映像リンク,記録日時
  export function eventRow(e: PlayEvent, m: Match, p: Player): (string | number | boolean)[];
  export function videoLink(url: string, sec: number): string; // https://www.youtube.com/watch?v=<id>&t=<floor(sec)>s
  export function eventsToCsv(rows: (string | number | boolean)[][]): string; // 先頭に BOM、ヘッダー行つき、CRLF
  ```
  `eventRow` の値: 形式は「11人制」「8人制」、前後半は「前半」「後半」、プレーは「パス」「ドリブル」「守備」「シュート」、種類は `SUBTYPE_LABEL`（パスは `effectivePassDirection` の結果）、成功は「成功」「失敗」、空は `''`。
- Produces（`client.ts`）: `postToScript(s: Settings, body: object): Promise<{ ok: true; data?: unknown } | { ok: false; error: string }>` — `fetch(s.endpoint, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify({ ...body, token: s.token }) })`（`text/plain` は CORS の事前確認を避けるため）。応答 JSON の `ok` を見る。
- Produces（`queue.ts`）:
  ```ts
  export function queueUpsert(eventId: string, row: (string|number|boolean)[]): Promise<void>; // 未送信の同じ eventId の upsert があれば row を差し替える
  export function queueDelete(eventId: string): Promise<void>; // 未送信の upsert を消してから delete を足す
  export function flush(send: (op: QueuedOp) => Promise<boolean>): Promise<{ sent: number; remaining: number }>;
  export function pendingCount(): Promise<number>;
  export function startAutoFlush(getSettings: () => Promise<Settings | undefined>, onChange: (pending: number) => void): void;
  // 呼ばれた直後・window 'online'・未送信があるあいだ30秒ごとに flush。同時に2つ flush しない。設定が無ければ送らない
  ```
- [ ] **Step 1: 失敗するテストを書く**
  - `eventRow` が19列で、パスの手修正ありなら種類「横」・向きの手修正「横」、映像リンクが `&t=754s`
  - `eventsToCsv` が `﻿` で始まり、`,` や `"` を含む値を `"…"` で囲み `""` にする
  - `collapses pending ops`: upsert→upsert（同じ ID）で1件・後の row、upsert→delete で delete 1件だけ
  - `flush stops at first failure and keeps order`: 3件のうち2件目で `send` が false → `sent 1, remaining 2`、2件目の `attempts` が 1、次の flush は2件目から
- [ ] **Step 2:** FAIL → **Step 3:** 実装 → **Step 4:** PASS
- [ ] **Step 5: コミット** 「電波が切れても記録がスプレッドシートに漏れなく届くよう、送信を待ち行列にした」

---

### Task 6: スタッツのタブの表レイアウト

**Files:**
- Create: `src/report/layout.ts`
- Test: `tests/layout.test.ts`

**Interfaces:**
- Consumes: Task 2 の `PlayerStats`, `rate`, `radarValues`
- Produces:
  ```ts
  export type Cell = string | number | null;
  export interface StatsSheet {
    values: Cell[][];           // A1 から始まる長方形（行ごとに同じ列数、11列 A〜K）
    percentRanges: string[];    // "0%" の書式を付ける A1 範囲
    radar: { dataRange: string; anchors: Record<Half, string> }; // dataRange は 'A3:C7'、anchors は {'1H':'E2','2H':'I2'}
  }
  export function buildStatsSheet(title: string, s: PlayerStats): StatsSheet;
  ```
  決めた配置:
  - 1行目: A1 にタイトル（例「#10 山田 太郎 ｜ 2026-10-13 vs ◯◯ ｜ 11人制」）
  - 3〜7行目: レーダー用の表 `['項目','前半','後半']`、`['パス',…]`、`['ドリブル',…]`、`['シュート（枠内）',…]`、`['守備',…]`（0〜100 の数値、空は null）。グラフは E2・I2 に置き、19行目までに収める
  - 20行目から各ブロック。ブロックごとに見出し行＋種類の行＋合計行、間に空行1つ:
    `['パス成功','前半','後半',null,'パス失敗','前半','後半',null,'パス成功率','前半','後半']`
    行: 前／横／後ろ／合計。ドリブル: レガーテ／コンドゥクシオン／プロテクション／合計。守備: ボール奪取／1vs1／空中戦／合計
  - シュート: `['シュート成功','前半','後半',null,'シュート失敗','前半','後半',null,null,null,null]`、行: 枠内(R)／枠内(L)／枠外(R)／枠外(L)。成功の表は枠内の行に数、枠外の行に 0。失敗の表は枠外の行に数、枠内の行に 0
  - 成功率のセルは 0〜1 の数値か null、その範囲を `percentRanges` に入れる
- [ ] **Step 1: 失敗するテストを書く**: `values` の全行が11列、`values[19][0] === 'パス成功'`、パス前・前半の成功/失敗/成功率が正しい位置に入る、分母0の成功率が `null`、シュート失敗表の枠外(L)の後半が正しい、`percentRanges` に `'J21:K24'` を含む（パス成功率の範囲）
- [ ] **Step 2:** FAIL → **Step 3:** 実装 → **Step 4:** PASS
- [ ] **Step 5: コミット** 「見本と同じ表を Apps Script に計算させずに作れるよう、表の配置をアプリ側で決めた」

---

### Task 7: ピッチ図・ヒートマップ・矢印（SVG と PNG）

**Files:**
- Create: `src/pitch/geometry.ts`, `src/pitch/render.ts`, `src/pitch/png.ts`
- Test: `tests/pitch.test.ts`

**Interfaces:**
- Consumes: Task 1 `Zone`、Task 2 `ZoneCell`
- Produces:
  ```ts
  // geometry.ts（単位はメートル、ピッチ 105×68）
  export const PITCH = { w: 105, h: 68 };
  export function zoneRect(z: Zone): { x: number; y: number; w: number; h: number }; // w=17.5, h=13.6
  export function zoneAt(x: number, y: number): Zone | null;  // ピッチ外は null
  export function zoneCenter(z: Zone): { x: number; y: number };
  // render.ts
  export interface Arrow { from: Zone; to: Zone; style: 'solid' | 'dashed' | 'thick' }
  export interface PitchOptions { highlight?: Zone[]; heat?: ZoneCell[]; arrows?: Arrow[]; title?: string }
  export function pitchSvg(o: PitchOptions): string; // viewBox="-4 -4 113 76"
  // png.ts（ブラウザ専用）
  export function svgToPngBase64(svg: string, widthPx?: number /* 1050 */): Promise<string>; // "data:" を除いた base64
  ```
  描き方は `docs/イメージ図/記録画面.html` の SVG と同じ（芝の縞、白線、センターサークル、両ペナルティエリア・ゴールエリア・ペナルティアーク・ゴール、点線のゾーン区切り、下に列番号1〜6、右上に「攻める向き →」）。各マスは `<rect data-lane data-col>` で、タップの判定に使う。
  - ヒートマップ: `count` が最大のマスを最も濃く（白の不透明度 0.15〜0.85 の線形）、マスの中に「n本」と「xx%」（`rate` null なら「-」）。0本のマスは何も描かない
  - 矢印: 始点の中心→終点の中心。`solid` 実線、`dashed` 破線、`thick` 太線。始点と終点が同じマスなら矢印でなく小さな丸。矢じりは `<marker>`。不透明度 0.75
- [ ] **Step 1: 失敗するテストを書く**: `zoneRect({lane:1,col:1})` が `{x:0,y:0,w:17.5,h:13.6}`、`zoneAt(52.4, 34)` が `{lane:3,col:3}`、`zoneAt(52.6,34)` が `{lane:3,col:4}`、`zoneAt(-1,10)` が null。`pitchSvg({})` に `data-lane` を持つ rect が30個。`arrows` に dashed を1本 → `stroke-dasharray` を含む。同じマスの矢印 → `<circle` が増える。`heat` で 3本・rate 0.667 → 「3本」「67%」を含む
- [ ] **Step 2:** FAIL → **Step 3:** 実装（`png.ts` は `Image` + `canvas.toDataURL('image/png')`。テストは Task 11 の E2E で行う）→ **Step 4:** PASS
- [ ] **Step 5: コミット** 「記録・結果・レポートで同じピッチ図を使えるよう、描画を1か所にまとめた」

---

### Task 8: YouTube プレーヤー

**Files:**
- Create: `src/video/youtube.ts`
- Test: `tests/youtube.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function parseYouTubeId(url: string): string | null;
  export interface VideoPlayer { currentTime(): number; seek(sec: number): void; play(): void; pause(): void;
    isPlaying(): boolean; setRate(r: number): void; destroy(): void }
  export function createPlayer(el: HTMLElement, videoId: string, startSec: number): Promise<VideoPlayer>;
  // location.search に fakeVideo=1 があればテスト用プレーヤー（performance.now で時間が進む、再生中のみ）を返す
  export const RATES = [1, 1.5, 2];
  ```
  本物は IFrame Player API（`https://www.youtube.com/iframe_api` を1回だけ読み込む）、`playerVars: { playsinline: 1, rel: 0, start: Math.floor(startSec) }`（`playsinline` が無いと iPad で全画面になる）。
- [ ] **Step 1: 失敗するテストを書く** `parseYouTubeId`: `https://youtu.be/abcDEF12345?t=30`、`https://www.youtube.com/watch?v=abcDEF12345&t=1m`、`https://m.youtube.com/watch?v=abcDEF12345`、`https://www.youtube.com/shorts/abcDEF12345`、`https://www.youtube.com/live/abcDEF12345` → すべて `'abcDEF12345'`。`https://example.com/watch?v=abcDEF12345`、`''`、`'abc'` → `null`
- [ ] **Step 2:** FAIL → **Step 3:** 実装 → **Step 4:** PASS
- [ ] **Step 5: コミット** 「メールで届くいろいろな形の YouTube リンクを貼れるよう、リンクの読み取りとプレーヤーを作った」

---

### Task 9: 画面の土台と、記録の前の画面（ホーム・名簿・試合登録・選手を選ぶ・設定）

**Files:**
- Create: `src/style.css`, `src/ui/dom.ts`, `src/ui/router.ts`, `src/ui/screens/home.ts`, `roster.ts`, `matchForm.ts`, `playerSelect.ts`, `settings.ts`; Modify: `src/main.ts`, `index.html`
- Test: `e2e/setup.spec.ts`, `playwright.config.ts`

**Interfaces:**
- Consumes: Task 4 の db、Task 8 の `parseYouTubeId`
- Produces:
  ```ts
  export function h(tag: string, attrs?: Record<string, unknown>, ...children: (Node | string | null)[]): HTMLElement;
  export type Screen = (root: HTMLElement, params: Record<string, string>) => void | (() => void) | Promise<void | (() => void)>; // 戻り値は後片付け
  export function route(pattern: string, s: Screen): void; export function go(hash: string): void; export function startRouter(root: HTMLElement): void;
  ```
  ルート: `#/` ホーム、`#/roster` 名簿、`#/match/new` と `#/match/:id/edit` 試合登録、`#/match/:id` 選手を選ぶ、`#/match/:id/record/:playerId` 記録、`#/match/:id/list/:playerId` 記録一覧、`#/match/:id/results` 結果、`#/settings` 設定。
  - `style.css`: `:root` に色トークン（背景・文字・芝 `#2f8f4e`・成功 `#1a7f37`・失敗 `#cf222e`・枠線）、ボタン最低 44px、`font-family: -apple-system, "Hiragino Sans", sans-serif`。`-webkit-tap-highlight-color: transparent`、ダブルタップ拡大を止める `touch-action: manipulation`
  - 名簿: チーム名の追加、選手（背番号・名前）の追加・削除。チームが1つなら最初から開く
  - 試合登録: 日付（初期値は今日）・対戦相手・11人制／8人制（2択ボタン）・YouTube リンク（`parseYouTubeId` が null なら「YouTube のリンクを貼ってください」）・出場選手（名簿のチェックボックス、初期は全員）。保存したら選手を選ぶ画面へ
  - 選手を選ぶ: 出場選手を大きなボタンで並べ、それぞれに記録件数。上に試合情報、「結果を見る」「試合を直す」
  - 設定: Apps Script の URL と合言葉。「送信テスト」ボタン（`postToScript(s, {action:'ping'})` の結果を「つながりました」／エラー文で表示）
  - ホーム: 試合の一覧（日付・相手・形式）、「新しい試合」、名簿・設定への入口。名簿が空なら「まず名簿を登録してください」
- [ ] **Step 1: E2E の設定** `playwright.config.ts`: `projects: [{ name: 'ipad', use: { browserName: 'webkit', viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true } }]`、`webServer: { command: 'npm run dev -- --port 5199', port: 5199 }`、`baseURL: 'http://localhost:5199/?fakeVideo=1'`
- [ ] **Step 2: 失敗する E2E を書く** `e2e/setup.spec.ts`: 名簿でチーム「サンプルFC」と選手 #10 山田 太郎・#7 佐藤 一郎を登録 → 試合を登録（相手「テストFC」、8人制、`https://youtu.be/abcDEF12345`）→ 選手を選ぶ画面に2人が出る。不正なリンクではエラー文が出て保存されない。再読み込み後もホームに試合が残る
- [ ] **Step 3:** `npm run e2e` → FAIL → **Step 4:** 実装 → **Step 5:** PASS、`npm test` も PASS
- [ ] **Step 6: コミット** 「記録を始める前の準備（名簿・試合・設定）を1回の登録で済ませられるようにした」

---

### Task 10: 記録画面と記録一覧

**Files:**
- Create: `src/ui/screens/record.ts`, `src/ui/screens/eventList.ts`
- Test: `e2e/record.spec.ts`

**Interfaces:**
- Consumes: Task 3 `step`/`hint`/`PLAY_BUTTONS`、Task 4、Task 5 `eventRow`/`queueUpsert`/`queueDelete`/`startAutoFlush`/`pendingCount`、Task 7 `pitchSvg`/`zoneRect`、Task 8 `createPlayer`
- 配置は設計書 5章と `docs/イメージ図/記録画面.html` のとおり（左 52%：映像・操作ボタン・直前の記録3件・送信状態、右 48%：選手・プレーのボタン 4×3・ヒント・ピッチ）
- 動き:
  - 開いたら `getProgress` の位置と前半／後半から再生を準備する。5秒ごとと画面を離れるときに `saveProgress`
  - プレーのボタンで `step({kind:'play', timeSec: player.currentTime()})`。選択中のボタン・「失敗」・押したマスを強調表示
  - draft ができたら `PlayEvent` にして（`newId()`、`half` は画面の切り替えの値、`createdAt`）`saveEvent` → `queueUpsert` → 直前の記録を更新
  - 直前の記録の一番上に「取消」（`deleteEvent` + `queueDelete`）。パスなら「前／横／後ろ」の3つの小ボタンで手修正（`passDirectionOverride` を入れて保存＋`queueUpsert`）
  - 映像の操作: 10秒戻る、再生／一時停止、倍速（1→1.5→2→1）、前半／後半
  - 送信状態: 「未送信 n件」／「送信済み」／設定が無ければ「送信先が未設定（設定画面で入力）」
  - 記録一覧: 時刻・前後半・プレー・種類・成否・ゾーン。行を押すと記録画面に戻りその時刻へ `seek`。「直す」（プレー・成否・ゾーン・パスの向きを選び直す小さな編集欄）と「消す」（確認あり）
- [ ] **Step 1: 失敗する E2E を書く** `e2e/record.spec.ts`（Apps Script は `page.route('**/script.google.com/**')` で受け取りを偽装し、届いた body を配列に貯める。設定に URL `https://script.google.com/macros/s/TEST/exec` と合言葉を入れておく）
  - パス（3,2→3,4）→ 直前の記録に「パス(前) 成功」
  - レガーテ→失敗→2マス → 「レガーテ 失敗」。シュート枠内L→1マス → 「枠内L」
  - 最後のマスを素早く2回タップ → 記録は1件だけ増える
  - 直前のパスを「横」に手修正 → 表示が「パス(横)」
  - 取消 → 1件減る
  - `reload keeps events and resumes position`: 始点だけ押した状態で再読み込み → 書きかけは無く、保存済みの記録と件数が残る
  - `offline then online`: `context.setOffline(true)` で2件記録 → 「未送信 2件」→ `setOffline(false)` → 「送信済み」になり、偽装先に upsert が順番どおり各1回届く
  - 記録一覧で1件消す → 偽装先に `deleteEvent` が届く
- [ ] **Step 2:** FAIL → **Step 3:** 実装 → **Step 4:** PASS（`npm test` も）
- [ ] **Step 5: 見た目の確認**: Playwright で記録画面のスクリーンショットを撮り、`docs/イメージ図/記録画面.html` と並べて配置が合っているか見る
- [ ] **Step 6: コミット** 「映像を見ながら最大4タップで1件記録でき、間違いもすぐ直せるようにした」

---

### Task 11: 結果画面とレポート作成

**Files:**
- Create: `src/ui/screens/results.ts`, `src/report/build.ts`
- Test: `e2e/results.spec.ts`

**Interfaces:**
- Consumes: Task 2, 5, 6, 7
- Produces（`build.ts`）:
  ```ts
  export interface ReportImage { label: string; pngBase64: string }
  export interface ReportPayload { action: 'buildReport'; playerFileName: string; statsTabName: string; mapTabName: string;
    stats: StatsSheet; images: ReportImage[] }
  export function reportNames(m: Match, p: Player, teamName: string): Pick<ReportPayload, 'playerFileName' | 'statsTabName' | 'mapTabName'>;
  // '#10 山田 太郎（サンプルFC）'、'10/13 vs テストFC スタッツ'、'10/13 vs テストFC マップ'
  export function buildReports(matchId: string, onProgress: (done: number, total: number, name: string) => void): Promise<{ ok: number; failed: { name: string; error: string }[] }>;
  ```
  画像は4枚、この順とラベル: 「パス（実線＝成功・破線＝失敗）」「ドリブル」「守備のヒートマップ」「シュートのヒートマップ」。前半・後半を合わせた1試合分。記録が0件の選手は作らない。
- 結果画面: 上に選手の切り替え（記録がある選手だけ）。集計表（パス・ドリブル・守備・シュート × 前半・後半・合計。本数・成功・失敗・成功率）、ヒートマップ（パス／ドリブル／守備／シュートの切り替え）、矢印マップ（パス・ドリブル）、チーム全体の表（選手ごとに各プレーの本数と成功率）、「CSV 書き出し」（`<a download="YYYY-MM-DD_vs_相手.csv">`）、「レポート作成」（進み具合「2/5人目 #7 佐藤 一郎」→ 終わったら「5人分のレポートを作りました」、失敗があれば選手名とエラー文）
- [ ] **Step 1: 失敗する E2E を書く** `e2e/results.spec.ts`: 2人分の記録を作る（Task 10 の操作を `e2e/helpers.ts` にまとめて使い回す）→ 結果画面でパスの成功率・ヒートマップの「n本」が正しい → CSV がダウンロードされヘッダーが `LOG_HEADERS` → レポート作成で偽装先に `buildReport` が2回届き、それぞれ `images` が4枚で `pngBase64` が `iVBOR` で始まり、`stats.values[19][0]` が「パス成功」
- [ ] **Step 2:** FAIL → **Step 3:** 実装 → **Step 4:** PASS
- [ ] **Step 5: コミット** 「記録を終えたらボタン1つで全選手のレポートを作れるよう、結果画面とレポート作成を作った」

---

### Task 12: Apps Script（受け取り係）と設置手順

**Files:**
- Create: `apps-script/Code.gs`, `apps-script/設置手順.md`

**Interfaces:**
- Consumes: Task 5 の送信形式（`{token, action, ...}`）、`LOG_HEADERS`（`Code.gs` 内に同じ配列を書く。ずれないよう Task 5 のテストで `Code.gs` の文字列に `LOG_HEADERS.join('","')` が含まれることを確かめる）、Task 11 の `ReportPayload`
- 受け付ける `action`: `ping` → `{ok:true}`。`upsertEvent {eventId, row}`、`deleteEvent {eventId}`、`buildReport`（ReportPayload）。合言葉はスクリプト プロパティ `TOKEN` と比べ、違えば `{ok:false,error:'合言葉が違います'}`。例外はすべて `{ok:false,error:メッセージ}` で返す
- `LockService.getScriptLock()` で同時書き込みを防ぐ
- ドライブの「試合分析」フォルダ（無ければ作る）に、「試合分析 記録一覧」（1行目に見出し、A列が記録ID）と選手ファイル（`playerFileName`、無ければ作ってフォルダへ移す）
- `buildReport`: 同名のタブがあれば消してから作り直す。最初のファイル作成時にできる空の「シート1」は消す。スタッツのタブに `values` を書き、`percentRanges` に `0%` 書式、見出し行を太字。レーダーチャートは `sheet.newChart().setChartType(Charts.ChartType.RADAR)` で前半（A,B 列）・後半（A,C 列）を `anchors` に置き、縦軸 0〜100。マップのタブは、画像ごとに見出しセルと `insertImage(blob, 2, row)` を 24 行おきに並べる
- `selfTest()`: 偽のデータでレポートを1つ作る関数（エディタから実行して確かめる用）
- `設置手順.md`: ひろきさん向け。① https://script.google.com を開く → ② 「新しいプロジェクト」→ ③ `Code.gs` を貼る → ④ 「プロジェクトの設定」→「スクリプト プロパティ」で `TOKEN` に合言葉 → ⑤ 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」、実行ユーザー「自分」、アクセス「全員」→ ⑥ 出た URL をツールの設定画面に貼る → ⑦ 「送信テスト」で「つながりました」を確認。各手順でクリックする場所の名前を書く。「アクセス: 全員」でも合言葉が無いと書き込めないことを書く
- [ ] **Step 1:** `Code.gs` と `設置手順.md` を書く。Task 5 に `LOG_HEADERS` 一致のテストを足して PASS を確認
- [ ] **Step 2: ひろきさんと設置する**: 手順書どおりに設置してもらい、ツール（`npm run dev` を Mac で開く）の設定画面で「送信テスト」→「つながりました」
- [ ] **Step 3: 本物での確認**: 1件記録 → 「記録一覧」に1行増える。手修正 → 同じ行が変わる。取消 → 行が消える。レポート作成 → 選手ファイルにスタッツ（表・レーダー2つ）とマップ（画像4枚）。もう一度レポート作成 → タブが増えず作り直される。`Charts.ChartType.RADAR` が使えない場合は、ひろきさんに伝えたうえで、レーダーを Task 7 と同じ方法の PNG に切り替える
- [ ] **Step 4: コミット** 「Google アカウントへのログインを毎回しなくて済むよう、スプレッドシートへの書き込みを Apps Script に任せた」

---

### Task 13: ホーム画面に追加できるようにして、GitHub Pages で公開

**Files:**
- Create: `public/manifest.webmanifest`, `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`, `.github/workflows/deploy.yml`, `docs/使い方.md`; Modify: `index.html`

- 内容:
  - `manifest.webmanifest`: `name` 「試合分析」、`display: standalone`、`orientation: landscape`、背景・テーマ色は芝の緑
  - `index.html`: `<link rel="manifest">`、`apple-touch-icon`、`<meta name="apple-mobile-web-app-capable" content="yes">`、`viewport` に `viewport-fit=cover`
  - アイコン: 緑の背景に白いピッチの線の簡単な図（SVG から PNG を作る）
  - `deploy.yml`: `main` に push されたら `npm ci && npm test && npm run build` → `actions/upload-pages-artifact`（`dist`）→ `actions/deploy-pages`
  - `docs/使い方.md`: ひろきさん向け。iPad の Safari で URL を開く →「共有」ボタン →「ホーム画面に追加」→ 以後はホーム画面のアイコンから開く。試合の記録からレポート作成、選手への共有（スプレッドシートの「共有」→ 選手のメールアドレス →「閲覧者」）までの流れ
- [ ] **Step 1:** 上のファイルを作る。`npm run build` → `dist/manifest.webmanifest` がある
- [ ] **Step 2: ひろきさんに確認を取る**: 「GitHub に `match-analysis-tool` という公開リポジトリを作り、ここまでの全ファイルを送り、GitHub Pages で公開します。URL・合言葉・個人情報は含まれていません」と送る内容（`git ls-files` の一覧）を見せ、OK をもらう
- [ ] **Step 3:** `gh repo create hiroki42977-prog/match-analysis-tool --public --source . --push`、`gh api -X POST repos/hiroki42977-prog/match-analysis-tool/pages -f build_type=workflow`
- [ ] **Step 4:** Actions の完了を待ち、`https://hiroki42977-prog.github.io/match-analysis-tool/` が開けることを確認
- [ ] **Step 5: コミット** 「iPad のホーム画面からアプリとして開けて、データが消されないようにするため」

---

### Task 14: 実機での確認（完成の条件）

- [ ] **Step 1: E2E を全部通す**: `npm test && npm run e2e` → すべて PASS
- [ ] **Step 2: iPad で確認（ひろきさん）**: 公開 URL をホーム画面に追加 → 設定画面で URL と合言葉 → 名簿・試合を登録 → 実際の試合映像で1人の選手を最後まで記録 → 途中で一度アプリを閉じて、続きから開けるか → 結果画面 → レポート作成
- [ ] **Step 3: iPhone で確認（ひろきさん）**: 選手ファイルを iPhone の Google スプレッドシートアプリで開き、表・レーダーチャート2つ・画像4枚が崩れず見られるか
- [ ] **Step 4:** 見つかった不具合は報告し、直すかどうかをひろきさんに決めてもらう。条件をすべて満たしたら「完了」と報告する
