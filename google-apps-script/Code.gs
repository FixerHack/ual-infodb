// Бекенд сайту УАЛ Львів (Google Apps Script). Інструкція — у README.md поруч.
//
// Скрипт прив'язаний до таблиці «Бібліотека» і сам створює та веде ще три таблиці:
//   Бібліотека (ця)        — Стан книжок, Журнал
//   УАЛ · Сайт             — Студенти, Логи, Блокування, Посилання, Запити доступу
//   УАЛ · Ф4               — Запити (з причинами, рішення), По днях         — лише для адміністратора
//   УАЛ · Ф4 (публічна)    — Заявки, По днях — без причин                     — можна поділитися зі студентами
// ID нових таблиць зберігаються у властивостях скрипта. Посилання на них — у журналі виконання setup().

const SHEET_LOG = "Журнал";
const SHEET_STATUS = "Стан книжок";
const SHEET_STUDENTS = "Студенти";
const SHEET_EVENTS = "Логи";
const SHEET_BLOCK = "Блокування";
const SHEET_LINKS = "Посилання";
const SHEET_ACCESS = "Запити доступу";
const SHEET_F4 = "Запити";
const SHEET_F4_DAYS = "По днях";
const SHEET_F4_PUB = "Заявки";
const TAKEN = "Взято";
const RETURNED = "Повернено";
const PHONE = "Телефон";
const LAPTOP = "Ноутбук";
const BLOCK_SITE = "Увесь сайт";
const BLOCK_BOOKS = "Лише книжки";
const F4_WAIT = "На розгляді", F4_YES = "Дозволено", F4_NO = "Заборонено";
const ACC_WAIT = "Очікує", ACC_YES = "Підтвердити", ACC_NO = "Відхилити", ACC_DONE = "Підтверджено", ACC_REJ = "Відхилено";
const SITE_URL = "https://fixerhack.github.io/ual-infodb/";

// false — попередити й дозволити підтвердити (з позначкою в журналі);
// true — взагалі не дозволяти брати книжку на чуже ім'я.
const STRICT = false;
const MAX_EVENTS = 5000; // скільки останніх рядків тримати в «Логах»

// Колонки аркуша «Студенти»
const C_NAME = 1, C_PHONE = 2, C_LAPTOP = 3, C_TRIES = 4, C_TRIED_ON = 5, C_LAST = 6, C_RESET = 7, C_BLOCKED = 8,
  C_COUNT = 9, C_BOOKS = 10, C_TOKEN = 11, C_ACCESS = 12;
const STUDENT_HEADERS = ["Студент", "Телефон", "Ноутбук", "Брав(ла) на чужі імена", "На це ім'я пробували", "Остання спроба",
  "Скинути пристрої", "Заблоковано", "Книжок на руках", "Які книжки", "Код доступу", "Доступ"];

const STUDENTS = [
  "Білик Анастасія", "Будзан Олександр", "Буняк Вікторія", "Вусик Євгенія", "Габрикевич Ангеліна",
  "Єфремова Христина", "Карнаух Марк", "Квик Христина", "Кожухалова Анна", "Колісник Максим",
  "Кришень Олександра", "Лазарук Євдокія", "Леончук Варвара", "Мазур Ольга", "Мельник Аріна",
  "Мельникович Ярослав", "Могилевська Вікторія", "Музичук Сергій", "Обідченко Ярослав", "Огірчак Олексій",
  "Пачковська Юлія", "Петров Анна", "Печура Дана", "Попова Дарія", "Ревенко Володимир",
  "Смирнова Таісія", "Соловова Єва", "Терехова Юлія", "Тішенкова Софія", "Ткаченко Марія",
  "Урсу Дмитро", "Федоренко Євгенія", "Христик Анастасія", "Чорна Ярослава", "Чубай Ілля",
  "Шевченко Владислава", "Шило Кіра", "Ящук Анастасія",
];

// ============================================================================
// Таблиці
// ============================================================================
const PROPS = PropertiesService.getScriptProperties();
const memo_ = {};
function lib_() { return SpreadsheetApp.getActive(); }
function open_(key) {
  if (memo_[key] !== undefined) return memo_[key];
  const id = PROPS.getProperty(key);
  let ss = null;
  try { ss = id ? SpreadsheetApp.openById(id) : null; } catch (e) { ss = null; }
  return (memo_[key] = ss);
}
function site_() { return open_("siteId") || lib_(); } // до розділення все лежить в одній таблиці
function f4_() { return open_("f4Id"); }
function f4pub_() { return open_("f4PubId"); }
const siteSheet_ = (name) => site_().getSheetByName(name);

