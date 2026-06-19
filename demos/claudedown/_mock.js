/* Static mock layer for ClaudeDown — intercepts the real app's /api/* calls and returns
   generated-but-believable data so the REAL frontend renders fully with no backend/DB.
   Timestamps are always relative to Date.now() (filteredHistory() drops anything older than
   now - range, so baked timestamps => empty charts). Always returns 200 (never 304). */
(function () {
  "use strict";
  function iso(t) { return new Date(t).toISOString(); }
  function jit(base, amp) { return Math.max(20, Math.round(base + (Math.random() - 0.5) * amp)); }

  var PROVIDERS = [
    { id: "openai", label: "OpenAI" }, { id: "gemini", label: "Gemini" },
    { id: "github", label: "GitHub" }, { id: "cursor", label: "Cursor" },
    { id: "groq", label: "Groq" }, { id: "cohere", label: "Cohere" },
    { id: "azure", label: "Azure OpenAI" }, { id: "replicate", label: "Replicate" },
    { id: "vercel", label: "Vercel" }, { id: "cloudflare", label: "Cloudflare" }
  ];
  var DEGRADED_IX = 4; // one provider (Groq) shows a realistic degradation

  function endpoints() {
    var names = ["Messages API", "Console", "api.anthropic.com", "Workbench",
      "Token counting", "Batches API", "Files API", "Models API"];
    var o = {};
    names.forEach(function (n) { o[n] = { ok: true, latency_ms: jit(280, 120), name: n, error: null }; });
    return o;
  }
  function snapshot() {
    return {
      polled_at_utc: iso(Date.now()), interval_seconds: 15,
      meta: { app: "ClaudeDown", version: "1.0.0" },
      summary: {
        overall_indicator: "none", overall_description: "All Systems Operational",
        claude_api_status: "operational", unresolved_incidents: 0, active_maintenances: 0,
        upcoming_maintenances: 0, degraded_components: 0, endpoint_errors: 0
      },
      components: [
        { name: "Claude API", status: "operational" },
        { name: "Console (claude.ai)", status: "operational" },
        { name: "api.anthropic.com", status: "operational" }
      ],
      unresolved_incidents: [], active_maintenances: [], upcoming_maintenances: [],
      endpoints: endpoints()
    };
  }
  function provider(p, i) {
    var deg = i === DEGRADED_IX;
    return {
      provider_id: p.id, label: p.label, probed_at: iso(Date.now()),
      edge_signal: deg ? "fail" : "ok", edge_latency_ms: jit(deg ? 880 : 230, 140),
      status_page_signal: deg ? "degraded" : "operational",
      verdict: deg ? "degraded" : "up", confidence: "high",
      verdict_label: deg ? "Degraded" : "Operational",
      incidents: deg ? [{
        id: "inc-1", name: "Elevated error rates", status: "monitoring", impact: "minor",
        shortlink: "#", updated_at: iso(Date.now() - 18 * 60000), created_at: iso(Date.now() - 52 * 60000)
      }] : []
    };
  }
  function statusHistory(n, stepMs) {
    var rows = [], t = Date.now() - (n - 1) * stepMs;
    for (var i = 0; i < n; i++) {
      rows.push({
        t: iso(t), ok: true, indicator: "none", description: "All Systems Operational",
        api: "operational", unresolved: 0, degraded: 0, endpointErrors: 0, endpointTotal: 8,
        avgLatency: jit(300, 110), deployId: "edb48aa"
      });
      t += stepMs;
    }
    return rows;
  }
  function providerHistory(i, n, stepMs) {
    var deg = i === DEGRADED_IX, rows = [], t = Date.now() - (n - 1) * stepMs;
    for (var k = 0; k < n; k++) {
      var bad = deg && k > n - 18;
      rows.push({
        probed_at: iso(t), edge_signal: bad ? "fail" : "ok",
        edge_latency_ms: jit(bad ? 760 : (deg ? 360 : 230), 170),
        status_page_signal: bad ? "degraded" : "operational",
        verdict: bad ? "degraded" : "up", confidence: "high"
      });
      t += stepMs;
    }
    return rows;
  }
  function dashboard(rangeHours) {
    var n = 120, step = Math.max(15000, Math.round((rangeHours * 3600000) / n));
    var ph = {};
    PROVIDERS.forEach(function (p, i) {
      ph[p.id] = {
        rows: providerHistory(i, n, step), hours: rangeHours, aggregated: false,
        bucket_seconds: step / 1000, resolution_seconds: step / 1000,
        data_tier: "live", points_in_range: n, points_returned: n
      };
    });
    return {
      snapshot: snapshot(), providers: PROVIDERS.map(provider),
      enabled: PROVIDERS.map(function (p) { return p.id; }),
      range_hours: rangeHours, fetched_at_utc: iso(Date.now()),
      history: { rows: statusHistory(n, step) }, provider_histories: ph
    };
  }

  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  function J(obj) {
    return new Response(JSON.stringify(obj), { status: 200, headers: { "content-type": "application/json" } });
  }
  window.fetch = function (input, init) {
    var url = (typeof input === "string") ? input : (input && input.url) || "";
    try {
      var u = new URL(url, location.href), path = u.pathname, q = u.searchParams;
      if (path === "/api/dashboard") return Promise.resolve(J(dashboard(+q.get("range_hours") || 1)));
      if (path === "/api/status") return Promise.resolve(J(snapshot()));
      if (path === "/api/providers") return Promise.resolve(J(PROVIDERS.map(provider)));
      if (path === "/api/status/history") return Promise.resolve(J({ rows: statusHistory(200, 30000) }));
      var m = path.match(/^\/api\/providers\/([^/]+)\/history$/);
      if (m) { var i = PROVIDERS.findIndex(function (p) { return p.id === m[1]; }); return Promise.resolve(J({ rows: providerHistory(i < 0 ? 0 : i, 120, 30000) })); }
      m = path.match(/^\/api\/providers\/([^/]+)\/incidents$/);
      if (m) return Promise.resolve(J({ incidents: [] }));
      if (path === "/api/meta") return Promise.resolve(J({ app: "ClaudeDown", version: "1.0.0", mock: true }));
      if (path === "/health") return Promise.resolve(J({ ok: true }));
    } catch (e) { /* fall through */ }
    return realFetch ? realFetch(input, init) : Promise.reject(new Error("offline"));
  };
})();
