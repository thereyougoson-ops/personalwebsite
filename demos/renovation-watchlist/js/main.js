// Orchestrator: data load, hero kinetics, scrollytelling, counters, cursor,
// filters, table↔map wiring, and reduced-motion parity.
import { initMap } from "./map.js";
import { initTable } from "./table.js";

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const PREF_KEY = "rw-motion";
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let lenis = null;

const REVEAL = ".section-title, .section-intro, .step, .map-controls, .table-tools, .method-col, .footer p";

function motionDisabled() {
  const s = localStorage.getItem(PREF_KEY);
  if (s === "off") return true;
  if (s === "on") return false;
  return prefersReduced;
}
const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

boot();

async function boot() {
  let wl, gj, sum;
  try {
    [wl, gj, sum] = await Promise.all([
      fetch("./data/watchlist.json").then((r) => r.json()),
      fetch("./data/watchlist.geojson").then((r) => r.json()),
      fetch("./data/summary.json").then((r) => r.json()),
    ]);
  } catch (err) {
    console.error("Data load failed — run a local server (python -m http.server) from the project root.", err);
    document.body.classList.remove("is-loading");
    return;
  }

  const facts = computeFacts(wl, sum);
  fillFacts(facts);

  const off = motionDisabled();
  document.body.classList.toggle("reduce-motion", off);
  document.body.classList.remove("is-loading");

  const mapApi = initMap(gj, { onCount: (n) => setText("map-count", n.toLocaleString("en-US")) });
  setupFilters(gj, mapApi);
  initTable(wl, mapApi);
  setupMotionToggle(off);
  drawHeroGrid();

  if (off) {
    document.querySelectorAll("[data-count]").forEach((el) => {
      el.textContent = Number(el.dataset.target || 0).toLocaleString("en-US");
    });
  } else if (gsap && ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    initLenis();
    initAnimations();
    initCursor();
  }
}

function computeFacts(wl, sum) {
  const t = (sum && sum.totals) || {};
  return {
    watchlist_parcels: t.watchlist_parcels ?? wl.length,
    permit_novs_on_watchlist: t.permit_novs_on_watchlist ?? 0,
    eligible_parcels: t.eligible_parcels ?? 0,
    permit_nov_rows_total: t.permit_nov_rows_total ?? 0,
    neighborhoods_count: ((sum && sum.neighborhoods) || []).length,
    generated_at: sum && sum.generated_at,
  };
}

function fillFacts(f) {
  document.querySelectorAll("[data-fact]").forEach((el) => {
    const k = el.dataset.fact;
    if (f[k] != null) el.textContent = Number(f[k]).toLocaleString("en-US");
  });
  document.querySelectorAll("[data-count]").forEach((el) => { el.dataset.target = f[el.dataset.key] ?? 0; });
  const t = document.getElementById("refreshed");
  if (t && f.generated_at) {
    const d = new Date(f.generated_at);
    if (!isNaN(d)) {
      t.dateTime = f.generated_at;
      t.textContent = d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    }
  }
}

