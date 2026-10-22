# スプレッドシート出力を手書きの設計図の形にする Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「レポート作成」で、選手ごとのスプレッドシートに試合ごとの1タブを、見本と同じ A4縦2ページの形（枠・空欄・レーダー3つ・成功率の表・緑のプレーマップ）で作り、送り直しても担当者の書き込みを消さない。

**Architecture:** タブの形（列幅・行の高さ・セル・画像の置き場所）はアプリ側の純粋な関数 `buildSheetLayout` で全部決めて JSON で送り、Apps Script は受け取った形をそのまま当てはめるだけにする（形のテストを Vitest で書けるようにするため）。画像（レーダー・プレーマップ・凡例・ポジション図）はアプリで SVG を描いて PNG にして送る。Apps Script は新しい操作 `buildSheet` を持ち、タブがあるときは表の範囲と `tool:` の画像だけを入れ替える。

**Tech Stack:** TypeScript、Vite、Vitest、Playwright（webkit / iPad 設定）、Google Apps Script

**Spec:** docs/superpowers/specs/2026-10-22-sheet-handwritten-layout-design.md

## Global Constraints

- 作業ブランチは `public`。`main` には触らない。GitHub への送信（push）はしない（最後にひろきさんの確認を取ってから）。
- コミットメッセージは日本語で「なぜ変えたか」を書き、最後に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` を付ける。
- コードのコメントは今のコードと同じく日本語・少なめ。新しいライブラリは足さない。
- PDF（`src/report/pdf.ts`・`pages.ts`）と結果画面の図は今のまま（白地）。緑は新しい引数を渡したときだけ。
- 色：濃い灰色の帯 `#4a4a4a`、帯の文字 `#6fe3cf`、罫線 `#555555`、芝 `#2f8f4e`、表の縞 `#f4f4f4`、レーダー 前半 `#5bc0eb`・後半 `#2ecc71`・全体 `#f39c12`、ロゴ欄の字 `#999999`。
- 列は A〜J の10列、各 72px。行の高さ（px）は設計書の表のとおり。1ページ目の合計 1135、2ページ目の合計 1134。
- タブ名は `M/D vs 相手`（例 `10/19 vs テストFC`）。ファイル名は今の `#番号 名前（チーム名）` のまま。
- 画像の目印（代替テキストのタイトル）：ツールが毎回貼り直すものは `tool:` で始める、ポジション図は `frame:field`。
- PNG は1枚 100万画素未満にする（見出し付きプレーマップは 1.5 倍、ほかは 2 倍で描く）。
- 成功率は「57%」形式、分母0は「-」（`statBlocks` のまま）。

## Review Focus

1. 担当者が空欄に書いたあとで「レポート作成」をもう一度押したとき → 書いた文字・貼った写真が残り、レーダー・プレーマップ・凡例は1枚ずつのまま（2重に貼られない）。Task 5 にテストを足す。
2. 古い受け取り係（貼り替え前）のまま「レポート作成」を押したとき → 「受け取り係（Apps Script）の貼り替えが必要です」と分かる言葉が出る。Task 4 にテストを足す。
3. 後半の記録が0件の選手 → 2nd は印のない緑のピッチ、後半のレーダーは真ん中の点、全体は前半と同じ値。Task 3 にテストを足す。
4. 同じ試合を2回送ったとき → ポジション図（`frame:field`）は1枚のまま。Task 5 にテストを足す。
5. 受け取り係とアプリの版が合わない形（`layout.version` が 1 でない）が届いたとき → 何も書かずにエラーを返す。Task 5 にテストを足す。

---

### Task 1: ピッチ図と凡例を緑のグラウンドでも描けるようにする

**Files:**
- Modify: `src/pitch/sheet.ts`
- Test: `tests/sheet.test.ts`

**Interfaces:**
- Produces: `export type Ground = 'white' | 'green'`、`sheetPitchSvg(o: SheetPitchOptions, ground: Ground = 'white'): string`、`sheetLegendSvg(ground: Ground = 'white'): string`（`LEGEND_SIZE` は変えない）

- [ ] **Step 1: 失敗するテストを書く**（`tests/sheet.test.ts` に追加）

