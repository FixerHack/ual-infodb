// Бекенд сайту УАЛ Львів (Google Apps Script). Інструкція — у README.md поруч.
//
// Скрипт прив'язаний до таблиці «Бібліотека» і сам створює та веде ще три таблиці:
//   Бібліотека (ця)        — Стан книжок, Журнал
//   УАЛ · Сайт             — Люди, Пристрої, Логи, Блокування, Запити доступу, Налаштування
//   УАЛ · F4               — Календар, Запити (з причинами, рішення), По днях — лише для адміністрації
//   УАЛ · F4 (публічна)    — Календар, Заявки, По днях — без причин           — можна поділитися зі студентами
// ID нових таблиць зберігаються у властивостях скрипта. Посилання на них — у журналі виконання setup().
//
// Як працює вхід:
//   • у кожної людини є постійне особисте посилання (…/vhid?k=КОД);
//   • відкрив його на пристрої — пристрій додається в «Пристрої» й отримує власний код сесії;
//   • пристроїв на людину не більше за ліміт (колонка «Ліміт пристроїв» або значення з «Налаштувань»);
//   • «Вийти» в «Пристроях» — відключає один пристрій; «Нове посилання» в «Людях» — перевипускає посилання.
// Ролі: Студент — усе; Ментор — усе, але входить лише за особистим посиланням; Адмін — усе + запис книжки на будь-кого.
// F4 у режимі тестування («Налаштування») — лише ментори й адміни.

const SHEET_LOG = "Журнал";
const SHEET_STATUS = "Стан книжок";
const SHEET_PEOPLE = "Люди";
const SHEET_OLD_STUDENTS = "Студенти";
const SHEET_ARCHIVE = "Студенти (архів)";
const SHEET_DEVICES = "Пристрої";
const SHEET_EVENTS = "Логи";
const SHEET_BLOCK = "Блокування";
const SHEET_LINKS = "Посилання";
const SHEET_ACCESS = "Запити доступу";
const SHEET_SETTINGS = "Налаштування";
const SHEET_F4 = "Запити";
const SHEET_F4_DAYS = "По днях";
const SHEET_F4_PUB = "Заявки";
const SHEET_F4_REASONS = "Причини";
const SHEET_F4_CAL = "Календар";
const CAL_WEEKS_BACK = 1, CAL_WEEKS = 6; // минулий тиждень + поточний + 4 наступні
// Колонки «F4 → Запити»
const F4_HEADERS = ["ID", "Подано", "Студент", "Дата", "Причина", "Рішення", "Коментар", "Інших схвалених F4", "Звіт за день", "Звіт подано"];
const F_ID = 1, F_AT = 2, F_NAME = 3, F_DATE = 4, F_REASON = 5, F_STATUS = 6, F_COMMENT = 7, F_COUNT = 8, F_REPORT = 9, F_REPORT_AT = 10;
const F4_OTHER = "Інше";
// Початковий список причин (далі його веде адміністрація в аркуші «Причини»)
const F4_REASONS = [
  "Проєктна діяльність",
  "Домашнє завдання",
  "Індивідуальне завдання для саморозвитку",
  "Індивідуальна рефлексія (узгоджена з персональним ментором)",
  "Зовнішня зустріч / навчання (профільний для студента тренінг, що триває не довше 1 дня)",
  "Навчання в університеті",
  "Робота по департаменту",
  "Екстрене дочитування книги",
  "Підготовка до зовнішніх заходів",
];
const SET_GATE = "Вхід лише для студентів";
const SET_LIMIT = "Пристроїв на людину (за замовчуванням)";
const SET_F4TEST = "F4 — режим тестування";
const TAKEN = "Взято";
const RETURNED = "Повернено";
const PHONE = "Телефон";
const LAPTOP = "Ноутбук";
const BLOCK_SITE = "Увесь сайт";
const BLOCK_BOOKS = "Лише книжки";
const ROLE_STUDENT = "Студент", ROLE_MENTOR = "Ментор", ROLE_ADMIN = "Адмін";
const F4_WAIT = "На розгляді", F4_YES = "Дозволено", F4_NO = "Заборонено";
const ACC_WAIT = "Очікує", ACC_YES = "Підтвердити", ACC_NO = "Відхилити", ACC_DONE = "Підтверджено", ACC_REJ = "Відхилено";
const SITE_URL = "https://fixerhack.github.io/ual-infodb/";
const MAX_EVENTS = 5000;       // скільки останніх рядків тримати в «Логах»
const SEEN_EVERY_MS = 60 * 60 * 1000; // «Востаннє на сайті» оновлюємо не частіше ніж раз на годину

// Колонки аркуша «Люди»
const P_NAME = 1, P_ROLE = 2, P_ACCESS = 3, P_BLOCKED = 4, P_LIMIT = 5, P_DEVICES = 6, P_COUNT = 7, P_BOOKS = 8,
  P_LINK = 9, P_RELINK = 10, P_CODE = 11, P_OLD = 12, P_ACCOUNT = 13;
const ACC_ACTIVE = "Активний", ACC_INACTIVE = "Неактивний";
const PEOPLE_HEADERS = ["Ім'я", "Роль", "Доступ", "Заблоковано", "Ліміт пристроїв", "Пристроїв", "Книжок на руках", "Які книжки",
  "Особисте посилання", "Нове посилання", "Код посилання", "Старий код", "Акаунт"];
// Колонки аркуша «Пристрої»
const D_NAME = 1, D_TYPE = 2, D_UA = 3, D_ADDED = 4, D_SEEN = 5, D_LOGOUT = 6, D_DEV = 7, D_SESSION = 8;
const DEVICE_HEADERS = ["Людина", "Тип", "Браузер", "Додано", "Востаннє на сайті", "Вийти", "Код пристрою", "Сесія"];
// Колонки старого аркуша «Студенти» (для перенесення)
const OLD_NAME = 1, OLD_BLOCKED = 8, OLD_TOKEN = 11, OLD_ACCESS = 12, OLD_INVITE = 13;

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
function site_() { return open_("siteId") || lib_(); }
function f4_() { return open_("f4Id"); }
function f4pub_() { return open_("f4PubId"); }
const siteSheet_ = (name) => site_().getSheetByName(name);

// Кеш читань (CacheService): сайт питає сервер на кожній сторінці, а читати таблиці щоразу — повільно.
// Будь-яка зміна таблиць скриптом або вручну (тригери onSiteEdit/onSiteChange/onLibEdit) кеш скидає;
// про всяк випадок записи живуть щонайбільше CACHE_TTL секунд.
const CACHE_TTL = 300, SITE_KEYS = ["settings", "blocks", "people", "devices"], LIB_KEYS = ["loans"];
const cache_ = () => CacheService.getScriptCache();
function cached_(key, fn) {
  try { const hit = cache_().get(key); if (hit) return JSON.parse(hit); } catch (e) {}
  const v = fn();
  try { cache_().put(key, JSON.stringify(v), CACHE_TTL); } catch (e) {}
  return v;
}
function dropCache_(keys) { try { cache_().removeAll(keys || SITE_KEYS.concat(LIB_KEYS)); } catch (e) {} }
const listRule_ = (items) => SpreadsheetApp.newDataValidation().requireValueInList(items, true).setAllowInvalid(false).build();
const bold_ = (sh, headers) => sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
const stamp_ = (d, f) => Utilities.formatDate(d, Session.getScriptTimeZone(), f || "dd.MM.yyyy HH:mm");

