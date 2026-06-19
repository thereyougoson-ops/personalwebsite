/* cards.js — the field guide: a filterable / sortable / searchable grid of the
   81 POPOS, each opening an accessible detail panel with the full record and a
   "locate on map" jump. Built from popos.json; reveals + open-animation use the
   same vendored GSAP as the FX harness (guarded by no-motion). */
import { esc, fmtInt, accessOf, CATEGORY_ICON } from "./util.js";

const AMEN = [
  { key: "has_seating", label: "Seating", icon: "◗" },
  { key: "has_food", label: "Food", icon: "☕" },
  { key: "has_art", label: "Art", icon: "◆" },
  { key: "has_restroom", label: "Restroom", icon: "⚇" },
];

const SORTS = {
  hidden: { label: "Hardest to find", cmp: (a, b) => b.hidden - a.hidden || a.name.localeCompare(b.name) },
  newest: { label: "Newest first", cmp: (a, b) => (b.year || 0) - (a.year || 0) || a.name.localeCompare(b.name) },
  oldest: { label: "Oldest first", cmp: (a, b) => (a.year || 9999) - (b.year || 9999) || a.name.localeCompare(b.name) },
  az: { label: "A–Z", cmp: (a, b) => a.name.localeCompare(b.name) },
};

let RECORDS = [], mapApi = null, gridEl = null, countEl = null, lastFocus = null;
const state = { q: "", category: "all", access: "all", amenity: "all", sort: "hidden" };

export function initCards(records, opts) {
  opts = opts || {};
  RECORDS = records.slice();
  mapApi = opts.mapApi || null;
  gridEl = document.getElementById("space-grid");
  countEl = document.getElementById("grid-count");
  if (!gridEl) return;

  buildCategorySelect();
  wireControls();
  buildDialog();
  render();
}

function buildCategorySelect() {
  const sel = document.getElementById("f-category");
  if (!sel) return;
  const cats = {};
  RECORDS.forEach((r) => { cats[r.category] = (cats[r.category] || 0) + 1; });
  const order = Object.keys(cats).sort((a, b) => cats[b] - cats[a]);
  sel.innerHTML = '<option value="all">All types (' + RECORDS.length + ")</option>" +
    order.map((c) => '<option value="' + esc(c) + '">' + esc(c) + " (" + cats[c] + ")</option>").join("");
}

function wireControls() {
  const q = document.getElementById("f-search");
  if (q) q.addEventListener("input", () => { state.q = q.value.trim().toLowerCase(); render(); });

  const cat = document.getElementById("f-category");
  if (cat) cat.addEventListener("change", () => { state.category = cat.value; render(); });

  const sort = document.getElementById("f-sort");
  if (sort) sort.addEventListener("change", () => { state.sort = sort.value; render(); });

  document.querySelectorAll("#grid-access .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#grid-access .chip").forEach((c) => c.setAttribute("aria-pressed", c === chip ? "true" : "false"));
      state.access = chip.getAttribute("data-access");
      render();
    });
  });

  document.querySelectorAll("#grid-amenity .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const val = chip.getAttribute("data-amenity");
      const on = chip.getAttribute("aria-pressed") === "true";
      document.querySelectorAll("#grid-amenity .chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
      if (!on) { chip.setAttribute("aria-pressed", "true"); state.amenity = val; }
      else { state.amenity = "all"; }
      render();
    });
  });

  const reset = document.getElementById("f-reset");
  if (reset) reset.addEventListener("click", resetFilters);
}

function resetFilters() {
  state.q = ""; state.category = "all"; state.access = "all"; state.amenity = "all"; state.sort = "hidden";
  const q = document.getElementById("f-search"); if (q) q.value = "";
  const cat = document.getElementById("f-category"); if (cat) cat.value = "all";
  const sort = document.getElementById("f-sort"); if (sort) sort.value = "hidden";
  document.querySelectorAll("#grid-access .chip").forEach((c) => c.setAttribute("aria-pressed", c.getAttribute("data-access") === "all" ? "true" : "false"));
  document.querySelectorAll("#grid-amenity .chip").forEach((c) => c.setAttribute("aria-pressed", "false"));
  render();
}

function matches(r) {
  if (state.category !== "all" && r.category !== state.category) return false;
  if (state.access !== "all" && r.access !== state.access) return false;
  if (state.amenity !== "all" && !r[state.amenity]) return false;
  if (state.q) {
    const hay = (r.name + " " + (r.address || "") + " " + r.category + " " + (r.location || "") + " " + (r.landscaping || "")).toLowerCase();
    if (hay.indexOf(state.q) === -1) return false;
  }
  return true;
}

