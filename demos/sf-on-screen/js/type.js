/* type.js — kinetic typography & variable fonts.
   Designed to be SELF-DEMONSTRATING: every effect is never blank, plays when
   the section enters view, and re-plays on the section's "Replay" button
   (custom event "fx:replay-type"). The variable-font axis breathes continuously
   so it's obviously an effect, and stays draggable. */
(function () {
  "use strict";

  function onReplay(fn) { document.addEventListener("fx:replay-type", fn); }

  // ---- line-mask reveal (yPercent 110 -> 0) ----
  FX.add("line-reveal", function (fx) {
    if (!window.gsap) return;
    document.querySelectorAll("[data-split-lines]").forEach(function (el) {
      var lines;
      if (window.SplitText) {
        var split = new SplitText(el, { type: "lines", linesClass: "split-line" });
        lines = split.lines;
        lines.forEach(function (ln) {
          var w = document.createElement("span");
          w.className = "line-wrap";
          ln.parentNode.insertBefore(w, ln);
          w.appendChild(ln);
        });
      } else {
        el.classList.add("line-wrap");
        lines = [el];
      }
      if (fx.reduced) { gsap.set(lines, { yPercent: 0, autoAlpha: 1 }); return; }
      function play() { gsap.set(lines, { yPercent: 110 }); gsap.to(lines, { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.08 }); }
      gsap.set(lines, { yPercent: 110 });
      FX.inView(el, play);
      // only the in-section headings/lines replay on the button
      if (el.closest("#type")) onReplay(play);
    });
  });

  // ---- scramble / decode reveal (never blank: starts on its final text) ----
  FX.add("scramble", function (fx) {
    if (!window.gsap) return;
    document.querySelectorAll("[data-scramble]").forEach(function (el) {
      var finalText = el.getAttribute("data-scramble");
      el.textContent = finalText; // never blank, even before it plays / if JS-gated
      if (fx.reduced || !window.ScrambleTextPlugin) return;
      function play() {
        gsap.fromTo(el, { scrambleText: { text: finalText, chars: "upperAndLowerCase", speed: 0.6 } },
          { duration: 1.8, ease: "none", scrambleText: { text: finalText, chars: "upperAndLowerCase", speed: 0.6, revealDelay: 0.25 } });
      }
      FX.inView(el, play);
      if (el.closest("#type")) onReplay(play);
    });
  });

  // ---- variable-font axis: continuous breathing (so it visibly renders) + drag ----
  FX.add("vf-axis", function (fx) {
    var el = document.querySelector(".vf-axis");
    if (!el || !window.gsap) return;
    var state = { wght: 380, opsz: 40 };
    function apply() { el.style.fontVariationSettings = '"opsz" ' + state.opsz.toFixed(1) + ', "wght" ' + state.wght.toFixed(0); }
    apply();

    var idle = null;
    if (!fx.reduced) {
      idle = gsap.to(state, { wght: 880, opsz: 144, duration: 2.6, ease: "sine.inOut", yoyo: true, repeat: -1, onUpdate: apply });
    }

    // drag to push the weight by hand (pauses the idle breathing while dragging)
    var dragging = false;
    el.addEventListener("pointerdown", function () { dragging = true; if (idle) idle.pause(); });
    window.addEventListener("pointerup", function () { if (dragging && idle) idle.resume(); dragging = false; });
    el.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var r = el.getBoundingClientRect();
      var t = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
      state.wght = 100 + t * 800; state.opsz = 9 + t * 135; apply();
    });

    // replay = a quick emphatic weight sweep
    onReplay(function () {
      if (fx.reduced) return;
      if (idle) idle.pause();
      gsap.fromTo(state, { wght: 100, opsz: 9 }, {
        wght: 900, opsz: 144, duration: 1.0, ease: "power3.inOut", onUpdate: apply,
        onComplete: function () { if (idle) idle.resume(); }
      });
    });
  });

  // ---- replay control for the whole section ----
  FX.add("type-replay", function () {
    var btn = document.querySelector(".type-replay");
    if (!btn) return;
    btn.addEventListener("click", function () { document.dispatchEvent(new CustomEvent("fx:replay-type")); });
  });
})();
