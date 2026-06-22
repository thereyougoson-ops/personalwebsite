// Curated cookie knowledge base: maps cookie names to plain-English meaning,
// the company behind them, a category, and typical retention.
//
// Each entry has a `kind`:
//   "exact"  - name must equal `id`
//   "prefix" - name starts with `id`
//   "regex"  - `id` is a RegExp tested against the name
//
// category: necessary | functional | analytics | advertising | social |
//           session-replay | security | consent | unknown

export const COOKIE_DB = [
  // ---------- Necessary / framework session cookies ----------
  { kind: "exact",  id: "PHPSESSID",        company: "PHP app", category: "necessary",  purpose: "Keeps you logged in / preserves your session on a PHP site." },
  { kind: "exact",  id: "JSESSIONID",       company: "Java app", category: "necessary", purpose: "Server session ID for a Java/Tomcat application." },
  { kind: "exact",  id: "ASP.NET_SessionId",company: "ASP.NET app", category: "necessary", purpose: "Session ID for a Microsoft ASP.NET application." },
  { kind: "exact",  id: "ASPSESSIONID",     company: "ASP app", category: "necessary",  purpose: "Classic ASP server session identifier." },
  { kind: "exact",  id: "connect.sid",      company: "Node/Express app", category: "necessary", purpose: "Express.js server session cookie." },
  { kind: "regex",  id: /^laravel_session$/,company: "Laravel app", category: "necessary", purpose: "Laravel (PHP) session cookie." },
  { kind: "exact",  id: "sessionid",        company: "Web app", category: "necessary",   purpose: "Generic server session identifier (e.g. Django)." },
  { kind: "exact",  id: "wordpress_logged_in", company: "WordPress", category: "necessary", purpose: "Marks you as logged into WordPress." },
  { kind: "prefix", id: "wordpress_sec",    company: "WordPress", category: "necessary",  purpose: "WordPress authentication token." },
  { kind: "prefix", id: "wp-settings",      company: "WordPress", category: "functional", purpose: "Stores your WordPress admin UI preferences." },

  // ---------- Security / anti-CSRF / bot ----------
  { kind: "exact",  id: "csrftoken",        company: "Web app", category: "security",    purpose: "Anti-CSRF token that protects forms from forgery." },
  { kind: "exact",  id: "XSRF-TOKEN",       company: "Web app", category: "security",    purpose: "Anti-CSRF token (Angular/Laravel style)." },
  { kind: "exact",  id: "_csrf",            company: "Web app", category: "security",     purpose: "Anti-CSRF protection token." },
  { kind: "exact",  id: "__Host-csrf",      company: "Web app", category: "security",     purpose: "Host-locked anti-CSRF token (hardened)." },
  { kind: "exact",  id: "__cf_bm",          company: "Cloudflare", category: "security",  purpose: "Cloudflare bot-management — tells humans from bots." },
  { kind: "exact",  id: "cf_clearance",     company: "Cloudflare", category: "security",  purpose: "Proves you passed a Cloudflare challenge." },
  { kind: "prefix", id: "__cflb",           company: "Cloudflare", category: "necessary", purpose: "Cloudflare load-balancer session affinity." },
  { kind: "exact",  id: "__cfduid",         company: "Cloudflare", category: "security",  purpose: "Legacy Cloudflare security identifier." },
  { kind: "prefix", id: "AWSALB",           company: "AWS", category: "necessary",        purpose: "AWS load-balancer routing (sticky sessions)." },
  { kind: "prefix", id: "AWSELB",           company: "AWS", category: "necessary",        purpose: "AWS Elastic Load Balancer session affinity." },
  { kind: "exact",  id: "incap_ses",        company: "Imperva", category: "security",     purpose: "Imperva/Incapsula WAF session." },
  { kind: "prefix", id: "visid_incap",      company: "Imperva", category: "security",     purpose: "Imperva visitor identifier (DDoS/WAF)." },

  // ---------- Consent ----------
  { kind: "exact",  id: "CookieConsent",    company: "Cookiebot", category: "consent",    purpose: "Stores your cookie-consent choices." },
  { kind: "prefix", id: "OptanonConsent",   company: "OneTrust", category: "consent",     purpose: "Records which cookie categories you allowed." },
  { kind: "exact",  id: "OptanonAlertBoxClosed", company: "OneTrust", category: "consent", purpose: "Remembers you dismissed the cookie banner." },
  { kind: "prefix", id: "cookieyes-consent",company: "CookieYes", category: "consent",    purpose: "Stores your cookie-consent choices." },
  { kind: "exact",  id: "euconsent-v2",     company: "IAB TCF", category: "consent",      purpose: "Encodes your ad-consent choices (IAB framework)." },
  { kind: "exact",  id: "usprivacy",        company: "IAB CCPA", category: "consent",     purpose: "US privacy / 'do not sell' signal." },

  // ---------- Google Analytics / Ads ----------
  { kind: "regex",  id: /^_ga$/,            company: "Google Analytics", category: "analytics", purpose: "Your main Google Analytics visitor ID — tracks you across visits.", retention: "2 years" },
  { kind: "prefix", id: "_ga_",             company: "Google Analytics 4", category: "analytics", purpose: "GA4 per-property session/visitor state.", retention: "2 years" },
  { kind: "exact",  id: "_gid",             company: "Google Analytics", category: "analytics", purpose: "Distinguishes you for ~24h of analytics.", retention: "24 hours" },
  { kind: "prefix", id: "_gat",             company: "Google Analytics", category: "analytics", purpose: "Throttles how fast analytics requests are sent.", retention: "1 minute" },
  { kind: "prefix", id: "_gac_",            company: "Google Ads", category: "advertising", purpose: "Links your visit to a Google Ads campaign/conversion." },
  { kind: "prefix", id: "__utm",            company: "Google Analytics (legacy)", category: "analytics", purpose: "Old Universal Analytics visit/campaign tracking." },
  { kind: "exact",  id: "_gcl_au",          company: "Google Ads", category: "advertising", purpose: "Conversion linker — attributes signups/sales to ads.", retention: "90 days" },
  { kind: "prefix", id: "_gcl_",            company: "Google Ads", category: "advertising", purpose: "Google Ads conversion attribution." },
  { kind: "exact",  id: "IDE",              company: "Google (DoubleClick)", category: "advertising", purpose: "Cross-site ad targeting & measurement.", retention: "13 months" },
  { kind: "exact",  id: "DSID",             company: "Google (DoubleClick)", category: "advertising", purpose: "Links your activity across devices for ads.", retention: "2 weeks" },
  { kind: "exact",  id: "test_cookie",      company: "Google (DoubleClick)", category: "advertising", purpose: "Checks whether your browser accepts ad cookies." },
  { kind: "regex",  id: /^id$/,             company: "Google (DoubleClick)", category: "advertising", scope: "tracker-domain", onDomain: "doubleclick.net", purpose: "DoubleClick advertising identifier (on doubleclick.net)." },
  { kind: "exact",  id: "NID",              company: "Google", category: "advertising",   purpose: "Remembers your Google preferences & personalizes ads.", retention: "6 months" },
  { kind: "exact",  id: "ANID",             company: "Google", category: "advertising",   purpose: "Ad personalization identifier." },
  { kind: "exact",  id: "__gads",           company: "Google AdSense", category: "advertising", purpose: "Ad delivery, frequency capping & measurement." },
  { kind: "exact",  id: "__gpi",            company: "Google AdSense", category: "advertising", purpose: "Ad personalization & frequency capping." },
  { kind: "exact",  id: "1P_JAR",           company: "Google", category: "advertising",   purpose: "Ties your visit to Google ad/analytics data." },
  { kind: "regex",  id: /^(AID|TAID)$/,     company: "Google", category: "advertising",   purpose: "Cross-device ad conversion linking." },

  // ---------- Meta / Facebook ----------
  { kind: "exact",  id: "_fbp",             company: "Meta (Facebook)", category: "advertising", purpose: "Facebook Pixel browser ID — tracks you for ad targeting.", retention: "90 days" },
  { kind: "exact",  id: "_fbc",             company: "Meta (Facebook)", category: "advertising", purpose: "Stores the ad click that brought you here.", retention: "90 days" },
  { kind: "exact",  id: "fr",               company: "Meta (Facebook)", category: "advertising", purpose: "Encrypted Facebook ID for ad delivery & retargeting.", retention: "90 days" },
  { kind: "exact",  id: "datr",             company: "Meta (Facebook)", category: "security", purpose: "Identifies your browser for Facebook security/anti-fraud.", retention: "2 years" },
  { kind: "exact",  id: "sb",               company: "Meta (Facebook)", category: "security", purpose: "Facebook browser identification." },

  // ---------- Microsoft / Bing / Clarity ----------
  { kind: "exact",  id: "MUID",             company: "Microsoft", category: "advertising", purpose: "Cross-site user ID shared by Bing & Microsoft ads.", retention: "13 months" },
  { kind: "prefix", id: "_uetsid",          company: "Microsoft (Bing UET)", category: "advertising", purpose: "Bing Ads session ID for conversion tracking." },
  { kind: "prefix", id: "_uetvid",          company: "Microsoft (Bing UET)", category: "advertising", purpose: "Bing Ads cross-session visitor ID.", retention: "13 months" },
  { kind: "prefix", id: "_clck",            company: "Microsoft Clarity", category: "session-replay", purpose: "Clarity user ID for session recording & heatmaps." },
  { kind: "prefix", id: "_clsk",            company: "Microsoft Clarity", category: "session-replay", purpose: "Clarity session ID (links recorded events)." },
  { kind: "prefix", id: "CLID",             company: "Microsoft Clarity", category: "session-replay", purpose: "Clarity identifier for session replay." },

  // ---------- LinkedIn ----------
  { kind: "exact",  id: "bcookie",          company: "LinkedIn", category: "advertising",  purpose: "LinkedIn browser ID for ads & features.", retention: "1 year" },
  { kind: "exact",  id: "bscookie",         company: "LinkedIn", category: "security",     purpose: "Secure LinkedIn browser ID." },
  { kind: "exact",  id: "lidc",             company: "LinkedIn", category: "functional",   purpose: "LinkedIn data-center routing.", retention: "24 hours" },
  { kind: "exact",  id: "li_gc",            company: "LinkedIn", category: "consent",       purpose: "Stores LinkedIn cookie consent." },
  { kind: "exact",  id: "UserMatchHistory", company: "LinkedIn", category: "advertising",  purpose: "LinkedIn Ads ID syncing — matches you across sites." },
  { kind: "exact",  id: "AnalyticsSyncHistory", company: "LinkedIn", category: "advertising", purpose: "Tracks when your ID was synced to LinkedIn." },

  // ---------- HubSpot ----------
  { kind: "exact",  id: "hubspotutk",       company: "HubSpot", category: "analytics",     purpose: "HubSpot visitor token — links you to form submissions.", retention: "6 months" },
  { kind: "exact",  id: "__hstc",           company: "HubSpot", category: "analytics",     purpose: "HubSpot main tracking cookie (visits, sources, timing).", retention: "6 months" },
  { kind: "exact",  id: "__hssc",           company: "HubSpot", category: "analytics",     purpose: "HubSpot current-session tracking." },
  { kind: "exact",  id: "__hssrc",          company: "HubSpot", category: "analytics",     purpose: "Detects if you restarted your browser (HubSpot)." },

  // ---------- Hotjar ----------
  { kind: "prefix", id: "_hjSessionUser",   company: "Hotjar", category: "session-replay", purpose: "Hotjar persistent user ID across sessions.", retention: "1 year" },
  { kind: "prefix", id: "_hjSession",       company: "Hotjar", category: "session-replay", purpose: "Hotjar current-session recording data." },
  { kind: "prefix", id: "_hjid",            company: "Hotjar", category: "session-replay", purpose: "Hotjar visitor ID for recordings & heatmaps." },
  { kind: "prefix", id: "_hj",              company: "Hotjar", category: "session-replay", purpose: "Hotjar session-recording / heatmap state." },

  // ---------- Adobe ----------
  { kind: "prefix", id: "AMCV_",            company: "Adobe", category: "analytics",       purpose: "Adobe Experience Cloud visitor ID." },
  { kind: "prefix", id: "AMCVS_",           company: "Adobe", category: "analytics",       purpose: "Adobe visitor-ID session marker." },
  { kind: "exact",  id: "s_cc",             company: "Adobe Analytics", category: "analytics", purpose: "Checks whether cookies are enabled (Adobe)." },
  { kind: "prefix", id: "s_sq",             company: "Adobe Analytics", category: "analytics", purpose: "Records the last link you clicked (Adobe)." },
  { kind: "prefix", id: "mbox",             company: "Adobe Target", category: "advertising", purpose: "A/B testing & personalization targeting." },
  { kind: "exact",  id: "demdex",           company: "Adobe Audience Manager", category: "data-broker", purpose: "Cross-site audience segmentation ID." },

  // ---------- Other analytics / product ----------
  { kind: "prefix", id: "ajs_",             company: "Segment", category: "analytics",     purpose: "Segment anonymous/user ID — pipes data to many tools." },
  { kind: "prefix", id: "amplitude",        company: "Amplitude", category: "analytics",   purpose: "Amplitude device/session ID for product analytics." },
  { kind: "prefix", id: "mp_",              company: "Mixpanel", category: "analytics",    purpose: "Mixpanel distinct-id & event state." },
  { kind: "prefix", id: "_ym_",             company: "Yandex Metrica", category: "analytics", purpose: "Yandex analytics & session-replay ID." },
  { kind: "exact",  id: "__qca",            company: "Quantcast", category: "advertising", purpose: "Quantcast audience-measurement ID." },
  { kind: "regex",  id: /^(_pk_id|_pk_ses)/,company: "Matomo", category: "analytics",     purpose: "Matomo visitor/session analytics ID." },
  { kind: "prefix", id: "intercom-",        company: "Intercom", category: "functional",   purpose: "Intercom chat session & visitor ID." },
  { kind: "prefix", id: "_uetq",            company: "Microsoft (Bing UET)", category: "advertising", purpose: "Bing UET queued events." },

  // ---------- Ad networks / retargeting ----------
  { kind: "prefix", id: "cto_",             company: "Criteo", category: "advertising",    purpose: "Criteo retargeting ID — follows you across sites." },
  { kind: "exact",  id: "uuid",             company: "Ad network", category: "advertising", scope: "tracker-domain", purpose: "Generic advertising user identifier (on an ad domain)." },
  { kind: "exact",  id: "uuid2",            company: "Xandr/AppNexus", category: "data-broker", scope: "tracker-domain", onDomain: "adnxs.com", purpose: "AppNexus cross-site advertising ID." },
  { kind: "exact",  id: "anj",              company: "Xandr/AppNexus", category: "data-broker", scope: "tracker-domain", onDomain: "adnxs.com", purpose: "AppNexus ad-cookie consent/targeting state." },
  { kind: "exact",  id: "_pinterest_ct_ua", company: "Pinterest", category: "advertising", purpose: "Pinterest cross-site ad tracking." },
  { kind: "exact",  id: "_pin_unauth",      company: "Pinterest", category: "advertising", purpose: "Pinterest anonymous user ID for ads." },
  { kind: "exact",  id: "_ttp",             company: "TikTok", category: "advertising",    purpose: "TikTok Pixel cross-site tracking ID." },
  { kind: "exact",  id: "ttwid",            company: "TikTok", category: "advertising",    purpose: "TikTok identifier for ads & measurement." },
  { kind: "exact",  id: "personalization_id", company: "X (Twitter)", category: "advertising", purpose: "Twitter/X ad personalization ID." },
  { kind: "exact",  id: "guest_id",         company: "X (Twitter)", category: "social",    purpose: "Twitter/X guest identifier for embeds." },
  { kind: "prefix", id: "_scid",            company: "Snap", category: "advertising",      purpose: "Snapchat Pixel cross-site ID." },
  { kind: "prefix", id: "_rdt_uuid",        company: "Reddit", category: "advertising",    purpose: "Reddit Pixel conversion-tracking ID." },

  // ---------- Stripe (payment / fraud) ----------
  { kind: "exact",  id: "__stripe_mid",     company: "Stripe", category: "security",       purpose: "Stripe fraud-prevention device ID.", retention: "1 year" },
  { kind: "exact",  id: "__stripe_sid",     company: "Stripe", category: "security",       purpose: "Stripe fraud-prevention session ID." }
];

