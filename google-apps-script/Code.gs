// Журнал бібліотеки УАЛ Львів — бекенд для сайту.
// Встав цей код у Google Таблицю: Розширення → Apps Script. Інструкція — у README.md поруч.

const SHEET_LOG = "Журнал";
const SHEET_STATUS = "Стан книжок";
const SHEET_STUDENTS = "Студенти";
const SHEET_EVENTS = "Логи";
const SHEET_BLOCK = "Блокування";
const TAKEN = "Взято";
const RETURNED = "Повернено";
const PHONE = "Телефон";
const LAPTOP = "Ноутбук";
const BLOCK_SITE = "Увесь сайт";
const BLOCK_BOOKS = "Лише книжки";

// false — попередити й дозволити підтвердити (з позначкою в журналі);
// true — взагалі не дозволяти брати книжку на чуже ім'я.
const STRICT = false;
const MAX_EVENTS = 5000; // скільки останніх рядків тримати в «Логах»

// Колонки аркуша «Студенти»
const C_NAME = 1, C_PHONE = 2, C_LAPTOP = 3, C_TRIES = 4, C_TRIED_ON = 5, C_LAST = 6, C_RESET = 7, C_BLOCKED = 8;
const STUDENT_HEADERS = ["Студент", "Телефон", "Ноутбук", "Брав(ла) на чужі імена", "На це ім'я пробували", "Остання спроба", "Скинути пристрої", "Заблоковано"];

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
// Налаштування таблиці. Запусти після вставлення коду. Власне оформлення не чіпає:
// додає лише те, чого ще немає.
// ============================================================================
function setup() {
  const ss = SpreadsheetApp.getActive();

  // Журнал
  let log = ss.getSheetByName(SHEET_LOG);
  if (!log) {
    log = ss.insertSheet(SHEET_LOG, 0);
    log.appendRow(["Дата", "ID книжки", "Назва", "Студент", "Дія"]);
    log.getRange(1, 1, 1, 5).setFontWeight("bold");
    log.setFrozenRows(1);
    log.getRange("A2:A").setNumberFormat("dd.MM.yyyy HH:mm");
  }
  ["Пристрій", "Браузер", "Попередження"].forEach((h, i) => {
    const cell = log.getRange(1, 6 + i);
    if (!String(cell.getValue()).trim()) cell.setValue(h).setFontWeight("bold");
  });

  // Студенти — реєстр пристроїв
  let st = ss.getSheetByName(SHEET_STUDENTS);
  if (!st) {
    st = ss.insertSheet(SHEET_STUDENTS);
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

  // Логи
  if (!ss.getSheetByName(SHEET_EVENTS)) {
    const ev = ss.insertSheet(SHEET_EVENTS);
    ev.appendRow(["Час", "Подія", "Сторінка / книжка", "Студент", "Пристрій", "Тип пристрою", "Деталі"]);
    ev.getRange(1, 1, 1, 7).setFontWeight("bold");
    ev.setFrozenRows(1);
    ev.getRange("A2:A").setNumberFormat("dd.MM.yyyy HH:mm:ss");
    ev.setColumnWidth(3, 260);
    ev.setColumnWidth(7, 380);
  }

  // Блокування пристроїв
  let bl = ss.getSheetByName(SHEET_BLOCK);
  if (!bl) {
    bl = ss.insertSheet(SHEET_BLOCK);
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

  applyValidation_();
  bindFromHistory_();
  writeStatus_(loans_());

  const blank = ss.getSheetByName("Аркуш1") || ss.getSheetByName("Sheet1");
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 2) ss.deleteSheet(blank);
}

// Спадні списки в журналі — лише там, де їх ще немає (щоб не стерти оформлення)
function applyValidation_() {
  const ss = SpreadsheetApp.getActive();
  const log = ss.getSheetByName(SHEET_LOG);
  if (!log) return;
  if (!log.getRange("D2").getDataValidation()) {
    const sheet = ss.getSheetByName(SHEET_STUDENTS);
    const who = sheet
      ? SpreadsheetApp.newDataValidation().requireValueInRange(sheet.getRange("A2:A"), true)
      : SpreadsheetApp.newDataValidation().requireValueInList(STUDENTS, true);
    log.getRange("D2:D").setDataValidation(who.setAllowInvalid(false).build());
  }
  if (!log.getRange("E2").getDataValidation()) {
    log.getRange("E2:E").setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList([TAKEN, RETURNED], true).setAllowInvalid(false).build());
  }
}

// ============================================================================
// Реєстр студентів і пристроїв
// ============================================================================
function registry_() {
  const st = SpreadsheetApp.getActive().getSheetByName(SHEET_STUDENTS);
  const byName = {}, byDevice = {}, list = [];
  if (st && st.getLastRow() >= 2) {
    st.getRange(2, 1, st.getLastRow() - 1, C_BLOCKED).getValues().forEach((r, i) => {
      const name = String(r[C_NAME - 1]).trim();
      if (!name) return;
      const rec = {
        row: i + 2, name,
        phone: String(r[C_PHONE - 1]).trim(), laptop: String(r[C_LAPTOP - 1]).trim(),
        tries: Number(r[C_TRIES - 1]) || 0, triedOn: Number(r[C_TRIED_ON - 1]) || 0,
        blocked: r[C_BLOCKED - 1] === true,
      };
      byName[name] = rec;
      list.push(name);
      if (rec.phone) byDevice[rec.phone] = name;
      if (rec.laptop) byDevice[rec.laptop] = name;
    });
  }
  return { sheet: st, byName, byDevice, list };
}

