/* timeline.js — "when they were built": a decade bar chart of the POPOS,
   split by access (brass = always open, petrol = business hours), with the
   1985 Downtown Plan marked. Bars grow on reveal (guarded by no-motion). */
import { ACCESS, fmtInt } from "./util.js";

export function initTimeline(summary, records) {
  const host = document.getElementById("timeline-chart");
  if (!host) return;

  // bucket by decade, split by access
  const buckets = {};
  records.forEach((r) => {
    if (!r.year) return;
    const d = Math.floor(r.year / 10) * 10;
    if (!buckets[d]) buckets[d] = { always: 0, business: 0, unknown: 0, total: 0 };
    buckets[d][r.access] = (buckets[d][r.access] || 0) + 1;
    buckets[d].total++;
  });
  const decades = Object.keys(buckets).map(Number).sort((a, b) => a - b);
  if (!decades.length) return;
  const max = Math.max.apply(null, decades.map((d) => buckets[d].total));

  host.innerHTML = decades.map((d) => {
    const b = buckets[d];
    const h = Math.round((b.total / max) * 100);
    const seg = (n, cls) => n ? '<span class="tl-seg ' + cls + '" style="flex:' + n + '"></span>' : "";
    const isPlan = d === 1980;
    return (
      '<div class="tl-col' + (isPlan ? " is-plan" : "") + '">' +
        '<span class="tl-count">' + b.total + "</span>" +
        '<div class="tl-bar" style="--h:' + h + '%" aria-hidden="true">' +
          seg(b.always, "is-always") + seg(b.business, "is-business") + seg(b.unknown, "is-unknown") +
        "</div>" +
        '<span class="tl-decade">' + d + "s</span>" +
      "</div>"
    );
  }).join("");

  // accessible summary
  const sr = host.parentElement && host.parentElement.querySelector(".tl-sr");
  if (sr) sr.textContent = "POPOS built per decade: " + decades.map((d) => d + "s: " + buckets[d].total).join(", ") + ".";

  reveal(host);
}

function reveal(host) {
  const bars = Array.from(host.querySelectorAll(".tl-bar"));
  if (document.body.classList.contains("no-motion") || !window.gsap || !window.FX) {
    bars.forEach((b) => { b.style.transform = "scaleY(1)"; });
    return;
  }
  window.gsap.set(bars, { scaleY: 0, transformOrigin: "bottom" });
  window.FX.inView(host, () => {
    window.gsap.to(bars, { scaleY: 1, duration: 1.0, ease: "expo.out", stagger: 0.06 });
  }, { rootMargin: "0px 0px -15% 0px" });
}
