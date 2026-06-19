/* scroll2.js — 5 added scroll-driven effects (sc-*).
   Each registers via FX.add and runs in core.js's try/catch, so a failure
   in one can't take down the others or the existing scroll module. */
(function () {
  "use strict";

  // a · scrubbed odometer — count written to the DOM each frame
  FX.add("sc-odometer", function (fx) {
    var el = document.querySelector("[data-sc-odo]");
    if (!el) return;
    var out = el.querySelector("b");
    if (fx.reduced || !window.gsap || !window.ScrollTrigger) { out.textContent = "100"; return; }
    var o = { v: 0 };
    gsap.to(o, {
      v: 100, ease: "none",
      scrollTrigger: {
        trigger: el, start: "top 88%", end: "bottom 45%", scrub: 0.4,
        onUpdate: function () { out.textContent = Math.round(o.v); }
      }
    });
  });

  // b · clip-path wipe — scrubbed inset() reveal
  FX.add("sc-wipe", function (fx) {
    var el = document.querySelector(".sc-wipe");
    if (!el) return;
    if (fx.reduced || !window.gsap || !window.ScrollTrigger) { el.style.clipPath = "inset(0 0% 0 0)"; return; }
    gsap.fromTo(el, { clipPath: "inset(0 100% 0 0)" }, {
      clipPath: "inset(0 0% 0 0)", ease: "none",
      scrollTrigger: { trigger: el, start: "top 82%", end: "top 38%", scrub: true }
    });
  });

  // c · layered parallax scene — three depths on one scrubbed timeline
  FX.add("sc-scene", function (fx) {
    var scene = document.querySelector(".sc-scene");
    if (!scene) return;
    if (fx.reduced || !window.gsap || !window.ScrollTrigger) return;
    [[".l1", 6], [".l2", 22], [".l3", 46]].forEach(function (d) {
      var layer = scene.querySelector(d[0]);
      if (!layer) return;
      // GSAP fully owns yPercent (no competing CSS transform) — gotcha #1.
      gsap.fromTo(layer, { yPercent: -d[1] }, {
        yPercent: d[1], ease: "none",
        scrollTrigger: { trigger: scene, start: "top bottom", end: "bottom top", scrub: true }
      });
    });
  });

  // d · word-by-word scrub — each word brightens in step with scroll
  FX.add("sc-words", function (fx) {
    var el = document.querySelector(".sc-words");
    if (!el) return;
    var words = (el.textContent || "").trim().split(/\s+/);
    el.innerHTML = words.map(function (w) { return '<span class="w">' + w + "</span>"; }).join(" ");
    var spans = el.querySelectorAll(".w");
    var target = getComputedStyle(el).getPropertyValue("--w-ink").trim() || "#16130f";
    if (fx.reduced || !window.gsap || !window.ScrollTrigger) {
      spans.forEach(function (s) { s.style.color = "var(--w-ink, var(--ink))"; });
      return;
    }
    gsap.to(spans, {
      color: target, stagger: 1, ease: "none",
      scrollTrigger: { trigger: el, start: "top 82%", end: "bottom 58%", scrub: true }
    });
  });

  // e · scrubbed SVG line-draw — stroke-dashoffset tied to scroll
  FX.add("sc-draw", function (fx) {
    var path = document.querySelector(".sc-draw path");
    if (!path) return;
    var len = path.getTotalLength();
    path.style.strokeDasharray = len;
    if (fx.reduced || !window.gsap || !window.ScrollTrigger) { path.style.strokeDashoffset = 0; return; }
    path.style.strokeDashoffset = len;
    gsap.to(path, {
      strokeDashoffset: 0, ease: "none",
      scrollTrigger: { trigger: path.closest(".add-block"), start: "top 65%", end: "bottom 85%", scrub: true }
    });
  });
})();
