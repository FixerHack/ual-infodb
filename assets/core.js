// Спільне для всіх сторінок: адреса журналу (Google Apps Script), код цього пристрою і логи переглядів.
// IP не збираємо: Apps Script його не бачить, а в осередку всі в одному Wi-Fi.
const UAL_API_URL = "https://script.google.com/macros/s/AKfycbzsEvrB_eoq8d1ABNl3M9M3WNXznP-2vhiNuFHJfIkXLa4m-QPLrCqORxDKFRwOMYE/exec";

// Вхід лише для студентів: вмикається перемикачем «Вхід лише для студентів» у таблиці «УАЛ · Сайт → Налаштування».
// Без підтвердженої особи сайт тоді відправляє на сторінку «Хто ти?» (vhid). Останній стан перемикача
// пам'ятається в браузері, тож сторінки не блимають.

const UAL = (() => {
  const get = (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  // Випадковий код пристрою — живе лише в цьому браузері
  let device = get("ual-device-id");
  if (!device) {
    try {
      device = Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => (x % 36).toString(36)).join("") + Date.now().toString(36).slice(-2);
      set("ual-device-id", device);
    } catch (e) { device = ""; }
  }

  // Хто ти: особистий код доступу (з посилання або після підтвердження адміністратором)
  let token = get("ual-token"), me = get("ual-me"), role = get("ual-role");
  const here = location.pathname.split("/").pop().replace(/\.html$/, "");
  const onVhid = here === "vhid";
  const toVhid = () => {
    if (onVhid) return;
    document.documentElement.style.visibility = "hidden";
    location.replace("vhid?next=" + encodeURIComponent((here || "./") + location.search + location.hash));
  };
  let gate = get("ual-gate");                    // "1" — вхід обов'язковий, "0" — ні, "" — ще не знаємо
  if (gate === "1" && !token) toVhid();
  function setIdentity(t, name, r) { token = t; me = name; role = r || role || ""; set("ual-token", t); set("ual-me", name); set("ual-role", role); }
  function clearIdentity() { token = ""; me = ""; role = ""; try { ["ual-token", "ual-me", "ual-role"].forEach((k) => localStorage.removeItem(k)); } catch (e) {} }

  // «iPhone · Safari», «Windows · Chrome» …
  const u = navigator.userAgent;
  const os = /iPhone/.test(u) ? "iPhone" : /iPad/.test(u) ? "iPad" : /Android/.test(u) ? "Android"
    : /Mac OS X/.test(u) ? "Mac" : /Windows/.test(u) ? "Windows" : /Linux/.test(u) ? "Linux" : "Інше";
  const br = /Edg\//.test(u) ? "Edge" : /SamsungBrowser/.test(u) ? "Samsung" : /OPR\//.test(u) ? "Opera"
    : /Firefox|FxiOS/.test(u) ? "Firefox" : /Chrome|CriOS/.test(u) ? "Chrome" : /Safari/.test(u) ? "Safari" : "Браузер";
  const ua = os + " · " + br;
  const type = /iPhone|iPad|Android/.test(u) ? "Телефон" : "Ноутбук";

  // Перегляд сторінки → «Логи» в таблиці (не частіше ніж раз на 30 хв для тієї самої сторінки)
  function logView() {
    if (!UAL_API_URL || !device) return;
    const page = (location.pathname.split("/").pop().replace(/\.html$/, "") || "index") + location.search;
    const key = "ual-view-" + page;
    if (Date.now() - (Number(get(key)) || 0) < 30 * 60 * 1000) return;
    set(key, String(Date.now()));
    const body = JSON.stringify({ action: "view", page, title: document.title, device, ua, type, token });
    try { fetch(UAL_API_URL, { method: "POST", body, mode: "no-cors", keepalive: true }); } catch (e) {}
  }

  // Екран блокування для пристроїв, заблокованих на весь сайт.
  // Статус перевіряється раз на хвилину, поки вкладка відкрита й видима (заодно це «пульс» для аркуша «Онлайн»).
  const CHECK_MS = 60 * 1000;
  let checking = false;

  function showBlocked() {
    if (document.getElementById("ual-blocked")) return;
    document.documentElement.classList.add("ual-blocked");
    const el = document.createElement("div");
    el.id = "ual-blocked";
    el.className = "block-screen";
    el.innerHTML = `<div class="block-box"><div class="block-ico">🔒</div><h1>Тебе заблокував власник сайту</h1>
      <p>…або ти просто не уалівець 🙂</p>
      <button class="btn" type="button" id="ual-retry">Спробувати ще раз</button>
      <p class="block-note">Якщо це помилка — напиши власнику сайту й назви код пристрою: <b>${device}</b></p></div>`;
    document.body.appendChild(el);
    document.getElementById("ual-retry").addEventListener("click", (e) => {
      e.target.disabled = true;
      e.target.textContent = "Перевіряємо…";
      checkBlock(true).finally(() => {
        const btn = document.getElementById("ual-retry");
        if (btn) { btn.disabled = false; btn.textContent = "Спробувати ще раз"; }
      });
    });
  }

  function checkBlock(force = false) {
    if (!UAL_API_URL || !device) return Promise.resolve();
    let cached = {};
    try { cached = JSON.parse(get("ual-block") || "{}"); } catch (e) {}
    if (cached.block === "site") showBlocked();
    if (checking || (!force && Date.now() - (cached.t || 0) < CHECK_MS - 5000)) return Promise.resolve();
    checking = true;
    return fetch(UAL_API_URL + "?check=1&device=" + encodeURIComponent(device) + "&token=" + encodeURIComponent(token) +
        "&type=" + encodeURIComponent(type) + "&ua=" + encodeURIComponent(ua) +
        (token && document.visibilityState === "visible" ? "&page=" + encodeURIComponent(document.title.replace(/^УАЛ \| /, "")) : "") + "&t=" + Date.now())
      .then((r) => r.json())
      .then((r) => {
        if (!r || !r.ok) return;
        set("ual-block", JSON.stringify({ block: r.block || "", t: Date.now() }));
        gate = r.gate === true ? "1" : "0"; set("ual-gate", gate);
        if (r.newToken) { token = r.newToken; set("ual-token", token); }   // перехід зі старого входу на код пристрою
        if (r.who === "ok") {
          if (r.name && r.name !== me) { me = r.name; set("ual-me", me); }
          if (r.role && r.role !== role) { role = r.role; set("ual-role", role); }
        }
        if (r.who === "none") clearIdentity();
        try { window.dispatchEvent(new Event("ual:who")); } catch (e) {}   // футер оновить «Ти: …»
        if (r.maint && typeof r.maint === "object") {                      // тех роботи
          const m = JSON.stringify(r.maint);
          if (m !== get("ual-maint")) { set("ual-maint", m); try { window.dispatchEvent(new Event("ual:maint")); } catch (e) {} }
        }
        if (Array.isArray(r.notices)) {                                     // повідомлення від адміна
          set("ual-notices", JSON.stringify(r.notices));
          try { window.dispatchEvent(new Event("ual:notices")); } catch (e) {}
        }
        if (gate === "1" && !token) { toVhid(); return; }
        if (r.block === "site") showBlocked();
        else if (document.getElementById("ual-blocked")) location.reload();
      })
      .catch(() => {})
      .finally(() => { checking = false; });
  }

  // Періодична перевірка лише для видимої вкладки
  setInterval(() => { if (document.visibilityState === "visible") checkBlock(); }, CHECK_MS);
  // Вкладку сховали/закрили — «пішов»; повернулись — одразу пульс
  function bye() {
    if (!UAL_API_URL || !token || get("ual-bye")) return;
    set("ual-bye", "1");
    const body = JSON.stringify({ action: "bye", device, ua, type, token });
    try { navigator.sendBeacon ? navigator.sendBeacon(UAL_API_URL, new Blob([body], { type: "text/plain" })) : fetch(UAL_API_URL, { method: "POST", body, mode: "no-cors", keepalive: true }); } catch (e) {}
  }
  function back() { if (get("ual-bye")) { set("ual-bye", ""); checkBlock(true); } else checkBlock(); }
  document.addEventListener("visibilitychange", () => { document.visibilityState === "visible" ? back() : bye(); });
  window.addEventListener("pagehide", bye);
  if (document.visibilityState === "visible" && get("ual-bye")) setTimeout(back, 300);

  // Перший візит без коду, а стан перемикача ще невідомий: ховаємо сторінку, поки не спитаємо сервер
  if (!token && !onVhid && gate === "") {
    document.documentElement.style.visibility = "hidden";
    const show = () => { if (!(gate === "1" && !token)) document.documentElement.style.visibility = ""; };
    setTimeout(show, 2500);
    checkBlock(true).finally(show);
  }

  // Повідомлення від адміна: останні отримані (щоб показати одразу) і «Зрозуміло»
  // гість (без входу) закриває лише в цьому браузері — ID закритих тримаємо локально
  const closed = () => { try { return JSON.parse(get("ual-notices-closed") || "[]"); } catch (e) { return []; } };
  function notices() {
    let list = [];
    try { list = JSON.parse(get("ual-notices") || "[]"); } catch (e) {}
    const c = closed();
    return list.filter((n) => n.kind === "pinned" || c.indexOf(n.id) < 0);
  }
  function noticeSeen(id) {
    set("ual-notices-closed", JSON.stringify(closed().concat(id).slice(-200)));
    if (!token) return;
    const body = JSON.stringify({ action: "noticeSeen", id, device, ua, type, token });
    try { fetch(UAL_API_URL, { method: "POST", body, mode: "no-cors", keepalive: true }); } catch (e) {}
  }

  const maint = () => { try { return JSON.parse(get("ual-maint") || "{}"); } catch (e) { return {}; } };

  return {
    device, ua, type, logView, checkBlock, setIdentity, clearIdentity, notices, noticeSeen, maint,
    get token() { return token; }, get me() { return me; }, get role() { return role; },
    lastName: () => get("ual-last-name"),
    rememberName: (n) => set("ual-last-name", n),
  };
})();