// ============================================================================
// Налаштування. Запусти setup() після вставлення коду. Можна запускати повторно:
// створює лише те, чого ще немає, і не чіпає твоє оформлення.
// ============================================================================
function setup() {
  dropCache_();
  const lib = lib_();

  // Журнал
  let log = lib.getSheetByName(SHEET_LOG);
  if (!log) {
    log = lib.insertSheet(SHEET_LOG, 0);
    bold_(log, ["Дата", "ID книжки", "Назва", "Студент", "Дія", "Пристрій", "Браузер", "Примітка"]);
    log.setFrozenRows(1);
    log.getRange("A2:A").setNumberFormat("dd.MM.yyyy HH:mm");
  }

  splitSite_();
  const site = site_();
  setupPeople_(site);
  setupDevices_(site);

  // Логи
  if (!site.getSheetByName(SHEET_EVENTS)) {
    const ev = site.insertSheet(SHEET_EVENTS);
    bold_(ev, ["Час", "Подія", "Сторінка / книжка", "Людина", "Пристрій", "Тип пристрою", "Деталі"]);
    ev.setFrozenRows(1);
    ev.getRange("A2:A").setNumberFormat("dd.MM.yyyy HH:mm:ss");
    ev.setColumnWidth(3, 260);
    ev.setColumnWidth(7, 380);
  }

  // Блокування пристроїв (за кодом пристрою з «Пристроїв» або «Логів»)
  let bl = site.getSheetByName(SHEET_BLOCK);
  if (!bl) {
    bl = site.insertSheet(SHEET_BLOCK);
    bold_(bl, ["Пристрій", "Причина", "Коли", "Що блокувати"]);
    bl.setFrozenRows(1);
  }
  if (!String(bl.getRange(1, 4).getValue()).trim()) bl.getRange(1, 4).setValue("Що блокувати").setFontWeight("bold");
  if (!bl.getRange(2, 4).getDataValidation()) bl.getRange("D2:D").setDataValidation(listRule_([BLOCK_SITE, BLOCK_BOOKS]));
  bl.getRange("C2:C").setNumberFormat("dd.MM.yyyy HH:mm");

  // Запити доступу (вхід без посилання)
  let ac = site.getSheetByName(SHEET_ACCESS);
  if (!ac) {
    ac = site.insertSheet(SHEET_ACCESS);
    bold_(ac, ["ID", "Час", "Ім'я", "Нова людина", "Пристрій", "Тип пристрою", "Рішення", "Статус", "Сесія"]);
    ac.setFrozenRows(1);
    ac.getRange("B2:B").setNumberFormat("dd.MM.yyyy HH:mm");
    ac.getRange("G2:G").setDataValidation(listRule_([ACC_WAIT, ACC_YES, ACC_NO]));
    ac.setColumnWidth(3, 220);
    ac.hideColumns(1);
  }
  if (!String(ac.getRange(1, 9).getValue()).trim()) ac.getRange(1, 9).setValue("Сесія").setFontWeight("bold");
  ac.hideColumns(9);

  // Налаштування
  let se = site.getSheetByName(SHEET_SETTINGS);
  if (!se) {
    se = site.insertSheet(SHEET_SETTINGS);
    bold_(se, ["Параметр", "Значення", "Пояснення"]);
    se.setColumnWidth(1, 300);
    se.setColumnWidth(3, 520);
    se.setFrozenRows(1);
  }
  const have = se.getLastRow() > 1 ? se.getRange(2, 1, se.getLastRow() - 1, 1).getValues().map((r) => String(r[0]).trim()) : [];
  if (have.indexOf(SET_GATE) < 0) {
    se.appendRow([SET_GATE, "Ні", "Так — без підтвердження особи сайт не відкривається; Ні — відкритий для всіх"]);
    se.getRange(se.getLastRow(), 2).setDataValidation(listRule_(["Так", "Ні"]));
  }
  if (have.indexOf(SET_LIMIT) < 0) {
    se.appendRow([SET_LIMIT, 3, "Скільки пристроїв може додати одна людина за своїм посиланням. Для окремої людини — колонка «Ліміт пристроїв» у «Людях»"]);
  }
  if (have.indexOf(SET_F4TEST) < 0) {
    se.appendRow([SET_F4TEST, "Так", "Так — F4 у розробці: користуються лише ментори й адміни (тестові заявки позначено «ТЕСТ»); Ні — F4 працює для всіх: студентів, менторів і адмінів"]);
    se.getRange(se.getLastRow(), 2).setDataValidation(listRule_(["Так", "Ні"]));
  }

  const links = site.getSheetByName(SHEET_LINKS);   // посилання тепер прямо в «Людях»
  if (links && site.getSheets().length > 1) site.deleteSheet(links);

  setupF4_();
  ensurePeople_();
  journalNames_();
  writeStatus_(loans_());
  installTriggers_();
  dropCache_();

  const blank = lib.getSheetByName("Аркуш1") || lib.getSheetByName("Sheet1");
  if (blank && blank.getLastRow() === 0 && lib.getSheets().length > 2) lib.deleteSheet(blank);

  Logger.log("Таблиця «Сайт»: " + site.getUrl());
  if (f4_()) Logger.log("Таблиця «F4»: " + f4_().getUrl());
  if (f4pub_()) Logger.log("Таблиця «F4 (публічна)»: " + f4pub_().getUrl());
}

// Переносимо аркуші сайту в окрему таблицю «УАЛ · Сайт» (лише один раз).
// Спершу копіюємо все, звіряємо кількість рядків — і тільки тоді прибираємо старі аркуші.
function splitSite_() {
  if (PROPS.getProperty("siteId")) return;
  const lib = lib_();
  const site = SpreadsheetApp.create("УАЛ · Сайт");
  const first = site.getSheets()[0];
  const moved = [];
  [SHEET_OLD_STUDENTS, SHEET_EVENTS, SHEET_BLOCK].forEach((name) => {
    const sh = lib.getSheetByName(name);
    if (!sh) return;
    const copy = sh.copyTo(site).setName(name);
    if (copy.getLastRow() !== sh.getLastRow() || copy.getLastColumn() !== sh.getLastColumn()) {
      throw new Error("Аркуш «" + name + "» скопіювався не повністю — нічого не видаляю. Спробуй запустити setup ще раз.");
    }
    moved.push(sh);
  });
  if (site.getSheets().length > 1) site.deleteSheet(first);
  else first.setName(SHEET_EVENTS);
  PROPS.setProperty("siteId", site.getId());
  memo_.siteId = site;
  const log = lib.getSheetByName(SHEET_LOG);
  if (log) log.getRange("D2:D").setDataValidation(listRule_(STUDENTS));
  moved.forEach((sh) => lib.deleteSheet(sh));
}

