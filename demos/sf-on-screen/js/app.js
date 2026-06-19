/* app.js — SF on Screen orchestrator.
   Loads the three data artifacts and drives everything data-dependent: the map,
   the decade scrubber, search, film cards, the century rail, the ranked lists,
   the stat counters and the hero marquee. Runs its own async boot; the FX
   harness (core.js + effect modules) handles the generic editorial effects on
   static markup. Honours window.FX.reduced for full motion parity. */

import { initMap, DECADE_COLORS } from "./map.js";

const FX = window.FX || { reduced: false, inView: (el, cb) => cb(el), lenis: null };
const gsap = window.gsap;
const reduced = () => FX.reduced || document.body.classList.contains("no-motion");

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const fmt = (n) => n.toLocaleString("en-US");

let META, TITLES, BYTITLE = {}, DECADES = [], CUM = [], MAP;
let activeTitle = null;   // ti when filtered to one production
let lastCardFocus = null; // element to restore focus to when the card closes

boot();

async function boot() {
  let geo;
  try {
    [geo, TITLES, META] = await Promise.all([
      fetch("./data/locations.geojson").then((r) => r.json()),
      fetch("./data/titles.json").then((r) => r.json()),
      fetch("./data/meta.json").then((r) => r.json()),
    ]);
  } catch (err) {
    console.error("Data load failed — serve over HTTP (not file://).", err);
    const l = $("#map-loading"); if (l) l.textContent = "Could not load data — serve over a local server.";
    return;
  }

  // index every location by its title for rich film cards
  for (const f of geo.features) {
    const p = f.properties;
    (BYTITLE[p.ti] ||= []).push({
      coords: f.geometry.coordinates, place: p.place,
      fun_fact: p.fun_fact, neighborhood: p.neighborhood, year: p.year,
    });
  }
  DECADES = META.decades.map((d) => d.decade);
  let run = 0; CUM = META.decades.map((d) => (run += d.locations));

  fillStats();
  fillMarquee();
  fillMethod();
  buildDecadeRail();
  buildTopTitles();
  buildTopHoods();

  MAP = initMap(geo, { onSelect: onMapSelect, onLoad: () => $("#map-loading")?.classList.add("gone") });
  window.__MAP = MAP; // debug/verification hook (read zoom, etc.)
  buildLegend();
  wireTimeline();
  wireSearch();
  wireCard();
}

/* ----------------------------- stats ----------------------------- */
function fillStats() {
  const s = META.stats;
  const targets = {
    "stat-locations": s.locations, "stat-titles": s.titles,
    "stat-years": (s.year_max - s.year_min) + 1, "stat-hoods": s.neighborhoods,
  };
  $("#m-loc") && ($("#m-loc").textContent = fmt(s.locations));
  $("#m-titles") && ($("#m-titles").textContent = fmt(s.titles));

  const section = $("#stats");
  const run = () => $$("[data-count]").forEach((el) => countUp(el, targets[el.id] || 0));
  if (reduced()) { $$("[data-count]").forEach((el) => (el.textContent = fmt(targets[el.id] || 0))); return; }
  FX.inView(section, run, { rootMargin: "0px 0px -20% 0px" });
}

function countUp(el, target) {
  const dur = 1300, t0 = performance.now();
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3); // easeOutCubic
    el.textContent = fmt(Math.round(target * e));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ----------------------------- hero marquee ----------------------------- */
function fillMarquee() {
  // a curated-feeling mix: the decade notables (iconic) interleaved with heavy hitters
  const seen = new Set(), items = [];
  for (const d of META.decades) {
    const t = TITLES[d.notable.ti];
    if (t && !seen.has(t.title)) { seen.add(t.title); items.push(t); }
  }
  for (const t of META.top_titles) {
    const tt = TITLES[t.ti];
    if (tt && !seen.has(tt.title) && items.length < 18) { seen.add(tt.title); items.push(tt); }
  }
  const track = $("#hero-marquee");
  if (!track) return;
  const html = items.map((t) =>
    `<span class="mq-item"><b>${esc(t.title)}</b><span>${t.year || "—"}</span></span>`).join("");
  track.innerHTML = html;
  track.innerHTML += track.innerHTML; // duplicate for seamless wrap

  if (reduced() || !gsap) return;
  const animate = () => {
    const half = track.scrollWidth / 2;
    if (!half) return;
    gsap.killTweensOf(track);
    gsap.set(track, { x: 0 });
    gsap.to(track, { x: -half, duration: half / 28, ease: "none", repeat: -1 });
  };
  animate();
  if (document.fonts?.ready) document.fonts.ready.then(animate);
  window.addEventListener("resize", debounce(animate, 250));
}

