// Code.gs をテストで動かすための Apps Script のまね。Code.gs が使う分だけ持つ。

type Call = { fn: string; args: unknown[] };
type FakeImage = { key: string; removed: boolean };

// 'B3' → [列, 行]
const cellPos = (a1: string): [number, number] => {
  const m = /^([A-Z]+)(\d+)$/.exec(a1);
  if (!m) throw new Error('まねが読めない範囲: ' + a1);
  const col = m[1].split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  return [col, Number(m[2])];
};
const colName = (c: number): string => (c > 26 ? colName(Math.floor((c - 1) / 26)) : '') + String.fromCharCode(65 + ((c - 1) % 26));

// 'A2:B2' → 左上と右下
const rect = (a1: string) => {
  const [from, to = from] = a1.split(':');
  const [c1, r1] = cellPos(from);
  const [c2, r2] = cellPos(to);
  return { c1, r1, c2, r2 };
};

export class FakeSheet {
  values: Record<string, unknown> = {};
  images: FakeImage[] = [];
  calls: Call[] = [];
  constructor(public name: string) {}

  private log(fn: string, args: unknown[]) {
    this.calls.push({ fn, args });
  }
  getName() { return this.name; }
  setName(name: string) { this.log('setName', [name]); this.name = name; return this; }
  setHiddenGridlines(v: boolean) { this.log('setHiddenGridlines', [v]); return this; }
  widths: Record<number, number> = {};
  setColumnWidth(col: number, px: number) { this.log('setColumnWidth', [col, px]); this.widths[col] = px; return this; }
  // 本物の新しいシートの列幅は 100px
  getColumnWidth(col: number) { return this.widths[col] ?? 100; }
  // 本物の DeveloperMetadata のまね（キーと値だけ）
  meta: { key: string; value: string }[] = [];
  addDeveloperMetadata(key: string, value: string) { this.meta.push({ key, value }); return this; }
  getDeveloperMetadata() {
    return this.meta.map((m) => ({ getKey: () => m.key, getValue: () => m.value, setValue: (v: string) => { m.value = v; } }));
  }
  setRowHeightsForced(row: number, n: number, px: number) { this.log('setRowHeightsForced', [row, n, px]); return this; }

  getRange(a1: string) {
    const sh = this;
    const { c1, r1, c2, r2 } = rect(a1);
    const style = (fn: string) => (...args: unknown[]) => { sh.log(fn, [a1, ...args]); return range; };
    const range = {
      merge: style('merge'),
      breakApart: style('breakApart'),
      setBackground: style('setBackground'),
      setFontColor: style('setFontColor'),
      setFontWeight: style('setFontWeight'),
      setFontSize: style('setFontSize'),
      setHorizontalAlignment: style('setHorizontalAlignment'),
      setVerticalAlignment: style('setVerticalAlignment'),
      setWrap: style('setWrap'),
      setBorder: style('setBorder'),
      setValue(v: unknown) { sh.values[colName(c1) + r1] = v; sh.log('setValue', [a1, v]); return range; },
      clearContent() {
        for (let c = c1; c <= c2; c++) for (let r = r1; r <= r2; r++) delete sh.values[colName(c) + r];
        sh.log('clearContent', [a1]);
        return range;
      },
      getNumRows: () => r2 - r1 + 1,
      getNumColumns: () => c2 - c1 + 1,
    };
    return range;
  }

  insertImage(blob: { name: string }, col: number, row: number, offsetX: number, offsetY: number) {
    this.log('insertImage', [blob.name, col, row, offsetX, offsetY]);
    return this.wrap(this.addUserImage(''));
  }
  getImages() { return this.images.filter((i) => !i.removed).map((i) => this.wrap(i)); }

  // 担当者が貼った写真など、ツールを通らない画像を足す
  addUserImage(key: string): FakeImage {
    const img = { key, removed: false };
    this.images.push(img);
    return img;
  }
  liveImages() { return this.images.filter((i) => !i.removed); }

  private wrap(img: FakeImage) {
    const o = {
      setWidth: () => o,
      setHeight: () => o,
      setAltTextTitle: (t: string) => { img.key = t; return o; },
      getAltTextTitle: () => img.key,
      remove: () => { img.removed = true; },
    };
    return o;
  }
}

export function fakeSpreadsheet() {
  const sheets: FakeSheet[] = [];
  const ss = {
    sheets,
    active: null as FakeSheet | null,
    // 本物は無ければ null を返す。テストで使いやすいよう型は FakeSheet にしておく
    getSheetByName: (name: string): FakeSheet => sheets.find((s) => s.name === name) ?? (null as unknown as FakeSheet),
    insertSheet(name: string, index: number) {
      const sh = new FakeSheet(name);
      sheets.splice(index, 0, sh);
      return sh;
    },
    getSheets: () => sheets.slice(),
    deleteSheet(sh: FakeSheet) { sheets.splice(sheets.indexOf(sh), 1); },
    setActiveSheet(sh: FakeSheet) { ss.active = sh; return sh; },
  };
  return ss;
}

const empty = {};
export const fakeGlobals = {
  SpreadsheetApp: { BorderStyle: { SOLID: 'SOLID' } },
  Utilities: {
    base64Decode: (s: string) => Array.from(Buffer.from(s, 'base64')),
    newBlob: (bytes: number[], mime: string, name: string) => ({ bytes, mime, name }),
  },
  PropertiesService: empty,
  DriveApp: empty,
  LockService: empty,
  ContentService: empty,
  MimeType: empty,
  Logger: { log: () => undefined },
};
