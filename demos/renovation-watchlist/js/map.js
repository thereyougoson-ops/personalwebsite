// MapLibre GL map of flagged parcels. Exposes flyTo + setFilter to the app.
import { fmtInt, fmtMoney, fmtDate, SCORE_COLOR_EXPR } from "./util.js";

let map, popup, features, onCount, pendingFilter;

export function initMap(geojson, opts = {}) {
  features = geojson.features;
  onCount = opts.onCount || (() => {});

  map = new maplibregl.Map({
    container: "map",
    style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    center: [-122.437, 37.765],
    zoom: 11.3,
    minZoom: 10,
    maxZoom: 18,
    cooperativeGestures: true,
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 12, maxWidth: "300px" });

  map.on("load", () => {
    map.addSource("parcels", { type: "geojson", data: geojson });
    map.addLayer({
      id: "parcels",
      type: "circle",
      source: "parcels",
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          10, ["interpolate", ["linear"], ["get", "nov_count"], 1, 2.4, 6, 7],
          15, ["interpolate", ["linear"], ["get", "nov_count"], 1, 5, 6, 17],
        ],
        "circle-color": SCORE_COLOR_EXPR,
        "circle-opacity": 0.82,
        "circle-stroke-width": 1,
        "circle-stroke-color": "rgba(27,26,22,0.5)",
      },
    });
    map.on("mouseenter", "parcels", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "parcels", () => { map.getCanvas().style.cursor = ""; });
    map.on("click", "parcels", (e) => openPopup(e.features[0].geometry.coordinates, e.features[0].properties));
    if (pendingFilter) applyFilter(pendingFilter);
    else onCount(features.length);
  });

  return { flyTo, setFilter: applyFilter, get instance() { return map; } };
}

function popupHTML(p) {
  const samples = p.samples ? `<p class="pop-samples">“${p.samples}”</p>` : "";
  return `
    <p class="pop-rank">Rank #${p.rank} · pressure ${p.score}</p>
    <p class="pop-addr">${p.address || "Unknown address"}</p>
    <p class="pop-nbhd">${p.neighborhood || "—"}</p>
    <div class="pop-grid">
      <div><b>${fmtInt(p.nov_count)}</b><span>permit NOVs</span></div>
      <div><b>${fmtDate(p.last_nov_date)}</b><span>latest</span></div>
      <div><b>${fmtInt(p.units)}</b><span>units</span></div>
      <div><b>${p.year_built || "—"}</b><span>built</span></div>
      <div><b>${fmtMoney(p.assessed_improvement_value)}</b><span>improv. value</span></div>
    </div>${samples}`;
}

function openPopup(coords, props) {
  popup.setLngLat(coords).setHTML(popupHTML(props)).addTo(map);
}

function applyFilter(f) {
  const { neighborhood, minNov, minScore } = f;
  // Count from the data regardless of map readiness so the UI never stalls.
  const n = features.filter((ft) => {
    const p = ft.properties;
    return p.nov_count >= minNov && p.score >= minScore && (!neighborhood || p.neighborhood === neighborhood);
  }).length;
  onCount(n);
  if (map && map.getLayer("parcels")) {
    const expr = ["all", [">=", ["get", "nov_count"], minNov], [">=", ["get", "score"], minScore]];
    if (neighborhood) expr.push(["==", ["get", "neighborhood"], neighborhood]);
    map.setFilter("parcels", expr);
    pendingFilter = null;
  } else {
    pendingFilter = f; // re-applied on map 'load'
  }
}

function flyTo(lng, lat, props) {
  if (!map) return;
  map.flyTo({ center: [lng, lat], zoom: 16, speed: 1.3, curve: 1.5, essential: true });
  openPopup([lng, lat], props); // popup stays anchored to the coords during the fly
}
