'use strict';

/* ---------- Helpers ---------- */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand = (a, b) => a + Math.random() * (b - a);
const fa = (n, d = 1) => n == null ? '—' : Number(n).toLocaleString('fa-IR', { maximumFractionDigits: d });
const pct = (n, d = 1) => n == null ? 'نامشخص' : fa(n, d) + '٪';
const signed = (n, d = 1) => (n >= 0 ? '+' : '−') + fa(Math.abs(n), d) + '٪';
const money = b => b >= 1000 ? fa(b / 1000, 2) + ' تریلیون $' : fa(b, 0) + ' میلیارد $';
const people = m => m >= 1000 ? fa(m / 1000, 2) + ' میلیارد' : fa(m, 1) + ' میلیون';
const dateText = d => d.toLocaleDateString('fa-IR-u-ca-gregory', { year: 'numeric', month: 'long', timeZone: 'UTC' });

/* ---------- Game State (separate from country data) ---------- */
const gameState = {
  selectedCountry: null,
  currentDate: new Date(Date.UTC(2026, 0, 1)),
  countryData: null,   // working copy of the selected country
  treasury: 0,         // USD billions
  news: []
};

/* ---------- Telegram ---------- */
(function initTelegram() {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#0c1118');
    tg.setBackgroundColor('#0c1118');
  } catch (e) { /* older Telegram clients */ }
})();

/* ---------- News system ---------- */
const NewsSystem = {
  add(text) {
    gameState.news.unshift({ date: new Date(gameState.currentDate), text });
    gameState.news = gameState.news.slice(0, 20);
  },
  render() {
    const ul = $('news-list');
    ul.innerHTML = '';
    gameState.news.forEach(n => {
      const li = document.createElement('li');
      const small = document.createElement('small');
      small.textContent = dateText(n.date);
      li.append(small, n.text);
      ul.appendChild(li);
    });
  },
  // Turns the changes of one time step into headlines
  fromChanges(before, after) {
    const name = after.name;
    if (after.growth > before.growth) NewsSystem.add(`رشد اقتصادی ${name} به ${pct(after.growth)} رسید.`);
    else NewsSystem.add(`رشد اقتصادی ${name} به ${pct(after.growth)} کاهش یافت.`);
    if (before.inflation != null) {
      NewsSystem.add(after.inflation < before.inflation
        ? `تورم در ${name} کاهش یافت و به ${pct(after.inflation)} رسید.`
        : `تورم در ${name} افزایش یافت و به ${pct(after.inflation)} رسید.`);
    }
    if (before.unemployment != null) {
      NewsSystem.add(after.unemployment < before.unemployment
        ? `نرخ بیکاری در ${name} کم شد: ${pct(after.unemployment)}.`
        : `نرخ بیکاری در ${name} بالا رفت: ${pct(after.unemployment)}.`);
    }
  }
};

/* ---------- Time system ---------- */
const TimeSystem = {
  advance(months) {
    const c = gameState.countryData;
    const before = { ...c };
    const years = months / 12;
    const step = (v, pull, noise, lo, hi) =>
      v == null ? null : +clamp(v + rand(-noise, noise) + (pull - v) * 0.1, lo, hi).toFixed(1);

    c.growth = step(c.growth, 2.5, 0.6, -6, 10);
    c.inflation = step(c.inflation, 3, Math.max(0.6, (c.inflation || 0) * 0.08), -1, 90);
    c.unemployment = step(c.unemployment, c.unemployment, 0.4, 1, 40);
    c.gdp *= 1 + (c.growth / 100) * years;
    c.pop *= 1 + (rand(0.2, 0.8) / 100) * years;
    c.gdpPerCapita = Math.round(c.gdp / c.pop * 1000);
    gameState.currentDate.setUTCMonth(gameState.currentDate.getUTCMonth() + months);

    NewsSystem.fromChanges(before, c);
    UI.renderDashboard();
    NewsSystem.render();
    UI.showReport(months, before, c);
  }
};

/* ---------- Map ---------- */
const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// TopoJSON → absolute [lon, lat] arcs
function decodeArcs(topo) {
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  return topo.arcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
  });
}
function ringPoints(arcs, indexes) {
  const pts = [];
  indexes.forEach(i => {
    let a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
    if (pts.length) a = a.slice(1);
    pts.push(...a);
  });
  return pts;
}