// «Люди»: створюємо або переносимо зі старих «Студентів» (старий аркуш ховаємо як архів)
function setupPeople_(site) {
  let pp = site.getSheetByName(SHEET_PEOPLE);
  if (!pp) {
    pp = site.insertSheet(SHEET_PEOPLE, 0);
    bold_(pp, PEOPLE_HEADERS);
    const old = site.getSheetByName(SHEET_OLD_STUDENTS);
    let rows;
    if (old && old.getLastRow() > 1) {
      rows = old.getRange(2, 1, old.getLastRow() - 1, Math.max(OLD_INVITE, old.getLastColumn())).getValues()
        .filter((r) => String(r[OLD_NAME - 1]).trim())
        .map((r) => [String(r[OLD_NAME - 1]).trim(), ROLE_STUDENT, r[OLD_ACCESS - 1] === false ? false : true, r[OLD_BLOCKED - 1] === true,
                     "", "", "", "", "", false, String(r[OLD_INVITE - 1] || "").trim() || newToken_(), String(r[OLD_TOKEN - 1] || "").trim()]);
      old.setName(SHEET_ARCHIVE);
      old.hideSheet();
    } else {
      rows = STUDENTS.map((n) => [n, ROLE_STUDENT, true, false, "", "", "", "", "", false, newToken_(), ""]);
    }
    if (rows.length) pp.getRange(2, 1, rows.length, P_OLD).setValues(rows);
    pp.setFrozenRows(1);
    pp.setColumnWidth(P_NAME, 220);
    pp.setColumnWidth(P_BOOKS, 320);
    pp.setColumnWidth(P_LINK, 420);
    pp.hideColumns(P_CODE, 2);
  }
  PEOPLE_HEADERS.forEach((h, i) => {
    const cell = pp.getRange(1, i + 1);
    if (String(cell.getValue()).trim()) return;
    cell.setValue(h).setFontWeight("bold");
    if (i + 1 === P_ACCOUNT) {                       // колонка «Акаунт» з'явилась уперше — кольори
      const col = pp.getRange(2, P_ACCOUNT, 1000, 1);
      pp.setConditionalFormatRules(pp.getConditionalFormatRules().concat([
        SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(ACC_ACTIVE).setBackground("#e2f5ea").setFontColor("#1f8a5a").setBold(true).setRanges([col]).build(),
        SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(ACC_INACTIVE).setFontColor("#9a9a9a").setRanges([col]).build(),
      ]));
      pp.setColumnWidth(P_ACCOUNT, 120);
    }
  });
  formatPeople_(pp);
}

// Останній рядок «Людей», де є ім'я (галочки в порожніх рядках Google рахує як заповнені)
function lastPersonRow_(pp) {
  if (pp.getLastRow() < 2) return 1;
  const names = pp.getRange(2, P_NAME, pp.getLastRow() - 1, 1).getValues();
  for (let i = names.length - 1; i >= 0; i--) if (String(names[i][0]).trim()) return i + 2;
  return 1;
}

// Роль-список, галочки й перенесення тексту — для всіх рядків з іменами (і для щойно доданих)
function formatPeople_(pp) {
  const n = lastPersonRow_(pp) - 1;
  if (n < 1) return;
  pp.getRange(2, P_ROLE, n, 1).setDataValidation(listRule_([ROLE_STUDENT, ROLE_MENTOR, ROLE_ADMIN]));
  [P_ACCESS, P_BLOCKED, P_RELINK].forEach((c) => pp.getRange(2, c, n, 1).insertCheckboxes());
  pp.getRange(2, P_BOOKS, n, 1).setWrap(true).setVerticalAlignment("top");
}

function setupDevices_(site) {
  if (site.getSheetByName(SHEET_DEVICES)) return;
  const dv = site.insertSheet(SHEET_DEVICES);
  bold_(dv, DEVICE_HEADERS);
  dv.setFrozenRows(1);
  dv.getRange("D2:E").setNumberFormat("dd.MM.yyyy HH:mm");
  dv.setColumnWidth(D_NAME, 220);
  dv.setColumnWidth(D_UA, 180);
  dv.hideColumns(D_SESSION);
}

// F4: приватна таблиця з причинами і публічна — без них
function setupF4_() {
  if (!f4_()) {
    const ss = SpreadsheetApp.create("УАЛ · F4");
    const q = ss.getSheets()[0].setName(SHEET_F4);
    bold_(q, F4_HEADERS.slice(0, 7));
    q.setFrozenRows(1);
    q.getRange("B2:B").setNumberFormat("dd.MM.yyyy HH:mm");
    q.getRange("D2:D").setNumberFormat("dd.MM.yyyy (ddd)");
    q.getRange("F2:F").setDataValidation(listRule_([F4_WAIT, F4_YES, F4_NO]));
    q.setColumnWidth(3, 200);
    q.setColumnWidth(4, 130);
    q.setColumnWidth(5, 420);
    q.getRange("E2:E").setWrap(true).setVerticalAlignment("top");
    q.hideColumns(1);
    statusColors_(q, "F2:F");
    const d = ss.insertSheet(SHEET_F4_DAYS);
    bold_(d, ["Дата", "Дозволено", "На розгляді", "Заборонено", "Усього"]);
    d.setFrozenRows(1);
    d.setColumnWidth(1, 130);
    d.setColumnWidths(2, 3, 260);
    PROPS.setProperty("f4Id", ss.getId());
    memo_.f4Id = ss;
  }
  if (!f4pub_()) {
    const ss = SpreadsheetApp.create("УАЛ · F4 (публічна)");
    const a = ss.getSheets()[0].setName(SHEET_F4_PUB);
    bold_(a, ["Дата", "Студент", "Статус"]);
    a.setFrozenRows(1);
    a.setColumnWidth(1, 130);
    a.setColumnWidth(2, 220);
    a.setColumnWidth(3, 140);
    statusColors_(a, "C2:C");
    const d = ss.insertSheet(SHEET_F4_DAYS);
    bold_(d, ["Дата", "Дозволено", "На розгляді"]);
    d.setFrozenRows(1);
    d.setColumnWidth(1, 130);
    d.setColumnWidths(2, 2, 300);
    PROPS.setProperty("f4PubId", ss.getId());
    memo_.f4PubId = ss;
  }
  // нові колонки «Запитів» (кількість схвалених, звіт) — і для вже створеної таблиці
  const q = f4_().getSheetByName(SHEET_F4);
  if (q) {
    F4_HEADERS.forEach((h, i) => {
      const cell = q.getRange(1, i + 1);
      if (!String(cell.getValue()).trim()) cell.setValue(h).setFontWeight("bold");
    });
    q.getRange(2, F_REPORT_AT, 1000, 1).setNumberFormat("dd.MM.yyyy HH:mm");
    q.getRange(2, F_REPORT, 1000, 1).setWrap(true).setVerticalAlignment("top");
    q.setColumnWidth(F_COUNT, 150);
    q.setColumnWidth(F_REPORT, 420);
  }
  // «Причини»: список, з якого обирають на сайті (плюс завжди є «Інше» з власним текстом)
  let rs = f4_().getSheetByName(SHEET_F4_REASONS);
  if (!rs) {
    rs = f4_().insertSheet(SHEET_F4_REASONS);
    bold_(rs, ["Причина"]);
    rs.setColumnWidth(1, 560);
    rs.getRange(1, 3).setValue("Кожна причина — окремий рядок у колонці A. На сайті до списку автоматично додається «Інше» з полем для власного тексту.");
  }
  if (rs.getLastRow() < 2 || !f4Reasons_().length) rs.getRange(2, 1, F4_REASONS.length, 1).setValues(F4_REASONS.map((x) => [x]));
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

// Тригери на редагування (простий onEdit не може відкривати інші таблиці)
function installTriggers_() {
  const have = ScriptApp.getProjectTriggers().map((t) => t.getHandlerFunction() + "|" + t.getTriggerSourceId());
  [["onLibEdit", lib_().getId()], ["onSiteEdit", PROPS.getProperty("siteId")], ["onF4Edit", PROPS.getProperty("f4Id")]].forEach(([fn, id]) => {
    if (id && have.indexOf(fn + "|" + id) < 0) ScriptApp.newTrigger(fn).forSpreadsheet(id).onEdit().create();
  });
  // щоночі зсуваємо «Календар» F4 на новий день
  if (!ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === "onF4Daily"))
    ScriptApp.newTrigger("onF4Daily").timeBased().everyDays(1).atHour(0).nearMinute(5).create();
  const sid = PROPS.getProperty("siteId");
  if (sid && have.indexOf("onSiteChange|" + sid) < 0) ScriptApp.newTrigger("onSiteChange").forSpreadsheet(sid).onChange().create();
}

