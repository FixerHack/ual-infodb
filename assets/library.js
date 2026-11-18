// Журнал бібліотеки: хто яку книжку взяв.
// Дані живуть у Google Таблиці; сайт спілкується з нею через веб-застосунок Apps Script
// (код і інструкція — у папці google-apps-script/).
// Встав сюди адресу веб-застосунку (закінчується на /exec). Поки порожньо — працює демо-режим
// і позначки зберігаються лише в цьому браузері.
const LIBRARY_API_URL = "https://script.google.com/macros/s/AKfycbzsEvrB_eoq8d1ABNl3M9M3WNXznP-2vhiNuFHJfIkXLa4m-QPLrCqORxDKFRwOMYE/exec";

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

  // Випадковий код цього пристрою (живе лише в цьому браузері; IP не використовуємо)
  const device = (() => {
    try {
      let id = localStorage.getItem("ual-device-id");
      if (!id) {
        id = Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => (x % 36).toString(36)).join("") + Date.now().toString(36).slice(-2);
        localStorage.setItem("ual-device-id", id);
      }
      return id;
    } catch (e) { return ""; }
  })();

  // Коротка назва пристрою для журналу: «iPhone · Safari»
  const uaLabel = (() => {
    const u = navigator.userAgent;
    const os = /iPhone/.test(u) ? "iPhone" : /iPad/.test(u) ? "iPad" : /Android/.test(u) ? "Android"
      : /Mac OS X/.test(u) ? "Mac" : /Windows/.test(u) ? "Windows" : /Linux/.test(u) ? "Linux" : "Інше";
    const br = /Edg\//.test(u) ? "Edge" : /SamsungBrowser/.test(u) ? "Samsung" : /OPR\//.test(u) ? "Opera"
      : /Firefox|FxiOS/.test(u) ? "Firefox" : /Chrome|CriOS/.test(u) ? "Chrome" : /Safari/.test(u) ? "Safari" : "Браузер";
    return os + " · " + br;
  })();

  // Ім'я, яке з цього пристрою обирали минулого разу (щоб підставляти у список)
  const lastName = () => { try { return localStorage.getItem("ual-last-name") || ""; } catch (e) { return ""; } };
  const rememberName = (n) => { try { localStorage.setItem("ual-last-name", n); } catch (e) {} };

  // Каталог для аркуша «Стан книжок» у таблиці
  const catalog = () => (typeof BOOKS === "undefined" ? [] : BOOKS.map((b) => ({
    id: b.id, title: b.title, author: (typeof AUTHORS !== "undefined" && AUTHORS[b.authorId]?.name) || "",
  })));

  async function state() {
    if (demo) return { ok: true, loans: readDemo(), students: STUDENTS };
    const r = await call();
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
      return { ok: true, loans: l };
    }
    const r = await call({ action: "take", bookId: book.id, title: book.title, name, confirm, device, ua: uaLabel, books: catalog() });
    if (r.ok) rememberName(name);
    return r;
  }

  async function giveBack(book) {
    if (demo) {
      const l = readDemo();
      delete l[book.id];
      writeDemo(l);
      return { ok: true, loans: l };
    }
    return call({ action: "return", bookId: book.id, title: book.title, device, ua: uaLabel, books: catalog() });
  }

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
  };

  return { demo, state, take, giveBack, fmtDate, lastName };
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
