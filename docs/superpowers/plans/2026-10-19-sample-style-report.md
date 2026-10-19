# 見本どおりの出力 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 結果画面の図・スプレッドシートの画像・PDF を見本（見本フォルダの写真）の見た目にし、PDF 用の項目を入れる「レポート入力」画面を足す。

**Architecture:** 見本用のピッチ図は新しいファイル（`src/pitch/perspective.ts` と `src/pitch/sheet.ts`）で描き、記録画面と「場所ごとの本数」で使う今の `pitchSvg` には手を入れない（矢印の散らし方などの部品を export するだけ）。レポートの項目は IndexedDB に新しい保存場所を2つ足して持つ。PDF は今と同じく「キャンバスにページ全体を描いて jsPDF に貼る」方式で、A4縦2ページにする。

**Tech Stack:** TypeScript、Vite、idb、jsPDF、Vitest（+ fake-indexeddb）、Playwright（webkit / iPad 設定）

**Spec:** docs/superpowers/specs/2026-10-19-sample-style-report-design.md

## Global Constraints

- 作業ブランチは `public`。`main` には触らない。GitHub への送信（push）はしない（ひろきさんの確認後に別途）。
- コミットメッセージは日本語で「なぜ変えたか」を書き、最後に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` を付ける。
- コードのコメントは今のコードと同じく日本語・少なめ。
- 新しいライブラリは足さない。
- 記録画面のピッチ、結果画面の「場所ごとの本数」の図、集計の表、チーム全体の表、CSV は変えない。
- 台形の上の辺の幅は下の辺の 0.55 倍。上が相手ゴール（列6）、左がレーン1。
- 色：パス成功 `#1fd655`、失敗（すべて）`#ff2a2a`、成功の青 `#1f3dff`、線・シュート `#111111`。
- PDF：A4縦、1ページ 1654×2339px（約200dpi）、選手1人につき2ページ。ファイル名は今の `pdfFileName` のまま。
- 入っていない項目は空欄で出す（「未入力」などの文字は出さない）。
- 成功率は「57%」のように四捨五入した整数。分母0は「-」。
- 画像は長い辺 600px の JPEG（品質 0.85）に縮めて保存する。
- Apps Script（`apps-script/Code.gs`）は変えない。

## Review Focus

1. 長いコメント（改行入り・数十行）を入れたとき → コメント欄の枠からはみ出さない（文字を小さくし、それでも入らない分は最後の行を「…」で切る）。Task 5 にテストを足す。
2. スコアを全角数字（「１」「２」）で入れたとき → 合計がふつうに計算される。Task 3 にテストを足す。
3. 1つのマスに印が12個以上あるとき → 印がピッチの台形の外に出ない。Task 1 にテストを足す。
4. 後半の記録が0件のとき → 2nd は印のない空のピッチで、PDF も作れる。Task 2・Task 6 にテストを足す。
5. 前の版のデータが入った iPad で開いたとき → 試合・選手・記録がすべてそのまま読め、レポートは空で始まる。Task 3 にテストを足す。

---

### Task 1: 見本の形のピッチ図を描く

**Files:**
- Create: `src/pitch/perspective.ts`
- Create: `src/pitch/sheet.ts`
- Modify: `src/pitch/render.ts`（`spread` と `dribblePath` と `zoneSlots` に `export` を付けるだけ。中身は変えない）
- Test: `tests/sheet.test.ts`

**Interfaces:**
- Produces:
  - `SHEET: { w: 120; h: 76 }`（SVG の viewBox `0 0 120 76`）
  - `project(x: number, y: number): { x: number; y: number }` — 平らなピッチの座標（x＝0〜105、自陣ゴール→相手ゴール。y＝0〜68、レーン1側が0）を台形の座標へ
  - `type SheetIcon = 'L' | 'P' | '1' | '空' | 'ball' | 'shot-on' | 'shot-off'`
  - `interface SheetArrow { from: Zone; to: Zone; kind: 'pass' | 'conduccion'; success: boolean }`
  - `interface SheetMark { zone: Zone; icon: SheetIcon; success: boolean }`
  - `interface SheetPitchOptions { label: '1st' | '2nd'; arrows: SheetArrow[]; marks: SheetMark[] }`
  - `sheetPitchSvg(o: SheetPitchOptions): string`

