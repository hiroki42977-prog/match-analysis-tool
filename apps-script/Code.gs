/**
 * 試合分析ツールの受け取り係（Google Apps Script）
 * iPad のツールから送られた記録を、Google ドライブの「試合分析」フォルダのスプレッドシートに書き込む。
 * 設置の手順は「設置手順.md」を見てください。
 */

const FOLDER_NAME = '試合分析';
const LOG_NAME = '試合分析 記録一覧';
// アプリの src/report/rows.ts と同じ並び（テストで一致を確かめている）
const LOG_HEADERS = ['記録ID', '試合日', '対戦相手', '形式', '前後半', '背番号', '名前', 'プレー', '種類', '足', '成功', '始点レーン', '始点ゾーン', '終点レーン', '終点ゾーン', '向きの手修正', '再生位置（秒）', '映像リンク', '記録日時'];
const IMAGE_STEP_ROWS = 25;

function doGet() {
  return ContentService.createTextOutput('試合分析の受け取り係は動いています');
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const token = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (!token) return reply({ ok: false, error: '合言葉（TOKEN）が設定されていません' });
    if (req.token !== token) return reply({ ok: false, error: '合言葉が違います' });
    if (req.action === 'ping') return reply({ ok: true });

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      if (req.action === 'upsertEvent') upsertEvent(req.eventId, req.row);
      else if (req.action === 'deleteEvent') deleteEvent(req.eventId);
      else if (req.action === 'buildReport') buildReport(req);
      else return reply({ ok: false, error: '知らない操作です: ' + req.action });
    } finally {
      lock.releaseLock();
    }
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- フォルダとファイル ---------- */

function getFolder() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (e) { /* 消されていたら作り直す */ }
  }
  const folder = DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

function createInFolder(name) {
  const ss = SpreadsheetApp.create(name);
  DriveApp.getFileById(ss.getId()).moveTo(getFolder());
  return ss;
}

function getLogSheet() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('LOG_ID');
  let ss = null;
  if (id) {
    try {
      ss = SpreadsheetApp.openById(id);
    } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = createInFolder(LOG_NAME);
    props.setProperty('LOG_ID', ss.getId());
    const sh = ss.getSheets()[0];
    sh.setName('記録');
    sh.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('B:B').setNumberFormat('@'); // 試合日を日付に変換させない
  }
  return ss.getSheets()[0];
}

/* ---------- 記録一覧 ---------- */

function findRow(sh, eventId) {
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const hit = sh.getRange(2, 1, last - 1, 1).createTextFinder(eventId).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}

