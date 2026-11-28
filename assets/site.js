// Спільні шапка, меню розділів, підменю та футер для всіх сторінок.
// Щоб додати сторінку — додай її в SECTIONS (у наявний розділ або новий).
// hidden: true — сторінка належить розділу, але не показується в підменю.
const SECTIONS = [
  { title: "Головна", home: true, pages: [{ href: "./", title: "Головна" }, { href: "vhid", title: "Хто ти?", hidden: true }] },
  {
    title: "F4", icon: "📝", accent: "#e07a5f",
    desc: "Заявка на вільний день: подати, стежити за рішенням, звіт",
    pages: [{ href: "f4", title: "Заявка на вільний день" }],
  },
  {
    title: "Таймлайн", icon: "📅", accent: "#f7aa3a",
    desc: "Модулі року, вишколи, канікули та спорядження",
    pages: [
      { href: "timeline", title: "Таймлайн року" },
      { href: "sporyadzhennia", title: "Спорядження на вишкіл" },
    ],
  },
  {
    title: "Бібліотека", icon: "📚", accent: "#4fb8a8",
    desc: "Книжки осередку: каталог, пошук і журнал, у кого яка книжка",
    pages: [
      { href: "biblioteka", title: "Каталог" },
      { href: "knyha", title: "Книжка", hidden: true },
    ],
  },
  {
    title: "Навчання", icon: "🎓", accent: "#8b86d9",
    desc: "Стратегічні теми, кейс-метод і книжки до прочитання",
    pages: [
      { href: "temy", title: "Стратегічні теми" },
      { href: "keysy", title: "Кейси" },
      { href: "knyzhky", title: "Книжки до прочитання" },
    ],
  },
  {
    title: "«ГЕНОМ» Лідера", icon: "🧬", accent: "#d8a24a",
    desc: "Десять генів особистого лідерства і детальні розбори",
    pages: [
      { href: "genom", title: "Усі гени" },
      { href: "gen-d", title: "D · Decision Making" },
    ],
  },
  {
    title: "Самоврядування", icon: "🏛️", accent: "#6c6fe0",
    desc: "Рада осередку, капітани, департаменти, студадмін і правила",
    pages: [
      { href: "samovryaduvannya", title: "Огляд" },
      { href: "model", title: "Освітня модель" },
      { href: "rada", title: "Рада осередку" },
      { href: "kapitany", title: "Капітани" },
      { href: "departamenty", title: "Департаменти" },
      { href: "studadmin", title: "Студадмін і чергові" },
      { href: "porushennia", title: "Порушення правил" },
    ],
  },
  {
    title: "Партнерства", icon: "🤝", accent: "#f08da0",
    desc: "Як осередок шукає партнерів і будує з ними співпрацю",
    pages: [{ href: "partnerstva", title: "Партнерства" }],
  },
  {
    title: "Учасники", icon: "👥", accent: "#5b8def",
    desc: "Студенти й ментори осередку — лише для своїх",
    pages: [{ href: "uchasnyky", title: "Учасники УАЛ" }],
  },
  {
    title: "Дні народження", icon: "🎂", accent: "#c9d52a",
    desc: "Календар днів народження студентів і найближчі свята",
    pages: [{ href: "dni-narodzhennia", title: "Дні народження" }],
  },
];
window.UAL_SECTIONS = SECTIONS;