// Спадний список імен у журналі (оновлюється разом зі списком людей)
function journalNames_() {
  const log = lib_().getSheetByName(SHEET_LOG);
  if (!log) return;
  log.getRange("D2:D").setDataValidation(listRule_(people_().list.concat(["—"])));
  if (!log.getRange("E2").getDataValidation()) log.getRange("E2:E").setDataValidation(listRule_([TAKEN, RETURNED]));
}

// ============================================================================
// Люди, пристрої, сесії
// ============================================================================
const newToken_ = () => Utilities.getUuid().replace(/-/g, "").slice(0, 16);
const cleanToken_ = (t) => String(t || "").replace(/[^a-z0-9]/gi, "").slice(0, 32);
const cleanDev_ = (d) => String(d || "").replace(/[^a-z0-9]/gi, "").slice(0, 24);
const typeOf_ = (d) => (d.type === PHONE || d.type === LAPTOP ? d.type : /iPhone|iPad|Android/.test(String(d.ua)) ? PHONE : LAPTOP);

function settings_() {
  return cached_("settings", () => {
    const se = siteSheet_(SHEET_SETTINGS), out = {};
    if (se && se.getLastRow() > 1) se.getRange(2, 1, se.getLastRow() - 1, 2).getValues().forEach((r) => { out[String(r[0]).trim()] = r[1]; });
    return out;
  });
}
const gateOn_ = () => String(settings_()[SET_GATE] || "").trim() === "Так";
const f4Test_ = () => String(settings_()[SET_F4TEST] == null ? "Так" : settings_()[SET_F4TEST]).trim() !== "Ні";
// Хто може подавати F4: у тестовому режимі — ментори й адміни, у робочому — усі
const f4Allowed_ = (role, test) => !test || role === ROLE_ADMIN || role === ROLE_MENTOR;
const defaultLimit_ = () => { const v = Number(settings_()[SET_LIMIT]); return v > 0 ? Math.floor(v) : 3; };

function people_() {
  const byName = {}, byCode = {}, byOld = {}, list = [], choose = [];
  const def = defaultLimit_();
  const raw = cached_("people", () => {
    const pp = siteSheet_(SHEET_PEOPLE), last = pp ? lastPersonRow_(pp) : 1;
    return last >= 2 ? pp.getRange(2, 1, last - 1, P_OLD).getValues() : [];
  });
  {
    raw.forEach((r, i) => {
      const name = String(r[P_NAME - 1]).trim();
      if (!name) return;
      const lim = Number(r[P_LIMIT - 1]);
      const role = String(r[P_ROLE - 1]).trim();
      const rec = {
        row: i + 2, name, role: role === ROLE_MENTOR || role === ROLE_ADMIN ? role : ROLE_STUDENT,
        access: r[P_ACCESS - 1] !== false, blocked: r[P_BLOCKED - 1] === true, limit: lim > 0 ? Math.floor(lim) : def,
        code: String(r[P_CODE - 1]).trim(), old: String(r[P_OLD - 1]).trim(),
      };
      rec.ok = rec.access && !rec.blocked;
      byName[name] = rec;
      list.push(name);
      if (rec.role !== ROLE_MENTOR) choose.push(name);   // ментори входять лише за своїм посиланням
      if (rec.code) byCode[rec.code] = rec;
      if (rec.old) byOld[rec.old] = rec;
    });
  }
  return { get sheet() { return siteSheet_(SHEET_PEOPLE); }, byName, byCode, byOld, list, choose };
}

function devices_() {
  const rows = [], bySession = {};
  const raw = cached_("devices", () => {
    const dv = siteSheet_(SHEET_DEVICES);
    if (!dv || dv.getLastRow() < 2) return [];
    return dv.getRange(2, 1, dv.getLastRow() - 1, D_SESSION).getValues()
      .map((r) => r.map((v) => (v instanceof Date ? { t: v.getTime() } : v)));
  });
  {
    raw.forEach((r, i) => {
      const seen = r[D_SEEN - 1] && r[D_SEEN - 1].t ? new Date(r[D_SEEN - 1].t) : r[D_SEEN - 1];
      const d = { row: i + 2, name: String(r[D_NAME - 1]).trim(), type: r[D_TYPE - 1], seen,
                  dev: String(r[D_DEV - 1]).trim(), session: String(r[D_SESSION - 1]).trim() };
      if (!d.name || !d.session) return;
      rows.push(d);
      bySession[d.session] = d;
    });
  }
  return { get sheet() { return siteSheet_(SHEET_DEVICES); }, rows, bySession };
}
const activeCount_ = (devs, name) => devs.rows.filter((d) => d.name === name).length;

// Новий пристрій людини → рядок у «Пристроях» і власний код сесії. Той самий пристрій вдруге не рахується.
function addDevice_(person, dev, type, ua, why, devs) {
  devs = devs || devices_();
  const same = dev && devs.rows.find((d) => d.name === person.name && d.dev === dev);
  if (same) return same.session;
  const session = newToken_(), now = new Date();
  const sh = devs.sheet;
  sh.appendRow([person.name, type, ua, now, now, false, dev, session]);
  sh.getRange(sh.getLastRow(), D_LOGOUT).insertCheckboxes();
  dropCache_(["devices"]);
  logEvent_("Новий пристрій", "", person.name, dev, type, why);
  countDevices_();
  return session;
}

// Хто ти за кодом сесії. Старі коди (з першої версії входу) приймаємо й міняємо на сесію пристрою.
function whoBySession_(token, dev, type, ua) {
  token = cleanToken_(token);
  if (!token) return null;
  const devs = devices_(), ppl = people_();
  const d = devs.bySession[token];
  if (!d) {
    const legacy = ppl.byOld[token];
    if (!legacy) return null;
    const fresh = addDevice_(legacy, dev || "", type || LAPTOP, ua || "", "перенесено зі старого входу", devs);
    return { name: legacy.name, role: legacy.role, ok: legacy.ok, rec: legacy, newToken: fresh };
  }
  const rec = ppl.byName[d.name];
  if (!rec) return null;
  if (!(d.seen instanceof Date) || Date.now() - d.seen.getTime() > SEEN_EVERY_MS) {
    const sh = devs.sheet;                         // рядок із кешу — перевіряємо, що це той самий пристрій
    if (String(sh.getRange(d.row, D_SESSION).getValue()).trim() === token) sh.getRange(d.row, D_SEEN).setValue(new Date());
    dropCache_(["devices"]);
  }
  return { name: rec.name, role: rec.role, ok: rec.ok, rec, device: d };
}

