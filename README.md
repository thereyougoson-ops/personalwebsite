# Philip Toulinov — portfolio

A hand-built, single-page interactive portfolio. No framework, no build step.

## Run it

Any static server works. From this folder:

```bash
python -m http.server 8080
# then open http://localhost:8080
```

or

```bash
npx serve .
```

## What's inside

```
index.html        — markup + SEO/JSON-LD
styles/main.css    — design system (warm ink + paper + signal-amber)
scripts/main.js    — engine: preloader, cursor, smooth scroll, pipeline, cursor-lit code field
vendor/            — GSAP, ScrollTrigger, Lenis (vendored, no runtime CDN)
assets/            — favicon + social card (og.png) + self-hosted fonts (assets/fonts/)
```

## Stack & techniques

- **GSAP + ScrollTrigger** — scroll-driven reveals, the pipeline stage animation, counters
- **Lenis** — momentum smooth scroll
- **Cursor-lit code field** — a DOM text layer revealed through a CSS radial mask that tracks
  the pointer (WebGL-free, for reliability and accessibility; static fallback on touch / reduced-data)
- **Custom cursor + magnetic elements**, kinetic marquee, build/scroll progress bar
- Fonts (self-hosted in `assets/fonts/`, no runtime CDN): Bricolage Grotesque (display),
  Geist + Geist Mono (UI/data), JetBrains Mono (terminal)

## Accessibility

- Respects `prefers-reduced-motion` (incidental looping animations stop) — the nav `motion` toggle is the full off-switch
- A `motion: on/off` toggle in the nav halts all ambient motion (rAF loops, smooth scroll, the scroll story), persisted across visits
- Full keyboard navigation, semantic landmarks, `<noscript>` fallback
- Custom cursor only on fine-pointer devices; touch gets native behavior

— construit avec soin à San Francisco.