function initLenis() {
  lenis = new Lenis({ duration: 1.05, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => { if (lenis) lenis.raf(t * 1000); });
  gsap.ticker.lagSmoothing(0);
}

function initAnimations() {
  gsap.set(".hero-title .line-in", { yPercent: 110 });
  gsap.set("[data-reveal]", { y: 22, opacity: 0 });
  gsap.set(REVEAL, { y: 26, opacity: 0 });

  const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
  tl.to(".topbar[data-reveal]", { y: 0, opacity: 1, duration: 0.8 }, 0)
    .fromTo(".hero-title .line-in", { yPercent: 110 }, { yPercent: 0, duration: 1.15, stagger: 0.12 }, 0.15)
    .to(".eyebrow[data-reveal]", { y: 0, opacity: 1, duration: 0.9 }, 0.45)
    .to(".lede[data-reveal]", { y: 0, opacity: 1, duration: 0.9 }, 0.6)
    .to(".hero-stats[data-reveal]", { y: 0, opacity: 1, duration: 0.8 }, 0.8)
    .to(".scroll-cue[data-reveal]", { y: 0, opacity: 1, duration: 0.7 }, 1.0)
    .add(countUp, 0.7);

  gsap.utils.toArray(REVEAL).forEach((el) => {
    ScrollTrigger.create({
      trigger: el, start: "top 88%", once: true,
      onEnter: () => gsap.to(el, { y: 0, opacity: 1, duration: 0.9, ease: "expo.out" }),
    });
  });

  const stamps = gsap.utils.toArray(".stamp");
  gsap.utils.toArray(".step").forEach((step, i) => {
    if (i === 0) return;
    const stamp = stamps[i - 1];
    if (!stamp) return;
    ScrollTrigger.create({
      trigger: step, start: "top 72%", once: true,
      onEnter: () => gsap.to(stamp, { opacity: 1, scale: 1, duration: 0.7, ease: "back.out(1.7)" }),
    });
  });

  ScrollTrigger.refresh();
}

function countUp() {
  document.querySelectorAll("[data-count]").forEach((el) => {
    const target = Number(el.dataset.target || 0);
    const obj = { v: 0 };
    gsap.to(obj, {
      v: target, duration: 1.7, ease: "power2.out",
      onUpdate: () => { el.textContent = Math.round(obj.v).toLocaleString("en-US"); },
    });
  });
}

function setupFilters(gj, mapApi) {
  const nbhds = [...new Set(gj.features.map((f) => f.properties.neighborhood).filter(Boolean))].sort();
  const sel = document.getElementById("f-neighborhood");
  nbhds.forEach((n) => { const o = document.createElement("option"); o.value = n; o.textContent = n; sel.appendChild(o); });
  const nov = document.getElementById("f-nov");
  const score = document.getElementById("f-score");
  function apply() {
    setText("f-nov-val", nov.value);
    setText("f-score-val", score.value);
    mapApi.setFilter({ neighborhood: sel.value, minNov: +nov.value, minScore: +score.value });
  }
  [sel, nov, score].forEach((el) => el.addEventListener("input", apply));
  document.getElementById("f-reset").addEventListener("click", () => {
    sel.value = ""; nov.value = 1; score.value = 0; apply();
  });
}

function setupMotionToggle(off) {
  const btn = document.querySelector(".motion-toggle");
  btn.setAttribute("aria-pressed", String(off));
  btn.querySelector(".motion-label").textContent = off ? "Motion off" : "Motion";
  btn.addEventListener("click", () => {
    localStorage.setItem(PREF_KEY, motionDisabled() ? "on" : "off");
    location.reload();
  });
}

// custom cursor + magnetic interactions (fine-pointer only)
function initCursor() {
  if (!window.matchMedia("(hover:hover) and (pointer:fine)").matches) return;
  const cur = document.querySelector(".cursor");
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
  window.addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; });
  gsap.ticker.add(() => { cx += (x - cx) * 0.18; cy += (y - cy) * 0.18; cur.style.transform = `translate(${cx}px,${cy}px)`; });
  document.querySelectorAll("a, button, select, #t-search, .watchtable th").forEach((el) => {
    el.addEventListener("mouseenter", () => cur.classList.add("is-active"));
    el.addEventListener("mouseleave", () => cur.classList.remove("is-active"));
  });
  document.querySelectorAll(".ctl-reset, .download, .scroll-cue, .topnav a, .motion-toggle, .brand").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, { x: (e.clientX - (r.left + r.width / 2)) * 0.3, y: (e.clientY - (r.top + r.height / 2)) * 0.4, duration: 0.4, ease: "power3.out" });
    });
    el.addEventListener("mouseleave", () => gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1,0.4)" }));
  });
}

// ambient blueprint dot grid in the hero (cheap, paused when off-screen)
function drawHeroGrid() {
  const canvas = document.querySelector(".hero-grid");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduced = motionDisabled();
  let raf = 0, w = 0, h = 0, dpr = Math.min(devicePixelRatio || 1, 1.5);
  let mx = -999, my = -999, vis = true;
  const GAP = 34;

  function resize() {
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function frame() {
    ctx.clearRect(0, 0, w, h);
    for (let gx = GAP; gx < w; gx += GAP) {
      for (let gy = GAP; gy < h; gy += GAP) {
        const d = Math.hypot(gx - mx, gy - my);
        const near = Math.max(0, 1 - d / 140);
        const r = 0.8 + near * 2.2;
        ctx.beginPath();
        ctx.arc(gx, gy, r, 0, Math.PI * 2);
        ctx.fillStyle = near > 0.05 ? `rgba(191,59,34,${0.25 + near * 0.5})` : "rgba(27,26,22,0.16)";
        ctx.fill();
      }
    }
    if (!reduced && vis) raf = requestAnimationFrame(frame);
  }
  const obs = new IntersectionObserver((ents) => {
    vis = ents[0].isIntersecting;
    if (vis && !reduced) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
    else cancelAnimationFrame(raf);
  });
  window.addEventListener("resize", () => { resize(); if (reduced) frame(); });
  window.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mx = e.clientX - rect.left; my = e.clientY - rect.top;
  });
  resize();
  obs.observe(canvas);
  frame();
}
