// Журнал бібліотеки: хто яку книжку взяв.
// Дані живуть у Google Таблиці; сайт спілкується з нею через веб-застосунок Apps Script
// (код і інструкція — у папці google-apps-script/). Адреса й код пристрою — в assets/core.js.
// Якщо адреси немає, працює демо-режим і позначки зберігаються лише в цьому браузері.
const LIBRARY_API_URL = typeof UAL_API_URL !== "undefined" ? UAL_API_URL : "";

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

  // Які книжки брали саме з цього пристрою — щоб тихо показувати «свої» першими
  const MINE_KEY = "ual-my-books";
  const readMine = () => { try { return JSON.parse(localStorage.getItem(MINE_KEY) || "[]"); } catch (e) { return []; } };
  const writeMine = (a) => { try { localStorage.setItem(MINE_KEY, JSON.stringify(a.slice(-50))); } catch (e) {} };
  const markMine = (id, on) => writeMine([...readMine().filter((x) => x !== id), ...(on ? [id] : [])]);

  // Книжка на руках у «мене»: записана на моє ім'я або взята з цього пристрою
  function isMine(id, loans) {
    const l = loans && loans[id];
    if (!l) return false;
    const names = typeof UAL !== "undefined" ? [UAL.me, UAL.lastName()].filter(Boolean) : [];
    return names.includes(l.name) || readMine().includes(id);
  }

  const dev = () => (typeof UAL !== "undefined" ? { device: UAL.device, ua: UAL.ua, type: UAL.type, token: UAL.token } : {});

  // Каталог для аркуша «Стан книжок» у таблиці
  const catalog = () => (typeof BOOKS === "undefined" ? [] : BOOKS.map((b) => ({
    id: b.id, title: b.title, author: (typeof AUTHORS !== "undefined" && AUTHORS[b.authorId]?.name) || "",
  })));

  // Останній відомий стан — показуємо одразу, поки сервер відповідає (сервер Google думає 1–3 с)
  const CACHE_KEY = "ual-loans-cache";
  const save = (r) => { if (r && r.ok && r.loans) try { localStorage.setItem(CACHE_KEY, JSON.stringify({ loans: r.loans, students: r.students, t: Date.now() })); } catch (e) {} return r; };
  function cached() {
    if (demo) return { ok: true, loans: readDemo(), students: STUDENTS };
    try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); if (c && c.loans && Date.now() - c.t < 7 * 864e5) return { ok: true, ...c }; } catch (e) {}
    return null;
  }

  async function state() {
    if (demo) return { ok: true, loans: readDemo(), students: STUDENTS };
    const r = save(await call());
    if (r.ok && !(r.students && r.students.length)) r.students = STUDENTS;
    // якщо в таблиці застарілий список книжок — оновлюємо його (раз, без участі користувача)
    const ids = catalog().map((b) => b.id).sort().join(",");
    if (r.ok && typeof r.catalog === "string" && ids && r.catalog !== ids) call({ action: "sync", books: catalog() });
    return r;
  }

  async function take(book, name, confirm = false) {
    if (demo) {
      const l = readDemo();
      if (l[book.id]) return { ok: false, error: "Книжку вже взяли: " + l[book.id].name, loans: l };
      l[book.id] = { name, date: new Date().toISOString() };
      writeDemo(l);
      markMine(book.id, true);
      return { ok: true, loans: l };
    }
    const r = await call({ action: "take", bookId: book.id, title: book.title, name, confirm, ...dev(), books: catalog() });
    if (r.loans) save({ ok: true, loans: r.loans, students: (cached() || {}).students });
    if (r.ok && typeof UAL !== "undefined") UAL.rememberName(name);
    if (r.ok) markMine(book.id, true);
    return r;
  }

  async function giveBack(book) {
    if (demo) {
      const l = readDemo();
      delete l[book.id];
      writeDemo(l);
      markMine(book.id, false);
      return { ok: true, loans: l };
    }
    const r = await call({ action: "return", bookId: book.id, title: book.title, ...dev(), books: catalog() });
    if (r.loans) save({ ok: true, loans: r.loans, students: (cached() || {}).students });
    if (r.ok) markMine(book.id, false);
    return r;
  }

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
  };

  const lastName = () => (typeof UAL !== "undefined" ? UAL.me || UAL.lastName() : "");

  return { demo, state, cached, take, giveBack, fmtDate, lastName, isMine };
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