// Коди посилань, ролі, галочки, посилання й кількість пристроїв — для всіх людей
function ensurePeople_() {
  const pp = siteSheet_(SHEET_PEOPLE);
  if (!pp || lastPersonRow_(pp) < 2) return;
  formatPeople_(pp);
  const n = lastPersonRow_(pp) - 1;
  const rows = pp.getRange(2, 1, n, P_OLD).getValues();
  rows.forEach((r) => {
    const name = String(r[P_NAME - 1]).trim();
    if (!name) { r[P_LINK - 1] = ""; return; }
    if (!String(r[P_ROLE - 1]).trim()) r[P_ROLE - 1] = ROLE_STUDENT;
    if (!String(r[P_CODE - 1]).trim()) { r[P_CODE - 1] = newToken_(); r[P_ACCESS - 1] = true; }   // нова людина
    if (r[P_RELINK - 1] === true) {                        // «Нове посилання»: старе перестає працювати
      r[P_CODE - 1] = newToken_();
      logEvent_("Нове посилання", "", name, "", "", "адміністратор перевипустив посилання");
    }
    r[P_RELINK - 1] = false;
    if (r[P_ACCESS - 1] !== true && r[P_ACCESS - 1] !== false) r[P_ACCESS - 1] = true;
    if (r[P_BLOCKED - 1] !== true) r[P_BLOCKED - 1] = false;
    r[P_LINK - 1] = SITE_URL + "vhid?k=" + r[P_CODE - 1];
  });
  pp.getRange(2, P_ROLE, n, 3).setValues(rows.map((r) => [r[P_ROLE - 1], r[P_ACCESS - 1], r[P_BLOCKED - 1]]));
  pp.getRange(2, P_LINK, n, 3).setValues(rows.map((r) => [r[P_LINK - 1], r[P_RELINK - 1], r[P_CODE - 1]]));
  dropCache_(["people"]);
  countDevices_();
}

function countDevices_() {
  const pp = siteSheet_(SHEET_PEOPLE);
  const last = pp ? lastPersonRow_(pp) : 1;
  if (last < 2) return;
  const cnt = {};
  devices_().rows.forEach((d) => { cnt[d.name] = (cnt[d.name] || 0) + 1; });
  const names = pp.getRange(2, P_NAME, last - 1, 1).getValues();
  pp.getRange(2, P_DEVICES, names.length, 1).setValues(names.map(([nm]) => [String(nm).trim() ? cnt[String(nm).trim()] || 0 : ""]));
  // «Акаунт»: активний, якщо людина вже ввійшла хоч з одного пристрою
  pp.getRange(2, P_ACCOUNT, names.length, 1).setValues(names.map(([nm]) => [!String(nm).trim() ? "" : cnt[String(nm).trim()] ? ACC_ACTIVE : ACC_INACTIVE]));
}

// Що заблоковано для пристрою: "" — нічого, BLOCK_SITE — увесь сайт, BLOCK_BOOKS — лише книжки
function blockOf_(dev) {
  if (!dev) return "";
  const map = cached_("blocks", () => {
    const bl = siteSheet_(SHEET_BLOCK), out = {};
    if (!bl || bl.getLastRow() < 2) return out;
    bl.getRange(2, 1, bl.getLastRow() - 1, 4).getValues().forEach((r) => {
      const d = String(r[0]).trim();
      if (!d) return;
      const kind = String(r[3]).trim() === BLOCK_BOOKS ? BLOCK_BOOKS : BLOCK_SITE;
      if (kind === BLOCK_SITE || !out[d]) out[d] = kind;
    });
    return out;
  });
  return map[dev] || "";
}

// ============================================================================
// Запити доступу (вхід без посилання)
// ============================================================================
function accessRows_() {
  const ac = siteSheet_(SHEET_ACCESS);
  if (!ac || ac.getLastRow() < 2) return { sheet: ac, rows: [] };
  return { sheet: ac, rows: ac.getRange(2, 1, ac.getLastRow() - 1, 9).getValues() };
}

// Рішення адміністратора в «Запитах доступу». Підтвердження додає пристрій навіть понад ліміт.
function processAccess_() {
  const { sheet, rows } = accessRows_();
  if (!sheet) return;
  rows.forEach((r, i) => {
    const decision = String(r[6]).trim(), status = String(r[7]).trim(), name = String(r[2]).trim();
    if (status === ACC_DONE || status === ACC_REJ || !name) return;
    if (decision === ACC_NO) {
      sheet.getRange(i + 2, 8).setValue(ACC_REJ);
      logEvent_("Доступ відхилено", "", name, r[4], r[5], "");
      return;
    }
    if (decision !== ACC_YES) return;
    let ppl = people_(), rec = ppl.byName[name];
    if (rec && rec.role === ROLE_MENTOR) {           // ментори — лише за особистим посиланням
      sheet.getRange(i + 2, 8).setValue(ACC_REJ);
      logEvent_("Доступ відхилено", "", name, r[4], r[5], "ментор входить лише за особистим посиланням");
      return;
    }
    if (!rec) {                                     // нова людина — дописуємо в «Люди» студентом
      ppl.sheet.getRange(lastPersonRow_(ppl.sheet) + 1, 1, 1, P_OLD).setValues([[name, ROLE_STUDENT, true, false, "", "", "", "", "", false, newToken_(), ""]]);
      ensurePeople_();
      ppl = people_(); rec = ppl.byName[name];
    } else if (!rec.access) {
      ppl.sheet.getRange(rec.row, P_ACCESS).setValue(true);
      dropCache_(["people"]);
    }
    const session = addDevice_(rec, String(r[4]).trim(), String(r[5]).trim() === PHONE ? PHONE : LAPTOP, "", "підтверджений запит доступу");
    sheet.getRange(i + 2, 8, 1, 2).setValues([[ACC_DONE, session]]);
    logEvent_("Доступ підтверджено", "", name, r[4], r[5], "");
  });
  journalNames_();
}

// ============================================================================
// F4 — заявки на вільний день
// ============================================================================
const dayKey_ = (d) => stamp_(d, "yyyy-MM-dd");
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
  return q.getRange(2, 1, q.getLastRow() - 1, F_REPORT_AT).getValues()
    .map((r, i) => ({ row: i + 2, id: String(r[F_ID - 1]), at: r[F_AT - 1], name: String(r[F_NAME - 1]).trim(), date: r[F_DATE - 1], reason: String(r[F_REASON - 1]),
                      status: [F4_YES, F4_NO].indexOf(String(r[F_STATUS - 1]).trim()) >= 0 ? String(r[F_STATUS - 1]).trim() : F4_WAIT,
                      comment: String(r[F_COMMENT - 1] || ""), report: String(r[F_REPORT - 1] || ""), reportAt: r[F_REPORT_AT - 1] }))
    .filter((r) => r.name && r.date instanceof Date);
}
const isTestF4_ = (r) => String(r.comment).trim().toUpperCase() === "ТЕСТ";

// Причини зі списку (аркуш «Причини» в приватній таблиці F4)
function f4Reasons_() {
  const sh = f4_() && f4_().getSheetByName(SHEET_F4_REASONS);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map((r) => String(r[0]).trim())
    .filter((v, i, a) => v && v !== F4_OTHER && a.indexOf(v) === i).slice(0, 50);
}

// Перший вільний рядок «Запитів» (якщо рядки почистили вручну — пишемо в них, а не в кінець)
function f4FreeRow_(q) {
  const last = q.getLastRow();
  if (last >= 2) {
    const v = q.getRange(2, F_NAME, last - 1, 2).getValues();
    for (let i = 0; i < v.length; i++) if (!String(v[i][0]).trim() && !String(v[i][1]).trim()) return i + 2;
  }
  return last + 1;
}

