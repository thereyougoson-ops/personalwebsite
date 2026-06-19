/* cursor.js — custom spring cursor, contextual labels, magnetic elements.
   Skips entirely on touch / reduced-motion (CSS already hides it). */
(function () {
  "use strict";

  FX.add("custom-cursor", function (fx) {
    if (fx.reduced) return;
    if (window.matchMedia("(hover: none)").matches) return;
    if (!window.gsap) return;
    var cursor = document.getElementById("cursor");
    var label = cursor && cursor.querySelector(".cursor__label");
    if (!cursor) return;
    gsap.set(cursor, { x: -100, y: -100 }); // park off-screen until the pointer moves
    cursor.classList.add("is-active");

    var xTo = gsap.quickTo(cursor, "x", { duration: 0.35, ease: "power3" });
    var yTo = gsap.quickTo(cursor, "y", { duration: 0.35, ease: "power3" });
    window.addEventListener("pointermove", function (e) { xTo(e.clientX); yTo(e.clientY); });

    // contextual states from data-cursor attributes
    document.querySelectorAll("[data-cursor]").forEach(function (el) {
      var txt = el.getAttribute("data-cursor");
      el.addEventListener("pointerenter", function () {
        gsap.to(cursor, { scale: txt ? 4.2 : 2.6, duration: 0.3, ease: "power2.out", background: "#e8b54a" });
        if (label && txt) { label.textContent = txt; gsap.to(label, { autoAlpha: 1, duration: 0.2 }); }
      });
      el.addEventListener("pointerleave", function () {
        gsap.to(cursor, { scale: 1, duration: 0.3, ease: "power2.out", background: "rgba(0,0,0,0)" });
        if (label) gsap.to(label, { autoAlpha: 0, duration: 0.15 });
      });
    });
  });

  // ---- magnetic elements ----
  FX.add("magnetic", function (fx) {
    if (fx.reduced || !window.gsap) return;
    if (window.matchMedia("(hover: none)").matches) return;
    document.querySelectorAll(".magnetic").forEach(function (el) {
      var strength = parseFloat(el.getAttribute("data-magnetic") || "0.4");
      var xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1,0.4)" });
      var yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1,0.4)" });
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      });
      el.addEventListener("pointerleave", function () { xTo(0); yTo(0); });
    });
  });

  // ---- spotlight reveal (DOM + CSS mask following a lerped pointer) ----
  FX.add("spotlight", function (fx) {
    var stage = document.querySelector(".spotlight");
    var top = stage && stage.querySelector(".spotlight__top");
    if (!stage || !top) return;
    if (fx.reduced) { top.style.webkitMaskImage = "none"; top.style.maskImage = "none"; return; }
    var tx = 50, ty = 50, cx = 50, cy = 50, raf = 0;
    stage.addEventListener("pointermove", function (e) {
      var r = stage.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 100;
      ty = ((e.clientY - r.top) / r.height) * 100;
      if (!raf) raf = requestAnimationFrame(tick);
    });
    function tick() {
      cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
      top.style.setProperty("--mx", cx + "%");
      top.style.setProperty("--my", cy + "%");
      if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) { raf = requestAnimationFrame(tick); }
      else { raf = 0; }
    }
  });
})();