```ts
test('green ground: grass trapezoid, white lines, white pass arrows', () => {
  const z = (lane: number, col: number) => ({ lane, col });
  const svg = sheetPitchSvg({ label: '1st', marks: [], arrows: [
    { from: z(3, 2), to: z(3, 4), kind: 'pass', success: true },
    { from: z(2, 2), to: z(2, 4), kind: 'pass', success: false },
  ] }, 'green');
  expect(svg).toContain('fill="#2f8f4e"');
  expect(svg).toMatch(/<line class="arrow" data-kind="pass" data-ok="1"[^>]*stroke="#ffffff"/);
  expect(svg).toMatch(/<line class="arrow" data-kind="pass" data-ok="0"[^>]*stroke="#ff2a2a"/);
  expect(svg).toMatch(/class="zone-line"[^>]*stroke="#ffffff"/);
  expect(svg).not.toContain('#1fd655');
});

test('white ground stays the same as before', () => {
  const o = { label: '2nd' as const, arrows: [], marks: [] };
  expect(sheetPitchSvg(o)).toBe(sheetPitchSvg(o, 'white'));
  expect(sheetPitchSvg(o)).not.toContain('#2f8f4e');
});

test('green legend: grass background, white text, white pass glyph', () => {
  const svg = sheetLegendSvg('green');
  expect(svg).toMatch(/<rect[^>]*fill="#2f8f4e"/);
  expect(svg).toMatch(/fill="#ffffff">パス</);
  expect(svg).not.toContain('#1fd655');
  expect(sheetLegendSvg()).not.toContain('#2f8f4e');
});
```

- [ ] **Step 2: 失敗を確かめる** — Run: `npx vitest run tests/sheet.test.ts` / Expected: 3件 FAIL

- [ ] **Step 3: 実装する** — `ground` を受け取り、green のときだけ：白い背景の上に台形 `M10 71 L110 71 L87.5 6 L32.5 6 Z`（`project` の四隅）を `#2f8f4e` で塗る、`markings` の線と点・`zoneLines` を白（ゾーン線は `stroke-opacity=".55"`）、成功したパスの色を `#ffffff`（矢印の marker も）。凡例は green のとき全体を芝色の rect で塗り、文字とパスの絵を白に。`LEGEND` は white／green の2つを作っておく。

- [ ] **Step 4: 通ることを確かめる** — Run: `npx vitest run tests/sheet.test.ts` / Expected: PASS（前からのテストも）

- [ ] **Step 5: コミット**

```bash
git add src/pitch/sheet.ts tests/sheet.test.ts
git commit -m "スプレッドシートのプレーマップを見本どおり緑のグラウンドにするため、ピッチ図と凡例を緑でも描けるようにした（PDF は白地のまま）"
```

---

### Task 2: ポジション図・見出し付きプレーマップ・全体のレーダーを描く

**Files:**
- Create: `src/pitch/field.ts`
- Modify: `src/report/radar.ts:17`
- Test: `tests/field.test.ts`（新規）、`tests/radar.test.ts`

**Interfaces:**
- Produces:
  - `positionFieldSvg(): string` — 横向きの緑のグラウンド。viewBox `0 0 115 78`（周りに 5 の余白、105×68 のピッチ）。白い線：外枠・ハーフウェーライン・センターサークル（半径 9.15）・両ペナルティエリア（16.5×40.32）・両ゴールエリア（5.5×18.32）・ゴール（奥行き2）・ペナルティアーク・3つの点。
  - `mapPanelSvg(title: string, mapSvg: string): string` — 720×350。上 20px に帯 `#4a4a4a` と中央に title（`#6fe3cf`、11px）、その下 y=24 に `mapSvg` を幅 490・高さ `round(490*76/120)` で横の真ん中に入れ子にし、全体を `#555555` の 1px 枠で囲む。
  - `radarSvg(v, title: '前半' | '後半' | '全体', color)`

- [ ] **Step 1: 失敗するテストを書く**

