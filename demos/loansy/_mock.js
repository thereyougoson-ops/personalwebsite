/* Static mock layer for the REAL Loansy Flask admin dashboard (server-rendered Jinja +
   client-side fetch/XHR for charts & feeds). The dashboard HTML is baked server-side, so the
   page is fully populated on load; this layer only serves the handful of /api/* calls the page
   JS makes after load (charts, activity feed, notifications, telemetry) from baked JSON snapshots
   under /demos/loansy/api/. Any other /api/* call gets a benign empty 200 so nothing 404s,
   throws, or spams the console. No backend, no secrets. */
(function () {
  "use strict";

  var BASE = "/demos/loansy/api/";

  /* known GET endpoints -> baked JSON file (match by pathname; query string ignored) */
  var MAP = {
    "/api/dashboard/metrics": "dashboard_metrics.json",
    "/api/dashboard/trends": "dashboard_trends.json",
    "/api/dashboard/activity": "dashboard_activity.json",
    "/api/members/score-distribution": "members_score_distribution.json",
    "/api/analytics": "analytics.json",
    "/api/risk/alerts": "risk_alerts.json",
    "/api/admin/notifications/unread-count": "notifications_unread_count.json"
  };

  /* synthetic live-activity feed (the baked endpoint returns [] because seed dates fall outside
     the live window; a few believable items make the panel look alive) */
  function nowLabel(minAgo) {
    if (minAgo < 1) return "just now";
    if (minAgo < 60) return minAgo + "m ago";
    var h = Math.floor(minAgo / 60);
    return h + "h ago";
  }
  var ACTIVITY = [
    { time_label: nowLabel(2),   event_type: "loan_repaid",   description: "Loan #LN-2291 marked <b>repaid</b> — $420.00 (borrower @beck14)" },
    { time_label: nowLabel(11),  event_type: "loan_created",  description: "New loan request — $250.00 from @cryptoria8 to @whale21" },
    { time_label: nowLabel(23),  event_type: "member_joined", description: "New member verified — @nashtrader37 (Silver tier)" },
    { time_label: nowLabel(38),  event_type: "loan_overdue",  description: "Loan #LN-2274 flagged <b>overdue</b> — $1,000.00 (borrower @ghostwlt5)" },
    { time_label: nowLabel(54),  event_type: "payout",        description: "Affiliate payout processed — $128.40 to @dredfox12" },
    { time_label: nowLabel(72),  event_type: "loan_repaid",   description: "Loan #LN-2260 marked <b>repaid</b> — $600.00 (borrower @mara9)" },
    { time_label: nowLabel(96),  event_type: "loan_created",  description: "New loan request — $120.00 from @silentj3 to @lunaaa18" },
    { time_label: nowLabel(140), event_type: "member_joined", description: "New member verified — @kovi41 (Gold tier)" }
  ];

  function pathOf(url) {
    try { return new URL(url, location.origin).pathname; }
    catch (e) { return String(url).split("?")[0]; }
  }

  /* resolve a request to a static JSON payload (or a benign default). returns a Promise<object|array>. */
  function resolveBody(method, url) {
    var p = pathOf(url);
    method = (method || "GET").toUpperCase();

    /* activity feed: serve synthetic items so the panel isn't empty */
    if (p === "/api/dashboard/activity") return Promise.resolve(ACTIVITY);

    /* baked GET snapshots */
    if (method === "GET" && MAP[p]) {
      return fetch(BASE + MAP[p]).then(function (r) { return r.json(); });
    }

    /* writes (telemetry beacons, acknowledge, mark-seen, mark-paid, etc.) -> accept silently */
    if (method !== "GET") return Promise.resolve({ ok: true });

    /* unknown read of /api/* -> benign empty payload (object or list). guess list for plural-ish. */
    if (p.indexOf("/api/") === 0) {
      if (/notifications(\/?$|\?)/.test(p) || /(list|recent|alerts|history|feed|members|loans)/.test(p))
        return Promise.resolve([]);
      return Promise.resolve({ ok: true });
    }
    return null; /* not an API call -> let it through to the real (static) server */
  }

  /* ---------- fetch() interception ---------- */
  var _fetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = (typeof input === "string") ? input : (input && input.url) || "";
    var method = (init && init.method) || (input && input.method) || "GET";
    var body = resolveBody(method, url);
    if (body) {
      return body.then(function (obj) {
        return new Response(JSON.stringify(obj), {
          status: 200, headers: { "Content-Type": "application/json" }
        });
      });
    }
    return _fetch ? _fetch(input, init) : Promise.reject(new Error("fetch unavailable"));
  };

  /* ---------- XMLHttpRequest interception (telemetry-logger.js, telemetry.js use XHR) ---------- */
  var XHR = window.XMLHttpRequest;
  if (XHR) {
    var _open = XHR.prototype.open;
    var _send = XHR.prototype.send;
    XHR.prototype.open = function (method, url) {
      this.__mockMethod = method; this.__mockUrl = url;
      this.__mockBody = resolveBody(method, url);
      if (this.__mockBody) { this.__mocked = true; return; }
      return _open.apply(this, arguments);
    };
    XHR.prototype.send = function () {
      var xhr = this;
      if (!xhr.__mocked) return _send.apply(this, arguments);
      xhr.__mockBody.then(function (obj) {
        var text = JSON.stringify(obj);
        try {
          Object.defineProperty(xhr, "readyState", { value: 4, configurable: true });
          Object.defineProperty(xhr, "status", { value: 200, configurable: true });
          Object.defineProperty(xhr, "responseText", { value: text, configurable: true });
          Object.defineProperty(xhr, "response", { value: text, configurable: true });
        } catch (e) {}
        if (typeof xhr.onreadystatechange === "function") xhr.onreadystatechange();
        if (typeof xhr.onload === "function") xhr.onload();
        xhr.dispatchEvent(new Event("readystatechange"));
        xhr.dispatchEvent(new Event("load"));
        xhr.dispatchEvent(new Event("loadend"));
      });
    };
  }

  /* ---------- navigator.sendBeacon (telemetry POSTs use it; static server rejects POST) ---------- */
  try {
    if (navigator && typeof navigator.sendBeacon === "function") {
      var _beacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function (url) {
        var p = pathOf(String(url || ""));
        if (p.indexOf("/api/") === 0) return true; // accept & drop — no real backend
        return _beacon.apply(navigator, arguments);
      };
    }
  } catch (e) {}

  /* ---------- silence any leftover WebSocket attempts (none expected, but safe) ---------- */
  try {
    var _WS = window.WebSocket;
    if (_WS) {
      window.WebSocket = function () {
        return { close: function () {}, send: function () {}, addEventListener: function () {},
                 removeEventListener: function () {}, readyState: 3 };
      };
    }
  } catch (e) {}
})();
