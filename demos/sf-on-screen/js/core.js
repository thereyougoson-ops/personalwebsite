/* core.js — effect registry, smooth scroll, reduced-motion, status.
   Loaded first. Every effect registers via FX.add(name, fn) and is
   run inside try/catch so one failure can't cascade. */
(function () {
  "use strict";

  // Motion preference: an explicit stored choice wins; otherwise fall back to the
  // OS prefers-reduced-motion setting so a first visit honours the system. ?rm=1 test hook.
  var _stored = null;
  try { _stored = localStorage.getItem("sfos-motion"); } catch (e) {}
  var prefersReduced = (_stored === "off")
    || (_stored !== "on" && (window.matchMedia("(prefers-reduced-motion: reduce)").matches
        || /[?&]rm=1\b/.test(location.search)));

  var FX = {
    _effects: [],
    reduced: prefersReduced,
    lenis: null,
    add: function (name, fn) { this._effects.push({ name: name, fn: fn }); },
    // Reliable one-shot "entered view" trigger. Unlike a ScrollTrigger start
    // position, IntersectionObserver fires on ANY entry — scroll, jump,
    // anchor-nav, deep-link, programmatic scroll — so reveals never get stuck.
    inView: function (el, cb, opts) {
      opts = opts || {};
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { io.unobserve(en.target); cb(en.target); }
        });
      }, { threshold: opts.threshold || 0, rootMargin: opts.rootMargin || "0px 0px -10% 0px" });
      io.observe(el);
    },
    log: function (name, ok, msg) {
      var el = document.getElementById("fx-status");
      if (!el) return;
      var row = document.createElement("div");
      row.className = ok ? "ok" : "err";
      row.textContent = (ok ? "✓ " : "✗ ") + name + (msg ? " — " + msg : "");
      el.appendChild(row);
    },
    run: function () {
      var self = this;
      this._effects.forEach(function (e) {
        try {
          e.fn(self);
          self.log(e.name, true);
          console.log("[fx] ok:", e.name);
        } catch (err) {
          self.log(e.name, false, err && err.message);
          console.error("[fx] FAILED:", e.name, err);
        }
      });
      // One refresh AFTER every effect has set up its ScrollTriggers/pins.
      if (window.ScrollTrigger) { try { ScrollTrigger.refresh(); } catch (e) {} }
    }
  };
  window.FX = FX;

  // ---- GSAP plugin registration (guarded) ----
  function registerGSAP() {
    if (!window.gsap) return;
    var plugins = [];
    if (window.ScrollTrigger) plugins.push(ScrollTrigger);
    if (window.Flip) plugins.push(Flip);
    if (window.ScrambleTextPlugin) plugins.push(ScrambleTextPlugin);
    if (window.SplitText) plugins.push(SplitText);
    if (window.Observer) plugins.push(Observer);
    if (window.Physics2DPlugin) plugins.push(Physics2DPlugin);
    if (plugins.length) gsap.registerPlugin.apply(gsap, plugins);
  }

  // ---- Lenis + GSAP on a SINGLE rAF loop (the canonical wiring) ----
  function initSmoothScroll() {
    if (FX.reduced || document.body.classList.contains("no-motion")) return;
    if (!window.Lenis || !window.gsap) return;
    var lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    FX.lenis = lenis;
    if (window.ScrollTrigger) lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  // ---- Motion toggle ----
  function initMotionToggle() {
    var btn = document.getElementById("motion-toggle");
    if (!btn) return;
    function label() { btn.textContent = document.body.classList.contains("no-motion") ? "Motion: off" : "Motion: on"; }
    if (FX.reduced) document.body.classList.add("no-motion");
    label();
    btn.setAttribute("aria-pressed", document.body.classList.contains("no-motion") ? "true" : "false");
    btn.addEventListener("click", function () {
      var turningOff = !document.body.classList.contains("no-motion");
      try { localStorage.setItem("sfos-motion", turningOff ? "off" : "on"); } catch (e) {}
      location.reload(); // re-init cleanly; state re-derived from storage on boot
    });
  }

  // Smooth-scroll anchor links via Lenis so nav clicks animate (and fire
  // scroll-driven effects en route) instead of hard-jumping past them.
  function initAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href");
        if (!id || id.length < 2) return;
        var t = document.querySelector(id);
        if (!t) return;
        e.preventDefault();
        if (FX.lenis) FX.lenis.scrollTo(t, { offset: -16, duration: 1.2 });
        else t.scrollIntoView({ behavior: FX.reduced ? "auto" : "smooth" });
      });
    });
  }

  // status badge toggled with the `d` key (debug) — but NOT while typing in a
  // field (otherwise searching "Devs"/"Dirty Harry" pops the debug overlay).
  function initStatusToggle() {
    window.addEventListener("keydown", function (e) {
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "d") { var s = document.getElementById("fx-status"); if (s) s.classList.toggle("show"); }
    });
  }

  function boot() {
    document.body.classList.remove("is-loading");
    registerGSAP();
    initMotionToggle();
    initStatusToggle();
    initSmoothScroll();
    initAnchors();
    // Run effects only AFTER fonts settle, so SplitText measures real line
    // breaks (avoids reflow + the "called before fonts loaded" warning).
    // Timeout fallback guarantees we never hang if fonts.ready stalls.
    var started = false;
    function start() { if (started) return; started = true; FX.run(); }
    if (document.fonts && document.fonts.load) {
      // Force the actual webfonts to load (ready alone can resolve before
      // render even requests them), THEN run — so SplitText measures real glyphs.
      Promise.all([
        document.fonts.load("1em Fraunces"),
        document.fonts.load("italic 1em Fraunces"),
        document.fonts.load("1em Archivo"),
        document.fonts.load("1em SpaceMono")
      ]).then(function () { return document.fonts.ready; }).then(start).catch(start);
      setTimeout(start, 2000);
    } else {
      start();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
