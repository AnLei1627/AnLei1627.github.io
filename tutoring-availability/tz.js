// 時區工具：公開頁（index.html）與編輯頁（edit.html）共用
const MIN = 60000;

function partsIn(ts, tz) {
  const p = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(ts).forEach(({ type, value }) => { p[type] = value; });
  return p;
}

function offsetMs(ts, tz) {
  const p = partsIn(ts, tz);
  const asUtc = Date.UTC(+p.year, p.month - 1, +p.day, +p.hour % 24, +p.minute);
  return asUtc - Math.floor(ts / MIN) * MIN;
}

// 「某時區的牆上時間」→ 絕對時間戳
function zonedToTs(dateStr, timeStr, tz) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let ts = wall - offsetMs(wall, tz);
  ts = wall - offsetMs(ts, tz); // 第二次修正，處理日光節約切換附近
  return ts;
}

function dayKey(ts, tz) {
  const p = partsIn(ts, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

function hm(ts, tz) {
  const p = partsIn(ts, tz);
  return `${p.hour}:${p.minute}`;
}

function addDays(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function weekdayOf(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = 週日
}

// 一筆時段 → 絕對時間 [start, end)；end 早於 start = 跨午夜
function slotRange(s, defaultTz) {
  const tz = s.tz || defaultTz;
  const start = zonedToTs(s.date, s.start, tz);
  let end = zonedToTs(s.date, s.end, tz);
  if (end <= start) end = zonedToTs(addDays(s.date, 1), s.end, tz);
  return { start, end };
}

function tzLabel(tz) {
  let off = "";
  try {
    off = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" })
      .formatToParts(Date.now()).find((x) => x.type === "timeZoneName").value;
  } catch {}
  return `${tz.replace(/_/g, " ")} (${off})`;
}

const COMMON_TZ = [
  "Asia/Taipei", "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Tokyo", "Asia/Seoul", "Asia/Singapore",
  "Australia/Sydney", "Europe/London", "Europe/Berlin",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Vancouver",
];

function fillTzSelect(sel, current, groupLabels) {
  sel.innerHTML = "";
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Taipei";
  const common = [...new Set([detected, ...COMMON_TZ])];
  const g1 = document.createElement("optgroup");
  g1.label = groupLabels[0];
  common.forEach((tz) => g1.appendChild(new Option(tzLabel(tz), tz)));
  sel.appendChild(g1);
  if (Intl.supportedValuesOf) {
    const g2 = document.createElement("optgroup");
    g2.label = groupLabels[1];
    Intl.supportedValuesOf("timeZone")
      .filter((tz) => !common.includes(tz))
      .forEach((tz) => g2.appendChild(new Option(tz.replace(/_/g, " "), tz)));
    sel.appendChild(g2);
  }
  if (![...sel.options].some((o) => o.value === current)) sel.appendChild(new Option(current, current));
  sel.value = current;
}