/* ----------------------------- legend ----------------------------- */
function buildLegend() {
  const el = $("#legend");
  if (!el) return;
  const rows = META.decades.filter((d) => d.locations > 0);
  // show a compact ramp: every other decade label + endpoints
  el.innerHTML = `<span class="legend-title">By decade</span>` +
    rows.map((d, i) => {
      const showLabel = i === 0 || i === rows.length - 1 || d.decade % 20 === 0;
      return `<span class="legend-row"><span class="legend-sw" style="background:${DECADE_COLORS[d.decade] || "#888"}"></span>${showLabel ? d.label : "&nbsp;"}</span>`;
    }).join("");
}

/* ----------------------------- timeline scrub ----------------------------- */
function wireTimeline() {
  const scrub = $("#tl-scrub"), play = $("#tl-play"), reset = $("#tl-reset");
  const decadeEl = $("#tl-decade"), metaEl = $("#tl-meta");
  scrub.min = 0; scrub.max = DECADES.length - 1; scrub.value = DECADES.length - 1;
  let playing = null;

  const update = (i, isAll) => {
    activeTitle = null;
    const d = META.decades[i];
    if (isAll) {
      MAP.showAll();
      decadeEl.textContent = "All decades";
      metaEl.textContent = `${fmt(META.stats.locations)} locations · ${fmt(META.stats.titles)} productions`;
    } else {
      MAP.setDecadeMax(d.decade);
      decadeEl.textContent = `Through the ${d.label}`;
      decadeEl.style.color = decadeText(d.decade);
      metaEl.textContent = `${fmt(CUM[i])} locations · ${d.label}: ${d.notable.title}`;
    }
    if (isAll) decadeEl.style.color = "var(--marquee)";
  };

  scrub.addEventListener("input", () => {
    const i = +scrub.value;
    stopPlay();
    update(i, i === DECADES.length - 1);
  });
  reset.addEventListener("click", () => { stopPlay(); scrub.value = DECADES.length - 1; update(0, true); });

  function stopPlay() { if (playing) { clearInterval(playing); playing = null; play.classList.remove("playing"); play.textContent = "▶ Play"; } }
  play.addEventListener("click", () => {
    if (playing) { stopPlay(); return; }
    play.classList.add("playing"); play.textContent = "❚❚ Pause";
    let i = 0; scrub.value = 0; update(0, false);
    playing = setInterval(() => {
      i++;
      if (i >= DECADES.length) { scrub.value = DECADES.length - 1; update(0, true); stopPlay(); return; }
      scrub.value = i; update(i, false);
    }, 850);
  });

  update(0, true); // start showing everything
}