// ============================================================================
// Налаштування. Запусти setup() після вставлення коду. Можна запускати повторно:
// створює лише те, чого ще немає, і не чіпає твоє оформлення.
// ============================================================================
function setup() {
  const lib = lib_();

  // Журнал
  let log = lib.getSheetByName(SHEET_LOG);
  if (!log) {
    log = lib.insertSheet(SHEET_LOG, 0);
    log.appendRow(["Дата", "ID книжки", "Назва", "Студент", "Дія"]);
    log.getRange(1, 1, 1, 5).setFontWeight("bold");
    log.setFrozenRows(1);
    log.getRange("A2:A").setNumberFormat("dd.MM.yyyy HH:mm");
  }
  ["Пристрій", "Браузер", "Попередження"].forEach((h, i) => {
    const cell = log.getRange(1, 6 + i);
    if (!String(cell.getValue()).trim()) cell.setValue(h).setFontWeight("bold");
  });

  splitSite_();
  const site = site_();

  // Студенти — реєстр пристроїв і доступу
  let st = site.getSheetByName(SHEET_STUDENTS);
  if (!st) {
    st = site.insertSheet(SHEET_STUDENTS);
    st.getRange(2, 1, STUDENTS.length, 1).setValues(STUDENTS.map((n) => [n]));
  }
  STUDENT_HEADERS.forEach((h, i) => {
    const cell = st.getRange(1, i + 1);
    if (!String(cell.getValue()).trim()) cell.setValue(h).setFontWeight("bold");
  });
  st.setFrozenRows(1);
  const n = Math.max(st.getLastRow() - 1, 1);
  if (!st.getRange(2, C_RESET).getDataValidation()) st.getRange(2, C_RESET, n, 1).insertCheckboxes();
  if (!st.getRange(2, C_BLOCKED).getDataValidation()) st.getRange(2, C_BLOCKED, n, 1).insertCheckboxes();
  if (st.getColumnWidth(C_BOOKS) < 300) {
    st.setColumnWidth(C_BOOKS, 420);
    st.getRange(2, C_BOOKS, n, 1).setWrap(true).setVerticalAlignment("top");
    st.getRange(2, C_COUNT, n, 1).setHorizontalAlignment("center");
  }
  ensureTokens_();

  // Логи
  if (!site.getSheetByName(SHEET_EVENTS)) {
    const ev = site.insertSheet(SHEET_EVENTS);
    ev.appendRow(["Час", "Подія", "Сторінка / книжка", "Студент", "Пристрій", "Тип пристрою", "Деталі"]);
    ev.getRange(1, 1, 1, 7).setFontWeight("bold");
    ev.setFrozenRows(1);
    ev.getRange("A2:A").setNumberFormat("dd.MM.yyyy HH:mm:ss");
    ev.setColumnWidth(3, 260);
    ev.setColumnWidth(7, 380);
  }

  // Блокування пристроїв
  let bl = site.getSheetByName(SHEET_BLOCK);
  if (!bl) {
    bl = site.insertSheet(SHEET_BLOCK);
    bl.appendRow(["Пристрій", "Причина", "Коли"]);
    bl.getRange(1, 1, 1, 3).setFontWeight("bold");
    bl.setFrozenRows(1);
  }
  if (!String(bl.getRange(1, 4).getValue()).trim()) bl.getRange(1, 4).setValue("Що блокувати").setFontWeight("bold");
  if (!bl.getRange(2, 4).getDataValidation()) {
    bl.getRange("D2:D").setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList([BLOCK_SITE, BLOCK_BOOKS], true).setAllowInvalid(false).build());
  }
  bl.getRange("C2:C").setNumberFormat("dd.MM.yyyy HH:mm");

  // Запити доступу (хто зайшов без особистого посилання)
  if (!site.getSheetByName(SHEET_ACCESS)) {
    const ac = site.insertSheet(SHEET_ACCESS);
    ac.appendRow(["ID", "Час", "Ім'я", "Новий студент", "Пристрій", "Тип пристрою", "Рішення", "Статус"]);
    ac.getRange(1, 1, 1, 8).setFontWeight("bold");
    ac.setFrozenRows(1);
    ac.getRange("B2:B").setNumberFormat("dd.MM.yyyy HH:mm");
    ac.getRange("G2:G").setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList([ACC_WAIT, ACC_YES, ACC_NO], true).setAllowInvalid(false).build());
    ac.setColumnWidth(3, 220);
    ac.hideColumns(1);
  }

  setupF4_();
  applyValidation_();
  bindFromHistory_();
  writeLinks_();
  writeStatus_(loans_());
  installTriggers_();

  const blank = lib.getSheetByName("Аркуш1") || lib.getSheetByName("Sheet1");
  if (blank && blank.getLastRow() === 0 && lib.getSheets().length > 2) lib.deleteSheet(blank);

  Logger.log("Таблиця «Сайт»: " + site.getUrl());
  if (f4_()) Logger.log("Таблиця «Ф4»: " + f4_().getUrl());
  if (f4pub_()) Logger.log("Таблиця «Ф4 (публічна)»: " + f4pub_().getUrl());
}

// Переносимо Студенти / Логи / Блокування в окрему таблицю «УАЛ · Сайт» (лише один раз).
// Спершу копіюємо все, звіряємо кількість рядків — і тільки тоді прибираємо старі аркуші.
function splitSite_() {
  if (PROPS.getProperty("siteId")) return;
  const lib = lib_();
  const site = SpreadsheetApp.create("УАЛ · Сайт");
  const first = site.getSheets()[0];
  const moved = [];
  [SHEET_STUDENTS, SHEET_EVENTS, SHEET_BLOCK].forEach((name) => {
    const sh = lib.getSheetByName(name);
    if (!sh) return;
    const copy = sh.copyTo(site).setName(name);
    if (copy.getLastRow() !== sh.getLastRow() || copy.getLastColumn() !== sh.getLastColumn()) {
      throw new Error("Аркуш «" + name + "» скопіювався не повністю — нічого не видаляю. Спробуй запустити setup ще раз.");
    }
    moved.push(sh);
  });
  if (site.getSheets().length > 1) site.deleteSheet(first);
  else first.setName(SHEET_STUDENTS);
  PROPS.setProperty("siteId", site.getId());
  memo_.siteId = site;
  // Спадний список студентів у журналі посилався на аркуш, який переїжджає — замінюємо на список імен
  const log = lib.getSheetByName(SHEET_LOG);
  if (log) {
    log.getRange("D2:D").setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(students_(), true).setAllowInvalid(false).build());
  }
  moved.forEach((sh) => lib.deleteSheet(sh));
}

