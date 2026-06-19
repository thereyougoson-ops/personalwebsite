/* Static mock layer for the REAL FreqUI (Vue SPA, axios/XHR).
   Seeds a logged-in bot (ftAuthLoginInfo) with a far-future-exp JWT so FreqUI boots straight
   to the dashboard, intercepts /api/v1/* at the XHR + fetch layer with believable dry-run data,
   and stubs the WebSocket so FreqUI falls back to REST polling. No backend, no secrets. */
(function () {
  "use strict";

  /* ---------- land the embed straight on the dashboard (client-side, before vue-router boots) ---------- */
  try { if (/\/demos\/freqtrade\/?$/.test(location.pathname)) history.replaceState(null, "", "/demos/freqtrade/dashboard"); } catch (e) {}

  /* ---------- JWT (jwt-decode only base64-decodes; no signature check) ---------- */
  function b64u(o) { return btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_"); }
  function jwt(type) {
    return b64u({ alg: "HS256", typ: "JWT" }) + "." +
      b64u({ exp: 4102444800, iat: 1718000000, nbf: 1718000000, type: type, sub: "freqtrader", identity: { u: "freqtrader" } }) +
      ".s1gn4tur3";
  }
  /* ---------- seed the logged-in bot so onboarding is skipped ---------- */
  try {
    if (!localStorage.getItem("ftAuthLoginInfo")) {
      localStorage.setItem("ftAuthLoginInfo", JSON.stringify({
        "ftbot.0": {
          botName: "hyperliquid-dry-run", apiUrl: location.origin, username: "freqtrader",
          accessToken: jwt("access"), refreshToken: jwt("refresh"), autoRefresh: true, sortId: 0
        }
      }));
    }
  } catch (e) { /* ignore */ }

  /* ---------- believable dry-run dataset ---------- */
  var NOW = Date.now();
  function ago(min) { return new Date(NOW - min * 60000).toISOString(); }
  function ts(min) { return Math.floor((NOW - min * 60000) / 1000); }
  var STAKE = "USDC";
  var OPEN = [
    { id: 1, pair: "BTC/USDC", open: 104812.0, cur: 105140.5, pr: 0.0031, pa: 0.08, m: 54 },
    { id: 2, pair: "ETH/USDC", open: 2538.40, cur: 2488.10, pr: -0.0198, pa: -0.49, m: 131 }
  ];
  var CLOSED = [
    { id: 11, pair: "SOL/USDC", open: 153.82, close: 158.41, pr: 0.0298, pa: 0.75, m: 65, exit: "roi" },
    { id: 12, pair: "HYPE/USDC", open: 38.41, close: 39.06, pr: 0.0169, pa: 0.42, m: 170, exit: "trailing_stop_loss" },
    { id: 13, pair: "ETH/USDC", open: 2571.20, close: 2468.35, pr: -0.0400, pa: -1.00, m: 200, exit: "stop_loss" },
    { id: 14, pair: "BTC/USDC", open: 103060.0, close: 105701.0, pr: 0.0118, pa: 0.30, m: 96, exit: "roi" },
    { id: 15, pair: "ZEC/USDC", open: 31.20, close: 30.30, pr: -0.0118, pa: -1.18, m: 142, exit: "stop_loss" }
  ];
  function tradeObj(t, isOpen) {
    var stakeAmt = 25;
    return {
      trade_id: t.id, pair: t.pair, base_currency: t.pair.split("/")[0], quote_currency: STAKE,
      is_open: isOpen, is_short: false, amount: +(stakeAmt / t.open).toFixed(6), amount_requested: +(stakeAmt / t.open).toFixed(6),
      stake_amount: stakeAmt, max_stake_amount: stakeAmt, strategy: "HyperliquidDryRunStrategy", enter_tag: "ema_cross",
      timeframe: 5, fee_open: 0.0004, fee_close: 0.0004, open_rate: t.open, open_rate_requested: t.open,
      open_date: ago(t.m), open_timestamp: ts(t.m) * 1000,
      close_rate: isOpen ? null : t.close, close_date: isOpen ? null : ago(Math.max(1, t.m - 30)),
      close_timestamp: isOpen ? null : ts(Math.max(1, t.m - 30)) * 1000,
      current_rate: isOpen ? t.cur : t.close,
      profit_ratio: t.pr, profit_pct: +(t.pr * 100).toFixed(2), profit_abs: t.pa,
      realized_profit: isOpen ? 0 : t.pa, total_profit_abs: t.pa, total_profit_ratio: t.pr,
      exit_reason: isOpen ? null : t.exit, exit_order_status: isOpen ? null : "closed",
      stop_loss_abs: +(t.open * 0.95).toFixed(2), stop_loss_pct: -5, stoploss_current_dist: -0.02,
      leverage: 1, trading_mode: "spot", funding_fees: 0, orders: [], min_rate: t.open * 0.98, max_rate: (isOpen ? t.cur : t.close) * 1.02
    };
  }
  function showConfig() {
    return {
      version: "2026.1", strategy_version: "1.0", dry_run: true, trading_mode: "spot", short_allowed: false,
      stake_currency: STAKE, stake_currency_decimals: 4, stake_amount: 25, available_capital: 1000,
      max_open_trades: 6, minimal_roi: { "0": 0.04, "30": 0.02, "60": 0.01 }, stoploss: -0.05,
      trailing_stop: true, timeframe: "5m", timeframe_ms: 300000, timeframe_min: 5, exchange: "hyperliquid",
      strategy: "HyperliquidDryRunStrategy", force_entry_enable: false, state: "running", runmode: "dry_run",
      position_adjustment_enable: false, bot_name: "hyperliquid-dry-run", api_version: 2.34,
      stoploss_on_exchange: false, unfilledtimeout: { entry: 10, exit: 10 }
    };
  }
  function profit() {
    return {
      profit_closed_coin: 6.82, profit_closed_percent_mean: 0.26, profit_closed_ratio_mean: 0.0026,
      profit_closed_percent_sum: 6.8, profit_closed_ratio_sum: 0.068, profit_closed_percent: 0.68,
      profit_closed_ratio: 0.0068, profit_all_coin: 6.41, profit_all_percent_mean: 0.22,
      profit_all_ratio_mean: 0.0022, profit_all_percent: 0.64, profit_all_ratio: 0.0064,
      trade_count: 28, closed_trade_count: 26, first_trade_date: ago(60 * 96), first_trade_timestamp: ts(60 * 96) * 1000,
      latest_trade_date: ago(20), latest_trade_timestamp: ts(20) * 1000, avg_duration: "1:42:00",
      best_pair: "SOL/USDC", best_rate: 2.98, best_pair_profit_ratio: 0.0298,
      worst_pair: "ZEC/USDC", worst_rate: -1.18, winning_trades: 17, losing_trades: 9, draw_trades: 0,
      profit_factor: 1.74, expectancy: 0.26, expectancy_ratio: 0.18, max_drawdown: 0.031,
      max_drawdown_abs: 3.1, trading_volume: 1450, bot_start_timestamp: ts(60 * 100) * 1000, bot_start_date: ago(60 * 100)
    };
  }
  function balance() {
    return {
      currencies: [
        { currency: STAKE, free: 951.3, balance: 1006.82, used: 50, est_stake: 1006.82, stake: STAKE, side: "long", is_position: false, position: 0 }
      ], total: 1006.82, total_bot: 1006.82, symbol: STAKE, value: 1006.82, stake: STAKE,
      note: "Simulated balances (dry-run)", starting_capital: 1000, starting_capital_ratio: 0.0068, starting_capital_pct: 0.68
    };
  }
  function dailyish(n, unitMin) {
    var data = [];
    for (var i = 0; i < n; i++) {
      var p = +( (Math.sin(i) * 1.4 + 0.9) ).toFixed(3);
      data.push({ date: new Date(NOW - i * unitMin * 60000).toISOString().slice(0, 10),
        abs_profit: p, rel_profit: p / 1000, starting_balance: 1000 + i, fiat_value: p, trade_count: 2 + (i % 3) });
    }
    return { data: data.reverse(), fiat_display_currency: "USD", stake_currency: STAKE };
  }
  function performance() {
    return [
      { pair: "SOL/USDC", profit: 2.41, profit_pct: 2.41, profit_ratio: 0.0241, profit_abs: 2.41, count: 4 },
      { pair: "BTC/USDC", profit: 1.9, profit_pct: 1.9, profit_ratio: 0.019, profit_abs: 1.9, count: 6 },
      { pair: "HYPE/USDC", profit: 1.2, profit_pct: 1.2, profit_ratio: 0.012, profit_abs: 1.2, count: 3 },
      { pair: "ETH/USDC", profit: -0.8, profit_pct: -0.8, profit_ratio: -0.008, profit_abs: -0.8, count: 7 },
      { pair: "ZEC/USDC", profit: -1.18, profit_pct: -1.18, profit_ratio: -0.0118, profit_abs: -1.18, count: 2 }
    ];
  }
  function candles(pair, tf) {
    var cols = ["date", "open", "high", "low", "close", "volume"], data = [], base = 105000, t = NOW - 200 * 300000;
    for (var i = 0; i < 200; i++) {
      var o = base, c = base + (Math.random() - 0.48) * 400; base = c;
      data.push([t, +o.toFixed(2), +(Math.max(o, c) + Math.random() * 120).toFixed(2),
        +(Math.min(o, c) - Math.random() * 120).toFixed(2), +c.toFixed(2), +(Math.random() * 30).toFixed(2)]);
      t += 300000;
    }
    return { pair: pair || "BTC/USDC", timeframe: tf || "5m", columns: cols, data: data,
      length: data.length, strategy: "HyperliquidDryRunStrategy", last_analyzed: NOW, data_start_ts: data[0][0], data_stop_ts: t };
  }

  /* ---------- route a request → JSON value (or undefined to passthrough) ---------- */
  function route(method, path) {
    if (/\/token\/login$/.test(path)) return { access_token: jwt("access"), refresh_token: jwt("refresh") };
    if (/\/token\/refresh$/.test(path)) return { access_token: jwt("access") };
    if (/\/ping$/.test(path)) return { status: "pong" };
    if (/\/version$/.test(path)) return { version: "2026.1" };
    if (/\/show_config$/.test(path)) return showConfig();
    if (/\/status$/.test(path)) return OPEN.map(function (t) { return tradeObj(t, true); });
    if (/\/count$/.test(path)) return { current: OPEN.length, max: 6, total_stake: OPEN.length * 25 };
    if (/\/profit$/.test(path)) return profit();
    if (/\/balance$/.test(path)) return balance();
    if (/\/trades(\?|$)/.test(path)) { var arr = CLOSED.map(function (t) { return tradeObj(t, false); }); return { trades: arr, trades_count: arr.length, total_trades: 26, offset: 0 }; }
    if (/\/daily(\?|$)/.test(path)) return dailyish(14, 1440);
    if (/\/weekly(\?|$)/.test(path)) return dailyish(8, 1440 * 7);
    if (/\/monthly(\?|$)/.test(path)) return dailyish(6, 1440 * 30);
    if (/\/performance$/.test(path)) return performance();
    if (/\/entries$/.test(path)) return [{ enter_tag: "ema_cross", profit_abs: 5.1, profit_ratio: 0.02, count: 16 }, { enter_tag: "rsi_dip", profit_abs: 1.3, profit_ratio: 0.006, count: 12 }];
    if (/\/exits$/.test(path)) return [{ exit_reason: "roi", profit_abs: 7.8, profit_ratio: 0.03, count: 14 }, { exit_reason: "stop_loss", profit_abs: -3.6, profit_ratio: -0.02, count: 8 }, { exit_reason: "trailing_stop_loss", profit_abs: 2.6, profit_ratio: 0.01, count: 4 }];
    if (/\/mix_tags$/.test(path)) return [{ mix_tag: "ema_cross roi", profit_abs: 6.2, profit_ratio: 0.025, count: 11 }];
    if (/\/whitelist$/.test(path)) return { whitelist: ["BTC/USDC", "ETH/USDC", "SOL/USDC", "HYPE/USDC", "ZEC/USDC"], length: 5, method: ["StaticPairList"] };
    if (/\/blacklist$/.test(path)) return { blacklist: [], length: 0, method: ["StaticPairList"], errors: {} };
    if (/\/locks$/.test(path)) return { locks: [], lock_count: 0 };
    if (/\/available_pairs(\?|$)/.test(path)) return { pairs: ["BTC/USDC", "ETH/USDC", "SOL/USDC", "HYPE/USDC", "ZEC/USDC"], pair_interval: [["BTC/USDC", "5m"], ["ETH/USDC", "5m"], ["SOL/USDC", "5m"]], length: 5 };
    if (/\/pair_candles(\?|$)/.test(path) || /\/pair_history(\?|$)/.test(path)) return candles("BTC/USDC", "5m");
    if (/\/sysinfo$/.test(path)) return { cpu_pct: [12.3, 8.1], ram_pct: 41.2 };
    if (/\/logs(\?|$)/.test(path)) return { log_count: 2, logs: [[ago(2), 1718000000, "freqtrade.worker", "INFO", "Bot heartbeat. PID=1, version='2026.1', state='RUNNING'"], [ago(1), 1718000000, "freqtrade.worker", "INFO", "Scanned 5 pairs."]] };
    if (/\/strategies$/.test(path)) return { strategies: ["HyperliquidDryRunStrategy"] };
    if (/\/strategy\//.test(path)) return { strategy: "HyperliquidDryRunStrategy", code: "# (strategy source hidden in demo)" };
    if (/\/sysinfo|\/health$/.test(path)) return { status: "ok" };
    if (/\/api\/v1\//.test(path)) return {}; // safe default for any other api call
    return undefined; // not an API call → passthrough
  }

  /* ---------- fetch override (belt) ---------- */
  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = (typeof input === "string") ? input : (input && input.url) || "";
    var method = (init && init.method) || (input && input.method) || "GET";
    var v = route(method, url);
    if (v !== undefined) return Promise.resolve(new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json" } }));
    return realFetch ? realFetch(input, init) : Promise.reject(new Error("offline"));
  };

  /* ---------- XHR override (axios uses XHR) — delegate non-API to native ---------- */
  var Native = window.XMLHttpRequest;
  function MockXHR() { this._lst = {}; this.readyState = 0; this.status = 0; this.statusText = ""; this.response = ""; this.responseText = ""; this.responseURL = ""; this.responseType = ""; this.timeout = 0; this.withCredentials = false; }
  MockXHR.prototype.addEventListener = function (t, fn) { (this._lst[t] = this._lst[t] || []).push(fn); };
  MockXHR.prototype.removeEventListener = function (t, fn) { var a = this._lst[t]; if (a) { var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } };
  MockXHR.prototype._fire = function (t) { var e = { type: t, target: this, currentTarget: this, loaded: 1, total: 1, lengthComputable: true }; if (typeof this["on" + t] === "function") this["on" + t](e); (this._lst[t] || []).slice().forEach(function (fn) { try { fn.call(this, e); } catch (x) {} }, this); };
  MockXHR.prototype.open = function (method, url, async) {
    this._method = method; this._url = url; this._v = route(method, url);
    if (this._v === undefined) { // passthrough via native
      var n = this._n = new Native(); var self = this;
      ["readystatechange", "load", "error", "abort", "timeout", "loadend", "progress"].forEach(function (t) {
        n["on" + t] = function () { self.readyState = n.readyState; self.status = n.status; self.statusText = n.statusText; try { self.response = n.response; } catch (e) {} try { self.responseText = n.responseText; } catch (e) {} self.responseURL = n.responseURL; self._fire(t); };
      });
      n.open(method, url, async !== false);
    } else { this.readyState = 1; this._fire("readystatechange"); }
  };
  MockXHR.prototype.setRequestHeader = function (k, v) { if (this._n) this._n.setRequestHeader(k, v); };
  MockXHR.prototype.overrideMimeType = function (m) { if (this._n && this._n.overrideMimeType) this._n.overrideMimeType(m); };
  MockXHR.prototype.getAllResponseHeaders = function () { return this._n ? this._n.getAllResponseHeaders() : "content-type: application/json\r\n"; };
  MockXHR.prototype.getResponseHeader = function (k) { if (this._n) return this._n.getResponseHeader(k); return /content-type/i.test(k) ? "application/json" : null; };
  MockXHR.prototype.abort = function () { if (this._n) this._n.abort(); };
  MockXHR.prototype.send = function (body) {
    if (this._n) { try { this._n.responseType = this.responseType; } catch (e) {} this._n.send(body); return; }
    var self = this, txt = JSON.stringify(this._v);
    setTimeout(function () {
      self.status = 200; self.statusText = "OK"; self.responseURL = self._url;
      self.responseText = (self.responseType === "" || self.responseType === "text") ? txt : "";
      self.response = (self.responseType === "json") ? JSON.parse(txt) : ((self.responseType === "" || self.responseType === "text") ? txt : JSON.parse(txt));
      self.readyState = 4;
      self._fire("readystatechange"); self._fire("load"); self._fire("loadend");
    }, 60);
  };
  MockXHR.prototype.setAttribute = function () {};
  window.XMLHttpRequest = MockXHR;

  /* ---------- WebSocket stub → FreqUI falls back to polling ---------- */
  var RealWS = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    if (/\/message\/ws/.test(String(url))) {
      var fake = { url: url, readyState: 0, send: function () {}, close: function () {}, addEventListener: function () {}, removeEventListener: function () {} };
      setTimeout(function () { fake.readyState = 3; if (typeof fake.onclose === "function") fake.onclose({ code: 1000, reason: "demo", wasClean: true }); }, 80);
      return fake;
    }
    return new RealWS(url, protocols);
  };
  try { window.WebSocket.prototype = RealWS.prototype; window.WebSocket.OPEN = 1; window.WebSocket.CLOSED = 3; } catch (e) {}
})();
