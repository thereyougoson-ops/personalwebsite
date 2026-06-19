/* type2.js — 5 added kinetic-type effects (ty-*).
   Hook into the existing section "Replay" via the fx:replay-type event. */
(function () {
  "use strict";

  function onReplay(fn) { document.addEventListener("fx:replay-type", fn); }

  function splitChars(el) {
    if (window.SplitText) return new SplitText(el, { type: "chars", charsClass: "ch" }).chars;
    var text = el.textContent; el.textContent = "";
    return text.split("").map(function (c) {
      var s = document.createElement("span");
      s.className = "ch"; s.textContent = c === " " ? " " : c;
      el.appendChild(s); return s;
    });
  }

  // d · per-character travelling wave; hover swells the amplitude
  FX.add("ty-wave", function (fx) {
    var el = document.querySelector(".ty-wave");
    if (!el || !window.gsap) return;
    var chars = splitChars(el);
    if (fx.reduced) return;
    var ho = { v: 0 };
    el.addEventListener("pointerenter", function () { gsap.to(ho, { v: 1, duration: 0.4 }); });
    el.addEventListener("pointerleave", function () { gsap.to(ho, { v: 0, duration: 0.7 }); });
    gsap.ticker.add(function (t) {
      for (var i = 0; i < chars.length; i++) {
        var y = Math.sin(t * 3 + i * 0.5) * (5 + ho.v * 22);
        chars[i].style.transform = "translateY(" + y.toFixed(2) + "px)";
      }
    });
  });

  // e · seamless marquee, velocity-reactive direction + speed
  FX.add("ty-marquee", function (fx) {
    var track = document.querySelector(".ty-marquee .mq-track");
    if (!track || !window.gsap) return;
    track.innerHTML += track.innerHTML; // duplicate for a seamless wrap
    var half = track.scrollWidth / 2;
    if (fx.reduced || !half) return;
    var x = 0, vel = 0;
    if (window.ScrollTrigger) {
      ScrollTrigger.create({ onUpdate: function (self) { vel = self.getVelocity(); } });
    }
    var clamp = gsap.utils.clamp(-700, 700);
    gsap.ticker.add(function (t, dt) {
      var speed = -42 + clamp(vel) * -0.05;   // px/sec; scroll pushes/flips it
      x += speed * (dt / 1000);
      if (x <= -half) x += half; if (x > 0) x -= half;
      track.style.transform = "translateX(" + x.toFixed(2) + "px)";
    });
  });

  // f · living gradient masked to the glyphs (CSS-driven)
  FX.add("ty-gradient", function (fx) {
    var el = document.querySelector(".ty-gradient");
    if (!el) return;
    if (!fx.reduced) el.classList.add("play");
  });

  // g · 3D letter cascade — rotateX from the top edge, on entry + replay
  FX.add("ty-flip", function (fx) {
    var el = document.querySelector(".ty-flip");
    if (!el || !window.gsap) return;
    var chars = splitChars(el);
    if (fx.reduced) { gsap.set(chars, { rotationX: 0, autoAlpha: 1 }); return; }
    gsap.set(chars, { rotationX: -90, autoAlpha: 0, transformOrigin: "50% 0%" });
    function play() {
      gsap.set(chars, { rotationX: -90, autoAlpha: 0 });
      gsap.to(chars, { rotationX: 0, autoAlpha: 1, duration: 0.8, ease: "back.out(1.7)", stagger: 0.045 });
    }
    FX.inView(el, play);
    onReplay(play);
  });

  // h · outline → fill — characters ink in, staggered
  FX.add("ty-stroke", function (fx) {
    var el = document.querySelector(".ty-stroke");
    if (!el || !window.gsap) return;
    var chars = splitChars(el);
    if (fx.reduced) { gsap.set(chars, { color: "#16130f" }); return; }
    function play() {
      gsap.set(chars, { color: "rgba(22,19,15,0)" });
      gsap.to(chars, { color: "#16130f", duration: 0.6, ease: "power2.out", stagger: 0.06 });
    }
    FX.inView(el, play);
    onReplay(play);
  });
})();