// Ф4: приватна таблиця з причинами і публічна — без них
function setupF4_() {
  if (!f4_()) {
    const ss = SpreadsheetApp.create("УАЛ · Ф4");
    const q = ss.getSheets()[0].setName(SHEET_F4);
    q.appendRow(["ID", "Подано", "Студент", "Дата", "Причина", "Рішення", "Коментар"]);
    q.getRange(1, 1, 1, 7).setFontWeight("bold");
    q.setFrozenRows(1);
    q.getRange("B2:B").setNumberFormat("dd.MM.yyyy HH:mm");
    q.getRange("D2:D").setNumberFormat("dd.MM.yyyy (ddd)");
    q.getRange("F2:F").setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList([F4_WAIT, F4_YES, F4_NO], true).setAllowInvalid(false).build());
    q.setColumnWidth(3, 200);
    q.setColumnWidth(4, 130);
    q.setColumnWidth(5, 420);
    q.getRange("E2:E").setWrap(true).setVerticalAlignment("top");
    q.hideColumns(1);
    statusColors_(q, "F2:F");
    const d = ss.insertSheet(SHEET_F4_DAYS);
    d.appendRow(["Дата", "Дозволено", "На розгляді", "Заборонено", "Усього"]);
    d.getRange(1, 1, 1, 5).setFontWeight("bold");
    d.setFrozenRows(1);
    d.setColumnWidth(1, 130);
    d.setColumnWidths(2, 3, 260);
    PROPS.setProperty("f4Id", ss.getId());
    memo_.f4Id = ss;
  }
  if (!f4pub_()) {
    const ss = SpreadsheetApp.create("УАЛ · Ф4 (публічна)");
    const a = ss.getSheets()[0].setName(SHEET_F4_PUB);
    a.appendRow(["Дата", "Студент", "Статус"]);
    a.getRange(1, 1, 1, 3).setFontWeight("bold");
    a.setFrozenRows(1);
    a.setColumnWidth(1, 130);
    a.setColumnWidth(2, 220);
    a.setColumnWidth(3, 140);
    statusColors_(a, "C2:C");
    const d = ss.insertSheet(SHEET_F4_DAYS);
    d.appendRow(["Дата", "Дозволено", "На розгляді"]);
    d.getRange(1, 1, 1, 3).setFontWeight("bold");
    d.setFrozenRows(1);
    d.setColumnWidth(1, 130);
    d.setColumnWidths(2, 2, 300);
    PROPS.setProperty("f4PubId", ss.getId());
    memo_.f4PubId = ss;
  }
  rebuildF4_();
}

function statusColors_(sh, a1) {
  const col = sh.getRange(a1);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(F4_YES).setBackground("#e2f5ea").setFontColor("#1f8a5a").setBold(true).setRanges([col]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(F4_NO).setBackground("#fde8ec").setFontColor("#c4465d").setBold(true).setRanges([col]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(F4_WAIT).setBackground("#fff4d6").setFontColor("#8a6a12").setRanges([col]).build(),
  ]);
}

// Тригери на редагування нових таблиць (простий onEdit працює лише в цій таблиці)
function installTriggers_() {
  const have = ScriptApp.getProjectTriggers().map((t) => t.getHandlerFunction() + "|" + t.getTriggerSourceId());
  [["onLibEdit", lib_().getId()], ["onSiteEdit", PROPS.getProperty("siteId")], ["onF4Edit", PROPS.getProperty("f4Id")]].forEach(([fn, id]) => {
    if (id && have.indexOf(fn + "|" + id) < 0) ScriptApp.newTrigger(fn).forSpreadsheet(id).onEdit().create();
  });
}

// Спадні списки в журналі — лише там, де їх ще немає (щоб не стерти оформлення)
function applyValidation_() {
  const log = lib_().getSheetByName(SHEET_LOG);
  if (!log) return;
  if (!log.getRange("D2").getDataValidation()) {
    log.getRange("D2:D").setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(students_(), true).setAllowInvalid(false).build());
  }
  if (!log.getRange("E2").getDataValidation()) {
    log.getRange("E2:E").setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList([TAKEN, RETURNED], true).setAllowInvalid(false).build());
  }
}

// ============================================================================
// Реєстр студентів, пристроїв і доступу
// ============================================================================
function registry_() {
  const st = siteSheet_(SHEET_STUDENTS);
  const byName = {}, byDevice = {}, byToken = {}, list = [];
  if (st && st.getLastRow() >= 2) {
    st.getRange(2, 1, st.getLastRow() - 1, C_ACCESS).getValues().forEach((r, i) => {
      const name = String(r[C_NAME - 1]).trim();
      if (!name) return;
      const rec = {
        row: i + 2, name,
        phone: String(r[C_PHONE - 1]).trim(), laptop: String(r[C_LAPTOP - 1]).trim(),
        tries: Number(r[C_TRIES - 1]) || 0, triedOn: Number(r[C_TRIED_ON - 1]) || 0,
        blocked: r[C_BLOCKED - 1] === true,
        token: String(r[C_TOKEN - 1]).trim(), access: r[C_ACCESS - 1] === true,
      };
      byName[name] = rec;
      list.push(name);
      if (rec.phone) byDevice[rec.phone] = name;
      if (rec.laptop) byDevice[rec.laptop] = name;
      if (rec.token) byToken[rec.token] = rec;
    });
  }
  return { sheet: st, byName, byDevice, byToken, list };
}

function students_() {
  const list = registry_().list;
  return list.length ? list : STUDENTS;
}

const newToken_ = () => Utilities.getUuid().replace(/-/g, "").slice(0, 16);
const cleanToken_ = (t) => String(t || "").replace(/[^a-z0-9]/gi, "").slice(0, 32);

