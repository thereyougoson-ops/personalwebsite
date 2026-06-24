/* CookieLens demo driver (same-origin static).
 *
 * - Loads the captured fixtures (fixtures/index.json + per-site analysis).
 * - Drives the REAL popup (in an iframe running the extension's own
 *   popup.html/css/js) by calling its exposed render(analysis).
 * - Builds an aggregate report computed from the real fixtures.
 * - Intercepts the popup's Clear actions so they operate on the in-memory
 *   fixture clone (remove rows + re-grade + re-render) instead of chrome.cookies.
 *
 * No browser APIs are touched at runtime — this is a captured run.
 */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var iframe = $("popup");
  var index = null;          // fixtures/index.json
  var fixtureCache = {};     // slug -> full fixture
  var current = null;        // { slug, analysis (working clone) }
  var clearInterceptWired = false;

  // ---- boot ----
  fetch("fixtures/index.json")
    .then(function (r) { return r.json(); })
    .then(function (idx) {
      index = idx;
      var sites = (idx.sites || []).slice();
      $("site-count").textContent = sites.length;
      $("run-badge").textContent = "demo · " + sites.length + " captured runs";
      buildPicker(sites);
      buildAggregate(sites);
      wirePicks();
      // Auto-select the worst-graded site (sites already sorted by score desc).
      if (sites.length) selectSite(sites[0].slug);
    })
    .catch(function (e) { console.error("Failed to load fixtures index:", e); });

  // ---- picker ----
  function buildPicker(sites) {
    var list = $("site-list");
    var search = $("search");
    function paint(filter) {
      var f = (filter || "").trim().toLowerCase();
      list.innerHTML = "";
      sites.forEach(function (s) {
        if (f && s.site.toLowerCase().indexOf(f) === -1) return;
        var li = document.createElement("li");
        var trk = (s.trackerDomains || 0) + (s.otherThirdParties || 0);
        li.className = "site-row" + (current && current.slug === s.slug ? " active" : "");
        li.dataset.slug = s.slug;
        li.innerHTML =
          '<span class="grade-pill g-' + s.grade + '">' + s.grade + '</span>' +
          '<span class="dom">' + escapeHtml(s.site) + '</span>' +
          '<span class="meta">' + s.cookies + 'c · ' + trk + 't</span>';
        li.addEventListener("click", function () { selectSite(s.slug); });
        list.appendChild(li);
      });
    }
    search.addEventListener("input", function () { paint(search.value); });
    paint("");
    // store for re-highlight
    buildPicker._paint = paint;
  }

  function wirePicks() {
    document.querySelectorAll(".pick-btn[data-pick]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectSite(btn.dataset.pick);
        // Scroll the site into view in the list
        var row = document.querySelector('.site-row[data-slug="' + btn.dataset.pick + '"]');
        if (row) row.scrollIntoView({ block: "nearest" });
      });
    });
  }

  function markActive(slug) {
    document.querySelectorAll(".site-row").forEach(function (el) {
      el.classList.toggle("active", el.dataset.slug === slug);
    });
    document.querySelectorAll(".pick-btn[data-pick]").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.pick === slug);
    });
  }

  // ---- select + render a fixture in the real popup ----
  function selectSite(slug) {
    showStage();
    var gen = ++renderGen;               // cancel any in-flight retry for old site
    loadFixture(slug).then(function (fx) {
      if (gen !== renderGen) return;     // user already clicked another site
      // Deep clone so Clear can mutate without corrupting the cached fixture.
      var analysis = JSON.parse(JSON.stringify(fx.analysis));
      current = { slug: slug, site: fx.site, url: fx.url, analysis: analysis };
      markActive(slug);
      $("device-where").textContent = fx.site;
      renderInPopup(analysis, fx.url, gen, 0);
    });
  }

  function loadFixture(slug) {
    if (fixtureCache[slug]) return Promise.resolve(fixtureCache[slug]);
    return fetch("fixtures/" + slug + ".json")
      .then(function (r) { return r.json(); })
      .then(function (fx) { fixtureCache[slug] = fx; return fx; });
  }

  function popupApi() {
    try { return iframe.contentWindow.__cookielens; } catch (e) { return null; }
  }

  // Generation counter — each selectSite() call increments this so stale retries
  // from a previous selection abort immediately when a new site is chosen.
  var renderGen = 0;

  function renderInPopup(analysis, url, gen, attempts) {
    if (gen !== renderGen) return;          // superseded by a newer selectSite()
    attempts = attempts || 0;
    var api = popupApi();
    if (!api) {
      if (attempts > 100) {               // ~8 s timeout
        showPopupError("The popup couldn't initialize. Try opening the demo directly: <a href='.' target='_blank'>open ↗</a>");
        return;
      }
      return void setTimeout(function () { renderInPopup(analysis, url, gen, attempts + 1); }, 80);
    }
    hidePopupError();
    try {
      var st = api.state;
      st.tabUrl = url || "";
      // Update the popup's site-bar (normally set by the live scan path).
      var doc = iframe.contentDocument;
      if (doc) {
        var host = current ? current.site : "";
        var dom = doc.getElementById("site-domain"); if (dom) dom.textContent = host;
        var fav = doc.getElementById("favicon");
        if (fav) { fav.src = "icons/icon48.png"; fav.style.visibility = "visible"; }
      }
      api.setAnalysis(analysis);
      api.render(analysis, {});      // the REAL render path
      wireClearIntercept();
    } catch (e) { console.error("render failed:", e); }
  }

  function showPopupError(html) {
    var el = $("popup-error");
    if (!el) {
      el = document.createElement("div");
      el.id = "popup-error";
      el.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-size:13px;color:var(--dim);line-height:1.6;background:var(--bg);border-radius:14px;";
      iframe.parentNode.style.position = "relative";
      iframe.parentNode.appendChild(el);
    }
    el.innerHTML = html;
    el.style.display = "flex";
  }
  function hidePopupError() {
    var el = $("popup-error"); if (el) el.style.display = "none";
  }

  // ---- Clear actions operate on the fixture clone ----
  // Capture-phase delegated listener inside the iframe doc — beats the popup's
  // own bubble-phase handlers on #clear-trackers and .co-clear.
  function wireClearIntercept() {
    if (clearInterceptWired) return;
    var doc;
    try { doc = iframe.contentDocument; } catch (e) { return; }
    if (!doc) return;
    doc.addEventListener("click", function (e) {
      var co = e.target.closest && e.target.closest(".co-clear");
      var clearAll = e.target.closest && e.target.closest("#clear-trackers");
      if (co) {
        e.preventDefault(); e.stopImmediatePropagation();
        clearCompanyOnFixture(co.dataset.company);
      } else if (clearAll) {
        e.preventDefault(); e.stopImmediatePropagation();
        clearTrackersOnFixture();
      }
    }, true); // capture
    clearInterceptWired = true;
  }

  function isClearable(api, c) {
    try { return api.isClearableTrackerCookie(c); } catch (e) { return !!c.isTracking; }
  }

  function clearTrackersOnFixture() {
    var api = popupApi(); if (!api || !current) return;
    var a = current.analysis;
    var before = a.cookies.length;
    a.cookies = a.cookies.filter(function (c) { return !isClearable(api, c); });
    var removed = before - a.cookies.length;
    recomputeAndRender();
    api.toast("Cleared " + removed + " tracker cookie" + (removed === 1 ? "" : "s") + " · logins kept · captured run");
  }

  function clearCompanyOnFixture(company) {
    var api = popupApi(); if (!api || !current) return;
    var a = current.analysis;
    var canon = function (n) { try { return api.canonicalEntity(n); } catch (e) { return n; } };
    var before = a.cookies.length;
    a.cookies = a.cookies.filter(function (c) {
      var mine = canon(c.company) === company;
      return !(mine && isClearable(api, c));
    });
    var removed = before - a.cookies.length;
    recomputeAndRender();
    api.toast("Cleared " + removed + " " + company + " cookie" + (removed === 1 ? "" : "s") + " · captured run");
  }

  // After mutating cookies, re-derive the few summary counts render() reads,
  // re-grade exposure from the surviving signal, and repaint via the real path.
  function recomputeAndRender() {
    var api = popupApi(); var a = current.analysis;
    var cookies = a.cookies;
    var firstParty = cookies.filter(function (c) { return c.party === "first"; }).length;
    var tracking = cookies.filter(function (c) { return c.isTracking; }).length;
    var hidden = cookies.filter(function (c) { return c.hidden; }).length;
    var companies = new Set(cookies.map(function (c) { return c.company; }).filter(Boolean)).size;
    a.summary.total = cookies.length;
    a.summary.firstParty = firstParty;
    a.summary.thirdParty = cookies.length - firstParty;
    a.summary.tracking = tracking;
    a.summary.hidden = hidden;
    a.summary.companies = companies;

    // Re-grade: scale the original score by how much tracking signal remains.
    if (a.__origTracking === undefined) {
      a.__origTracking = Math.max(1, trackerSignal(a));
      a.__origScore = a.risk.score;
    }
    var remain = trackerSignal(a);
    var ratio = a.__origTracking ? remain / a.__origTracking : 0;
    var score = Math.round(a.__origScore * ratio);
    a.risk.score = Math.max(0, Math.min(100, score));
    a.risk.grade = gradeFor(a.risk.score);
    a.risk.verdict = remain === 0
      ? "Tracking cookies cleared in this captured view."
      : a.risk.verdict;

    api.setAnalysis(a);
    api.render(a, {});
  }

  function trackerSignal(a) {
    return a.cookies.filter(function (c) { return c.isTracking; }).length
      + (a.trackerDomains ? a.trackerDomains.length : 0);
  }
  function gradeFor(score) {
    if (score >= 80) return "F";
    if (score >= 60) return "D";
    if (score >= 40) return "C";
    if (score >= 20) return "B";
    return "A";
  }

  // ---- aggregate report (pure computation over fixtures) ----
  function buildAggregate(sites) {
    var totalCookies = 0, totalHidden = 0, totalTracking = 0, totalTrackers = 0;
    var gradeCount = { A:0,B:0,C:0,D:0,F:0 };
    sites.forEach(function (s) {
      totalCookies += s.cookies || 0;
      totalTracking += s.trackingCookies || 0;
      totalTrackers += (s.trackerDomains || 0) + (s.otherThirdParties || 0);
      gradeCount[s.grade] = (gradeCount[s.grade] || 0) + 1;
    });

    $("agg-n").textContent = sites.length + " sites";

    // Hidden/HttpOnly + tracker/company/broker tallies need the full fixtures.
    Promise.all(sites.map(function (s) { return loadFixture(s.slug).catch(function () { return null; }); }))
      .then(function (fxs) {
        var trackerHits = {};   // domain -> { sites, company }
        var companyReach = {};  // company -> sites set
        var brokerHits = {};    // broker brand -> sites set
        var hiddenTotal = 0;
        var loaded = 0;

        fxs.forEach(function (fx, i) {
          if (!fx) return;
          loaded++;
          var a = fx.analysis, site = sites[i].site;
          (a.cookies || []).forEach(function (c) { if (c.hidden) hiddenTotal++; });
          (a.trackerDomains || []).forEach(function (t) {
            var k = t.domain;
            (trackerHits[k] = trackerHits[k] || { sites: new Set(), company: t.company || t.domain });
            trackerHits[k].sites.add(site);
          });
          // company reach across cookies + tracker domains
          var comps = new Set();
          var skip = { "This site": 1, "Other": 1, "Unknown": 1, "First party": 1 };
          (a.cookies || []).forEach(function (c) { if (c.company && !skip[c.company] && c.party !== "first") comps.add(c.company); });
          (a.trackerDomains || []).forEach(function (t) { if (t.company && !skip[t.company]) comps.add(t.company); });
          comps.forEach(function (co) { (companyReach[co] = companyReach[co] || new Set()).add(site); });
          // brokers
          var dc = a.dataCollection || {};
          (dc.collectors || []).forEach(function (c) {
            if (c.broker) { var b = c.brand || "broker"; (brokerHits[b] = brokerHits[b] || new Set()).add(site); }
          });
        });

        // stat cards
        var worstSite = sites[0];
        var fGrades = gradeCount.F + gradeCount.D;
        var statsHtml =
          stat(loaded, "sites captured", "good") +
          stat(totalCookies.toLocaleString(), "cookies observed") +
          stat(hiddenTotal.toLocaleString(), "hidden / HttpOnly cookies", "warn") +
          stat(totalTrackers.toLocaleString(), "third-party tracker connections", "warn") +
          stat(fGrades, "sites graded D or F", "bad") +
          stat(worstSite ? (worstSite.site + " · " + worstSite.grade) : "—", "worst-graded site", "bad");
        $("agg-stats").innerHTML = statsHtml;

        renderRank($("agg-trackers"), topN(trackerHits, function (v) { return v.sites.size; }, function (k, v) {
          return { label: v.company, sub: k, count: v.sites.size };
        }), false);
        renderRank($("agg-companies"), topN(companyReach, function (v) { return v.size; }, function (k, v) {
          return { label: k, sub: v.size + " sites", count: v.size };
        }), false);
        renderRank($("agg-brokers"), topN(brokerHits, function (v) { return v.size; }, function (k, v) {
          return { label: k, sub: "data broker", count: v.size };
        }), false);

        // worst sites by score
        var worst = sites.slice().sort(function (x, y) { return y.score - x.score; }).slice(0, 8)
          .map(function (s) { return { label: s.site, sub: "grade " + s.grade, count: s.score, max: 100 }; });
        renderRank($("agg-worst"), worst, true);
      });
  }

  function stat(v, l, cls) {
    return '<div class="stat"><div class="v ' + (cls || "") + '">' + escapeHtml(String(v)) +
      '</div><div class="l">' + escapeHtml(l) + '</div></div>';
  }

  function topN(map, weight, mapper, n) {
    n = n || 8;
    return Object.keys(map)
      .map(function (k) { return { k: k, w: weight(map[k]), item: mapper(k, map[k]) }; })
      .sort(function (a, b) { return b.w - a.w; })
      .slice(0, n)
      .map(function (x) { return x.item; });
  }

  function renderRank(ul, items, isScore) {
    if (!items.length) { ul.innerHTML = '<li class="lbl" style="color:var(--faint)">none</li>'; return; }
    var max = Math.max.apply(null, items.map(function (i) { return i.max || i.count; }));
    ul.innerHTML = items.map(function (i) {
      var pct = Math.round(((i.max ? i.count / i.max : i.count / max)) * 100);
      return '<li>' +
        '<span class="lbl">' + escapeHtml(i.label) + (i.sub ? ' <small>' + escapeHtml(i.sub) + '</small>' : '') + '</span>' +
        '<span class="bar"><i style="width:' + pct + '%"></i></span>' +
        '<span class="cnt">' + i.count + '</span>' +
        '</li>';
    }).join("");
  }

  // ---- tab switching ----
  $("tab-sites").addEventListener("click", function () { showStage(); });
  $("tab-agg").addEventListener("click", function () { showAgg(); });
  function showStage() {
    $("stage").classList.remove("hide");
    $("agg").classList.remove("show");
    $("tab-sites").classList.add("active"); $("tab-agg").classList.remove("active");
  }
  function showAgg() {
    $("stage").classList.add("hide");
    $("agg").classList.add("show");
    $("tab-agg").classList.add("active"); $("tab-sites").classList.remove("active");
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
})();
