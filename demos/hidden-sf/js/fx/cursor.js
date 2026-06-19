/* cursor.js — custom spring cursor, contextual labels, magnetic elements.
   Skips entirely on touch / reduced-motion (CSS already hides it). */
(function () {
  "use strict";

  // shared cursor refs, set when custom-cursor inits
  var _cursor = null, _label = null;

  // Bind contextual [data-cursor] hover states within `root`. Idempotent
  // (per-element guard) so it's safe to call again for JS-injected content.
  function bindCursor(root) {
    if (!_cursor || !window.gsap) return;
    (root || document).querySelectorAll("[data-cursor]").forEach(function (el) {
      if (el._fxCursor) return; el._fxCursor = true;
      var txt = el.getAttribute("data-cursor");
      el.addEventListener("pointerenter", function () {
        gsap.to(_cursor, { scale: txt ? 4.0 : 2.4, duration: 0.3, ease: "power2.out" });
        if (_label && txt) { _label.textContent = txt; gsap.to(_label, { autoAlpha: 1, duration: 0.2 }); }
      });
      el.addEventListener("pointerleave", function () {
        gsap.to(_cursor, { scale: 1, duration: 0.3, ease: "power2.out" });
        if (_label) gsap.to(_label, { autoAlpha: 0, duration: 0.15 });
      });
    });
  }

  // Bind magnetic pull within `root`. Idempotent. Touch / reduced-motion no-op.
  function bindMagnetic(root) {
    if (!window.gsap || window.matchMedia("(hover: none)").matches) return;
    if (window.FX && window.FX.reduced) return;
    (root || document).querySelectorAll(".magnetic").forEach(function (el) {
      if (el._fxMag) return; el._fxMag = true;
      var strength = parseFloat(el.getAttribute("data-magnetic") || "0.4");
      var xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1,0.4)" });
      var yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1,0.4)" });
      el.addEventListener("pointermove", function (e) {
        // measure the UNTRANSFORMED centre (subtract gsap's own translate),
        // else the rect chases the element → runaway feedback / fly-off.
        var r = el.getBoundingClientRect();
        var cx = r.left + r.width / 2 - (gsap.getProperty(el, "x") || 0);
        var cy = r.top + r.height / 2 - (gsap.getProperty(el, "y") || 0);
        xTo((e.clientX - cx) * strength);
        yTo((e.clientY - cy) * strength);
      });
      el.addEventListener("pointerleave", function () { xTo(0); yTo(0); });
    });
  }

  FX.bindCursor = bindCursor;
  FX.bindMagnetic = bindMagnetic;

  FX.add("custom-cursor", function (fx) {
    if (fx.reduced) return;
    if (window.matchMedia("(hover: none)").matches) return;
    if (!window.gsap) return;
    _cursor = document.getElementById("cursor");
    _label = _cursor && _cursor.querySelector(".cursor__label");
    if (!_cursor) return;
    gsap.set(_cursor, { x: -100, y: -100 }); // park off-screen so it doesn't flash at 0,0
    _cursor.classList.add("is-active");
    var xTo = gsap.quickTo(_cursor, "x", { duration: 0.35, ease: "power3" });
    var yTo = gsap.quickTo(_cursor, "y", { duration: 0.35, ease: "power3" });
    window.addEventListener("pointermove", function (e) { xTo(e.clientX); yTo(e.clientY); });
    bindCursor(document);
  });

  FX.add("magnetic", function (fx) {
    if (fx.reduced || !window.gsap) return;
    if (window.matchMedia("(hover: none)").matches) return;
    bindMagnetic(document);
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