// Кожному студентові — особистий код доступу; наявним студентам доступ відкритий одразу
function ensureTokens_() {
  const st = siteSheet_(SHEET_STUDENTS);
  if (!st || st.getLastRow() < 2) return;
  const n = st.getLastRow() - 1;
  if (!st.getRange(2, C_ACCESS).getDataValidation()) st.getRange(2, C_ACCESS, n, 1).insertCheckboxes();
  const rows = st.getRange(2, 1, n, C_ACCESS).getValues();
  let changed = false;
  rows.forEach((r) => {
    if (!String(r[C_NAME - 1]).trim()) return;
    if (!String(r[C_TOKEN - 1]).trim()) { r[C_TOKEN - 1] = newToken_(); r[C_ACCESS - 1] = true; changed = true; }
  });
  if (changed) {
    st.getRange(2, C_TOKEN, n, 2).setValues(rows.map((r) => [r[C_TOKEN - 1], r[C_ACCESS - 1] === true]));
  }
}

// Хто ти за кодом доступу: { name, ok } або null
function whoByToken_(token, reg) {
  token = cleanToken_(token);
  if (!token) return null;
  const rec = (reg || registry_()).byToken[token];
  return rec ? { name: rec.name, ok: rec.access && !rec.blocked, rec } : null;
}

// Аркуш «Посилання»: особисте посилання для кожного студента (для адміністратора)
function writeLinks_() {
  const site = site_();
  let sh = site.getSheetByName(SHEET_LINKS);
  if (!sh) {
    sh = site.insertSheet(SHEET_LINKS);
    sh.getRange(1, 1, 1, 3).setValues([["Студент", "Особисте посилання", "Доступ"]]).setFontWeight("bold");
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 220);
    sh.setColumnWidth(2, 520);
  }
  const reg = registry_();
  const rows = reg.list.map((name) => {
    const r = reg.byName[name];
    return [name, r.token ? SITE_URL + "vhid?k=" + r.token : "", r.access ? (r.blocked ? "заблоковано" : "так") : "ні"];
  });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 3).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 3).setValues(rows);
}

const slotCol_ = (type) => (type === PHONE ? C_PHONE : C_LAPTOP);
const typeOf_ = (d) => (d.type === PHONE || d.type === LAPTOP ? d.type : /iPhone|iPad|Android/.test(String(d.ua)) ? PHONE : LAPTOP);

// Прив'язуємо пристрій до студента, якщо відповідний слот (телефон / ноутбук) ще порожній
function bindIfFree_(reg, rec, dev, type, why) {
  if (!dev || !rec || reg.byDevice[dev]) return;
  if (rec[type === PHONE ? "phone" : "laptop"]) return;
  reg.sheet.getRange(rec.row, slotCol_(type)).setValue(dev);
  reg.byDevice[dev] = rec.name;
  logEvent_("Прив'язка пристрою", "", rec.name, dev, type, why);
}

// Закріплюємо пристрої за людьми за історією журналу (лише якщо слот порожній)
function bindFromHistory_() {
  const log = lib_().getSheetByName(SHEET_LOG);
  const reg = registry_();
  if (!reg.sheet || !log || log.getLastRow() < 2 || log.getLastColumn() < 7) return;
  const counts = {};
  log.getRange(2, 1, log.getLastRow() - 1, 7).getValues().forEach((r) => {
    const name = String(r[3]).trim(), dev = String(r[5]).trim();
    if (r[4] !== TAKEN || !name || !dev) return;
    const k = name + "|" + typeOf_({ ua: r[6] });
    (counts[k] = counts[k] || {})[dev] = (counts[k][dev] || 0) + 1;
  });
  Object.keys(counts).forEach((k) => {
    const [name, type] = k.split("|");
    const rec = reg.byName[name];
    if (!rec || rec[type === PHONE ? "phone" : "laptop"]) return;
    const dev = Object.keys(counts[k]).sort((a, b) => counts[k][b] - counts[k][a]).find((x) => !reg.byDevice[x]);
    if (dev) bindIfFree_(reg, rec, dev, type, "з історії журналу");
  });
}

// Що заблоковано для пристрою: "" — нічого, BLOCK_SITE — увесь сайт, BLOCK_BOOKS — лише взяття книжок
function blockOf_(dev) {
  const bl = siteSheet_(SHEET_BLOCK);
  if (!dev || !bl || bl.getLastRow() < 2) return "";
  let res = "";
  bl.getRange(2, 1, bl.getLastRow() - 1, 4).getValues().forEach((r) => {
    if (String(r[0]).trim() !== dev) return;
    const kind = String(r[3]).trim() === BLOCK_BOOKS ? BLOCK_BOOKS : BLOCK_SITE;
    if (kind === BLOCK_SITE || !res) res = kind;
  });
  return res;
}
const isBlockedDevice_ = (dev) => !!blockOf_(dev);

// Перевірка «той самий пристрій — та сама людина». Повертає попередження і, якщо можна, слот для прив'язки.
function checkDevice_(reg, dev, type, name) {
  if (!dev) return { warn: "", owner: "" };
  const owner = reg.byDevice[dev] || "";
  if (owner && owner !== name) {
    return { warn: "Цей пристрій закріплений за «" + owner + "». Ти точно " + name + "?", owner };
  }
  if (!owner) {
    const rec = reg.byName[name];
    const slot = rec ? rec[type === PHONE ? "phone" : "laptop"] : "";
    if (slot && slot !== dev) {
      return {
        warn: "За «" + name + "» закріплений інший " + type.toLowerCase() + ". Якщо це твій новий пристрій — попроси адміністратора скинути прив'язку.",
        owner: "",
      };
    }
    if (rec && !slot) return { warn: "", owner: "", bind: { row: rec.row, col: slotCol_(type) } };
  }
  return { warn: "", owner };
}

