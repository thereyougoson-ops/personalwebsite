// Data-collection profiles — what each company is KNOWN TO BE DESIGNED to collect,
// per its own published disclosures. Important honesty rules baked in here:
//   • These describe capability/design ("is designed to…", "can…"), NOT observed
//     actions, and are NOT read from any specific cookie value.
//   • Every profile links to that company's OWN privacy policy / opt-out as the
//     source of the claim — CookieLens is not the authority.
//   • `broker:true` is reserved for companies whose stated business is buying/
//     selling/trading audience data (DMPs, ad exchanges, identity onboarders).
//     Advertising platforms that use data in-house are NOT marked brokers.

export const DATA_TYPES = {
  browsing:  { icon: "🌐", label: "Pages & content you view" },
  location:  { icon: "📍", label: "Approximate location (from your IP)" },
  device:    { icon: "🖥️", label: "Device & browser details" },
  screen:    { icon: "🎥", label: "Clicks, scrolling & on-screen behavior" },
  intent:    { icon: "🛒", label: "Shopping & purchase intent" },
  xsite:     { icon: "🔗", label: "Cross-site identity (links you across sites)" },
  xdevice:   { icon: "📱", label: "Cross-device identity (phone ↔ computer)" },
  pii:       { icon: "🪪", label: "Linkage to your real identity / email" },
  ads:       { icon: "🎯", label: "Ad views, clicks & conversions" },
  interests: { icon: "🧠", label: "Inferred interests & demographics" }
};

