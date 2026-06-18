# v4 — Claude-Design "Career Compile" handoff: implemented, hardened, verified

_Session: 2026-06-15. Audience: whoever picks this up next (or future-me)._

This documents exactly what changed when the **claude.ai/design** handoff was implemented into the live
site, the bugs found while verifying it in a real browser, and the adversarial review + fixes that
followed. Feature/editing reference lives in `GUIDE.md`; deep history in `PROJECT-NOTES.md`.

---

## 1. Where the design came from

A handoff bundle exported from **claude.ai/design** (design hash `NSYWnyPCyUdIB48ovIEGNA`,
project `interactive-resume-design-features`). Fetching the share URL returned a **gzip'd tar** containing:
the design README, the **chat transcript** (where the real intent lives), a standalone prototype
`Career Compile.dc.html`, before/after screenshots, and a working copy `philip-toulinov-portfolio (2)/`.

Intent (from the transcript): Philip wanted a **code.storage-style scroll-pinned kinetic-typography**
showpiece — "everything merges on scroll" — rendered in his own dev-tool language (career compiling into a
deployment). The `(2)` folder was the finished design: the **same hand-written HTML/CSS/JS stack** as the
live site, a strict superset of v3, with all approved features already built. So v4 = adopt those three
code files, then verify/fix in a real browser (the design sandbox forced `prefers-reduced-motion`, so it
never exercised the motion paths).

## 2. Features adopted from the design (`GUIDE.md` documents each)

1. **Motion ON by default** — toggle is the only off-switch (was OS-`prefers-reduced-motion`-gated).
2. **Thesis interstitial** (`#thesis`, hero→pipeline) — GSAP `ScrollTrigger` `pin + scrub`, words scatter
   → converge → two crossfade beats → `% compiled` readout.
3. **Self-running terminal demo** — auto-tours real commands on scroll-in, clears, aborts on first input.
4. **Hero statuspage** — 4 rows × 90 daily uptime bars (= 360), live SF clock nested in.
5. **Playable incident** — Acknowledge → Investigate → Rollback → Resolve, streams kubectl logs, **MTTR 47s**.
6. **DAG node hover** — role/org/artifacts/duration popover + brand tool logos.
7. **`whoami --json`** — prints the page's real schema.org/Person JSON-LD. Plus per-stage tool chips.

## 3. Fixes made during verification (things the design sandbox could not catch)

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 1 | content-truth | Incident streamed `$ pagerduty ack/resolve` — a branded tool the v3 audit removed, attributed to Philip, and banned by the page's own selftest | Neutralized to a generic `$ incident ack/resolve` CLI (`scripts/main.js` `initIncident` `STEPS`). Helm kept — it's generic flavor in a `cat`'d Jenkinsfile, never a claimed skill. |
| 2 | bug | Terminal's **first Enter was eaten by the self-demo**: keydown called `abortDemo()` (clears the input) *before* reading the value, so the command ran empty (this was the lone selftest failure, `cmd whoami`) | In `initTerminal` keydown, capture the value **before** `abortDemo()` in the Enter branch. |
| 3 | mobile bug | **~200px horizontal overflow**: thesis scatter words (`.tw`, translated ±58vw at init) weren't clipped — `.thesis__beat{position:absolute}` resolved its containing block to the `position:relative` `.thesis` section, *escaping* `.thesis__pin`'s `overflow:hidden` | Added `position:relative` to `.thesis__pin` so it becomes the containing block and its clip applies. |

## 4. Adversarial review (4-lens workflow) → fixes

A background workflow ran four independent review agents. Verdicts: **content-truth = clean** (every
career fact traces to `assets/philip-toulinov-resume.pdf`); **"does not read as AI slop"**; **mobile sound**;
but a11y surfaced a **blocker** + two **highs**. Resolutions:

**Blocker — the `motion: off` toggle did nothing.** `motionOn` was hardcoded `true` and never reassigned;
the handler only set a `.motion-paused` class that had **zero CSS rules**. So the advertised accessibility
escape hatch was dead. **Fixed:** the toggle now genuinely pauses in place (preserves scroll) —
`motionOn=false`, `.no-motion`, abort demo, `lenis.stop()`, disable ScrollTrigger pins (removes the
pin-spacer), and clears the thesis inline styles so the static stacked block shows; the choice **persists**
to `localStorage` and `boot()`/`initThesis` honor it for a clean static boot; turning motion back **on**
reloads for a clean full-fidelity re-init. The auto-demo also no longer autoplays under OS reduced-motion
(WCAG 2.2.2), and a `@media (prefers-reduced-motion:reduce)` block stops the autonomous decorative loops
while leaving the user-initiated scroll showpiece intact.

**High — no `:focus-visible` anywhere** (inputs even set `outline:none`): added a global amber
`:focus-visible` ring (+ explicit rules for the palette/terminal/commit inputs).

**High — `--text-3` failed WCAG AA** (3.17:1 on the darkest surface): lifted `#6f6a62 → #8b857b`, now
**5.36 / 5.04 / 4.65:1** on bg/bg-2/bg-3, still clearly below `--text-2` (7.84:1) so the hierarchy holds.

**Medium/low polish:** `aria-live`/`role=log` on the terminal & incident output and `role=status` on the
incident result; 44px touch targets on small screens for nav ⌘K / motion toggle / terminal chips / incident
buttons; statuspage mobile bars made legible (gap `1.5px → .5px`, bars `0.46px → 1.45px`); terminal
`overflow-wrap:anywhere`; preloader skip taken out of the tab order; command-palette focus returns to its
opener on close; terminal host standardized to `philip@toulinov` (was mixed `@stack`/`@toulinov`); two weak
copy lines sharpened ("something good" → "your next release"; whoami "high-stakes parts" → "the parts of
shipping that page people at 2am").

**Deliberately NOT changed (judgment calls, surfaced for Philip to decide):** the ambient effects layer
(custom cursor, film grain, magnetic buttons, flashlight code-field) — the AI-slop critic flagged it as the
one place the "every effect is DevOps-true" discipline relaxes, but these are deliberate, shipped v3
choices (the film grain even matches the design canvas's own CRT/scanline texture), so removing them is an
aesthetic call for the owner, not a correctness fix. The thesis aphorism opener and the single in-character
`📟` emoji were reviewed and kept.

## 5. Verification (real browser, motion ON, Playwright)

- **`tests/selftest.js`: 94/94** (was 69; §12 adds guards for thesis pin/scrub/% + downstream reveal,
  statuspage = 360 bars, incident → MTTR 47s, **no branded tool in `innerText` even after the incident
  plays**, DAG hover + logos, `whoami --json` JSON-LD, no horizontal overflow, `:focus-visible` defined,
  and the **motion toggle genuinely halts motion**). **0 console errors.**
- Desktop **1440** + mobile **390**: `overflowX === 0` at top and across the full thesis scrub.
- Motion-toggle round-trip verified: ON → OFF (in place, scroll kept, beats stack, ScrollTrigger disabled,
  pin-spacer removed) → persisted → cold static boot (0 ScrollTriggers, fully readable) → ON (reload restores).
- Backup of the pre-v4 live folder: `../philip-toulinov-portfolio.BACKUP-2026-06-15-design-sync/`.

## 6. Run it

```bash
cd philip-toulinov-portfolio
python -m http.server 8099
# open http://127.0.0.1:8099/index.html
# self-test: in DevTools → fetch('/tests/selftest.js').then(r=>r.text()).then(s=>eval(s)).then(()=>runSelfTest()).then(console.log)
```
