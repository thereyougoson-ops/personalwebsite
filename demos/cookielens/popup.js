import { analyze, CATEGORY_META, DATA_TYPES } from "./lib/analyzer.js";
import { registrableDomain, hostnameOf, topLevelSite } from "./lib/psl.js";
import { dataProfileFor } from "./data/data-collection.js";
import { lookupEntity } from "./data/tracker-radar.js";
import { isClearableTrackerCookie, looksLikeAuthName } from "./lib/clear-policy.js";

// ---- Storage-based tracker fingerprints (localStorage / sessionStorage keys) ----
// Bare brand-word prefixes (heap, intercom, …) are anchored to require a separator
// after the word so a site's OWN key (heapSize, intercomMenu, smartlookalike) is not
// misattributed to a tracker. Honesty > completeness: better to miss a camelCase-only
// tracker key than to fabricate "Heap is tracking you" from the page's own storage.
const STORAGE_TRACKERS = [
  { re: /^_ga(_|t|$)/, c: "Google Analytics", cat: "analytics" },
  { re: /^amplitude[._$-]/i, c: "Amplitude", cat: "analytics" },
  { re: /^(mp_|__mp)/, c: "Mixpanel", cat: "analytics" },
  { re: /^ajs_/, c: "Segment", cat: "analytics" },
  { re: /^_hj/, c: "Hotjar", cat: "session-replay" },
  { re: /^ph_/, c: "PostHog", cat: "analytics" },
  { re: /^(_fs[._-]|fs_|fullstory[._$-])/i, c: "FullStory", cat: "session-replay" },
  { re: /^(_lr[._-]|logrocket[._$-])/i, c: "LogRocket", cat: "session-replay" },
  { re: /^smartlook[._$-]/i, c: "Smartlook", cat: "session-replay" },
  { re: /^heap[._$-]/i, c: "Heap", cat: "analytics" },
  { re: /^optimizely[._$-]/i, c: "Optimizely", cat: "analytics" },
  { re: /^(_vwo|_vis_opt)/i, c: "VWO", cat: "analytics" },
  { re: /^intercom[._-]/i, c: "Intercom", cat: "functional" },
  { re: /^__braze/i, c: "Braze", cat: "advertising" },
  { re: /^(mtm_|matomo[._$-])/i, c: "Matomo", cat: "analytics" },
  { re: /^(kl_|klaviyo[._$-])/i, c: "Klaviyo", cat: "analytics" },
  { re: /^_cio/i, c: "Customer.io", cat: "analytics" },
  { re: /^(_ym|yandex[._$-])/i, c: "Yandex", cat: "analytics" }
];

const CATEGORY_ORDER = [
  "advertising", "data-broker", "session-replay", "fingerprinting",
  "analytics", "social", "unknown", "consent", "security", "functional", "necessary"
];

// Categories considered "tracking" (clearable / per-category clear).
const TRACKING_CATS = new Set(["advertising", "data-broker", "session-replay", "fingerprinting", "analytics", "social"]);

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// True when this page is the full-tab report (popup.html?view=report). The report
// must never run the per-page scan() path (its own URL is chrome-extension://…,
// which would wrongly trigger the "scans http/https pages" message).
const IS_REPORT_VIEW = new URLSearchParams(location.search).get("view") === "report";

// Collapse a vendor's sub-brands to one parent entity so "Google (DoubleClick)",
// "Google Analytics 4" and "Google" read as a single company everywhere.
// (Phase A's Tracker Radar entity map will later supersede this hand list.)
const ENTITY_ALIASES = [
  [/google|doubleclick|youtube|gstatic|gmail/i, "Google"],
  [/\bmeta\b|facebook|instagram|whatsapp/i, "Meta"],
  [/microsoft|xandr|appnexus|linkedin|\bbing\b|clarity/i, "Microsoft"],
  [/\bamazon\b/i, "Amazon"],
  [/oracle|bluekai|\bmoat\b/i, "Oracle"],
  [/adobe|omniture/i, "Adobe"]
];
function canonicalEntity(name) {
  if (!name) return "Other";
  for (const [re, ent] of ENTITY_ALIASES) if (re.test(name)) return ent;
  return name;
}
// Tracker Radar entity names are already canonical (1,962 arbitrary names — do NOT
// run them through canonicalEntity's substring regexes, which would mis-collapse
// "Visual Meta", "Bing Lee Electrics", "Clarity Media Group", etc.). Fix only the
// one real label mismatch with our curated set by EXACT match.
const TR_NAME_FIX = { "Facebook": "Meta" };
function trEntity(domain) { const e = lookupEntity(domain); return e ? (TR_NAME_FIX[e] || e) : null; }

let state = {
  revealValues: false, lastAnalysis: null, tabUrl: "", tabId: null,
  // Expand-state persistence so a live re-render never collapses what you opened.
  openCompanies: new Set(), openCookies: new Set(),
  lastPageReg: null, autoExpanded: false,
  // Domains relevant to the current page — used to ignore unrelated cookie churn.
  relevantDomains: new Set()
};

// ---------------- Injected page collector (runs in each frame) ----------------
function pageCollector() {
  const out = { host: location.hostname, cookies: [], local: [], session: [], resources: [] };
  try { out.cookies = document.cookie ? document.cookie.split(";").map((s) => s.split("=")[0].trim()).filter(Boolean) : []; } catch (e) {}
  try { for (let i = 0; i < localStorage.length; i++) out.local.push(localStorage.key(i)); } catch (e) {}
  try { for (let i = 0; i < sessionStorage.length; i++) out.session.push(sessionStorage.key(i)); } catch (e) {}
  try {
    const seen = {};
    for (const entry of performance.getEntriesByType("resource")) {
      try { const h = new URL(entry.name).hostname; if (h) seen[h] = (seen[h] || 0) + 1; } catch (_) {}
    }
    out.resources = Object.entries(seen).map(([h, c]) => ({ h, c }));
  } catch (e) {}
  return out;
}

// ---------------- Data gathering ----------------
async function getActiveTab() {
  // Optional ?tab=<id> override lets CookieLens be popped out into a full tab
  // (and makes the popup automatable). Falls back to the active tab.
  const override = new URLSearchParams(location.search).get("tab");
  if (override) {
    try { return await chrome.tabs.get(Number(override)); } catch (e) {}
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function collectFromPage(tabId) {
  let frames = [];
  try {
    frames = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: pageCollector });
  } catch (e) {
    frames = [];
  }
  const hostCounts = {};       // registrable -> request count
  const jsCookieNames = new Set();
  const storageLocal = new Map();
  const storageSession = new Map();

  for (const f of frames) {
    const r = f && f.result;
    if (!r) continue;
    for (const name of r.cookies) jsCookieNames.add(name);
    // The frame's own host is itself a contacted domain (esp. third-party iframes).
    if (r.host) { const reg = registrableDomain(r.host); if (reg) hostCounts[reg] = (hostCounts[reg] || 0) + 1; }
    for (const { h, c } of r.resources) {
      const reg = registrableDomain(h);
      if (reg) hostCounts[reg] = (hostCounts[reg] || 0) + (c || 1);
    }
    classifyStorage(r.local, storageLocal);
    classifyStorage(r.session, storageSession);
  }
  return { hostCounts, jsCookieNames: [...jsCookieNames],
    storage: { local: [...storageLocal.values()], session: [...storageSession.values()] } };
}

function classifyStorage(keys, out) {
  for (const key of keys || []) {
    for (const t of STORAGE_TRACKERS) {
      if (t.re.test(key)) { out.set(key, { key, company: t.c, category: t.cat }); break; }
    }
  }
}

async function getCookiesForDomain(domain, topSite) {
  const out = [];
  const seen = new Set();
  const push = (arr) => {
    for (const c of arr) {
      const k = `${c.name}|${c.domain}|${c.path}|${c.partitionKey ? JSON.stringify(c.partitionKey) : ""}`;
      if (!seen.has(k)) { seen.add(k); out.push(c); }
    }
  };
  try { push(await chrome.cookies.getAll({ domain })); } catch (e) {}
  if (topSite) {
    try { push(await chrome.cookies.getAll({ domain, partitionKey: { topLevelSite: topSite } })); } catch (e) {}
  }
  return out;
}

// ---------------- Orchestration ----------------
async function scan(opts = {}) {
  const tab = await getActiveTab();
  if (!tab || !tab.url) return showMessage("No active tab to scan.");
  state.tabUrl = tab.url;
  state.tabId = tab.id;

  const url = tab.url;
  if (!/^https?:\/\//i.test(url)) {
    $("favicon").style.visibility = "hidden";
    $("site-domain").textContent = "Not a web page";
    $("site-status").textContent = "";
    return showMessage(`CookieLens scans <b>http</b> and <b>https</b> pages.<br>Open a website and reopen CookieLens.`);
  }

  const pageReg = registrableDomain(hostnameOf(url));
  const topSite = topLevelSite(url);
  const pageIsHttps = /^https:/i.test(url);

  // New page → drop the remembered expand state and re-evaluate auto-expand.
  if (state.lastPageReg !== pageReg) {
    state.openCompanies = new Set();
    state.openCookies = new Set();
    state.autoExpanded = false;
    state.lastPageReg = pageReg;
  }

  $("favicon").src = tab.favIconUrl || "icons/icon48.png";
  $("favicon").style.visibility = "visible";
  $("site-domain").textContent = hostnameOf(url);
  $("site-status").textContent = "Scanning cookies & trackers…";

  // 1. Page-side signals (cookies visible to JS, storage, contacted domains).
  const page = await collectFromPage(tab.id);

  // 2. Live tracker set from the background service worker.
  let bg = { trackers: [] };
  try { bg = await chrome.runtime.sendMessage({ type: "getTabState", tabId: tab.id }); } catch (e) {}
  state.syncEdges = (bg && bg.syncEdges) || [];
  state.fp = (bg && bg.fp) || []; // observed fingerprinting on this page (from fp-probe)
  const settings = await chrome.storage.local.get(["cl_blocking", "cl_autoclear"]);
  state.blocking = !!settings.cl_blocking;
  state.autoclear = !!settings.cl_autoclear;

  // 3. Merge contacted domains (performance entries + observed requests).
  const domainCounts = { ...page.hostCounts };
  for (const t of (bg && bg.trackers) || []) {
    domainCounts[t.registrable] = Math.max(domainCounts[t.registrable] || 0, t.requestCount || 1);
  }
  const contactedRegs = Object.keys(domainCounts);
  const contactedDomains = contactedRegs.map((registrable) => ({ registrable, requestCount: domainCounts[registrable] }));

  // 4. Query cookies for the page domain + every contacted third-party domain.
  const queryDomains = Array.from(new Set([pageReg, ...contactedRegs])).filter(Boolean).slice(0, 60);
  const results = await Promise.all(queryDomains.map((d) => getCookiesForDomain(d, topSite)));

  // Global dedup across all domain queries.
  const seen = new Set();
  const cookies = [];
  for (const arr of results) {
    for (const c of arr) {
      const k = `${c.name}|${c.domain}|${c.path}|${c.partitionKey ? JSON.stringify(c.partitionKey) : ""}`;
      if (!seen.has(k)) { seen.add(k); cookies.push(c); }
    }
  }

  // 5. Analyze.
  const analysis = analyze({
    pageUrl: url, pageRegistrable: pageReg, pageIsHttps,
    cookies, contactedDomains, jsCookieNames: page.jsCookieNames,
    storage: page.storage, nowSec: Math.floor(Date.now() / 1000),
    fingerprinting: state.fp
  });
  state.lastAnalysis = analysis;
  // Domains the popup cares about: the page + every company/tracker on it. A
  // cookie change outside this set is unrelated churn and must not redraw.
  state.relevantDomains = new Set([
    pageReg,
    ...analysis.cookies.map((c) => registrableDomain(c.domain)),
    ...analysis.trackerDomains.map((t) => t.domain),
    ...analysis.otherThirdParties.map((o) => o.domain)
  ].filter(Boolean));
  await recordHistory(pageReg, analysis.risk);
  await recordBrokers(analysis.dataCollection, pageReg);
  render(analysis, { live: !!opts.live });
}

// ---- Grade history (real recorded scores per site, capped at 20 points) ----
async function recordHistory(pageReg, risk) {
  try {
    const key = `hist:${pageReg}`;
    const store = await chrome.storage.local.get(key);
    const hist = store[key] || [];
    const now = Date.now();
    const last = hist[hist.length - 1];
    const point = { t: now, score: risk.score, grade: risk.grade };
    // Keep at most one point per hour so auto-rescans don't flood the trend.
    if (last && now - last.t < 3600000) hist[hist.length - 1] = point;
    else hist.push(point);
    const trimmed = hist.slice(-20);
    await chrome.storage.local.set({ [key]: trimmed });
    state.history = trimmed;
  } catch (e) { state.history = []; }
}

// ---- Broker log (which data brokers have been seen on sites you've scanned) ----
// Stored locally only. This is a record of brokers detected on the pages YOU
// opened CookieLens on — not a claim about your activity "across the web".
const BROKER_LOG_KEY = "brokerlog";
async function recordBrokers(dc, pageReg) {
  try {
    if (!dc || !pageReg) return;
    const brokers = (dc.collectors || []).filter((c) => c.broker);
    if (!brokers.length) return;
    const store = await chrome.storage.local.get(BROKER_LOG_KEY);
    const log = store[BROKER_LOG_KEY] || {};
    const now = Date.now();
    for (const b of brokers) {
      const e = log[b.brand] || { firstSeen: now, lastSeen: now, count: 0, sites: [], optOut: b.optOut || "", privacy: b.privacy || "" };
      e.lastSeen = now;
      if (b.optOut) e.optOut = b.optOut;
      if (b.privacy) e.privacy = b.privacy;
      if (!e.sites.includes(pageReg)) { e.sites.push(pageReg); if (e.sites.length > 50) e.sites = e.sites.slice(-50); }
      e.count = e.sites.length; // honest: distinct sites seen on, NOT raw scan count (re-visits no longer inflate)
      log[b.brand] = e;
    }
    await chrome.storage.local.set({ [BROKER_LOG_KEY]: log });
  } catch (e) {}
}

async function getBrokerLog() {
  try {
    const store = await chrome.storage.local.get(BROKER_LOG_KEY);
    return store[BROKER_LOG_KEY] || {};
  } catch (e) { return {}; }
}

// B1: local "I've opted out" reminders per broker — a personal checklist, NOT
// proof a removal happened (we can't verify that). Stored only on this device.
const BROKER_OPTOUT_KEY = "cl_broker_optouts";
async function getOptOutDone() {
  try { const s = await chrome.storage.local.get(BROKER_OPTOUT_KEY); return s[BROKER_OPTOUT_KEY] || {}; }
  catch (e) { return {}; }
}
async function setOptOutDone(brand, done) {
  try {
    const s = await chrome.storage.local.get(BROKER_OPTOUT_KEY);
    const map = s[BROKER_OPTOUT_KEY] || {};
    if (done) map[brand] = Date.now(); else delete map[brand];
    await chrome.storage.local.set({ [BROKER_OPTOUT_KEY]: map });
  } catch (e) {}
}

