// The Urban Forest — orchestrator.
import { initMap, fmtInt } from "./map.js";
import { initCanopy } from "./canopy.js";
import { colorForGenus, prettyCommon } from "./forest.js";
import { initDetail, openTree, openSpecies } from "./detail.js";

const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
const PREF = "uf-motion";
const prefersReduced = matchMedia("(prefers-reduced-motion: reduce) and (min-width: 100000px)").matches;
const $ = (id) => document.getElementById(id);
const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };

let mapApi = null, META = null, TREES = null, lenis = null, growTween = null, curGenus = null, curSpecies = null;

function motionOff() {
  const s = localStorage.getItem(PREF);
  if (s === "off") return true;
  if (s === "on") return false;
  return prefersReduced;
}

boot();

// Decode the binary tree pack: header (count, baseLng, baseLat) + 6 uint16 columns.
function decodeTrees(buf) {
  const dv = new DataView(buf);
  const count = dv.getUint32(0, true);
  const baseLng = dv.getFloat64(4, true);
  const baseLat = dv.getFloat64(12, true);
  let off = 20;
  const u16 = () => { const a = new Uint16Array(buf, off, count); off += count * 2; return a; };
  const lngQ = u16(), latQ = u16(), s = u16(), y = u16(), num = u16(), st = u16();
  const SCALE = 100000;
  const lng = new Float64Array(count), lat = new Float64Array(count);
  for (let i = 0; i < count; i++) { lng[i] = baseLng + lngQ[i] / SCALE; lat[i] = baseLat + latQ[i] / SCALE; }
  return { count, lng, lat, s, y, num, st };
}

async function boot() {
  let trees, meta;
  try {
    const [buf, m] = await Promise.all([
      fetch("./data/trees.bin").then((r) => r.arrayBuffer()),
      fetch("./data/meta.json").then((r) => r.json()),
    ]);
    trees = decodeTrees(buf);
    meta = m;
  } catch (e) {
    console.error("Data load failed — serve via a local server.", e);
    document.body.classList.remove("is-loading");
    return;
  }
  TREES = trees; META = meta;
  fillFacts(meta);

  const off = motionOff();
  document.body.classList.toggle("no-motion", off);

  mapApi = initMap(trees, meta, {
    onCount: (n) => setText("count", fmtInt(n)),
    onReady: () => { const l = $("map-loading"); if (l) l.classList.add("done"); },
    onPick: (i) => openTree(i),
  });
  window.__forest = { api: mapApi, trees, meta };
  buildLegend(); buildGenusWall(); buildSpeciesList(); wireControls();
  setupMotionToggle(off);
  initDetail(meta, trees, mapApi, { reduced: off });

  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* ok */ }
  initCanopy(document.querySelector(".canopy"), { reduced: off });

  if (off) { document.body.classList.remove("is-loading"); }
  else {
    gsap.registerPlugin(ScrollTrigger, window.ScrambleTextPlugin);
    setHiddenStates();
    document.body.classList.remove("is-loading");
    initLenis();
    runAnimations();
    initCursor();
  }
}

function fillFacts(meta) {
  const unrec = (meta.genera.find((g) => g.name === "Unrecorded") || {}).count || 0;
  const f = { mapped: meta.stats.total, species: meta.stats.species, dated: meta.stats.dated, unrecorded: unrec };
  document.querySelectorAll("[data-fact]").forEach((el) => {
    const k = el.dataset.fact;
    if (f[k] != null) el.textContent = Number(f[k]).toLocaleString("en-US");
  });
  // hero headline number — driven from the data, not hardcoded
  const totalAll = meta.stats.total_all || meta.stats.total;
  const hero = document.querySelector(".hero-count");
  if (hero) {
    const s = Number(totalAll).toLocaleString("en-US");
    hero.textContent = s; hero.dataset.target = s; hero.setAttribute("aria-label", `${s} street trees`);
  }
  const t = $("refreshed");
  if (t && meta.generated_at) {
    const d = new Date(meta.generated_at);
    if (!isNaN(d)) { t.dateTime = meta.generated_at; t.textContent = d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }
  }
}

/* ---------------- explorer UI ---------------- */
function buildLegend() {
  const el = $("legend");
  el.innerHTML = META.genera_by_count.slice(0, 14).map((gi) => {
    const g = META.genera[gi];
    return `<button class="legend-item" data-gi="${gi}" aria-pressed="false"><span class="legend-sw" style="background:${colorForGenus(g.name)}"></span><span class="lg-name">${g.name}</span><span class="lg-count">${fmtInt(g.count)}</span></button>`;
  }).join("");
  el.querySelectorAll(".legend-item").forEach((b) => b.addEventListener("click", () => toggleGenus(+b.dataset.gi)));
}

