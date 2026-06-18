# Philip Toulinov — Portfolio: Feature & Editing Guide

_Last updated: 2026-06-15_

This guide covers the **interactive features** added in this version and exactly **where to edit** each
one. No build step, no framework — everything is hand-written `index.html` + `styles/main.css` +
`scripts/main.js`, with GSAP / ScrollTrigger / Lenis vendored locally.

---

## Run it

```bash
cd "philip-toulinov-portfolio (2)"
python -m http.server 8080      # or: npx serve .
# open http://localhost:8080
```

It's a static site — drop the folder on Netlify / Vercel / Cloudflare Pages / GitHub Pages as-is.

---

## What's new in this version

| # | Feature | Where you see it | Files touched |
|---|---------|------------------|---------------|
| 1 | **Motion ON by default** | whole site animates immediately | `main.js`, `main.css` |
| 2 | **Thesis interstitial** (scroll-pinned kinetic type) | between Hero and Pipeline | all three |
| 3 | **Self-running terminal demo** | the "It's a real shell" section | `main.js` |
| 4 | **Hero statuspage** (90-day uptime bars) | top of the Hero | all three |
| 5 | **Playable incident** (Ack → Investigate → Rollback → Resolve) | Observability strip | all three |
| 6 | **DAG node hover preview** | the pipeline node strip | `main.js`, `main.css` |
| 7 | **`whoami --json`** terminal command | the terminal | `main.js` |

---

## 1 — Motion is ON by default

Previously the site fell back to a static "no-motion" mode whenever the **OS** reported *reduce motion*.
It now plays full motion for everyone; the only switch is the **`motion: on/off`** toggle in the nav.

- Toggle the default: `scripts/main.js`, line ~9 → `let motionOn = true;`
- The freeze styles now live under `.no-motion` (set when the toggle is off), **not** the
  `@media (prefers-reduced-motion)` query — see `styles/main.css` → "REDUCED MOTION".
- **Tradeoff:** visitors who set *reduce motion* at the OS level still get animation. That's a
  deliberate choice for a portfolio. To respect the OS again, restore line 9 to
  `let motionOn = !reduceQuery.matches;`.

## 2 — Thesis interstitial (scroll-pinned kinetic typography)

A short pinned sequence between the Hero and the Pipeline: scattered words **converge** into a
statement, then two lines cross-fade, with a `% compiled` readout. Built on your existing
GSAP `ScrollTrigger` (`pin + scrub`) + Lenis.

- **Copy:** `index.html` → `<section id="thesis">`. Edit the three `.thesis__beat` lines.
  Beat 0's words must each stay wrapped in `<span class="tw">…</span>` (that's what scatters).
- **Length of the pin:** `scripts/main.js` → `initThesis()` → `end: '+=300%'` (≈ 3 screens of scroll).
- **Phase timing:** the `cl(p, a, b)` ranges inside `initThesis()` map scroll progress (0→1) to each
  beat. Lower numbers = earlier.
- **Reduced/no-motion:** un-pins to a clean stacked block (`.no-motion .thesis__pin` in CSS).

## 3 — Self-running terminal demo

When the terminal scrolls into view it **auto-types a tour** —
`help → whoami → git log → kubectl get skills → top → cat lendingclub.md` — then **clears** to a fresh
prompt. The instant a visitor types or taps a chip, it aborts and hands over control.

- **Command list:** `scripts/main.js` → `initTerminal()` → `const DEMO = [ … ]`.
- **Pacing:** the `dsleep(…)` values in `runDemo()` (read time per command) and the `40 + …` in
  `typeInto()` (typing speed).
- **Hint label** while running: `'● live demo · type to take over'` in `runDemo()`.
- It only runs when `motionOn` is true; otherwise the terminal prints `skills` statically (for crawlers).

## 4 — Hero statuspage (90-day uptime bars)

Replaces the old one-line hero status with a statuspage.io-style card: component rows
(**pipelines / availability / response time / coffee**) each with 90 daily bars.

- **Rows & values:** `index.html` → `<div id="statuspage">`. Each `<li class="sp__row">` has a label,
  a `<span class="sp__bars" data-deg="N">` (N = how many "degraded" amber ticks), and a `.sp__pct` value.
  *Coffee* is the intentional witty `degraded` row — change `data-deg` or delete the `<li>` to taste.
