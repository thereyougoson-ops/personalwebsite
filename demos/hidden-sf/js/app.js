/* app.js — site glue: load the data, fill the data-driven stats, draw the hero
   plan-grid, boot the map, wire the access filter. Independent of the FX engine
   (which auto-runs the markup-driven effects). */
import { initMap } from "./map.js";
import { initCards, openByName } from "./cards.js";
import { initTimeline } from "./timeline.js";
import { fmtInt, esc, accessOf, CATEGORY_ICON } from "./util.js";

// editorial highlights — grounded in SPUR / SF Planning research, each linked
// to its real record in the dataset (so the card opens the full detail).
const FEATURED = [
  { name: "Redwood Park", blurb: "Half an acre of redwoods at the foot of the Transamerica Pyramid — about fifty of the original grove still standing, around a sunken fountain. Entered right off the street." },
  { name: "343 Sansome", blurb: "A fifteenth-floor open-air roof garden with a tiled obelisk by painter Joan Brown, one of her last works, and a clean view of the Pyramid. Sign in at the lobby; take the elevator up." },
  { name: "555 California St", blurb: "The granite plaza of the old Bank of America headquarters, holding Masayuki Nagare's 200-ton black sculpture that a Chronicle columnist nicknamed the “Banker's Heart.”" },
  { name: "Crocker Galleria", blurb: "Two rooftop sun terraces above a glass-vaulted shopping arcade — escalator to the top floor, then a stair to the open sky." },
  { name: "1 Bush Street", blurb: "The 1959 Crown Zellerbach plaza — the oldest space on this map, from before the city required any of them. SPUR notes it was never built to feel welcoming." },
  { name: "101 California St", blurb: "Three stepped granite pyramids built around the garage vents and terraced into seats — a sunken plaza reported open around the clock." },
];

const motionOff = () => document.body.classList.contains("no-motion");