```ts
// tests/field.test.ts
import { expect, test } from 'vitest';
import { mapPanelSvg, positionFieldSvg } from '../src/pitch/field';
import { sheetPitchSvg } from '../src/pitch/sheet';

test('position field: green horizontal pitch with white lines', () => {
  const svg = positionFieldSvg();
  expect(svg).toContain('viewBox="0 0 115 78"');
  expect(svg).toMatch(/<rect[^>]*fill="#2f8f4e"/);
  expect(svg).toContain('stroke="#ffffff"');
  expect(svg.match(/<circle/g)!.length).toBeGreaterThanOrEqual(4); // センターサークル＋点3つ
});

test('map panel: band title, nested map, outer border', () => {
  const map = sheetPitchSvg({ label: '1st', arrows: [], marks: [] }, 'green');
  const svg = mapPanelSvg('プレーマップ 1st', map);
  expect(svg).toContain('viewBox="0 0 720 350"');
  expect(svg).toMatch(/<rect[^>]*height="20"[^>]*fill="#4a4a4a"/);
  expect(svg).toContain('>プレーマップ 1st<');
  expect(svg).toMatch(/<svg x="115" y="24" width="490" height="310"/);
  expect(svg).toMatch(/<rect[^>]*fill="none"[^>]*stroke="#555555"/);
});
```

```ts
// tests/radar.test.ts に追加
test('radar: whole-match title', () => {
  expect(radarSvg({ pass: 50, dribble: 50, shot: 50, defense: 50 }, '全体', '#f39c12')).toContain('>全体<');
});
```

- [ ] **Step 2: 失敗を確かめる** — Run: `npx vitest run tests/field.test.ts tests/radar.test.ts` / Expected: FAIL（field.ts が無い、型エラー）

- [ ] **Step 3: 実装する** — `field.ts` に2つの関数。入れ子は `mapSvg` の最初の `<svg ` を `<svg x=".." y="24" width="490" height="310" ` に置き換える。`radar.ts` は title の型を広げるだけ。

- [ ] **Step 4: 通ることを確かめる** — Run: `npx vitest run tests/field.test.ts tests/radar.test.ts` / Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/pitch/field.ts src/report/radar.ts tests/field.test.ts tests/radar.test.ts
git commit -m "見本のポジション図・見出し付きプレーマップ・全体のレーダーをスプレッドシートに貼れるよう、それぞれの絵を描けるようにした"
```

---

### Task 3: タブの形を決める `buildSheetLayout`

**Files:**
- Create: `src/report/sheetLayout.ts`
- Test: `tests/sheetLayout.test.ts`（新規）

**Interfaces:**
- Consumes: `statBlocks(s)`（`src/report/sheetTables.ts`）、`PlayerStats`
- Produces:

```ts
export interface CellStyle { bg?: string; color?: string; bold?: boolean; size?: number; align?: 'left' | 'center' | 'right'; valign?: 'top' | 'middle'; wrap?: boolean }
export interface SheetCell { range: string; value?: string | number; style: CellStyle }   // 範囲が複数セルなら結合する
export interface SheetImage { key: string; col: number; row: number; offsetX: number; offsetY: number; width: number; height: number; pngBase64: string }
export interface SheetPngs { radar1H: string; radar2H: string; radarAll: string; map1st: string; map2nd: string; legend: string; field: string }
export interface SheetLayout {
  version: 1;
  colWidths: number[];     // 10個、すべて 72
  rowHeights: number[];    // 61個
  frame: SheetCell[];      // 新しいタブのときだけ書く（帯・項目名・空欄・ロゴ欄）
  frameImages: SheetImage[];   // [frame:field]
  toolRange: 'A22:J53';    // 送るたびに中身を消して書き直す範囲
  tool: SheetCell[];       // 表のセル
  toolImages: SheetImage[];    // tool:radar-1H, tool:radar-2H, tool:radar-all, tool:map-1st, tool:legend, tool:map-2nd
}
export const ROW_HEIGHTS: readonly number[];   // 行の高さはここ1か所で直せるようにする
export function buildSheetLayout(stats: PlayerStats, png: SheetPngs): SheetLayout;
```

値（設計書の表をそのまま数字にしたもの）：
- `ROW_HEIGHTS`：1行目 40、2行目 22、3〜9行目 28、10〜18行目 22、19行目 3、20行目 187、21行目 3、表（各ブロック：見出し 17・項目名 15・前半後半 15・行 17×行数。ブロックの間 3）、54行目 350、55行目 24、56行目 350、57行目 20、58行目 170、59行目 20、60・61行目 100。
- 表のブロックの行：パス 22〜28、すき間 29、ドリブル 30〜36、すき間 37、守備 38〜44、すき間 45、シュート 46〜53。各ブロックは「見出し A:J（帯・11px）」「成功ラベル A:C／失敗ラベル D:F／総数ラベル G:H／`成功率` I:J（帯）」「`'', 前半, 後半, '', 前半, 後半, 前半, 後半, 前半, 後半`（白）」「行：A 項目名・B,C 成功・D 項目名・E,F 失敗・G,H 総数（0始まりで偶数行は `#f4f4f4`、項目名が7文字以上なら 8px）」「成功率 I・J は項目行を縦に結合、`#f4f4f4`、12px」。
- 帯の書式：`{ bg: '#4a4a4a', color: '#6fe3cf' }`（見出しは size 11）。空欄の書式：`{ wrap: true, valign: 'top', align: 'left' }`。左右の項目名は `align: 'left'`。
- 枠のセル：`D1:G1`（`チームロゴ`、`#999999`・8px・左上）、`A2:B2 写真`／`C2:E2 対戦`／`F2:J2 ポジション`、`A3:B9` 空欄、`C3:C5` 空欄、`D3:D5 vs`（太字 12px）、`E3:E5` 空欄、`C6:E6 スコア`、`C7 1st`・`C8 2nd`・`C9 Total`（帯）と `D7:E7`〜`D9:E9` 空欄、`F3:J9`（`bg: '#2f8f4e'`）、10〜18行目の左右の項目名と空欄（`A:B`／`C:E`／`F:G`／`H:J`）、`A54:J54`・`A56:J56`（白）、`A55:J55`（芝色）、`A57:J57 コメント`、`A58:J58` 空欄、`A59:J59 次節の課題`、`A60 攻`・`B60:J60` 空欄、`A61 守`・`B61:J61` 空欄。
- 画像の置き場所：`frame:field` は F3（offset 37,1、286×194）。`tool:radar-1H` A20（3,10）、`tool:radar-2H` D20（39,10）、`tool:radar-all` H20（3,10）、いずれも 210×168。`tool:map-1st` A54・`tool:map-2nd` A56（0,0、720×350）。`tool:legend` A55（幅 `round(19*LEGEND_SIZE.w/LEGEND_SIZE.h)`、高さ 19、横の真ん中、offsetY 2）。