function render() {
  const rows = RECORDS.filter(matches).sort(SORTS[state.sort].cmp);
  if (countEl) countEl.textContent = fmtInt(rows.length);

  if (!rows.length) {
    gridEl.innerHTML = '<p class="grid-empty">No spaces match these filters. <button type="button" class="link-btn" id="grid-empty-reset">Clear filters</button></p>';
    const b = document.getElementById("grid-empty-reset");
    if (b) b.addEventListener("click", resetFilters);
    return;
  }
  gridEl.innerHTML = rows.map(cardHTML).join("");

  // bind open + reveal
  const cards = Array.from(gridEl.querySelectorAll(".card"));
  cards.forEach((el) => {
    el.addEventListener("click", () => openDetail(el.getAttribute("data-id")));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(el.getAttribute("data-id")); }
    });
  });
  revealCards(cards);
  if (window.FX && window.FX.bindCursor) window.FX.bindCursor(gridEl);
}

function idOf(r) { return r.name + "|" + (r.address || ""); }

// open a space's detail by exact name (used by the featured strip)
export function openByName(name) {
  const r = RECORDS.find((x) => x.name === name);
  if (r) openDetail(idOf(r));
}

function cardHTML(r) {
  const a = accessOf(r.access);
  const icon = CATEGORY_ICON[r.category] || "•";
  const amen = AMEN.filter((x) => r[x.key]).map((x) => '<span class="amen" title="' + x.label + '">' + x.icon + "</span>").join("");
  const hardToFind = r.hidden_rank <= 12;
  const yr = r.year ? '<span class="card-year">' + r.year + "</span>" : "";
  const flag = r.status === "under_construction" ? '<p class="card-flag">⚠ Under construction</p>'
    : r.status === "disputed" ? '<p class="card-flag">⚠ Access disputed</p>' : "";
  return (
    '<article class="card" data-id="' + esc(idOf(r)) + '" data-access="' + esc(r.access) + '" data-cursor="Open" tabindex="0" role="button" aria-label="' + esc(r.name) + ", " + esc(r.category) + '. View details.">' +
      '<div class="card-top">' +
        '<span class="card-cat">' + icon + " " + esc(r.category) + "</span>" +
        '<span class="card-access"><span class="card-dot" style="background:' + a.color + '"></span>' + esc(a.short) + "</span>" +
      "</div>" +
      '<h3 class="card-name">' + esc(r.name) + "</h3>" +
      '<p class="card-addr">' + (r.address ? esc(r.address) : "&nbsp;") + " " + yr + "</p>" +
      flag +
      '<div class="card-foot">' +
        '<span class="card-amens">' + amen + "</span>" +
        (hardToFind ? '<span class="card-hard" title="Obscurity ' + r.hidden + '/100">⌖ Hard to find</span>' : "") +
      "</div>" +
    "</article>"
  );
}

function revealCards(cards) {
  if (document.body.classList.contains("no-motion") || !window.gsap) {
    cards.forEach((c) => { c.style.opacity = 1; });
    return;
  }
  window.gsap.set(cards, { opacity: 0, y: 18 });
  window.gsap.to(cards, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out", stagger: { each: 0.025, from: 0 }, overwrite: true });
}

/* ---------------- detail panel ---------------- */
let dialog = null, dialogBody = null;

function buildDialog() {
  dialog = document.getElementById("space-dialog");
  if (!dialog) return;
  dialogBody = dialog.querySelector(".dialog-body");
  dialog.querySelector(".dialog-close").addEventListener("click", closeDetail);
  dialog.querySelector(".dialog-scrim").addEventListener("click", closeDetail);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dialog.classList.contains("is-open")) closeDetail();
    if (e.key === "Tab" && dialog.classList.contains("is-open")) trapFocus(e);
  });
}

function row(label, value) {
  if (!value) return "";
  return '<div class="d-row"><dt>' + esc(label) + "</dt><dd>" + esc(value) + "</dd></div>";
}