台形の位置（viewBox 単位）：下の辺 y=71、x=10〜110。上の辺 y=6、x=32.5〜87.5。左上に `label` を font-size 5 で（x=2, y=8）。

射影の計算（奥ほど縮む。テストだけでは決まらないので式を示す）：

```ts
const R = 0.55, A = 1 / R - 1;          // 上の辺の倍率と、奥行きの係数
const s = x / 105;                       // 0＝手前（自陣ゴール）、1＝奥（相手ゴール）
const z = 1 + A * s;
const t = (1 / z - 1 / (1 + A)) / (1 - 1 / (1 + A)); // 1＝手前、0＝奥
const sy = 6 + (71 - 6) * t;
const sx = 60 + ((y - 34) / 68) * 100 / z;
```

- [ ] **Step 1: 失敗するテストを書く（`tests/sheet.test.ts`）**

```ts
test('project: corners and halfway line', () => {
  expect(project(0, 0)).toEqual({ x: 10, y: 71 });
  expect(project(0, 68)).toEqual({ x: 110, y: 71 });
  expect(project(105, 0)).toEqual({ x: 32.5, y: 6 });
  expect(project(105, 68)).toEqual({ x: 87.5, y: 6 });
  const mid = project(52.5, 34);
  expect(mid.x).toBeCloseTo(60);
  expect(mid.y).toBeLessThan((71 + 6) / 2); // 奥が縮むので、ハーフウェーラインは真ん中より上
});
```
（四隅は `toBeCloseTo` で比べてよい）

ほかのテスト：
- `'white sheet, black lines, dashed zone lines'`：`sheetPitchSvg({ label: '1st', arrows: [], marks: [] })` に `#2f8f4e`（今の芝の色）が含まれない。`stroke-dasharray` を持つ線が 8 本（`class="zone-line"`）。`>1st<` を含む。
- `'pass and conduccion colors'`：パス成功は `class="arrow" data-kind="pass" data-ok="1"` で stroke `#1fd655`、パス失敗は `#ff2a2a`、コンドゥクシオン成功は `data-kind="conduccion"` の `<path>` で stroke `#1f3dff`、失敗は `#ff2a2a`。始点の●（`class="start"`）は1つも無い。
- `'icons per handwritten memo'`：`L`・`P`・`1`・`空` は `class="sheet-mark" data-icon="L"` の `<g>` で、中に `<circle fill="#ffffff">` と文字。成功は stroke `#1f3dff`、失敗は `#ff2a2a`。`ball` 成功は `#111111`、失敗は `#ff2a2a`。`shot-on` は黒の○、`shot-off` は黒の×（2本の `<line>`）。
- `'12 marks in one zone stay inside the trapezoid'`（Review Focus 3）：同じマスに 12 個の印を置き、各 `<g class="sheet-mark" data-cx data-cy>` の中心が、その高さでの台形の左右の辺の内側にある。
- `'zone of lane 1 is on the left, col 6 at the top'`：レーン1・列6 の印の `data-cx` < 60、`data-cy` < 38。

- [ ] **Step 2: テストが失敗するのを確かめる**

Run: `npx vitest run tests/sheet.test.ts`
Expected: FAIL（`project` などが無い）

- [ ] **Step 3: `src/pitch/perspective.ts`（`SHEET`、`project`）と `src/pitch/sheet.ts`（型、`sheetPitchSvg`）を作る**

- ピッチの線（外枠、ハーフウェーライン、センターサークル、両方のペナルティエリア・ゴールエリア・アーク、ゴール）は平らな座標で点を作り `project` で写して描く。円や弧は 48 点の折れ線にする。線の色 `#111111`、太さ 0.35。
- マスの線（`class="zone-line"`）：縦は y＝68/5 ごとの4本、横は列1〜5の境目のうち真ん中（x＝52.5）を除く4本。`stroke-dasharray="1.2 1"`。
- 矢印の位置は `spread()`（平らな座標の点）を `project` してから描く。コンドゥクシオンは写したあとの2点で `dribblePath('wave', p, q, 1.6)`。線の太さ 0.35、矢じりは小さい marker（`markerWidth="3"`）。
- 印は、同じマスの印をまとめて `zoneSlots(zone, n)` で平らな座標に散らし、`project` して置く。丸の半径 1.6（奥でも同じ大きさ）。
- 全体を白い `<rect>` で塗った上に描く（PNG にしたとき透けないように）。

