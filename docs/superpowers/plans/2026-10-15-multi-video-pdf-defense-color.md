# 複数リンク・PDF書き出し・守備の黄色 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1試合に前半・後半つきの YouTube リンクを複数登録して記録でき、選手1人分の図を PDF で書き出せ、全体マップの守備の印が黄色で見分けられるようにする。

**Architecture:** `Match.videos` と `PlayEvent.videoId` / `PlayerProgress.videoId` を足し、古いデータは `src/domain/videos.ts` の関数で読み込み時に補う。PDF は各ページをキャンバスで画像に描き（日本語の見出し込み）、jsPDF で A4 横に貼る。守備の黄色は `Mark` / `LegendItem` に `color` を足して全体マップだけで使う。

**Tech Stack:** TypeScript, Vite, IndexedDB（idb）, vitest, Playwright, jsPDF（新規）

**Spec:** docs/superpowers/specs/2026-10-15-multi-video-pdf-defense-color-design.md

## Global Constraints

- 画面の文言・コメントは日本語。コミットメッセージは日本語で「なぜ変えたか」を書く。
- 作業は `public` ブランチ。ローカルの `main` は使わない・送らない。push はひろきさんの確認後に `git push origin public:main`。
- スプレッドシートの列（`LOG_HEADERS`）は変えない。
- 記録は1件も消さない。古い試合は `videoUrl` を `[{ half: '1H' }]` の1本として引き継ぐ。
- 黄色は `#ffd60a`。成功＝黄色の塗り、失敗＝黄色のふちで中が赤（`#ff4d4f`）。全体マップだけ。
- PDF：A4横・1ページ1図・上部に「#背番号 名前｜日付 vs 相手」、図の見出し、一言まとめ。ファイル名 `日付_vs_相手_#背番号名前.pdf`。
- 各タスクの終わりに `npm run check` と `npm run build` が通ること。

## Review Focus

- 前からある試合（`videoUrl` だけ・記録に `videoId` 無し）を開いても、記録画面・記録一覧・結果・CSV が今まで通り動く → Task 1 と Task 3 のテスト。
- 記録が付いたリンクを消した後：その記録は最初のリンクで扱われ、画面が壊れない → Task 1 `videoOf` のテスト。
- 進み具合が消したリンクを指している：最初のリンクの 0 秒から始まる → Task 3 のテスト。
- 記録が少ない選手（パスだけ等）でも、PDF は7ページできる → Task 5 のテスト。
- 相手の名前に「/」などが入っていてもファイル名で失敗しない → Task 5 のテスト（`/` と `\` は `-` に置き換え）。

---

### Task 1: データの形と古いデータの引き継ぎ

**Files:**
- Create: `src/domain/videos.ts`
- Modify: `src/domain/types.ts`, `src/storage/db.ts`（`getMatch` / `listMatches`）, `src/report/rows.ts:22`
- Test: `tests/videos.test.ts`（新規）, `tests/db.test.ts`, `tests/rows.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `interface MatchVideo { id: string; url: string; half: Half }`、`Match.videos: MatchVideo[]`（`videoUrl` は削除し、古いデータ用に `LegacyMatch = Omit<Match,'videos'> & { videos?: MatchVideo[]; videoUrl?: string }` を videos.ts に置く）、`PlayEvent.videoId?: string`、`PlayerProgress.videoId?: string`
  - `videos.ts`: `upgradeMatch(m: LegacyMatch): { match: Match; changed: boolean }` — `videos` が無いか空なら `videoUrl` から `[{ id: newId(), url, half: '1H' }]` を作る
  - `videos.ts`: `videoOf(m: Match, videoId?: string): MatchVideo` — 見つからなければ `m.videos[0]`
  - `videos.ts`: `videoLabel(m: Match, v: MatchVideo): string` — 例 `①前半`（①〜⑳、`HALF_LABEL` を使う）
  - `db.getMatch` / `db.listMatches` は `upgradeMatch` を通し、`changed` なら保存し直す
  - `eventRow` の映像リンクは `videoOf(m, e.videoId).url`

- [ ] **Step 1: 失敗するテストを書く**（`tests/videos.test.ts`）
  - `upgradeMatch({ ...base, videoUrl: 'https://youtu.be/abcDEF12345' })` → `changed === true`、`videos.length === 1`、`videos[0].url` が元のリンク、`half === '1H'`
  - `upgradeMatch` に `videos` がある試合 → `changed === false`、同じ `videos`
  - `videoOf(m, undefined)` と `videoOf(m, '消えたID')` → `m.videos[0]`、`videoOf(m, m.videos[1].id)` → 2本目
  - `videoLabel` → 3本（前半・前半・後半）で `['①前半','②前半','③後半']`
  - `tests/db.test.ts`：古い形の試合を `saveMatch` で入れ（型は `as never` で通す）、`getMatch` で `videos` が付き、2回目の `getMatch` でも同じ `videos[0].id`（保存し直されている）
  - `tests/rows.test.ts`：2本目のリンクの `videoId` を持つ記録の映像リンク列が2本目の YouTube ID になる。`videoId` 無しの記録は1本目。既存テストの `match` は `videos` 形に直す