// Лічильники спроб у «Студентах»
function recordAttempt_(reg, owner, target, status, increment) {
  if (!reg.sheet) return;
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd.MM HH:mm");
  const o = owner && reg.byName[owner];
  if (o) {
    if (increment) reg.sheet.getRange(o.row, C_TRIES).setValue(o.tries + 1);
    reg.sheet.getRange(o.row, C_LAST).setValue("брав(ла) на «" + target + "» · " + stamp + " · " + status);
  }
  const t = reg.byName[target];
  if (t) {
    if (increment) reg.sheet.getRange(t.row, C_TRIED_ON).setValue(t.triedOn + 1);
    reg.sheet.getRange(t.row, C_LAST).setValue(
      (owner ? "на це ім'я брав(ла) «" + owner + "»" : "на це ім'я брали з чужого пристрою") + " · " + stamp + " · " + status);
  }
}

// ============================================================================
// Запити доступу (вхід без особистого посилання)
// ============================================================================
function accessRows_() {
  const ac = siteSheet_(SHEET_ACCESS);
  if (!ac || ac.getLastRow() < 2) return { sheet: ac, rows: [] };
  return { sheet: ac, rows: ac.getRange(2, 1, ac.getLastRow() - 1, 8).getValues() };
}

// Обробляємо рішення адміністратора в «Запитах доступу»
function processAccess_() {
  const { sheet, rows } = accessRows_();
  if (!sheet) return;
  let reg = registry_();
  rows.forEach((r, i) => {
    const decision = String(r[6]).trim(), status = String(r[7]).trim(), name = String(r[2]).trim();
    if (status === ACC_DONE || status === ACC_REJ || !name) return;
    if (decision === ACC_NO) {
      sheet.getRange(i + 2, 8).setValue(ACC_REJ);
      logEvent_("Доступ відхилено", "", name, r[4], r[5], "");
      return;
    }
    if (decision !== ACC_YES) return;
    let rec = reg.byName[name];
    if (!rec) {                                     // новий студент — дописуємо в «Студенти»
      const st = reg.sheet;
      const row = st.getLastRow() + 1;
      st.getRange(row, C_NAME).setValue(name);
      st.getRange(row, C_RESET).insertCheckboxes();
      st.getRange(row, C_BLOCKED).insertCheckboxes();
      st.getRange(row, C_TOKEN).setValue(newToken_());
      st.getRange(row, C_ACCESS).insertCheckboxes().setValue(true);
      reg = registry_();
      rec = reg.byName[name];
    } else if (!rec.access) {
      reg.sheet.getRange(rec.row, C_ACCESS).setValue(true);
    }
    if (!rec.token) { reg.sheet.getRange(rec.row, C_TOKEN).setValue(newToken_()); reg = registry_(); rec = reg.byName[name]; }
    bindIfFree_(reg, rec, String(r[4]).trim(), String(r[5]).trim() === PHONE ? PHONE : LAPTOP, "підтверджений запит доступу");
    sheet.getRange(i + 2, 8).setValue(ACC_DONE);
    logEvent_("Доступ підтверджено", "", name, r[4], r[5], "");
  });
  writeLinks_();
}

// ============================================================================
// Ф4 — заявки на вільний день
// ============================================================================
const dayKey_ = (d) => Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
function parseDay_(s) {
  const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return isNaN(d) ? null : d;
}

function f4Rows_() {
  const ss = f4_();
  const q = ss && ss.getSheetByName(SHEET_F4);
  if (!q || q.getLastRow() < 2) return [];
  return q.getRange(2, 1, q.getLastRow() - 1, 7).getValues()
    .filter((r) => String(r[2]).trim() && r[3] instanceof Date)
    .map((r) => ({ id: String(r[0]), at: r[1], name: String(r[2]).trim(), date: r[3], reason: String(r[4]),
                   status: [F4_YES, F4_NO].indexOf(String(r[5]).trim()) >= 0 ? String(r[5]).trim() : F4_WAIT, comment: String(r[6] || "") }));
}

// «По днях» у приватній таблиці + обидва аркуші публічної (без причин)
function rebuildF4_() {
  const rows = f4Rows_().sort((a, b) => a.date - b.date || String(a.name).localeCompare(b.name, "uk"));
  const days = {};
  rows.forEach((r) => {
    const k = dayKey_(r.date);
    const d = (days[k] = days[k] || { date: r.date, yes: [], wait: [], no: [] });
    d[r.status === F4_YES ? "yes" : r.status === F4_NO ? "no" : "wait"].push(r.name);
  });
  const list = Object.keys(days).sort().map((k) => days[k]);
  const write = (sh, data, width) => {
    if (!sh) return;
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, width).clearContent();
    if (data.length) {
      sh.getRange(2, 1, data.length, width).setValues(data);
      sh.getRange(2, 1, data.length, 1).setNumberFormat("dd.MM.yyyy (ddd)");
      if (width > 2) sh.getRange(2, 2, data.length, width - 1).setWrap(true).setVerticalAlignment("top");
    }
  };
  const pv = f4_(), pub = f4pub_();
  if (pv) write(pv.getSheetByName(SHEET_F4_DAYS), list.map((d) => [d.date, d.yes.join("\n"), d.wait.join("\n"), d.no.join("\n"), d.yes.length + d.wait.length + d.no.length]), 5);
  if (pub) {
    write(pub.getSheetByName(SHEET_F4_PUB), rows.map((r) => [r.date, r.name, r.status]), 3);
    write(pub.getSheetByName(SHEET_F4_DAYS), list.filter((d) => d.yes.length || d.wait.length).map((d) => [d.date, d.yes.join("\n"), d.wait.join("\n")]), 3);
  }
}

