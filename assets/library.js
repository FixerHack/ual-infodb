// Журнал бібліотеки: хто яку книжку взяв.
// Дані живуть у Google Таблиці; сайт спілкується з нею через веб-застосунок Apps Script
// (код і інструкція — у папці google-apps-script/).
// Встав сюди адресу веб-застосунку (закінчується на /exec). Поки порожньо — працює демо-режим
// і позначки зберігаються лише в цьому браузері.
const LIBRARY_API_URL = "";

const Library = (() => {
  const DEMO_KEY = "ual-library-demo-v1";
  const demo = !LIBRARY_API_URL;

  const readDemo = () => { try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "{}"); } catch (e) { return {}; } };
  const writeDemo = (l) => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(l)); } catch (e) {} };

  async function call(payload) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = payload
        // text/plain — щоб браузер не робив preflight-запит, який Apps Script не підтримує
        ? await fetch(LIBRARY_API_URL, { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "text/plain;charset=utf-8" }, signal: ctrl.signal })
        : await fetch(LIBRARY_API_URL + "?t=" + Date.now(), { signal: ctrl.signal });
      return await res.json();
    } catch (e) {
      return { ok: false, error: "Не вдалося зв'язатися з журналом. Перевір інтернет і спробуй ще раз." };
    } finally { clearTimeout(t); }
  }

  async function state() {
    if (demo) return { ok: true, loans: readDemo(), students: STUDENTS };
    const r = await call();
    if (r.ok && !(r.students && r.students.length)) r.students = STUDENTS;
    return r;
  }

  async function take(book, name) {
    if (demo) {
      const l = readDemo();
      if (l[book.id]) return { ok: false, error: "Книжку вже взяли: " + l[book.id].name, loans: l };
      l[book.id] = { name, date: new Date().toISOString() };
      writeDemo(l);
      return { ok: true, loans: l };
    }
    return call({ action: "take", bookId: book.id, title: book.title, name });
  }

  async function giveBack(book) {
    if (demo) {
      const l = readDemo();
      delete l[book.id];
      writeDemo(l);
      return { ok: true, loans: l };
    }
    return call({ action: "return", bookId: book.id, title: book.title });
  }

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
  };

  return { demo, state, take, giveBack, fmtDate };
})();

// Маленьке спливаюче повідомлення
function toast(msg, kind = "") {
  let box = document.querySelector(".toasts");
  if (!box) { box = document.createElement("div"); box.className = "toasts"; document.body.appendChild(box); }
  const el = document.createElement("div");
  el.className = "toast " + kind;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.classList.add("out"), 3200);
  setTimeout(() => el.remove(), 3700);
}