/**
 * Identify a cookie by name. Returns the best-matching DB entry, or null.
 * Exact matches win over prefix/regex; longer prefixes win over shorter.
 */
export function identifyCookie(name) {
  if (!name) return null;
  let best = null;
  let bestScore = -1;
  for (const entry of COOKIE_DB) {
    let score = -1;
    if (entry.kind === "exact" && name === entry.id) score = 1000;
    else if (entry.kind === "prefix" && name.startsWith(entry.id)) score = 100 + entry.id.length;
    else if (entry.kind === "regex" && entry.id.test(name)) score = 50;
    if (score > bestScore) { bestScore = score; best = entry; }
  }
  return best;
}

// Human-readable label + accent color per category (used by the UI).
export const CATEGORY_META = {
  necessary:       { label: "Necessary",      color: "#3fb950", weight: 0 },
  functional:      { label: "Functional",     color: "#58a6ff", weight: 0 },
  security:        { label: "Security",        color: "#a5d6ff", weight: 0 },
  "fraud-detection":{ label: "Fraud Detection", color: "#a5d6ff", weight: 0 },
  consent:         { label: "Consent",         color: "#8b949e", weight: 0 },
  analytics:       { label: "Analytics",       color: "#d29922", weight: 1.5 },
  social:          { label: "Social",          color: "#bc8cff", weight: 2 },
  advertising:     { label: "Advertising",     color: "#f85149", weight: 4 },
  "session-replay":{ label: "Session Replay",  color: "#db61a2", weight: 6 },
  fingerprinting:  { label: "Fingerprinting",  color: "#ff7b72", weight: 6 },
  "data-broker":   { label: "Data Broker",     color: "#da3633", weight: 5 },
  unknown:         { label: "Unknown",         color: "#6e7681", weight: 1 }
};

