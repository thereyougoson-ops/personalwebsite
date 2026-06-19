/* scroll.js — scroll-driven storytelling (GSAP ScrollTrigger).
   Per-element triggers (fire on refresh even for in-view/jumped-to els),
   horizontal pin track, scrub parallax, velocity-reactive skew. */
(function () {
  "use strict";

  // ---- generic reveal: per-element trigger, once, varied eases ----
  FX.add("reveals", function (fx) {
    if (!window.gsap) return;
    var eases = ["power3.out", "expo.out", "power2.out", "back.out(1.4)"];
    document.querySelectorAll("[data-reveal]").forEach(function (el, i) {
      var fromY = parseFloat(el.getAttribute("data-reveal-y") || "40");
      if (fx.reduced) { gsap.set(el, { autoAlpha: 1, y: 0 }); return; }
      gsap.set(el, { autoAlpha: 0, y: fromY });
      // IntersectionObserver-based so reveals fire on any entry (incl. anchor jumps)
      FX.inView(el, function () {
        gsap.to(el, { autoAlpha: 1, y: 0, duration: 1.0, ease: eases[i % eases.length] });
      });
    });
  });

  // ---- scrub parallax: elements drift at data-speed ----
  FX.add("parallax", function (fx) {
    if (fx.reduced || !window.gsap || !window.ScrollTrigger) return;
    document.querySelectorAll("[data-speed]").forEach(function (el) {
      var speed = parseFloat(el.getAttribute("data-speed"));
      gsap.to(el, {
        yPercent: -100 * (speed - 1) * 0.5,
        ease: "none",
        scrollTrigger: { trigger: el.closest("section") || el, start: "top bottom", end: "bottom top", scrub: true }
      });
    });
  });

  // ---- horizontal pinned gallery (vertical scroll -> horizontal track) ----
  FX.add("horizontal-pin", function (fx) {
    var section = document.querySelector(".horizontal");
    var track = section && section.querySelector(".track");
    if (!section || !track) return;
    if (fx.reduced || !window.gsap || !window.ScrollTrigger) {
      // graceful fallback: allow native horizontal overflow scroll
      track.parentElement.style.overflowX = "auto";
      return;
    }
    var pin = section.querySelector(".pin");
    function amount() { return track.scrollWidth - pin.clientWidth + 32; }
    gsap.to(track, {
      x: function () { return -amount(); },
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: function () { return "+=" + amount(); },
        pin: pin,
        scrub: 0.6,
        invalidateOnRefresh: true,
        anticipatePin: 1
      }
    });
  });

  // ---- velocity-reactive skew on big type rows ----
  FX.add("velocity-skew", function (fx) {
    if (fx.reduced || !window.gsap || !window.ScrollTrigger) return;
    var rows = document.querySelectorAll(".skew-row");
    if (!rows.length) return;
    var skewSetters = [];
    rows.forEach(function (r) { skewSetters.push(gsap.quickTo(r, "skewY", { duration: 0.4, ease: "power3" })); });
    var clamp = gsap.utils.clamp(-12, 12);
    ScrollTrigger.create({
      onUpdate: function (self) {
        var v = clamp(self.getVelocity() / -180);
        skewSetters.forEach(function (set) { set(v); });
      }
    });
  });

  // ---- scrubbed scale/clip reveal on a "chapter" image ----
  FX.add("scrub-chapter", function (fx) {
    if (fx.reduced || !window.gsap || !window.ScrollTrigger) return;
    var el = document.querySelector("[data-scrub-scale]");
    if (!el) return;
    gsap.fromTo(el, { scale: 1.25, filter: "saturate(0.4)" }, {
      scale: 1, filter: "saturate(1)", ease: "none",
      scrollTrigger: { trigger: el.closest("section"), start: "top bottom", end: "bottom top", scrub: true }
    });
  });
})();
