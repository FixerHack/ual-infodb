// Спільні шапка, меню, підменю розділу та футер для всіх сторінок.
// Щоб додати сторінку — додай її в SECTIONS (у наявний розділ або новий).
const SECTIONS = [
  { title: "Головна", pages: [{ href: "index.html", title: "Головна" }] },
  { title: "Таймлайн року", pages: [{ href: "timeline.html", title: "Таймлайн року" }] },
  { title: "Стратегічні теми", pages: [{ href: "temy.html", title: "Стратегічні теми" }] },
  { title: "«ГЕНОМ» Лідера", pages: [{ href: "genom.html", title: "«ГЕНОМ» Лідера" }] },
  { title: "Дні народження", pages: [{ href: "dni-narodzhennia.html", title: "Дні народження" }] },
  {
    title: "Самоврядування",
    pages: [
      { href: "samovryaduvannya.html", title: "Огляд" },
      { href: "model.html", title: "Освітня модель" },
      { href: "rada.html", title: "Рада осередку" },
      { href: "kapitany.html", title: "Капітани" },
      { href: "departamenty.html", title: "Департаменти" },
      { href: "studadmin.html", title: "Студадмін і чергові" },
    ],
  },
];

(function () {
  const current = location.pathname.split("/").pop() || "index.html";
  const section = SECTIONS.find((s) => s.pages.some((p) => p.href === current));

  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <div class="wrap">
      <a class="brand" href="index.html"><span class="brand-logo">A</span>Документація УАЛ</a>
      <button class="nav-toggle" aria-label="Меню">☰</button>
      <nav class="nav">
        ${SECTIONS.map((s) => `<a href="${s.pages[0].href}"${s === section ? ' class="active"' : ""}>${s.title}</a>`).join("")}
      </nav>
    </div>`;
  document.body.prepend(header);

  const toggle = header.querySelector(".nav-toggle");
  const nav = header.querySelector(".nav");
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = nav.classList.toggle("open");
    toggle.textContent = open ? "✕" : "☰";
  });
  document.addEventListener("click", (e) => {
    if (nav.classList.contains("open") && !nav.contains(e.target)) {
      nav.classList.remove("open");
      toggle.textContent = "☰";
    }
  });

  const main = document.querySelector("main");
  if (section && section.pages.length > 1) {
    // Підменю розділу
    const sub = document.createElement("div");
    sub.className = "subnav";
    sub.innerHTML = `<div class="wrap"><span class="subnav-title">${section.title}</span>${section.pages
      .map((p) => `<a href="${p.href}"${p.href === current ? ' class="active"' : ""}>${p.title}</a>`)
      .join("")}</div>`;
    header.after(sub);
    const row = sub.querySelector(".wrap");
    const act = row.querySelector("a.active");
    if (act) row.scrollLeft = act.offsetLeft - (row.clientWidth - act.offsetWidth) / 2;

    // Назад / далі в межах розділу
    const idx = section.pages.findIndex((p) => p.href === current);
    const prev = section.pages[idx - 1];
    const next = section.pages[idx + 1];
    const pager = document.createElement("div");
    pager.className = "wrap pager";
    pager.innerHTML =
      (prev ? `<a href="${prev.href}"><small>← Назад</small>${prev.title}</a>` : "<span></span>") +
      (next ? `<a class="next" href="${next.href}"><small>Далі →</small>${next.title}</a>` : "");
    main.appendChild(pager);
  }

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="wrap">
      <span>Українська Академія Лідерства · осередок Львів</span>
      <span>Документація для студентів</span>
    </div>`;
  document.body.appendChild(footer);
})();
