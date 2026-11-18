// Журнал бібліотеки УАЛ Львів — бекенд для сайту.
// Встав цей код у Google Таблицю: Розширення → Apps Script. Інструкція — у README.md поруч.

const SHEET_LOG = "Журнал";
const SHEET_STUDENTS = "Студенти";
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

// Запусти один раз: створює аркуші, шапку і спадні списки.
function setup() {
  const ss = SpreadsheetApp.getActive();

  const st = ss.getSheetByName(SHEET_STUDENTS) || ss.insertSheet(SHEET_STUDENTS);
  if (st.getLastRow() < 2) {
    st.getRange(1, 1).setValue("Студент").setFontWeight("bold");
    st.getRange(2, 1, STUDENTS.length, 1).setValues(STUDENTS.map((n) => [n]));
  }
  st.setFrozenRows(1);

  const log = ss.getSheetByName(SHEET_LOG) || ss.insertSheet(SHEET_LOG, 0);
  if (log.getLastRow() < 1) {
    log.appendRow(["Дата", "ID книжки", "Назва", "Студент", "Дія"]);
    log.getRange(1, 1, 1, 5).setFontWeight("bold");
  }
  log.setFrozenRows(1);
  log.getRange("A2:A").setNumberFormat("dd.MM.yyyy HH:mm");

  // Спадний список студентів і дій прямо в журналі
  log.getRange("D2:D").setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(st.getRange("A2:A"), true).setAllowInvalid(false).build());
  log.getRange("E2:E").setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList([TAKEN, RETURNED], true).setAllowInvalid(false).build());

  const blank = ss.getSheetByName("Аркуш1") || ss.getSheetByName("Sheet1");
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 2) ss.deleteSheet(blank);
}

function students_() {
  const st = SpreadsheetApp.getActive().getSheetByName(SHEET_STUDENTS);
  if (!st || st.getLastRow() < 2) return STUDENTS;
  return st.getRange(2, 1, st.getLastRow() - 1, 1).getValues().map((r) => String(r[0]).trim()).filter(String);
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

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return json_({ ok: true, loans: loans_(), students: students_() });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents || "{}");
    const id = String(d.bookId || "").trim();
    const title = String(d.title || "").slice(0, 200);
    const log = SpreadsheetApp.getActive().getSheetByName(SHEET_LOG);
    const loans = loans_();
    if (!id || !log) return json_({ ok: false, error: "Не вказано книжку", loans });

    if (d.action === "take") {
      const name = String(d.name || "").trim();
      if (students_().indexOf(name) < 0) return json_({ ok: false, error: "Такого студента немає в списку", loans });
      if (loans[id]) return json_({ ok: false, error: "Книжку вже взяли: " + loans[id].name, loans });
      const now = new Date();
      log.appendRow([now, id, title, name, TAKEN]);
      loans[id] = { name, date: now.toISOString() };
      return json_({ ok: true, loans });
    }

    if (d.action === "return") {
      if (!loans[id]) return json_({ ok: false, error: "Цю книжку ніхто не брав", loans });
      log.appendRow([new Date(), id, title, loans[id].name, RETURNED]);
      delete loans[id];
      return json_({ ok: true, loans });
    }

    return json_({ ok: false, error: "Невідома дія", loans });
  } catch (err) {
    return json_({ ok: false, error: "Помилка журналу: " + err.message });
  } finally {
    lock.releaseLock();
  }
}