// Заявки конкретного студента (без чужих причин)
function myF4_(name) {
  return f4Rows_().filter((r) => r.name === name).sort((a, b) => b.date - a.date).slice(0, 30)
    .map((r) => ({ date: dayKey_(r.date), status: r.status, reason: r.reason, comment: r.comment }));
}

// ============================================================================
// Логи по сайту
// ============================================================================
function logEvent_(event, page, name, dev, type, details) {
  const ev = siteSheet_(SHEET_EVENTS);
  if (!ev) return;
  ev.appendRow([new Date(), event, String(page || "").slice(0, 200), name || "", dev || "", type || "", String(details || "").slice(0, 300)]);
  const extra = ev.getLastRow() - 1 - MAX_EVENTS;
  if (extra > 50) ev.deleteRows(2, extra);
}

// ============================================================================
// Стан книжок
// ============================================================================
// Поточний стан: для кожної книжки — останній запис «Взято» без «Повернено» після нього.
function loans_() {
  const log = lib_().getSheetByName(SHEET_LOG);
  const loans = {};
  if (!log || log.getLastRow() < 2) return loans;
  log.getRange(2, 1, log.getLastRow() - 1, 5).getValues().forEach(([date, id, , name, act]) => {
    id = String(id).trim();
    if (!id) return;
    if (act === TAKEN) loans[id] = { name: String(name), date: date instanceof Date ? date.toISOString() : "" };
    else if (act === RETURNED) delete loans[id];
  });
  return loans;
}

// Каталог книжок, який надсилає сайт (зберігається у властивостях скрипта)
function catalog_() {
  try { return JSON.parse(PROPS.getProperty("books") || "[]"); } catch (e) { return []; }
}
function saveCatalog_(books) {
  if (!Array.isArray(books) || !books.length) return;
  const clean = books.slice(0, 1000).map((b) => ({
    id: String(b.id || "").slice(0, 100), title: String(b.title || "").slice(0, 200), author: String(b.author || "").slice(0, 200),
  })).filter((b) => b.id);
  PROPS.setProperty("books", JSON.stringify(clean));
}

// Аркуш «Стан книжок». Оформлення — лише при створенні; далі оновлюються тільки значення.
function writeStatus_(loans) {
  const ss = lib_();
  let sh = ss.getSheetByName(SHEET_STATUS);
  if (!sh) sh = createStatusSheet_(ss);
  const books = catalog_();
  const known = {};
  books.forEach((b) => { known[b.id] = true; });
  Object.keys(loans).forEach((id) => { if (!known[id]) books.push({ id, title: id, author: "" }); });
  books.sort((a, b) => a.title.localeCompare(b.title, "uk"));
  const rows = books.map((b) => {
    const l = loans[b.id];
    return [b.title, b.author, l ? "На руках" : "Вільна", l ? l.name : "", l && l.date ? new Date(l.date) : ""];
  });
  sh.getRange(1, 1, 1, 5).setValues([["Книжка", "Автор", "Статус", "У кого", "З якого числа"]]);
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 5).clearContent();
  if (rows.length) {
    sh.getRange(2, 1, rows.length, 5).setValues(rows);
    sh.getRange(2, 5, rows.length, 1).setNumberFormat("dd.MM.yyyy");
  }
  writeStudentBooks_(loans, books);
}

// Колонки «Книжок на руках» і «Які книжки» в аркуші «Студенти»
function writeStudentBooks_(loans, books) {
  const st = siteSheet_(SHEET_STUDENTS);
  if (!st || st.getLastRow() < 2) return;
  // Не перезаписуємо чужі колонки: якщо там уже інший заголовок — нічого не робимо
  const ours = [[C_COUNT, "Книжок на руках"], [C_BOOKS, "Які книжки"]].every(([c, h]) => {
    const cell = st.getRange(1, c), v = String(cell.getValue()).trim();
    if (!v) cell.setValue(h).setFontWeight("bold");
    return !v || v === h;
  });
  if (!ours) return;
  const title = {};
  books.forEach((b) => { title[b.id] = b.title; });
  const byName = {};
  Object.keys(loans).forEach((id) => {
    const n = String(loans[id].name).trim();
    (byName[n] = byName[n] || []).push(title[id] || id);
  });
  const rows = st.getRange(2, C_NAME, st.getLastRow() - 1, 1).getValues().map(([n]) => {
    const list = (byName[String(n).trim()] || []).sort((a, b) => a.localeCompare(b, "uk"));
    return String(n).trim() ? [list.length, list.map((t) => "• " + t).join("\n")] : ["", ""];
  });
  st.getRange(2, C_COUNT, rows.length, 2).setValues(rows);
}

function createStatusSheet_(ss) {
  const sh = ss.insertSheet(SHEET_STATUS, 0);
  sh.getRange(1, 1, 1, 5).setFontWeight("bold");
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 380);
  sh.setColumnWidth(2, 220);
  sh.setColumnWidths(3, 3, 150);
  const col = sh.getRange("C2:C");
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("Вільна").setBackground("#e2f5ea").setFontColor("#1f8a5a").setBold(true).setRanges([col]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo("На руках").setBackground("#fde8ec").setFontColor("#c4465d").setBold(true).setRanges([col]).build(),
  ]);
  return sh;
}

// ============================================================================
// Ручні правки в таблицях
// ============================================================================
// Встановлюваний тригер для цієї таблиці (Бібліотека). Простий onEdit не підходить:
// йому заборонено відкривати інші таблиці, а «Студенти» тепер у «УАЛ · Сайт».
function onLibEdit(e) {
  if (!e || !e.range) return;
  const name = e.range.getSheet().getName();
  if (name === SHEET_LOG) writeStatus_(loans_());
  if (!PROPS.getProperty("siteId")) handleSiteEdit_(e);
}