function students_() {
  const list = registry_().list;
  return list.length ? list : STUDENTS;
}

const slotCol_ = (type) => (type === PHONE ? C_PHONE : C_LAPTOP);
const typeOf_ = (d) => (d.type === PHONE || d.type === LAPTOP ? d.type : /iPhone|iPad|Android/.test(String(d.ua)) ? PHONE : LAPTOP);

// Закріплюємо пристрої за людьми за історією журналу (лише якщо слот порожній)
function bindFromHistory_() {
  const log = SpreadsheetApp.getActive().getSheetByName(SHEET_LOG);
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
    if (!dev) return;
    reg.sheet.getRange(rec.row, slotCol_(type)).setValue(dev);
    reg.byDevice[dev] = name;
    logEvent_("Прив'язка пристрою", "", name, dev, type, "з історії журналу");
  });
}

// Що заблоковано для пристрою: "" — нічого, BLOCK_SITE — увесь сайт, BLOCK_BOOKS — лише взяття книжок
function blockOf_(dev) {
  const bl = SpreadsheetApp.getActive().getSheetByName(SHEET_BLOCK);
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
// Логи по сайту
// ============================================================================
function logEvent_(event, page, name, dev, type, details) {
  const ev = SpreadsheetApp.getActive().getSheetByName(SHEET_EVENTS);
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
  const log = SpreadsheetApp.getActive().getSheetByName(SHEET_LOG);
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
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty("books") || "[]"); } catch (e) { return []; }
}
function saveCatalog_(books) {
  if (!Array.isArray(books) || !books.length) return;
  const clean = books.slice(0, 1000).map((b) => ({
    id: String(b.id || "").slice(0, 100), title: String(b.title || "").slice(0, 200), author: String(b.author || "").slice(0, 200),
  })).filter((b) => b.id);
  PropertiesService.getScriptProperties().setProperty("books", JSON.stringify(clean));
}

// Аркуш «Стан книжок». Оформлення — лише при створенні; далі оновлюються тільки значення.
function writeStatus_(loans) {
  const ss = SpreadsheetApp.getActive();
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
// Ручні правки в таблиці
// ============================================================================
function onEdit(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  const name = sh.getName();
  if (name === SHEET_LOG) writeStatus_(loans_());
  // Новий рядок у «Блокуванні»: ставимо дату й тип, якщо порожні
  if (name === SHEET_BLOCK && e.range.getColumn() === 1) {
    for (let r = Math.max(e.range.getRow(), 2); r <= e.range.getLastRow(); r++) {
      if (!String(sh.getRange(r, 1).getValue()).trim()) continue;
      if (!sh.getRange(r, 3).getValue()) sh.getRange(r, 3).setValue(new Date());
      if (!String(sh.getRange(r, 4).getValue()).trim()) sh.getRange(r, 4).setValue(BLOCK_SITE);
    }
  }
  // Галочка «Скинути пристрої» — стираємо прив'язку і знімаємо галочку
  if (name === SHEET_STUDENTS && e.range.getColumn() <= C_RESET && e.range.getLastColumn() >= C_RESET) {
    for (let r = Math.max(e.range.getRow(), 2); r <= e.range.getLastRow(); r++) {
      const box = sh.getRange(r, C_RESET);
      if (box.getValue() === true) {
        sh.getRange(r, C_PHONE, 1, 2).clearContent();
        box.setValue(false);
        logEvent_("Скидання пристроїв", "", sh.getRange(r, C_NAME).getValue(), "", "", "адміністратор скинув прив'язку");
      }
    }
  }
}

// ============================================================================
// Веб-застосунок
// ============================================================================
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.check) {
    const dev = String(p.device || "").replace(/[^a-z0-9]/gi, "").slice(0, 24);
    return json_({ ok: true, block: blockOf_(dev) === BLOCK_SITE ? "site" : blockOf_(dev) ? "books" : "" });
  }
  return json_({ ok: true, loans: loans_(), students: students_(), catalog: catalog_().map((b) => b.id).sort().join(",") });
}

function doPost(e) {
  let d = {};
  try { d = JSON.parse(e.postData.contents || "{}"); } catch (err) { return json_({ ok: false, error: "Некоректний запит" }); }
  const dev = String(d.device || "").replace(/[^a-z0-9]/gi, "").slice(0, 24);
  const ua = String(d.ua || "").slice(0, 60);
  const type = typeOf_(d);

  // Перегляд сторінки — просто записуємо в логи
  if (d.action === "view") {
    logEvent_(blockOf_(dev) === BLOCK_SITE ? "Перегляд (заблоковано)" : "Перегляд", d.page, "", dev, type, String(d.title || "") + (ua ? " · " + ua : ""));
    return json_({ ok: true });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (d.books) saveCatalog_(d.books);
    const log = SpreadsheetApp.getActive().getSheetByName(SHEET_LOG);
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
    try { logEvent_("Помилка", d.title, d.name, dev, type, err.message); } catch (e2) {}
    return json_({ ok: false, error: "Помилка журналу: " + err.message });
  } finally {
    lock.releaseLock();
  }
}
