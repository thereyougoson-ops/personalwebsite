// Shared formatting + the vermillion "pressure" color scale.

export const fmtInt = (n) => (n == null ? "—" : Number(n).toLocaleString("en-US"));

export const fmtMoney = (n) =>
  (n == null || Number(n) === 0 ? "—" : "$" + Math.round(Number(n)).toLocaleString("en-US"));

export const fmtDate = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
};

// Sequential scale: pale clay -> municipal vermillion -> oxblood. Input score 0..100.
const STOPS = [
  [0, [231, 169, 129]],
  [40, [209, 122, 63]],
  [70, [191, 59, 34]],
  [100, [143, 36, 21]],
];

export function scoreColor(score) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [a, ca] = STOPS[i];
    const [b, cb] = STOPS[i + 1];
    if (s <= b) {
      const t = (s - a) / (b - a || 1);
      const c = ca.map((v, j) => Math.round(v + (cb[j] - v) * t));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return "rgb(143,36,21)";
}

// MapLibre interpolate expression mirroring the same stops.
export const SCORE_COLOR_EXPR = [
  "interpolate", ["linear"], ["get", "score"],
  0, "rgb(231,169,129)",
  40, "rgb(209,122,63)",
  70, "rgb(191,59,34)",
  100, "rgb(143,36,21)",
];
