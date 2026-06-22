// Lightweight registrable-domain (eTLD+1) resolver.
// Not a full Public Suffix List — a curated set of the common multi-label
// suffixes so first-party vs third-party attribution stays correct without
// shipping a 200 KB PSL. Good enough for cookie scoping in 99% of real pages.

const MULTI_LABEL_SUFFIXES = new Set([
  // UK
  "co.uk", "org.uk", "me.uk", "ltd.uk", "plc.uk", "gov.uk", "ac.uk", "net.uk", "sch.uk",
  // Australia
  "com.au", "net.au", "org.au", "edu.au", "gov.au", "id.au", "asn.au",
  // Japan
  "co.jp", "or.jp", "ne.jp", "ac.jp", "go.jp", "ad.jp", "ed.jp", "gr.jp",
  // New Zealand
  "co.nz", "net.nz", "org.nz", "govt.nz", "ac.nz", "geek.nz",
  // India
  "co.in", "net.in", "org.in", "gen.in", "firm.in", "ind.in",
  // South Africa
  "co.za", "org.za", "net.za", "gov.za", "web.za",
  // Brazil
  "com.br", "net.br", "org.br", "gov.br", "edu.br",
  // Mexico / LATAM
  "com.mx", "org.mx", "gob.mx", "com.ar", "gob.ar", "com.co", "com.pe", "com.ve",
  // Europe
  "co.il", "org.il", "gov.il", "com.tr", "gov.tr", "co.kr", "or.kr", "ne.kr",
  "com.cn", "net.cn", "org.cn", "gov.cn", "com.hk", "com.sg", "com.tw", "com.my",
  "com.es", "com.pt", "com.pl", "com.ua", "com.ru", "co.id", "or.id",
  // Generic seconds that behave like suffixes
  "com.vn", "net.vn", "com.ph", "com.sa", "com.eg", "com.ng", "com.gh"
]);

/**
 * Return the registrable domain (eTLD+1) of a hostname.
 * "stats.g.doubleclick.net" -> "doubleclick.net"
 * "shop.example.co.uk"      -> "example.co.uk"
 */
export function registrableDomain(hostname) {
  if (!hostname) return "";
  let host = String(hostname).toLowerCase().replace(/\.$/, "");
  // Strip a leading dot (cookie domains often look like ".example.com")
  if (host.startsWith(".")) host = host.slice(1);
  // IP addresses and single-label hosts are their own registrable unit.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || /^\[?[0-9a-f:]+\]?$/i.test(host)) return host;

  const parts = host.split(".");
  if (parts.length <= 2) return host;

  const last2 = parts.slice(-2).join(".");
  const last3 = parts.slice(-3).join(".");
  if (MULTI_LABEL_SUFFIXES.has(last2)) return last3;
  return last2;
}

/** Safe hostname extraction from a URL string. */
export function hostnameOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** The "site" used as a cookie partition key: scheme://eTLD+1 */
export function topLevelSite(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${registrableDomain(u.hostname)}`;
  } catch {
    return null;
  }
}