/* ----------------------------- search ----------------------------- */
function wireSearch() {
  const input = $("#search"), list = $("#search-results");
  let opts = [];     // ti values for the current options, in order
  let active = -1;   // highlighted option index (-1 = none)

  const close = () => {
    list.hidden = true; list.innerHTML = ""; opts = []; active = -1;
    input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant");
  };
  const open = () => { list.hidden = false; input.setAttribute("aria-expanded", "true"); };
  const choose = (ti) => { close(); input.value = TITLES[ti].title; selectTitle(ti); };

  const highlight = (i) => {
    const items = $$("li[data-ti]", list);
    if (!items.length) return;
    active = (i + items.length) % items.length; // wrap
    items.forEach((li, k) => li.setAttribute("aria-selected", k === active ? "true" : "false"));
    const el = items[active];
    input.setAttribute("aria-activedescendant", el.id);
    el.scrollIntoView({ block: "nearest" });
  };

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    active = -1; input.removeAttribute("aria-activedescendant");
    if (q.length < 2) { close(); if (!q) restoreFilter(); return; }
    opts = [];
    for (let ti = 0; ti < TITLES.length && opts.length < 8; ti++)
      if (TITLES[ti].title.toLowerCase().includes(q)) opts.push(ti);
    if (!opts.length) { list.innerHTML = `<li class="no-match" aria-disabled="true">No match</li>`; open(); return; }
    list.innerHTML = opts.map((ti) =>
      `<li id="opt-${ti}" role="option" aria-selected="false" data-ti="${ti}"><span>${esc(TITLES[ti].title)}</span><span class="yr">${TITLES[ti].year || ""}</span></li>`).join("");
    open();
    $$("li[data-ti]", list).forEach((li, k) => {
      li.addEventListener("click", () => choose(+li.dataset.ti));
      li.addEventListener("mousemove", () => highlight(k));
    });
  });

  // full keyboard operability for the announced combobox/listbox pattern
  input.addEventListener("keydown", (e) => {
    if (list.hidden) return;
    if (e.key === "ArrowDown") { e.preventDefault(); highlight(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); highlight(active - 1); }
    else if (e.key === "Enter") { if (active >= 0 && opts[active] != null) { e.preventDefault(); choose(opts[active]); } }
    else if (e.key === "Escape") { close(); }
  });
  input.addEventListener("blur", () => setTimeout(close, 150));
}

function restoreFilter() { if (MAP) MAP.showAll(); activeTitle = null; }

function selectTitle(ti) {
  activeTitle = ti;
  MAP.setTitle(ti);
  const locs = BYTITLE[ti] || [];
  MAP.fitTo(locs.map((l) => l.coords));
  openCard(ti, locs[0]);
  scrollToMap();
}

/* ----------------------------- film card ----------------------------- */
function onMapSelect(props, coords) {
  openCard(props.ti, { place: props.place, fun_fact: props.fun_fact, neighborhood: props.neighborhood, coords });
}

function openCard(ti, loc) {
  const t = TITLES[ti]; if (!t) return;
  const locs = BYTITLE[ti] || [];
  const decade = t.decade || 0;
  const color = decadeText(decade); // contrast-safe tint for the decade label text
  const fact = (loc && loc.fun_fact) || (t.fun_facts && t.fun_facts[0]) || "";
  const meta = [];
  if (t.director) meta.push(["Director", t.director]);
  if (t.cast && t.cast.length) meta.push(["Starring", t.cast.join(", ")]);
  if (t.company) meta.push(["Studio", t.company]);
  if (t.distributor && t.distributor !== t.company) meta.push(["Distributor", t.distributor]);

  const locList = locs.slice(0, 12).map((l, i) =>
    `<button class="card-loc-btn" data-i="${i}">${esc(l.place || "Untitled location")}${l.neighborhood ? ` · <span style="color:var(--ink-3)">${esc(l.neighborhood)}</span>` : ""}</button>`).join("");

  $("#card-body").innerHTML = `
    <span class="card-decade" style="color:${color}">${decade ? decade + "s" : "Year unknown"}</span>
    <h3 class="card-title" id="card-title-h">${esc(t.title)}</h3>
    <span class="card-year">${t.year || "—"} · ${locs.length} location${locs.length === 1 ? "" : "s"} in SF</span>
    ${fact ? `<p class="card-fact">“${esc(fact)}”</p>` : ""}
    <ul class="card-meta">${meta.map(([k, v]) => `<li><span class="k">${k}</span><span class="v">${esc(v)}</span></li>`).join("")}</ul>
    ${loc && loc.place ? `<p class="card-place"><b>Pinned at</b> ${esc(loc.place)}${loc.neighborhood ? ` · ${esc(loc.neighborhood)}` : ""}</p>` : ""}
    <div class="card-locs">
      <p class="card-locs-title">All ${locs.length} SF location${locs.length === 1 ? "" : "s"}</p>
      ${locList}
    </div>`;

  $$("#card-body .card-loc-btn").forEach((b) =>
    b.addEventListener("click", () => MAP.flyTo(locs[+b.dataset.i].coords)));

  const card = $("#film-card");
  if (card.hidden) lastCardFocus = document.activeElement; // remember where focus came from
  card.hidden = false;
  card.querySelector("#card-close")?.focus({ preventScroll: true }); // land keyboard/SR users in the card
  if (!reduced() && gsap) gsap.fromTo(card, { x: 24, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.4, ease: "expo.out" });
}