// Звіт за день: з дня F4 до 23:59 наступного дня
const nextDayKey_ = (d) => dayKey_(new Date(d.getTime() + 864e5));
function reportState_(r) {
  if (r.status !== F4_YES) return "";
  const today = dayKey_(new Date()), day = dayKey_(r.date), last = nextDayKey_(r.date);
  if (today < day) return "soon";
  if (today <= last) return "open";
  return r.report ? "closed" : "missed";
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
  // «Інших схвалених F4» — скільки ще днів уже дозволили цій людині (без тестових заявок)
  const yes = {};
  rows.forEach((r) => { if (r.status === F4_YES && !isTestF4_(r)) yes[r.name] = (yes[r.name] || 0) + 1; });
  const others = (r) => (yes[r.name] || 0) - (r.status === F4_YES && !isTestF4_(r) ? 1 : 0);
  const q = pv && pv.getSheetByName(SHEET_F4);
  if (q && q.getLastRow() >= 2) {
    const byRow = {};
    rows.forEach((r) => { byRow[r.row] = others(r); });
    const n = q.getLastRow() - 1;
    q.getRange(2, F_COUNT, n, 1).setValues(Array.from({ length: n }, (_, i) => [byRow[i + 2] === undefined ? "" : byRow[i + 2]]));
  }
  if (pv) write(pv.getSheetByName(SHEET_F4_DAYS), list.map((d) => [d.date, d.yes.join("\n"), d.wait.join("\n"), d.no.join("\n"), d.yes.length + d.wait.length + d.no.length]), 5);
  if (pub) {
    write(pub.getSheetByName(SHEET_F4_PUB), rows.map((r) => [r.date, r.name, r.status]), 3);
    write(pub.getSheetByName(SHEET_F4_DAYS), list.filter((d) => d.yes.length || d.wait.length).map((d) => [d.date, d.yes.join("\n"), d.wait.join("\n")]), 3);
  }
  if (pv) writeCal_(pv, rows, others);
  if (pub) writeCal_(pub, rows.filter((r) => r.status !== F4_NO), null);
}

// «Календар»: тиждень — два рядки (дати й імена), Пн…Нд у колонках.
// Вікно: минулий тиждень + 5 наступних; щоночі зсувається само (тригер onF4Daily).
// others — лише для приватної таблиці: скільки ще F4 дозволили людині.
const CAL_ICON = { [F4_YES]: "✅", [F4_WAIT]: "⏳", [F4_NO]: "❌" };
const CAL_MONTHS = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];
const CAL_ORDER = { [F4_YES]: 0, [F4_WAIT]: 1, [F4_NO]: 2 };
function writeCal_(ss, rows, others) {
  let sh = ss.getSheetByName(SHEET_F4_CAL);
  if (!sh) {
    sh = ss.insertSheet(SHEET_F4_CAL, 0);
    sh.setColumnWidths(1, 7, 175);
    sh.setFrozenRows(2);
    try { sh.setHiddenGridlines(true); } catch (e) {}
  }
  const now = new Date(), today = dayKey_(now);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7 * CAL_WEEKS_BACK);
  const byDay = {};
  rows.forEach((r) => { const k = dayKey_(r.date); (byDay[k] = byDay[k] || []).push(r); });

  const W = 7, H = 2 + CAL_WEEKS * 2;
  const val = [], bg = [], fc = [], fw = [], heights = [];
  const row = (v, b, c, w) => { val.push(v); bg.push(b); fc.push(c); fw.push(w); };
  const fill = (x) => Array(W).fill(x);
  row(["F4 · календар", "", others ? "✅ дозволено · ⏳ на розгляді · ❌ заборонено · (2) — скільки F4 людині вже дозволили" : "✅ дозволено · ⏳ на розгляді",
       "", "", "", "оновлено " + stamp_(now, "dd.MM HH:mm")], fill("#ffffff"), ["#1f2a44", "#000000", "#6b7280", "#000000", "#000000", "#000000", "#9ca3af"], ["bold", "normal", "normal", "normal", "normal", "normal", "normal"]);
  row(["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"], fill("#1f2a44"), fill("#ffffff"), fill("bold"));
  for (let w = 0; w < CAL_WEEKS; w++) {
    const dv = [], db = [], dc = [], dw = [], nv = [], nb = [], nc = [];
    let lines = 1;
    for (let i = 0; i < W; i++) {
      const d = new Date(start.getTime()); d.setDate(start.getDate() + w * 7 + i);
      const k = dayKey_(d), past = k < today, isToday = k === today;
      const list = (byDay[k] || []).slice().sort((a, b) => CAL_ORDER[a.status] - CAL_ORDER[b.status] || a.name.localeCompare(b.name, "uk"));
      const n = list.length;
      dv.push(d.getDate() + (d.getDate() === 1 || (w === 0 && i === 0) ? " " + CAL_MONTHS[d.getMonth()] : "") + (isToday ? " · сьогодні" : "") + (n ? "   👥 " + n : ""));
      db.push(isToday ? "#2f6fed" : past ? "#f1f2f4" : i >= 5 ? "#f6f1ff" : "#eef3ff");
      dc.push(isToday ? "#ffffff" : past ? "#9ca3af" : "#1f2a44");
      dw.push(isToday ? "bold" : "normal");
      nv.push(list.map((r) => CAL_ICON[r.status] + " " + r.name + (others && others(r) ? " (" + others(r) + ")" : "") + (others && isTestF4_(r) ? " · тест" : "")).join("\n"));
      lines = Math.max(lines, list.length);
      const has = (st) => list.some((r) => r.status === st);
      nb.push(has(F4_WAIT) ? "#fff4d6" : has(F4_YES) ? "#e2f5ea" : has(F4_NO) ? "#fde8ec" : "#ffffff");
      nc.push(past ? "#8b8f98" : "#1f2a44");
    }
    row(dv, db, dc, dw);
    row(nv, nb, nc, fill("normal"));
    heights.push(Math.max(56, lines * 21 + 14));
  }
  if (sh.getMaxRows() > H) sh.getRange(H + 1, 1, sh.getMaxRows() - H, W).clear();
  const g = sh.getRange(1, 1, H, W);
  g.setValues(val).setBackgrounds(bg).setFontColors(fc).setFontWeights(fw);
  sh.getRange(3, 1, H - 2, W).setVerticalAlignment("top").setWrap(true)
    .setBorder(true, true, true, true, true, true, "#d7dbe3", SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(1, 1, 1, W).setWrap(false);
  heights.forEach((h, w) => sh.setRowHeight(4 + w * 2, h));
}

function onF4Daily() { rebuildF4_(); }

function myF4_(name) {
  return f4Rows_().filter((r) => r.name === name).sort((a, b) => b.date - a.date).slice(0, 30)
    .map((r) => ({ id: r.id, date: dayKey_(r.date), status: r.status, reason: r.reason, comment: r.comment,
                   report: r.report, reportAt: r.reportAt instanceof Date ? r.reportAt.toISOString() : "",
                   reportState: reportState_(r), deadline: r.status === F4_YES ? nextDayKey_(r.date) : "" }));
}

// ============================================================================
// Логи
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
function loans_(fresh) {
  if (fresh) dropCache_(["loans"]);
  return cached_("loans", () => {
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
  });
}

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
  writePeopleBooks_(loans, books);
}