- [ ] **Step 1: 失敗するテストを書く**

```ts
import { expect, test } from 'vitest';
import { computeStats } from '../src/domain/stats';
import { buildSheetLayout, ROW_HEIGHTS } from '../src/report/sheetLayout';
import { ev } from './helpers';

const png = { radar1H: 'r1', radar2H: 'r2', radarAll: 'ra', map1st: 'm1', map2nd: 'm2', legend: 'lg', field: 'fd' };
const stats = computeStats([
  ev({ half: '1H', subtype: 'forward', success: true }),
  ev({ half: '1H', subtype: 'forward', success: false }),
]);
const L = buildSheetLayout(stats, png);
const at = (cells: { range: string }[], range: string) => cells.find((c) => c.range === range);

test('page sizes: 10 columns of 72px, page1 1135px, page2 1134px', () => {
  expect(L.colWidths).toEqual(Array(10).fill(72));
  expect(ROW_HEIGHTS).toHaveLength(61);
  const sum = (a: number, b: number) => ROW_HEIGHTS.slice(a - 1, b).reduce((x, y) => x + y, 0);
  expect(sum(1, 53)).toBe(1135);
  expect(sum(54, 61)).toBe(1134);
});

test('frame: band labels, blanks and logo box', () => {
  expect(at(L.frame, 'A2:B2')).toMatchObject({ value: '写真', style: { bg: '#4a4a4a', color: '#6fe3cf' } });
  expect(at(L.frame, 'D1:G1')?.value).toBe('チームロゴ');
  expect(at(L.frame, 'C10:E10')).toMatchObject({ style: { wrap: true, valign: 'top' } });
  expect(at(L.frame, 'F15:G15')?.value).toBe('ピッチコンディション');
  expect(at(L.frame, 'B61:J61')).toBeDefined();
  expect(L.frame.every((c) => !/^[A-J](2[2-9]|[34]\d|5[0-3])/.test(c.range))).toBe(true); // 表の範囲には書かない
});

test('tool: pass table from statBlocks, rate merged', () => {
  expect(L.toolRange).toBe('A22:J53');
  expect(at(L.tool, 'A22:J22')?.value).toBe('パス成功率');
  expect(at(L.tool, 'A25')?.value).toBe('前');
  expect(at(L.tool, 'B25')?.value).toBe(1);
  expect(at(L.tool, 'E25')?.value).toBe(1);
  expect(at(L.tool, 'I25:I28')?.value).toBe('50%');
  expect(at(L.tool, 'J25:J28')?.value).toBe('-');
  expect(at(L.tool, 'A46:J46')?.value).toBe('シュート成功率');
});

test('images: keys and places', () => {
  expect(L.frameImages.map((i) => i.key)).toEqual(['frame:field']);
  expect(L.toolImages.map((i) => [i.key, i.col, i.row])).toEqual([
    ['tool:radar-1H', 1, 20], ['tool:radar-2H', 4, 20], ['tool:radar-all', 8, 20],
    ['tool:map-1st', 1, 54], ['tool:legend', 1, 55], ['tool:map-2nd', 1, 56],
  ]);
  expect(L.toolImages.find((i) => i.key === 'tool:map-1st')).toMatchObject({ width: 720, height: 350, pngBase64: 'm1' });
});
```