function buildGenusWall() {
  const el = $("genus-wall");
  const top = META.genera_by_count.filter((gi) => META.genera[gi].name !== "Unrecorded").slice(0, 18);
  el.innerHTML = top.map((gi) => {
    const g = META.genera[gi];
    return `<button class="genus-chip" data-gi="${gi}" aria-pressed="false"><span class="genus-sw" style="background:${colorForGenus(g.name)}"></span><span><span class="genus-name">${g.name}</span><br><span class="genus-common">${prettyCommon(g.common)}</span></span><span class="genus-count">${fmtInt(g.count)}</span></button>`;
  }).join("");
  el.querySelectorAll(".genus-chip").forEach((b) => b.addEventListener("click", () => {
    toggleGenus(+b.dataset.gi);
    $("explore").scrollIntoView({ behavior: "smooth", block: "start" });
  }));
}

function buildSpeciesList() {
  const el = $("species-list");
  const top = META.species_by_count.slice(0, 40);
  const max = META.species[top[0]].count || 1;
  el.innerHTML = top.map((si) => {
    const sp = META.species[si];
    const c = colorForGenus(META.genera[sp.gi].name);
    return `<button class="sp-row" data-si="${si}" aria-pressed="false"><span class="sp-sw" style="background:${c}"></span><span class="sp-name"><span class="sp-common">${prettyCommon(sp.common)}</span> <span class="sp-bot">${sp.bot || ""}</span></span><span class="sp-bar"><i style="width:${Math.round(sp.count / max * 100)}%;background:${c}"></i></span><span class="sp-count">${fmtInt(sp.count)}</span></button>`;
  }).join("");
  // species row → open the rich detail drawer (its "show on map" button filters the map)
  el.querySelectorAll(".sp-row").forEach((b) => b.addEventListener("click", () => openSpecies(+b.dataset.si)));
}

function setActiveGenus(gi) {
  document.querySelectorAll(".legend-item,.genus-chip").forEach((e) => {
    const on = gi != null && +e.dataset.gi === gi;
    e.classList.toggle("is-active", on);
    e.setAttribute("aria-pressed", String(on));
  });
}

function toggleGenus(gi) {
  curSpecies = null;
  document.querySelectorAll(".sp-row").forEach((e) => { e.classList.remove("is-active"); e.setAttribute("aria-pressed", "false"); });
  if (curGenus === gi) { curGenus = null; mapApi.setGenus(null); }
  else { curGenus = gi; mapApi.setGenus(gi); }
  setActiveGenus(curGenus);
}

/* ---------------- controls ---------------- */
function wireControls() {
  const scrub = $("scrub");
  scrub.addEventListener("input", () => { stopGrow(); applyScrub(+scrub.value); });
  $("grow").addEventListener("click", toggleGrow);

  const street = $("street");
  let to;
  street.addEventListener("input", () => { clearTimeout(to); to = setTimeout(() => doSearch(street.value), 250); });

  $("reset").addEventListener("click", resetAll);
  $("zin").addEventListener("click", () => mapApi.zoom(1));
  $("zout").addEventListener("click", () => mapApi.zoom(-1));
}

function applyScrub(year) {
  const scrub = $("scrub");
  if (year >= 2026) { setText("scrub-year", "all"); scrub.setAttribute("aria-valuetext", "All years"); mapApi.setTimeline(year, false); }
  else { setText("scrub-year", String(year)); scrub.setAttribute("aria-valuetext", `Planted up to ${year}`); mapApi.setTimeline(year, true); }
}

function toggleGrow() {
  const btn = $("grow");
  if (growTween) { stopGrow(); return; }
  // reduced motion: no auto-animation — jump straight to the full timeline
  if (motionOff()) { $("scrub").value = "2026"; applyScrub(2026); return; }
  btn.classList.add("is-on"); btn.setAttribute("aria-pressed", "true"); btn.textContent = "❚❚ Pause";
  const scrub = $("scrub");
  const obj = { y: 1955 };
  let lastY = -1;
  scrub.value = "1955"; applyScrub(1955);
  growTween = gsap.to(obj, {
    y: 2026, duration: 10, ease: "none",
    onUpdate: () => { const y = Math.round(obj.y); if (y === lastY) return; lastY = y; scrub.value = String(y); applyScrub(y); },
    onComplete: stopGrow,
  });
}
function stopGrow() {
  const btn = $("grow");
  if (growTween) { growTween.kill(); growTween = null; }
  btn.classList.remove("is-on"); btn.setAttribute("aria-pressed", "false"); btn.textContent = "▶ Watch it grow";
}