// ---- F3: lightweight, transparent purpose ESTIMATE for cookies we don't know ----
// Deliberately simple and conservative: name-token rules first, then a single
// behavioural fallback (third-party + long-lived + high-entropy ID). Returns a
// guess ONLY when the signal is reasonably clear, else null ("unknown"). This is an
// ESTIMATE shown as such — it never sets isTracking, never feeds the risk score, and
// carries no accuracy claim. (A confident-looking guess on weak signal would just
// be a new way to mislead, so we return null instead.)
function looksLikeId(v) {
  if (!v || v.length < 12 || v.length > 256) return false;
  if (/[\s{}\[\]"<>]/.test(v)) return false;        // structured/JSON value, not a raw ID
  return new Set(v).size >= 8;                        // some entropy
}
export function classifyCookieHeuristic({ name, value, party, days, session }) {
  const n = (name || "").toLowerCase();
  const has = (re) => re.test(n);
  if (has(/(csrf|xsrf|antiforgery|token|^sess(ion)?(id)?$|^sid$|phpsessid|jsessionid|asp\.?net|__requestverification|auth|login)/))
    return { category: "necessary", why: "name looks like a session / security token" };
  if (has(/(consent|gdpr|ccpa|cookielaw|cookie_?(notice|consent|policy)|onetrust|privacy_?settings)/))
    return { category: "consent", why: "name looks like a consent / cookie-banner record" };
  if (has(/(lang|locale|country|currency|timezone|^tz$|theme|darkmode|font|pref|setting|layout|display)/))
    return { category: "functional", why: "name looks like a preference / UI setting" };
  if (has(/(analytics|statistic|measure|metric|^_pk|^_ga|^_gid|pageview|visit_count|sessions?_)/))
    return { category: "analytics", why: "name looks like analytics / measurement" };
  if (has(/(^_fbp|^_scid|advert|^ads?[_-]|adid|^uid$|^uuid$|pixel|audience|targe?t|campaign|^dsp|rtb|conversion|retarget|affiliate|partner_id)/))
    return { category: "advertising", why: "name looks like ad targeting / cross-site tracking" };
  if (party === "third" && !session && days > 180 && looksLikeId(value))
    return { category: "advertising", why: "a third-party cookie storing a long-lived unique ID" };
  return null;
}
