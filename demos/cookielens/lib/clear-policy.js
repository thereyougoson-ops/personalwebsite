// CookieLens — shared cookie-clearing safety policy.
//
// THE single gate that decides whether deleting a cookie is safe under the
// "logins kept" promise. Used by every clear path: the popup's manual "Clear
// tracker cookies" / per-company clear, AND the background daily auto-clear.
//
// WHY this exists: a cookie's category is assigned by WHOLE-DOMAIN lookup, so
// every cookie on a dual-purpose company domain (google.com, facebook.com,
// microsoft.com…) is flagged "tracking" — including your SESSION/SSO cookies
// (SID, SAPISID, __Secure-1PSID). Deleting those logs you out. This module
// keeps them while still removing the real trackers (_ga, NID, IDE, fr, _fbp).
//
// Honesty-first: when in doubt we KEEP. Deleting a login under a "logins kept"
// label is the only true failure mode; leaving a stray tracker is acceptable.
import { registrableDomain } from "./psl.js";
import { lookupTracker, TRACKING_CATEGORIES } from "../data/trackers.js";
import { identifyCookie } from "../data/cookies-db.js";

// Registrable domains that double as identity / social-login / payment providers.
// Cookies here are NEVER deleted unless POSITIVELY named as a tracking cookie,
// because the same domain carries your session/SSO/auth cookies. Generalises the
// blocking-side exemption (see background.js trackerBlockDomains) into one set.
export const NEVER_CLEAR_DOMAINS = new Set([
  "google.com", "youtube.com", "facebook.com", "instagram.com",
  "twitter.com", "x.com", "t.co", "linkedin.com", "reddit.com",
  "microsoft.com", "live.com", "microsoftonline.com", "office.com",
  "apple.com", "icloud.com", "amazon.com", "github.com", "paypal.com",
  "stripe.com", "stripe.network"
]);

// Names that are session / auth / security tokens — never deleted, on any domain.
// Belt-and-suspenders behind the name-DB + domain checks. NOTE: Google's
// SAPISID/APISID are deliberately JS-readable (the SAPISIDHASH auth scheme reads
// them from JS), so an HttpOnly-only guard would NOT protect them — this name
// list is load-bearing, not decorative.
const AUTH_EXACT = new Set([
  "SID", "HSID", "SSID", "APISID", "SAPISID", "LSID", "SIDCC",
  "__Host-GAPS", "ACCOUNT_CHOOSER", "OSID", "__Secure-OSID",
  "JSESSIONID", "PHPSESSID", "ASPSESSIONID", ".ASPXAUTH",
  "connect.sid", "laravel_session", "_session_id"
]);
const AUTH_REGEX = /(^__Host-)|(^__Secure-\d*P?A?P?I?SID)|(sess(ion)?(id)?$)|(^sid$)|(csrf)|(xsrf)|(antiforgery)|(^auth)|(_auth)|(jwt)|(login)|(logged_in)|(remember)|(__requestverification)/i;

/** True if a cookie NAME looks like a session / auth / security token. */
export function looksLikeAuthName(name) {
  if (!name) return false;
  if (AUTH_EXACT.has(name)) return true;
  return AUTH_REGEX.test(name);
}

/**
 * THE shared gate. Operates on a raw chrome.cookies.Cookie OR an analyzer-
 * enriched cookie — it only reads { name, domain, httpOnly }.
 * Returns true ONLY if deleting this cookie is safe ("logins kept").
 */
export function isClearableTrackerCookie(cookie) {
  if (!cookie || !cookie.name) return false;
  const name = cookie.name;

  // 1. Never touch anything that looks like an auth / session / security token.
  if (looksLikeAuthName(name)) return false;

  // 2. Defense-in-depth: HttpOnly cookies are almost never the JS-readable
  //    tracker cookies this feature targets; auth cookies frequently are
  //    HttpOnly. Not load-bearing (SAPISID is JS-readable), but cheap and safe.
  if (cookie.httpOnly) return false;

  const reg = registrableDomain((cookie.domain || "").replace(/^\./, ""));

  // 3. Positively named as a tracking cookie? Clear it — even on a dual-purpose
  //    domain. This is how _ga / NID / IDE / fr / _fbp still go on google/meta.
  //    Mirror analyzer.js's tracker-domain scope guard exactly for consistency.
  let db = identifyCookie(name);
  if (db && db.scope === "tracker-domain" && reg !== db.onDomain) db = null;
  if (db && TRACKING_CATEGORIES.has(db.category)) return true;

  // 4. Not positively named → clear by domain ONLY if it's a known tracker
  //    domain that is NOT a login / social / payment provider.
  if (NEVER_CLEAR_DOMAINS.has(reg)) return false;
  const t = lookupTracker(reg);
  return !!(t && TRACKING_CATEGORIES.has(t.category));
}