- [ ] **Step 4: テストが通るのを確かめる**

Run: `npx vitest run tests/sheet.test.ts tests/pitch.test.ts`
Expected: PASS（今の `pitch.test.ts` も通ったまま）

- [ ] **Step 5: コミット**

```bash
git add src/pitch tests/sheet.test.ts
git commit -m "見本の資料と同じ白地・台形のピッチ図を出せるよう、見本用の図の描き方を足した"
```

---

### Task 2: 結果画面とスプレッドシートの図を 1st・2nd の2枚にする

**Files:**
- Modify: `src/report/build.ts`（`mapFigures`・`defenseMarks`・`shotMarks`・`passArrows`・`dribbleArrows`・`summary`・`MapFigure` を消し、`sheetFigures` に置き換える。`buildReports` の画像も置き換える）
- Modify: `src/pitch/png.ts`（`sheetPngBase64` を足す）
- Modify: `src/ui/screens/results.ts`（図の部分）
- Modify: `src/report/pdf.ts`（Task 6 まで動くよう、`sheetFigures` の2枚を今のA4横のページに描くよう一時的に直す）
- Test: `tests/build.test.ts`、`e2e/results.spec.ts`、`e2e/screenshot.spec.ts`

**Interfaces:**
- Consumes: Task 1 の `SheetPitchOptions`、`sheetPitchSvg`
- Produces:
  - `interface SheetFigure { key: Half; label: '1st' | '2nd'; svg: SheetPitchOptions }`
  - `sheetFigures(events: PlayEvent[]): SheetFigure[]` — 必ず2件（前半→1st、後半→2nd）
  - `sheetPngBase64(svg: string): Promise<string>` — 1050×706 の白い画像の真ん中に、縦横比を保って図を置いた PNG（base64）

対応表（スペックの表どおり）：パス→`kind: 'pass'`、コンドゥクシオン→`kind: 'conduccion'`、レガーテ→`icon 'L'`（始点のマス）、プロテクション→`'P'`（始点のマス）、ボール奪取→`'ball'`、1対1→`'1'`、空中戦→`'空'`、シュート枠内→`'shot-on'`・枠外→`'shot-off'`（`success` はそれぞれの記録の値。シュートは枠内＝true）。

- [ ] **Step 1: 失敗するテストを書く（`tests/build.test.ts` の古い図のテストを置き換える）**

- `'sheet figures: always 1st and 2nd'`：記録0件でも `sheetFigures([])` が `[{ key: '1H', label: '1st', svg: { arrows: [], marks: [] } }, { key: '2H', label: '2nd', ... }]`（Review Focus 4）。
- `'sheet figures: each play goes to the right shape'`：前半にパス成功・パス失敗・コンドゥクシオン・レガーテ・プロテクション・ボール奪取・1対1失敗・空中戦・枠内・枠外を1件ずつ入れ、1st の `arrows` が `[{kind:'pass',success:true},{kind:'pass',success:false},{kind:'conduccion',...}]`、`marks` の `icon` が `['L','P','ball','1','空','shot-on','shot-off']` で、1対1 が `success: false`、`shot-off` が `success: false`。2nd は空。
- `e2e/results.spec.ts`：`#map-1H` と `#map-2H` の2つだけがあり、`#map-pass` などは無い。`#map-1H .arrow` の数＝前半のパス＋コンドゥクシオンの数。`#map-1H` に「1st」の文字。今の一言まとめ（`.summary`）の検証は消す。
- `e2e/results.spec.ts`：レポート作成で送られる `images` が2件で、`label` が `'1st'`・`'2nd'`。

- [ ] **Step 2: テストが失敗するのを確かめる**

Run: `npx vitest run tests/build.test.ts`
Expected: FAIL（`sheetFigures` が無い）

- [ ] **Step 3: `sheetFigures` と `sheetPngBase64` を作り、結果画面・`buildReports`・`pdf.ts` を差し替える**

- 結果画面：図の部分を `h('div', { id: 'map-1H', class: 'figure sheet' }, svgEl(sheetPitchSvg(fig.svg)))` を2つ縦に並べる形にする。見出しの `h2` は付けない（図の中に 1st・2nd がある）。白地なので、`.figure.sheet` は背景白・角丸・薄い枠（`src/style.css` に数行）。
- 使わなくなった `summary` などのテスト（`tests/build.test.ts`）は消す。

