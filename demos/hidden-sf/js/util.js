/* util.js — shared constants, the access duotone (single source of truth used
   by both the map GL expression and the DOM legend/cards), and formatters. */

// The data spine: a POPOS is either yours at all hours, yours only while the
// building is open, or unknown. Brass = always; petrol = business; warm-grey =
// unknown. Keep this and ACCESS_COLOR_EXPR in lockstep.
export const ACCESS = {
  always:   { color: "#b9842b", label: "Open at all times",  short: "Always open" },
  business: { color: "#1f4b54", label: "Business hours only", short: "Business hours" },
  unknown:  { color: "#8a8276", label: "Hours unknown",       short: "Unknown" },
};

// MapLibre paint expression mirroring ACCESS above on ["get","access"].
export const ACCESS_COLOR_EXPR = [
  "match", ["get", "access"],
  "always", ACCESS.always.color,
  "business", ACCESS.business.color,
  /* fallback */ ACCESS.unknown.color,
];

export const CATEGORY_ICON = {
  "Plaza": "▢", "Urban Garden": "❧", "Snippet": "▪", "Indoor Park": "◳",
  "Pedestrian Walkway": "⇄", "Atrium": "◈", "Sun Terrace": "☀", "Urban Park": "❦",
  "Greenhouse": "❋", "View Terrace": "◹", "Terrace": "◹", "Park": "❦", "Other": "•",
};

export function fmtInt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("en-US");
}

export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

export function accessOf(a) { return ACCESS[a] || ACCESS.unknown; }
