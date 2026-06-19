/* demos/stakeodds/_mock.js — keep the #demo board self-contained when embedded same-origin.
   The tracker's poller/heartbeat hit absolute backend routes by design ("404 harmlessly"
   per the source); served from the portfolio root those become real 404/501 network errors
   that bubble into the parent console. This layer reproduces the SAME outcomes synthetically
   (no network) so the demo behaves identically — latest.json still "fails" → demo mode stays —
   with a clean console. Loaded FIRST in <head>, before the app script. No data, no secrets. */
(function () {
  "use strict";
  function pathOf(u) { try { return new URL(u, location.href).pathname; } catch (e) { return String(u || ""); } }
  function is(p, frag) { return p.indexOf(frag) === 0 || p.indexOf(frag) !== -1; }

  // routes the app polls; mirror what the real backend would have returned
  function synth(url) {
    var p = pathOf(url);
    // live data feed: absent on a static host -> 404 keeps the app in #demo mode (its designed path)
    if (p.indexOf("/data/latest") !== -1)
      return new Response('{"error":"no live feed"}', { status: 404, headers: { "Content-Type": "application/json" } });
    // selection history: empty list (the app labels its follow-rate "~live" when absent)
    if (p.indexOf("/history/selection") !== -1)
      return new Response('[]', { status: 200, headers: { "Content-Type": "application/json" } });
    // heartbeat / teardown beacons: accept & drop
    if (p.indexOf("/alive") !== -1 || p.indexOf("/bye") !== -1)
      return new Response("ok", { status: 200 });
    return null;
  }

  if (typeof window.fetch === "function") {
    var real = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = (typeof input === "string") ? input : (input && input.url) || "";
      var r = synth(url);
      return r ? Promise.resolve(r) : real(input, init);
    };
  }

  // heartbeat uses a keepalive beacon on unload
  try {
    if (navigator && typeof navigator.sendBeacon === "function") {
      var beacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function (url) {
        var p = pathOf(String(url || ""));
        if (p.indexOf("/alive") !== -1 || p.indexOf("/bye") !== -1) return true;
        return beacon.apply(navigator, arguments);
      };
    }
  } catch (e) {}
})();