// «Книжок на руках» і «Які книжки» в «Людях»
function writePeopleBooks_(loans, books) {
  const pp = siteSheet_(SHEET_PEOPLE);
  const last = pp ? lastPersonRow_(pp) : 1;
  if (last < 2) return;
  const title = {};
  books.forEach((b) => { title[b.id] = b.title; });
  const byName = {};
  Object.keys(loans).forEach((id) => {
    const n = String(loans[id].name).trim();
    (byName[n] = byName[n] || []).push(title[id] || id);
  });
  const rows = pp.getRange(2, P_NAME, last - 1, 1).getValues().map(([n]) => {
    const list = (byName[String(n).trim()] || []).sort((a, b) => a.localeCompare(b, "uk"));
    return String(n).trim() ? [list.length, list.map((t) => "• " + t).join("\n")] : ["", ""];
  });
  pp.getRange(2, P_COUNT, rows.length, 2).setValues(rows);
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
// Ручні правки в таблицях (встановлювані тригери — їх ставить setup)
// ============================================================================
function onLibEdit(e) {
  if (!e || !e.range) return;
  if (e.range.getSheet().getName() === SHEET_LOG) writeStatus_(loans_(true));
}

// Зміни структури «УАЛ · Сайт» (видалені/вставлені рядки тощо) — скидаємо кеш
function onSiteChange() { dropCache_(SITE_KEYS); }

function onSiteEdit(e) {
  dropCache_(SITE_KEYS);
  if (!e || !e.range) return;
  const sh = e.range.getSheet(), name = sh.getName();
  // Новий рядок у «Блокуванні»: ставимо дату й тип, якщо порожні
  if (name === SHEET_BLOCK && e.range.getColumn() === 1) {
    for (let r = Math.max(e.range.getRow(), 2); r <= e.range.getLastRow(); r++) {
      if (!String(sh.getRange(r, 1).getValue()).trim()) continue;
      if (!sh.getRange(r, 3).getValue()) sh.getRange(r, 3).setValue(new Date());
      if (!String(sh.getRange(r, 4).getValue()).trim()) sh.getRange(r, 4).setValue(BLOCK_SITE);
    }
  }
  // «Люди»: нова людина, роль, доступ, «Нове посилання» — коди, посилання, галочки
  if (name === SHEET_PEOPLE) { ensurePeople_(); journalNames_(); }
  // «Пристрої»: галочка «Вийти» — видаляємо пристрій (його код сесії перестає діяти)
  if (name === SHEET_DEVICES && e.range.getColumn() <= D_LOGOUT && e.range.getLastColumn() >= D_LOGOUT) {
    for (let r = e.range.getLastRow(); r >= Math.max(e.range.getRow(), 2); r--) {
      if (sh.getRange(r, D_LOGOUT).getValue() !== true) continue;
      const v = sh.getRange(r, 1, 1, D_DEV).getValues()[0];
      sh.deleteRow(r);
      dropCache_(["devices"]);
      logEvent_("Вихід з пристрою", "", v[D_NAME - 1], v[D_DEV - 1], v[D_TYPE - 1], "адміністратор вийшов з пристрою");
    }
    countDevices_();
  }
  if (name === SHEET_ACCESS) processAccess_();
}

// «F4 → Запити»: рішення змінилося — оновлюємо «По днях» і публічну таблицю
function onF4Edit(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (sh.getName() !== SHEET_F4) return;
  if (e.range.getColumn() <= 6 && e.range.getLastColumn() >= 6) {
    for (let r = Math.max(e.range.getRow(), 2); r <= e.range.getLastRow(); r++) {
      const v = String(sh.getRange(r, 6).getValue()).trim(), day = sh.getRange(r, 4).getValue();
      if (v === F4_YES || v === F4_NO) logEvent_("F4: " + v.toLowerCase(), day instanceof Date ? stamp_(day, "dd.MM.yyyy") : "", sh.getRange(r, 3).getValue(), "", "", "");
    }
  }
  rebuildF4_();
}

// ============================================================================
// Веб-застосунок
// ============================================================================
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
const whoJson_ = (who) => (who && who.ok ? { who: "ok", name: who.name, role: who.role } : { who: "none" });

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.check) {
    const dev = cleanDev_(p.device), b = blockOf_(dev);
    const res = { ok: true, block: b === BLOCK_SITE ? "site" : b ? "books" : "", gate: gateOn_(), who: "" };
    if (cleanToken_(p.token)) {
      const who = whoBySession_(p.token, dev, p.type, p.ua);
      Object.assign(res, whoJson_(who));
      if (who && who.newToken) res.newToken = who.newToken;
    }
    return json_(res);
  }
  if (p.students) return json_({ ok: true, students: people_().choose });   // для вибору «Хто ти?» — без менторів
  if (p.req) {                                       // статус запиту доступу
    const id = String(p.req).replace(/[^a-z0-9]/gi, "").slice(0, 40);
    const row = accessRows_().rows.find((r) => String(r[0]) === id);
    if (!row) return json_({ ok: false, error: "Запит не знайдено" });
    const status = String(row[7]).trim();
    if (status === ACC_DONE) return json_({ ok: true, status: "ok", name: String(row[2]).trim(), token: String(row[8]).trim() });
    return json_({ ok: true, status: status === ACC_REJ ? "rejected" : "pending" });
  }
  if (p.f4) {
    const test = f4Test_(), who = whoBySession_(p.token);
    if (!who || !who.ok) return json_({ ok: false, auth: false, test, error: "Спершу підтверди, хто ти" });
    const allowed = f4Allowed_(who.role, test);
    return json_({ ok: true, test, allowed, name: who.name, role: who.role, mine: allowed ? myF4_(who.name) : [], reasons: allowed ? f4Reasons_() : [] });
  }
  return json_({ ok: true, loans: loans_(), students: people_().list, catalog: catalog_().map((b) => b.id).sort().join(",") });
}