- [ ] **Step 4: テストが通るのを確かめる**

Run: `npx vitest run && npx playwright test e2e/results.spec.ts`
Expected: すべて PASS

- [ ] **Step 5: コミット**

```bash
git add src tests e2e
git commit -m "見本の資料と同じく前半・後半の2枚にまとめるため、結果画面とスプレッドシートの図を1st・2ndに置き換えた"
```

---

### Task 3: レポートの項目を保存する場所を作る

**Files:**
- Modify: `src/domain/types.ts`
- Create: `src/domain/report.ts`
- Modify: `src/storage/db.ts`
- Test: `tests/report.test.ts`、`tests/db.test.ts`

**Interfaces:**
- Produces:
  - `Team` に `emblem?: string`、`Player` に `photo?: string`（どちらも JPEG の data URL）
  - `interface Score { us: string; them: string }`
  - `interface MatchReport { matchId: string; score: Record<Half, Score>; matchCondition: string; matchTime: string; venue: string; kickoff: string; weather: string; pitchCondition: string; system: string; opponentSystem: string; opponentEmblem?: string }`
  - `interface PlayerReport { matchId: string; playerId: string; pCondition: string; mCondition: string; eval1H: string; eval2H: string; position: string; playTime: string; themeAttack: string; themeDefense: string; analyst: string; goals: string; assists: string; comment: string; nextAttack: string; nextDefense: string }`
  - `emptyMatchReport(matchId: string): MatchReport`、`emptyPlayerReport(matchId: string, playerId: string): PlayerReport`（文字はすべて `''`）
  - `scoreTotal(r: MatchReport): Score` — 前半＋後半。全角数字も数える。両チームとも前後半が空なら `{ us: '', them: '' }`、どれか入っていれば空は0として足す
  - db：`getMatchReport(matchId): Promise<MatchReport>`（無ければ空のもの）、`saveMatchReport(r)`、`getPlayerReport(matchId, playerId): Promise<PlayerReport>`（無ければ空）、`savePlayerReport(r)`

- [ ] **Step 1: 失敗するテストを書く**

- `tests/report.test.ts`
  - `'score total adds halves'`：前半 1-2、後半 1-3 → `{ us: '2', them: '5' }`（見本の「Total 2-5」）。
  - `'score total accepts full-width digits'`（Review Focus 2）：前半 `'１'`-`'２'`、後半 `'1'`-`''` → `{ us: '2', them: '2' }`。
  - `'score total is blank when nothing is entered'`。
- `tests/db.test.ts`
  - `'reports: empty at first, saved per match and per player'`：`getMatchReport('m1')` が `emptyMatchReport('m1')` と同じ。保存して読み直すと値が残る。`getPlayerReport('m1','p1')` と `('m1','p2')` が別々に保存される。
  - `'opening a version-1 database keeps everything'`（Review Focus 5）：`idb` の `openDB(name, 1, …)` で今の版1と同じ保存場所を作り、チーム・選手・試合・記録を1件ずつ入れて閉じる。そのあと `db.openDb(name)` で開き、4つとも読めて、`getMatchReport` は空のもの。

- [ ] **Step 2: テストが失敗するのを確かめる**

Run: `npx vitest run tests/report.test.ts tests/db.test.ts`
Expected: FAIL

- [ ] **Step 3: 型・`src/domain/report.ts`・db を作る**

- db の版を 2 にし、`upgrade(d, oldVersion)` で `oldVersion < 1` のときだけ版1の保存場所を作り、`oldVersion < 2` のとき `matchReports`（keyPath `matchId`）と `playerReports`（keyPath `['matchId', 'playerId']`）を作る。
- 読み込み時は `{ ...empty, ...保存されていた値 }` にして、あとから項目が増えても欠けないようにする。

- [ ] **Step 4: テストが通るのを確かめる**

Run: `npx vitest run`
Expected: すべて PASS

- [ ] **Step 5: コミット**

```bash
git add src/domain src/storage tests
git commit -m "コメントや評価など見本の資料にある項目を試合・選手ごとに残せるよう、保存場所を足した（今までの記録はそのまま読める）"
```

