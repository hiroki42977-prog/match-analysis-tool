# スプレッドシート出力を完成資料（PDF）の形にする 第2版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「レポート作成」で作るタブを、2026-10-23 にひろきさんが OK した見本の3版目（20列、PDF の並びの項目、濃い芝のプレーマップ、2ページ目のロゴ枠）にする。

**Architecture:** 受け取り係（Code.gs）は送られた形をそのまま当てはめる作りなので変えない。アプリ側の絵（src/pitch/sheet.ts・field.ts）と、タブの形（src/report/sheetLayout.ts）、画像の大きさ（src/report/build.ts の sheetSvgs）だけを変える。

**Tech Stack:** TypeScript、Vite、Vitest、Playwright

**Spec:** docs/superpowers/specs/2026-10-22-sheet-handwritten-layout-design.md（第2版）

## Global Constraints

- 作業ブランチは `public`。push はしない。コミットは日本語で「なぜ」を書き、最後に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- apps-script/Code.gs は変えない。`layout.version` は 1 のまま。画像の目印は `tool:`／`frame:` のまま。
- PDF（src/report/pdf.ts・pages.ts）と結果画面の図は変えない（白地の `sheetPitchSvg(o)` はそのまま）。
- 色：帯 `#4a4a4a`、帯の文字 `#6fe3cf`、罫線 `#555555`、ポジション図の芝 `#2f8f4e`、プレーマップの濃い芝 `#2a6a2a`・しま `#235c23`、表の縞 `#f4f4f4`、コメント見出し `#d9d9d9`、ロゴ欄の字 `#999999`、レーダー 前半 `#5bc0eb`・後半 `#2ecc71`・全体 `#f39c12`。
- 列は A〜T の20列、各 36px。1ページ目 1〜51 行（合計 1132px）、2ページ目 52〜59 行（合計 1132px）。toolRange は `A20:T51`。
- PNG は1枚 100万画素未満。

## Review Focus

1. 画像のずれ（offsetX/offsetY）が置くセルの幅・高さ以上になっていると、本物のスプレッドシートで位置が崩れる → すべての画像で 0 ≤ offset < そのセルの幅・高さ。Task 2 にテスト。
2. 2ページ目の先頭の行（52行目）が背の低い行だと、改ページで1ページ目に入り込む → 52行目は 380px の1枚の画像。Task 2 にテスト。
3. 後半0件の選手 → 2nd は印の無い濃い芝の図。Task 2 の sheetSvgs テスト。
4. PDF の図が変わってしまう → 白地の出力は前と同じ。Task 1 にテスト。

---

### Task 1: 濃い芝のプレーマップと、2ページ目の図を描く

**Files:** Modify `src/pitch/sheet.ts`、`src/pitch/field.ts`、`tests/sheet.test.ts`、`tests/field.test.ts`

**Interfaces（Produces）:**
- `sheetPitchSvg(o, 'green')`：全体の地を `#2a6a2a` で塗り、台形の芝を `#2a6a2a`、長さ方向に12等分した帯の偶数番目（0,2,4,…）を `#235c23` で塗る（帯の四隅は `project(a,0)`・`project(b,0)`・`project(b,68)`・`project(a,68)`、a=i*105/12, b=(i+1)*105/12）。左上の「1st/2nd」の文字は green のときは描かない。線・パスの白、シュートの黒など他は今のまま。
- `sheetLegendSvg('green')`：地を `#2a6a2a` に（文字と絵は今のまま白）。
- `mapPageSvg(label: '1st' | '2nd', mapSvg: string, logoBox: boolean): string`（field.ts）。幅 720、高さ `logoBox ? 380 : 330`、白地。`logoBox` のとき上に枠 `x=252.5 y=5.5 width=215 height=39`（線 `#555555`、塗りなし）と文字「チームロゴ」（x=257 y=15、8px、`#999999`）。図の上端 `top = logoBox ? 50 : 0`。左に label（x=54、y=top+24、20px、太字、`#111111`、中央ぞろえ）。`x=108 y=top width=612 height=330` を `#2a6a2a` で塗り、その中に mapSvg を幅 521・高さ 330、x=153.5 で入れ子にする（最初の `<svg ` を置き換え）。
- `mapPanelSvg` は消す（使う所が無くなる）。

- [ ] **Step 1: 失敗するテストを書く** — sheet.test.ts の green テストの芝の色を `#2a6a2a` に、しまの `fill="#235c23"` が6本あること、green に `>1st<` が無いこと、white は前と同じ（`sheetPitchSvg(o)` に `#2a6a2a` が無い）ことを足す。field.test.ts の mapPanel のテストを `mapPageSvg` のテストに置き換える：`mapPageSvg('1st', map, true)` に `viewBox="0 0 720 380"`・`>チームロゴ<`・`>1st<`・`<svg x="153.5" y="50" width="521" height="330"`、`mapPageSvg('2nd', map, false)` に `viewBox="0 0 720 330"`・`>2nd<`・`y="0" width="521"`、ロゴ枠が無い。
- [ ] **Step 2: 失敗を確かめる** — `npx vitest run tests/sheet.test.ts tests/field.test.ts`
- [ ] **Step 3: 実装する**
- [ ] **Step 4: 通ることを確かめる** — 同じコマンドで PASS、`npx vitest run` も（build.ts が mapPanelSvg を使っているので、ここでは build.ts の import を `mapPageSvg` に仮に合わせ、`sheetSvgs` の map を `mapPageSvg('1st', …, true)`・`mapPageSvg('2nd', …, false)` にしておく。大きさは Task 2 で直す）
- [ ] **Step 5: コミット** — 「完成資料と同じ濃いしま模様の芝にするため、プレーマップと凡例の色を変え、2ページ目の図をロゴ枠付きで描けるようにした」