// Встановлюваний тригер для таблиці «Сайт»
function onSiteEdit(e) { if (e && e.range) handleSiteEdit_(e); }

// Встановлюваний тригер для таблиці «Ф4»: рішення змінилося — оновлюємо «По днях» і публічну таблицю
function onF4Edit(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (sh.getName() !== SHEET_F4) return;
  if (e.range.getColumn() <= 6 && e.range.getLastColumn() >= 6) {
    for (let r = Math.max(e.range.getRow(), 2); r <= e.range.getLastRow(); r++) {
      const v = String(sh.getRange(r, 6).getValue()).trim();
      if (v === F4_YES || v === F4_NO) logEvent_("Ф4: " + v.toLowerCase(), Utilities.formatDate(new Date(sh.getRange(r, 4).getValue()), Session.getScriptTimeZone(), "dd.MM.yyyy"), sh.getRange(r, 3).getValue(), "", "", "");
    }
  }
  rebuildF4_();
}

function handleSiteEdit_(e) {
  const sh = e.range.getSheet();
  const name = sh.getName();
  // Новий рядок у «Блокуванні»: ставимо дату й тип, якщо порожні
  if (name === SHEET_BLOCK && e.range.getColumn() === 1) {
    for (let r = Math.max(e.range.getRow(), 2); r <= e.range.getLastRow(); r++) {
      if (!String(sh.getRange(r, 1).getValue()).trim()) continue;
      if (!sh.getRange(r, 3).getValue()) sh.getRange(r, 3).setValue(new Date());
      if (!String(sh.getRange(r, 4).getValue()).trim()) sh.getRange(r, 4).setValue(BLOCK_SITE);
    }
  }
  if (name === SHEET_STUDENTS) {
    // Галочка «Скинути пристрої» — стираємо прив'язку і знімаємо галочку
    if (e.range.getColumn() <= C_RESET && e.range.getLastColumn() >= C_RESET) {
      for (let r = Math.max(e.range.getRow(), 2); r <= e.range.getLastRow(); r++) {
        const box = sh.getRange(r, C_RESET);
        if (box.getValue() === true) {
          sh.getRange(r, C_PHONE, 1, 2).clearContent();
          box.setValue(false);
          logEvent_("Скидання пристроїв", "", sh.getRange(r, C_NAME).getValue(), "", "", "адміністратор скинув прив'язку");
        }
      }
    }
    // Новий студент, доступ, блокування — оновлюємо коди й «Посилання»
    if (e.range.getColumn() <= C_ACCESS && e.range.getLastColumn() >= C_NAME) { ensureTokens_(); writeLinks_(); }
  }
  if (name === SHEET_ACCESS) processAccess_();
}

// ============================================================================
// Веб-застосунок
// ============================================================================
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
const cleanDev_ = (d) => String(d || "").replace(/[^a-z0-9]/gi, "").slice(0, 24);

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.check) {
    const dev = cleanDev_(p.device);
    const b = blockOf_(dev);
    const who = whoByToken_(p.token);
    return json_({ ok: true, block: b === BLOCK_SITE ? "site" : b ? "books" : "",
                   who: !cleanToken_(p.token) ? "" : who && who.ok ? "ok" : "none", name: who && who.ok ? who.name : "" });
  }
  if (p.students) return json_({ ok: true, students: students_() });
  if (p.req) {                                       // статус запиту доступу
    const id = String(p.req).replace(/[^a-z0-9]/gi, "").slice(0, 40);
    const row = accessRows_().rows.find((r) => String(r[0]) === id);
    if (!row) return json_({ ok: false, error: "Запит не знайдено" });
    const status = String(row[7]).trim();
    if (status === ACC_DONE) {
      const rec = registry_().byName[String(row[2]).trim()];
      return json_({ ok: true, status: "ok", name: rec ? rec.name : "", token: rec ? rec.token : "" });
    }
    return json_({ ok: true, status: status === ACC_REJ ? "rejected" : "pending" });
  }
  if (p.f4) {
    const who = whoByToken_(p.token);
    if (!who || !who.ok) return json_({ ok: false, auth: false, error: "Спершу підтверди, хто ти" });
    return json_({ ok: true, name: who.name, mine: myF4_(who.name) });
  }
  return json_({ ok: true, loans: loans_(), students: students_(), catalog: catalog_().map((b) => b.id).sort().join(",") });
}