const MapView = {
  svg: null, labels: [], paths: new Map(), centers: new Map(),
  view: { k: 1, x: 0, y: 0 }, ready: false,

  async load() {
    const box = $('map');
    box.innerHTML = '<p class="map-msg">در حال بارگذاری نقشه…</p>';
    try {
      const res = await fetch(TOPO_URL);
      if (!res.ok) throw new Error(res.status);
      this.build(await res.json());
    } catch (e) {
      box.innerHTML = '<p class="map-msg">نقشه بارگذاری نشد. اتصال اینترنت را بررسی کن.<br><br><button id="map-retry" class="btn">تلاش دوباره</button></p>';
      $('map-retry').onclick = () => this.load();
    }
  },

  build(topo) {
    const ns = 'http://www.w3.org/2000/svg';
    const arcs = decodeArcs(topo);
    const byName = new Map(COUNTRIES.map(c => [c.mapName, c]));
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const landG = document.createElementNS(ns, 'g');
    const labelG = document.createElementNS(ns, 'g');
    this.labels = []; this.paths.clear(); this.centers.clear();

    topo.objects.countries.geometries.forEach(geo => {
      const name = geo.properties.name;
      if (name === 'Antarctica') return;
      const polys = geo.type === 'Polygon' ? [geo.arcs] : geo.arcs;
      let d = '', biggest = [];
      polys.forEach(poly => poly.forEach((ring, i) => {
        const pts = ringPoints(arcs, ring);
        d += 'M' + pts.map(([x, y]) => (x + 180).toFixed(2) + ' ' + (90 - y).toFixed(2)).join('L') + 'Z';
        if (i === 0 && pts.length > biggest.length) biggest = pts;
      }));
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'land');
      landG.appendChild(path);

      const country = byName.get(name);
      if (!country) return;
      path.classList.add('playable');
      this.paths.set(country.id, path);
      const xs = biggest.map(p => p[0] + 180), ys = biggest.map(p => 90 - p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      this.centers.set(country.id, [cx, cy]);
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', cx); t.setAttribute('y', cy);
      t.setAttribute('class', 'label');
      t.textContent = country.name;
      t.dataset.id = country.id;
      labelG.appendChild(t);
      this.labels.push(t);
    });

    svg.append(landG, labelG);
    this.landG = landG;
    this.svg = svg;
    $('map').innerHTML = '';
    $('map').appendChild(svg);
    this.bindGestures();
    this.ready = true;
    if (gameState.selectedCountry) this.select(gameState.selectedCountry);
    else this.apply();
  },

  select(id) {
    if (!this.ready) return;
    this.paths.forEach((p, cid) => p.classList.toggle('selected', cid === id));
    const p = this.paths.get(id);
    if (p) this.landG.appendChild(p);           // draw the border on top
    const c = this.centers.get(id);
    if (c) { this.view.k = 3; this.view.x = c[0] - 60; this.view.y = c[1] - 30; }
    this.clamp();
    this.apply();
  },

  clamp() {
    const v = this.view, w = 360 / v.k, h = 180 / v.k;
    v.x = clamp(v.x, -w / 2, 360 - w / 2);
    v.y = clamp(v.y, -h / 2, 180 - h / 2);
  },

  apply() {
    if (!this.svg) return;
    const v = this.view;
    this.svg.setAttribute('viewBox', `${v.x} ${v.y} ${360 / v.k} ${180 / v.k}`);
    const ctm = this.svg.getScreenCTM();
    const s = ctm ? ctm.a : 1;
    this.labels.forEach(t => {
      const sel = t.dataset.id === gameState.selectedCountry;
      t.style.fontSize = (11 / s) + 'px';
      t.style.strokeWidth = (3 / s) + 'px';
      t.style.display = sel || v.k >= 2.5 ? '' : 'none';
    });
  },

  zoomAt(factor, cx, cy) {
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return;
    const pt = this.svg.createSVGPoint();
    pt.x = cx; pt.y = cy;
    const p = pt.matrixTransform(ctm.inverse());
    const v = this.view, k = clamp(v.k * factor, 1, 12), r = v.k / k;
    v.x = p.x - (p.x - v.x) * r;
    v.y = p.y - (p.y - v.y) * r;
    v.k = k;
    this.clamp();
    this.apply();
  },

  zoomCenter(factor) {
    const r = this.svg.getBoundingClientRect();
    this.zoomAt(factor, r.left + r.width / 2, r.top + r.height / 2);
  },

  bindGestures() {
    const svg = this.svg, ptrs = new Map();
    let last = 0;
    const spread = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };

    svg.addEventListener('pointerdown', e => {
      svg.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) last = spread();
    });
    svg.addEventListener('pointermove', e => {
      const prev = ptrs.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      if (ptrs.size === 1) {
        const s = svg.getScreenCTM().a;
        this.view.x -= (cur.x - prev.x) / s;
        this.view.y -= (cur.y - prev.y) / s;
        this.clamp();
        this.apply();
        ptrs.set(e.pointerId, cur);
      } else if (ptrs.size === 2) {
        ptrs.set(e.pointerId, cur);
        const d = spread(), [a, b] = [...ptrs.values()];
        this.zoomAt(d / last, (a.x + b.x) / 2, (a.y + b.y) / 2);
        last = d;
      }
    });
    const end = e => ptrs.delete(e.pointerId);
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      this.zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY);
    }, { passive: false });
  }
};

