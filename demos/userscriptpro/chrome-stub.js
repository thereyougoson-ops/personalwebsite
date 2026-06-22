/* chrome-stub.js — classic <script> (runs during parse, BEFORE the ES module).
 *
 * An in-memory shim for the MV3 extension APIs the UserScriptPro options SPA
 * touches at runtime: chrome.storage.local/session (+ onChanged),
 * chrome.runtime (sendMessage/onMessage/id/getURL), and inert stubs for
 * tabs / permissions / offscreen / alarms / userScripts.
 *
 * The store layer (src/store/storageSync.ts) hydrates the whole React app from
 * chrome.storage.local.get(null) + chrome.storage.session.get([...]); seeding
 * those areas from window.__USP_SEED__ makes the REAL bundle render the REAL
 * seeded scripts, trust reports, time-travel timeline, GM feed and network log.
 *
 * No real userScripts/storage/network ever runs — this is a static showcase.
 */
(function () {
  'use strict';

  var SEED = window.__USP_SEED__ || { local: {}, session: {} };

  function clone(v) {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }

  function makeArea(initial) {
    var data = clone(initial) || {};
    var listeners = [];

    function pick(keys) {
      var out = {};
      if (keys === null || keys === undefined) {
        for (var k in data) out[k] = clone(data[k]);
      } else if (typeof keys === 'string') {
        if (k_in(keys)) out[keys] = clone(data[keys]);
      } else if (Array.isArray(keys)) {
        keys.forEach(function (key) { if (k_in(key)) out[key] = clone(data[key]); });
      } else if (typeof keys === 'object') {
        // { key: default } form
        for (var dk in keys) out[dk] = k_in(dk) ? clone(data[dk]) : keys[dk];
      }
      return out;
    }
    function k_in(key) { return Object.prototype.hasOwnProperty.call(data, key); }

    function fireChanged(changes) {
      if (!Object.keys(changes).length) return;
      listeners.forEach(function (cb) {
        try { cb(changes, AREA_NAME); } catch (e) { /* swallow */ }
      });
      // mirror to the global chrome.storage.onChanged bus
      globalChanged.forEach(function (cb) {
        try { cb(changes, AREA_NAME); } catch (e) { /* swallow */ }
      });
    }

    var AREA_NAME = 'local';
    var globalChanged = [];

    var area = {
      get: function (keys, cb) {
        var res = pick(keys);
        if (typeof keys === 'function') { res = pick(null); cb = keys; }
        if (cb) { cb(res); return; }
        return Promise.resolve(res);
      },
      set: function (items, cb) {
        var changes = {};
        for (var key in items) {
          var oldValue = clone(data[key]);
          data[key] = clone(items[key]);
          changes[key] = { oldValue: oldValue, newValue: clone(items[key]) };
        }
        fireChanged(changes);
        if (cb) { cb(); return; }
        return Promise.resolve();
      },
      remove: function (keys, cb) {
        var arr = Array.isArray(keys) ? keys : [keys];
        var changes = {};
        arr.forEach(function (key) {
          if (k_in(key)) { changes[key] = { oldValue: clone(data[key]), newValue: undefined }; delete data[key]; }
        });
        fireChanged(changes);
        if (cb) { cb(); return; }
        return Promise.resolve();
      },
      clear: function (cb) {
        var changes = {};
        for (var key in data) changes[key] = { oldValue: clone(data[key]), newValue: undefined };
        data = {};
        fireChanged(changes);
        if (cb) { cb(); return; }
        return Promise.resolve();
      },
      onChanged: {
        addListener: function (cb) { listeners.push(cb); },
        removeListener: function (cb) { listeners = listeners.filter(function (x) { return x !== cb; }); },
        hasListener: function (cb) { return listeners.indexOf(cb) !== -1; },
      },
      __name: function (n) { AREA_NAME = n; },
      __globalBus: function (bus) { globalChanged = bus; },
    };
    return area;
  }

  // shared onChanged bus across local + session (chrome.storage.onChanged)
  var globalChangedListeners = [];

  var local = makeArea(SEED.local);
  var session = makeArea(SEED.session);
  local.__name('local'); session.__name('session');
  local.__globalBus(globalChangedListeners); session.__globalBus(globalChangedListeners);

  function noopEvent() {
    return { addListener: function () {}, removeListener: function () {}, hasListener: function () { return false; } };
  }

  var chrome = window.chrome || {};

  chrome.storage = {
    local: local,
    session: session,
    sync: makeArea({}),
    onChanged: {
      addListener: function (cb) { globalChangedListeners.push(cb); },
      removeListener: function (cb) { var i = globalChangedListeners.indexOf(cb); if (i !== -1) globalChangedListeners.splice(i, 1); },
      hasListener: function (cb) { return globalChangedListeners.indexOf(cb) !== -1; },
    },
  };

  chrome.runtime = {
    id: 'userscriptpro-demo',
    // The options SPA's sendOp() tolerates a failed/empty response — domain
    // mutations are no-ops in the static demo (read-only showcase).
    sendMessage: function (msg, cb) {
      var res = { ok: false, error: 'demo: background service worker not available (static showcase)' };
      if (cb) { cb(res); return; }
      return Promise.resolve(res);
    },
    onMessage: noopEvent(),
    onInstalled: noopEvent(),
    onConnect: noopEvent(),
    connect: function () { return { postMessage: function () {}, onMessage: noopEvent(), onDisconnect: noopEvent(), disconnect: function () {} }; },
    getURL: function (p) { return new URL(p, location.href).href; },
    getManifest: function () { return { version: '1.0.0', name: 'UserScriptPro' }; },
    lastError: undefined,
  };

  chrome.tabs = {
    create: function (opts, cb) { if (opts && opts.url) window.open(opts.url, '_blank'); if (cb) cb({}); return Promise.resolve({}); },
    query: function (_q, cb) { var r = []; if (cb) { cb(r); return; } return Promise.resolve(r); },
    update: function (_id, _opts, cb) { if (cb) cb({}); return Promise.resolve({}); },
    sendMessage: function (_id, _msg, cb) { if (cb) cb(undefined); return Promise.resolve(undefined); },
    onUpdated: noopEvent(),
    onRemoved: noopEvent(),
  };

  chrome.permissions = {
    contains: function (_p, cb) { if (cb) { cb(true); return; } return Promise.resolve(true); },
    request: function (_p, cb) { if (cb) { cb(true); return; } return Promise.resolve(true); },
    getAll: function (cb) { var r = { permissions: [], origins: ['*://*/*'] }; if (cb) { cb(r); return; } return Promise.resolve(r); },
    onAdded: noopEvent(),
    onRemoved: noopEvent(),
  };

  chrome.offscreen = {
    createDocument: function () { return Promise.resolve(); },
    closeDocument: function () { return Promise.resolve(); },
    hasDocument: function () { return Promise.resolve(false); },
  };

  chrome.alarms = {
    create: function () {}, clear: function (cb) { if (cb) cb(true); return Promise.resolve(true); },
    clearAll: function (cb) { if (cb) cb(true); return Promise.resolve(true); },
    get: function (_n, cb) { if (cb) cb(undefined); return Promise.resolve(undefined); },
    getAll: function (cb) { if (cb) cb([]); return Promise.resolve([]); },
    onAlarm: noopEvent(),
  };

  chrome.userScripts = {
    register: function () { return Promise.resolve(); },
    unregister: function () { return Promise.resolve(); },
    update: function () { return Promise.resolve(); },
    getScripts: function () { return Promise.resolve([]); },
    configureWorld: function () { return Promise.resolve(); },
  };

  chrome.scripting = { executeScript: function () { return Promise.resolve([]); } };
  chrome.notifications = { create: function () {}, clear: function () {}, onClicked: noopEvent() };
  chrome.action = { setBadgeText: function () { return Promise.resolve(); }, setBadgeBackgroundColor: function () { return Promise.resolve(); }, setTitle: function () { return Promise.resolve(); } };
  chrome.webNavigation = { onCommitted: noopEvent(), onCompleted: noopEvent() };
  chrome.cookies = { getAll: function (_q, cb) { var r = []; if (cb) { cb(r); return; } return Promise.resolve(r); } };
  chrome.downloads = { download: function (_o, cb) { if (cb) cb(0); return Promise.resolve(0); } };
  chrome.windows = { create: function (_o, cb) { if (cb) cb({}); return Promise.resolve({}); } };

  window.chrome = chrome;
  // WXT's `browser` polyfill alias
  window.browser = chrome;
})();