- [ ] **Step 2:** `npx vitest run tests/videos.test.ts tests/db.test.ts tests/rows.test.ts` → FAIL
- [ ] **Step 3:** 上の Interfaces どおりに実装。`matchForm.ts` / `record.ts` の `m.videoUrl` は、型エラーを消すだけの最小変更（`videoOf(m).url`）にとどめ、画面の作り替えは Task 2・3 で行う
- [ ] **Step 4:** `npm run check` と `npm run build` → すべて PASS
- [ ] **Step 5:** コミット（例：「1試合に複数のリンクを持てるようにするため、試合と記録にどのリンクかを持たせ、前からの試合はリンク1本の前半として引き継ぐようにした」）

### Task 2: 試合の登録画面でリンクを何本でも

**Files:**
- Modify: `src/ui/screens/matchForm.ts`, `src/style.css`（行の並びが必要なら）, `e2e/helpers.ts`
- Test: `e2e/setup.spec.ts`

**Interfaces:**
- Consumes: `MatchVideo`, `newId`, `db.listEvents(matchId)`
- Produces: 各リンク行の入力欄は `aria-label="YouTube のリンク ①"`（番号つき）、前後半ボタンは行の中の「前半」「後半」、［消す］、行の下に［＋ リンクを足す］。`e2e/helpers.ts` に `addVideo(page, url, half: '前半'|'後半')` を足す

- [ ] **Step 1: 失敗するテストを書く**（`e2e/setup.spec.ts`）
  - リンクを3本（前半・前半・後半）入れて保存 → 「試合を直す」で開き直すと3行・前後半がそのまま
  - 新しい行の前後半は1つ上の行と同じ
  - 1本が YouTube でないと「YouTube のリンクを貼ってください」で保存されない
  - 記録が付いたリンクを［消す］→ 「このリンクで記録した1件が映像に飛べなくなります」の確認が出る（`page.on('dialog')` で文言を確かめる）
  - 既存の `setupTeamAndMatch` は1行目の入力欄（`getByLabel('YouTube のリンク ①')`）に入れる形に直す
- [ ] **Step 2:** `npx playwright test e2e/setup.spec.ts` → FAIL
- [ ] **Step 3:** 実装。保存条件：1本以上、すべて `parseYouTubeId` が通る。最後の1本は消せない（［消す］を出さない）
- [ ] **Step 4:** `npm run check` と `npm run build` → PASS
- [ ] **Step 5:** コミット

### Task 3: 記録画面のリンク切り替えと、記録一覧からのジャンプ

**Files:**
- Modify: `src/ui/screens/record.ts`, `src/ui/screens/eventList.ts`, `src/style.css`
- Test: `e2e/record.spec.ts`

**Interfaces:**
- Consumes: `videoOf`, `videoLabel`, `createPlayer`
- Produces: リンクが2本以上のとき、映像の上に `id="video-tabs"` の切り替えボタン（文言は `videoLabel`）。新しい記録と進み具合に今のリンクの `videoId` を入れる。記録一覧の行を押すと `saveProgress({ ..., videoId: e.videoId })`

- [ ] **Step 1: 失敗するテストを書く**（`e2e/record.spec.ts`。`?fakeVideo=1` を使う）
  - 3本の試合で記録画面を開くと `#video-tabs` に「①前半」「②前半」「③後半」。1本の試合では `#video-tabs` が無い
  - 「③後半」を押す → 「後半」ボタンが `on`、そこで記録したプレーが記録一覧で「後半」と出る
  - 記録画面を出て入り直すと「③後半」が選ばれたまま
  - 記録一覧で②の記録を押す → 記録画面で「②前半」が選ばれている
  - 進み具合が存在しない `videoId` を指す（`page.evaluate` で IndexedDB に入れる、または②を登録画面で消してから入る）→ 「①前半」で開く
  - 前からの形の試合（`videos` 無し）を IndexedDB に直接入れても記録画面が開き、記録できる
- [ ] **Step 2:** `npx playwright test e2e/record.spec.ts` → FAIL
- [ ] **Step 3:** 実装。切り替えは今の player を `destroy()` → `createPlayer(videoBox, id, 進み具合があればその秒、無ければ0)`。切り替え中は `pad.setDisabled('映像の準備中…')`。切り替え前に今のリンクの進み具合を保存。進み具合はリンクごとではなく選手ごとに1つ（spec どおり「どのリンクの何秒まで」）
- [ ] **Step 4:** `npm run check` と `npm run build` → PASS
- [ ] **Step 5:** コミット