async function boot() {
  let summary, geo, records;
  try {
    [summary, geo, records] = await Promise.all([
      fetch("./data/summary.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch("./data/popos.geojson").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch("./data/popos.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    ]);
  } catch (e) {
    console.error("Hidden SF: data load failed — serve over http (e.g. `python -m http.server` in site/).", e);
    return;
  }

  fillStats(summary);
  fillMeta(summary);
  drawHeroGrid();

  const countEl = document.getElementById("map-count");
  const mapApi = initMap(geo, {
    onCount: (n) => { if (countEl) countEl.textContent = fmtInt(n); },
  });
  wireAccessChips(mapApi);
  initMapTour(mapApi, records);
  initCards(records, { mapApi });
  buildFeatured(records);
  fillGlossary(summary);
  fillMarquee(records);
  initTimeline(summary, records);
  window.__hsf = { summary, geo, records, mapApi }; // handy for diagnostics

  // cards / featured / timeline are built after the engine's one post-setup
  // refresh — refresh again so their scroll triggers measure at correct offsets.
  if (window.ScrollTrigger) { try { window.ScrollTrigger.refresh(); } catch (e) {} }
}

function buildFeatured(records) {
  const host = document.getElementById("feature-strip");
  if (!host) return;
  const byName = {};
  records.forEach((r) => { byName[r.name] = r; });
  const items = FEATURED.map((f) => ({ f, r: byName[f.name] })).filter((x) => x.r);
  host.innerHTML = items.map(({ f, r }) => {
    const a = accessOf(r.access);
    const icon = CATEGORY_ICON[r.category] || "•";
    return (
      '<button type="button" class="feature" data-cursor="Open" data-name="' + f.name.replace(/"/g, "&quot;") + '">' +
        '<span class="feature-meta"><span class="card-dot" style="background:' + a.color + '"></span>' + a.short + " · " + r.category + (r.year ? " · " + r.year : "") + "</span>" +
        '<span class="feature-name">' + icon + " " + r.name + "</span>" +
        '<span class="feature-blurb">' + f.blurb + "</span>" +
        '<span class="feature-open">Open ↗</span>' +
      "</button>"
    );
  }).join("");

  const btns = Array.from(host.querySelectorAll(".feature"));
  btns.forEach((b) => b.addEventListener("click", () => openByName(b.getAttribute("data-name"))));
  if (window.FX && window.FX.bindCursor) window.FX.bindCursor(host);
  if (!motionOff() && window.gsap) {
    window.gsap.set(btns, { opacity: 0, y: 20 });
    window.gsap.to(btns, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out", stagger: 0.08, scrollTrigger: window.ScrollTrigger ? { trigger: host, start: "top 82%" } : undefined });
  }
}

/* the "hidden index": a full-bleed marquee of all 81 names that streams
   continuously and reacts to scroll velocity (speeds up / reverses). The boost
   decays toward 0 each frame so it self-settles. Static under reduced motion. */
function fillMarquee(records) {
  const track = document.getElementById("mq-track");
  if (!track) return;
  const item = (r) => '<span class="mq-item"><span class="mq-dot" style="background:' +
    accessOf(r.access).color + '"></span>' + esc(r.name) + "</span>";
  const sep = '<span class="mq-sep">✦</span>';
  const set = records.map(item).join(sep);
  track.innerHTML = set + sep + set; // duplicated for a seamless −50% loop

  if (motionOff() || !window.gsap) return; // static strip
  const tween = window.gsap.to(track, { xPercent: -50, duration: 64, ease: "none", repeat: -1 });
  const band = track.closest(".marquee-band");
  let boost = 0, hovered = false, pause = 0, ts = 1;
  // single ticker owns timeScale: base 1 + decaying scroll boost, smoothly
  // multiplied down to 0 on hover. (Two writers would fight.)
  window.gsap.ticker.add(() => {
    boost *= 0.9;
    pause += ((hovered ? 1 : 0) - pause) * 0.12;
    const want = (1 + boost) * (1 - pause);
    ts += (want - ts) * 0.15;
    tween.timeScale(ts);
  });
  if (window.ScrollTrigger) {
    window.ScrollTrigger.create({
      trigger: band, start: "top bottom", end: "bottom top",
      onUpdate: (self) => { boost = window.gsap.utils.clamp(-7, 7, self.getVelocity() / 200); },
    });
  }
  band.addEventListener("pointerenter", () => { hovered = true; });
  band.addEventListener("pointerleave", () => { hovered = false; });
}

function fillGlossary(summary) {
  const counts = {};
  (summary.categories || []).forEach((c) => { counts[c[0]] = c[1]; });
  document.querySelectorAll("[data-glos]").forEach((el) => {
    const n = counts[el.getAttribute("data-glos")];
    if (n != null) el.textContent = n;
  });
}

function fillStats(summary) {
  const t = summary.totals || {};
  document.querySelectorAll("[data-stat]").forEach((el) => {
    const key = el.getAttribute("data-stat");
    const val = t[key];
    if (val == null) return;
    if (motionOff() || !window.gsap) { el.textContent = fmtInt(val); return; }
    countUp(el, val);
  });
}

function countUp(el, target) {
  const obj = { v: 0 };
  window.gsap.to(obj, {
    v: target, duration: 1.5, ease: "power2.out",
    onUpdate() { el.textContent = fmtInt(Math.round(obj.v)); },
    onComplete() { el.textContent = fmtInt(target); },
  });
}

function fillMeta(summary) {
  const el = document.getElementById("foot-meta");
  if (!el) return;
  const s = summary.source || {};
  const up = s.updated ? ` · source updated ${s.updated}` : "";
  const built = (summary.generated_at || "").slice(0, 10);
  el.textContent = `Hidden SF · ${summary.totals.spaces} POPOS · data: DataSF ${s.id}${up} · built ${built}`;
}

/* the cinematic centerpiece: a pinned/sticky map that flies between six spaces
   as you scroll (MapLibre's official scrollytelling pattern — chapters →
   flyTo, driven by per-step ScrollTriggers' onEnter/onEnterBack, NOT raw
   onscroll). Collapses to a plain static map under reduced motion. */
function initMapTour(mapApi, records) {
  const steps = Array.from(document.querySelectorAll(".tour-step"));
  if (!steps.length) return;
  const byName = {}; records.forEach((r) => { byName[r.name] = r; });
  const N = 4; // numbered space-chapters (between the two overview frames)

  const CH = [
    { kind: "overview", index: "Begin", name: "Eighty-one hidden rooms", note: "Public space tucked inside private downtown towers. Scroll to descend into a few — or grab the controls and wander all eighty-one." },
    { kind: "space", name: "555 California St", label: "The plaza", zoom: 16.6, pitch: 50, bearing: -20, note: "Street level: the granite plaza of the old Bank of America headquarters, holding Nagare's 200-ton black sculpture — the “Banker's Heart.”" },
    { kind: "space", name: "Redwood Park", label: "The grove", zoom: 16.9, pitch: 46, bearing: 18, note: "A half-acre redwood grove at the foot of the Transamerica Pyramid — about fifty of the originals still standing." },
    { kind: "space", name: "343 Sansome", label: "The roof", zoom: 17, pitch: 58, bearing: -32, note: "Fifteen floors up: an open-air roof garden with Joan Brown's tiled obelisk and a clean view of the Pyramid." },
    { kind: "space", name: "Crocker Galleria", label: "The terrace", zoom: 16.8, pitch: 52, bearing: 26, note: "Two sun terraces above a glass-vaulted arcade — escalator to the top floor, then a stair to the open sky." },
    { kind: "overview", index: "All 81", name: "Now wander", note: "That's four. Seventy-seven more are waiting — filter the map, or open the field guide below." },
  ];

  const idxEl = document.getElementById("tc-index");
  const nameEl = document.getElementById("tc-name");
  const noteEl = document.getElementById("tc-note");
  let active = -1;

  function setChapter(i, animate) {
    if (i === active) return; active = i;
    const c = CH[i];
    const num = CH.slice(0, i + 1).filter((x) => x.kind === "space").length;
    idxEl.textContent = c.kind === "overview" ? c.index : ("0" + num + " / 0" + N);
    nameEl.textContent = c.label ? c.label + " — " + c.name : c.name;
    noteEl.textContent = c.note;
    if (animate === false) return; // init: caption only; map already at overview
    if (c.kind === "overview") mapApi.overview();
    else { const r = byName[c.name]; if (r && r.lng != null) mapApi.flyCamera({ lng: r.lng, lat: r.lat, zoom: c.zoom, pitch: c.pitch, bearing: c.bearing }); }
  }

  setChapter(0, false);
  // give the (newly sticky-sized) container a beat, then make MapLibre measure it
  setTimeout(() => mapApi.resize(), 350);

  if (motionOff() || !window.ScrollTrigger || !window.gsap) return; // static map, no tour
  steps.forEach((step, i) => {
    window.ScrollTrigger.create({
      trigger: step, start: "top 55%", end: "bottom 55%",
      onEnter: () => setChapter(i, true),
      onEnterBack: () => setChapter(i, true),
    });
  });
}

function wireAccessChips(mapApi) {
  const chips = Array.from(document.querySelectorAll("#access-chips .chip"));
  chips.forEach((chip) => chip.addEventListener("click", () => {
    chips.forEach((c) => c.setAttribute("aria-pressed", c === chip ? "true" : "false"));
    mapApi.setFilter({ access: chip.getAttribute("data-access") });
  }));
}

/* faint brass plan-grid behind the hero; dots brighten/grow near the cursor.
   One static frame when motion is off; paused off-screen. */
function drawHeroGrid() {
  const c = document.getElementById("hero-grid");
  if (!c || !c.getContext) return;
  const ctx = c.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
  const gap = 46;
  let w = 0, h = 0, mx = -999, my = -999, vis = true, raf = 0;

  function size() {
    const r = c.getBoundingClientRect();
    w = r.width; h = r.height;
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (let y = gap / 2; y < h; y += gap) {
      for (let x = gap / 2; x < w; x += gap) {
        const d = Math.hypot(x - mx, y - my);
        const near = Math.max(0, 1 - d / 150);
        const rad = 1 + near * 2.4;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fillStyle = near > 0.02 ? "rgba(185,132,43," + (0.16 + near * 0.5) + ")" : "rgba(25,28,26,0.10)";
        ctx.fill();
      }
    }
  }
  let awake = true;
  function frame() { draw(); raf = requestAnimationFrame(frame); }
  function on() { if (vis && awake && !raf) raf = requestAnimationFrame(frame); }
  function off() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  size();
  window.addEventListener("resize", () => { size(); if (motionOff()) draw(); });
  if (motionOff()) { draw(); return; }
  window.addEventListener("pointermove", (e) => {
    const r = c.getBoundingClientRect();
    mx = e.clientX - r.left; my = e.clientY - r.top;
  });
  try {
    const io = new IntersectionObserver((es) => { vis = es[0].isIntersecting; vis ? on() : off(); });
    io.observe(c);
  } catch (e) { /* no IO: just run */ }
  document.addEventListener("visibilitychange", () => { awake = !document.hidden; awake ? on() : off(); });
  on();
}

if (document.readyState !== "loading") boot();
else document.addEventListener("DOMContentLoaded", boot);
