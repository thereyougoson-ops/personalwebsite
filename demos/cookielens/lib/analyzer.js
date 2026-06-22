// Analysis engine: turns raw cookies + contacted domains + page storage into a
// structured, explained report with a transparent risk score.

import { registrableDomain } from "./psl.js";
import { identifyCookie, CATEGORY_META, classifyCookieHeuristic } from "../data/cookies-db.js";
import { lookupTracker, TRACKING_CATEGORIES, HIGH_IMPACT_CATEGORIES } from "../data/trackers.js";
import { dataProfileFor, DATA_TYPES } from "../data/data-collection.js";
import { decodeTCString, validateTCString } from "./tcf.js";

const DAY = 86400;

// Decode the few cookie values that genuinely reveal something. Verified against
// real cookies — only classic `_ga`, whose LAST dot-segment is the epoch when the
// cookie was set (it resets on cookie clear, so it's "first set", not "first visit").
function decodeInsight(cookie) {
  if (cookie.name === "_ga" && /^GA\d+\.\d+\.\d+\.\d+$/.test(cookie.value || "")) {
    const parts = cookie.value.split(".");
    const ts = parseInt(parts[parts.length - 1], 10);
    if (ts > 946684800 && ts < 4102444800) { // 2000-01-01 .. 2100-01-01
      let when;
      try { when = new Date(ts * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
      catch { when = new Date(ts * 1000).toISOString().slice(0, 10); }
      return `This Google Analytics ID was first set on ${when} — it resets whenever you clear cookies.`;
    }
  }
  return null;
}

/** "expires in 2 years" / "expires in 5 days" / "expires in 3 hours". */
export function humanizeExpiry(cookie, nowSec) {
  if (cookie.session || !cookie.expirationDate) {
    return { text: "Session — deleted when you close the browser", days: 0, session: true };
  }
  const secs = cookie.expirationDate - nowSec;
  if (secs <= 0) return { text: "Expired", days: 0, session: false };
  const days = secs / DAY;
  let text;
  if (days >= 365) {
    const y = Math.round(days / 365 * 10) / 10;
    text = `Expires in ${y} year${y >= 2 ? "s" : ""}`;
  } else if (days >= 60) {
    text = `Expires in ${Math.round(days / 30)} months`;
  } else if (days >= 1.5) {
    text = `Expires in ${Math.round(days)} days`;
  } else {
    const hrs = Math.round(secs / 3600);
    text = hrs >= 1 ? `Expires in ${hrs} hour${hrs >= 2 ? "s" : ""}` : "Expires in under an hour";
  }
  return { text, days, session: false };
}

/** Enrich a raw chrome cookie object with classification + explanation. */
function enrichCookie(cookie, pageRegistrable, pageIsHttps, jsCookieNames, nowSec) {
  const reg = registrableDomain(cookie.domain);
  const party = reg === pageRegistrable ? "first" : "third";
  let db = identifyCookie(cookie.name);
  // Generic names like "id"/"uuid" only mean "advertising" on their real tracker
  // domain. Off that domain (e.g. a first-party cookie named "id"), drop the
  // match so we don't mislabel benign cookies and inflate the risk score.
  if (db && db.scope === "tracker-domain" && reg !== db.onDomain) db = null;
  const tracker = lookupTracker(reg);

  // Category resolution: known cookie name > known tracker domain > heuristic.
  let category, company, purpose;
  if (db) {
    category = db.category;
    company = db.company;
    purpose = db.purpose;
  } else if (tracker) {
    category = tracker.category;
    company = tracker.company;
    purpose = `Unrecognized cookie on a known ${tracker.category} domain — ${tracker.note}`;
  } else if (party === "third") {
    category = "unknown";
    company = reg;
    purpose = "Third-party cookie from a domain we don't recognize. Treat unknown third-party cookies as potential tracking.";
  } else {
    category = "unknown";
    company = "This site";
    purpose = "First-party cookie with no known signature — likely app-specific state.";
  }

  const expiry = humanizeExpiry(cookie, nowSec);
  // F3: for cookies we can't name, attach a transparent purpose ESTIMATE. It does
  // NOT change `category` or `isTracking` (so risk/counts stay confirmed-only) — the
  // UI shows it clearly as a guess.
  let estimate = null;
  if (category === "unknown") {
    estimate = classifyCookieHeuristic({ name: cookie.name, value: cookie.value, party, days: expiry.days, session: expiry.session });
  }
  const isTracking = TRACKING_CATEGORIES.has(category);
  // A cookie is "hidden from the page's own scripts" if it's HttpOnly, OR if it
  // belongs to a third party (document.cookie can never see those).
  const httpOnly = !!cookie.httpOnly;
  let hidden = false, hiddenReason = "";
  if (httpOnly) { hidden = true; hiddenReason = "HttpOnly — invisible to page JavaScript (also harder for XSS to steal)."; }
  else if (party === "third") { hidden = true; hiddenReason = "Set by a third-party domain — never visible in this page's document.cookie."; }
  else if (!jsCookieNames.has(cookie.name)) { hidden = true; hiddenReason = "Not exposed in document.cookie on the top frame (path/subdomain-scoped or HttpOnly)."; }

  const insecure = pageIsHttps && !cookie.secure;

  return {
    name: cookie.name,
    domain: cookie.domain,
    registrable: reg,
    path: cookie.path,
    party,
    category,
    company,
    purpose,
    retention: db && db.retention ? db.retention : null,
    expiry,
    secure: !!cookie.secure,
    httpOnly,
    sameSite: cookie.sameSite || "unspecified",
    partitioned: !!cookie.partitionKey,
    partitionKey: cookie.partitionKey || null,
    hostOnly: !!cookie.hostOnly,
    valueLength: cookie.value ? cookie.value.length : 0,
    valuePreview: maskValue(cookie.value),
    isTracking,
    estimate,
    hidden,
    hiddenReason,
    insecure,
    insight: decodeInsight(cookie)
  };
}

function maskValue(v) {
  if (!v) return "(empty)";
  if (v.length <= 6) return "•".repeat(v.length);
  return v.slice(0, 3) + "•".repeat(Math.min(v.length - 6, 18)) + v.slice(-3);
}

/**
 * Detect which Consent Management Platform (CMP) is present, purely from the
 * names of the consent cookies it drops. Name-based only — we never read the
 * cookie value to guess a verdict. Returns {name} or null.
 */
function detectCMP(cookies) {
  const names = (cookies || []).map((c) => c.name);
  const has = (pred) => names.some(pred);
  if (has((n) => n === "OptanonConsent" || n === "OptanonAlertBoxClosed" || n.startsWith("eupubconsent"))) return { name: "OneTrust" };
  if (has((n) => n === "CookieConsent")) return { name: "Cookiebot" };
  if (has((n) => n.startsWith("cookieyes-consent"))) return { name: "CookieYes" };
  if (has((n) => /^uc_|usercentrics/i.test(n))) return { name: "Usercentrics" };
  if (has((n) => n === "euconsent-v2")) return { name: "an IAB TCF CMP" };
  return null;
}

/**
 * Main entry point.
 * @param {object} ctx
 *   pageUrl, pageRegistrable, pageIsHttps
 *   cookies          - array of raw chrome.cookies objects (page + 3rd-party, deduped)
 *   contactedDomains - array of {registrable, requestCount} the page talked to
 *   jsCookieNames    - array of names visible in document.cookie
 *   storage          - {local:[{key,company,category}], session:[...]}
 *   nowSec           - current time in epoch seconds (passed in; no Date in some sandboxes)
 */
export function analyze(ctx) {
  const nowSec = ctx.nowSec;
  const jsCookieNames = new Set(ctx.jsCookieNames || []);
  const cookies = (ctx.cookies || []).map((c) =>
    enrichCookie(c, ctx.pageRegistrable, ctx.pageIsHttps, jsCookieNames, nowSec)
  );

  // Tracker domains the page contacted (known list), enriched with cookie counts.
  const cookieCountByReg = {};
  for (const c of cookies) cookieCountByReg[c.registrable] = (cookieCountByReg[c.registrable] || 0) + 1;

  const trackerDomains = [];
  for (const d of ctx.contactedDomains || []) {
    if (d.registrable === ctx.pageRegistrable) continue;
    const t = lookupTracker(d.registrable);
    // Only genuine tracking categories count as "trackers" — recognized CDNs /
    // infrastructure are known but benign, so they don't inflate the count.
    if (!t || !TRACKING_CATEGORIES.has(t.category)) continue;
    trackerDomains.push({
      domain: d.registrable,
      company: t.company,
      category: t.category,
      note: t.note,
      requestCount: d.requestCount || 0,
      cookieCount: cookieCountByReg[d.registrable] || 0
    });
  }
  trackerDomains.sort((a, b) => b.cookieCount - a.cookieCount || b.requestCount - a.requestCount);

  // Unrecognized third-party domains the page contacted. These are the *hidden*
  // ones: not in our known list, and (with modern 3P-cookie blocking) often have
  // no cookie to surface — so without this they'd be invisible. We list them as
  // "treat with caution" rather than asserting they're trackers.
  const otherThirdParties = [];
  for (const d of ctx.contactedDomains || []) {
    if (!d.registrable || d.registrable === ctx.pageRegistrable) continue;
    if (lookupTracker(d.registrable)) continue; // already a known tracker
    otherThirdParties.push({
      domain: d.registrable,
      requestCount: d.requestCount || 0,
      cookieCount: cookieCountByReg[d.registrable] || 0
    });
  }
  otherThirdParties.sort((a, b) => b.cookieCount - a.cookieCount || b.requestCount - a.requestCount);

  // ---- Summary counts ----
  const firstParty = cookies.filter((c) => c.party === "first");
  const thirdParty = cookies.filter((c) => c.party === "third");
  const trackingCookies = cookies.filter((c) => c.isTracking);
  const hidden = cookies.filter((c) => c.hidden);

  const companySet = new Set();
  for (const c of trackingCookies) companySet.add(c.company);
  for (const t of trackerDomains) companySet.add(t.company);

  const summary = {
    total: cookies.length,
    firstParty: firstParty.length,
    thirdParty: thirdParty.length,
    tracking: trackingCookies.length,
    hidden: hidden.length,
    companies: companySet.size,
    trackerDomains: trackerDomains.length,
    otherThirdParties: otherThirdParties.length,
    storageTrackers: (ctx.storage?.local?.length || 0) + (ctx.storage?.session?.length || 0)
  };

  // ---- Data-collection profiles (capability/design per each company's own disclosures) ----
  const collectorMap = new Map();
  const addCollector = (company, category, source) => {
    const prof = dataProfileFor(company, category);
    if (!prof) return;
    let col = collectorMap.get(prof.brand);
    if (!col) { col = { ...prof, sources: new Set() }; collectorMap.set(prof.brand, col); }
    if (source) col.sources.add(source);
  };
  for (const c of trackingCookies) addCollector(c.company, c.category, c.registrable);
  for (const t of trackerDomains) addCollector(t.company, t.category, t.domain);
  const collectors = [...collectorMap.values()].map((c) => ({ ...c, sources: [...c.sources] }));
  collectors.sort((a, b) => (b.broker ? 1 : 0) - (a.broker ? 1 : 0) || b.types.length - a.types.length);

  const rollup = [];
  for (const [key, meta] of Object.entries(DATA_TYPES)) {
    const brands = collectors.filter((c) => c.types.includes(key)).map((c) => c.brand);
    if (brands.length) rollup.push({ key, icon: meta.icon, label: meta.label, count: brands.length, brands });
  }
  rollup.sort((a, b) => b.count - a.count);

  const trackedSince = cookies.find((c) => c.name === "_ga" && c.insight)?.insight || null;
  // IAB TCF ad-consent decode (real data from the user's own euconsent-v2 cookie).
  const tcfCookie = (ctx.cookies || []).find((c) => c.name === "euconsent-v2" && c.value);
  const tcf = tcfCookie ? decodeTCString(tcfCookie.value) : null;
  const tcfValidation = tcfCookie ? validateTCString(tcfCookie.value) : null;
  const cmp = detectCMP(ctx.cookies);
  const dataCollection = { collectors, rollup, brokerCount: collectors.filter((c) => c.broker).length, trackedSince, tcf, tcfValidation, cmp };
  summary.dataCollectors = collectors.length;

  const risk = computeRisk({ cookies, trackerDomains, otherThirdParties, companySet, storage: ctx.storage, fingerprinting: ctx.fingerprinting });

  return { cookies, trackerDomains, otherThirdParties, dataCollection, summary, risk, storage: ctx.storage || { local: [], session: [] } };
}

function computeRisk({ cookies, trackerDomains, otherThirdParties, companySet, storage, fingerprinting }) {
  const factors = [];
  const add = (label, points, detail) => { if (points > 0) factors.push({ label, points: Math.round(points), detail }); };

  // 1. Third-party tracker domains contacted.
  const nTrackerDomains = trackerDomains.length;
  add("Third-party trackers contacted", Math.min(nTrackerDomains * 5, 35),
      `${nTrackerDomains} known tracking domain${nTrackerDomains === 1 ? "" : "s"} loaded resources on this page.`);

  // 2. Advertising / data-broker cookies.
  const adCookies = cookies.filter((c) => c.category === "advertising" || c.category === "data-broker");
  add("Advertising & data-broker cookies", Math.min(adCookies.length * 4, 24),
      `${adCookies.length} cookie${adCookies.length === 1 ? "" : "s"} used to target ads or sell audience data.`);

  // 3. Session-replay tools (record what you do on screen). Fingerprinting is
  // reported separately, only when actually observed (canvas/WebRTC/Audio probing).
  const replayCompanies = new Set();
  for (const c of cookies) if (c.category === "session-replay") replayCompanies.add(c.company);
  for (const t of trackerDomains) if (t.category === "session-replay") replayCompanies.add(t.company);
  add("Session recording", Math.min(replayCompanies.size * 6, 18),
      replayCompanies.size ? `${[...replayCompanies].join(", ")} can record your clicks, scrolling and on-page activity.` : "");

  // 4. Analytics cookies.
  const analyticsCookies = cookies.filter((c) => c.category === "analytics");
  add("Analytics cookies", Math.min(analyticsCookies.length * 1.5, 12),
      `${analyticsCookies.length} cookie${analyticsCookies.length === 1 ? "" : "s"} measuring your behavior on the site.`);

  // 5. Breadth — how many distinct companies get data.
  add("Number of companies receiving data", Math.min(companySet.size * 2, 16),
      `${companySet.size} separate compan${companySet.size === 1 ? "y" : "ies"} can associate this visit with you.`);

  // 6. Long-lived tracking cookies.
  const longLived = cookies.filter((c) => c.isTracking && !c.expiry.session && c.expiry.days > 180);
  add("Long-lived tracking cookies", Math.min(longLived.length * 1, 8),
      `${longLived.length} tracking cookie${longLived.length === 1 ? "" : "s"} persist for more than 6 months.`);

  // 7. Insecure cookies on an HTTPS page.
  const insecure = cookies.filter((c) => c.insecure);
  add("Cookies missing the Secure flag", Math.min(insecure.length * 2, 8),
      `${insecure.length} cookie${insecure.length === 1 ? "" : "s"} could be sent over an unencrypted connection.`);

  // 7b. Unrecognized third-party connections (low weight — many are benign infra).
  const others = (otherThirdParties || []).length;
  add("Unrecognized third-party connections", Math.min(others * 0.5, 6),
      `${others} other third-party domain${others === 1 ? "" : "s"} were contacted but aren't in our known list — unverified, worth a look.`);

  // 8. Storage-based trackers.
  const storageTrackers = (storage?.local?.length || 0) + (storage?.session?.length || 0);
  add("Tracker data in local/session storage", Math.min(storageTrackers * 2, 10),
      `${storageTrackers} tracker key${storageTrackers === 1 ? "" : "s"} found outside cookies (storage isn't cleared by 'delete cookies').`);

  // 9. OBSERVED device fingerprinting — canvas / audio / WebRTC probing that
  // actually ran on this page (watched, not inferred). Weighted meaningfully so a
  // page that fingerprints can never read as "respects your privacy".
  const fp = fingerprinting || [];
  const fpTechs = new Set(fp.flatMap((f) => f.techniques || []));
  if (fpTechs.size) {
    const LBL = { canvas: "canvas", audio: "audio", webrtc: "WebRTC" };
    const names = [...fpTechs].map((t) => LBL[t] || t);
    add("Device fingerprinting observed", Math.min(fp.length * 6 + fpTechs.size * 6, 28),
        `${fpTechs.size} fingerprinting technique${fpTechs.size === 1 ? "" : "s"} (${names.join(", ")}) actually ran on this page — these can recognise your device without cookies.`);
  }

  let score = factors.reduce((s, f) => s + f.points, 0);
  score = Math.max(0, Math.min(100, score));
  factors.sort((a, b) => b.points - a.points);

  const grade = score < 15 ? "A" : score < 30 ? "B" : score < 50 ? "C" : score < 70 ? "D" : "F";
  const verdicts = {
    A: "Minimal tracking. This page respects your privacy.",
    B: "Light tracking — mostly first-party analytics.",
    C: "Moderate tracking. Several third parties can profile this visit.",
    D: "Heavy tracking. Many advertisers and data brokers are watching.",
    F: "Very heavy tracking. Your visit is shared widely for ads & profiling."
  };
  const colors = { A: "#3fb950", B: "#56d364", C: "#d29922", D: "#f0883e", F: "#f85149" };

  return { score, grade, verdict: verdicts[grade], color: colors[grade], factors };
}

export { CATEGORY_META, DATA_TYPES };