---

### Task 2: タブの形を20列の新しい並びにし、画像の大きさを合わせる

**Files:** Modify `src/report/sheetLayout.ts`、`src/report/build.ts`（sheetSvgs）、`tests/sheetLayout.test.ts`、`tests/build.test.ts`

**Interfaces:** `SheetLayout` の型は今のまま（`toolRange` の型を `'A20:T51'` に）。`buildSheetLayout(stats, png)`、`ROW_HEIGHTS`、`SheetPngs` の名前は今のまま。

値：
- `ROW_HEIGHTS`：`[50, 28×5, 24×10, 3, 210, 3, 表（見出し17・項目名15・前半後半15・行17×4/4/4/5、表の間3）, 380, 22, 330, 20, 160, 20, 100, 100]`（59行）。
- 列幅：`Array(20).fill(36)`。
- 枠（frame）：設計書の「1ページ目」「2ページ目」の表のとおり。書式：項目名と「スコア」は `{ bg:'#4a4a4a', color:'#6fe3cf', size:7 }`（中央）、項目の空欄は `{ wrap:true, valign:'top', align:'left', size:8 }`、写真・エンブレムの空欄は `{ wrap:true, valign:'top', align:'left' }`（写真は値「写真」、`color:'#999999'`、`size:8`）、`E2:E6` は `vs`（太字 11）、「1st」「2nd」「Total」は `{ size:8 }`、ロゴ `H1:M1` は今と同じ書式、`J2:T16` は `{ bg:'#2f8f4e' }`、`D53:T53` は `{ bg:'#2a6a2a' }`、見出し `D55:T55 コメント`・`D57:T57 次節の課題` は `{ bg:'#d9d9d9', bold:true, size:9 }`、`D58:E58 攻撃`・`D59:E59 守備` は `{ bold:true, size:9 }`、空欄 `D56:T56`・`F58:T58`・`F59:T59`。52・54行目にはセルを置かない。
- 表（tool）：表の k 列目（1〜10）はシートの列 `2k-1`〜`2k`。パス 20〜26（見出し20・項目名21・前半後半22・行23〜26）、すき間27、ドリブル 28〜34、すき間35、守備 36〜42、すき間43、シュート 44〜51。見出しは A:T（帯・10px）、項目名の行は 成功 A:F／失敗 G:L／総数 M:P／`成功率` Q:T（帯・9px）、前半後半の行は 9px、データの行は今と同じ中身（縞・7文字以上は 8px・中央ぞろえ）、成功率は Q:R と S:T を縦につなげる（`#f4f4f4`、12px）。
- 画像（置く範囲の中央に置いてから、ずれがセルより大きければセルを右・下にずらす）：
  - `frame:field` J2 起点、396×269、ずれ (0, 55) → 正規化後 J3 (0, 27)
  - `tool:radar-1H` A18 起点・範囲 A〜G、220×176 → (16, 17)
  - `tool:radar-2H` H18 起点・範囲 H〜N、220×176 → (16, 17)
  - `tool:radar-all` O18 起点・範囲 O〜T、210×168 → (3, 21)
  - `tool:map-1st` A52 (0,0) 720×380
  - `tool:legend` D53 起点・範囲 D〜T、高さ 18、幅 `round(18*LEGEND_SIZE.w/LEGEND_SIZE.h)`、横は中央、ずれ Y 2
  - `tool:map-2nd` A54 (0,0) 720×330
- sheetSvgs の大きさ：radar1H・radar2H 220×176×2、radarAll 210×168×2、map1st `mapPageSvg('1st', sheetPitchSvg(f,'green'), true)` 720×380×1.5、map2nd `mapPageSvg('2nd', …, false)` 720×330×1.5、legend 上の幅×18×2（`sheetLegendSvg('green')`）、field 396×269×2。

- [ ] **Step 1: 失敗するテストを書く**（sheetLayout.test.ts を新しい値に書き換える）
  - 列20×36、行59、`sum(1,51)=1132`、`sum(52,59)=1132`、`ROW_HEIGHTS[51] === 380`
  - 枠：`A7:B7` が `名前`、`A8:B8` が `Pコンディション`、`F10:G10` が `試合会場`、`F16:G16` が `アシスト`、`H1:M1` が `チームロゴ`、`J2:T16` の bg、`D55:T55` が `コメント`、`D58:E58` が `攻撃`、52・54行目にセルが無い、表の範囲（20〜51行）に枠のセルが無い（範囲の始まりと終わりの両方で確かめる）
  - 表：`A20:T20` が `パス成功率`、`A23:B23` が `前`、`C23:D23` が 1 回目の成功数、`Q23:R26` が成功率、`A44:T44` が `シュート成功率`、`toolRange === 'A20:T51'`
  - 画像：上の7つの key・col・row・大きさ、そして全画像で `0 <= offsetX < 36` と `0 <= offsetY < ROW_HEIGHTS[row-1]`
  - build.test.ts：sheetSvgs の w・h・scale が上の値と同じ、100万画素未満、map2nd に `#2a6a2a`
- [ ] **Step 2: 失敗を確かめる** — `npx vitest run tests/sheetLayout.test.ts tests/build.test.ts`
- [ ] **Step 3: 実装する**（画像のずれの正規化は列幅・行の高さを使う小さな関数1つにまとめる）
- [ ] **Step 4: 通ることを確かめる** — `npx vitest run && npm run build && npx playwright test e2e/results.spec.ts`
- [ ] **Step 5: コミット** — 「完成資料の並び（20列、項目、右の大きなポジション図、2ページ目のロゴ枠）でタブを作るため、タブの形と画像の大きさを作り直した」
