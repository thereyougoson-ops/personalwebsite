// Botanical genus palette + shared helpers.
// A calm green spectrum, differentiated by genus, with a few living accents
// (cherry-blossom plum-pink, magnolia cream, coral, madrone terracotta, olive silver).

export const GENUS_COLORS = {
  Prunus:        "#d08fad", // cherry / plum blossom — plum-pink
  Magnolia:      "#e6d6ad", // southern magnolia — warm cream
  Platanus:      "#93a05a", // London plane — sage
  Metrosideros:  "#d2694e", // NZ Christmas — coral
  Arbutus:       "#bd7a44", // madrone / strawberry — terracotta
  Olea:          "#9fae93", // olive — silver-sage
  Eucalyptus:    "#a7b8ab", // silver eucalyptus
  Ficus:         "#1f5f44", // banyan — deep laurel
  Pittosporum:   "#2f6b4a", // victorian box — deep green
  Lophostemon:   "#43815a", // brisbane box — fern
  Tristaniopsis: "#6f9a5b", // small-leaf tristania — leaf green
  Pyrus:         "#aac17e", // pear — pale green
  Acacia:        "#c4b15a", // acacia — gold-green
  Callistemon:   "#b85d49", // bottlebrush — red-bronze
  Quercus:       "#5c7b3f", // oak
  Ulmus:         "#6f8f4f", // elm
};
export const COLOR_OTHER = "#7f9270";       // muted sage for the long tail
export const COLOR_UNRECORDED = "#9aa089";  // grey-green for unidentified

export function colorForGenus(name) {
  if (name === "Unrecorded") return COLOR_UNRECORDED;
  return GENUS_COLORS[name] || COLOR_OTHER;
}

// MapLibre 'match' expression: genus index (feature property 'g') -> color.
export function genusColorExpr(meta) {
  const stops = [];
  meta.genera.forEach((g, i) => { stops.push(i, colorForGenus(g.name)); });
  return ["match", ["get", "g"], ...stops, COLOR_OTHER];
}

export const fmtInt = (n) => (n == null ? "—" : Number(n).toLocaleString("en-US"));

// "Sycamore: London Plane" -> "London Plane" (prefer the friendliest common label)
export function prettyCommon(common) {
  if (!common) return "";
  const parts = common.split(":").map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] || common;
}