function doPost(e) {
  let d = {};
  try { d = JSON.parse(e.postData.contents || "{}"); } catch (err) { return json_({ ok: false, error: "Некоректний запит" }); }
  const dev = cleanDev_(d.device);
  const ua = String(d.ua || "").slice(0, 60);
  const type = typeOf_(d);

  // Перегляд сторінки — просто записуємо в логи
  if (d.action === "view") {
    const who = whoByToken_(d.token);
    logEvent_(blockOf_(dev) === BLOCK_SITE ? "Перегляд (заблоковано)" : "Перегляд", d.page, who ? who.name : "", dev, type, String(d.title || "") + (ua ? " · " + ua : ""));
    return json_({ ok: true });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // Вхід за особистим посиланням
    if (d.action === "claim") {
      const reg = registry_();
      const who = whoByToken_(d.token, reg);
      if (!who) { logEvent_("Невірне посилання", "", "", dev, type, ""); return json_({ ok: false, error: "Посилання недійсне. Попроси нове в адміністратора." }); }
      if (!who.ok) return json_({ ok: false, error: "Доступ для «" + who.name + "» закрито. Звернись до адміністратора." });
      bindIfFree_(reg, who.rec, dev, type, "вхід за особистим посиланням");
      logEvent_("Вхід за посиланням", "", who.name, dev, type, ua);
      return json_({ ok: true, name: who.name });
    }

    // Запит доступу без посилання
    if (d.action === "access") {
      const name = String(d.name || "").replace(/\s+/g, " ").trim().slice(0, 80);
      if (name.length < 3) return json_({ ok: false, error: "Вкажи прізвище та ім'я" });
      if (isBlockedDevice_(dev)) return json_({ ok: false, error: "З цього пристрою доступ заборонено." });
      const reg = registry_();
      const isNew = !reg.byName[name];
      const { sheet, rows } = accessRows_();
      const open = rows.find((r) => String(r[4]) === dev && String(r[2]).trim() === name && !String(r[7]).trim());
      if (open) return json_({ ok: true, req: String(open[0]) });
      const id = newToken_();
      sheet.appendRow([id, new Date(), name, isNew ? "так" : "", dev, type, ACC_WAIT, ""]);
      logEvent_("Запит доступу", "", name, dev, type, isNew ? "нового студента немає у списку" : "");
      return json_({ ok: true, req: id });
    }

    // Ф4: заявка на вільний день
    if (d.action === "f4") {
      const who = whoByToken_(d.token);
      if (!who || !who.ok) return json_({ ok: false, auth: false, error: "Спершу підтверди, хто ти" });
      const day = parseDay_(d.date);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (!day) return json_({ ok: false, error: "Обери дату" });
      if (day < today) return json_({ ok: false, error: "Дата вже минула" });
      const reason = String(d.reason || "").trim().slice(0, 600);
      if (reason.length < 5) return json_({ ok: false, error: "Напиши причину трохи докладніше" });
      if (f4Rows_().some((r) => r.name === who.name && dayKey_(r.date) === dayKey_(day) && r.status !== F4_NO)) {
        return json_({ ok: false, error: "На цей день у тебе вже є заявка", mine: myF4_(who.name) });
      }
      const q = f4_().getSheetByName(SHEET_F4);
      q.appendRow([newToken_(), new Date(), who.name, day, reason, F4_WAIT, ""]);
      logEvent_("Ф4: заявка", Utilities.formatDate(day, Session.getScriptTimeZone(), "dd.MM.yyyy"), who.name, dev, type, "");
      rebuildF4_();
      return json_({ ok: true, mine: myF4_(who.name) });
    }

    if (d.books) saveCatalog_(d.books);
    const log = lib_().getSheetByName(SHEET_LOG);
    const loans = loans_();

    if (d.action === "sync") {
      writeStatus_(loans);
      return json_({ ok: true, loans });
    }

    const id = String(d.bookId || "").trim();
    const title = String(d.title || "").slice(0, 200);
    if (!id || !log) return json_({ ok: false, error: "Не вказано книжку", loans });

    if (d.action === "take") {
      const name = String(d.name || "").trim();
      const reg = registry_();
      const known = reg.list.length ? reg.list : STUDENTS;
      if (known.indexOf(name) < 0) return json_({ ok: false, error: "Такого студента немає в списку", loans });
      if (loans[id]) return json_({ ok: false, error: "Книжку вже взяли: " + loans[id].name, loans });

      if (isBlockedDevice_(dev)) {
        logEvent_("Відмова", title, name, dev, type, "пристрій у списку блокування");
        return json_({ ok: false, error: "З цього пристрою брати книжки заборонено. Звернись до адміністратора.", loans });
      }
      const owner = reg.byDevice[dev];
      if ((reg.byName[name] && reg.byName[name].blocked) || (owner && reg.byName[owner] && reg.byName[owner].blocked)) {
        logEvent_("Відмова", title, name, dev, type, "студента заблоковано");
        return json_({ ok: false, error: "Брати книжки зараз заборонено. Звернись до адміністратора.", loans });
      }

      const chk = checkDevice_(reg, dev, type, name);
      if (chk.warn) {
        if (STRICT) {
          recordAttempt_(reg, chk.owner, name, "заблоковано", true);
          logEvent_("Відмова", title, name, dev, type, chk.warn);
          return json_({ ok: false, error: chk.warn, loans });
        }
        if (!d.confirm) {
          recordAttempt_(reg, chk.owner, name, "попередження", true);
          logEvent_("Попередження", title, name, dev, type, chk.warn);
          return json_({ ok: false, needConfirm: true, warning: chk.warn, loans });
        }
        recordAttempt_(reg, chk.owner, name, "підтверджено", false);
        logEvent_("Підтверджено", title, name, dev, type, chk.warn);
      }

      const now = new Date();
      log.appendRow([now, id, title, name, TAKEN, dev, ua, chk.warn ? "⚠️ Підтверджено: " + chk.warn : ""]);
      if (chk.bind) {
        reg.sheet.getRange(chk.bind.row, chk.bind.col).setValue(dev);
        logEvent_("Прив'язка пристрою", title, name, dev, type, "перше взяття з цього пристрою");
      }
      logEvent_("Взяття", title, name, dev, type, "");
      loans[id] = { name, date: now.toISOString() };
      writeStatus_(loans);
      return json_({ ok: true, loans });
    }

    if (d.action === "return") {
      if (!loans[id]) return json_({ ok: false, error: "Цю книжку ніхто не брав", loans });
      log.appendRow([new Date(), id, title, loans[id].name, RETURNED, dev, ua, ""]);
      logEvent_("Повернення", title, loans[id].name, dev, type, "");
      delete loans[id];
      writeStatus_(loans);
      return json_({ ok: true, loans });
    }

    return json_({ ok: false, error: "Невідома дія", loans });
  } catch (err) {
    try { logEvent_("Помилка", d.title || d.action, d.name, dev, type, err.message); } catch (e2) {}
    return json_({ ok: false, error: "Помилка: " + err.message });
  } finally {
    lock.releaseLock();
  }
}