（Review Focus 3 は Task 4 の `sheetPngs` 側で確かめる。ここでは後半0件でも表が `-` になることを1行足す：`computeStats([])` で `J25:J28` が `'-'`。）

- [ ] **Step 2: 失敗を確かめる** — Run: `npx vitest run tests/sheetLayout.test.ts` / Expected: FAIL（ファイルが無い）

- [ ] **Step 3: 実装する** — `ROW_HEIGHTS` と、列番号・行番号から A1 範囲を作る小さな関数を使って組み立てる。

- [ ] **Step 4: 通ることを確かめる** — Run: `npx vitest run tests/sheetLayout.test.ts` / Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/report/sheetLayout.ts tests/sheetLayout.test.ts
git commit -m "スプレッドシートの形（列幅・行の高さ・枠・表・画像の位置）をアプリ側で決めてテストできるよう、タブの形を組み立てる部品を足した"
```

---

### Task 4: 「レポート作成」で新しい形を送る

**Files:**
- Modify: `src/report/build.ts`、`src/pitch/png.ts`、`src/ui/screens/results.ts:89-96`、`e2e/results.spec.ts:80-92`
- Delete: `src/report/layout.ts`、`tests/layout.test.ts`
- Test: `tests/build.test.ts`

**Interfaces:**
- Consumes: Task 1〜3 の関数
- Produces:
  - `svgPngBase64(svg: string, w: number, h: number, scale: number): Promise<string>`（png.ts、白地、キャンバスは `w*scale`×`h*scale`、ブラウザ専用）
  - `sheetSvgs(events: PlayEvent[], stats: PlayerStats): Record<keyof SheetPngs, { svg: string; w: number; h: number; scale: number }>`（build.ts、純粋。radar 210×168×2、map 720×350×1.5、legend（幅は Task 3 と同じ式）×19×2、field 286×194×2）
  - `sheetNames(m: Match, p: Player, teamName: string): { playerFileName: string; tabName: string }`
  - `sheetError(error: string): string` — `知らない操作です` を含むとき `受け取り係（Apps Script）の貼り替えが必要です。設置手順.md の「受け取り係を新しくする」を見てください`、それ以外はそのまま
  - 送る中身：`{ action: 'buildSheet', playerFileName, tabName, layout }`

- [ ] **Step 1: 失敗するテストを書く**（`tests/build.test.ts` に追加）

```ts
test('sheet names', () => {
  const m = { date: '2026-10-19', opponent: 'テストFC' } as Match;
  expect(sheetNames(m, { number: 10, name: '山田 太郎' } as Player, 'サンプルFC'))
    .toEqual({ playerFileName: '#10 山田 太郎（サンプルFC）', tabName: '10/19 vs テストFC' });
});

