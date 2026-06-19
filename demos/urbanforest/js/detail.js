// Tree / species detail drawer: an animated genus-styled representation, a real
// species photo (lazy, from Wikipedia, with the illustration as fallback), and facts.
import { colorForGenus, prettyCommon, fmtInt } from "./forest.js";

const gsap = window.gsap;
let panel, backdrop, body, meta, cols, api, reduced = false, lastFocus = null;
const imgCache = new Map();
const bgEls = () => [document.querySelector("main"), document.querySelector(".topbar"), document.querySelector(".footer")];

export function initDetail(metaData, colsData, mapApi, opts = {}) {
  meta = metaData; cols = colsData; api = mapApi; reduced = !!opts.reduced;
  panel = document.getElementById("detail");
  backdrop = document.getElementById("detail-backdrop");
  body = document.getElementById("detail-body");
  document.getElementById("detail-close").addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && panel.classList.contains("open")) close(); });
  // focus trap
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const f = [...panel.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

export function openTree(i) {
  open({ kind: "tree", si: cols.s[i], gi: meta.species[cols.s[i]].gi, year: cols.y[i],
    addr: `${cols.num[i] || ""} ${meta.streets[cols.st[i]] || ""}`.trim(), lng: cols.lng[i], lat: cols.lat[i] });
}
export function openSpecies(si) { open({ kind: "species", si, gi: meta.species[si].gi }); }

const REF_YEAR = 2026;

function open(p) {
  const sp = meta.species[p.si] || {}, genus = meta.genera[p.gi] || {};
  const color = colorForGenus(genus.name);
  const common = prettyCommon(sp.common) || "Unidentified tree";
  const bot = sp.bot || genus.name || "";
  const total = meta.stats.total || 1;
  const share = ((sp.count || 0) / total * 100);

  const facts = [];
  if (p.kind === "tree") {
    facts.push(["Planted", p.year > 0 ? String(p.year) : "Unrecorded"]);
    facts.push(["Age", p.year > 0 ? `${REF_YEAR - p.year} yrs` : "—"]);
    facts.push(["Address", p.addr || "—"]);
    facts.push(["Genus", genus.name || "—"]);
  } else {
    facts.push(["Genus", genus.name || "—"]);
    facts.push(["In San Francisco", `${fmtInt(sp.count)} trees`]);
    facts.push(["Share of forest", `${share < 0.1 ? share.toFixed(2) : share.toFixed(1)}%`]);
    facts.push(["Genus total", `${fmtInt((genus.count || 0))} trees`]);
  }

  body.innerHTML = `
    <div class="d-figure" id="d-figure">
      <div class="d-repr" id="d-repr">${treeSVG(genus.name, color)}</div>
      <div class="d-photo" id="d-photo" aria-hidden="true"></div>
    </div>
    <p class="d-kind">${p.kind === "tree" ? "A single street tree" : "A species across the city"}</p>
    <h3 class="d-common">${common}</h3>
    <p class="d-bot" id="d-bot" data-text="${escapeAttr(bot)}">${bot}</p>
    <dl class="d-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
    <div class="d-extra">
      ${p.kind === "species"
        ? `<p class="d-note">${fmtInt(sp.count)} of San Francisco's street trees are <em>${common}</em> — about 1 in ${Math.max(1, Math.round(total / (sp.count || 1)))} of the mapped forest.</p>`
        : `<p class="d-note">One of <strong>${fmtInt(sp.count)}</strong> ${common.toLowerCase()} street trees on record in San Francisco.</p>`}
      <button class="d-locate" id="d-locate" type="button">${p.kind === "tree" ? "Fly to this tree ↗" : "Show all on the map ↗"}</button>
    </div>
    <p class="d-credit" id="d-credit" aria-live="polite"></p>`;

  document.getElementById("d-locate").addEventListener("click", () => {
    if (p.kind === "tree") { api.flyTo(p.lng, p.lat, 17); }
    else { api.setSpecies(p.si); }
    document.getElementById("explore").scrollIntoView({ behavior: "smooth", block: "start" });
    close();
  });

  panel.setAttribute("aria-label", `${common} — ${p.kind === "tree" ? "street tree" : "species"} details`);
  showPanel();
  animateIn(color);
  loadImage(bot, genus.name);
}

function showPanel() {
  if (!panel.classList.contains("open")) lastFocus = document.activeElement;
  bgEls().forEach((el) => el && el.setAttribute("inert", ""));
  panel.removeAttribute("inert");
  panel.classList.add("open");
  backdrop.classList.add("show");
  panel.setAttribute("aria-hidden", "false");
  panel.scrollTop = 0;
  document.getElementById("detail-close").focus();
}

function close() {
  panel.classList.remove("open");
  backdrop.classList.remove("show");
  panel.setAttribute("aria-hidden", "true");
  panel.setAttribute("inert", "");   // closed drawer is fully non-interactive (off-screen but not tabbable)
  bgEls().forEach((el) => el && el.removeAttribute("inert"));
  if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* ok */ } }
}

function animateIn(color) {
  if (reduced || !gsap) return;
  const canopy = body.querySelectorAll(".cv");
  gsap.set(canopy, { scale: 0, transformOrigin: "center bottom" });
  gsap.to(canopy, { scale: 1, duration: 0.6, ease: "back.out(1.7)", stagger: 0.05, delay: 0.15 });
  gsap.from(body.querySelectorAll(".d-kind, .d-common, .d-facts > div, .d-extra"),
    { y: 16, opacity: 0, duration: 0.6, ease: "expo.out", stagger: 0.05, delay: 0.1 });
  const botEl = document.getElementById("d-bot");
  if (botEl && window.ScrambleTextPlugin) {
    gsap.fromTo(botEl, { opacity: 1 }, { duration: 1.4, ease: "none", delay: 0.25,
      scrambleText: { text: botEl.dataset.text, chars: "abcdefghijklmnopqrstuvwxyz", speed: 0.5, revealDelay: 0.2 } });
  }
}

// ---- species photo via Wikipedia (lazy, cached, graceful fallback) ----
async function loadImage(bot, genusName) {
  const photo = document.getElementById("d-photo");
  const credit = document.getElementById("d-credit");
  const clean = (bot || "").replace(/'[^']*'/g, "").replace(/\s[×x]\s/g, " ").replace(/\s+/g, " ").trim();
  const candidates = [];
  if (clean) candidates.push(clean);
  if (genusName && genusName !== "Unrecorded") candidates.push(genusName);
  for (const title of candidates) {
    try {
      const url = await wikiThumb(title);
      if (!url) continue;
      if (await loadImg(url)) {
        if (!panel.classList.contains("open") || !photo.isConnected) return; // drawer changed meanwhile
        photo.style.backgroundImage = `url("${url}")`;
        photo.classList.add("loaded");
        const wiki = `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;
        credit.innerHTML = `Representative species photo · <a href="${wiki}" target="_blank" rel="noopener"><em>${escapeHtml(title)}</em> via Wikipedia</a> (CC BY-SA) — not necessarily this individual tree.`;
        return;
      }
    } catch (e) { /* try next candidate */ }
  }
  credit.textContent = "No photo found — showing the illustration.";
}