// ---------------- Rendering ----------------
function render(a, opts = {}) {
  $("message").hidden = true;
  $("content").hidden = false;
  $("hero").hidden = false;
  $("tabs").hidden = false;
  $("actionbar").hidden = false;
  $("site-status").textContent = a.summary.tracking > 0
    ? `${a.summary.tracking} tracking cookie${a.summary.tracking === 1 ? "" : "s"} · ${a.summary.companies} compan${a.summary.companies === 1 ? "y" : "ies"}`
    : "No tracking cookies detected";

  // Always keep the live numbers fresh (cheap, no layout you're reading).
  renderExposure(a, opts.live);
  $("c-cookies").textContent = a.summary.total;
  $("c-trackers").textContent = a.summary.trackerDomains + a.summary.otherThirdParties;
  $("c-data").textContent = a.summary.dataCollectors;
  refreshBrokerCount();

  // A live cookie change updates the numbers above but must NOT rebuild the
  // lists you're reading — that's what collapsed cards and jumped the scroll.
  // The lists refresh on open and on an explicit ↻ Rescan.
  if (opts.live) return;

  renderRiskDetail(a.risk);
  const content = $("content");
  const st = content.scrollTop;
  renderCookies(a.cookies, a.storage);
  renderTrackers(a.trackerDomains, a.otherThirdParties);
  renderData(a.dataCollection);
  content.scrollTop = st; // hold scroll across an explicit rebuild
}

// Exposure bands map the 0–100 score to a felt level + a heat-ramp colour.
const EXPO_BANDS = [
  { max: 14, word: "Private",  v: "--clear" },
  { max: 29, word: "Low",      v: "--clear" },
  { max: 49, word: "Moderate", v: "--watch" },
  { max: 69, word: "High",     v: "--expose" },
  { max: 100, word: "Exposed", v: "--severe" },
];

function renderExposure(a, live) {
  const s = Math.max(0, Math.min(100, a.risk.score));
  const band = EXPO_BANDS.find((b) => s <= b.max) || EXPO_BANDS[EXPO_BANDS.length - 1];
  const hero = $("hero");
  hero.style.setProperty("--mk", `var(${band.v})`);
  $("exposure-level").textContent = band.word;
  $("exposure-score").textContent = s;
  $("verdict").textContent = a.risk.verdict;

  const sm = a.summary;
  const rd = (label, val, cls = "") => `<span class="rd ${cls}"><b>${val}</b> ${label}</span>`;
  $("readout").innerHTML = [
    rd(sm.total === 1 ? "cookie" : "cookies", sm.total),
    rd("third-party", sm.thirdParty, sm.thirdParty > 0 ? "warm" : ""),
    rd(sm.trackerDomains === 1 ? "tracker" : "trackers", sm.trackerDomains, sm.trackerDomains > 0 ? "hot" : ""),
    rd(sm.companies === 1 ? "company" : "companies", sm.companies),
    rd("hidden", sm.hidden, sm.hidden > 0 ? "warm" : "")
  ].join("");

  // Power-on sweep on a fresh read; on a live update just move the needle
  // (no re-sweep — re-animating every cookie change would be distracting).
  if (live) {
    hero.style.setProperty("--pos", s + "%");
  } else {
    hero.style.setProperty("--pos", "0%");
    void $("meter-marker").offsetWidth; // force reflow so the next change animates
    requestAnimationFrame(() => hero.style.setProperty("--pos", s + "%"));
  }
}

const cookieKey = (c) => `${c.name}|${c.domain}|${c.path}|${c.partitionKey ? JSON.stringify(c.partitionKey) : ""}`;
// How invasive each category is — drives company ordering and the dominant colour.
const CAT_SEVERITY = { "data-broker": 6, "advertising": 5, "session-replay": 5, "fingerprinting": 5, "social": 3, "analytics": 3, "unknown": 2, "functional": 1, "consent": 1, "fraud-detection": 1, "security": 0, "necessary": 0 };

// The Cookies tab is grouped BY COMPANY (who's watching), collapsed by default,
// so a 109-cookie site reads as ~6 rows instead of an endless list. Expand a
// company to see its cookies (identical names deduped). Open/scroll state is
// remembered in `state` so a live re-render never collapses what you opened.
function renderCookies(cookies, storage) {
  const panel = $("panel-cookies");
  const storeHtml = storageSectionHtml(storage);
  if (!cookies.length) {
    panel.innerHTML = storeHtml ||
      `<div class="empty">🍪 No cookies found on this page.<br>Either none are set yet, or this site is cookie-free.</div>`;
    return;
  }

  // 1. Group cookies by company.
  const byCompany = new Map();
  for (const c of cookies) {
    const key = canonicalEntity(c.company);
    let g = byCompany.get(key);
    if (!g) { g = { company: key, cookies: [], cats: new Set(), parties: new Set(), hasHidden: false, isTracking: false }; byCompany.set(key, g); }
    g.cookies.push(c);
    g.cats.add(c.category);
    g.parties.add(c.party);
    if (c.hidden) g.hasHidden = true;
    if (c.isTracking) g.isTracking = true;
  }

  // 2. Most-invasive companies first, then by how many cookies they set.
  const groups = [...byCompany.values()].map((g) => {
    const domCat = [...g.cats].sort((a, b) => (CAT_SEVERITY[b] || 0) - (CAT_SEVERITY[a] || 0))[0];
    return Object.assign(g, { domCat, severity: CAT_SEVERITY[domCat] || 0 });
  });
  groups.sort((a, b) => b.severity - a.severity || b.cookies.length - a.cookies.length || a.company.localeCompare(b.company));

  // 3. Simple sites (≤8 cookies) auto-expand once, so they don't cost a click.
  if (!state.autoExpanded && cookies.length <= 8) {
    for (const g of groups) state.openCompanies.add(g.company);
    state.autoExpanded = true;
  }

  // 4. Render one accordion per company.
  let html = `<div class="cookies-hint">${cookies.length} cookie${cookies.length === 1 ? "" : "s"}, grouped by who set them — tap a company to see and clear its cookies.</div>`;
  for (const g of groups) {
    const meta = CATEGORY_META[g.domCat] || CATEGORY_META.unknown;
    const open = state.openCompanies.has(g.company);
    const party = g.parties.has("third") ? (g.parties.has("first") ? "mixed" : "third") : "first";
    const partyTag = party === "mixed"
      ? `<span class="tag">1st + 3rd-party</span>`
      : `<span class="tag party-${party}">${party === "first" ? "1st" : "3rd"}-party</span>`;
    const hiddenTag = g.hasHidden ? `<span class="tag hidden">hidden</span>` : "";
    const catChip = `<span class="tag" style="background:${meta.color}22;color:${meta.color}">${esc(meta.label)}</span>`;
    const clearBtn = g.isTracking ? `<button class="co-clear" data-company="${esc(g.company)}" title="Clear ${esc(g.company)} cookies — keeps your logins">clear</button>` : "";

    // Dedupe cookies that share a name (e.g. one per subdomain/path).
    const byName = new Map();
    for (const c of g.cookies) { const arr = byName.get(c.name) || []; arr.push(c); byName.set(c.name, arr); }
    let body = "";
    for (const list of byName.values()) body += cookieEntry(list);

    html += `<div class="co-group ${open ? "open" : ""}">
      <div class="co-head" role="button" tabindex="0" aria-expanded="${open}" data-company="${esc(g.company)}">
        <span class="co-dot" style="background:${meta.color}"></span>
        <div class="co-main">
          <div class="co-name">${esc(g.company)}</div>
          <div class="co-tags">${catChip}${partyTag}${hiddenTag}</div>
        </div>
        <span class="co-count" title="${g.cookies.length} cookies">${g.cookies.length}</span>
        ${clearBtn}
        <span class="caret">▶</span>
      </div>
      <div class="co-body">${body}</div>
    </div>`;
  }
  html += storeHtml;
  panel.innerHTML = html;

  // Company accordions (the clear button is a nested target — don't toggle on it).
  panel.querySelectorAll(".co-head").forEach((h) => {
    const grp = h.parentElement, key = h.dataset.company;
    const toggle = () => {
      const isOpen = grp.classList.toggle("open");
      h.setAttribute("aria-expanded", String(isOpen));
      if (isOpen) state.openCompanies.add(key); else state.openCompanies.delete(key);
    };
    h.addEventListener("click", (e) => { if (e.target.closest(".co-clear")) return; toggle(); });
    h.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
  });
  panel.querySelectorAll(".co-clear").forEach((b) =>
    b.addEventListener("click", (e) => { e.stopPropagation(); clearCompany(b.dataset.company); }));

  // Cookie detail cards (second level).
  panel.querySelectorAll(".card-head").forEach((h) => {
    const card = h.parentElement, key = h.dataset.key;
    const toggle = () => {
      const isOpen = card.classList.toggle("open");
      h.setAttribute("aria-expanded", String(isOpen));
      if (key) { if (isOpen) state.openCookies.add(key); else state.openCookies.delete(key); }
    };
    h.addEventListener("click", toggle);
    h.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
  });
}

// One card per unique cookie name within a company; `list` holds the duplicates.
function cookieEntry(list) {
  const c = list[0];
  const count = list.length;
  const key = cookieKey(c);
  const open = state.openCookies.has(key);
  const cmeta = CATEGORY_META[c.category] || CATEGORY_META.unknown;
  const tags = [];
  if (c.hidden) tags.push(`<span class="tag hidden" title="${esc(c.hiddenReason)}">hidden</span>`);
  tags.push(`<span class="tag party-${c.party}">${c.party === "first" ? "1st" : "3rd"}-party</span>`);
  const dupBadge = count > 1 ? `<span class="dup" title="${count} cookies share this name">×${count}</span>` : "";
  const valueBox = state.revealValues
    ? `<div class="value-box">${esc(c.valuePreview)} <span style="color:var(--text-faint)">· ${c.valueLength} chars</span></div>`
    : "";
  const hiddenNote = c.hidden ? `<div class="hidden-note">🔍 ${esc(c.hiddenReason)}</div>` : "";
  const insightNote = c.insight ? `<div class="hidden-note" style="color:var(--clear);border-left-color:var(--clear);background:var(--accent-soft)">🔓 ${esc(c.insight)}</div>` : "";
  const retention = c.retention ? `<dt>Vendor default</dt><dd>${esc(c.retention)}</dd>` : "";
  const dupRow = count > 1 ? `<dt>Copies</dt><dd>${count} cookies with this name (different paths/subdomains)</dd>` : "";

  return `
  <div class="card ${open ? "open" : ""}">
    <div class="card-head" role="button" tabindex="0" aria-expanded="${open}" data-key="${esc(key)}">
      <div style="min-width:0">
        <div class="cname" title="${esc(c.name)}">${esc(c.name)}${dupBadge}</div>
        <div class="company-line"><span style="color:${cmeta.color}">●</span> ${esc(cmeta.label)}</div>
      </div>
      <div class="card-tags">${tags.join("")}<span class="caret">▶</span></div>
    </div>
    <div class="card-body">
      <div class="purpose">${esc(c.purpose)}</div>
      ${insightNote}
      ${hiddenNote}
      <dl class="detail-grid">
        <dt>Domain</dt><dd>${esc(c.domain)}</dd>
        <dt>Path</dt><dd>${esc(c.path)}</dd>
        ${dupRow}
        <dt>Lifetime</dt><dd>${esc(c.expiry.text)}</dd>
        ${retention}
        <dt>Secure</dt><dd class="${c.secure ? "flag-on" : "flag-off"}">${c.secure ? "Yes — HTTPS only" : "No — can leak over HTTP"}</dd>
        <dt>HttpOnly</dt><dd class="${c.httpOnly ? "flag-on" : ""}">${c.httpOnly ? "Yes — hidden from scripts" : "No — readable by JavaScript"}</dd>
        <dt>SameSite</dt><dd>${esc(c.sameSite)}</dd>
        ${c.partitioned ? `<dt>Partitioned</dt><dd class="flag-on">Yes (CHIPS)</dd>` : ""}
      </dl>
      ${valueBox}
    </div>
  </div>`;
}

function networkGraph(trackers) {
  const nodes = trackers.slice(0, 12);
  if (!nodes.length) return "";
  const host = (function () { try { return new URL(state.tabUrl).hostname.replace(/^www\./, ""); } catch { return "this site"; } })();
  const W = 360, H = 232, cx = W / 2, cy = H / 2, R = 90, N = nodes.length;
  const idx = {};
  let spokes = "", circles = "";
  nodes.forEach((t, i) => {
    const ang = (-90 + i * 360 / N) * Math.PI / 180;
    const x = cx + R * Math.cos(ang), y = cy + R * Math.sin(ang);
    idx[t.domain] = { x, y };
    const meta = CATEGORY_META[t.category] || CATEGORY_META.unknown;
    const broker = t.category === "data-broker";
    spokes += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width="1"/>`;
    circles += `<g><title>${esc(t.company)} — ${esc(t.domain)}</title>` +
      (broker ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13" fill="none" stroke="#f85149" stroke-width="1.5"/>` : "") +
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" fill="${meta.color}"/>` +
      `<text x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="middle" font-size="9" fill="#0d1117" font-weight="700">${esc((t.company || "?").charAt(0).toUpperCase())}</text></g>`;
  });
  let edges = "", drawn = 0;
  for (const e of state.syncEdges || []) {
    const a = idx[e.from], b = idx[e.to];
    if (a && b) { drawn++; const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 16;
      edges += `<path d="M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}" fill="none" stroke="#f0883e" stroke-width="2" stroke-dasharray="3 2"/>`;
    }
  }
  const more = trackers.length > 12 ? ` (+${trackers.length - 12} more)` : "";
  const caption = drawn > 0
    ? `<b>${nodes.length}${more}</b> tracking companies received this visit · <span style="color:#f0883e">${drawn} observed ID-sync hop${drawn === 1 ? "" : "s"}</span> between them.`
    : `<b>${nodes.length}${more}</b> tracking companies received this visit. No cross-tracker ID-syncs were observed in the browser — though they may still sync server-side, which can't be seen.`;
  return `<div class="netgraph">
    <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Network of tracking companies on this page">
      ${spokes}${edges}
      <circle cx="${cx}" cy="${cy}" r="17" fill="var(--bg-elev2)" stroke="var(--accent)" stroke-width="1.5"/>
      <text x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="8" fill="var(--text)">${esc(host.slice(0, 11))}</text>
      ${circles}
    </svg>
    <div class="net-caption">${caption}</div>
    <div class="net-legend"><span style="color:#f85149">◯ data broker</span> &nbsp;·&nbsp; <span style="color:#f0883e">┄ observed ID-sync</span> &nbsp;·&nbsp; hover a node for its name</div>
  </div>`;
}

