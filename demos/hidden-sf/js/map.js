/* map.js — MapLibre map of the 81 POPOS, coloured by access (the duotone).
   No basemap dependency beyond Carto positron (pale, matches the paper).
   cooperativeGestures keeps the page scroll from being trapped (proven to
   coexist with Lenis smooth-scroll). */
import { ACCESS_COLOR_EXPR, accessOf, esc, CATEGORY_ICON } from "./util.js";

let map = null, popup = null, features = [], onCount = null, pending = null, onPick = null;

export function initMap(geojson, opts) {
  opts = opts || {};
  features = (geojson && geojson.features) || [];
  onCount = opts.onCount || null;
  onPick = opts.onPick || null;

  map = new maplibregl.Map({
    container: "map",
    style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    center: [-122.4012, 37.7918],
    zoom: 13.1,
    minZoom: 11,
    maxZoom: 18,
    cooperativeGestures: true,
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 14, maxWidth: "320px", className: "hsf-pop" });

  map.on("load", function () {
    // 3D building massing so the tour's pitch reads as real towers (not a tilted
    // flat map). Uses the basemap's vector building footprints; real heights if
    // the tiles carry render_height, else a sensible default. Ramped in by zoom
    // so it only appears in the close-up tour chapters, never at the overview.
    try {
      map.addLayer({
        id: "buildings-3d", source: "carto", "source-layer": "building", type: "fill-extrusion", minzoom: 13.5,
        paint: {
          "fill-extrusion-color": ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], ["get", "height"], 18], 0, "#dcd3bd", 120, "#cdbf9f"],
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13.5, 0, 15.6, ["coalesce", ["get", "render_height"], ["get", "height"], 18]],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
          "fill-extrusion-opacity": 0.6,
        },
      });
    } catch (e) { /* basemap may lack a building layer */ }

    map.addSource("popos", { type: "geojson", data: geojson });

    // soft halo so single points read on the pale ground
    map.addLayer({
      id: "popos-glow", type: "circle", source: "popos",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 9, 15, 26, 17, 40],
        "circle-color": ACCESS_COLOR_EXPR,
        "circle-opacity": 0.13,
        "circle-blur": 0.7,
      },
    });
    // the point; radius nudges up with the "hidden" score so the obscure ones read bigger
    map.addLayer({
      id: "popos-pt", type: "circle", source: "popos",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"],
          11, ["interpolate", ["linear"], ["get", "hidden"], 0, 4.0, 100, 6.0],
          15, ["interpolate", ["linear"], ["get", "hidden"], 0, 7.5, 100, 11.5]],
        "circle-color": ACCESS_COLOR_EXPR,
        "circle-opacity": 0.94,
        "circle-stroke-width": 1.4,
        "circle-stroke-color": "rgba(26,29,28,0.5)",
      },
    });

    fitToData();

    map.on("mouseenter", "popos-pt", function () { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "popos-pt", function () { map.getCanvas().style.cursor = ""; });
    map.on("click", "popos-pt", function (e) {
      var f = e.features[0];
      openPopup(f.geometry.coordinates.slice(), f.properties);
      if (onPick) onPick(f.properties);
    });

    if (pending) applyFilter(pending);
    else if (onCount) onCount(features.length);
  });

  return {
    flyTo: flyTo, setFilter: applyFilter, flyCamera: flyCamera, overview: overview,
    resize: function () { if (map) map.resize(); },
    get instance() { return map; },
  };
}

function fitToData(duration) {
  var b = new maplibregl.LngLatBounds();
  features.forEach(function (f) { b.extend(f.geometry.coordinates); });
  if (!b.isEmpty()) {
    // reset pitch/bearing in the SAME animation as the fit (a separate easeTo
    // would fight the fitBounds and the tilt would stick).
    map.fitBounds(b, { padding: (window.innerWidth < 760 ? 42 : 96), maxZoom: 15.5, pitch: 0, bearing: 0, duration: duration || 0, essential: true });
  }
}