// Specific profiles, ordered specific → generic (first match wins).
const PROFILES = [
  { test: /double ?click|google ads|google \(double/i, brand: "Google Ads / DoubleClick", broker: false,
    types: ["xsite", "interests", "ads", "location", "device"],
    usage: "Designed to personalize and measure ads across the web using a cross-site advertising ID.",
    optOut: "https://adssettings.google.com/", privacy: "https://policies.google.com/privacy" },
  { test: /google ?analytics|^google$/i, brand: "Google Analytics", broker: false,
    types: ["browsing", "location", "device", "ads"],
    usage: "Designed to measure site traffic and your on-site behavior for the website owner.",
    optOut: "https://tools.google.com/dlpage/gaoptout", privacy: "https://policies.google.com/privacy" },
  { test: /meta|facebook/i, brand: "Meta (Facebook)", broker: false,
    types: ["xsite", "interests", "ads", "pii"],
    usage: "Designed to match your browsing to your Facebook/Instagram account for ad targeting & measurement.",
    optOut: "https://www.facebook.com/adpreferences/ad_settings", privacy: "https://www.facebook.com/privacy/policy" },
  { test: /clarity/i, brand: "Microsoft Clarity", broker: false,
    types: ["screen", "device", "browsing"],
    usage: "Designed to record your session — clicks, scrolling and mouse movement — as heatmaps & replays.",
    optOut: "https://clarity.microsoft.com/", privacy: "https://privacy.microsoft.com/privacystatement" },
  { test: /bing|microsoft$|uet/i, brand: "Microsoft Advertising (Bing)", broker: false,
    types: ["xsite", "ads", "interests"],
    usage: "Designed to track ad conversions and build advertising audiences.",
    optOut: "https://account.microsoft.com/privacy/ad-settings", privacy: "https://privacy.microsoft.com/privacystatement" },
  { test: /linkedin/i, brand: "LinkedIn (Microsoft)", broker: false,
    types: ["xsite", "ads", "interests", "pii"],
    usage: "Designed to track ad conversions and match visits to your LinkedIn profile.",
    optOut: "https://www.linkedin.com/psettings/guest-controls/retargeting-opt-out", privacy: "https://www.linkedin.com/legal/privacy-policy" },
  { test: /hotjar/i, brand: "Hotjar", broker: false,
    types: ["screen", "device", "browsing"],
    usage: "Designed to record sessions and build heatmaps of how you use the page.",
    optOut: "https://www.hotjar.com/legal/compliance/opt-out", privacy: "https://www.hotjar.com/legal/policies/privacy" },
  { test: /fullstory|logrocket|mouseflow|smartlook/i, brand: "Session-replay vendor", broker: false,
    types: ["screen", "device", "browsing"],
    usage: "Designed to capture full session replays — your clicks, scrolling and form interactions.",
    optOut: null, privacy: null },
  { test: /criteo/i, brand: "Criteo", broker: true,
    types: ["intent", "browsing", "xsite", "ads"],
    usage: "An ad-tech company designed to track products you view across sites and retarget you with ads.",
    optOut: "https://www.criteo.com/privacy/", privacy: "https://www.criteo.com/privacy/" },
  { test: /trade ?desk/i, brand: "The Trade Desk", broker: true,
    types: ["xsite", "xdevice", "interests", "ads"],
    usage: "A demand-side ad platform designed to build a cross-site/cross-device identity for ad bidding.",
    optOut: "https://www.thetradedesk.com/us/privacy", privacy: "https://www.thetradedesk.com/us/privacy" },
  { test: /xandr|appnexus/i, brand: "Xandr / AppNexus (Microsoft)", broker: true,
    types: ["xsite", "interests", "ads"],
    usage: "An ad exchange designed to match audience identifiers across sites for real-time ad bidding.",
    optOut: "https://www.xandr.com/privacy/platform-privacy-policy/", privacy: "https://www.xandr.com/privacy/platform-privacy-policy/" },
  { test: /liveramp/i, brand: "LiveRamp", broker: true,
    types: ["pii", "xdevice", "xsite", "interests"],
    usage: "An identity-resolution company designed to connect online activity to offline / real-world identity.",
    optOut: "https://liveramp.com/opt_out/", privacy: "https://liveramp.com/privacy/" },
  { test: /neustar/i, brand: "Neustar", broker: true,
    types: ["pii", "xdevice", "xsite"],
    usage: "An identity & audience-data company designed to link and enrich consumer profiles.",
    optOut: "https://www.home.neustar/privacy/opt-out", privacy: "https://www.home.neustar/privacy" },
  { test: /oracle|bluekai/i, brand: "Oracle (BlueKai / Moat)", broker: true,
    types: ["interests", "xsite", "browsing"],
    usage: "A data-management platform designed to build and trade audience segments.",
    optOut: "https://datacloudoptout.oracle.com/", privacy: "https://www.oracle.com/legal/privacy/" },
  { test: /lotame/i, brand: "Lotame", broker: true,
    types: ["interests", "xsite", "browsing"],
    usage: "A data-management platform designed to collect and sell audience-segment data.",
    optOut: "https://www.lotame.com/about-lotame/privacy/opt-out/", privacy: "https://www.lotame.com/about-lotame/privacy/" },
  { test: /adobe/i, brand: "Adobe (Audience Manager)", broker: true,
    types: ["interests", "xsite", "browsing"],
    usage: "A data-management platform designed to segment audiences across sites.",
    optOut: "https://www.adobe.com/privacy/opt-out.html", privacy: "https://www.adobe.com/privacy/policy.html" },
  { test: /magnite|pubmatic|openx|index exchange|bidswitch|33across|adform/i, brand: "Ad exchange", broker: true,
    types: ["xsite", "interests", "ads"],
    usage: "A programmatic ad exchange designed to sync identifiers and trade ad impressions in real time.",
    optOut: "https://optout.aboutads.info/", privacy: null },
  { test: /amazon/i, brand: "Amazon Advertising", broker: false,
    types: ["intent", "interests", "ads", "xsite"],
    usage: "Designed to retarget you with ads based on shopping and browsing signals.",
    optOut: "https://www.amazon.com/adprefs", privacy: "https://www.amazon.com/privacy" },
  { test: /tiktok/i, brand: "TikTok", broker: false,
    types: ["xsite", "interests", "ads"],
    usage: "Designed to track conversions and build advertising audiences across sites.",
    optOut: "https://www.tiktok.com/legal/page/row/privacy-policy/en", privacy: "https://www.tiktok.com/legal/page/row/privacy-policy/en" },
  { test: /taboola|outbrain/i, brand: "Content-recommendation network", broker: false,
    types: ["browsing", "interests", "ads"],
    usage: "Designed to track what content you read and recommend (paid) content across publishers.",
    optOut: "https://optout.aboutads.info/", privacy: null },
  { test: /stripe/i, brand: "Stripe", broker: false,
    types: ["device"],
    usage: "Designed to fingerprint your device for payment fraud prevention (not advertising).",
    optOut: null, privacy: "https://stripe.com/privacy" },
  { test: /segment/i, brand: "Twilio Segment", broker: false,
    types: ["browsing", "device", "interests"],
    usage: "A customer-data pipeline designed to collect your events and distribute them to many other tools.",
    optOut: null, privacy: "https://www.twilio.com/legal/privacy" }
];

// Category-based fallback when no specific brand profile matches.
const CATEGORY_DEFAULTS = {
  advertising:      { types: ["xsite", "ads", "interests", "location"], broker: false, usage: "Designed to target and measure advertising, typically using a cross-site identifier." },
  "data-broker":    { types: ["xsite", "xdevice", "interests", "intent"], broker: true, usage: "An audience-data company designed to build and trade user profiles." },
  "session-replay": { types: ["screen", "device", "browsing"], broker: false, usage: "Designed to record your on-page behavior (clicks, scrolling, sometimes input)." },
  fingerprinting:   { types: ["device"], broker: false, usage: "Designed to identify your device via a fingerprint." },
  analytics:        { types: ["browsing", "device"], broker: false, usage: "Designed to measure your behavior on the site." },
  social:           { types: ["xsite", "interests", "ads"], broker: false, usage: "A social-platform integration designed to track you for ads and features." }
};

/**
 * Resolve a data-collection profile for a company.
 * @param {string} company  company/brand string from the cookie or tracker DB
 * @param {string} category tracking category, used as a fallback
 * @returns {object|null}   { brand, broker, types[], usage, optOut, privacy }
 */
export function dataProfileFor(company, category) {
  const c = company || "";
  for (const p of PROFILES) {
    if (p.test.test(c)) return { brand: p.brand, broker: p.broker, types: p.types, usage: p.usage, optOut: p.optOut, privacy: p.privacy };
  }
  const d = CATEGORY_DEFAULTS[category];
  if (d) return { brand: company || "Third party", broker: d.broker, types: d.types, usage: d.usage, optOut: null, privacy: null };
  return null;
}