function protectionsBlock() {
  const sw = (on) => `<span class="switch ${on ? "on" : ""}"><span class="knob"></span></span>`;
  return `<div class="protections">
    <div class="prot-row" id="toggle-block" role="switch" tabindex="0" aria-checked="${state.blocking}">
      <div class="prot-txt"><b>🛡 Block known trackers</b><span>Stop requests to known tracker domains (curated list, all sites)</span></div>
      ${sw(state.blocking)}
    </div>
    ${state.blocking ? `<div class="prot-note">Active. Applies to <b>new</b> requests — reload the page to see it take effect. The counts above won't drop (CookieLens still <i>observes</i> the attempt, it just gets blocked). Sign-in, social and payment domains (Google, YouTube, Meta, Stripe…) are never blocked — it would break logins and embeds — so sites built on them show little change.</div>` : ""}
    <div class="prot-row" id="toggle-autoclear" role="switch" tabindex="0" aria-checked="${state.autoclear}">
      <div class="prot-txt"><b>🧹 Auto-clear tracker cookies daily</b><span>Delete known tracker cookies every 24h · keeps logins, sessions & non-tracking cookies</span></div>
      ${sw(state.autoclear)}
    </div>
  </div>`;
}

function renderTrackers(trackers, others = []) {
  const panel = $("panel-trackers");
  let html = protectionsBlock();
  if (!trackers.length && !others.length) {
    panel.innerHTML = html + `<div class="empty">✅ No third-party connections detected by this page.</div>`;
    wireProtections(panel);
    return;
  }
  html += networkGraph(trackers);
  if (trackers.length) {
    html += `<div class="group-head" style="margin-top:2px"><span class="cat-dot" style="background:#f85149"></span>Known trackers<span class="gh-count">${trackers.length}</span></div>`;
    html += trackers.map((t) => {
      const meta = CATEGORY_META[t.category] || CATEGORY_META.unknown;
      const initial = esc((t.company || "?").charAt(0).toUpperCase());
      const sub = `${esc(t.domain)} · ${esc(t.note)}`;
      const mem = `${t.cookieCount} cookie${t.cookieCount === 1 ? "" : "s"}<br>${t.requestCount} request${t.requestCount === 1 ? "" : "s"}`;
      return `<div class="row">
        <div class="row-icon" style="background:${meta.color}">${initial}</div>
        <div class="row-main"><div class="row-title">${esc(t.company)} <span class="tag" style="background:${meta.color}22;color:${meta.color}">${esc((CATEGORY_META[t.category] || {}).label || t.category)}</span></div><div class="row-sub" title="${sub}">${sub}</div></div>
        <div class="row-meta">${mem}</div>
      </div>`;
    }).join("");
  }
  if (others.length) {
    html += `<div class="group-head"><span class="cat-dot" style="background:#6e7681"></span>Other third-party connections<span class="gh-count">${others.length}</span></div>`;
    html += `<div class="rf-detail" style="margin:0 4px 7px;color:var(--text-faint)">Not in our known-tracker list. Where possible, attributed to an owner via the bundled DuckDuckGo Tracker Radar dataset; the rest are unverified — treat unfamiliar domains with caution.</div>`;
    html += others.map((o) => {
      const mem = o.cookieCount ? `${o.cookieCount} cookie${o.cookieCount === 1 ? "" : "s"}<br>${o.requestCount} req` : `${o.requestCount} request${o.requestCount === 1 ? "" : "s"}`;
      const owner = trEntity(o.domain);
      const icon = owner ? esc(owner.charAt(0).toUpperCase()) : "?";
      const iconBg = owner ? "var(--watch)" : "#6e7681";
      const sub = owner ? `Owned by ${esc(owner)} · via Tracker Radar` : "Unrecognized third party";
      return `<div class="row">
        <div class="row-icon" style="background:${iconBg}">${icon}</div>
        <div class="row-main"><div class="row-title">${esc(o.domain)}</div><div class="row-sub">${sub}</div></div>
        <div class="row-meta">${mem}</div>
      </div>`;
    }).join("");
  }
  panel.innerHTML = html;
  wireProtections(panel);
}

function wireProtections(panel) {
  const b = panel.querySelector("#toggle-block");
  const a = panel.querySelector("#toggle-autoclear");
  if (b) { b.addEventListener("click", toggleBlocking); b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleBlocking(); } }); }
  if (a) { a.addEventListener("click", toggleAutoClear); a.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleAutoClear(); } }); }
}
async function toggleBlocking() {
  const want = !state.blocking;
  // Apply the rules FIRST; only persist + claim "on" if the browser accepted them.
  // syncBlocking returns -1 on a declarativeNetRequest error (rule-limit, API failure)
  // — never tell the user the protection is active when it isn't.
  let r; try { r = await chrome.runtime.sendMessage({ type: "setBlocking", enabled: want }); } catch (e) {}
  if (want && (!r || typeof r.count !== "number" || r.count < 0)) {
    state.blocking = false;
    await chrome.storage.local.set({ cl_blocking: false });
    toast("Couldn't turn on blocking — your browser refused the rules");
    if (state.lastAnalysis) renderTrackers(state.lastAnalysis.trackerDomains, state.lastAnalysis.otherThirdParties);
    return;
  }
  state.blocking = want;
  await chrome.storage.local.set({ cl_blocking: state.blocking });
  toast(state.blocking ? `Blocking ${r && r.count > 0 ? r.count : ""} tracker domains`.replace(/\s+/g, " ").trim() : "Tracker blocking off");
  if (state.lastAnalysis) renderTrackers(state.lastAnalysis.trackerDomains, state.lastAnalysis.otherThirdParties);
}
async function toggleAutoClear() {
  state.autoclear = !state.autoclear;
  await chrome.storage.local.set({ cl_autoclear: state.autoclear });
  try { await chrome.runtime.sendMessage({ type: "setAutoClear", enabled: state.autoclear }); } catch (e) {}
  toast(state.autoclear ? "Auto-clear on — tracker cookies cleared daily" : "Auto-clear off");
  if (state.lastAnalysis) renderTrackers(state.lastAnalysis.trackerDomains, state.lastAnalysis.otherThirdParties);
}

// Observed (not inferred) device-fingerprinting on the current page. Honest framing:
// we report the TECHNIQUE we actually watched run, never what the script intends.
const FP_TECH_LABEL = { canvas: "Canvas read-back", audio: "Audio fingerprint", webrtc: "WebRTC local-IP probe" };
const FP_TECH_DESC = {
  canvas: "drew hidden text to a canvas and read the pixels back — a way to recognise your device by its exact rendering",
  audio: "rendered audio offline and read the result — an audio-stack fingerprint",
  webrtc: "opened a WebRTC connection in a way that can expose your local network IP"
};
function fingerprintObservedHtml() {
  const fp = state.fp || [];
  if (!fp.length) return "";
  const rows = fp.map((f) => {
    const techs = (f.techniques || []).map((t) => `<span class="fp-tech">${esc(FP_TECH_LABEL[t] || t)}</span>`).join("");
    const desc = (f.techniques || []).map((t) => FP_TECH_DESC[t]).filter(Boolean).join("; ");
    const img = f.sample ? `<img class="fp-sample" src="${esc(f.sample)}" alt="The image this script read back from the canvas">` : "";
    const who = f.domain === "this page" ? "A script on this page" : esc(f.domain);
    return `<div class="fp-row"><div class="fp-head"><span class="fp-dom mono">${who}</span>${techs}</div>
      <div class="fp-why">${esc(desc)}.</div>${img}</div>`;
  }).join("");
  return `<div class="fp-observed"><div class="fp-title">🫥 Fingerprinting observed on this page</div>
    <div class="fp-sub">CookieLens watched these scripts actually run a fingerprinting technique as this page loaded — <b>observed behaviour, not a guess</b>. We name the technique; what a script <i>does</i> with it is not something the browser can show.</div>
    ${rows}</div>`;
}
// F4 — a fixed-format "privacy label" (nutrition-label style). The SAME rows in the
// SAME order every page, so users can compare at a glance — a layout shown to improve
// comprehension over prose (Kelley et al., SOUPS 2009). Each row is a plain count;
// fingerprinting is the one row marked "observed" (watched, not inferred).
function nutritionLabelHtml(a) {
  if (!a) return "";
  const fpTechs = new Set((state.fp || []).flatMap((f) => f.techniques || []));
  const compByCat = {};
  for (const t of a.trackerDomains || []) (compByCat[t.category] = compByCat[t.category] || new Set()).add(t.company);
  for (const c of a.cookies || []) if (c.isTracking) (compByCat[c.category] = compByCat[c.category] || new Set()).add(c.company);
  const catN = (k) => (compByCat[k] ? compByCat[k].size : 0);
  const storageN = (a.storage && (a.storage.local || []).length + (a.storage.session || []).length) || 0;
  const rows = [
    ["Third-party trackers", (a.trackerDomains || []).length, "domains"],
    ["Advertising", catN("advertising"), "companies"],
    ["Analytics", catN("analytics"), "companies"],
    ["Social widgets", catN("social"), "companies"],
    ["Session recording", catN("session-replay"), "tools"],
    ["Device fingerprinting", fpTechs.size, "techniques", true],
    ["Data brokers", a.dataCollection ? a.dataCollection.brokerCount : 0, "brokers"],
    ["Cross-site ID syncing", (state.syncEdges || []).length, "links"],
    ["Tracking cookies", a.summary ? a.summary.tracking : 0, "cookies"],
    ["Tracker data in storage", storageN, "keys"]
  ];
  const body = rows.map(([k, n, unit, obs]) =>
    `<div class="nl-row"><span class="nl-key">${esc(k)}${obs ? ` <span class="nl-obs">observed</span>` : ""}</span>` +
    `<span class="nl-val ${n === 0 ? "none" : "hot"}">${n === 0 ? "None" : esc(n + " " + unit)}</span></div>`).join("");
  return `<div class="nlabel"><div class="nl-title">🏷 Privacy label — this page</div>
    <div class="nl-sub">A fixed checklist, same rows every page, so you can compare at a glance.</div>${body}</div>`;
}
function renderData(dc) {
  const panel = $("panel-data");
  const dataHost = (() => { try { return hostnameOf(state.tabUrl) || ""; } catch (e) { return ""; } })();
  const label = nutritionLabelHtml(state.lastAnalysis);
  const fpHtml = fingerprintObservedHtml();
  const empty = !dc || (!dc.collectors.length && !dc.tcf && !dc.trackedSince && !dc.cmp);
  if (empty) {
    panel.innerHTML = label + fpHtml + (fpHtml ? "" : `<div class="empty">🎉 No third-party data collectors detected on this page.</div>`);
    return;
  }
  let html = label + fpHtml + `<div class="data-intro">What these companies are <b>known to be designed to collect</b>, based on their own published disclosures — <b>not</b> read from the cookie values themselves. Each card links to the company's own policy. Tap "Opt out" to exercise your choices.</div>`;

  if (dc.trackedSince) html += `<div class="tracked-since">🕒 ${esc(dc.trackedSince)}</div>`;

  // ---- Consent-string integrity (F2): flag a euconsent-v2 value that doesn't
  // decode as a valid TCF string — the shape used to smuggle non-consent payloads. ----
  const tv = dc.tcfValidation;
  if (tv && (tv.status === "invalid" || tv.status === "suspicious")) {
    html += `<div class="tcf-warn"><div class="tcf-warn-title">⚠ Consent string looks malformed</div>
      <div class="tcf-warn-body">This site's <code>euconsent-v2</code> cookie ${tv.status === "suspicious" ? "decodes, but" : "does <b>not</b> decode as a valid IAB TCF consent string —"} ${esc(tv.reason)}. Consent strings are <b>sometimes misused to smuggle other data</b> (e.g. a disguised device fingerprint). We can't see intent — only that this value isn't a normal consent string.</div></div>`;
  } else if (tv && tv.status === "legacy") {
    html += `<div class="tcf-note">This site uses an older <b>TCF v1</b> consent string (outdated format, not decoded here).</div>`;
  }

  // ---- Consent insight (factual decode + recommend-only auto-reject handoff) ----
  if (dc.tcf || dc.cmp) {
    const t = dc.tcf;
    html += `<div class="tcf-box">`;
    if (dc.cmp) {
      html += `<div class="tcf-title">🧾 Consent on this site</div>
        <div class="tcf-detail">This site manages cookie consent with <b>${esc(dc.cmp.name)}</b>.</div>`;
    } else {
      html += `<div class="tcf-title">🧾 Your ad-consent on this site (IAB TCF v${t.version})</div>`;
    }
    if (t) {
      html += `<div class="tcf-detail">Decoded from your own <code>euconsent-v2</code> cookie: you've consented to <b>${t.numPurposes} of ${t.purposesTotal}</b> data-use purposes and <b>${t.vendorCount}</b> ad vendor${t.vendorCount === 1 ? "" : "s"}.</div>
        <div class="tcf-caveat">Note: under TCF, vendors may also claim <b>legitimate interest</b> to process data <i>without</i> your consent — so the real number of companies acting on this visit can be higher than the consent count above.</div>`;
      // Re-check diff: if the user pressed "Re-check" on this host, show whether
      // the decoded consent actually changed (e.g. after running Consent-O-Matic).
      const snap = state.consentRecheck;
      if (snap && snap.host === dataHost) {
        const changed = snap.numPurposes !== t.numPurposes || snap.vendorCount !== t.vendorCount;
        html += changed
          ? `<div class="tcf-changed">✓ Consent changed since your last check — was <b>${snap.numPurposes} of ${t.purposesTotal}</b> purposes / <b>${snap.vendorCount}</b> vendors, now <b>${t.numPurposes}</b> / <b>${t.vendorCount}</b>.</div>`
          : `<div class="tcf-changed tcf-changed-none">No change yet — if you just rejected via Consent-O-Matic, reload the page so the site rewrites the cookie, then re-check.</div>`;
        state.consentRecheck = null; // one-shot
      }
    }
    // Recommend-only: a free, open-source tool that auto-answers consent dialogs (reject-all).
    // We don't reimplement it — we point to it and re-decode the string afterward.
    html += `<div class="tcf-action">
        <a class="tcf-cta" href="https://consentomatic.au.dk/" target="_blank" rel="noopener">Auto-reject these dialogs with Consent-O-Matic ↗</a>
        ${t ? `<button class="tcf-recheck" id="tcf-recheck" data-np="${t.numPurposes}" data-vc="${t.vendorCount}">↻ Re-check consent</button>` : ""}
        <div class="tcf-action-note">Free &amp; open-source, from Aarhus University — a separate add-on that automatically clicks "reject" on consent banners. After rejecting, reload the page and press <b>Re-check</b> to confirm your decoded consent dropped.</div>
      </div>`;
    html += `</div>`;
  }

  if (dc.brokerCount > 0) {
    const brokers = dc.collectors.filter((c) => c.broker).map((c) => c.brand);
    html += `<div class="broker-banner"><b>${dc.brokerCount} data broker${dc.brokerCount === 1 ? "" : "s"}</b> — ad-tech/data companies that build and trade audience profiles for ad targeting: ${esc(brokers.join(", "))}.</div>`;
  }

  // Roll-up of data types across all collectors.
  html += `<div class="rollup">`;
  for (const r of dc.rollup) {
    html += `<div class="rollup-row" title="${esc(r.brands.join(", "))}">
      <span class="rollup-ico">${r.icon}</span>
      <span class="rollup-label">${esc(r.label)}</span>
      <span class="rollup-count">${r.count} compan${r.count === 1 ? "y" : "ies"}</span>
    </div>`;
  }
  html += `</div>`;

  // Per-company cards.
  for (const c of dc.collectors) {
    const badge = c.broker ? `<span class="dc-badge">DATA BROKER</span>` : "";
    const typeChips = c.types.map((t) => {
      const m = DATA_TYPES[t]; return m ? `<span class="dc-type">${m.icon} ${esc(m.label)}</span>` : "";
    }).join("");
    const links = [];
    if (c.privacy) links.push(`<a class="dc-link" href="${esc(c.privacy)}" target="_blank" rel="noopener">Privacy policy ↗</a>`);
    if (c.optOut) links.push(`<a class="dc-link" href="${esc(c.optOut)}" target="_blank" rel="noopener">Opt out ↗</a>`);
    // When we have no vendor policy to cite, say so — don't assert specifics on our own authority.
    const inferredNote = (!c.privacy && !c.optOut)
      ? `<div class="dc-source" style="font-style:italic">Inferred from its tracking category — no vendor policy on file.</div>` : "";
    html += `<div class="dc-card">
      <div class="dc-head"><span class="dc-name">${esc(c.brand)}</span>${badge}</div>
      <div class="dc-usage">${esc(c.usage)}</div>
      <div class="dc-types">${typeChips}</div>
      ${links.length ? `<div class="dc-links">${links.join("")}</div>` : ""}
      ${inferredNote}
      <div class="dc-source">Seen via: ${esc(c.sources.join(", "))}</div>
    </div>`;
  }
  panel.innerHTML = html;

  // A1: in-place "Re-check consent" — snapshot the current decode, then re-scan so
  // the next render can show whether the consent string actually changed.
  const recheck = $("tcf-recheck");
  if (recheck) recheck.addEventListener("click", () => {
    state.consentRecheck = { host: dataHost, numPurposes: Number(recheck.dataset.np), vendorCount: Number(recheck.dataset.vc) };
    toast("Re-checking consent…");
    scan();
  });
}

