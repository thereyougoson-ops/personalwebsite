/* map.js — MapLibre GL map of SF filming locations.
   Dark "dark-matter" basemap; one circle layer colored by decade. Exposes a
   small API (decade filter, title filter, flyTo) the app wires to the UI.
   cooperativeGestures keeps plain wheel scrolling the page past the map. */

// Chronological ramp: silver-screen cool -> technicolor warm -> modern gold.
export const DECADE_COLORS = {
  1910: "#7f8a99", 1920: "#8f93a0", 1930: "#a59f8c", 1940: "#bfa173",
  1950: "#d4a85a", 1960: "#e0a648", 1970: "#eca043", 1980: "#f2903a",
  1990: "#ef7a3f", 2000: "#e85d3f", 2010: "#dd4338", 2020: "#cf2e54",
};

const HOME = { center: [-122.4194, 37.7905], zoom: 11.6 };

let map, geo, onSelect;

function colorExpr() {
  const m = ["match", ["get", "decade"]];
  for (const [d, c] of Object.entries(DECADE_COLORS)) m.push(Number(d), c);
  m.push("#6b6b72"); // fallback (unknown year)
  return m;
}

export function initMap(geojson, opts = {}) {
  geo = geojson;
  onSelect = opts.onSelect || (() => {});

  map = new maplibregl.Map({
    container: "map",
    style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    center: HOME.center,
    zoom: HOME.zoom,
    minZoom: 10,
    maxZoom: 18,
    cooperativeGestures: true,
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

  map.on("load", () => {
    map.addSource("locations", { type: "geojson", data: geo });

    // soft glow underlay
    map.addLayer({
      id: "loc-glow", type: "circle", source: "locations",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4, 13, 9, 16, 18],
        "circle-color": colorExpr(),
        "circle-blur": 1, "circle-opacity": 0.22,
      },
    });
    map.addLayer({
      id: "loc", type: "circle", source: "locations",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.2, 13, 4.4, 16, 9],
        "circle-color": colorExpr(),
        "circle-opacity": 0.9,
        "circle-stroke-width": 0.6,
        "circle-stroke-color": "rgba(0,0,0,0.45)",
      },
    });

    for (const id of ["loc", "loc-glow"]) {
      map.on("mouseenter", id, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; });
    }
    map.on("click", "loc", (e) => {
      const f = e.features[0];
      onSelect(f.properties, f.geometry.coordinates);
    });

    if (opts.onLoad) opts.onLoad();
  });

  return api;
}

function setFilter(f) {
  if (!map || !map.getLayer("loc")) return;
  map.setFilter("loc", f);
  map.setFilter("loc-glow", f);
}

const api = {
  // cumulative: show every location in a decade <= maxDecade
  setDecadeMax(maxDecade) {
    setFilter(["<=", ["get", "decade"], maxDecade]);
  },
  showAll() { setFilter(null); },
  setTitle(ti) {
    setFilter(ti == null ? null : ["==", ["get", "ti"], ti]);
  },
  flyTo(coords, zoom = 15) {
    map.flyTo({ center: coords, zoom, speed: 1.2, curve: 1.5, essential: true });
  },
  flyHome() { map.flyTo({ center: HOME.center, zoom: HOME.zoom, speed: 1.1, essential: true }); },
  fitTo(coordsList) {
    if (!coordsList.length) return;
    const b = new maplibregl.LngLatBounds(coordsList[0], coordsList[0]);
    coordsList.forEach((c) => b.extend(c));
    map.fitBounds(b, { padding: { top: 80, bottom: 140, left: 80, right: 80 }, maxZoom: 15, duration: 900 });
  },
  get instance() { return map; },
};