function doSearch(q) {
  q = (q || "").trim();
  if (!q) { mapApi.setStreets(null); return; }
  const idxs = mapApi.searchStreets(q);
  mapApi.setStreets(idxs);
  if (idxs.length) {
    const set = new Set(idxs);
    const { count, lng, lat, st } = TREES;
    for (let i = 0; i < count; i++) { if (set.has(st[i])) { mapApi.flyTo(lng[i], lat[i], 15.5); break; } }
  }
}

function resetAll() {
  stopGrow();
  curGenus = null; curSpecies = null;
  mapApi.reset();
  $("scrub").value = "2026"; setText("scrub-year", "all");
  $("street").value = "";
  setActiveGenus(null);
  document.querySelectorAll(".sp-row").forEach((e) => { e.classList.remove("is-active"); e.setAttribute("aria-pressed", "false"); });
  // mapApi.reset() already flies home
}

/* ---------------- motion ---------------- */
function setupMotionToggle(off) {
  const btn = document.querySelector(".motion-toggle");
  btn.setAttribute("aria-pressed", String(off));
  btn.querySelector(".motion-label").textContent = off ? "Motion off" : "Motion";
  btn.addEventListener("click", () => { localStorage.setItem(PREF, motionOff() ? "on" : "off"); location.reload(); });
}

function initLenis() {
  lenis = new Lenis({ duration: 1.1, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => { if (lenis) lenis.raf(t * 1000); });
  gsap.ticker.lagSmoothing(0);
}

function setHiddenStates() {
  gsap.set("[data-reveal]", { opacity: 0, y: (i, el) => Number(el.dataset.revealY) || 24 });
}

function runAnimations() {
  // hero headline — masked line reveal
  let lines = [];
  if (window.SplitText) {
    const s = new SplitText(".hero-title", { type: "lines" });
    lines = s.lines;
    lines.forEach((ln) => {
      const wrap = document.createElement("span");
      wrap.className = "line-wrap";
      ln.parentNode.insertBefore(wrap, ln);
      wrap.appendChild(ln);
    });
    gsap.set(lines, { yPercent: 115 });
  }

  const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
  tl.to(".topbar[data-reveal]", { opacity: 1, y: 0, duration: 0.8 }, 0)
    .to(".hero .eyebrow[data-reveal]", { opacity: 1, y: 0, duration: 0.9 }, 0.2);
  if (lines.length) tl.to(lines, { yPercent: 0, duration: 1.1, stagger: 0.1 }, 0.3);
  tl.add(scrambleCount, 0.6)
    .to(".hero-count-label[data-reveal]", { opacity: 1, y: 0, duration: 0.8 }, 0.95)
    .to(".lede[data-reveal]", { opacity: 1, y: 0, duration: 0.9 }, 1.05)
    .to(".scroll-cue[data-reveal]", { opacity: 1, y: 0, duration: 0.7 }, 1.2);

  gsap.utils.toArray("[data-reveal]").forEach((el) => {
    if (el.closest(".hero") || el.classList.contains("topbar")) return;
    ScrollTrigger.create({
      trigger: el, start: "top 88%", once: true,
      onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 0.9, ease: "expo.out" }),
    });
  });
  ScrollTrigger.refresh();
}

function scrambleCount() {
  const el = document.querySelector(".hero-count");
  if (!el || !window.ScrambleTextPlugin) return;
  const target = el.dataset.target || el.textContent;
  gsap.fromTo(el, { opacity: 1 }, {
    duration: 1.9, ease: "none",
    scrambleText: { text: target, chars: "0123456789", speed: 0.5, revealDelay: 0.35 },
  });
}

function initCursor() {
  if (!matchMedia("(hover:hover) and (pointer:fine)").matches) return;
  const cur = document.querySelector(".cursor");
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
  window.addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; });
  gsap.ticker.add(() => { cx += (x - cx) * 0.2; cy += (y - cy) * 0.2; cur.style.transform = `translate(${cx}px,${cy}px)`; });
  document.querySelectorAll("a,button,input,summary,.legend-item,.genus-chip,.sp-row").forEach((el) => {
    el.addEventListener("mouseenter", () => cur.classList.add("is-active"));
    el.addEventListener("mouseleave", () => cur.classList.remove("is-active"));
  });
  document.querySelectorAll(".btn,.scroll-cue,.topnav a,.brand,.motion-toggle").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, { x: (e.clientX - (r.left + r.width / 2)) * 0.3, y: (e.clientY - (r.top + r.height / 2)) * 0.4, duration: 0.4, ease: "power3.out" });
    });
    el.addEventListener("mouseleave", () => gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1,0.4)" }));
  });
}