// Storage trackers render inline at the foot of the Cookies tab — they're the
// keys that survive a normal "clear cookies", so they belong with the cookies.
function storageSectionHtml(storage) {
  if (!storage) return "";
  const items = [
    ...storage.local.map((s) => ({ ...s, store: "localStorage" })),
    ...storage.session.map((s) => ({ ...s, store: "sessionStorage" }))
  ];
  if (!items.length) return "";
  return `<div class="group-head"><span class="cat-dot" style="background:var(--watch)"></span>Outside cookies<span class="gh-count">${items.length}</span></div>` +
    `<div class="rf-detail" style="margin:0 4px 7px;color:var(--text-faint)">Tracker keys in local/session storage — these survive a normal "clear cookies".</div>` +
    items.map((s) => {
      const meta = CATEGORY_META[s.category] || CATEGORY_META.unknown;
      return `<div class="row">
        <div class="row-icon" style="background:${meta.color}">${esc((s.company || "?").charAt(0))}</div>
        <div class="row-main"><div class="row-title" title="${esc(s.key)}">${esc(s.key)}</div>
          <div class="row-sub">${esc(s.company)} · ${esc(meta.label)}</div></div>
        <div class="row-meta">${esc(s.store)}</div>
      </div>`;
    }).join("");
}

// ---- Brokers tab: brokers seen across the sites you've scanned ----
// Disclosed affiliate links. AFFILIATE_REF is intentionally empty until a real
// partnership exists — we never ship a fake ref tag.
const AFFILIATE_REF = "";
function withRef(url) {
  if (!AFFILIATE_REF) return url;
  return url + (url.includes("?") ? "&" : "?") + "ref=" + encodeURIComponent(AFFILIATE_REF);
}

async function refreshBrokerCount() {
  const log = await getBrokerLog();
  const n = Object.keys(log).length;
  const el = $("c-brokers");
  if (el) el.textContent = n;
}

async function renderBrokers() {
  const panel = $("panel-brokers");
  const log = await getBrokerLog();
  const done = await getOptOutDone();
  const brands = Object.keys(log);
  refreshBrokerCount();

  let html = `<div class="data-intro">Data brokers detected on the sites <b>you've opened CookieLens on</b> — a local record stored only on this device. This is not a claim about your activity across the web; it's a running list from your own scans.</div>`;

  if (!brands.length) {
    html += `<div class="empty">No data brokers recorded yet — that's normal on many sites. CookieLens only counts <b>dedicated data brokers / DMPs</b> (Criteo, LiveRamp, Oracle, The Trade Desk, Lotame…) whose business is buying and selling audience profiles. Big ad platforms like <b>Google and Meta are deliberately not counted as brokers</b>, so a Google-built site (YouTube, Gmail) honestly shows zero here. Brokers typically appear on ad-heavy news, shopping and free-content sites — open CookieLens on a few and they'll collect here with opt-out links.</div>`;
    // Still show the removal-services handoff so the tab is useful from day one.
    html += removalHandoffHtml();
    panel.innerHTML = html;
    return;
  }

  // Sort by how many of your sites each broker appeared on, then recency.
  const rows = brands.map((b) => ({ brand: b, ...log[b] }))
    .sort((a, c) => (c.sites.length - a.sites.length) || (c.lastSeen - a.lastSeen));

  const doneCount = rows.filter((r) => done[r.brand]).length;
  html += `<div class="broker-banner"><b>${rows.length} data broker${rows.length === 1 ? "" : "s"}</b> seen across <b>${new Set(rows.flatMap((r) => r.sites)).size}</b> of the sites you've scanned${doneCount ? ` · <b>${doneCount}</b> marked opted-out` : ""}. Use each opt-out link to exercise your CCPA/GDPR rights, then tick it off below. <span class="broker-banner-note">Ticking is a personal reminder kept on this device — it doesn't verify the broker actually removed you.</span></div>`;

  for (const r of rows) {
    const links = [];
    if (r.optOut) links.push(`<a class="dc-link" href="${esc(r.optOut)}" target="_blank" rel="noopener">Opt out ↗</a>`);
    if (r.privacy) links.push(`<a class="dc-link" href="${esc(r.privacy)}" target="_blank" rel="noopener">Privacy policy ↗</a>`);
    const siteList = r.sites.slice(-6).reverse().map(esc).join(", ");
    const isDone = !!done[r.brand];
    const doneDate = isDone ? new Date(done[r.brand]).toLocaleDateString() : "";
    const tick = isDone
      ? `<button class="broker-tick done" data-brand="${esc(r.brand)}" aria-pressed="true">✓ Opted out · ${esc(doneDate)} · undo</button>`
      : `<button class="broker-tick" data-brand="${esc(r.brand)}" aria-pressed="false">Mark opted out</button>`;
    html += `<div class="dc-card${isDone ? " broker-done" : ""}">
      <div class="dc-head"><span class="dc-name">${esc(r.brand)}</span><span class="dc-badge">DATA BROKER</span></div>
      <div class="dc-usage">Seen on <b>${r.sites.length}</b> of your site${r.sites.length === 1 ? "" : "s"}${siteList ? `: ${siteList}${r.sites.length > 6 ? "…" : ""}` : ""}.</div>
      ${links.length ? `<div class="dc-links">${links.join("")}</div>` : `<div class="dc-source" style="font-style:italic">No vendor opt-out URL on file.</div>`}
      <div class="broker-track">${tick}</div>
    </div>`;
  }

  html += `<div class="broker-actions"><button class="gh-clear" id="clear-brokerlog">Clear broker log</button></div>`;
  html += removalHandoffHtml();
  panel.innerHTML = html;

  const clr = $("clear-brokerlog");
  if (clr) clr.addEventListener("click", async () => {
    await chrome.storage.local.remove(BROKER_LOG_KEY);
    toast("Broker log cleared");
    renderBrokers();
  });

  // B1: toggle a broker's local "opted out" reminder.
  panel.querySelectorAll(".broker-tick").forEach((b) => b.addEventListener("click", async () => {
    const brand = b.dataset.brand;
    const nowDone = b.getAttribute("aria-pressed") !== "true";
    await setOptOutDone(brand, nowDone);
    toast(nowDone ? `Marked ${brand} opted-out` : `Cleared ${brand} reminder`);
    renderBrokers();
  }));
}

// Honest, disclosed affiliate handoff to paid bulk-removal services. These are
// the out-of-scope part (a free local tool can't file CCPA/GDPR removals for
// hundreds of brokers) — so we point to services that do, and say it's affiliate.
function removalHandoffHtml() {
  const rel = AFFILIATE_REF ? "noopener sponsored" : "noopener nofollow";
  return `<div class="removal-box">
    <div class="removal-title">Want these removed in bulk?</div>
    <div class="removal-sub">CookieLens shows you the brokers and links you to each opt-out for free. Filing removals across <b>hundreds</b> of brokers by hand is a slog — paid services automate it under CCPA/GDPR:</div>
    <div class="removal-links">
      <a class="removal-link" href="${esc(withRef("https://incogni.com/"))}" target="_blank" rel="${rel}">Incogni ↗</a>
      <a class="removal-link" href="${esc(withRef("https://joindeleteme.com/"))}" target="_blank" rel="${rel}">DeleteMe ↗</a>
    </div>
    <div class="removal-disclosure">${AFFILIATE_REF
      ? `These are <b>affiliate links</b> — if you subscribe, CookieLens may earn a commission at no extra cost to you. `
      : `If CookieLens ever partners with these services, these may become affiliate links (we'd earn a commission at no extra cost to you). They are <b>not</b> today — they're plain links. `}They're independent paid services, not part of CookieLens, and CookieLens stays free either way.</div>
  </div>`;
}

function renderRiskDetail(risk) {
  const panel = $("risk-detail");
  let html = historyBlock();

  if (!risk.factors.length) {
    html += `<div class="empty">No notable privacy risks detected. 🎉</div>`;
  } else {
    for (const f of risk.factors) {
      const w = Math.min(100, (f.points / 35) * 100);
      html += `<div class="risk-factor">
        <div class="rf-head"><span>${esc(f.label)}</span><span class="rf-points">+${f.points}</span></div>
        <div class="rf-bar"><div class="rf-fill" style="width:${w}%"></div></div>
        <div class="rf-detail">${esc(f.detail)}</div>
      </div>`;
    }
  }
  html += `<div class="rf-detail" style="padding:8px 4px;color:var(--text-faint)">Score sums weighted privacy signals (trackers, ad/data-broker cookies, session recorders, breadth of companies, cookie lifetime & security). Lower is better. Higher weight = more invasive.</div>`;
  panel.innerHTML = html;
}

// ---------------- UI plumbing ----------------
function showMessage(html) {
  $("hero").hidden = true;
  $("tabs").hidden = true;
  $("content").hidden = true;
  $("actionbar").hidden = true;
  const m = $("message");
  m.hidden = false;
  m.innerHTML = html;
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", String(on));
      });
      const which = btn.dataset.tab;
      for (const name of ["cookies", "trackers", "data", "brokers"]) {
        $(`panel-${name}`).hidden = name !== which;
      }
      // Collapse the "what's driving this" detail when changing tabs so it
      // doesn't sit above an unrelated panel.
      $("risk-detail").hidden = true;
      $("risk-toggle").setAttribute("aria-expanded", "false");
      if (which === "brokers") renderBrokers();
    });
  });
}

// ---- Copy report ----
function buildReport(a) {
  const L = [];
  L.push(`CookieLens report — ${state.tabUrl}`);
  L.push(`Risk: grade ${a.risk.grade} (${a.risk.score}/100) — ${a.risk.verdict}`);
  L.push(`Cookies: ${a.summary.total} total · ${a.summary.firstParty} first-party · ${a.summary.thirdParty} third-party · ${a.summary.hidden} hidden`);
  L.push(`Trackers: ${a.summary.trackerDomains} known · ${a.summary.otherThirdParties} other third-party · ${a.summary.companies} companies`);
  if (a.trackerDomains.length) { L.push("", "Known trackers:"); a.trackerDomains.forEach((t) => L.push(`  - ${t.company} (${t.category}) — ${t.domain} [${t.cookieCount} cookies, ${t.requestCount} reqs]`)); }
  if (a.otherThirdParties.length) { L.push("", "Other third-party connections:"); a.otherThirdParties.forEach((o) => L.push(`  - ${o.domain} [${o.cookieCount} cookies, ${o.requestCount} reqs]`)); }
  if (a.dataCollection?.collectors.length) {
    L.push("", `Data collectors (what they are known to be designed to collect — per their own disclosures, ${a.dataCollection.brokerCount} data broker(s)):`);
    if (a.dataCollection.trackedSince) L.push(`  ${a.dataCollection.trackedSince}`);
    a.dataCollection.collectors.forEach((c) => L.push(`  - ${c.brand}${c.broker ? " [DATA BROKER]" : ""}: ${c.types.map((t) => (DATA_TYPES[t] || {}).label || t).join("; ")}${c.optOut ? `  (opt out: ${c.optOut})` : ""}`));
  }
  const dc = a.dataCollection;
  if (dc?.cmp || dc?.tcf) {
    L.push("", "Consent:");
    if (dc.cmp) L.push(`  Consent managed by ${dc.cmp.name}.`);
    if (dc.tcf) L.push(`  IAB TCF v${dc.tcf.version}: consented to ${dc.tcf.numPurposes} of ${dc.tcf.purposesTotal} purposes, ${dc.tcf.vendorCount} vendor(s). (Vendors may also claim legitimate interest without consent.)`);
  }
  if (a.risk.factors.length) { L.push("", "Risk factors:"); a.risk.factors.forEach((f) => L.push(`  +${f.points} ${f.label} — ${f.detail}`)); }
  L.push("", "Cookies:");
  a.cookies.forEach((c) => L.push(`  - ${c.name} [${c.party}-party · ${c.category}${c.hidden ? " · hidden" : ""}] ${c.company} — ${c.purpose}`));
  L.push("", "Generated locally by CookieLens.");
  return L.join("\n");
}

async function copyReport() {
  if (!state.lastAnalysis) return;
  try { await navigator.clipboard.writeText(buildReport(state.lastAnalysis)); toast("Report copied to clipboard"); }
  catch (e) { toast("Copy failed — clipboard blocked"); }
}

