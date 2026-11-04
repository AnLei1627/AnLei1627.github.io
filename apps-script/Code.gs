/**
 * 家教預約後端（Google Apps Script，綁在一份 Google 試算表上）
 *
 * GET  → 回傳已被預約的時段（只有時間，不含名字），網頁用來把它們從空檔扣掉
 * POST → 新增一筆預約：檢查有沒有撞期、是不是在開放時段內，寫進試算表並寄信通知
 *
 * 取消預約：把試算表「狀態」欄改成「取消」，那段時間就會重新開放。
 */

const AVAILABILITY_URL = 'https://anlei1627.github.io/availability.json';
const SHEET_NAME = '預約';
const HEADERS = ['送出時間', '學生', '開始（台北）', '結束（台北）', '開始（老師當地）', '學生時區', '狀態', 'start_ms', 'end_ms'];
const COL = { status: 6, start: 7, end: 8 }; // 0-based
const MIN_MS = 60 * 60 * 1000;      // 最短 1 小時
const MAX_MS = 4 * 60 * 60 * 1000;  // 最長 4 小時

function doGet() {
  const now = Date.now();
  const booked = activeBookings_()
    .filter((b) => b.end > now)
    .map((b) => ({ start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString() }));
  return json_({ ok: true, booked });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }

  const name = String(req.name || '').trim().slice(0, 40);
  const start = Date.parse(req.start);
  const end = Date.parse(req.end);
  const viewerTz = String(req.tz || '').slice(0, 64);
  if (!name) return json_({ ok: false, error: 'name' });
  if (!isFinite(start) || !isFinite(end) || end - start < MIN_MS || end - start > MAX_MS || start < Date.now()) {
    return json_({ ok: false, error: 'bad_time' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const avail = JSON.parse(UrlFetchApp.fetch(AVAILABILITY_URL + '?t=' + Date.now()).getContentText());
    const inSlot = slots_(avail).some((s) => s.start <= start && end <= s.end);
    if (!inSlot) return json_({ ok: false, error: 'not_available' });

    const clash = activeBookings_().some((b) => start < b.end && b.start < end);
    if (clash) return json_({ ok: false, error: 'conflict' });

    const tutorTz = avail.timezone || 'Asia/Taipei';
    const fmt = (ms, tz, f) => Utilities.formatDate(new Date(ms), tz, f);
    const row = [
      new Date(),
      name,
      fmt(start, 'Asia/Taipei', 'yyyy-MM-dd (EEE) HH:mm'),
      fmt(end, 'Asia/Taipei', 'HH:mm'),
      fmt(start, tutorTz, 'yyyy-MM-dd (EEE) HH:mm') + ' ' + tutorTz,
      viewerTz,
      '待確認',
      start,
      end,
    ];
    sheet_().appendRow(row);

    const me = Session.getEffectiveUser().getEmail();
    MailApp.sendEmail(me,
      `[家教預約] ${name}｜${row[2]}`,
      [
        `學生：${name}`,
        `台北：${row[2]} – ${row[3]}`,
        `老師當地：${row[4]}`,
        `學生時區：${viewerTz}`,
        '',
        `試算表：${SpreadsheetApp.getActiveSpreadsheet().getUrl()}`,
        '要取消就把「狀態」改成「取消」，那段時間會重新開放。',
      ].join('\n'));

    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function activeBookings_() {
  const values = sheet_().getDataRange().getValues().slice(1);
  return values
    .filter((r) => String(r[COL.status]).trim() !== '取消' && r[COL.start] && r[COL.end])
    .map((r) => ({ start: Number(r[COL.start]), end: Number(r[COL.end]) }));
}

function slots_(avail) {
  return (avail.slots || []).map((s) => {
    const tz = s.tz || avail.timezone || 'Asia/Taipei';
    const start = Utilities.parseDate(`${s.date} ${s.start}`, tz, 'yyyy-MM-dd HH:mm').getTime();
    let end = Utilities.parseDate(`${s.date} ${s.end}`, tz, 'yyyy-MM-dd HH:mm').getTime();
    if (end <= start) end += 24 * 60 * 60 * 1000; // 跨午夜
    return { start, end };
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** 第一次部署前手動跑一次：建立工作表並觸發授權畫面 */
function setup() {
  sheet_();
  Logger.log('OK：' + SpreadsheetApp.getActiveSpreadsheet().getUrl());
}