function openDetail(id) {
  const r = RECORDS.find((x) => idOf(x) === id);
  if (!r || !dialog) return;
  lastFocus = document.activeElement;
  const a = accessOf(r.access);
  const icon = CATEGORY_ICON[r.category] || "•";
  const amen = AMEN.filter((x) => r[x.key]).map((x) => x.icon + " " + x.label).join("   ");
  const entryNote = r.entry && r.entry !== "Unknown" ? r.entry + " entry" : null;
  const sign = r.signage === "Poor" ? "Poorly signed — easy to miss" : r.signage === "Good" ? "Clearly signed" : "Some signage";
  const prov = r.downtown_plan === "Yes" ? "A Downtown Plan public space"
    : r.downtown_plan === "No" ? "Predates or sits outside the Downtown Plan"
    : r.downtown_plan && /volunt/i.test(r.downtown_plan) ? "Voluntarily provided"
    : r.downtown_plan;

  dialogBody.innerHTML =
    '<p class="d-kicker"><span class="card-dot" style="background:' + a.color + '"></span>' + esc(a.label) + " · " + esc(r.category) +
      (r.indoor ? (/indoor|atrium|greenhouse/i.test(r.category) ? "" : " · Indoor") : " · Outdoor") + "</p>" +
    '<h2 class="d-name" id="dlg-title">' + icon + " " + esc(r.name) + "</h2>" +
    (r.address ? '<p class="d-addr">' + esc(r.address) + (r.year ? " · built " + r.year : "") + "</p>" : "") +
    (r.status === "under_construction" ? '<p class="d-flag">⚠ Listed as under construction in the city dataset.</p>' : "") +
    (r.status === "disputed" ? '<p class="d-flag">⚠ Public access to this space is disputed in the city dataset.</p>' : "") +
    (r.description ? '<p class="d-lede">' + esc(r.description) + "</p>" : "") +
    '<dl class="d-rows">' +
      row("Hours", r.hours) +
      row("Getting in", entryNote) +
      row("Signage", sign + (r.signage_note ? " — " + r.signage_note : "")) +
      row("Landscaping", r.landscaping) +
      row("Seating", r.seating_note) +
      row("Food", r.food_note) +
      row("Restrooms", r.restroom_note) +
      row("Where", r.location) +
      row("Provenance", prov) +
      (amen ? '<div class="d-row"><dt>Amenities</dt><dd>' + amen + "</dd></div>" : "") +
      '<div class="d-row"><dt>Obscurity</dt><dd>' + r.hidden + "/100 · #" + r.hidden_rank + " hardest to find of " + RECORDS.length + "</dd></div>" +
    "</dl>" +
    (r.lat != null && mapApi ? '<span class="magnetic" data-magnetic="0.3"><button type="button" class="d-locate" id="d-locate" data-cursor="Locate">◎ Show on the map</button></span>' : "");

  const loc = document.getElementById("d-locate");
  if (loc) loc.addEventListener("click", () => locateOnMap(r));
  if (window.FX) { if (FX.bindCursor) FX.bindCursor(dialog); if (FX.bindMagnetic) FX.bindMagnetic(dialog); }

  dialog.setAttribute("aria-labelledby", "dlg-title"); // announce the space name, not a generic label
  dialog.classList.add("is-open");
  dialog.setAttribute("aria-hidden", "false");
  document.body.classList.add("dialog-open");
  const panel = dialog.querySelector(".dialog-panel");
  if (!document.body.classList.contains("no-motion") && window.gsap) {
    window.gsap.fromTo(panel, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: "expo.out" });
    window.gsap.fromTo(dialog.querySelector(".dialog-scrim"), { opacity: 0 }, { opacity: 1, duration: 0.35 });
  }
  dialog.querySelector(".dialog-close").focus();
}

function closeDetail() {
  if (!dialog) return;
  dialog.classList.remove("is-open");
  dialog.setAttribute("aria-hidden", "true");
  document.body.classList.remove("dialog-open");
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

function locateOnMap(r) {
  closeDetail();
  const map = document.getElementById("map-section");
  if (map) {
    if (window.FX && window.FX.lenis) window.FX.lenis.scrollTo(map, { offset: -8, duration: 1.0 });
    else map.scrollIntoView({ behavior: document.body.classList.contains("no-motion") ? "auto" : "smooth" });
  }
  setTimeout(() => { if (mapApi && r.lng != null) mapApi.flyTo(r.lng, r.lat, mapPropsOf(r)); }, 520);
}

function mapPropsOf(r) {
  return {
    name: r.name, address: r.address, category: r.category, access: r.access,
    hours: r.hours, has_seating: r.has_seating, has_food: r.has_food,
    has_art: r.has_art, has_restroom: r.has_restroom, status: r.status,
  };
}

function trapFocus(e) {
  const f = dialog.querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])');
  const list = Array.from(f).filter((el) => el.offsetParent !== null);
  if (!list.length) return;
  const first = list[0], last = list[list.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