- **Bars are generated** in `scripts/main.js` → `initStatuspage()` (90 per row, `data-deg` amber ticks
  biased toward older days). Colors come from `--green` / `--amber`.
- The live SF clock (`#heroClock`) lives inside this card now — `initClock()` still drives it.

## 5 — Playable incident (the on-call moment)

A SEV-2 panel in the Observability strip. Click **acknowledge → investigate → rollback → resolve**;
each step streams real-looking logs and advances an incident clock, ending on **MTTR 47s**. A
**↻ run it again** button resets it.

- **Markup:** `index.html` → `<div id="incident">` (inside the `#metrics` section).
- **The script / logs / timings:** `scripts/main.js` → `initIncident()` → the `STEPS` array. Each step
  has a `ts` (incident-clock value shown) and `lines` of `[class, text]` where class ∈
  `cmd · d · r · g · a` (text / dim / red / green / amber). Edit these to change the story.
- **The payoff line:** the `resultEl.innerHTML = '… MTTR 47s …'` in `initIncident()`.
- Works with motion off too (logs print instantly instead of streaming).

## 6 — DAG node hover preview

Hovering a pipeline node (source / build / test / deploy / monitor) pops a card with the role, org,
`artifacts:`, and duration — so the graph previews before you commit to scrolling. Click still jumps to
the full stage card (unchanged).

- **Content:** `scripts/main.js` → `initDagHover()` → the `DATA` array (one entry per node, in order).
- Desktop only (skipped on touch, which has no hover). Styling: `.dagpop` in `styles/main.css`.

## 7 — `whoami --json`

A deep cut for devs: typing `whoami --json` in the terminal prints the page's real
**schema.org/Person JSON-LD** (the structured data crawlers read). Tab-completes.

- Defined in `scripts/main.js` → `initTerminal()` → `whoamiJson()`; it reads the
  `<script type="application/ld+json">` block in `index.html`, so it stays in sync automatically.

---

## Tech logos (toolchain + everywhere)

Logos use CSS `mask`, so each SVG is tinted by a `--brand` custom property (grayscale → brand on hover).
They now appear in three places:

- **Toolchain wall** under the terminal (`#toolchain` in `index.html`).
- **Stage cards** — brand-colored chips under each role's `artifacts:` line (`.stage__stack` in
  `index.html`; styles `.slogo*` in `main.css`). They stagger-pop in as the card scrolls into view
  (`initStageLogos()` in `main.js`) and brand-glow on hover.
- **DAG hover popover** — small tinted icons per node, defined in the `logos:` arrays inside
  `initDagHover()` (`main.js`), fading in when the card opens.

Add a tool: drop an SVG in `assets/logos/`, then either copy a `<li class="tool" style="--brand:#…">`
row (wall) / a `<span class="slogo" style="--brand:#…">` chip (stage card), pointing both
`mask`/`-webkit-mask` URLs at the new file, or add `['file.svg','#brand']` to a node's `logos:` array.

## Keyboard / power-user

- `⌘K` / `Ctrl-K` — command palette · `?` — shortcuts cheatsheet · `/` — jump to + focus the terminal
- `g` then `p/s/a/c/h/m` — jump to Pipeline / Stack / About / Contact / top / Metrics
- Konami code (`↑↑↓↓←→←→ b a`) — rollback/retro theme · terminal `theme staging|dev` — re-skin

## Print / PDF résumé

`Ctrl/⌘+P` yields a clean black-and-white single-document résumé from the live HTML
(decorations hidden, links expanded). The bundled PDF is at `assets/philip-toulinov-resume.pdf`.

---

## Quick customization cheat-sheet

| Want to change… | Edit |
|---|---|
| Thesis lines | `index.html` `#thesis` |
| Terminal demo commands / speed | `main.js` `DEMO`, `runDemo()` |
| Statuspage rows / degraded ticks | `index.html` `#statuspage` (`data-deg`) |
| Incident logs / story / MTTR | `main.js` `initIncident()` → `STEPS` |
| DAG hover text | `main.js` `initDagHover()` → `DATA` |
| Brand colors | `styles/main.css` `:root` (`--amber`, `--green`, …) |
| Respect OS reduce-motion again | `main.js` line ~9 (`motionOn`) |