test('old receiver error is explained', () => {
  expect(sheetError('知らない操作です: buildSheet')).toContain('貼り替えが必要です');
  expect(sheetError('合言葉が違います')).toBe('合言葉が違います');
});

test('sheet svgs: green maps, three radars, under 1M pixels', () => {
  const evs = [ev({ half: '1H', type: 'pass', success: true })];
  const s = sheetSvgs(evs, computeStats(evs));
  expect(s.map1st.svg).toContain('>プレーマップ 1st<');
  expect(s.map2nd.svg).toContain('#2f8f4e');      // 後半0件でも緑のピッチ
  expect(s.radarAll.svg).toContain('>全体<');
  for (const v of Object.values(s)) expect(v.w * v.scale * v.h * v.scale).toBeLessThan(1_000_000);
});
```

`e2e/results.spec.ts` の「レポート作成」部分を次に置き換える：

```ts
  const reports = bodies.filter((b) => b.action === 'buildSheet') as Record<string, any>[];
  expect(reports).toHaveLength(2);
  expect(reports.map((r) => r.playerFileName).sort()).toEqual(['#10 山田 太郎（サンプルFC）', '#7 佐藤 一郎（サンプルFC）']);
  for (const r of reports) {
    expect(r.tabName).toMatch(/^\d+\/\d+ vs テストFC$/);
    expect(r.layout.version).toBe(1);
    expect(r.layout.toolImages).toHaveLength(6);
    for (const img of [...r.layout.toolImages, ...r.layout.frameImages]) expect(img.pngBase64.startsWith('iVBOR')).toBe(true);
  }
```

- [ ] **Step 2: 失敗を確かめる** — Run: `npx vitest run tests/build.test.ts` / Expected: FAIL

- [ ] **Step 3: 実装する** — `buildReports` は選手ごとに `sheetSvgs` → `svgPngBase64` → `buildSheetLayout` → `postToScript`。失敗の文は `sheetError` を通す。`reportNames`・`ReportPayload`・`buildStatsSheet` の import と `layout.ts`・`tests/layout.test.ts` は消す（`sheetFigures` は PDF でも使うので残す）。`sheetPngBase64` は使われなくなれば消す。

- [ ] **Step 4: 通ることを確かめる** — Run: `npx vitest run && npm run build && npx playwright test e2e/results.spec.ts` / Expected: すべて PASS

- [ ] **Step 5: コミット**

```bash
git add -A src tests e2e
git commit -m "レポート作成で見本の形のタブを作れるよう、スプレッドシートに送る中身を新しい形（buildSheet）に切り替えた。古い受け取り係に送ったときは貼り替えが必要と分かる言葉を出す"
```

---

### Task 5: 受け取り係（Code.gs）を新しい形にする

**Files:**
- Modify: `apps-script/Code.gs`（`buildReport`・`writeStats`・`writeMap`・`IMAGE_STEP_ROWS` を消し、`buildSheet`・`renderSheet`・`applyCell`・`placeImage` を足す。`selfTest` を書き換える）
- Test: `tests/codegs.test.ts`（新規）

**Interfaces:**
- Consumes: Task 3 の `SheetLayout` の JSON
- Produces（Code.gs の関数）：
  - `buildSheet(req)` — `req.layout.version !== 1` なら `throw new Error('受け取り係とツールの版が合いません。受け取り係を新しくしてください')`。`getPlayerFile` → `renderSheet` → 新しいファイルなら他のシートを消す → そのタブを表示。`doPost` の `buildReport` を `buildSheet` に置き換える。
  - `renderSheet(ss, tabName, layout)` → 新しく作ったら true。新しいとき：`insertSheet(tabName, ss.getSheets().length)`、`setHiddenGridlines(true)`、`setColumnWidth`、`setRowHeightsForced(r, 1, h)`、`frame` を当てる、`frameImages` を貼る。いつも：`getRange(toolRange).clearContent()`、`tool` を当てる、`getImages()` のうち代替テキストのタイトルが `tool:` で始まるものを `remove()`、`toolImages` を貼る。
  - `applyCell(sh, c)` — 複数セルなら `merge()`、`value` があれば `setValue`、書式（既定：白地・`#111111`・10px・中央・中段・折り返しなし）、`setBorder(true, true, true, true, null, null, '#555555', SpreadsheetApp.BorderStyle.SOLID)`。
  - `placeImage(sh, im)` — `insertImage(Utilities.newBlob(Utilities.base64Decode(im.pngBase64), 'image/png', im.key + '.png'), im.col, im.row, im.offsetX, im.offsetY)` → `setWidth`・`setHeight`・`setAltTextTitle(im.key)`。