/* ---------- UI ---------- */
const UI = {
  init() {
    this.renderCountryList();
    $('zoom-in').onclick = () => MapView.ready && MapView.zoomCenter(1.5);
    $('zoom-out').onclick = () => MapView.ready && MapView.zoomCenter(1 / 1.5);
    document.querySelectorAll('[data-months]').forEach(b =>
      b.onclick = () => TimeSystem.advance(Number(b.dataset.months)));
    $('modal-close').onclick = () => $('modal').classList.add('hidden');
    window.addEventListener('resize', () => MapView.apply());
  },

  renderCountryList() {
    const list = $('country-list');
    COUNTRIES.forEach(c => {
      const card = document.createElement('article');
      card.className = 'country-card';
      card.innerHTML = `
        <span class="flag">${c.flag}</span>
        <div><h3>${c.name}</h3><div class="meta">پایتخت: ${c.capital}</div></div>
        <div class="info">GDP ${money(c.gdp)} · جمعیت ${people(c.pop)}</div>
        <button class="btn">انتخاب کشور</button>`;
      card.querySelector('button').onclick = () => this.selectCountry(c.id);
      list.appendChild(card);
    });
  },

  selectCountry(id) {
    const base = COUNTRIES.find(c => c.id === id);
    gameState.selectedCountry = id;
    gameState.countryData = { ...base };            // never mutate the source data
    gameState.treasury = +(base.gdp * 0.1).toFixed(1); // game parameter: 10% of GDP, not a real figure
    gameState.news = [];
    NewsSystem.add(`${base.name} وارد دوره‌ی جدیدی از مدیریت کشور شد.`);
    NewsSystem.add(`اقتصاد ${base.name} با رشد ${pct(base.growth)} آغاز می‌شود.`);

    $('screen-select').classList.remove('active');
    $('screen-game').classList.add('active');
    window.scrollTo(0, 0);
    this.renderDashboard();
    NewsSystem.render();
    if (MapView.ready) MapView.select(id); else MapView.load();
  },

  renderDashboard() {
    const c = gameState.countryData;
    $('c-flag').textContent = c.flag;
    $('c-name').textContent = c.name;
    $('c-capital').textContent = 'پایتخت: ' + c.capital;
    $('date').textContent = dateText(gameState.currentDate);
    const cards = [
      ['GDP', money(c.gdp)], ['GDP سرانه', '$' + fa(c.gdpPerCapita, 0)],
      ['جمعیت', people(c.pop)], ['رشد اقتصادی', pct(c.growth)],
      ['تورم', pct(c.inflation)], ['بیکاری', pct(c.unemployment)]
    ];
    $('stats').innerHTML = cards.map(([l, v]) => `<div class="stat"><span>${l}</span><b>${v}</b></div>`).join('') +
      `<div class="stat wide"><span>خزانه</span><b>${money(gameState.treasury)}</b></div>`;
  },

  showReport(months, a, b) {
    const label = { 6: 'شش ماه', 12: 'یک سال', 24: 'دو سال' }[months];
    const change = (x, y) => (y / x - 1) * 100;
    const rows = [];
    const delta = (name, x, y, lowerIsBetter) => {
      if (x == null) return rows.push([name, 'نامشخص', '']);
      const good = lowerIsBetter ? y < x : y > x;
      rows.push([name, `${pct(x)} ← ${pct(y)}`, good ? 'pos' : 'neg']);
    };
    const g = change(a.gdp, b.gdp), p = change(a.pop, b.pop);
    rows.push(['GDP', signed(g), g >= 0 ? 'pos' : 'neg'], ['جمعیت', signed(p, 2), 'pos']);
    delta('رشد اقتصادی', a.growth, b.growth, false);
    delta('تورم', a.inflation, b.inflation, true);
    delta('بیکاری', a.unemployment, b.unemployment, true);

    $('modal-title').textContent = `${label} گذشت`;
    $('modal-rows').innerHTML = rows.map(([n, v, cls]) => `<li><span>${n}</span><b class="${cls}">${v}</b></li>`).join('');
    $('modal').classList.remove('hidden');
  }
};

UI.init();
