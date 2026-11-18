// Спільне для всіх сторінок: адреса журналу (Google Apps Script), код цього пристрою і логи переглядів.
// IP не збираємо: Apps Script його не бачить, а в осередку всі в одному Wi-Fi.
const UAL_API_URL = "https://script.google.com/macros/s/AKfycbzsEvrB_eoq8d1ABNl3M9M3WNXznP-2vhiNuFHJfIkXLa4m-QPLrCqORxDKFRwOMYE/exec";

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
    const page = (location.pathname.split("/").pop() || "index.html") + location.search;
    const key = "ual-view-" + page;
    if (Date.now() - (Number(get(key)) || 0) < 30 * 60 * 1000) return;
    set(key, String(Date.now()));
    const body = JSON.stringify({ action: "view", page, title: document.title, device, ua, type });
    try { fetch(UAL_API_URL, { method: "POST", body, mode: "no-cors", keepalive: true }); } catch (e) {}
  }

  // Екран «Доступ обмежено» для пристроїв, заблокованих на весь сайт.
  // Стан кешується на 5 хв, щоб не питати таблицю на кожній сторінці.
  function showBlocked() {
    if (document.getElementById("ual-blocked")) return;
    document.documentElement.classList.add("ual-blocked");
    const el = document.createElement("div");
    el.id = "ual-blocked";
    el.className = "block-screen";
    el.innerHTML = `<div class="block-box"><div class="block-ico">🔒</div><h1>Тебе заблокував власник сайту</h1>
      <p>…або ти просто не уалівець 🙂</p>
      <p class="block-note">Якщо це помилка — напиши власнику сайту й назви код пристрою: <b>${device}</b></p></div>`;
    document.body.appendChild(el);
  }
  function checkBlock() {
    if (!UAL_API_URL || !device) return;
    let cached = {};
    try { cached = JSON.parse(get("ual-block") || "{}"); } catch (e) {}
    if (cached.block === "site") showBlocked();
    if (Date.now() - (cached.t || 0) < 5 * 60 * 1000) return;
    fetch(UAL_API_URL + "?check=1&device=" + encodeURIComponent(device))
      .then((r) => r.json())
      .then((r) => {
        if (!r || !r.ok) return;
        set("ual-block", JSON.stringify({ block: r.block || "", t: Date.now() }));
        if (r.block === "site") showBlocked();
        else if (cached.block === "site") location.reload();
      })
      .catch(() => {});
  }

  return {
    device, ua, type, logView, checkBlock,
    lastName: () => get("ual-last-name"),
    rememberName: (n) => set("ual-last-name", n),
  };
})();