// cinematic camera move for the scrollytelling tour (no popup; pitch for the
// 3D "look up at the tower" feel on rooftop beats).
export function flyCamera(o) {
  if (!map) return;
  o = o || {};
  map.flyTo({
    center: [o.lng, o.lat], zoom: o.zoom || 16.3, pitch: o.pitch || 0, bearing: o.bearing || 0,
    speed: o.speed || 0.75, curve: 1.5, essential: true,
  });
}

// animated zoom-out to all 81, level pitch/bearing — the tour's closing frame.
export function overview() {
  if (!map) return;
  fitToData(900);
}

function popupHTML(p) {
  var a = accessOf(p.access);
  var icon = CATEGORY_ICON[p.category] || "•";
  var amen = [];
  if (p.has_seating) amen.push("Seating");
  if (p.has_food) amen.push("Food");
  if (p.has_art) amen.push("Art");
  if (p.has_restroom) amen.push("Restroom");
  var status = "";
  if (p.status === "under_construction") status = '<span class="pop-flag">Under construction</span>';
  else if (p.status === "disputed") status = '<span class="pop-flag">Public access disputed</span>';
  return (
    '<div class="pop">' +
      '<div class="pop-kicker"><span class="pop-dot" style="background:' + a.color + '"></span>' +
        esc(a.short) + ' · ' + esc(p.category) + '</div>' +
      '<h3 class="pop-name">' + icon + ' ' + esc(p.name) + '</h3>' +
      (p.address ? '<p class="pop-addr">' + esc(p.address) + '</p>' : '') +
      (p.hours ? '<p class="pop-hours">' + esc(p.hours) + '</p>' : '') +
      (amen.length ? '<p class="pop-amen">' + amen.map(esc).join(' · ') + '</p>' : '') +
      status +
    '</div>'
  );
}

function openPopup(coords, props) {
  if (!map) return;
  popup.setLngLat(coords).setHTML(popupHTML(props)).addTo(map);
}

export function flyTo(lng, lat, props) {
  if (!map) return;
  map.flyTo({ center: [lng, lat], zoom: 16, speed: 1.2, curve: 1.4, essential: true });
  openPopup([lng, lat], props);
}

// Filter on category / access / amenity; count from the raw array first so the
// UI readout never stalls on map readiness.
export function applyFilter(f) {
  f = f || {};
  var match = function (p) {
    if (f.category && f.category !== "all" && p.category !== f.category) return false;
    if (f.access && f.access !== "all" && p.access !== f.access) return false;
    if (f.amenity === "food" && !p.has_food) return false;
    if (f.amenity === "art" && !p.has_art) return false;
    if (f.amenity === "restroom" && !p.has_restroom) return false;
    if (f.amenity === "seating" && !p.has_seating) return false;
    if (f.openNow === true && p.access !== "always") return false;
    return true;
  };
  var n = 0;
  features.forEach(function (ft) { if (match(ft.properties)) n++; });
  if (onCount) onCount(n);

  if (!map || !map.getLayer("popos-pt")) { pending = f; return; }
  var expr = ["all"];
  if (f.category && f.category !== "all") expr.push(["==", ["get", "category"], f.category]);
  if (f.access && f.access !== "all") expr.push(["==", ["get", "access"], f.access]);
  if (f.amenity === "food") expr.push(["==", ["get", "has_food"], true]);
  if (f.amenity === "art") expr.push(["==", ["get", "has_art"], true]);
  if (f.amenity === "restroom") expr.push(["==", ["get", "has_restroom"], true]);
  if (f.amenity === "seating") expr.push(["==", ["get", "has_seating"], true]);
  if (f.openNow === true) expr.push(["==", ["get", "access"], "always"]);
  var filt = expr.length > 1 ? expr : null;
  map.setFilter("popos-pt", filt);
  map.setFilter("popos-glow", filt);
}
