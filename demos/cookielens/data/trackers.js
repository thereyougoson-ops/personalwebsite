// Curated, high-signal tracker domain database.
// Keyed by registrable domain (eTLD+1). Covers the trackers responsible for the
// large majority of real-world third-party requests. Intentionally compact for
// a lightweight extension — not an exhaustive blocklist.
//
// category: advertising | analytics | social | session-replay |
//           fingerprinting | fraud-detection | tag-manager | data-broker | cdn
//
// NOTE: "fingerprinting" is reserved for *observed* canvas/WebRTC/Audio probing
// (detected live by the fp-probe content script) — it is intentionally NOT applied
// to any static domain here. Payment/fraud-prevention device checks (e.g. Stripe)
// are "fraud-detection", a benign category that is NOT counted as tracking, so the
// tool never claims a checkout page "fingerprinted you to re-identify you".

export const TRACKER_DB = {
  // --- Google / Alphabet ---
  "doubleclick.net":        { company: "Google", category: "advertising", note: "Ad serving & cross-site ad targeting (DoubleClick)." },
  "google-analytics.com":   { company: "Google", category: "analytics", note: "Site analytics — page views, sessions, audience." },
  "googletagmanager.com":   { company: "Google", category: "tag-manager", note: "Loads other tags/trackers on the page." },
  "googlesyndication.com":  { company: "Google", category: "advertising", note: "AdSense ad delivery & measurement." },
  "googleadservices.com":   { company: "Google", category: "advertising", note: "Google Ads conversion tracking." },
  "google.com":             { company: "Google", category: "advertising", note: "Conversion/remarketing (when loaded 3rd-party)." },
  "gstatic.com":            { company: "Google", category: "cdn", note: "Static assets; sometimes carries analytics." },
  "youtube.com":            { company: "Google", category: "social", note: "Embedded video; sets ad/tracking cookies." },

  // --- Meta / Facebook ---
  "facebook.com":           { company: "Meta", category: "social", note: "Facebook Pixel / social embeds — cross-site tracking." },
  "facebook.net":           { company: "Meta", category: "advertising", note: "Facebook Pixel script & conversion tracking." },
  "fbcdn.net":              { company: "Meta", category: "cdn", note: "Facebook asset CDN." },
  "instagram.com":          { company: "Meta", category: "social", note: "Embedded Instagram content." },

  // --- Microsoft ---
  "bing.com":               { company: "Microsoft", category: "advertising", note: "Bing/UET ads conversion tracking." },
  "clarity.ms":             { company: "Microsoft", category: "session-replay", note: "Records sessions, heatmaps & clicks." },
  "linkedin.com":           { company: "Microsoft (LinkedIn)", category: "advertising", note: "LinkedIn Insight ad & conversion tracking." },
  "licdn.com":              { company: "Microsoft (LinkedIn)", category: "cdn", note: "LinkedIn asset CDN / Insight tag." },

  // --- Analytics & product analytics ---
  "hotjar.com":             { company: "Hotjar", category: "session-replay", note: "Session recording, heatmaps & surveys." },
  "hotjar.io":              { company: "Hotjar", category: "session-replay", note: "Session recording & heatmaps." },
  "mixpanel.com":           { company: "Mixpanel", category: "analytics", note: "Product/event analytics & user profiles." },
  "amplitude.com":          { company: "Amplitude", category: "analytics", note: "Product analytics & behavioral cohorts." },
  "segment.com":            { company: "Twilio Segment", category: "analytics", note: "Customer-data pipeline — fans data to many tools." },
  "segment.io":             { company: "Twilio Segment", category: "analytics", note: "Customer-data pipeline." },
  "fullstory.com":          { company: "FullStory", category: "session-replay", note: "Full session replay & DOM capture." },
  "mouseflow.com":          { company: "Mouseflow", category: "session-replay", note: "Session replay & heatmaps." },
  "logrocket.com":          { company: "LogRocket", category: "session-replay", note: "Session replay & frontend monitoring." },
  "smartlook.com":          { company: "Smartlook", category: "session-replay", note: "Session recording & event tracking." },
  "heap.io":                { company: "Heap", category: "analytics", note: "Auto-captures every user interaction." },
  "heapanalytics.com":      { company: "Heap", category: "analytics", note: "Auto-capture product analytics." },
  "matomo.cloud":           { company: "Matomo", category: "analytics", note: "Privacy-focused web analytics." },
  "plausible.io":           { company: "Plausible", category: "analytics", note: "Privacy-friendly, cookieless analytics." },
  "scorecardresearch.com":  { company: "Comscore", category: "analytics", note: "Audience measurement / market research." },
  "quantserve.com":         { company: "Quantcast", category: "advertising", note: "Audience measurement & ad targeting." },
  "quantcount.com":         { company: "Quantcast", category: "advertising", note: "Audience measurement." },
  "chartbeat.com":          { company: "Chartbeat", category: "analytics", note: "Real-time content analytics." },
  "newrelic.com":           { company: "New Relic", category: "analytics", note: "Performance monitoring (some user data)." },
  "nr-data.net":            { company: "New Relic", category: "analytics", note: "Browser performance beacons." },
  "yandex.ru":              { company: "Yandex", category: "analytics", note: "Yandex Metrica — analytics & session replay." },
  "mc.yandex.ru":           { company: "Yandex", category: "analytics", note: "Yandex Metrica beacon." },

  // --- Ad exchanges / data brokers (high privacy impact) ---
  "adnxs.com":              { company: "Microsoft (Xandr/AppNexus)", category: "data-broker", note: "Real-time ad bidding & identity matching." },
  "adsrvr.org":             { company: "The Trade Desk", category: "data-broker", note: "Cross-site identity graph & ad bidding." },
  "criteo.com":             { company: "Criteo", category: "advertising", note: "Retargeting — follows you across sites." },
  "criteo.net":             { company: "Criteo", category: "advertising", note: "Retargeting ad delivery." },
  "rubiconproject.com":     { company: "Magnite", category: "data-broker", note: "Ad exchange / supply-side bidding." },
  "pubmatic.com":           { company: "PubMatic", category: "data-broker", note: "Ad exchange & audience data." },
  "openx.net":              { company: "OpenX", category: "data-broker", note: "Ad exchange real-time bidding." },
  "casalemedia.com":        { company: "Index Exchange", category: "data-broker", note: "Ad exchange bidding & cookie syncing." },
  "amazon-adsystem.com":    { company: "Amazon", category: "advertising", note: "Amazon ad delivery & retargeting." },
  "adform.net":             { company: "Adform", category: "data-broker", note: "Ad serving & cross-site identity." },
  "bidswitch.net":          { company: "BidSwitch", category: "data-broker", note: "Programmatic bid routing & cookie sync." },
  "smartadserver.com":      { company: "Equativ", category: "advertising", note: "Ad serving & targeting." },
  "moatads.com":            { company: "Oracle (Moat)", category: "data-broker", note: "Ad verification & audience measurement." },
  "doubleverify.com":       { company: "DoubleVerify", category: "advertising", note: "Ad verification & viewability." },
  "taboola.com":            { company: "Taboola", category: "advertising", note: "'Around the web' recommendation ads." },
  "outbrain.com":           { company: "Outbrain", category: "advertising", note: "Content recommendation ads." },
  "sharethrough.com":       { company: "Sharethrough", category: "advertising", note: "Native ad exchange." },
  "33across.com":           { company: "33Across", category: "data-broker", note: "Identity resolution & addressability." },
  "crwdcntrl.net":          { company: "Lotame", category: "data-broker", note: "Data-management platform / audience data." },
  "demdex.net":             { company: "Adobe Audience Manager", category: "data-broker", note: "Cross-site audience segmentation." },
  "everesttech.net":        { company: "Adobe Advertising", category: "advertising", note: "Ad conversion & retargeting." },
  "rlcdn.com":              { company: "LiveRamp", category: "data-broker", note: "Identity resolution / data onboarding." },
  "pippio.com":             { company: "LiveRamp", category: "data-broker", note: "Identity matching." },
  "agkn.com":               { company: "Neustar", category: "data-broker", note: "Identity & audience data." },
  "bluekai.com":            { company: "Oracle BlueKai", category: "data-broker", note: "Audience data marketplace." },

  // --- Social / embeds ---
  "twitter.com":            { company: "X (Twitter)", category: "social", note: "Embeds & ad conversion tracking." },
  "x.com":                  { company: "X (Twitter)", category: "social", note: "Embeds & conversion tracking." },
  "t.co":                   { company: "X (Twitter)", category: "social", note: "Link wrapper / click tracking." },
  "tiktok.com":             { company: "TikTok", category: "advertising", note: "TikTok Pixel — ad & conversion tracking." },
  "ttwid":                  { company: "TikTok", category: "advertising", note: "TikTok ID cookie." },
  "pinterest.com":          { company: "Pinterest", category: "advertising", note: "Pinterest Tag conversion tracking." },
  "snapchat.com":           { company: "Snap", category: "advertising", note: "Snap Pixel conversion tracking." },
  "sc-static.net":          { company: "Snap", category: "advertising", note: "Snap Pixel assets." },
  "reddit.com":             { company: "Reddit", category: "advertising", note: "Reddit Pixel conversion tracking." },
  "redditstatic.com":       { company: "Reddit", category: "advertising", note: "Reddit ad pixel assets." },

  // --- Marketing / CRM ---
  "hubspot.com":            { company: "HubSpot", category: "analytics", note: "Marketing analytics & lead tracking." },
  "hs-analytics.net":       { company: "HubSpot", category: "analytics", note: "HubSpot visitor analytics." },
  "hsforms.com":            { company: "HubSpot", category: "analytics", note: "HubSpot forms & tracking." },
  "marketo.net":            { company: "Adobe (Marketo)", category: "analytics", note: "Marketing automation & lead tracking." },
  "pardot.com":             { company: "Salesforce (Pardot)", category: "analytics", note: "B2B marketing automation tracking." },
  "intercom.io":            { company: "Intercom", category: "analytics", note: "Live chat & user tracking." },
  "drift.com":              { company: "Drift", category: "analytics", note: "Chat & visitor tracking." },
  "zdassets.com":           { company: "Zendesk", category: "analytics", note: "Support widget & analytics." },
  "klaviyo.com":            { company: "Klaviyo", category: "analytics", note: "Email/SMS marketing tracking." },
  "branch.io":              { company: "Branch", category: "advertising", note: "Mobile attribution & deep linking." },
  "appsflyer.com":          { company: "AppsFlyer", category: "advertising", note: "Mobile attribution tracking." },

  // --- Consent platforms (functional, but worth surfacing) ---
  "cookielaw.org":          { company: "OneTrust", category: "tag-manager", note: "Consent management (gates other trackers)." },
  "onetrust.com":           { company: "OneTrust", category: "tag-manager", note: "Consent management platform." },
  "cookieyes.com":          { company: "CookieYes", category: "tag-manager", note: "Consent banner & cookie scanning." },
  "usercentrics.eu":        { company: "Usercentrics", category: "tag-manager", note: "Consent management platform." },
  "onetrust.io":            { company: "OneTrust", category: "tag-manager", note: "Consent management (gates other trackers)." },

  // --- A/B testing & video/media analytics ---
  "optimizely.com":         { company: "Optimizely", category: "analytics", note: "A/B testing & experimentation tracking." },
  "litix.io":               { company: "Mux Data", category: "analytics", note: "Video playback quality & viewer analytics." },
  "mediamelon.com":         { company: "MediaMelon", category: "analytics", note: "Video QoE & audience analytics." },
  "brightline.tv":          { company: "Brightline", category: "advertising", note: "Connected-TV interactive ad tracking." },

  // --- Stripe (payment fraud-prevention, third-party but not ad-tech tracking) ---
  "stripe.com":             { company: "Stripe", category: "fraud-detection", note: "Payment fraud detection — device checks for chargeback/fraud prevention, not ad targeting." },
  "stripe.network":         { company: "Stripe", category: "fraud-detection", note: "Stripe fraud-prevention signals." },

  // --- Benign infrastructure / CDNs (recognized so they aren't flagged as trackers) ---
  "googleapis.com":         { company: "Google", category: "cdn", note: "Google APIs / Fonts — infrastructure, not tracking." },
  "jsdelivr.net":           { company: "jsDelivr", category: "cdn", note: "Open-source CDN — infrastructure." },
  "unpkg.com":              { company: "unpkg", category: "cdn", note: "npm package CDN — infrastructure." },
  "cdnjs.com":              { company: "Cloudflare", category: "cdn", note: "Open-source library CDN — infrastructure." },
  "cloudflare.com":         { company: "Cloudflare", category: "cdn", note: "CDN / security infrastructure." },
  "cloudfront.net":         { company: "Amazon CloudFront", category: "cdn", note: "AWS CDN — infrastructure." },
  "fastly.net":             { company: "Fastly", category: "cdn", note: "CDN — infrastructure." },
  "akamaihd.net":           { company: "Akamai", category: "cdn", note: "CDN — infrastructure." },
  "akamaized.net":          { company: "Akamai", category: "cdn", note: "CDN — infrastructure." },
  "akamai.net":             { company: "Akamai", category: "cdn", note: "CDN — infrastructure." },
  "bootstrapcdn.com":       { company: "BootstrapCDN", category: "cdn", note: "CSS/JS CDN — infrastructure." },
  "jquery.com":             { company: "jQuery", category: "cdn", note: "jQuery CDN — infrastructure." },
  "gravatar.com":           { company: "Automattic", category: "cdn", note: "Avatar image hosting — infrastructure." },
  "typekit.net":            { company: "Adobe Fonts", category: "cdn", note: "Web font delivery — infrastructure." },
  "fontawesome.com":        { company: "Font Awesome", category: "cdn", note: "Icon font CDN — infrastructure." }
};

/** Look up a tracker by registrable domain. Returns null if unknown. */
export function lookupTracker(registrable) {
  return TRACKER_DB[registrable] || null;
}

// Categories considered "tracking" for risk/badge purposes.
export const TRACKING_CATEGORIES = new Set([
  "advertising", "analytics", "social", "session-replay", "fingerprinting", "data-broker"
]);

// Highest-impact categories (weighted heavier in risk scoring).
export const HIGH_IMPACT_CATEGORIES = new Set([
  "advertising", "data-broker", "session-replay", "fingerprinting"
]);