- [ ] **Step 1: 失敗するテストを書く** — Code.gs をまねの部品で動かす。

```ts
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
// fakeSpreadsheet(): getSheetByName / insertSheet / getSheets / deleteSheet を持つ ss と、
// シートごとに values（A1→値）・images（{ key, removed }）・calls（呼ばれた関数名と引数）を記録する簡単なまね。
// getRange(a1) は merge / setValue / setBackground ... / setBorder / clearContent（範囲の values を消す）を持つ。
import { fakeSpreadsheet, fakeGlobals } from './fakeAppsScript';

const gs = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
const load = () => new Function(...Object.keys(fakeGlobals), `${gs}\nreturn { renderSheet, buildSheet };`)(...Object.values(fakeGlobals));
const layout = {
  version: 1, colWidths: Array(10).fill(72), rowHeights: Array(61).fill(20),
  frame: [{ range: 'A2:B2', value: '写真', style: {} }, { range: 'C10:E10', style: { wrap: true } }],
  frameImages: [{ key: 'frame:field', col: 6, row: 3, offsetX: 0, offsetY: 0, width: 10, height: 10, pngBase64: 'AA==' }],
  toolRange: 'A22:J53',
  tool: [{ range: 'A22:J22', value: 'パス成功率', style: {} }],
  toolImages: ['tool:radar-1H', 'tool:map-1st'].map((key) => ({ key, col: 1, row: 20, offsetX: 0, offsetY: 0, width: 10, height: 10, pngBase64: 'AA==' })),
};

test('new tab gets frame, tool cells and all images', () => {
  const { renderSheet } = load();
  const ss = fakeSpreadsheet();
  expect(renderSheet(ss, '10/19 vs テストFC', layout)).toBe(true);
  const sh = ss.getSheetByName('10/19 vs テストFC');
  expect(sh.values.A2).toBe('写真');
  expect(sh.values.A22).toBe('パス成功率');
  expect(sh.liveImages().map((i: { key: string }) => i.key)).toEqual(['frame:field', 'tool:radar-1H', 'tool:map-1st']);
  expect(sh.calls.some((c: { fn: string }) => c.fn === 'setHiddenGridlines')).toBe(true);
});

test('resend keeps staff text and pictures, replaces only tool images', () => {
  const { renderSheet } = load();
  const ss = fakeSpreadsheet();
  renderSheet(ss, 'T', layout);
  const sh = ss.getSheetByName('T');
  sh.values.C10 = '担当者のメモ';
  sh.addUserImage('');                     // 担当者が貼った写真（代替テキストなし）
  expect(renderSheet(ss, 'T', { ...layout, tool: [{ range: 'A22:J22', value: '更新', style: {} }] })).toBe(false);
  expect(sh.values.C10).toBe('担当者のメモ');
  expect(sh.values.A22).toBe('更新');
  expect(sh.liveImages().map((i: { key: string }) => i.key).sort()).toEqual(['', 'frame:field', 'tool:map-1st', 'tool:radar-1H']);
});

test('version mismatch writes nothing', () => {
  const { buildSheet } = load();
  expect(() => buildSheet({ playerFileName: 'x', tabName: 'T', layout: { ...layout, version: 2 } })).toThrow('版が合いません');
});
```

`tests/fakeAppsScript.ts` に `fakeSpreadsheet` と `fakeGlobals`（`SpreadsheetApp.BorderStyle.SOLID`、`Utilities.newBlob`・`base64Decode`、`PropertiesService`・`DriveApp`・`LockService`・`ContentService`・`MimeType`・`Logger` の空のまね）を書く。`buildSheet` の版の確認は `getPlayerFile` より前に行うので、Drive のまねは中身が空でよい。

- [ ] **Step 2: 失敗を確かめる** — Run: `npx vitest run tests/codegs.test.ts` / Expected: FAIL（`renderSheet is not defined`）