function upsertEvent(eventId, row) {
  const sh = getLogSheet();
  const r = findRow(sh, eventId);
  if (r) sh.getRange(r, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
}

function deleteEvent(eventId) {
  const sh = getLogSheet();
  const r = findRow(sh, eventId);
  if (r) sh.deleteRow(r);
}

/* ---------- 選手のレポート ---------- */

function getPlayerFile(name) {
  const files = getFolder().getFilesByName(name);
  while (files.hasNext()) {
    const f = files.next();
    if (f.getMimeType() === MimeType.GOOGLE_SHEETS) return { ss: SpreadsheetApp.openById(f.getId()), isNew: false };
  }
  return { ss: createInFolder(name), isNew: true };
}

function freshSheet(ss, name) {
  const old = ss.getSheetByName(name);
  if (old) ss.deleteSheet(old);
  return ss.insertSheet(name, ss.getSheets().length);
}

function buildReport(req) {
  const file = getPlayerFile(req.playerFileName);
  const ss = file.ss;
  const stats = freshSheet(ss, req.statsTabName);
  writeStats(stats, req.stats);
  const map = freshSheet(ss, req.mapTabName);
  writeMap(map, req.images);
  if (file.isNew) {
    ss.getSheets().forEach(function (sh) {
      if (sh.getName() !== req.statsTabName && sh.getName() !== req.mapTabName) ss.deleteSheet(sh);
    });
  }
  ss.setActiveSheet(stats);
}

function writeStats(sh, s) {
  const values = s.values.map(function (r) { return r.map(function (v) { return v === null ? '' : v; }); });
  sh.getRange(1, 1, values.length, values[0].length).setValues(values);
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  s.percentRanges.forEach(function (a1) { sh.getRange(a1).setNumberFormat('0%'); });
  values.forEach(function (r, i) {
    if (r[1] === '前半' && r[2] === '後半') sh.getRange(i + 1, 1, 1, r.length).setFontWeight('bold').setBackground('#eef1f4');
  });
  sh.setColumnWidth(1, 130);
  sh.setColumnWidth(5, 130);
  sh.setColumnWidth(9, 130);

  // レーダーチャート（前半・後半を別々に）
  const data = sh.getRange(s.radar.dataRange);
  const top = data.getRow();
  const rows = data.getNumRows();
  [['1H', 2, '前半'], ['2H', 3, '後半']].forEach(function (h) {
    const anchor = sh.getRange(s.radar.anchors[h[0]]);
    const chart = sh.newChart()
      .setChartType(Charts.ChartType.RADAR)
      .addRange(sh.getRange(top, 1, rows, 1))
      .addRange(sh.getRange(top, h[1], rows, 1))
      .setNumHeaders(1)
      .setPosition(anchor.getRow(), anchor.getColumn(), 0, 0)
      .setOption('title', h[2] + '（成功率 %）')
      .setOption('legend', { position: 'none' })
      .setOption('vAxis', { minValue: 0, maxValue: 100 })
      .setOption('width', 360)
      .setOption('height', 340)
      .build();
    sh.insertChart(chart);
  });
}

function writeMap(sh, images) {
  sh.setColumnWidth(1, 20);
  images.forEach(function (img, i) {
    const row = 1 + i * IMAGE_STEP_ROWS;
    sh.getRange(row, 2).setValue(img.label).setFontWeight('bold').setFontSize(12);
    const blob = Utilities.newBlob(Utilities.base64Decode(img.pngBase64), 'image/png', 'map' + i + '.png');
    const pic = sh.insertImage(blob, 2, row + 1);
    pic.setWidth(700).setHeight(Math.round(700 * 76 / 113));
  });
}

/* ---------- 動作確認用（エディタで selfTest を選んで「実行」） ---------- */

function selfTest() {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqPpfDwAE0QIi6aUyqQAAAABJRU5ErkJggg==';
  const values = [['動作確認 ｜ テスト'], [], ['項目', '前半', '後半'], ['パス', 80, 60], ['ドリブル', 50, null], ['シュート（枠内）', 100, 0], ['守備', 40, 70]];
  while (values.length < 19) values.push([]);
  values.push(['パス成功', '前半', '後半', null, 'パス失敗', '前半', '後半', null, 'パス成功率', '前半', '後半']);
  values.push(['合計', 8, 6, null, '合計', 2, 4, null, '合計', 0.8, 0.6]);
  const padded = values.map(function (r) { const x = r.slice(); while (x.length < 11) x.push(null); return x; });
  buildReport({
    playerFileName: '#0 動作確認（テスト）',
    statsTabName: '動作確認 スタッツ',
    mapTabName: '動作確認 マップ',
    stats: { values: padded, percentRanges: ['J21:K21'], radar: { dataRange: 'A3:C7', anchors: { '1H': 'E2', '2H': 'I2' } } },
    images: [{ label: 'テスト画像', pngBase64: png }],
  });
  upsertEvent('selftest-1', ['selftest-1', '2026-01-01', 'テスト', '8人制', '前半', 0, '動作確認', 'パス', '前', '', '成功', 3, 2, 3, 4, '', 12, '', new Date().toISOString()]);
  deleteEvent('selftest-1');
  Logger.log('OK: ドライブの「' + FOLDER_NAME + '」フォルダに「#0 動作確認（テスト）」ができていれば成功です');
}