---

### Task 4: レポート入力画面

**Files:**
- Create: `src/ui/image.ts`
- Create: `src/ui/screens/reportForm.ts`
- Modify: `src/main.ts`（`route('/match/:id/report/:playerId', reportFormScreen)` を `'/match/:id'` より前に）
- Modify: `src/ui/screens/results.ts`（ツールバーに［レポート入力］。今選んでいる選手の画面へ）
- Modify: `src/style.css`（入力欄の並びと画像の小さな見本）
- Test: `e2e/report.spec.ts`

**Interfaces:**
- Consumes: Task 3 の型と db 関数、`scoreTotal`
- Produces:
  - `shrinkImage(file: File, maxSide?: number): Promise<string>`（既定 600、JPEG 品質 0.85 の data URL。読めない画像は `Error('画像を読み込めませんでした')`）
  - `reportFormScreen(root: HTMLElement, params: Record<string, string>): Promise<void>`

画面の並び（上から）：ツールバー［← 結果に戻る］＋見出し「レポート入力 #10 山田 太郎」 → 「試合の情報（この試合の全員で共通）」：スコア（前半 自/相手、後半 自/相手、合計の表示）、試合条件、試合時間、試合会場、キックオフ時間、天候、ピッチコンディション、システム、相手システム、相手のエンブレム → 「選手の情報」：Pコンディション〜アシストの11項目 → コメント（`textarea`、6行） → 次節の課題（攻撃）（守備） → 「画像（次の試合でも使います）」：顔写真、自チームのエンブレム。

- 各欄の `aria-label` は上の項目名そのまま（テストで使う）。
- 文字の欄は `input` イベントのたびに保存する。スコアを打つと合計の表示も変える。
- 画像の欄：`<input type="file" accept="image/*">`。選ぶと `shrinkImage` → 保存 → 小さく表示。［消す］で消す。失敗したら欄の下にエラー文を出す。

- [ ] **Step 1: 失敗する E2E テストを書く（`e2e/report.spec.ts`）**

- `'report form: values are kept after reopening'`：結果画面で［レポート入力］→ コメントに2行、試合会場、評価1st、スコア前半 1-2・後半 1-3 を入れる → 合計に「2-5」と出る → ページを読み直す → 値が残っている。
- `'match fields are shared, player fields are not'`：#10 で試合会場とコメントを入れ、#7 の画面を開くと試合会場は同じ、コメントは空。
- `'photo is shrunk and shown'`：`setInputFiles` で 3000×2000 の PNG（テスト中にバッファで作る）を顔写真に入れる → `img` が表示され、その `naturalWidth` が 600 以下。読み直しても表示される。［消す］で消える。

- [ ] **Step 2: テストが失敗するのを確かめる**

Run: `npx playwright test e2e/report.spec.ts`
Expected: FAIL（［レポート入力］ボタンが無い）

- [ ] **Step 3: `shrinkImage`・`reportFormScreen`・ルート・ボタンを作る**

- [ ] **Step 4: テストが通るのを確かめる**

Run: `npx vitest run && npx playwright test`
Expected: すべて PASS

- [ ] **Step 5: コミット**

```bash
git add src e2e
git commit -m "見本の資料にあるコメント・評価・写真などを iPad で入れられるよう、レポート入力画面を足した"
```

---

### Task 5: PDF の部品（数字の表・レーダー・文字の折り返し）

**Files:**
- Create: `src/report/sheetTables.ts`
- Create: `src/report/radar.ts`
- Create: `src/report/text.ts`
- Test: `tests/sheetTables.test.ts`、`tests/radar.test.ts`、`tests/text.test.ts`

**Interfaces:**
- Consumes: `PlayerStats`、`RadarValues`、`radarValues`（`src/domain/stats.ts`）
- Produces:
  - `interface StatRow { label: string; success: [number, number]; fail: [number, number]; total: [number, number] }`（[前半, 後半]）
  - `interface StatBlock { title: string; successLabel: string; failLabel: string; totalLabel: string; rows: StatRow[]; rate: [string, string] }`
  - `statBlocks(s: PlayerStats): StatBlock[]` — 4件。タイトル・行の名前は下のとおり
  - `radarSvg(v: RadarValues, title: '前半' | '後半', color: string): string` — viewBox `0 0 100 80`。軸は上＝パス、右＝ドリブル、下＝守備、左＝シュート。目盛り 20% ごとに5本、`null` は 0 として描く。値の多角形は `class="value"`
  - `wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[]` — 改行を守り、1文字ずつ詰めて折り返す
  - `fitLines(text: string, maxWidth: number, maxLines: number, measure: (s: string) => number): string[]` — `maxLines` を超える分は捨て、最後の行の末尾を「…」にする
  - `jpDate(date: string): string` — `'2026-09-22'` → `'2026年9月22日'`

