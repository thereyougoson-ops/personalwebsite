// The forest map — deck.gl ScatterplotLayer fed straight from the binary typed
// arrays (no GeoJSON, no per-feature objects, no tiling). Year filtering runs on
// the GPU (DataFilterExtension) so the "watch it grow" scrub is buttery; genus /
// species / street filtering recolors a Uint8 alpha column in one pass.
import { colorForGenus, prettyCommon, fmtInt } from "./forest.js";

let deckgl, meta, cols, onCount, viewState, FILTER_EXT;
let positions, colorsBase, colorsCur, yearArr, genusArr, speciesGi, palette;
let colorVer = 0;
const HOME = { longitude: -122.4427, latitude: 37.7566, zoom: 11.4 };
const state = { genus: null, species: null, streetSet: null, year: null, timeline: false };

function hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

export function initMap(trees, metaData, opts = {}) {
  meta = metaData; cols = trees; onCount = opts.onCount || (() => {});
  const N = cols.count;
  speciesGi = meta.species.map((sp) => sp.gi);
  palette = meta.genera.map((g) => hexToRgb(colorForGenus(g.name)));

  positions = new Float32Array(N * 2);
  colorsBase = new Uint8Array(N * 4);
  genusArr = new Uint16Array(N);
  yearArr = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    positions[2 * i] = cols.lng[i];
    positions[2 * i + 1] = cols.lat[i];
    const gi = speciesGi[cols.s[i]];
    genusArr[i] = gi;
    const c = palette[gi] || [140, 150, 130];
    colorsBase[4 * i] = c[0]; colorsBase[4 * i + 1] = c[1]; colorsBase[4 * i + 2] = c[2]; colorsBase[4 * i + 3] = 255;
    yearArr[i] = cols.y[i] || 0;
  }
  colorsCur = colorsBase.slice();
  FILTER_EXT = new deck.DataFilterExtension({ filterSize: 1 });

  viewState = { ...HOME, minZoom: 9.5, maxZoom: 18, pitch: 0, bearing: 0 };

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:100%;height:100%;display:block;outline:none";
  document.getElementById("map").appendChild(canvas);

  deckgl = new deck.Deck({
    canvas,
    views: new deck.MapView({ repeat: false }),
    viewState,
    controller: { scrollZoom: false, dragPan: true, dragRotate: false, doubleClickZoom: true, touchZoom: true, touchRotate: false, keyboard: true },
    pickingRadius: 5,
    useDevicePixels: Math.min(window.devicePixelRatio || 1, 1.5),
    getCursor: ({ isDragging, isHovering }) => (isDragging ? "grabbing" : isHovering ? "pointer" : "grab"),
    onViewStateChange: ({ viewState: vs }) => { viewState = vs; deckgl.setProps({ viewState }); },
    onClick: (info) => { if (info && info.index >= 0 && colorsCur[4 * info.index + 3] !== 0 && opts.onPick) opts.onPick(info.index); },
    layers: buildLayers(),
    onLoad: () => { onCount(N); if (opts.onReady) opts.onReady(); },
  });

  return { flyTo, flyHome, zoom, setGenus, setSpecies, setStreets, setTimeline, reset, searchStreets,
    get instance() { return deckgl; } };
}

function filterRange() {
  // GPU year filter. Default includes undated (0); timeline mode excludes them.
  if (state.timeline && state.year != null) return [1, state.year];
  return [0, 3000];
}

function scatter(id, colors, opacity, useFilter, pickable) {
  const N = cols.count;
  // deck.gl binary attributes live under data.attributes (NOT as top-level accessor props)
  const attributes = {
    getPosition: { value: positions, size: 2 },
    getFillColor: { value: colors, size: 4 },
  };
  if (useFilter) attributes.getFilterValue = { value: yearArr, size: 1 };
  const props = {
    id, data: { length: N, attributes }, pickable,
    radiusUnits: "meters", getRadius: 11, radiusScale: 1, radiusMinPixels: 1.3, radiusMaxPixels: 11,
    opacity, stroked: false, filled: true, antialiasing: true,
    parameters: { depthTest: false },
  };
  if (useFilter) { props.filterRange = filterRange(); props.extensions = [FILTER_EXT]; }
  return new deck.ScatterplotLayer(props);
}

function buildLayers() {
  // Single layer; the GPU year-filter reveals trees as they were planted.
  // (A faint "all trees" base doesn't work — hundreds of overlapping dots
  // saturate dense areas at any opacity and hide the growth.)
  return [scatter("trees", colorsCur, 0.9, true, true)];
}

function refresh() { if (deckgl) deckgl.setProps({ layers: buildLayers() }); onCount(countMatching()); }

function recolor() {
  const N = cols.count, g = state.genus, sp = state.species, ss = state.streetSet;
  const next = new Uint8Array(colorsBase); // fresh reference so deck re-uploads the buffer
  for (let i = 0; i < N; i++) {
    let show = true;
    if (sp != null) show = cols.s[i] === sp;
    else if (g != null) show = genusArr[i] === g;
    if (show && ss) show = ss.has(cols.st[i]);
    if (!show) next[4 * i + 3] = 0;
  }
  colorsCur = next;
  colorVer++;
}

function countMatching() {
  if (!state.timeline && !state.streetSet) {
    if (state.species != null) return meta.species[state.species].count;
    if (state.genus != null) return meta.genera[state.genus].count;
    return cols.count;
  }
  const N = cols.count, ss = state.streetSet;
  let n = 0;
  for (let i = 0; i < N; i++) {
    if (state.species != null && cols.s[i] !== state.species) continue;
    else if (state.genus != null && genusArr[i] !== state.genus) continue;
    if (ss && !ss.has(cols.st[i])) continue;
    if (state.timeline && state.year != null && !(cols.y[i] > 0 && cols.y[i] <= state.year)) continue;
    n++;
  }
  return n;
}

function setGenus(gi) { state.genus = gi; state.species = null; recolor(); refresh(); }
function setSpecies(si) { state.species = si; state.genus = null; recolor(); refresh(); }
function setStreets(idxs) { state.streetSet = idxs && idxs.length ? new Set(idxs) : null; recolor(); refresh(); }
function setTimeline(year, on) { state.timeline = !!on; state.year = year; refresh(); }
function reset() { state.genus = state.species = state.streetSet = state.year = null; state.timeline = false; recolor(); refresh(); flyHome(); }

function searchStreets(q) {
  q = (q || "").toLowerCase().trim();
  if (!q) return [];
  const out = [];
  meta.streets.forEach((name, i) => { if (name.toLowerCase().includes(q)) out.push(i); });
  return out;
}

function flyTo(lng, lat, z = 15) {
  viewState = { ...viewState, longitude: lng, latitude: lat, zoom: z, transitionDuration: 1200, transitionInterpolator: new deck.FlyToInterpolator({ speed: 1.4 }) };
  deckgl.setProps({ viewState });
}
function flyHome() { flyTo(HOME.longitude, HOME.latitude, HOME.zoom); }
function zoom(delta) {
  const z = Math.max(viewState.minZoom, Math.min(viewState.maxZoom, (viewState.zoom || 11) + delta));
  viewState = { ...viewState, zoom: z, transitionDuration: 300 };
  deckgl.setProps({ viewState });
}

export { fmtInt };
