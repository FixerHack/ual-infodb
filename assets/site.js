// Спільні шапка, меню та футер для всіх сторінок.
// Щоб додати нову сторінку — додай її в PAGES.
const PAGES = [
  { href: "index.html", title: "Головна" },
  { href: "rada.html", title: "Рада осередку" },
  { href: "kapitany.html", title: "Капітани" },
  { href: "departamenty.html", title: "Департаменти" },
  { href: "studadmin.html", title: "Студадмін і чергові" },
];

(function () {
  const current = location.pathname.split("/").pop() || "index.html";
  const idx = PAGES.findIndex((p) => p.href === current);

  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <div class="wrap">
      <a class="brand" href="index.html"><span class="brand-logo">A</span>Самоврядування УАЛ</a>
      <button class="nav-toggle" aria-label="Меню">☰</button>
      <nav class="nav">
        ${PAGES.map((p) => `<a href="${p.href}"${p.href === current ? ' class="active"' : ""}>${p.title}</a>`).join("")}
      </nav>
    </div>`;
  document.body.prepend(header);
  header.querySelector(".nav-toggle").addEventListener("click", () => {
    header.querySelector(".nav").classList.toggle("open");
  });

  const main = document.querySelector("main");
  if (main && idx !== -1 && !main.dataset.noPager) {
    const prev = PAGES[idx - 1];
    const next = PAGES[idx + 1];
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
      <span>Система самоврядування осередку</span>
    </div>`;
  document.body.appendChild(footer);
})();