表の名前（スペック③のとおり）：
- `パス成功率`／`パス成功`／`パス失敗`／`総パス数`、行 `前`・`横`・`後`・`合計`
- `ドリブル成功率`／`ドリブル成功`／`ドリブル失敗`／`総ドリブル数`、行 `レガテ`・`コンドゥクシオン`・`プロテクシオン`・`合計`
- `守備成功率`／`守備成功`／`守備失敗`／`総守備数`、行 `ボール奪取`・`1vs1`・`空中戦`・`合計`
- `シュート成功率`／`シュート成功`／`シュート失敗`／`総シュート数`、行 `枠内(R)`・`枠内(L)`・`枠外(R)`・`枠外(L)`・`合計`。成功＝枠内の行だけ数が入り、失敗＝枠外の行だけ数が入る

- [ ] **Step 1: 失敗するテストを書く**

- `'pass block matches the sample numbers'`：前半に前パス成功4・失敗6、横成功2、後ろ成功2、後半に前パス失敗2 → パスの表の `前` 行が `success [4,0] fail [6,2] total [10,2]`、`合計` が `[8,0] [6,2] [14,2]`、`rate` が `['57%', '0%']`（見本 IMG_1417 と同じ数）。
- `'rate is "-" when nothing was recorded'`：後半0件 → `rate[1] === '-'`。
- `'shot rows: success only in on-target rows'`。
- `'radar: 100% pass reaches the top grid'`：`radarSvg({ pass: 100, dribble: null, shot: 0, defense: 50 }, '前半', '#5bc0eb')` の `class="value"` の1点目が、いちばん外の目盛りの上の点と同じ。`>前半<` を含む。
- `'wrapText keeps line breaks and wraps long lines'`（1文字＝幅1で測る）。
- `'fitLines cuts with …'`（Review Focus 1）：30行の文を `maxLines` 4 で → 4行、最後が `…` で終わる。
- `'jpDate'`。

- [ ] **Step 2: テストが失敗するのを確かめる**

Run: `npx vitest run tests/sheetTables.test.ts tests/radar.test.ts tests/text.test.ts`
Expected: FAIL

- [ ] **Step 3: 3つのファイルを作る**

- [ ] **Step 4: テストが通るのを確かめる**

Run: `npx vitest run`
Expected: すべて PASS

- [ ] **Step 5: コミット**

```bash
git add src/report tests
git commit -m "見本の2ページ目の数字の表とレーダーチャートを描けるよう、PDF 用の部品を足した"
```

---

### Task 6: PDF を見本どおりの2ページにする

**Files:**
- Create: `src/report/pages.ts`
- Modify: `src/report/pdf.ts`（`buildFiguresPdf` を `buildReportPdf` に置き換える。`pageHeading` は使わなくなれば消す）
- Modify: `src/ui/screens/results.ts`（PDF 書き出しで、レポートと画像も読んで渡す）
- Test: `e2e/results.spec.ts`、`e2e/screenshot.spec.ts`、`tests/pdf.test.ts`

**Interfaces:**
- Consumes: Task 1〜5 のすべて
- Produces:
  - `interface ReportPdfInput { match: Match; player: Player; team: Team; events: PlayEvent[]; matchReport: MatchReport; playerReport: PlayerReport }`
  - `drawPage1(ctx: CanvasRenderingContext2D, d: ReportPdfInput): Promise<void>`、`drawPage2(ctx, d): Promise<void>`（`src/report/pages.ts`。キャンバスは 1654×2339）
  - `buildReportPdf(d: ReportPdfInput): Promise<Blob>`（A4縦 210×297mm、2ページ）

ページの配置（px。左右の余白 90。下の余白は 60 以上残す）：