function wireCard() {
  $("#card-close").addEventListener("click", () => {
    $("#film-card").hidden = true;
    if (activeTitle != null) { MAP.showAll(); activeTitle = null; $("#search").value = ""; }
    lastCardFocus?.focus?.({ preventScroll: true }); // restore focus on close
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#film-card").hidden) $("#card-close").click(); });
}

/* ----------------------------- century rail ----------------------------- */
function buildDecadeRail() {
  const rail = $("#decade-rail");
  const max = Math.max(...META.decades.map((d) => d.locations));
  rail.innerHTML = META.decades.map((d) => {
    const color = DECADE_COLORS[d.decade] || "#888";
    const w = Math.max(3, Math.round((d.locations / max) * 100));
    return `<li class="decade" data-reveal data-ti="${d.notable.ti}">
      <span class="decade-dot" style="background:${color}"></span>
      <div class="decade-top">
        <span class="decade-label">${d.label}</span>
        <span class="decade-count">${fmt(d.locations)} locations · ${d.titles} production${d.titles === 1 ? "" : "s"}</span>
      </div>
      <div class="decade-bar"><i style="width:${w}%;background:${color}"></i></div>
      <p class="decade-notable">Most-filmed that decade · <span class="nt-title">${esc(d.notable.title)}</span></p>
    </li>`;
  }).join("");

  $$(".decade", rail).forEach((li) => {
    li.addEventListener("click", () => { const ti = +li.dataset.ti; selectTitle(ti); });
    if (reduced()) { li.style.visibility = "visible"; return; }
    revealOnScroll(li);
  });
}

/* ----------------------------- ranked lists ----------------------------- */
function buildTopTitles() {
  const el = $("#top-titles");
  el.innerHTML = META.top_titles.slice(0, 12).map((t) =>
    `<li data-ti="${t.ti}"><span class="rt">${esc(t.title)}</span><span class="rc">${t.count} locs · ${t.year || "—"}</span></li>`).join("");
  $$("li[data-ti]", el).forEach((li) => li.addEventListener("click", () => selectTitle(+li.dataset.ti)));
}

function buildTopHoods() {
  const el = $("#top-hoods");
  const rows = META.neighborhoods.slice(0, 12);
  const max = rows[0]?.count || 1;
  el.innerHTML = rows.map((h) =>
    `<li><div class="bl-top"><span>${esc(h.name)}</span><span class="bl-c">${fmt(h.count)}</span></div>
      <div class="bl-bar"><i style="width:${Math.round((h.count / max) * 100)}%"></i></div></li>`).join("");
}

/* ----------------------------- method ----------------------------- */
function fillMethod() {
  const r = $("#refreshed");
  if (r && META.data_as_of) {
    const d = new Date(META.data_as_of);
    if (!isNaN(d)) { r.dateTime = META.data_as_of; r.textContent = d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }
  }
}

/* ----------------------------- helpers ----------------------------- */
function revealOnScroll(el) {
  if (!gsap) { el.style.visibility = "visible"; return; }
  gsap.set(el, { autoAlpha: 0, y: 28 });
  el.style.visibility = "visible";
  FX.inView(el, () => gsap.to(el, { autoAlpha: 1, y: 0, duration: 0.7, ease: "expo.out" }), { rootMargin: "0px 0px -12% 0px" });
}

function scrollToMap() {
  const t = $("#explore");
  if (FX.lenis) FX.lenis.scrollTo(t, { offset: -10, duration: 1.1 });
  else t.scrollIntoView({ behavior: reduced() ? "auto" : "smooth" });
}

// Decade hues are vivid for map dots but several (2010s/2020s) fail WCAG AA 4.5
// as TEXT on the dark panels. Lift ~28% toward cream for label text; dots keep raw hue.
function decadeText(decade) {
  return mixHex(DECADE_COLORS[decade] || "#e8b54a", "#f4eee2", 0.28);
}
function mixHex(a, b, t) {
  const pa = parseHex(a), pb = parseHex(b);
  return `rgb(${pa.map((v, i) => Math.round(v * (1 - t) + pb[i] * t)).join(",")})`;
}
function parseHex(h) { h = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