(function () {
  // Адреси без «.html»: biblioteka.html → biblioteka, index.html → ./
  if (/\.html$/.test(location.pathname)) {
    const clean = location.pathname.replace(/index\.html$/, "").replace(/\.html$/, "");
    history.replaceState(null, "", clean + location.search + location.hash);
  }
  const pageOf = (h) => (h.split(/[?#]/)[0].split("/").pop().replace(/\.html$/, "") || "index").replace(/^\.$/, "index");
  const current = pageOf(location.pathname);
  const section = SECTIONS.find((s) => s.pages.some((p) => pageOf(p.href) === current)) || SECTIONS[0];
  const page = section.pages.find((p) => pageOf(p.href) === current) || section.pages[0];
  const visible = section.pages.filter((p) => !p.hidden);
  const tiles = SECTIONS.filter((s) => !s.home);

  // Назва вкладки: «УАЛ | Розділ» або «УАЛ | Сторінка» для підсторінок
  // (прихована сторінка, як-от картка книжки, ставить назву сама)
  if (!page.hidden) document.title = `УАЛ | ${page === visible[0] ? section.title : page.title}`;

  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <div class="wrap">
      <div class="brand">
        <a class="brand-home" href="./" title="На головну"><span class="brand-logo">A</span><span class="brand-ual">УАЛ</span></a>
        ${section.home ? "" : `<span class="brand-sep">|</span><a class="brand-section" href="${visible[0].href}">${section.title}</a>`}
      </div>
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="menu-panel">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>
        <span>Розділи</span>
      </button>
    </div>
    <div class="menu-panel" id="menu-panel" hidden>
      <div class="wrap">
        <div class="menu-grid">
          ${tiles.map((s) => `
            <a class="menu-item${s === section ? " active" : ""}" href="${s.pages[0].href}" style="--acc:${s.accent}">
              <span class="menu-ico">${s.icon}</span>
              <span><b>${s.title}</b><small>${s.desc}</small></span>
            </a>`).join("")}
        </div>
      </div>
    </div>`;
  document.body.prepend(header);

  // Оголошення на всіх сторінках (до вказаної дати включно)
  const NOTICES = [
    { until: "2026-12-04", html: "📣 <b>Ткаченко Марія</b> більше не навчається в УАЛ Львів. Дякуємо їй за спільний шлях!", link: "uchasnyky" },
  ];
  const todayKey = new Date().toLocaleDateString("sv");
  NOTICES.filter((n) => todayKey <= n.until).forEach((n) => {
    const bar = document.createElement("div");
    bar.className = "site-notice";
    bar.innerHTML = `<div class="wrap"><span>${n.html}</span>${n.link && current !== n.link ? `<a href="${n.link}">Учасники →</a>` : ""}</div>`;
    header.after(bar);
  });

  // Повідомлення від адміна (аркуш «Повідомлення» в таблиці сайту)
  const escN = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const linkify = (t) => escN(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, "<br>");
  const box = document.createElement("div");
  box.className = "admin-notices";
  header.after(box);
  const onceShown = {};                       // «Один раз»: показали на цій сторінці — тримаємо до переходу
  const ICON = { info: "💬", important: "⚠️", once: "📌", critical: "🚨" };
  function showNotices() {
    const all = typeof UAL !== "undefined" && UAL.token && UAL.notices ? UAL.notices() : [];
    all.filter((n) => n.kind === "once" && !onceShown[n.id]).forEach((n) => { onceShown[n.id] = n; UAL.noticeSeen(n.id); });
    const bars = all.filter((n) => n.kind !== "critical" && n.kind !== "once").concat(Object.values(onceShown));
    box.innerHTML = bars.map((n) => `
      <div class="site-notice admin-notice${n.important ? " important" : ""}" data-id="${escN(n.id)}">
        <div class="wrap"><span>${ICON[n.kind] || "💬"} <b>${n.personal ? "Тобі від адміністратора" : "Від адміністратора"}:</b> ${linkify(n.text)}</span>
        ${n.kind === "once" ? `<button class="btn small ghost" type="button" data-hide>✕</button>` : `<button class="btn small ghost" type="button" data-seen>Зрозуміло</button>`}</div>
      </div>`).join("");
    // «Критичне» — вікно посеред екрану, по одному
    const crit = all.find((n) => n.kind === "critical");
    let modal = document.getElementById("notice-modal");
    if (!crit) { if (modal) modal.remove(); return; }
    if (modal && modal.dataset.id === crit.id) return;
    if (modal) modal.remove();
    modal = document.createElement("div");
    modal.id = "notice-modal"; modal.className = "notice-modal"; modal.dataset.id = crit.id;
    modal.innerHTML = `<div class="notice-modal-box" role="alertdialog" aria-modal="true" aria-labelledby="nm-title">
      <div class="notice-modal-ico">🚨</div>
      <h2 id="nm-title">${crit.personal ? "Тобі від адміністратора" : "Важливо від адміністратора"}</h2>
      <p>${linkify(crit.text)}</p>
      <button class="btn" type="button" data-crit>Зрозуміло</button></div>`;
    document.body.appendChild(modal);
    modal.querySelector("[data-crit]").addEventListener("click", () => { UAL.noticeSeen(crit.id); modal.remove(); showNotices(); });
    modal.querySelector("[data-crit]").focus();
  }
  box.addEventListener("click", (e) => {
    const h = e.target.closest("[data-hide]");
    if (h) { const el = h.closest(".admin-notice"); delete onceShown[el.dataset.id]; el.remove(); }
  });
  showNotices();
  window.addEventListener("ual:notices", showNotices);

  const btn = header.querySelector(".menu-btn");
  const panel = header.querySelector(".menu-panel");
  const setOpen = (open) => {
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", open);
    header.classList.toggle("menu-open", open);
  };
  btn.addEventListener("click", (e) => { e.stopPropagation(); setOpen(panel.hidden); });
  document.addEventListener("click", (e) => { if (!panel.hidden && !panel.contains(e.target)) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });

  const main = document.querySelector("main");
  if (visible.length > 1) {
    // Підменю розділу
    const sub = document.createElement("div");
    sub.className = "subnav";
    sub.innerHTML = `<div class="wrap">${visible
      .map((p) => `<a href="${p.href}"${pageOf(p.href) === current ? ' class="active"' : ""}>${p.title}</a>`)
      .join("")}</div>`;
    header.after(sub);
    const row = sub.querySelector(".wrap");
    const act = row.querySelector("a.active");
    if (act) row.scrollLeft = act.offsetLeft - (row.clientWidth - act.offsetWidth) / 2;

    // Назад / далі в межах розділу
    const idx = visible.findIndex((p) => pageOf(p.href) === current);
    if (idx !== -1 && main) {
      const prev = visible[idx - 1];
      const next = visible[idx + 1];
      const pager = document.createElement("div");
      pager.className = "wrap pager";
      pager.innerHTML =
        (prev ? `<a href="${prev.href}"><small>← Назад</small>${prev.title}</a>` : "<span></span>") +
        (next ? `<a class="next" href="${next.href}"><small>Далі →</small>${next.title}</a>` : "");
      main.appendChild(pager);
    }
  }

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="wrap">
      <a href="./"><b>УАЛ</b> · осередок Львів</a>
      <span class="footer-note">Неофіційний студентський сайт осередку, не є офіційним ресурсом УАЛ</span>
    </div>`;
  document.body.appendChild(footer);
  // Хто ти — у футері, з можливістю змінити
  // Ментор / адмін — з позначкою ролі (видно, що сайт уже підтягнув роль з таблиці)
  const roleTag = (r) => (r === "Адмін" ? " (адмін)" : r === "Ментор" ? " (ментор)" : r === "Керівник осередку" ? " (керівник)" : "");
  const me = document.createElement("a");
  me.className = "footer-me";
  me.href = "vhid";
  const showMe = () => {
    const on = typeof UAL !== "undefined" && UAL.me;
    me.textContent = on ? "Ти: " + UAL.me + roleTag(UAL.role) : "";
    if (on && !me.isConnected) footer.querySelector(".wrap").appendChild(me);
    if (!on && me.isConnected) me.remove();
  };
  showMe();
  window.addEventListener("ual:who", showMe);

  // Кнопка «Вгору» — з'являється, коли прокрутив сторінку вниз
  const up = document.createElement("button");
  up.type = "button";
  up.className = "to-top";
  up.setAttribute("aria-label", "Повернутися вгору");
  up.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
  up.addEventListener("click", () => window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  document.body.appendChild(up);
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { up.classList.toggle("show", window.scrollY > 600); ticking = false; });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Святковий режим: з 25 листопада до кінця лютого.
  // Перевизначення: ?xmas=1 / ?xmas=0 у посиланні або тумблер власника (зберігається в цьому браузері).
  const XMAS_KEY = "ual-xmas";
  const xmasPref = () => { try { return localStorage.getItem(XMAS_KEY) || ""; } catch (e) { return ""; } };
  const force = new URLSearchParams(location.search).get("xmas");
  const today = new Date(), mon = today.getMonth();
  const season = [11, 0, 1].includes(mon) || (mon === 10 && today.getDate() >= 25);
  const pref = xmasPref();
  if (force === "1" || (force !== "0" && (pref === "on" || (pref !== "off" && season)))) {
    const x = document.createElement("script");
    x.src = "assets/xmas.js?v=20261146";
    x.defer = true;
    document.body.appendChild(x);
  }

  // Тумблер у футері — лише для пристрою власника. У коді зберігається не сам код пристрою,
  // а його PBKDF2-хеш, тож дізнатися код звідси не можна.
  const OWNER = "0eb18e6c91af8f3a78a618bca0fc714bd56cc64a490121e29d04665660d1e175";
  (async () => {
    try {
      const dev = typeof UAL !== "undefined" ? UAL.device : "";
      if (!dev || !crypto.subtle) return;
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(dev), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new TextEncoder().encode("ual-xmas-owner"), iterations: 100000, hash: "SHA-256" }, key, 256);
      if ([...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("") !== OWNER) return;
      const modes = [["", "авто (25.11 — 28.02)"], ["on", "увімкнено"], ["off", "вимкнено"]];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "owner-xmas";
      const cur = () => modes.find((m) => m[0] === xmasPref()) || modes[0];
      btn.textContent = "🎄 Святковий режим: " + cur()[1];
      btn.addEventListener("click", () => {
        const next = modes[(modes.indexOf(cur()) + 1) % modes.length][0];
        try { next ? localStorage.setItem(XMAS_KEY, next) : localStorage.removeItem(XMAS_KEY); } catch (e) {}
        location.reload();
      });
      footer.querySelector(".wrap").appendChild(btn);
    } catch (e) {}
  })();

  if (typeof UAL !== "undefined") { UAL.checkBlock(); UAL.logView(); }
})();
