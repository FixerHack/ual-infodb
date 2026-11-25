// Святковий режим (1 грудня — кінець лютого). Підключається з site.js лише в сезон.
//  • тихий сніг із символів «+ * .» на всіх сторінках (вимикається кнопкою ❄, запам'ятовується в браузері);
//  • на головній — ASCII-ялинка: росте, прикрашається, крутиться і вітає.
// Ялинка — порт процедурного терміналового скрипта на JavaScript: точки поверхні → проєкція →
// z-буфер на сітці символів → затінення → зірка й напис зверху.
(() => {
  const TAU = Math.PI * 2;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
                  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  const now = new Date();
  const XMAS = now.getMonth() >= 10;  // листопад–грудень — Різдво, січень–лютий — Новий рік
  const MESSAGE = XMAS ? `MERRY CHRISTMAS ${now.getFullYear()}` : `HAPPY NEW YEAR ${now.getFullYear()}`;
  document.documentElement.classList.add("xmas");

  // ======================================================================== сніг на сторінці
  function pageSnow() {
    const cv = document.createElement("canvas");
    cv.className = "xmas-snow";
    cv.setAttribute("aria-hidden", "true");
    document.body.appendChild(cv);
    const ctx = cv.getContext("2d");
    let W = 0, H = 0, lastW = 0, flakes = [], raf = 0, last = 0, on = store.get("ual-snow") !== "off";
    const dark = matchMedia("(prefers-color-scheme: dark)");

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(110, Math.round(W * H / 14000));
      // на телефоні висота «стрибає» від панелі адреси під час скролу — сніжинки не перегенеровуємо
      if (Math.abs(flakes.length - n) > 8 || W !== lastW) flakes = Array.from({ length: n }, () => newFlake(Math.random() * H));
      lastW = W;
    }
    function newFlake(y) {
      const r = Math.random();
      return { x: Math.random() * W, y, vy: 12 + Math.random() * 30, ph: Math.random() * TAU, sw: 6 + Math.random() * 14,
               ch: r < 0.6 ? "+" : r < 0.85 ? "*" : ".", size: 9 + Math.random() * 7, a: 0.35 + Math.random() * 0.5 };
    }
    function draw(ts) {
      raf = requestAnimationFrame(draw);
      if (ts - last < 1000 / 30 - 2) return;          // 30 кадрів на секунду досить; на 120-Гц екранах це вчетверо менше роботи
      const dt = Math.min(0.1, (ts - last) / 1000 || 0);
      last = ts;
      ctx.clearRect(0, 0, W, H);
      const rgb = dark.matches ? "220,228,255" : "108,111,224";
      ctx.textAlign = "center";
      for (const f of flakes) {
        f.y += f.vy * dt;
        if (f.y > H + 10) Object.assign(f, newFlake(-10));
        const x = f.x + Math.sin(ts / 1400 + f.ph) * f.sw;
        ctx.font = `${f.size}px Menlo, Consolas, monospace`;
        ctx.fillStyle = `rgba(${rgb},${f.a * (dark.matches ? 0.75 : 0.45)})`;
        ctx.fillText(f.ch, x, f.y);
      }
    }
    function start() { if (!raf && on && !reduce && document.visibilityState === "visible") { last = 0; raf = requestAnimationFrame(draw); } }
    function stop() { cancelAnimationFrame(raf); raf = 0; ctx.clearRect(0, 0, W, H); }
    let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(resize, 150); });   // на телефоні resize летить при кожному скролі
    document.addEventListener("visibilitychange", () => (document.visibilityState === "visible" ? start() : stop()));
    resize();
    start();

    // кнопка ❄ — увімкнути / вимкнути сніг
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "xmas-toggle";
    const label = () => {
      btn.classList.toggle("off", !on);
      btn.setAttribute("aria-label", on ? "Вимкнути сніг" : "Увімкнути сніг");
      btn.title = btn.getAttribute("aria-label");
    };
    btn.textContent = "❄";
    btn.addEventListener("click", () => { on = !on; store.set("ual-snow", on ? "on" : "off"); on ? start() : stop(); label(); });
    label();
    if (!reduce) document.body.appendChild(btn);
  }

  // ======================================================================== ASCII-ялинка
  // ---- таймлайн (секунди)
  const T_GROW = [1.3, 6.2], T_GARLAND = [6.2, 9.4], T_BALLS = [8.0, 10.2], T_LIGHTS = [8.2, 11.5], T_GIFTS = [10.0, 11.5];
  const T_STAR = 11.65, T_MSG = 12.9, ROT_SPEED = 0.31, FPS = 30;
  // ---- геометрія
  const GROUND = 0, Y0 = 0.25, Y1 = 2.42, R_BASE = 0.78, CAM_TILT = 0.17;
  // ---- палітра
  const WHITE = [1, 1, 1], RED = [1, 0.2, 0.18], GOLD = [1, 0.78, 0.26], BAUBLE_GOLD = [1, 0.7, 0.2];
  const GREEN_BOX = [0.14, 0.78, 0.36], BLUE_BOX = [0.25, 0.45, 1], WARM = [1, 0.8, 0.42];
  const NEEDLE = 0, SNOW = 1, TRUNK = 2, TINSEL = 3, BALL = 4, LIGHT = 5, BOX = 6;
  const RAMP = ['.:^~"-vxo*=%&#WW@', "*#W@", "H", "=#%@#", "%&#@@", "oO0", "x%#X@"];
  const norm3 = (x, y, z) => { const l = Math.hypot(x, y, z) + 1e-9; return [x / l, y / l, z / l]; };
  const LDIR = norm3(-0.5, 0.6, 0.62), HDIR = norm3(LDIR[0], LDIR[1], LDIR[2] + 1);
  const clip = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const smooth = (x) => { x = clip(x); return x * x * (3 - 2 * x); };
  const envelope = (y) => R_BASE * Math.pow(1 - clip((y - Y0) / (Y1 - Y0)), 0.95) + 0.02;
  const growTime = (y) => T_GROW[0] + (T_GROW[1] - T_GROW[0]) * clip((y - GROUND) / (Y1 - GROUND));

  function rng(seed) {                                   // mulberry32 + нормальний розподіл
    let a = seed >>> 0;
    const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    r.normal = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(TAU * r());
    r.uni = (a1, b1) => a1 + (b1 - a1) * r();
    return r;
  }
  function fibSphere(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const k = i + 0.5, phi = Math.acos(1 - 2 * k / n), th = Math.PI * (1 + Math.sqrt(5)) * k;
      out.push([Math.cos(th) * Math.sin(phi), Math.cos(phi), Math.sin(th) * Math.sin(phi)]);
    }
    return out;
  }

  // Точки поверхні: де стоїть, нормаль, колір, з чого зроблена, коли з'являється, як «вискакує»
  function build(Q) {
    const r = rng(7);
    const P = [], N = [], C = [], K = [], T0 = [], B = [], CE = [], POP = [], PH = [];
    const add = (p, n, c, k, t0, base = 1, ce = null, pop = 0, ph = 0) => {
      P.push(p[0], p[1], p[2]); N.push(n[0], n[1], n[2]); C.push(c[0], c[1], c[2]); K.push(k); T0.push(t0); B.push(base);
      const cc = ce || p; CE.push(cc[0], cc[1], cc[2]); POP.push(pop); PH.push(ph);
    };
    const tips = [];
    // хвоя: яруси гілок, що звисають; внизу густіші й довші
    for (let i = 0; i < 24; i++) {
      const y = Y0 + 0.02 + (Y1 - 0.06 - (Y0 + 0.02)) * i / 23;
      const u = (y - Y0) / (Y1 - Y0), R = envelope(y) + 0.05, nb = Math.floor(6 + 12 * (1 - u));
      for (let b = 0; b < nb; b++) {
        const a = TAU * (b + 0.5 * r()) / nb + i * 0.77, L = R * r.uni(0.85, 1.08), n = Math.floor((25 + 270 * L) * Q);
        const dx = Math.cos(a), dz = Math.sin(a), sx = -Math.sin(a), sz = Math.cos(a);
        for (let j = 0; j < n; j++) {
          const s = Math.pow(r(), 0.65), spread = (0.025 + 0.09 * s) * r.normal(), sl = s * L;
          const p = [dx * sl + sx * spread, y + 0.06 * sl - 0.2 * sl * sl + 0.012 * r.normal(), dz * sl + sz * spread];
          const nr = norm3(dx * 0.75 + 0.3 * r.normal(), 0.55 + 0.3 * r.normal(), dz * 0.75 + 0.3 * r.normal());
          const ao = (0.3 + 0.7 * Math.pow(s, 1.3)) * r.uni(0.75, 1.1);
          const snow = s > 0.5 && r() < 0.06 * s && nr[1] > 0.5;
          const g = r();
          add(p, nr, snow ? WHITE : [0.1 + 0.12 * g, 0.48 + 0.38 * g, 0.18 + 0.14 * g], snow ? SNOW : NEEDLE, growTime(y) + 0.45 * s, snow ? 1 : ao);
        }
        const tl = 0.93 * L;
        tips.push([dx * tl, y + 0.06 * tl - 0.2 * tl * tl, dz * tl]);
      }
    }
    // темний внутрішній конус, щоб крізь гілки нічого не просвічувало
    for (let j = 0, m = Math.floor(6000 * Q); j < m; j++) {
      const y = Y0 + (Y1 - 0.1 - Y0) * r(), phi = r() * TAU, rr = 0.6 * envelope(y);
      add([Math.cos(phi) * rr, y, Math.sin(phi) * rr], [Math.cos(phi), 0.3, Math.sin(phi)], [0.1, 0.42, 0.16], NEEDLE, growTime(y), 0.75);
    }
    // стовбур
    for (let j = 0, m = Math.floor(1500 * Q); j < m; j++) {
      const y = GROUND + r() * (Y0 + 0.1 - GROUND), phi = r() * TAU, bark = 0.75 + 0.25 * Math.sign(Math.sin(phi * 30 + y * 5));
      add([Math.cos(phi) * 0.08, y, Math.sin(phi) * 0.08], [Math.cos(phi), 0, Math.sin(phi)], [0.42 * bark, 0.26 * bark, 0.14 * bark], TRUNK, growTime(y));
    }
    // золота гірлянда — спіраль, що провисає між точками
    const gn = Math.floor(2600 * Q);
    for (let c = 0; c < 4; c++) {
      for (let j = 0; j < gn; j++) {
        const u = j / (gn - 1), yg = Y0 + 0.15 + (Y1 - Y0 - 0.45) * u, ag = TAU * 3.6 * u + 0.9;
        const swag = -0.07 * Math.abs(Math.sin(ag * 2.5)), rg = envelope(yg) + 0.07;
        add([Math.cos(ag) * rg + 0.016 * r.normal(), yg + swag + 0.016 * r.normal(), Math.sin(ag) * rg + 0.016 * r.normal()],
            [Math.cos(ag) + 0.6 * r.normal(), 0.3 + 0.6 * r.normal(), Math.sin(ag) + 0.6 * r.normal()], GOLD, TINSEL,
            T_GARLAND[0] + u * (T_GARLAND[1] - T_GARLAND[0]), 1, null, 0, r());
      }
    }
    // кульки: половина червоні, половина золоті
    const sph = fibSphere(Q < 1 ? 110 : 160);
    for (let k = 0; k < 34; k++) {
      const u = (k + r()) / 34, y = Y0 + 0.08 + u * (Y1 - Y0 - 0.38), a = k * 2.39996 + r() * 0.4, e = envelope(y);
      const c = [Math.cos(a) * e, y - 0.03, Math.sin(a) * e], rad = 0.058 + 0.032 * (1 - u);
      const t0 = T_BALLS[0] + r() * (T_BALLS[1] - T_BALLS[0]), col = k % 2 === 0 ? RED : BAUBLE_GOLD;
      for (const s of sph) add([c[0] + s[0] * rad, c[1] + s[1] * rad, c[2] + s[2] * rad], s, col, BALL, t0, 1, c, 1);
    }
    // вогники на кінчиках гілок
    const bulb = fibSphere(16);
    const order = tips.map((t, i) => [r(), i]).sort((x, y) => x[0] - y[0]).slice(0, Math.min(170, tips.length));
    for (const [, i] of order) {
      const c = tips[i], t0 = T_LIGHTS[0] + r() * (T_LIGHTS[1] - T_LIGHTS[0]);
      const col = r() < 0.8 ? WARM : [1, 0.95, 0.85], ph = r() * TAU;
      for (const s of bulb) add([c[0] + s[0] * 0.03, c[1] + s[1] * 0.03, c[2] + s[2] * 0.03], s, col, LIGHT, t0, 1, c, 0, ph);
    }
    // подарунки: коробки зі стрічкою хрест-навхрест і бантом
    const gifts = [[0.3, 1.12, 0.3, 0.24, 0.28, 0.4, RED, GOLD], [1.5, 1.18, 0.26, 0.3, 0.24, 2.1, BLUE_BOX, WHITE],
      [2.6, 1.1, 0.34, 0.18, 0.26, 1.0, GOLD, RED], [3.7, 1.18, 0.24, 0.26, 0.22, 0.7, WHITE, RED],
      [4.7, 1.12, 0.3, 0.22, 0.3, 0.1, GREEN_BOX, RED], [5.6, 1.22, 0.22, 0.2, 0.22, 1.7, RED, WHITE]];
    const loop = fibSphere(80), FN = [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
    gifts.forEach(([a, dist, w, h, d, rot, body, rib], g) => {
      const areas = [w * d, h * d, h * d, h * w, h * w], tot = areas.reduce((x, y) => x + y, 0);
      const cr = Math.cos(rot), sr = Math.sin(rot), foot = [Math.cos(a) * dist, GROUND, Math.sin(a) * dist];
      const turn = (v) => [cr * v[0] + sr * v[2], v[1], -sr * v[0] + cr * v[2]];
      const t0 = T_GIFTS[0] + g * 0.28, ce = [foot[0], h / 2, foot[2]];
      const put = (lp, n, col) => { const p = turn(lp); add([p[0] + foot[0], p[1] + foot[1], p[2] + foot[2]], turn(n), col, BOX, t0, 1, ce, 1); };
      for (let j = 0, m = Math.floor(5000 * tot * Q); j < m; j++) {
        let x = r() * tot, face = 0;
        while (face < 4 && x > areas[face]) x -= areas[face++];
        const fa = r() - 0.5, fb = r() - 0.5;
        const lx = face === 0 ? fa * w : face === 1 ? w / 2 : face === 2 ? -w / 2 : fa * w;
        const ly = face === 0 ? h : (fb + 0.5) * h;
        const lz = face === 0 ? fb * d : face <= 2 ? fa * d : face === 3 ? d / 2 : -d / 2;
        const ox = Math.abs(lx) < 0.022, oz = Math.abs(lz) < 0.022;
        const ribbon = face === 0 ? ox || oz : face <= 2 ? oz : ox;
        put([lx, ly, lz], FN[face], ribbon ? rib : body);
      }
      for (const sx of [-1, 1]) for (const s of loop) put([s[0] * 0.05 + sx * 0.045, s[1] * 0.03 + h + 0.025, s[2] * 0.025], s, rib);
    });
    const f = (a) => Float32Array.from(a);
    return { n: K.length, pos: f(P), nrm: f(N), col: f(C), kind: Uint8Array.from(K), t0: f(T0), base: f(B), centre: f(CE), pop: Uint8Array.from(POP), phase: f(PH) };
  }

  // Сцена: розміри сітки символів, розкладка, небо, буфери
  function makeScene(q, cols, rows, aspect) {
    const st = Math.sin(CAM_TILT), ct = Math.cos(CAM_TILT);
    const k = Math.min(cols / 3.03, (rows - 6) / (3.15 * aspect)), kk = k * 1.04;
    const topH = (Y1 + 0.09) * ct * kk * aspect, lowH = 1.3 * st * kk * aspect;
    const first = Math.max(1, (rows - 3 - topH - lowH) / 2);
    const L = { SCALE: k, ROW0: first + topH, MSG_ROW: Math.floor(Math.min(first + topH + lowH + 1.5, rows - 2)), RPU: k * aspect, HORIZON: Math.floor(rows * 0.5) };
    // небо: пунктирна земля під горизонтом + сніжинки, що падають, гойдаються й мерехтять
    const r = rng(11), cells = cols * rows;
    const gChar = new Uint16Array(cells), gCol = new Float32Array(cells * 3);
    for (let y = 0; y < rows; y++) {
      const fz = clip((y - L.HORIZON) / (rows - L.HORIZON));
      for (let x = 0; x < cols; x++) {
        const h0 = r(), h1 = r(), h2 = r(), i = y * cols + x;
        if (fz > 0 && h0 < 0.83 + 0.14 * fz) {
          gChar[i] = (h1 < 0.62 - 0.4 * fz ? "." : h1 < 0.94 - 0.22 * fz ? "-" : "=").charCodeAt(0);
          const v = (0.22 + 0.3 * h2) * (0.65 + 0.9 * fz);
          gCol[i * 3] = 0.5 * v; gCol[i * 3 + 1] = 0.58 * v; gCol[i * 3 + 2] = 0.8 * v;
        }
      }
    }
    const nf = Math.floor(650 * cells / 6512), fl = [];
    for (let i = 0; i < nf; i++) {
      const kind = r();
      fl.push({ x0: r() * cols, y0: r() * rows, vy: r.uni(2, 8), ph: r() * TAU, tw: r.uni(1, 4),
                ch: (kind < 0.72 ? "+" : kind < 0.92 ? "*" : ".").charCodeAt(0), lum: kind < 0.92 ? r.uni(0.45, 1) : r.uni(0.25, 0.5) });
    }
    return { q, cols, rows, aspect, L, gChar, gCol, fl, char: new Uint16Array(cells), col: new Float32Array(cells * 3),
             zb: new Float32Array(cells), win: new Int32Array(cells), win2: new Int32Array(cells),
             sx: new Float32Array(q.n), sy: new Float32Array(q.n), dep: new Float32Array(q.n) };
  }

  function project(S, x0, y0, z0, rot) {
    const c = Math.cos(rot), s = Math.sin(rot), x = x0 * c + z0 * s, z = -x0 * s + z0 * c;
    const ct = Math.cos(CAM_TILT), st = Math.sin(CAM_TILT), up = y0 * ct - z * st, depth = y0 * st + z * ct;
    const k = S.L.SCALE / (1 - depth / 14);
    return [S.cols / 2 + x * k, S.L.ROW0 - up * k * S.aspect, depth];
  }

  function put(S, y, x, ch, tint, power) {
    if (y < 0 || y >= S.rows || x < 0 || x >= S.cols) return;
    const i = y * S.cols + x;
    S.char[i] = typeof ch === "number" ? ch : ch.charCodeAt(0);
    S.col[i * 3] = clip(tint[0] * power); S.col[i * 3 + 1] = clip(tint[1] * power); S.col[i * 3 + 2] = clip(tint[2] * power);
  }

  function frame(S, t) {
    const { q, cols, rows } = S, cells = cols * rows, rot = ROT_SPEED * t;
    // 0. небо
    S.char.set(S.gChar); S.col.set(S.gCol);
    for (const f of S.fl) {
      if (Math.sin(t * f.tw + f.ph * 3) <= -0.55) continue;
      const x = ((Math.round(f.x0 + 1.5 * Math.sin(t * 0.9 + f.ph)) % cols) + cols) % cols, y = Math.floor(f.y0 + f.vy * t) % rows, i = y * cols + x;
      S.char[i] = f.ch; S.col[i * 3] = f.lum * 0.92; S.col[i * 3 + 1] = f.lum * 0.95; S.col[i * 3 + 2] = f.lum;
    }
    // 1–3. наявні точки, «вискакування», проєкція, z-буфер (найближча точка займає клітинку)
    S.zb.fill(-1e9); S.win.fill(-1);
    const c = Math.cos(rot), s = Math.sin(rot), ct = Math.cos(CAM_TILT), st = Math.sin(CAM_TILT), { SCALE, ROW0 } = S.L;
    for (let i = 0; i < q.n; i++) {
      const age = t - q.t0[i];
      if (age < 0) continue;
      let px = q.pos[i * 3], py = q.pos[i * 3 + 1], pz = q.pos[i * 3 + 2];
      if (q.pop[i]) {
        const k = clip(age / 0.45), g = smooth(k) * (1 + 0.25 * Math.sin(k * Math.PI));
        const cx = q.centre[i * 3], cy = q.centre[i * 3 + 1], cz = q.centre[i * 3 + 2];
        px = cx + (px - cx) * g; py = cy + (py - cy) * g; pz = cz + (pz - cz) * g;
      }
      const x = px * c + pz * s, z = -px * s + pz * c, up = py * ct - z * st, depth = py * st + z * ct;
      const k = SCALE / (1 - depth / 14);
      const ix = Math.round(cols / 2 + x * k), iy = Math.round(ROW0 - up * k * S.aspect);
      if (ix < 0 || ix >= cols || iy < 0 || iy >= rows) continue;
      const cell = iy * cols + ix;
      if (depth > S.zb[cell]) { S.zb[cell] = depth; S.win[cell] = i; }
    }
    // закриваємо «дірочки»: порожня клітинка з 2+ заповненими сусідами бере одного з них
    for (let pass = 0; pass < 2; pass++) {
      S.win2.set(S.win);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (S.win2[i] >= 0) continue;
        const l = x > 0 ? S.win2[i - 1] : -1, rr = x < cols - 1 ? S.win2[i + 1] : -1, u = y > 0 ? S.win2[i - cols] : -1, d = y < rows - 1 ? S.win2[i + cols] : -1;
        if ((l >= 0) + (rr >= 0) + (u >= 0) + (d >= 0) >= 2) S.win[i] = l >= 0 ? l : rr >= 0 ? rr : u >= 0 ? u : d;
      }
    }
    // 4. затінення переможців
    const lights = [];
    for (let cell = 0; cell < cells; cell++) {
      const i = S.win[cell];
      if (i < 0) continue;
      const kd = q.kind[i], age = t - q.t0[i], hh = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
      const nx0 = q.nrm[i * 3], ny = q.nrm[i * 3 + 1], nz0 = q.nrm[i * 3 + 2];
      const [nx, nyy, nz] = norm3(nx0 * c + nz0 * s, ny, -nx0 * s + nz0 * c);
      const lam = clip(nx * LDIR[0] + nyy * LDIR[1] + nz * LDIR[2]), spec = Math.pow(clip(nx * HDIR[0] + nyy * HDIR[1] + nz * HDIR[2]), 24);
      const sparkle = 0.5 + 0.5 * Math.sin(t * 6 + q.phase[i] * TAU);
      const lum = clip(0.25 + 0.75 * lam) * clip(q.base[i], 0, 1.1);
      const c0 = q.col[i * 3], c1 = q.col[i * 3 + 1], c2 = q.col[i * 3 + 2];
      let R, G, Bl;
      if (kd === TINSEL) { const m = 0.65 + 0.7 * sparkle; R = GOLD[0] * m; G = GOLD[1] * m; Bl = GOLD[2] * m; }
      else if (kd === BALL) { const m = 0.35 + 0.9 * lam; R = c0 * m + 0.9 * spec; G = c1 * m + 0.9 * spec; Bl = c2 * m + 0.9 * spec; }
      else if (kd === LIGHT) { const m = 0.8 + 0.2 * Math.sin(t * 3 + q.phase[i]); R = c0 * m; G = c1 * m; Bl = c2 * m; }
      else if (kd === SNOW) { const m = 0.75 + 0.25 * lam; R = G = Bl = m; }
      else { const m = 0.38 + 1.15 * lum; R = c0 * m; G = c1 * m; Bl = c2 * m; }
      const nw = clip(1 - age / (kd === TINSEL ? 0.15 : 0.35)) * (kd === NEEDLE || kd === TRUNK || kd === TINSEL || kd === LIGHT ? 1 : 0);
      R += (1 - R) * nw; G += (1 - G) * nw; Bl += (1 - Bl) * nw;
      const pos = kd === TINSEL ? sparkle : kd === BALL ? lum + spec : lum, ramp = RAMP[kd];
      let code = ramp.charCodeAt(Math.max(0, Math.min(ramp.length - 1, Math.floor((0.65 * pos + 0.35 * hh) * ramp.length))));
      if (nw > 0.3 && kd !== LIGHT) code = 35;
      S.char[cell] = code; S.col[cell * 3] = clip(R); S.col[cell * 3 + 1] = clip(G); S.col[cell * 3 + 2] = clip(Bl);
      if (kd === LIGHT) lights.push(cell);
    }
    // вогники ледь світять у сусідні клітинки
    for (const cell of lights) {
      const y = (cell / cols) | 0, x = cell % cols;
      for (const [dy, dx] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const j = clip(y + dy, 0, rows - 1) * cols + clip(x + dx, 0, cols - 1);
        for (let ch = 0; ch < 3; ch++) S.col[j * 3 + ch] = clip(S.col[j * 3 + ch] + WARM[ch] * 0.12);
      }
    }
    // 5. зірка на верхівці
    if (t > T_STAR) {
      const on = smooth((t - T_STAR) / 0.3), flash = Math.pow(clip(1 - (t - T_STAR) / 1), 2);
      const [tx, ty] = project(S, 0, Y1 + 0.09, 0, 0);
      star(S, Math.floor(tx), Math.floor(ty), (2 + 2.2 * on) * (1 + 0.05 * Math.sin(t * 4)) * Math.max(S.L.RPU / 18.6, 0.45), t, on, flash);
    }
    // напис друкується по літері
    if (t > T_MSG) {
      const spaced = MESSAGE.split(" ").map((w) => w.split("").join(" ")).join("   ");
      const [msg, step] = cols >= spaced.length + 2 ? [spaced, 2] : [MESSAGE, 1];
      const row = Math.min(S.L.MSG_ROW, rows - 1), x0 = Math.floor((cols - msg.length) / 2);
      const shown = Math.min(msg.length, Math.floor((t - T_MSG) * 5 * step));
      for (let y = Math.max(row - 1, 0); y <= Math.min(row + 1, rows - 1); y++)
        for (let x = Math.max(x0 - 3, 0); x < Math.min(x0 + shown + 3, cols); x++) S.char[y * cols + x] = 0;
      for (let i = 0; i < shown; i++) {
        if (msg[i] === " ") continue;
        put(S, row, x0 + i, msg[i], [RED, GOLD, GREEN_BOX][(Math.floor(i / step) + Math.floor(t * 1.5)) % 3], 0.85 + 0.25 * Math.sin(t * 5 + i));
      }
    }
  }

  // П'ятикутна зірка: тонкі промені крок за кроком + залитий багатокутник (тест парності)
  function star(S, cx, cy, size, t, power, flash) {
    const tint = GOLD.map((g) => g + (1 - g) * flash), cell = S.aspect;
    power *= 1 + 1.6 * flash;
    for (let k = 0; k < 8; k++) {
      const ang = k * TAU / 8 + 0.1 * Math.sin(t * 0.7);
      if (Math.sin(ang) < -0.3) continue;
      const reach = size * (3 + 0.8 * Math.sin(t * 3 + k * 1.3)) * (k % 2 === 0 ? 1 : 0.5);
      const deg = ((ang * 180 / Math.PI) % 180 + 180) % 180, ch = "-|/\\"[[0, 2, 1, 3][Math.round(deg / 45) % 4]];
      for (let s = size * 1.1; s < reach; s += 0.5) {
        const y = Math.round(cy - Math.sin(ang) * s), x = Math.round(cx + Math.cos(ang) * s / cell);
        if (y < 0 || y >= S.rows || x < 0 || x >= S.cols) continue;
        const i = y * S.cols + x;
        if (Math.max(S.col[i * 3], S.col[i * 3 + 1], S.col[i * 3 + 2]) < 0.45) put(S, y, x, ch, tint, power * 0.55 * (1 - s / reach));
      }
    }
    const ro = 0.68 * size, poly = [];
    for (let i = 0; i < 10; i++) { const rr = i % 2 === 0 ? ro : 0.42 * ro, a = Math.PI / 2 + i * Math.PI / 5; poly.push([rr * Math.cos(a), rr * Math.sin(a)]); }
    for (let y = Math.max(Math.floor(cy - ro) - 1, 0); y <= Math.floor(cy + ro) + 1; y++)
      for (let x = Math.max(Math.floor(cx - ro / cell) - 1, 0); x <= Math.floor(cx + ro / cell) + 1; x++) {
        const px = (x - cx) * cell, py = cy - y;
        let inside = false;
        for (let i = 0; i < 10; i++) {
          const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % 10];
          if ((y1 > py) !== (y2 > py) && px < (x2 - x1) * (py - y1) / (y2 - y1 + 1e-9) + x1) inside = !inside;
        }
        if (inside) put(S, y, x, Math.hypot(px, py) < 0.55 * ro ? "@" : "#", tint, power);
      }
  }

  // Канвас із символами на головній
  function homeTree() {
    const hero = document.querySelector(".home-hero");
    if (!hero) return;
    const sec = document.createElement("section");
    sec.className = "xmas-card";
    sec.innerHTML = `<canvas class="xmas-tree" title="Натисни, щоб ялинка виросла знову" aria-label="Анімована ASCII-ялинка з написом ${MESSAGE}" role="img"></canvas>`;
    hero.after(sec);
    const cv = sec.querySelector("canvas"), ctx = cv.getContext("2d");
    const mobile = matchMedia("(max-width: 640px)").matches;
    const q = build(mobile ? 0.5 : 0.85);
    let S = null, fs = 10, cw = 6, chh = 12, t0 = performance.now(), raf = 0, visible = true, last = 0;
    const styles = new Map();
    const fill = (r, g, b) => { const key = (r << 16) | (g << 8) | b; let v = styles.get(key); if (!v) { v = `rgb(${r},${g},${b})`; styles.set(key, v); } return v; };

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
      fs = Math.max(6.5, Math.min(12, h / (52 * 1.15)));
      ctx.font = `${fs}px Menlo, Consolas, "DejaVu Sans Mono", monospace`;
      cw = ctx.measureText("M").width; chh = fs * 1.15;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      S = makeScene(q, Math.floor(w / cw), Math.floor(h / chh), cw / chh);
      S.ox = (w - S.cols * cw) / 2; S.oy = (h - S.rows * chh) / 2;
    }
    function paint(t) {
      frame(S, t);
      ctx.fillStyle = "#04070e";
      ctx.fillRect(0, 0, cv.clientWidth, cv.clientHeight);
      ctx.font = `${fs}px Menlo, Consolas, "DejaVu Sans Mono", monospace`;
      ctx.textBaseline = "top";
      for (let y = 0; y < S.rows; y++) for (let x = 0; x < S.cols; x++) {
        const i = y * S.cols + x, c = S.char[i];
        if (!c || c === 32) continue;
        ctx.fillStyle = fill((S.col[i * 3] * 255) & 0xf8, (S.col[i * 3 + 1] * 255) & 0xf8, (S.col[i * 3 + 2] * 255) & 0xf8);
        ctx.fillText(String.fromCharCode(c), S.ox + x * cw, S.oy + y * chh);
      }
    }
    const fps = mobile ? 20 : FPS;                   // на телефоні — 20 кадрів: плавно, але легше для батареї
    function tick(ts) {
      raf = requestAnimationFrame(tick);
      if (ts - last < 1000 / fps - 2) return;
      last = ts;
      paint((ts - t0) / 1000);
    }
    const play = () => { if (!raf && visible && document.visibilityState === "visible") raf = requestAnimationFrame(tick); };
    const pause = () => { cancelAnimationFrame(raf); raf = 0; };
    resize();
    if (reduce) { paint(17); addEventListener("resize", () => { resize(); paint(17); }); return; }
    let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? play() : pause(); }).observe(cv);
    document.addEventListener("visibilitychange", () => (document.visibilityState === "visible" ? play() : pause()));
    cv.addEventListener("click", () => { t0 = performance.now(); });
    play();
  }

  pageSnow();
  homeTree();
})();
