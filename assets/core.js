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
  let token = get("ual-token"), me = get("ual-me");
  const here = location.pathname.split("/").pop().replace(/\.html$/, "");
  const onVhid = here === "vhid";
  const toVhid = () => {
    if (onVhid) return;
    document.documentElement.style.visibility = "hidden";
    location.replace("vhid?next=" + encodeURIComponent((here || "./") + location.search + location.hash));
  };
  let gate = get("ual-gate");                    // "1" — вхід обов'язковий, "0" — ні, "" — ще не знаємо
  if (gate === "1" && !token) toVhid();
  function setIdentity(t, name) { token = t; me = name; set("ual-token", t); set("ual-me", name); }
  function clearIdentity() { token = ""; me = ""; try { localStorage.removeItem("ual-token"); localStorage.removeItem("ual-me"); } catch (e) {} }

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
  // Статус перевіряється кожні 30 секунд, поки вкладка відкрита й видима.
  const CHECK_MS = 30 * 1000;
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
    if (checking || (!force && Date.now() - (cached.t || 0) < CHECK_MS)) return Promise.resolve();
    checking = true;
    return fetch(UAL_API_URL + "?check=1&device=" + encodeURIComponent(device) + "&token=" + encodeURIComponent(token) + "&t=" + Date.now())
      .then((r) => r.json())
      .then((r) => {
        if (!r || !r.ok) return;
        set("ual-block", JSON.stringify({ block: r.block || "", t: Date.now() }));
        gate = r.gate === true ? "1" : "0"; set("ual-gate", gate);
        if (r.who === "ok" && r.name && r.name !== me) { me = r.name; set("ual-me", me); }
        if (r.who === "none") clearIdentity();
        if (gate === "1" && !token) { toVhid(); return; }
        if (r.block === "site") showBlocked();
        else if (document.getElementById("ual-blocked")) location.reload();
      })
      .catch(() => {})
      .finally(() => { checking = false; });
  }

  // Періодична перевірка лише для видимої вкладки
  setInterval(() => { if (document.visibilityState === "visible") checkBlock(); }, CHECK_MS);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkBlock(); });

  // Перший візит без коду, а стан перемикача ще невідомий: ховаємо сторінку, поки не спитаємо сервер
  if (!token && !onVhid && gate === "") {
    document.documentElement.style.visibility = "hidden";
    const show = () => { if (!(gate === "1" && !token)) document.documentElement.style.visibility = ""; };
    setTimeout(show, 4000);
    checkBlock(true).finally(show);
  }

  return {
    device, ua, type, logView, checkBlock, setIdentity, clearIdentity,
    get token() { return token; }, get me() { return me; },
    lastName: () => get("ual-last-name"),
    rememberName: (n) => set("ual-last-name", n),
  };
})();