// ---- JSON export (full findings, downloaded as a file) ----
function exportJson() {
  const a = state.lastAnalysis;
  if (!a) return;
  const report = {
    generatedBy: "CookieLens", url: state.tabUrl, scannedAt: new Date().toISOString(),
    risk: a.risk, summary: a.summary,
    cookies: a.cookies.map((c) => ({ name: c.name, domain: c.domain, party: c.party, category: c.category, company: c.company, hidden: c.hidden, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite, partitioned: c.partitioned, expiry: c.expiry.text, purpose: c.purpose, insight: c.insight })),
    trackers: a.trackerDomains, otherThirdParties: a.otherThirdParties,
    dataCollection: a.dataCollection, storage: a.storage, history: state.history || []
  };
  try {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const host = (function () { try { return new URL(state.tabUrl).hostname; } catch { return "report"; } })();
    const link = document.createElement("a");
    link.href = url; link.download = `cookielens-${host}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("Downloaded JSON report");
  } catch (e) { toast("Export failed"); }
}

// ---- Grade-history sparkline ----
function historyBlock() {
  const h = state.history || [];
  if (h.length < 2) return "";
  const w = 340, ht = 32, n = h.length;
  const max = 100;
  const pts = h.map((p, i) => {
    const x = (i / (n - 1)) * (w - 8) + 4;
    const y = ht - 4 - (p.score / max) * (ht - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const grades = h.slice(-8).map((p) => p.grade).join(" ");
  const last = h[h.length - 1], first = h[0];
  const trend = last.score < first.score ? "improving ↓" : last.score > first.score ? "worsening ↑" : "steady";
  const GRADE_COLOR = { A: "#34E1C8", B: "#34E1C8", C: "#FFB020", D: "#FF6A4D", F: "#FF2D6B" };
  const lineColor = GRADE_COLOR[last.grade] || "#34E1C8";
  return `<div class="risk-factor">
    <div class="rf-head"><span>This site over time</span><span class="rf-points" style="color:var(--text-dim)">${n} scans · ${esc(trend)}</span></div>
    <svg width="100%" viewBox="0 0 ${w} ${ht}" preserveAspectRatio="none" style="margin:7px 0 4px;display:block">
      <polyline points="${pts}" fill="none" stroke="${lineColor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>
    <div class="rf-detail">Recent grades: ${esc(grades)} · lower score is better.</div>
  </div>`;
}

// ---- Clear tracker cookies (two-click confirm; keeps login/session cookies) ----
let clearArmed = false;
function onClearClick() {
  const btn = $("clear-trackers");
  if (!clearArmed) {
    clearArmed = true;
    btn.classList.add("confirm");
    btn.textContent = "⚠ Click again to confirm";
    clearTimeout(onClearClick._t);
    onClearClick._t = setTimeout(() => resetClearButton(), 3500);
    return;
  }
  resetClearButton();
  clearTrackers();
}
function resetClearButton() {
  clearArmed = false;
  const btn = $("clear-trackers");
  btn.classList.remove("confirm");
  btn.textContent = "🧹 Clear tracker cookies";
}
async function removeCookieList(cookies) {
  let removed = 0;
  for (const c of cookies) {
    const host = c.domain.replace(/^\./, "");
    const url = `${c.secure ? "https" : "http"}://${host}${c.path || "/"}`;
    const opts = { url, name: c.name };
    if (c.partitionKey) opts.partitionKey = c.partitionKey;
    try { await chrome.cookies.remove(opts); removed++; } catch (e) {}
  }
  return removed;
}
// A cookie is "kept" (deliberately preserved) when it was flagged as tracking
// or looks like a login, but the safety gate refused to delete it.
function keptCount(cookies) {
  return cookies.filter((c) => (c.isTracking || looksLikeAuthName(c.name)) && !isClearableTrackerCookie(c)).length;
}
function keptSuffix(kept) {
  return kept ? ` · kept ${kept} login/session cookie${kept === 1 ? "" : "s"}` : " · logins kept";
}
async function clearTrackers() {
  const a = state.lastAnalysis;
  if (!a) return;
  const kept = keptCount(a.cookies);
  const removed = await removeCookieList(a.cookies.filter(isClearableTrackerCookie));
  toast(`Cleared ${removed} tracker cookie${removed === 1 ? "" : "s"}${keptSuffix(kept)}`);
  setTimeout(scan, 400);
}
async function clearCompany(company) {
  const a = state.lastAnalysis;
  if (!a) return;
  // Clear this company's tracking cookies only — leave any login/session ones.
  const mine = a.cookies.filter((c) => canonicalEntity(c.company) === company);
  const kept = keptCount(mine);
  const removed = await removeCookieList(mine.filter(isClearableTrackerCookie));
  toast(`Cleared ${removed} ${company} cookie${removed === 1 ? "" : "s"}${keptSuffix(kept)}`);
  setTimeout(scan, 400);
}

function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), 2200);
}

// Live updates: keep the numbers fresh when cookies change ON THIS PAGE.
// Cookie churn from unrelated domains (the old bug: every site's ad cookies
// fired a full rebuild that collapsed your cards) is ignored. A relevant change
// runs a quiet "live" scan that updates the hero/counts but leaves the lists you
// are reading untouched — they refresh on open or an explicit ↻ Rescan.
let rescanTimer = null;
chrome.runtime.onMessage.addListener((msg) => {
  if (IS_REPORT_VIEW) return; // the report tab never live-rescans
  if (msg?.type === "cookieChanged") {
    const reg = registrableDomain((msg.domain || "").replace(/^\./, ""));
    if (reg && state.relevantDomains.size && !state.relevantDomains.has(reg)) return;
    clearTimeout(rescanTimer);
    rescanTimer = setTimeout(() => scan({ live: true }), 1000);
  }
});

// ================= Long Exposure: timed tracking report =================
const REPORT_DURATIONS = [
  { key: "1h", label: "1 hour" }, { key: "24h", label: "24 hours" },
  { key: "7d", label: "7 days" }, { key: "30d", label: "30 days" }
];

