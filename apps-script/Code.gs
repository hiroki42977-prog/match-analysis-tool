/**
 * 試合分析ツールの受け取り係（Google Apps Script）
 * iPad のツールから送られた記録を、Google ドライブの「試合分析」フォルダのスプレッドシートに書き込む。
 * 設置の手順は「設置手順.md」を見てください。
 */

const FOLDER_NAME = '試合分析';
const LOG_NAME = '試合分析 記録一覧';
// アプリの src/report/rows.ts と同じ並び（テストで一致を確かめている）
const LOG_HEADERS = ['記録ID', '試合日', '対戦相手', '形式', '前後半', '背番号', '名前', 'プレー', '種類', '足', '成功', '始点レーン', '始点ゾーン', '終点レーン', '終点ゾーン', '向きの手修正', '再生位置（秒）', '映像リンク', '記録日時'];

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
      else if (req.action === 'buildSheet') buildSheet(req);
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

// ツールが決めた形（src/report/sheetLayout.ts の SheetLayout）でタブを作る
function buildSheet(req) {
  const layout = req.layout;
  if (!layout || layout.version !== 1) throw new Error('受け取り係とツールの版が合いません。受け取り係を新しくしてください');
  const file = getPlayerFile(req.playerFileName);
  const ss = file.ss;
  renderSheet(ss, req.tabName, layout);
  const sh = ss.getSheetByName(req.tabName);
  if (file.isNew) {
    ss.getSheets().forEach(function (s) {
      if (s.getName() !== req.tabName) ss.deleteSheet(s);
    });
  }
  ss.setActiveSheet(sh);
  return sh;
}

// 新しく作ったら true。既にあるタブは、ツールの表の範囲と tool: の画像だけを入れ替える
function renderSheet(ss, tabName, layout) {
  let sh = ss.getSheetByName(tabName);
  const isNew = !sh;
  if (isNew) {
    sh = ss.insertSheet(tabName, ss.getSheets().length);
    sh.setHiddenGridlines(true);
    layout.colWidths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
    layout.rowHeights.forEach(function (h, i) { sh.setRowHeightsForced(i + 1, 1, h); });
    layout.frame.forEach(function (c) { applyCell(sh, c); });
    layout.frameImages.forEach(function (im) { placeImage(sh, im); });
  }
  sh.getRange(layout.toolRange).clearContent();
  layout.tool.forEach(function (c) { applyCell(sh, c); });
  sh.getImages().forEach(function (img) {
    if (String(img.getAltTextTitle() || '').indexOf('tool:') === 0) img.remove();
  });
  layout.toolImages.forEach(function (im) { placeImage(sh, im); });
  return isNew;
}

function applyCell(sh, c) {
  const r = sh.getRange(c.range);
  const st = c.style || {};
  if (r.getNumRows() > 1 || r.getNumColumns() > 1) r.merge();
  if (c.value !== undefined && c.value !== null) r.setValue(c.value);
  r.setBackground(st.bg || '#ffffff')
    .setFontColor(st.color || '#111111')
    .setFontWeight(st.bold ? 'bold' : 'normal')
    .setFontSize(st.size || 10)
    .setHorizontalAlignment(st.align || 'center')
    .setVerticalAlignment(st.valign || 'middle')
    .setWrap(!!st.wrap)
    .setBorder(true, true, true, true, null, null, '#555555', SpreadsheetApp.BorderStyle.SOLID);
}

function placeImage(sh, im) {
  const blob = Utilities.newBlob(Utilities.base64Decode(im.pngBase64), 'image/png', im.key + '.png');
  const pic = sh.insertImage(blob, im.col, im.row, im.offsetX, im.offsetY);
  pic.setWidth(im.width);
  pic.setHeight(im.height);
  pic.setAltTextTitle(im.key);
}

/* ---------- 動作確認用（エディタで selfTest を選んで「実行」） ---------- */

function selfTest() {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqPpfDwAE0QIi6aUyqQAAAABJRU5ErkJggg==';
  const img = function (key, col, row) { return { key: key, col: col, row: row, offsetX: 0, offsetY: 0, width: 20, height: 20, pngBase64: png }; };
  const layout = {
    version: 1,
    colWidths: [72, 72, 72, 72, 72, 72, 72, 72, 72, 72],
    rowHeights: [40, 22, 28],
    frame: [
      { range: 'D1:G1', value: 'チームロゴ', style: { color: '#999999', size: 8, align: 'left', valign: 'top' } },
      { range: 'A3:B3', style: { wrap: true, valign: 'top', align: 'left' } },
    ],
    frameImages: [img('frame:field', 6, 3)],
    toolRange: 'A22:J53',
    tool: [{ range: 'A22:C22', value: '動作確認', style: { bold: true } }],
    toolImages: [img('tool:test', 1, 24)],
  };
  const req = { playerFileName: '#0 動作確認（テスト）', tabName: '動作確認', layout: layout };
  const sh = buildSheet(req);
  sh.getRange('A3').setValue('selftest');
  buildSheet(req);
  const kept = sh.getRange('A3').getValue() === 'selftest';
  upsertEvent('selftest-1', ['selftest-1', '2026-01-01', 'テスト', '8人制', '前半', 0, '動作確認', 'パス', '前', '', '成功', 3, 2, 3, 4, '', 12, '', new Date().toISOString()]);
  deleteEvent('selftest-1');
  if (kept) Logger.log('OK: ドライブの「' + FOLDER_NAME + '」フォルダの「#0 動作確認（テスト）」で、送り直しても空欄の書き込みが残りました');
  else Logger.log('NG: 送り直したら空欄の書き込み（selftest）が消えました');
}
