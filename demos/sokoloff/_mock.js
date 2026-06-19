/* demos/sokoloff/_mock.js — intercept the base44 cloud auth probe so the embedded
   gallery loads fully same-origin, with no external network call and no secrets.
   The real app treats an unauthenticated visitor (401) as an anonymous public viewer,
   which is exactly the embed's intent. Loaded FIRST in <head>, before the app bundle. */
(function () {
  "use strict";
  var EXT = /(^https?:)?\/\/[^/]*base44\.app\//i;

  // The app logs an expected "anonymous" notice for logged-out (public) viewers —
  // that's exactly the embed's intent, so keep that one benign line out of the console.
  if (typeof console !== "undefined" && console.error) {
    var realErr = console.error.bind(console);
    console.error = function () {
      var first = arguments.length ? String(arguments[0]) : "";
      if (/App state check failed|Base44Error: anonymous/i.test(first)) return;
      return realErr.apply(console, arguments);
    };
  }

  function anon() {
    // Synthetic 401 — preserves the app's "anonymous public viewer" code path,
    // with zero network traffic (so no console error, works offline).
    return new Response('{"detail":"anonymous"}', {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  // --- fetch ---
  if (typeof window.fetch === "function") {
    var realFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = (typeof input === "string") ? input : (input && input.url) || "";
      if (EXT.test(url)) return Promise.resolve(anon());
      return realFetch(input, init);
    };
  }

  // --- XMLHttpRequest (covers axios/SDK XHR transport) ---
  var RealXHR = window.XMLHttpRequest;
  if (RealXHR) {
    var open = RealXHR.prototype.open;
    var send = RealXHR.prototype.send;
    RealXHR.prototype.open = function (method, url) {
      this.__sokoExt = EXT.test(String(url || ""));
      return open.apply(this, arguments);
    };
    RealXHR.prototype.send = function () {
      if (!this.__sokoExt) return send.apply(this, arguments);
      var xhr = this;
      setTimeout(function () {
        Object.defineProperty(xhr, "readyState", { value: 4, configurable: true });
        Object.defineProperty(xhr, "status", { value: 401, configurable: true });
        Object.defineProperty(xhr, "responseText", { value: '{"detail":"anonymous"}', configurable: true });
        Object.defineProperty(xhr, "response", { value: '{"detail":"anonymous"}', configurable: true });
        if (typeof xhr.onreadystatechange === "function") xhr.onreadystatechange();
        if (typeof xhr.onload === "function") xhr.onload();
        xhr.dispatchEvent(new Event("readystatechange"));
        xhr.dispatchEvent(new Event("load"));
        xhr.dispatchEvent(new Event("loadend"));
      }, 0);
    };
  }
})();