function loadImg(url) {
  return new Promise((r) => { const im = new Image(); im.onload = () => r(true); im.onerror = () => r(false); im.src = url; });
}

async function wikiThumb(title) {
  if (imgCache.has(title)) return imgCache.get(title);
  const api = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=520&redirects=1&origin=*&titles=${encodeURIComponent(title)}`;
  const r = await fetch(api);
  const j = await r.json();
  const pages = (j.query && j.query.pages) || {};
  const page = Object.values(pages)[0];
  const url = page && page.thumbnail ? page.thumbnail.source : null;
  imgCache.set(title, url);
  return url;
}

// ---- stylized genus representation (SVG) ----
const HABIT = {
  Prunus: "weep", Magnolia: "round", Platanus: "spread", Metrosideros: "spread", Arbutus: "round",
  Olea: "round", Eucalyptus: "upright", Ficus: "spread", Pittosporum: "round", Lophostemon: "upright",
  Tristaniopsis: "upright", Pyrus: "oval", Acacia: "umbrella", Callistemon: "weep", Quercus: "spread",
  Ulmus: "vase", Ginkgo: "oval", Corymbia: "upright", Maytenus: "oval",
};
const FLOWERING = new Set(["Prunus", "Metrosideros", "Callistemon", "Magnolia", "Arbutus"]);

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
  return `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
}

function blobs(habit) {
  // canopy circles [cx, cy, r] in a 200x200 box, ground ~168
  switch (habit) {
    case "spread": return [[100, 92, 52], [62, 104, 38], [138, 104, 38], [100, 78, 40]];
    case "upright": return [[100, 70, 34], [100, 104, 40], [80, 90, 28], [120, 90, 28]];
    case "oval": return [[100, 84, 34], [100, 110, 36], [100, 60, 28]];
    case "umbrella": return [[100, 96, 30], [60, 100, 30], [140, 100, 30], [100, 82, 26]];
    case "vase": return [[70, 84, 30], [130, 84, 30], [100, 70, 30], [100, 100, 34]];
    case "weep": return [[100, 84, 46], [70, 110, 26], [130, 110, 26], [100, 116, 24]];
    default: return [[100, 90, 50], [70, 98, 34], [130, 98, 34]]; // round
  }
}

export function treeSVG(genusName, color) {
  const habit = HABIT[genusName] || "round";
  const cs = blobs(habit);
  const dark = shade(color, 0.82), light = shade(color, 1.12);
  const canopy = cs.map((c, i) =>
    `<circle class="cv" cx="${c[0]}" cy="${c[1]}" r="${c[2]}" fill="${i % 2 ? light : color}" />`).join("");
  let accents = "";
  if (FLOWERING.has(genusName)) {
    const pts = [[78, 82], [120, 78], [100, 64], [86, 104], [126, 100], [104, 92]];
    accents = pts.map((p, i) => `<circle class="cv" cx="${p[0]}" cy="${p[1]}" r="4.5" fill="${light}" opacity="0.9" />`).join("");
  }
  return `<svg viewBox="0 0 200 190" role="img" aria-label="${genusName} tree illustration">
    <line x1="30" y1="168" x2="170" y2="168" stroke="rgba(255,255,255,0.16)" stroke-width="2"/>
    <path d="M96 168 L98 120 Q100 112 102 120 L104 168 Z" fill="#5e4630"/>
    <g>${cs.map((c, i) => `<circle cx="${c[0]}" cy="${c[1]}" r="${c[2]}" fill="${dark}" opacity="0.55"/>`).join("")}</g>
    <g>${canopy}${accents}</g>
  </svg>`;
}

function escapeAttr(s) { return String(s || "").replace(/"/g, "&quot;"); }
function escapeHtml(s) { return String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