1ページ目
- y 60〜110：チーム名（太字 40px、真ん中）
- y 130〜：1st の図（幅 1300、高さ 1300×76/120、真ん中）。続けて 2nd の図
- その下 20px あけて「コメント」：見出しの帯 高さ 44・背景 `#b8b8b8`・黒字 24px 真ん中。枠 高さ 300・文字 26px 真ん中ぞろえ。`fitLines` で入るだけ（入らなければ 22px → 18px と小さくしてから切る）
- その下に「次節の課題」：同じ帯、行 2つ（高さ 48）に `攻撃:…`・`守備:…`（左寄せではなく真ん中）

2ページ目
- y 60：右上に `jpDate`（24px）、真ん中にチーム名（太字 40px）
- y 130〜390：左から顔写真（200×260）、自チームのエンブレム（200×200）、「vs」、相手のエンブレム（200×200）、【スコア】の文字（`1st 1-2` / `2nd 1-3` / `Total 2-5`）。画像が無い枠は薄い灰色の枠だけ
- y 420〜：情報の表 10行×40px、4列（見出し `#5a5a5a` 白字 20px／値 白地 黒字 20px／見出し／値）。値が枠に入らないときは文字を小さくする
- その下 30px：レーダー2つを横に並べる（各 幅 700×高さ 400）。前半 `#5bc0eb`、後半 `#2ecc71`
- その下 30px：数字の表4つ。帯 高さ 36（`#4a4a4a`、文字 `#6fe3cf` 20px）、列見出し行・行 高さ 28、文字 18px、罫線 `#bdbdbd`。成功率の列は行を結合して真ん中に1つの値

- [ ] **Step 1: 失敗するテストを書く**

- `e2e/results.spec.ts` の PDF のテストを直す：［PDF 書き出し］→［PDF を保存］で落ちてくる PDF が `%PDF` で始まり、ページ数が 2（中の `/Type /Page` の数で数える。`/Pages` は除く）。
- 同じファイルに `'pdf can be made with no second-half records and no report input'`（Review Focus 4）：前半だけ記録し、レポート入力をしないで PDF → 2ページ。
- `e2e/screenshot.spec.ts` の results のテストで、レポート入力（コメント・スコア・写真など）を入れてから PDF を `figures.pdf` に保存する（見た目の確認用）。

- [ ] **Step 2: テストが失敗するのを確かめる**

Run: `npx playwright test e2e/results.spec.ts`
Expected: FAIL（ページ数が違う）

- [ ] **Step 3: `pages.ts`・`buildReportPdf`・結果画面の呼び出しを作る**

画像（顔写真など）は `Image` に読み込んでから `drawImage`。読めなかった画像は枠だけにして、PDF づくりは止めない。

- [ ] **Step 4: テストが通るのを確かめる**

Run: `npx vitest run && npx playwright test`
Expected: すべて PASS

- [ ] **Step 5: 見本と並べて見た目を確かめる**

```bash
SHOTS=<scratchpad>/shots npx playwright test e2e/screenshot.spec.ts
```
PDF の各ページを PNG にする（macOS の PDFKit を使う小さな swift スクリプトを scratchpad に置いて実行。リポジトリには入れない）。1ページ目を `見本/IMG_1416.PNG` の上半分、2ページ目を下半分と `見本/IMG_1417.PNG` と並べて見比べ、違いがあれば直す。

- [ ] **Step 6: コミット**

```bash
git add src e2e tests
git commit -m "選手に渡す資料をツールからそのまま出せるよう、PDF を見本と同じA4縦2ページ（図・コメント／情報・レーダー・数字の表）にした"
```

---

### Task 7: 仕上げの確認

- [ ] **Step 1: すべてのテストと組み立て**

Run: `npm run build && npx vitest run && npx playwright test`
Expected: エラーなし・すべて PASS

- [ ] **Step 2: 公開と同じ条件で動くか**

Run: `npm run build && PW_BASE=1 npx playwright test e2e/results.spec.ts e2e/report.spec.ts`
Expected: PASS

- [ ] **Step 3: ひろきさんへの報告をまとめる**

撮影した結果画面と PDF の2ページの画像、見本との違いが残っている点、iPad 実機で確かめてほしいこと（写真を選べる・PDF を保存できる・文字が欠けていない）を書く。push はしない。
