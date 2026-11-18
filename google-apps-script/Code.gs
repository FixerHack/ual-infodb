// Журнал бібліотеки УАЛ Львів — бекенд для сайту.
// Встав цей код у Google Таблицю: Розширення → Apps Script. Інструкція — у README.md поруч.

const SHEET_LOG = "Журнал";
const SHEET_STATUS = "Стан книжок";
const SHEET_STUDENTS = "Студенти"; // необов'язковий: якщо аркуша немає, береться список нижче
const TAKEN = "Взято";
const RETURNED = "Повернено";

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

// Запусти після вставлення коду: створює/оновлює аркуші, шапки і спадні списки.
function setup() {
  const ss = SpreadsheetApp.getActive();

  let log = ss.getSheetByName(SHEET_LOG);
  if (!log) {
    log = ss.insertSheet(SHEET_LOG, 0);
    log.appendRow(["Дата", "ID книжки", "Назва", "Студент", "Дія"]);
    log.getRange(1, 1, 1, 5).setFontWeight("bold");
    log.setFrozenRows(1);
    log.getRange("A2:A").setNumberFormat("dd.MM.yyyy HH:mm");
  }
  applyValidation_();

  writeStatus_(loans_());

  const blank = ss.getSheetByName("Аркуш1") || ss.getSheetByName("Sheet1");
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 2) ss.deleteSheet(blank);
}

// Спадні списки в журналі ставляться лише там, де їх ще немає,
// щоб не стерти власне оформлення (кольори «Взято» / «Повернено» тощо)
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

function students_() {
  const st = SpreadsheetApp.getActive().getSheetByName(SHEET_STUDENTS);
  if (!st || st.getLastRow() < 2) return STUDENTS;
  const list = st.getRange(2, 1, st.getLastRow() - 1, 1).getValues().map((r) => String(r[0]).trim()).filter(String);
  return list.length ? list : STUDENTS;
}

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

// Аркуш «Стан книжок»: усі книжки каталогу, статус і в кого зараз.
// Оформлення задається лише при створенні аркуша; далі оновлюються тільки значення,
// тож власні стилі в таблиці не зникають.
function writeStatus_(loans) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET_STATUS);
  if (!sh) sh = createStatusSheet_(ss);
  const books = catalog_();
  const known = {};
  books.forEach((b) => { known[b.id] = true; });
  // книжки, які є в журналі, але ще не потрапили в каталог
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

// Якщо журнал правлять вручну — стан книжок оновлюється сам
function onEdit(e) {
  if (e && e.range && e.range.getSheet().getName() === SHEET_LOG) writeStatus_(loans_());
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return json_({ ok: true, loans: loans_(), students: students_(), catalog: catalog_().map((b) => b.id).sort().join(",") });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents || "{}");
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
      if (students_().indexOf(name) < 0) return json_({ ok: false, error: "Такого студента немає в списку", loans });
      if (loans[id]) return json_({ ok: false, error: "Книжку вже взяли: " + loans[id].name, loans });
      const now = new Date();
      log.appendRow([now, id, title, name, TAKEN]);
      loans[id] = { name, date: now.toISOString() };
      writeStatus_(loans);
      return json_({ ok: true, loans });
    }

    if (d.action === "return") {
      if (!loans[id]) return json_({ ok: false, error: "Цю книжку ніхто не брав", loans });
      log.appendRow([new Date(), id, title, loans[id].name, RETURNED]);
      delete loans[id];
      writeStatus_(loans);
      return json_({ ok: true, loans });
    }

    return json_({ ok: false, error: "Невідома дія", loans });
  } catch (err) {
    return json_({ ok: false, error: "Помилка журналу: " + err.message });
  } finally {
    lock.releaseLock();
  }
}