- [ ] **Step 3: 実装する** — 上の Interfaces どおり。`selfTest` は、小さな形（ロゴ欄・空欄1つ・表の1セル・1px の画像を `tool:` と `frame:` で1枚ずつ）で `buildSheet` を2回呼び、1回目と2回目の間に空欄へ `selftest` と書き、2回目のあとも残っていれば `OK:`、消えていれば `NG:` をログに出す。記録一覧の確認（`upsertEvent`・`deleteEvent`）は今のまま残す。

- [ ] **Step 4: 通ることを確かめる** — Run: `npx vitest run` / Expected: PASS（`tests/rows.test.ts` の見出しの一致も）

- [ ] **Step 5: コミット**

```bash
git add apps-script/Code.gs tests/codegs.test.ts tests/fakeAppsScript.ts
git commit -m "見本の形のタブを作り、送り直しても担当者の書き込みや写真を消さないよう、受け取り係をツールの決めた形をそのまま当てはめる作りに変えた"
```

---

### Task 6: 説明書を新しい形に合わせ、全体を確かめる

**Files:**
- Modify: `apps-script/設置手順.md`、`docs/使い方.md:57`

- [ ] **Step 1: 設置手順.md に「受け取り係を新しくする」の節を足す** — 手順：script.google.com で「試合分析 受け取り係」を開く → 中央の文字を全部消す（`command + A` → `delete`）→ `/Users/tsurumaruhiroyuki/Desktop/分析スタッツツール/apps-script/Code.gs` の中身を貼る → 保存 → `selfTest` を実行して `OK:` を確かめる → 「デプロイ」→「デプロイを管理」→ 鉛筆のマーク → バージョン「新バージョン」→「デプロイ」（URL は変わらない）。手順5の「レーダーチャートが2つ」の確認は「#0 動作確認（テスト）」に「動作確認」タブができているかの確認に置き換える。
- [ ] **Step 2: PDF の書き出し方を足す** — スプレッドシートの「ファイル」→「ダウンロード」→「PDF」→ 用紙サイズ「A4」、ページの向き「縦向き」、スケール「幅に合わせる」、余白「標準」→「エクスポート」。余白を変えると3ページになることがある、と添える。
- [ ] **Step 3: 使い方.md の57行目** — 「試合ごとに『スタッツ』と『マップ』のタブが増えていきます」を「試合ごとに『10/19 vs ◯◯』のようなタブが1つ増えます。写真・名前などの空欄とコメントは、担当の方がスプレッドシートに直接書き込みます。もう一度『レポート作成』を押しても、書き込んだ内容は消えません」にする。
- [ ] **Step 4: 全体を確かめる** — Run: `npx vitest run && npm run build && npx playwright test` / Expected: すべて PASS
- [ ] **Step 5: コミット**

```bash
git add apps-script/設置手順.md docs/使い方.md
git commit -m "新しい形のスプレッドシートを使い始められるよう、受け取り係の貼り替えと PDF の書き出し方を説明書に書いた"
```

---

### Task 7: ひろきさんと本番で確かめる（人の作業を含む）

- [ ] **Step 1:** ひろきさんに設置手順.md の「受け取り係を新しくする」をしてもらい、`selfTest` のログが `OK:` か聞く。
- [ ] **Step 2:** GitHub への送信（`git push origin public:main`）は、何を送るかを見せて確認を取ってから行う。公開後は「10分待つ → アプリを一覧から上にはじいて完全に閉じる → 開き直す」を案内する（アイコン削除やサイトデータ消去はしない）。
- [ ] **Step 3:** iPad から「レポート作成」→ できたタブを見本と見比べ、印刷設定（A4・縦・幅に合わせる・余白 標準）で「合計：2ページ」か、下の余白が上と同じくらいかを見る。ずれていれば `ROW_HEIGHTS` だけを直して Task 4 の Step 4 からやり直す。
- [ ] **Step 4:** 空欄に文字を入れてから、もう一度「レポート作成」→ 文字が残るかを見る。
- [ ] **Step 5:** 結果を docs や進捗の記録（`.superpowers/sdd/2026-10-22-sheet-handwritten-layout/progress.md`）に書き、実機で見てもらえるまでは「実機では未確認」と伝える。
