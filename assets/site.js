// Спільні шапка, меню розділів, підменю та футер для всіх сторінок.
// Щоб додати сторінку — додай її в SECTIONS (у наявний розділ або новий).
// hidden: true — сторінка належить розділу, але не показується в підменю.
const SECTIONS = [
  { title: "Головна", home: true, pages: [{ href: "index.html", title: "Головна" }] },
  {
    title: "Таймлайн", icon: "📅", accent: "#f7aa3a",
    desc: "Модулі року, вишколи, канікули, розклад англійської та спорядження",
    pages: [
      { href: "timeline.html", title: "Таймлайн року" },
      { href: "angliyska.html", title: "Розклад англійської" },
      { href: "sporyadzhennia.html", title: "Спорядження на вишкіл" },
    ],
  },
  {
    title: "Бібліотека", icon: "📚", accent: "#4fb8a8",
    desc: "Книжки осередку: каталог, пошук і журнал, у кого яка книжка",
    pages: [
      { href: "biblioteka.html", title: "Каталог" },
      { href: "knyha.html", title: "Книжка", hidden: true },
    ],
  },
  {
    title: "Навчання", icon: "🎓", accent: "#8b86d9",
    desc: "Стратегічні теми, кейс-метод і книжки до прочитання",
    pages: [
      { href: "temy.html", title: "Стратегічні теми" },
      { href: "keysy.html", title: "Кейси" },
      { href: "knyzhky.html", title: "Книжки до прочитання" },
    ],
  },
  {
    title: "«ГЕНОМ» Лідера", icon: "🧬", accent: "#d8a24a",
    desc: "Десять генів особистого лідерства і детальні розбори",
    pages: [
      { href: "genom.html", title: "Усі гени" },
      { href: "gen-d.html", title: "D · Decision Making" },
    ],
  },
  {
    title: "Самоврядування", icon: "🏛️", accent: "#6c6fe0",
    desc: "Рада осередку, капітани, департаменти, студадмін і правила",
    pages: [
      { href: "samovryaduvannya.html", title: "Огляд" },
      { href: "model.html", title: "Освітня модель" },
      { href: "rada.html", title: "Рада осередку" },
      { href: "kapitany.html", title: "Капітани" },
      { href: "departamenty.html", title: "Департаменти" },
      { href: "studadmin.html", title: "Студадмін і чергові" },
      { href: "porushennia.html", title: "Порушення правил" },
    ],
  },
  {
    title: "Партнерства", icon: "🤝", accent: "#f08da0",
    desc: "Як осередок шукає партнерів і будує з ними співпрацю",
    pages: [{ href: "partnerstva.html", title: "Партнерства" }],
  },
  {
    title: "Дні народження", icon: "🎂", accent: "#c9d52a",
    desc: "Календар днів народження студентів і найближчі свята",
    pages: [{ href: "dni-narodzhennia.html", title: "Дні народження" }],
  },
];
window.UAL_SECTIONS = SECTIONS;

(function () {
  const current = location.pathname.split("/").pop() || "index.html";
  const section = SECTIONS.find((s) => s.pages.some((p) => p.href === current)) || SECTIONS[0];
  const page = section.pages.find((p) => p.href === current) || section.pages[0];
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
        <a class="brand-home" href="index.html" title="На головну"><span class="brand-logo">A</span><span class="brand-ual">УАЛ</span></a>
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
      .map((p) => `<a href="${p.href}"${p.href === current ? ' class="active"' : ""}>${p.title}</a>`)
      .join("")}</div>`;
    header.after(sub);
    const row = sub.querySelector(".wrap");
    const act = row.querySelector("a.active");
    if (act) row.scrollLeft = act.offsetLeft - (row.clientWidth - act.offsetWidth) / 2;

    // Назад / далі в межах розділу
    const idx = visible.findIndex((p) => p.href === current);
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
      <a href="index.html"><b>УАЛ</b> · осередок Львів</a>
      <span class="footer-note">Неофіційний студентський сайт осередку, не є офіційним ресурсом УАЛ</span>
    </div>`;
  document.body.appendChild(footer);
})();