function fmtLeft(ms) {
  if (ms <= 0) return "wrapping up…";
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m left`;
  return `${Math.floor(h / 24)}d ${h % 24}h left`;
}
function fmtAgo(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 48 ? `${h}h` : `${Math.floor(h / 24)}d`;
}
async function fetchReport() {
  try { const r = await chrome.runtime.sendMessage({ type: "getReport" }); return (r && r.report) || null; }
  catch (e) { return null; }
}
function dominantCat(cats) {
  let best = "unknown", n = -1;
  for (const [c, v] of Object.entries(cats || {})) if (v > n) { n = v; best = c; }
  return best;
}
function companyColor(cats) { return (CATEGORY_META[dominantCat(cats)] || CATEGORY_META.unknown).color; }
const cnt = (x) => Array.isArray(x) ? x.length : Object.keys(x || {}).length;
const catLabel = (c) => (CATEGORY_META[c] || CATEGORY_META.unknown).label;
const catColor = (c) => (CATEGORY_META[c] || CATEGORY_META.unknown).color;
// Honest reach denominator = every top-level site you visited during the window
// (not just the ones that tracked you), so clean sites dilute a company's reach.
function visitedCount(r) { return Object.keys(r.visited || {}).length || Object.keys(r.sites || {}).length; }
function topCompanies(r, n) {
  const rows = Object.entries(r.companies || {}).map(([name, c]) => ({ name, ...c, siteCount: cnt(c.sites) }))
    .sort((a, b) => b.siteCount - a.siteCount || b.requests - a.requests);
  return n ? rows.slice(0, n) : rows;
}

// ---- Header button ----
async function refreshReportBtn() {
  const btn = $("report-btn"); if (!btn) return;
  const r = await fetchReport();
  btn.classList.remove("running", "ready");
  const label = btn.querySelector(".rec-label");
  if (r && r.status === "running") {
    btn.classList.add("running");
    if (label) label.textContent = fmtLeft(r.endsAt - Date.now());
    btn.title = `Long Exposure running — ${fmtLeft(r.endsAt - Date.now())}`;
  } else if (r && r.status === "done" && !r.seen) {
    btn.classList.add("ready");
    if (label) label.textContent = "Report ready";
    btn.title = "Your Long Exposure report is ready";
  } else {
    if (label) label.textContent = "Report";
    btn.title = "Long Exposure — a timed tracking report";
  }
}

// ---- Sheet ----
function openSheet() { renderSheet(); $("report-sheet").hidden = false; }
function closeSheet() { $("report-sheet").hidden = true; refreshReportBtn(); }
async function renderSheet() {
  const body = $("sheet-body");
  const r = await fetchReport();
  const tail = savedSection(await listSaved());
  if (!r) { body.innerHTML = sheetStartHtml() + tail; wireSheetStart(); wireSaved(); return; }
  const st = await reportState(r, {});
  if (r.status === "running") { body.innerHTML = sheetRunningHtml(r, st) + tail; wireSheetRunning(); wireSaved(); wireInsightActions(); return; }
  body.innerHTML = sheetDoneHtml(r, st) + tail; wireSheetDone(r); wireSaved(); wireInsightActions();
  chrome.runtime.sendMessage({ type: "markReportSeen" }).catch(() => {});
}
function sheetStartHtml() {
  const opts = REPORT_DURATIONS.map((d) => `<button class="dur-btn" data-key="${d.key}">${d.label}</button>`).join("");
  return `<p class="sheet-lead">Watch who tracks you <b>across every site you visit</b> for a set window, then see the developed picture — ranked by reach.</p>
    <div class="dur-grid">${opts}</div>
    <p class="sheet-note">While running, CookieLens keeps a <b>local</b> log of which sites you open and the tracker companies seen on them — stored only on this device, nothing sent anywhere. You can <b>stop &amp; delete</b> it anytime.</p>`;
}
function sheetRunningHtml(r, st) {
  const companies = Object.keys(r.companies).length, sites = visitedCount(r);
  const top = topCompanies(r, 3).map((c) => `<li><span class="rk-dot" style="background:${companyColor(c.categories)}"></span>${esc(c.name)} <span class="rk-reach">${c.siteCount}/${sites || 1}</span></li>`).join("");
  return `<div class="run-status"><span class="run-pulse"></span><b>Recording</b> · ${esc(r.durationLabel)} · ${fmtLeft(r.endsAt - Date.now())}</div>
    <div class="run-stats"><span><b>${companies}</b> companies</span><span><b>${sites}</b> sites</span><span><b>${r.cookieWrites || 0}</b> tracker cookies</span></div>
    ${top ? `<div class="run-top-h">Watching you most so far</div><ul class="run-top">${top}</ul>` : `<p class="sheet-note">No third-party trackers seen yet — keep browsing.</p>`}
    ${insMiniHtml(r, st)}
    ${transitMini(r)}
    <div class="sheet-actions"><button id="rep-view" class="action-btn">View live report ↗</button><button id="rep-stop" class="action-btn danger">Stop &amp; delete</button></div>`;
}
function sheetDoneHtml(r, st) {
  const sites = visitedCount(r), companies = Object.keys(r.companies).length;
  return `<div class="done-badge">✓ Report ready</div>
    <p class="sheet-lead">Your <b>${esc(r.durationLabel)}</b> exposure developed: <b>${companies}</b> companies tracked you across <b>${sites}</b> sites you visited.</p>
    ${insMiniHtml(r, st)}
    ${transitMini(r)}
    <div class="sheet-actions"><button id="rep-view" class="action-btn">View full report ↗</button><button id="rep-new" class="action-btn">Start new</button><button id="rep-stop" class="action-btn danger">Delete</button></div>`;
}
function wireSheetStart() {
  $("sheet-body").querySelectorAll(".dur-btn").forEach((b) => b.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "startReport", durationKey: b.dataset.key });
    toast(`Long Exposure started · ${b.textContent}`); renderSheet(); refreshReportBtn();
  }));
}
function wireSheetRunning() {
  const v = $("rep-view"); if (v) v.addEventListener("click", () => openReportTab());
  const s = $("rep-stop"); if (s) s.addEventListener("click", stopReport);
}
function wireSheetDone(r) {
  const v = $("rep-view"); if (v) v.addEventListener("click", () => openReportTab());
  const n = $("rep-new"); if (n) n.addEventListener("click", () => { $("sheet-body").innerHTML = startWithSaveHtml(r); wireStartWithSave(r); });
  const s = $("rep-stop"); if (s) s.addEventListener("click", stopReport);
}
// Start-new flow that ASKS to save the current report first (then it'll be replaced).
function startWithSaveHtml(r) {
  const sites = visitedCount(r), companies = Object.keys(r.companies || {}).length;
  const opts = REPORT_DURATIONS.map((d) => `<button class="dur-btn" data-key="${d.key}">${d.label}</button>`).join("");
  return `<p class="sheet-lead">Start a new recording?</p>
    <div class="save-prompt">Your current report (<b>${esc(r.durationLabel)}</b> · ${companies} companies · ${sites} sites) will be <b>replaced</b>. Save it to history first?</div>
    <div class="sheet-actions"><button id="save-current" class="action-btn">💾 Save to history</button></div>
    <p class="save-status" id="save-status"></p>
    <div class="dur-grid">${opts}</div>
    <p class="sheet-note">Pick a duration to begin the new recording (this replaces the current one unless you saved it).</p>`;
}
function wireStartWithSave(r) {
  const save = $("save-current");
  if (save) save.addEventListener("click", async () => {
    const res = await chrome.runtime.sendMessage({ type: "saveReport" });
    const st = $("save-status");
    if (res && res.ok) { save.disabled = true; save.textContent = "✓ Saved to history"; if (st) st.textContent = "Saved — find it under “Saved reports” below after you start."; }
    else if (st) st.textContent = "Nothing to save.";
  });
  $("sheet-body").querySelectorAll(".dur-btn").forEach((b) => b.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "startReport", durationKey: b.dataset.key });
    toast(`Long Exposure started · ${b.textContent}`); renderSheet(); refreshReportBtn();
  }));
}
async function stopReport() {
  await chrome.runtime.sendMessage({ type: "stopReport" });
  toast("Report stopped & deleted"); renderSheet(); refreshReportBtn();
}
function openReportTab(id) { chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?view=report" + (id ? "&id=" + encodeURIComponent(id) : "")) }); }
async function listSaved() { try { const r = await chrome.runtime.sendMessage({ type: "listSavedReports" }); return (r && r.list) || []; } catch (e) { return []; } }
function savedSection(list) {
  if (!list.length) return "";
  return `<div class="saved-wrap"><div class="saved-h">Saved reports · ${list.length}</div>` +
    list.map((s) => `<div class="saved-row"><button class="saved-open" data-id="${esc(s.id)}"><b>${esc(s.durationLabel)}</b><span>${s.companies} co · ${s.sites} sites · ${fmtAgo(s.savedAt || s.completedAt || s.startedAt)} ago</span></button><button class="saved-del" data-id="${esc(s.id)}" title="Delete saved report">✕</button></div>`).join("") +
    `</div>`;
}
function wireSaved() {
  document.querySelectorAll(".saved-open").forEach((b) => b.addEventListener("click", () => openReportTab(b.dataset.id)));
  document.querySelectorAll(".saved-del").forEach((b) => b.addEventListener("click", async () => { await chrome.runtime.sendMessage({ type: "deleteSavedReport", id: b.dataset.id }); renderSheet(); }));
}

// ---- Full report view (popup.html?view=report) ----
async function bootReport() {
  document.body.classList.add("report-mode");
  const host = $("report-view"); host.hidden = false;
  const id = new URLSearchParams(location.search).get("id");
  let r, saved = false;
  if (id) {
    try { const res = await chrome.runtime.sendMessage({ type: "getSavedReport", id }); r = res && res.report; saved = true; } catch (e) {}
  } else {
    r = await fetchReport();
    chrome.runtime.sendMessage({ type: "markReportSeen" }).catch(() => {});
  }
  const st = await reportState(r, { saved });
  host.innerHTML = renderReportHtml(r, st);
  wireReportView(r, st);
  wireInsightActions();
}
function sparkHtml(r) {
  const idxs = Object.keys(r.buckets).map(Number);
  if (!idxs.length) return "";
  const max = Math.max(...idxs);
  let peak = 0;
  for (let i = 0; i <= max; i++) peak = Math.max(peak, r.buckets[i] || 0);
  if (!peak) return "";
  const bars = [];
  for (let i = 0; i <= max; i++) {
    const v = r.buckets[i] || 0;
    bars.push(`<span class="spk" style="height:${Math.max(3, Math.round((v / peak) * 100))}%" title="${v} hits"></span>`);
  }
  const unit = r.bucketMs >= 24 * 3600e3 ? "per day" : r.bucketMs >= 3600e3 ? "per hour" : "per 5 min";
  return `<div class="rv-spark"><div class="rv-spark-bars">${bars.join("")}</div><div class="rv-spark-cap">tracker hits ${unit}</div></div>`;
}
// ---- Transit map: sites = stations, companies = colored lines threading through
// every site they tracked you on. Horizontal metro for the wide recorder view. ----
function truncMid(s, n) { s = String(s); return s.length <= n ? s : s.slice(0, n - 1) + "…"; }
// Distinct per-line colors (like real metro lines). All in the "watcher" warm/magenta
// range — never the cyan reserved for "your side". Category is shown via the leaderboard.
const LINE_COLORS = ["#FF6A4D", "#FFB020", "#C66BFF", "#FF2D6B", "#E0C341", "#FF8C42", "#7C9CFF", "#FF9EC4"];
// Shared data extraction: top companies as lines, busiest sites as stations.
function transitData(r, maxLines, maxStations) {
  const total = visitedCount(r) || 1;
  const seen = new Set(), lines = [];
  for (const c of topCompanies(r)) {
    const ent = canonicalEntity(c.name);
    if (seen.has(ent)) continue;
    seen.add(ent);
    const p = dataProfileFor(c.name, dominantCat(c.categories));
    lines.push({ ent, color: LINE_COLORS[lines.length % LINE_COLORS.length], broker: !!(p && p.broker), siteCount: c.siteCount, reach: Math.min(100, Math.round(c.siteCount / total * 100)) });
    if (lines.length >= maxLines) break;
  }
  const siteCos = {};
  for (const [reg, s] of Object.entries(r.sites || {})) {
    const cos = new Set(Object.keys(s.companies || {}).map(canonicalEntity));
    if (cos.size) siteCos[reg] = cos;
  }
  // Order stations by how many of the SHOWN lines stop there — busiest interchange first.
  const lineEnts = new Set(lines.map((l) => l.ent));
  const score = (reg) => [...siteCos[reg]].filter((e) => lineEnts.has(e)).length;
  let stations = Object.keys(siteCos).sort((a, b) => score(b) - score(a) || siteCos[b].size - siteCos[a].size || a.localeCompare(b));
  const moreStations = Math.max(0, stations.length - maxStations);
  stations = stations.slice(0, maxStations);
  if (stations.length < 2 || lines.length < 1) return null; // a map needs ≥2 stations
  let busyCol = 0, busyCount = -1;
  stations.forEach((reg, j) => { const c = score(reg); if (c > busyCount) { busyCount = c; busyCol = j; } });
  return { lines, stations, siteCos, moreStations, total, busyCol, busyCount, busyReg: stations[busyCol] };
}
// Render the metro SVG for given data + geometry. Same renderer for recorder & popup.
function transitSvg(d, g) {
  const { lines, stations, siteCos, busyCol } = d;
  const W = g.gutter + (stations.length - 1) * g.colStep + g.rightPad;
  const laneY = (i) => g.padT + i * g.laneStep + 8;
  const colX = (j) => g.gutter + j * g.colStep;
  const H = laneY(lines.length - 1) + g.labelH;
  let grid = "", labels = "", dots = "", paths = "", reach = "";
  const topY = laneY(0) - 11, botY = laneY(lines.length - 1) + 11;
  stations.forEach((reg, j) => {
    const x = colX(j), hot = j === busyCol;
    grid += `<line class="tm-grid${hot ? " hot" : ""}" x1="${x}" y1="${topY}" x2="${x}" y2="${botY}"/>`;
    labels += `<text class="tm-stn${hot ? " hot" : ""}" x="${x}" y="${botY + 13}" transform="rotate(-40 ${x} ${botY + 13})" font-size="${g.stnFont}">${esc(truncMid(reg, g.stnTrunc))}</text>`;
  });
  lines.forEach((ln, i) => {
    const y = laneY(i);
    const cols = stations.map((s, j) => siteCos[s].has(ln.ent) ? j : -1).filter((j) => j >= 0);
    if (cols.length > 1) paths += `<path class="tm-line" d="M ${colX(cols[0])} ${y} L ${colX(cols[cols.length - 1])} ${y}" stroke="${ln.color}" stroke-width="${g.lineW}"/>`;
    else if (cols.length === 1) paths += `<circle cx="${colX(cols[0])}" cy="${y}" r="${g.dotR - 1}" fill="${ln.color}"/>`;
    cols.forEach((j) => { dots += `<circle class="tm-stop" cx="${colX(j)}" cy="${y}" r="${g.dotR}" stroke="${ln.color}" stroke-width="${g.stopW}"><title>${esc(ln.ent)} tracked you on ${esc(stations[j])}</title></circle>`; });
    labels += `<text class="tm-co" x="${g.gutter - 12}" y="${y + 3.5}" fill="${ln.color}" font-size="${g.coFont}">${esc(truncMid(ln.ent, g.coTrunc))}${ln.broker ? " ◆" : ""}</text>`;
    if (g.showReach) reach += `<text class="tm-reach" x="${W - 3}" y="${y + 3.5}" fill="${ln.color}">${ln.reach}%</text>`;
  });
  const defs = `<defs><filter id="tmglow" x="-10%" y="-60%" width="120%" height="220%"><feGaussianBlur stdDeviation="${g.glow}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  return `<svg class="tm-svg" viewBox="0 0 ${W} ${H}" style="max-width:${W}px" role="group" aria-label="Transit map of trackers across the sites you visited" preserveAspectRatio="xMinYMin meet">${defs}${grid}<g filter="url(#tmglow)">${paths}</g>${dots}${labels}${reach}</svg>`;
}
const TM_BIG = { gutter: 112, colStep: 74, laneStep: 33, padT: 18, labelH: 78, rightPad: 50, dotR: 5.5, lineW: 5, stopW: 3, coFont: 12, stnFont: 9.5, coTrunc: 13, stnTrunc: 16, showReach: true, glow: 2.4 };
const TM_MINI = { gutter: 72, colStep: 48, laneStep: 25, padT: 10, labelH: 52, rightPad: 14, dotR: 4, lineW: 3.5, stopW: 2.2, coFont: 10, stnFont: 8, coTrunc: 9, stnTrunc: 12, showReach: false, glow: 1.4 };
function renderTransitMap(r) {
  const d = transitData(r, 8, 14);
  if (!d) return "";
  const pervasive = d.lines.filter((l) => l.reach >= 30);
  const takeaway = pervasive.length
    ? `<b>${pervasive.length} compan${pervasive.length === 1 ? "y" : "ies"}</b> followed you across a third or more of your browsing — ${esc(pervasive.slice(0, 3).map((l) => l.ent).join(", "))}${pervasive.length > 3 ? ` +${pervasive.length - 3}` : ""}.`
    : `No single company dominated — tracking was spread across many.`;
  const busy = d.busyCount >= 2 ? ` Your most-tracked site here was <b>${esc(d.busyReg)}</b> (${d.busyCount} of these companies).` : "";
  return `<div class="rv-section tm-section"><h2>Tracking map</h2>
    <p class="tm-real">🛰 ${takeaway}${busy}</p>
    <p class="rv-sub">Each <b>row is a company</b>, each <b>column is a site you visited</b>. A stop (●) means that company was tracking you on that site; the <b>%</b> on the right is how much of your browsing it followed you across. A line reaching all the way across is watching you almost everywhere. <span class="tm-key">◆ data broker · highlighted column = your most-tracked site</span></p>
    <div class="tm-scroll">${transitSvg(d, TM_BIG)}</div>
    ${d.moreStations ? `<p class="rv-caps">+ ${d.moreStations} more site${d.moreStations === 1 ? "" : "s"} not shown (showing the ${d.stations.length} where the most of these companies converged).</p>` : ""}
  </div>`;
}
function transitMini(r) {
  const d = transitData(r, 4, 6);
  if (!d) return "";
  return `<div class="tm-mini-h">Tracking map · top ${d.lines.length}</div><div class="tm-scroll tm-mini">${transitSvg(d, TM_MINI)}</div>`;
}

// quick distinct-domain category counts for the hero strip
function categoryStrip(r) {
  const counts = {};
  for (const d of Object.values(r.domains || {})) if (d.known && TRACKING_CATS.has(d.category)) counts[d.category] = (counts[d.category] || 0) + 1;
  const order = ["advertising", "data-broker", "fingerprinting", "session-replay", "social", "analytics"];
  const chips = order.filter((c) => counts[c]).map((c) => `<span class="cat-chip" style="--cc:${catColor(c)}">${counts[c]} ${esc(catLabel(c))}</span>`).join("");
  return chips ? `<div class="cat-strip">${chips}</div>` : "";
}
function companyRows(r, sites) {
  const allRows = topCompanies(r);
  if (!allRows.length) return `<div class="rv-empty">No tracking companies recorded yet. Trackers appear here as you browse with a report running.</div>`;
  const maxReach = allRows[0].siteCount || 1;
  const LCAP = 15;
  const rows = allRows.slice(0, LCAP);
  const more = allRows.length - rows.length;
  return rows.map((c) => {
    const pct = sites ? Math.min(100, Math.round((c.siteCount / sites) * 100)) : 0;
    const w = Math.min(100, (c.siteCount / maxReach) * 100);
    const prof = dataProfileFor(c.name, dominantCat(c.categories));
    const tag = prof && prof.broker ? `<span class="lb-broker">data broker</span>` : "";
    const cats = Object.keys(c.categories || {}).map((cat) => `<span class="mini-chip" style="--cc:${catColor(cat)}">${esc(catLabel(cat))}</span>`).join("");
    const domains = Object.keys(c.domains || {}).sort();
    const seenOn = Object.keys(c.sites || {}).sort();
    return `<details class="rv-co">
      <summary class="lb-row"><div class="lb-name"><span class="lb-caret" aria-hidden="true">▸</span><span class="lb-dot" style="background:${companyColor(c.categories)}"></span>${esc(c.name)}${tag}</div>
        <div class="lb-bar"><div class="lb-fill" style="width:${w.toFixed(1)}%;background:${companyColor(c.categories)}"></div></div>
        <div class="lb-reach"><b>${pct}%</b><span>${c.siteCount}/${sites} sites</span></div></summary>
      <div class="rv-co-body">
        ${cats ? `<div class="co-meta">${cats}</div>` : ""}
        <div class="co-line"><span class="co-k">Domains (${domains.length})</span> <span class="co-v mono">${domains.map(esc).join(", ") || "—"}</span></div>
        <div class="co-line"><span class="co-k">Seen on</span> <span class="co-v mono">${seenOn.map(esc).join(", ")}</span></div>
        ${prof && prof.optOut ? `<a class="dc-link" href="${esc(prof.optOut)}" target="_blank" rel="noopener">Opt out of ${esc(c.name)} ↗</a>` : ""}
      </div></details>`;
  }).join("") + (more > 0 ? `<div class="conn-more">+ ${more} more compan${more === 1 ? "y" : "ies"} (full list in the JSON export)</div>` : "");
}
function connectionsSection(r) {
  const unknown = Object.entries(r.domains || {}).filter(([, v]) => !v.known).map(([domain, v]) => ({ domain, ...v }))
    .sort((a, b) => cnt(b.sites) - cnt(a.sites) || b.requests - a.requests);
  if (!unknown.length) return "";
  // Attribute the not-in-our-list domains to an owning company via the bundled
  // DuckDuckGo Tracker Radar entity map — shrinking the truly-unknown pile.
  const byEnt = {}, stillUnknown = [];
  for (const u of unknown) {
    const ent = trEntity(u.domain);
    if (ent) { (byEnt[ent] = byEnt[ent] || []).push(u); }
    else stillUnknown.push(u);
  }
  let html = "";
  const allGroups = Object.entries(byEnt).sort((a, b) => b[1].length - a[1].length);
  if (allGroups.length) {
    const ICAP = 12, groups = allGroups.slice(0, ICAP), moreI = allGroups.length - groups.length;
    html += `<div class="rv-section"><h2>Identified connections <span class="h2-n">${allGroups.reduce((n, g) => n + g[1].length, 0)}</span></h2>
      <p class="rv-sub">Domains not in our curated list, but attributed to a known company via the bundled <b>DuckDuckGo Tracker Radar</b> dataset — these used to show as "unrecognized."</p>
      ${groups.map(([ent, list]) => `<div class="conn-row"><span class="conn-ent"><b>${esc(ent)}</b> <span class="conn-meta">${list.length} domain${list.length === 1 ? "" : "s"}</span></span><span class="mono conn-doms">${list.slice(0, 6).map((u) => esc(u.domain)).join(", ")}${list.length > 6 ? ` +${list.length - 6}` : ""}</span></div>`).join("")}
      ${moreI > 0 ? `<div class="conn-more">+ ${moreI} more compan${moreI === 1 ? "y" : "ies"} (full list in the JSON export)</div>` : ""}
    </div>`;
  }
  if (stillUnknown.length) {
    const UCAP = 30, rows = stillUnknown.slice(0, UCAP).map((u) => `<div class="conn-row"><span class="mono">${esc(u.domain)}</span><span class="conn-meta">${cnt(u.sites)} site${cnt(u.sites) === 1 ? "" : "s"} · ${u.requests} req</span></div>`).join("");
    const more = stillUnknown.length > UCAP ? `<div class="conn-more">+ ${stillUnknown.length - UCAP} more (full list in the JSON export)</div>` : "";
    html += `<div class="rv-section"><h2>Unrecognized connections <span class="h2-n">${stillUnknown.length}</span></h2>
      <p class="rv-sub">Third-party domains we still can't name — could be site APIs, niche CDNs, or trackers not yet catalogued. Treat unfamiliar ones with caution.</p>
      <div class="conn-list">${rows}${more}</div></div>`;
  }
  return html;
}
function cookiesSection(r) {
  const cookies = Object.values(r.cookies || {});
  const writes = r.cookieWrites || 0;
  if (!cookies.length) return `<div class="rv-section"><h2>Cookies set</h2><p class="rv-sub">${writes ? `${writes} tracking-cookie writes were counted, but this report predates per-cookie capture — start a new report to see each cookie by name.` : "No tracking cookies recorded yet."}</p></div>`;
  const byCo = {};
  for (const c of cookies) { const k = canonicalEntity(c.company); (byCo[k] = byCo[k] || []).push(c); }
  const allGroups = Object.entries(byCo).sort((a, b) => b[1].length - a[1].length);
  const GCAP = 14;
  const groups = allGroups.slice(0, GCAP);
  const moreG = allGroups.length - groups.length;
  const html = groups.map(([co, list]) => {
    const items = list.sort((a, b) => a.name.localeCompare(b.name)).map((c) => {
      const est = (c.category === "unknown" && c.estimate) ? c.estimate : null;
      const estChip = est ? ` <span class="ck-est" title="Estimated from this cookie's own traits — not a confirmed identification">likely ${esc(catLabel(est.category))} · est.</span>` : "";
      const purpose = est ? `${c.purpose ? esc(c.purpose) + " " : ""}<i>Estimated purpose: ${esc(est.why)}.</i>` : (c.purpose ? esc(c.purpose) : "");
      return `<div class="ck-row">
      <span class="ck-dot" style="background:${catColor(c.category)}" title="${esc(catLabel(c.category))}"></span>
      <div class="ck-main"><div class="ck-name mono">${esc(c.name)} <span class="ck-on">on ${esc(c.domain)}</span></div>${purpose ? `<div class="ck-purpose">${purpose}</div>` : ""}</div>
      <div class="ck-cat">${esc(catLabel(c.category))}${estChip}</div></div>`;
    }).join("");
    return `<details class="rv-co"><summary class="ck-head"><span class="lb-caret" aria-hidden="true">▸</span><b>${esc(co)}</b><span class="ck-count">${list.length}</span></summary><div class="ck-body">${items}</div></details>`;
  }).join("") + (moreG > 0 ? `<div class="conn-more">+ ${moreG} more compan${moreG === 1 ? "y" : "ies"} set cookies (full list in the JSON export)</div>` : "");
  return `<div class="rv-section"><h2>Cookies set while recording <span class="h2-n">${cookies.length}</span></h2>
    <p class="rv-sub">Distinct tracking cookies stored on your device during the window (${writes} writes total), grouped by company — tap to expand. <b>Names only — cookie values are never recorded.</b></p>
    ${html}</div>`;
}
function diarySection(r) {
  const all = Object.entries(r.sites || {}).map(([reg, s]) => ({ reg, ...s })).sort((a, b) => cnt(b.companies) - cnt(a.companies) || cnt(b.domains) - cnt(a.domains));
  const detailed = new Set(all.map((s) => s.reg));
  const clean = Object.keys(r.visited || {}).filter((reg) => !detailed.has(reg));
  if (!all.length && !clean.length) return "";
  const DCAP = 25; // cap the displayed list so the report stays scannable
  const sites = all.slice(0, DCAP);
  const moreTracked = all.length - sites.length;
  const rows = sites.map((s) => {
    const cos = Object.keys(s.companies || {}).sort();
    const doms = Object.keys(s.domains || {}).sort();
    return `<details class="rv-co"><summary class="site-head"><span class="lb-caret" aria-hidden="true">▸</span><span class="mono site-reg">${esc(s.reg)}</span><span class="site-meta">${cos.length} co · ${doms.length} domains</span></summary>
      <div class="rv-co-body"><div class="co-line"><span class="co-k">Companies</span> <span class="co-v">${cos.map(esc).join(", ") || "—"}</span></div>
      <div class="co-line"><span class="co-k">Domains</span> <span class="co-v mono">${doms.map(esc).join(", ") || "—"}</span></div></div></details>`;
  }).join("");
  const moreTrackedRow = moreTracked > 0 ? `<div class="conn-more">+ ${moreTracked} more tracked site${moreTracked === 1 ? "" : "s"} (most-tracked shown first)</div>` : "";
  const cleanShown = clean.slice(0, 8);
  const cleanRows = cleanShown.map((reg) => `<div class="site-clean"><span class="mono site-reg">${esc(reg)}</span><span class="site-meta clean">no trackers seen ✓</span></div>`).join("");
  const moreClean = clean.length - cleanShown.length;
  const cleanMoreRow = moreClean > 0 ? `<div class="conn-more">+ ${moreClean} more tracker-free site${moreClean === 1 ? "" : "s"} ✓</div>` : "";
  return `<div class="rv-section"><h2>Where you were tracked <span class="h2-n">${all.length + clean.length}</span></h2>
    <p class="rv-sub">Every site you opened while recording, and who was present on it (most-tracked first). Tracker-free sites are marked clean.</p>
    ${rows}${moreTrackedRow}${cleanRows}${cleanMoreRow}</div>`;
}
function capsNote(r) {
  const c = r.caps || {};
  const hit = Object.keys(c).filter((k) => c[k]);
  return hit.length ? `<p class="rv-caps">Note: this report hit its storage cap for ${hit.join(", ")} — some entries beyond the cap aren't shown (counts stay accurate where possible).</p>` : "";
}
// Data brokers = curated leaderboard companies that are brokers, PLUS any
// Tracker Radar-attributed unknown domain whose owning entity is a known broker
// (so brokers appearing via long-tail domains aren't missed).
// EXACT-match broker allowlist for Tracker Radar entity names. dataProfileFor's loose
// regexes (/xandr/, /oracle/…) would fabricate brokers on arbitrary names like
// "ALEXANDRU CUIBARI" — so for TR-attributed domains we match the entity name exactly.
// opt-out URLs only where verified; null → shown as "no self-serve opt-out".
const TR_BROKERS = {
  "Criteo": "https://www.criteo.com/privacy/",
  "The Trade Desk": "https://www.thetradedesk.com/us/privacy",
  "LiveRamp": "https://liveramp.com/opt_out/",
  "Oracle": "https://datacloudoptout.oracle.com/",
  "Lotame Solutions": "https://www.lotame.com/about-lotame/privacy/opt-out/",
  "Quantcast": "https://www.quantcast.com/opt-out/",
  "Magnite": null, "PubMatic": null, "OpenX": null, "Index Exchange": null,
  "TransUnion": null, "Tapad": null, "Adform": null, "33Across": null
};
function reportBrokers(r) {
  const map = new Map();
  // curated leaderboard companies (small controlled name set → dataProfileFor is safe)
  for (const c of topCompanies(r)) {
    const p = dataProfileFor(c.name, dominantCat(c.categories));
    if (p && p.broker) { const n = canonicalEntity(c.name); const e = map.get(n) || { name: n, sites: new Set(), optOut: p.optOut, viaTR: false }; for (const s of Object.keys(c.sites || {})) e.sites.add(s); map.set(n, e); }
  }
  // Tracker Radar-attributed unknown domains whose owner is an EXACT-match known broker
  for (const [dom, v] of Object.entries(r.domains || {})) {
    if (v.known) continue;
    const ent = trEntity(dom);
    if (!ent || !(ent in TR_BROKERS)) continue;
    const e = map.get(ent) || { name: ent, sites: new Set(), optOut: TR_BROKERS[ent], viaTR: true };
    for (const s of Object.keys(v.sites || {})) e.sites.add(s);
    map.set(ent, e);
  }
  return [...map.values()].map((e) => ({ name: e.name, siteCount: e.sites.size, optOut: e.optOut, viaTR: e.viaTR })).sort((a, b) => b.siteCount - a.siteCount);
}
// ---- Local, rule-based "what this means + what to do" engine. 100% on-device:
// a deterministic reading of the report + next steps de-duped against what the
// user has already done (st = {blocking, autoclear, alreadySaved, saved}). ----
function reportInsights(r, st) {
  st = st || {};
  const sites = visitedCount(r);
  const cos = topCompanies(r);
  const brokers = reportBrokers(r);
  const top = cos[0];
  const catCount = (cat) => Object.values(r.domains || {}).filter((d) => d.known && d.category === cat).length;
  const sr = catCount("session-replay");
  // Fingerprinting is OBSERVED behaviour (fp-probe), not a static-category guess.
  const fpEntries = Object.entries(r.fingerprinting || {});
  const fpScripts = fpEntries.length;
  const fpTechSet = new Set(fpEntries.flatMap(([, v]) => Object.keys(v.techniques || {})));
  const fpSiteSet = new Set(fpEntries.flatMap(([, v]) => Object.keys(v.sites || {})));
  const FPL = { canvas: "canvas", audio: "audio", webrtc: "WebRTC" };
  const trackerDoms = Object.values(r.domains || {}).filter((d) => d.known && TRACKING_CATS.has(d.category)).length;
  const cookieCount = cnt(r.cookies);
  const running = r.status === "running";
  // reading (each clause derived from real data; <b> kept, values escaped)
  const S = [];
  S.push(`Over <b>${esc(r.durationLabel)}</b>, <b>${cos.length} compan${cos.length === 1 ? "y" : "ies"}</b> tracked you across <b>${sites} site${sites === 1 ? "" : "s"}</b> you visited.`);
  if (top && sites) { const pct = Math.min(100, Math.round(top.siteCount / sites * 100)); S.push(`${esc(top.name)} was on <b>${pct}%</b> of them${pct >= 50 ? " — enough to see most of your browsing" : ""}.`); }
  if (brokers.length) S.push(`<b>${brokers.length}</b> ${brokers.length === 1 ? "is a data broker that builds and sells" : "are data brokers that build and sell"} audience profiles (${esc(brokers.slice(0, 3).map((b) => b.name).join(", "))}${brokers.length > 3 ? "…" : ""}).`);
  if (fpScripts) S.push(`<b>${fpScripts}</b> ${fpScripts === 1 ? "script" : "scripts"} ran <b>device fingerprinting</b> (${[...fpTechSet].map((t) => FPL[t] || t).join(", ")}) on ${fpSiteSet.size} site${fpSiteSet.size === 1 ? "" : "s"} you visited — observed directly, and able to recognise your device without cookies.`);
  if (sr) S.push(`${sr} ${sr === 1 ? "site ran a session-replay tool" : "sites ran session-replay tools"} that can record on-page activity — clicks, scrolling, and sometimes typed input.`);
  if (!fpScripts && !sr && cookieCount) S.push(`<b>${cookieCount}</b> distinct tracking cookies were stored on your device.`);
  // next steps (gated by signal AND de-duped against current state)
  const steps = [];
  if (!st.blocking && trackerDoms > 0) steps.push({ act: "block", icon: "🛡", title: "Block known trackers", why: `You have ${trackerDoms} blockable tracker domain${trackerDoms === 1 ? "" : "s"} — blocking stops their requests on every site.` });
  if (!st.autoclear && cookieCount > 0) steps.push({ act: "autoclear", icon: "🧹", title: "Auto-clear tracker cookies daily", why: `${cookieCount} tracking cookie${cookieCount === 1 ? " was" : "s were"} stored — daily auto-clear deletes them and keeps your logins.` });
  if (cookieCount > 0) steps.push({ act: "clear", icon: "🧽", title: "Clear these tracker cookies now", why: `Remove the tracking cookies stored during this window (logins kept).` });
  if (brokers.length) steps.push({ act: "brokers", icon: "🧾", title: `Opt out of the ${brokers.length} data broker${brokers.length === 1 ? "" : "s"}`, why: `They build a profile from your browsing — each has an opt-out in the Data brokers section below.` });
  if (fpScripts || sr) steps.push({ act: "info", icon: "🫥", title: "Harden against fingerprinting / session-replay", why: `These techniques don't rely on cookies, so clearing cookies won't stop them — tracker blocking, or a privacy browser (Brave, or Firefox with resist-fingerprinting), reduces them.` });
  if (cookieCount > 0) steps.push({ act: "info", icon: "🍪", title: "Block third-party cookies in your browser", why: `Most cross-site tracking rides on third-party cookies — your browser's privacy settings can block them site-wide.` });
  if (!running && !st.alreadySaved && !st.saved) steps.push({ act: "save", icon: "💾", title: "Save this report", why: `Keep it to compare your exposure over time.` });
  if (!steps.length) steps.push({ act: "none", icon: "✓", title: "You've turned on the main protections", why: `Keep recording to watch how tracking changes over time.` });
  return { reading: S.slice(0, 4).join(" "), steps };
}
function insStepHtml(s) {
  const btn = s.act === "block" || s.act === "autoclear" ? `<button class="ins-do" data-act="${s.act}">Turn on</button>`
    : s.act === "clear" ? `<button class="ins-do" data-act="clear">Clear now</button>`
    : s.act === "save" ? `<button class="ins-do" data-act="save">Save</button>`
    : s.act === "brokers" ? `<a class="ins-do" href="#rv-brokers">View ↓</a>` : "";
  return `<div class="ins-step"><span class="ins-ico" aria-hidden="true">${s.icon}</span><div class="ins-main"><div class="ins-title">${esc(s.title)}</div><div class="ins-why">${esc(s.why)}</div></div>${btn}</div>`;
}
function renderInsights(r, st) {
  const ins = reportInsights(r, st);
  return `<div class="rv-section ins-section"><h2>What this means &amp; what to do next</h2>
    <p class="ins-reading">${ins.reading}</p>
    <div class="ins-steps">${ins.steps.map(insStepHtml).join("")}</div>
    <p class="ins-foot">Generated on your device from this report — no data left your browser.</p></div>`;
}
function insMiniHtml(r, st) {
  const ins = reportInsights(r, st);
  const actionable = ins.steps.filter((s) => s.act !== "info" && s.act !== "none").slice(0, 2);
  if (!actionable.length) return "";
  return `<div class="ins-mini"><div class="ins-mini-h">What to do next</div>${actionable.map(insStepHtml).join("")}</div>`;
}
async function reportState(r, extra) {
  const st = Object.assign({}, extra);
  try { const s = await chrome.storage.local.get(["cl_blocking", "cl_autoclear"]); st.blocking = !!s.cl_blocking; st.autoclear = !!s.cl_autoclear; } catch (e) {}
  if (r && r.id) { try { st.alreadySaved = (await listSaved()).some((x) => x.id === r.id); } catch (e) {} }
  // R2: most recent OTHER saved report, for an honest count delta.
  try {
    const saved = await listSaved();
    st.prev = saved.filter((x) => !r || x.id !== r.id)
      .sort((a, b) => (b.completedAt || b.savedAt || 0) - (a.completedAt || a.savedAt || 0))[0] || null;
  } catch (e) {}
  return st;
}
function wireInsightActions() {
  const done = (b, label) => { b.textContent = label; b.disabled = true; b.classList.add("done"); const s = b.closest(".ins-step"); if (s) s.classList.add("done"); };
  document.querySelectorAll("button.ins-do[data-act]").forEach((b) => b.addEventListener("click", async () => {
    const act = b.dataset.act;
    try {
      if (act === "block") { await chrome.storage.local.set({ cl_blocking: true }); await chrome.runtime.sendMessage({ type: "setBlocking", enabled: true }); done(b, "✓ On"); }
      else if (act === "autoclear") { await chrome.storage.local.set({ cl_autoclear: true }); await chrome.runtime.sendMessage({ type: "setAutoClear", enabled: true }); done(b, "✓ On"); }
      else if (act === "clear") { const res = await chrome.runtime.sendMessage({ type: "runAutoClearNow" }); done(b, res && typeof res.removed === "number" ? `✓ Cleared ${res.removed}${res.kept ? ` · kept ${res.kept}` : ""}` : "✓ Cleared"); }
      else if (act === "save") { await chrome.runtime.sendMessage({ type: "saveReport" }); done(b, "✓ Saved"); }
    } catch (e) { b.textContent = "—"; }
  }));
}
// Observed device-fingerprinting across the recording window (from fp-probe).
function fingerprintSection(r) {
  const entries = Object.entries(r.fingerprinting || {});
  if (!entries.length) return "";
  const FPL = { canvas: "Canvas read-back", audio: "Audio fingerprint", webrtc: "WebRTC local-IP probe" };
  entries.sort((a, b) => cnt(b[1].sites) - cnt(a[1].sites));
  const rows = entries.map(([dom, v]) => {
    const techs = Object.keys(v.techniques || {}).map((t) => `<span class="fp-tech">${esc(FPL[t] || t)}</span>`).join("");
    const ns = cnt(v.sites);
    const who = (dom === "unknown") ? "An unattributed script" : esc(dom);
    return `<div class="fp-row"><div class="fp-head"><span class="fp-dom mono">${who}</span>${techs}<span class="conn-meta">${ns} site${ns === 1 ? "" : "s"}</span></div></div>`;
  }).join("");
  return `<div class="rv-section"><h2>Fingerprinting observed <span class="h2-n">${entries.length}</span></h2>
    <p class="rv-sub">Scripts that <b>actually ran</b> a device-fingerprinting technique (canvas, audio or WebRTC) while you browsed — observed behaviour, not inferred from a list. These can recognise your device even after cookies are cleared. We name the technique; what a script does with it isn't something the browser can show.</p>
    ${rows}</div>`;
}
function renderReportHtml(r, opts = {}) {
  if (!r) return `<div class="rv-wrap"><div class="rv-empty">${opts.saved ? "This saved report no longer exists." : "No tracking report yet.<br>Open CookieLens, click <b>◉ Report</b>, and start a Long Exposure."}</div></div>`;
  const sites = visitedCount(r);
  const rows = topCompanies(r);
  const totalReq = Object.values(r.domains || {}).reduce((s, d) => s + (d.requests || 0), 0) || rows.reduce((s, c) => s + c.requests, 0);
  const brokers = reportBrokers(r);
  const trackerDomainCount = Object.values(r.domains || {}).filter((d) => d.known && TRACKING_CATS.has(d.category)).length;
  const unknownCount = Object.values(r.domains || {}).filter((d) => !d.known).length;
  const cookieCount = cnt(r.cookies);
  const fpCount = Object.keys(r.fingerprinting || {}).length; // R1: observed FP scripts
  const running = r.status === "running";
  const windowTxt = running
    ? `${esc(r.durationLabel)} · started ${fmtAgo(r.startedAt)} ago · ${fmtLeft(r.endsAt - Date.now())}`
    : `${esc(r.durationLabel)} · completed ${fmtAgo(r.completedAt || r.lastUpdate)} ago`;
  // R2: honest delta vs the most recent OTHER saved report (counts only).
  const prev = opts.prev;
  let trendHtml = "";
  if (prev) {
    const fmtD = (d, noun) => d === 0 ? `same ${noun}` : `${d > 0 ? "+" : "−"}${Math.abs(d)} ${noun}`;
    // Only a same-duration comparison is apples-to-apples; otherwise a longer
    // window naturally shows "more" and the delta would mislead — caveat it.
    const sameWindow = (prev.durationLabel || "") === (r.durationLabel || "");
    const caveat = sameWindow ? "" : ` <span class="rv-trend-note">(different window — not directly comparable)</span>`;
    trendHtml = `<div class="rv-trend">vs your last ${esc(prev.durationLabel || "")} report: <b>${fmtD(rows.length - prev.companies, "companies")}</b> · ${fmtD(sites - prev.sites, "sites")}${caveat}</div>`;
  }
  const topPct = sites ? Math.min(100, Math.round((rows[0] ? rows[0].siteCount : 0) / sites * 100)) : 0;
  const headline = !rows.length ? "Nothing tracked you yet"
    : sites === 1 ? `${esc(rows[0].name)} tracked you on the only site you visited`
    : sites === 2 ? `${esc(rows[0].name)} was on ${rows[0].siteCount} of the 2 sites you visited`
    : `${esc(rows[0].name)} saw <b>${topPct}%</b> of your browsing`;
  return `<div class="rv-wrap">
    <header class="rv-hero">
      <div class="rv-eyebrow">◉ LONG EXPOSURE${running ? ` · <span class="rv-live">● recording</span>` : ""}${opts.saved ? ` · <span class="rv-archived">▣ saved report</span>` : ""}</div>
      <h1 class="rv-headline">${headline}</h1>
      <div class="rv-window">${windowTxt}</div>
      ${trendHtml}
      <div class="rv-summary">
        <div class="rv-stat"><b>${sites}</b><span>sites visited</span></div>
        <div class="rv-stat"><b>${rows.length}</b><span>companies</span></div>
        <div class="rv-stat"><b>${trackerDomainCount}</b><span>tracker domains</span></div>
        <div class="rv-stat"><b>${unknownCount}</b><span>unrecognized</span></div>
        <div class="rv-stat"><b>${brokers.length}</b><span>brokers</span></div>
        <div class="rv-stat"><b>${cookieCount}</b><span>cookies</span></div>
        <div class="rv-stat${fpCount ? " rv-stat-hot" : ""}"><b>${fpCount}</b><span>fingerprint scripts</span></div>
        <div class="rv-stat"><b>${totalReq.toLocaleString()}</b><span>requests</span></div>
      </div>
      ${categoryStrip(r)}
      ${sparkHtml(r)}
    </header>
    ${renderInsights(r, opts)}
    ${renderTransitMap(r)}
    <div class="rv-section"><h2>Who watched you most</h2>
      <p class="rv-sub">Ranked by <b>reach</b> — the share of sites you visited where this company was present. Tap a company for its domains and where it followed you.</p>
      ${companyRows(r, sites)}</div>
    ${cookiesSection(r)}
    ${fingerprintSection(r)}
    ${connectionsSection(r)}
    ${diarySection(r)}
    ${brokers.length ? `<div class="rv-section" id="rv-brokers"><h2>Data brokers that profiled you</h2>
      <p class="rv-sub">Dedicated audience-data companies seen across your browsing (including ones identified via Tracker Radar). Each opt-out exercises your CCPA/GDPR rights.</p>
      ${brokers.map((b) => `<div class="rv-broker"><div><b>${esc(b.name)}</b> <span class="rv-broker-reach">${b.siteCount}/${sites} sites${b.viaTR ? " · via Tracker Radar" : ""}</span></div>
        ${b.optOut ? `<a class="dc-link" href="${esc(b.optOut)}" target="_blank" rel="noopener">Opt out ↗</a>` : `<span class="rv-noopt">no self-serve opt-out</span>`}</div>`).join("")}</div>`
    : `<div class="rv-section"><h2>Data brokers</h2><p class="rv-sub">No dedicated data brokers seen — only ad platforms and analytics. Brokers (Criteo, LiveRamp, Oracle…) are most common on <b>ad-heavy news, shopping and free-content sites</b>; you won't see them on Google properties or developer tools.</p></div>`}
    <footer class="rv-foot">
      <div class="rv-actions">
        ${cookieCount ? `<button id="rv-clear" class="action-btn" title="Delete known tracker cookies in your browser — keeps logins & sessions">🧹 Clear tracker cookies</button>` : ""}
        <button id="rv-copy" class="action-btn">📋 Copy report</button>
        <button id="rv-json" class="action-btn">⬇ JSON</button>
        ${opts.saved ? `<button id="rv-del-saved" class="action-btn danger">Delete saved report</button>` : running ? `<button id="rv-finish" class="action-btn">Finish now</button>` : `<button id="rv-delete" class="action-btn danger">Delete report</button>`}
      </div>
      ${capsNote(r)}
      <p>Built locally from third-party requests and cookie events observed in your browser. Reach counts the sites <b>you</b> opened during the window — not your activity across the whole web. Cookie names are recorded, never values. Nothing left your device.</p>
    </footer></div>`;
}
function reportToText(r) {
  if (!r) return "No report.";
  const sites = visitedCount(r);
  const rows = topCompanies(r);
  const cookies = Object.values(r.cookies || {});
  const unknown = Object.entries(r.domains || {}).filter(([, v]) => !v.known);
  const L = [`CookieLens — Long Exposure (${r.durationLabel})`,
    `${r.status === "running" ? "In progress" : "Completed"} · ${sites} sites visited · ${rows.length} companies · ${cnt(r.cookies)} cookies`,
    "", "WHO WATCHED YOU MOST (by reach across sites you visited):"];
  rows.forEach((c) => {
    const pct = sites ? Math.round((c.siteCount / sites) * 100) : 0;
    const prof = dataProfileFor(c.name, dominantCat(c.categories));
    L.push(`  ${c.name}${prof && prof.broker ? " [DATA BROKER]" : ""}: ${pct}% (${c.siteCount}/${sites} sites, ${c.requests} req) — ${Object.keys(c.domains || {}).join(", ")}`);
  });
  if (cookies.length) {
    L.push("", `COOKIES SET (${cookies.length} distinct, names only):`);
    cookies.sort((a, b) => (a.company || "").localeCompare(b.company || "")).forEach((c) => L.push(`  ${c.name} (${c.company || "?"} · ${c.category}) on ${c.domain}${c.purpose ? ` — ${c.purpose}` : ""}`));
  }
  if (unknown.length) {
    L.push("", `UNRECOGNIZED CONNECTIONS (${unknown.length}):`);
    unknown.sort((a, b) => cnt(b[1].sites) - cnt(a[1].sites)).forEach(([d, v]) => L.push(`  ${d} (${cnt(v.sites)} sites, ${v.requests} req)`));
  }
  L.push("", "Observed locally from third-party requests + cookie events across sites you opened. Cookie names recorded, never values. Nothing left your device.");
  return L.join("\n");
}
function wireReportView(r) {
  const copy = $("rv-copy"); if (copy) copy.addEventListener("click", () => { navigator.clipboard.writeText(reportToText(r)); toast("Report copied"); });
  const json = $("rv-json"); if (json) json.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "cookielens-long-exposure.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); toast("Report JSON downloaded");
  });
  const clr = $("rv-clear"); if (clr) clr.addEventListener("click", async () => {
    clr.disabled = true;
    try {
      const res = await chrome.runtime.sendMessage({ type: "runAutoClearNow" });
      const removed = res && typeof res.removed === "number" ? res.removed : 0;
      const kept = res && res.kept ? ` · kept ${res.kept} login/session` : "";
      clr.textContent = `✓ Cleared ${removed}${kept}`;
      toast(`Cleared ${removed} tracker cookie${removed === 1 ? "" : "s"}${kept || " · logins kept"}`);
    } catch (e) { clr.textContent = "—"; clr.disabled = false; }
  });
  const fin = $("rv-finish"); if (fin) fin.addEventListener("click", async () => { await chrome.runtime.sendMessage({ type: "finishReportNow" }); location.reload(); });
  const del = $("rv-delete"); if (del) del.addEventListener("click", async () => { await chrome.runtime.sendMessage({ type: "stopReport" }); location.reload(); });
  const delSaved = $("rv-del-saved"); if (delSaved) delSaved.addEventListener("click", async () => { if (r) await chrome.runtime.sendMessage({ type: "deleteSavedReport", id: r.id }); toast("Saved report deleted"); setTimeout(() => window.close(), 600); });
}

document.addEventListener("DOMContentLoaded", () => {
  if (IS_REPORT_VIEW) { bootReport(); return; }
  setupTabs();
  $("rescan").addEventListener("click", () => { scan(); toast("Rescanned"); });
  $("copy-report").addEventListener("click", copyReport);
  $("export-json").addEventListener("click", exportJson);
  $("clear-trackers").addEventListener("click", onClearClick);
  $("reveal-toggle").addEventListener("click", (e) => {
    state.revealValues = !state.revealValues;
    e.currentTarget.setAttribute("aria-pressed", String(state.revealValues));
    if (state.lastAnalysis) renderCookies(state.lastAnalysis.cookies, state.lastAnalysis.storage);
  });
  $("risk-toggle").addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const open = $("risk-detail").hidden;
    $("risk-detail").hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  });
  // Long Exposure
  $("report-btn").addEventListener("click", openSheet);
  $("sheet-close").addEventListener("click", closeSheet);
  $("report-sheet").addEventListener("click", (e) => { if (e.target.id === "report-sheet") closeSheet(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("report-sheet").hidden) closeSheet(); });
  refreshReportBtn();
  setInterval(refreshReportBtn, 30000);
  // DEMO: skip the live chrome.* scan() on boot. The static demo driver paints
  // captured fixtures by calling the exposed render() path instead.
  if (!window.__CL_DEMO) scan();
});

// DEMO export hook — surfaces the existing module-private functions so the
// same-origin static demo driver can render captured fixtures and operate the
// Clear actions on the in-memory fixture. The UI itself is unmodified.
try {
  window.__cookielens = {
    render, scan,
    get state() { return state; },
    setAnalysis(a) { state.lastAnalysis = a; },
    renderCookies, renderTrackers, renderData,
    canonicalEntity, isClearableTrackerCookie, looksLikeAuthName, keptCount,
    toast,
  };
} catch (e) {}
