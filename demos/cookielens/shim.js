/* CookieLens demo — in-memory chrome.* shim.
 *
 * Classic script, loaded BEFORE the popup.js module (which is deferred), so
 * `chrome` exists when the module's top-level code (e.g. the
 * chrome.runtime.onMessage.addListener at popup.js:1156) and DOMContentLoaded
 * handlers run. Every API is a graceful no-op backed by an in-memory store —
 * NOTHING touches a real browser. This is a captured-run demo.
 */
(function () {
  "use strict";
  window.__CL_DEMO = true;

  // In-memory chrome.storage.local backing object.
  var mem = Object.create(null);

  function pickKeys(keys) {
    var out = {};
    if (keys == null) { for (var k in mem) out[k] = mem[k]; return out; }
    if (typeof keys === "string") keys = [keys];
    if (Array.isArray(keys)) {
      keys.forEach(function (k) { if (k in mem) out[k] = mem[k]; });
      return out;
    }
    // object form: defaults
    Object.keys(keys).forEach(function (k) { out[k] = (k in mem) ? mem[k] : keys[k]; });
    return out;
  }

  var storageLocal = {
    get: function (keys) { return Promise.resolve(pickKeys(keys)); },
    set: function (obj) { Object.keys(obj || {}).forEach(function (k) { mem[k] = obj[k]; }); return Promise.resolve(); },
    remove: function (keys) {
      (Array.isArray(keys) ? keys : [keys]).forEach(function (k) { delete mem[k]; });
      return Promise.resolve();
    },
    clear: function () { for (var k in mem) delete mem[k]; return Promise.resolve(); },
  };

  // runtime.sendMessage — the popup asks the (absent) service worker for tab
  // state, reports, blocking toggles, etc. Resolve sensible empty/affirmative
  // shapes so the popup never hangs and toggles register as "on".
  function sendMessage(msg) {
    var type = msg && msg.type;
    switch (type) {
      case "getTabState":      return Promise.resolve({ trackers: [], syncEdges: [], fp: [] });
      case "getReport":        return Promise.resolve({ report: null });
      case "getSavedReport":   return Promise.resolve({ report: null });
      case "listSavedReports": return Promise.resolve({ list: [] });
      case "setBlocking":      return Promise.resolve({ ok: true });
      case "setAutoClear":     return Promise.resolve({ ok: true });
      case "runAutoClearNow":  return Promise.resolve({ removed: 0, kept: 0, demo: true });
      default:                 return Promise.resolve({});
    }
  }

  window.chrome = {
    runtime: {
      id: "cookielens-demo",
      lastError: null,
      sendMessage: sendMessage,
      onMessage: { addListener: function () {}, removeListener: function () {} },
      getURL: function (p) { return p; },
    },
    storage: {
      local: storageLocal,
      onChanged: { addListener: function () {}, removeListener: function () {} },
    },
    tabs: {
      // The demo driver never goes through scan(); these exist only so any stray
      // call resolves instead of throwing.
      get: function () { return Promise.resolve(null); },
      query: function () { return Promise.resolve([]); },
      create: function () { return Promise.resolve({}); },
    },
    cookies: {
      getAll: function () { return Promise.resolve([]); },
      remove: function () { return Promise.resolve(null); },
    },
    scripting: {
      executeScript: function () { return Promise.resolve([]); },
    },
    alarms: { create: function () {}, onAlarm: { addListener: function () {} } },
  };
})();
