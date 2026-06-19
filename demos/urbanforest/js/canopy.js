// Hero background: soft, drifting canopy-light blobs (dappled greens), 2D canvas.
// Calm and cheap. Gated to visibility + motion; static single frame when reduced.

export function initCanopy(canvas, opts = {}) {
  const ctx = canvas.getContext("2d");
  const reduced = !!opts.reduced;
  const COLORS = ["#3f7a4a", "#5c8a52", "#8a9a5b", "#6f9a5b", "#cf85a3", "#e3d3a6"];
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let w = 0, h = 0, raf = 0, vis = true, t = 0;
  let tx = 0.5, ty = 0.42, cx = 0.5, cy = 0.42;
  const blobs = [];

  function resize() {
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function seed() {
    blobs.length = 0;
    const n = 8;
    for (let i = 0; i < n; i++) {
      blobs.push({
        bx: 0.12 + Math.random() * 0.76,
        by: 0.08 + Math.random() * 0.84,
        r: 0.18 + Math.random() * 0.26,
        amp: 0.02 + Math.random() * 0.05,
        spd: 0.06 + Math.random() * 0.12,
        ph: Math.random() * Math.PI * 2,
        par: 0.02 + Math.random() * 0.05,
        c: COLORS[i % COLORS.length],
        a: 0.10 + Math.random() * 0.10,
      });
    }
  }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    cx += (tx - cx) * 0.05; cy += (ty - cy) * 0.05;
    const base = Math.max(w, h);
    for (const b of blobs) {
      const x = (b.bx + Math.sin(t * b.spd + b.ph) * b.amp + (cx - 0.5) * b.par) * w;
      const y = (b.by + Math.cos(t * b.spd * 0.8 + b.ph) * b.amp + (cy - 0.5) * b.par) * h;
      const rr = b.r * base;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, hexA(b.c, b.a));
      g.addColorStop(1, hexA(b.c, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
    }
  }
  function frame() { t += 0.016; draw(); if (!reduced && vis) raf = requestAnimationFrame(frame); }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  window.addEventListener("resize", () => { resize(); if (reduced) draw(); });
  window.addEventListener("mousemove", (e) => { tx = e.clientX / window.innerWidth; ty = e.clientY / window.innerHeight; });
  const io = new IntersectionObserver((es) => {
    vis = es[0].isIntersecting;
    if (vis && !reduced) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
    else cancelAnimationFrame(raf);
  });
  resize(); seed(); io.observe(canvas);
  if (reduced) draw(); else frame();
}