### Task 4: 全体マップの守備を黄色に

**Files:**
- Modify: `src/pitch/render.ts`（`Mark`, `LegendItem`, `markLayer`, `glyphSvg`）, `src/report/build.ts`（`defenseMarks`, `OVERALL_LEGEND`）
- Test: `tests/pitch.test.ts`, `tests/build.test.ts`

**Interfaces:**
- Produces: `Mark.color?: 'yellow'`、`LegendItem.color?: 'yellow'`、`defenseMarks(events: PlayEvent[], color?: 'yellow'): Mark[]`。`render.ts` に `const DEFENSE = '#ffd60a'`

- [ ] **Step 1: 失敗するテストを書く**
  - `pitch.test.ts`：`color: 'yellow'` の成功の印は `fill="#ffd60a"`、失敗の印は `fill="#ff4d4f"` で `stroke="#ffd60a"`。`color` 無しは今まで通り `#ffffff` / `#ff4d4f`
  - `build.test.ts`：`mapFigures` の `overall-1H` の `marks` がすべて `color: 'yellow'`、凡例の奪取・1対1・空中戦も `color: 'yellow'`。`defense` の図の `marks` には `color` が無い
- [ ] **Step 2:** `npx vitest run tests/pitch.test.ts tests/build.test.ts` → FAIL
- [ ] **Step 3:** 実装（黄色の失敗の印は stroke-width `.5`）
- [ ] **Step 4:** `npm run check` と `npm run build` → PASS
- [ ] **Step 5:** コミット

### Task 5: 選手1人分の図を PDF に

**Files:**
- Create: `src/report/pdf.ts`
- Modify: `src/ui/download.ts`（`saveTextFile` → `saveFile`）, `src/ui/screens/results.ts`, `package.json`（`npm install jspdf@^3`）
- Test: `tests/pdf.test.ts`（新規）, `tests/download.test.ts`, `e2e/results.spec.ts`

**Interfaces:**
- Consumes: `mapFigures`, `pitchSvg`, `MapFigure`
- Produces:
  - `download.ts`: `saveFile(data: BlobPart, name: string, type: string): Promise<'share' | 'download'>`（CSV の呼び出しも置き換え）
  - `pdf.ts`: `pdfFileName(m: Match, p: Player): string` — `${m.date}_vs_${相手}_#${p.number}${p.name}.pdf`、`/` と `\` は `-` に
  - `pdf.ts`: `pageHeading(m: Match, p: Player): string` — `#10 山田 太郎｜2026-10-13 vs テストFC`
  - `pdf.ts`: `buildFiguresPdf(figs: MapFigure[], heading: string): Promise<Blob>` — 各図を A4 横の比率（297:210）のキャンバスに、上から heading・`fig.title`・`fig.summary`・図（`pitchSvg(fig.svg)` を画像で）の順に描き、JPEG にして jsPDF で1ページずつ貼る。ブラウザ専用
- 結果画面：［CSV 書き出し］の隣に［PDF 書き出し］。作成中はボタンを押せなくし `reportMsg` に「PDF を作成中…」。共有シートを閉じた（`AbortError`）ときは何も出さない。失敗は「PDF を作れませんでした：…」

- [ ] **Step 1: 失敗するテストを書く**
  - `tests/pdf.test.ts`：`pdfFileName` → `2026-10-13_vs_テストFC_#10山田 太郎.pdf`、相手が `A/B` なら `A-B`。`pageHeading` の文字列
  - `tests/download.test.ts`：`saveFile` に名前を変える（中身は同じ）
  - `e2e/results.spec.ts`：パスだけ記録した選手で［PDF 書き出し］→ `download` イベントのファイル名が `.pdf` で終わり、中身の先頭が `%PDF`、`/Type /Page` が7回（`/Type /Pages` は数えない）
- [ ] **Step 2:** `npx vitest run tests/pdf.test.ts tests/download.test.ts` と `npx playwright test e2e/results.spec.ts` → FAIL
- [ ] **Step 3:** 実装
- [ ] **Step 4:** `npm run check` と `npm run build` → PASS
- [ ] **Step 5:** コミット

### Task 6: 見た目の確認

- [ ] **Step 1:** `e2e/screenshot.spec.ts` を走らせ、全体マップ（守備あり）、記録画面の切り替えボタン、登録画面の3行のスクリーンショットを撮る。Playwright の Chromium に加え WebKit（iPad の Safari と同じ仕組み）でも撮る
- [ ] **Step 2:** e2e で書き出した PDF を scratchpad に保存し、1ページ目と全体マップのページを画像で確かめる（文字の欠け・はみ出しがないか）
- [ ] **Step 3:** スクリーンショットと PDF をひろきさんに見せ、iPad 実機での確認項目を伝える。push はひろきさんの確認後