function doPost(e) {
  let d = {};
  try { d = JSON.parse(e.postData.contents || "{}"); } catch (err) { return json_({ ok: false, error: "Некоректний запит" }); }
  const dev = cleanDev_(d.device);
  const ua = String(d.ua || "").slice(0, 60);
  const type = typeOf_(d);

  // Перегляд сторінки — просто записуємо в логи
  if (d.action === "view") {
    const who = whoBySession_(d.token, dev, type, ua);
    logEvent_(blockOf_(dev) === BLOCK_SITE ? "Перегляд (заблоковано)" : "Перегляд", d.page, who ? who.name : "", dev, type, String(d.title || "") + (ua ? " · " + ua : ""));
    return json_({ ok: true });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // Вхід за особистим посиланням: додаємо пристрій (у межах ліміту) і видаємо код сесії
    if (d.action === "claim") {
      const rec = people_().byCode[cleanToken_(d.token)];
      if (!rec) {
        logEvent_("Недійсне посилання", "", "", dev, type, "");
        return json_({ ok: false, error: "Посилання недійсне або вже замінене новим. Обери себе зі списку нижче — адміністратор підтвердить." });
      }
      if (!rec.ok) return json_({ ok: false, error: "Доступ для «" + rec.name + "» закрито. Звернись до адміністратора." });
      if (blockOf_(dev) === BLOCK_SITE) return json_({ ok: false, error: "З цього пристрою доступ заборонено." });
      const devs = devices_();
      const same = dev && devs.rows.find((x) => x.name === rec.name && x.dev === dev);
      if (!same && activeCount_(devs, rec.name) >= rec.limit) {
        logEvent_("Ліміт пристроїв", "", rec.name, dev, type, "спроба додати пристрій понад ліміт " + rec.limit);
        return json_({ ok: false, limit: true, error: "У «" + rec.name + "» вже " + rec.limit + " пристр. — це ліміт. Попроси адміністратора збільшити ліміт або вийти з одного з пристроїв." });
      }
      const session = addDevice_(rec, dev, type, ua, "вхід за особистим посиланням", devs);
      logEvent_("Вхід за посиланням", "", rec.name, dev, type, ua);
      return json_({ ok: true, name: rec.name, role: rec.role, token: session });
    }

    // Запит доступу без посилання
    if (d.action === "access") {
      const name = String(d.name || "").replace(/\s+/g, " ").trim().slice(0, 80);
      if (name.length < 3) return json_({ ok: false, error: "Вкажи прізвище та ім'я" });
      if (blockOf_(dev)) return json_({ ok: false, error: "З цього пристрою доступ заборонено." });
      const known = people_().byName[name], isNew = !known;
      if (known && known.role === ROLE_MENTOR) return json_({ ok: false, error: "Ментори входять лише за своїм особистим посиланням. Попроси його в адміністратора." });
      const { sheet, rows } = accessRows_();
      const open = rows.find((r) => String(r[4]) === dev && String(r[2]).trim() === name && !String(r[7]).trim());
      if (open) return json_({ ok: true, req: String(open[0]) });
      const id = newToken_();
      sheet.appendRow([id, new Date(), name, isNew ? "так" : "", dev, type, ACC_WAIT, "", ""]);
      logEvent_("Запит доступу", "", name, dev, type, isNew ? "людини немає у списку" : "");
      return json_({ ok: true, req: id });
    }

    // Усе нижче — лише для впізнаних людей
    const who = whoBySession_(d.token, dev, type, ua);

    // F4: заявка на вільний день (робочий режим — усі; тестовий — ментори й адміни)
    if (d.action === "f4") {
      if (!who || !who.ok) return json_({ ok: false, auth: false, error: "Спершу підтверди, хто ти" });
      const test = f4Test_();
      if (!f4Allowed_(who.role, test)) return json_({ ok: false, test, allowed: false,
        error: test ? "F4 ще в розробці — скоро запрацює." : "Заявки F4 подають студенти. Рішення — у таблиці F4." });
      const day = parseDay_(d.date);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (!day) return json_({ ok: false, error: "Обери дату" });
      if (day < today) return json_({ ok: false, error: "Дата вже минула" });
      const list = f4Reasons_(), kind = String(d.reasonType || F4_OTHER).trim(), text = String(d.reason || "").trim().slice(0, 600);
      let reason;
      if (kind !== F4_OTHER && list.indexOf(kind) >= 0) reason = kind + (text ? " — " + text : "");
      else {
        if (text.length < 5) return json_({ ok: false, error: "Напиши причину трохи докладніше" });
        reason = list.length ? F4_OTHER + ": " + text : text;
      }
      if (f4Rows_().some((r) => r.name === who.name && dayKey_(r.date) === dayKey_(day) && r.status !== F4_NO)) {
        return json_({ ok: false, error: "На цей день у тебе вже є заявка", mine: myF4_(who.name) });
      }
      const q = f4_().getSheetByName(SHEET_F4), at = f4FreeRow_(q);
      q.getRange(at, 1, 1, F_REPORT_AT).setValues([[newToken_(), new Date(), who.name, day, reason, F4_WAIT, test ? "ТЕСТ" : "", "", "", ""]]);
      logEvent_("F4: заявка", stamp_(day, "dd.MM.yyyy"), who.name, dev, type, "");
      rebuildF4_();
      return json_({ ok: true, mine: myF4_(who.name) });
    }

    // F4: звіт за дозволений день (з дня F4 до 23:59 наступного дня)
    if (d.action === "f4report") {
      if (!who || !who.ok) return json_({ ok: false, auth: false, error: "Спершу підтверди, хто ти" });
      const r = f4Rows_().find((x) => x.id === String(d.id || "") && x.name === who.name);
      if (!r) return json_({ ok: false, error: "Заявку не знайдено" });
      const st = reportState_(r);
      if (st === "soon") return json_({ ok: false, error: "Звіт можна написати в день F4 або наступного дня" });
      if (st !== "open") return json_({ ok: false, error: r.status === F4_YES ? "Час на звіт минув (до 23:59 наступного дня)" : "Звіт пишуть лише за дозволений день", mine: myF4_(who.name) });
      const text = String(d.report || "").trim().slice(0, 3000);
      if (text.length < 10) return json_({ ok: false, error: "Напиши звіт трохи докладніше" });
      f4_().getSheetByName(SHEET_F4).getRange(r.row, F_REPORT, 1, 2).setValues([[text, new Date()]]);
      logEvent_(r.report ? "F4: звіт оновлено" : "F4: звіт", stamp_(r.date, "dd.MM.yyyy"), who.name, dev, type, "");
      return json_({ ok: true, mine: myF4_(who.name) });
    }

    if (d.books) saveCatalog_(d.books);
    const log = lib_().getSheetByName(SHEET_LOG);
    const loans = loans_(true);                      // для запису — завжди свіжий стан, не з кешу

    if (d.action === "sync") {
      writeStatus_(loans);
      return json_({ ok: true, loans });
    }

    // Бібліотека: студенти, ментори й адміни
    const id = String(d.bookId || "").trim();
    const title = String(d.title || "").slice(0, 200);
    if (!id || !log) return json_({ ok: false, error: "Не вказано книжку", loans });
    if (!who || !who.ok) return json_({ ok: false, auth: false, error: "Спершу підтверди, хто ти", loans });
    if (blockOf_(dev)) {
      logEvent_("Відмова", title, who.name, dev, type, "пристрій у списку блокування");
      return json_({ ok: false, error: "З цього пристрою брати книжки заборонено. Звернись до адміністратора.", loans });
    }

    // Взяти — лише на себе; адмін може записати книжку на будь-кого зі списку
    if (d.action === "take") {
      let name = who.name;
      if (who.role === ROLE_ADMIN && d.name && people_().byName[String(d.name).trim()]) name = String(d.name).trim();
      if (loans[id]) return json_({ ok: false, error: "Книжку вже взяли: " + loans[id].name, loans });
      const now = new Date(), note = name !== who.name ? "записав(ла) " + who.name : "";
      log.appendRow([now, id, title, name, TAKEN, dev, ua, note]);
      logEvent_("Взяття", title, name, dev, type, note);
      loans[id] = { name, date: now.toISOString() };
      dropCache_(["loans"]);
      writeStatus_(loans);
      return json_({ ok: true, loans, name });
    }

    // Повернути може будь-хто впізнаний (наприклад, приніс книжку за друга)
    if (d.action === "return") {
      if (!loans[id]) return json_({ ok: false, error: "Цю книжку ніхто не брав", loans });
      const holder = loans[id].name, note = holder !== who.name ? "повернув(ла) " + who.name : "";
      log.appendRow([new Date(), id, title, holder, RETURNED, dev, ua, note]);
      logEvent_("Повернення", title, holder, dev, type, note);
      delete loans[id];
      dropCache_(["loans"]);
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
