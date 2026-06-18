# Philip Toulinov — Portfolio: Project Notes & Research

_Last updated: 2026-06-15_

This file captures **(A) where the build is right now** and **(B) the state-of-the-art interactive-web research** distilled from award-winning sites that informs it.

---

# v4 (2026-06-15) — Claude-Design "Career Compile" handoff, implemented

Source: a **claude.ai/design** handoff bundle (`interactive-resume-design-features`, design hash
`NSYWnyPCyUdIB48ovIEGNA`). Philip iterated in the design tool toward a **code.storage-style scroll-pinned
kinetic-typography** showpiece ("everything merges on scroll"), then exported the bundle (chat transcript
+ `Career Compile.dc.html` prototype + the `philip-toulinov-portfolio (2)/` working copy). The (2) folder
was a strict superset of v3 (same hand-written HTML/CSS/JS stack) with all approved features already built
onto it; v4 = adopting those three code files into the live folder, then verifying/fixing in a **real
browser** (the design sandbox forced `prefers-reduced-motion`, so it never tested the motion paths).

**Features landed (all on-theme, every effect semantically true to DevOps — the anti-AI-slop discipline):**
1. **Motion ON by default** — `motionOn = true`; the CSS freeze is rescoped from the `@media
   (prefers-reduced-motion)` query to a `.no-motion` class driven only by the nav toggle. Tradeoff
   (OS reduce-motion is overridden; users opt out via the toggle) is deliberate and documented.
2. **Thesis interstitial** (`#thesis`, between Hero → Pipeline) — GSAP `ScrollTrigger` `pin + scrub:0.6`,
   `end:'+=300%'`. Beat 0 words scatter (±58vw, blurred) → converge; crossfade to "Mine compiles clean."
   → "From a commit → to production."; slim `% compiled` readout. IO-based reveals downstream still fire.
3. **Self-running terminal demo** — on scroll-into-view auto-tours `help → whoami → git log →
   kubectl get skills → top → cat lendingclub.md`, then clears; aborts the instant a visitor types.
4. **Hero statuspage** — replaced the one-line status with a statuspage.io card: 4 rows × 90 daily bars
   (= 360), live SF clock nested inside.
5. **Playable incident** (`#incident`) — Acknowledge → Investigate → Rollback → Resolve streams real
   kubectl logs, incident clock 00:04→00:47, ends on **MTTR 47s**; `↻ run it again`.
6. **DAG node hover** — role/org/artifacts/duration popover + brand tool logos.
7. **`whoami --json`** — prints the page's real schema.org/Person JSON-LD (reads the `<script ld+json>`).
   Plus per-stage brand **tool chips** on the pipeline cards.

**Three fixes found only by real-browser Playwright (the design sandbox could not catch them):**
- **Terminal first-Enter was eaten by the self-demo.** The keydown handler called `abortDemo()` (which
  clears `input.value`) *before* reading the value for Enter, so a visitor's/test's first `Enter` ran an
  empty command. Fix: in `scripts/main.js`, capture the value *before* aborting in the Enter branch.
  (This was the one selftest failure — `cmd whoami` — and a genuine UX rough edge.)
- **Content-truth: PagerDuty re-entered via the incident.** The incident streamed `$ pagerduty ack/resolve`,
  attributed to Philip — a branded tool the v3 audit removed and the selftest's own `innerText` ban
  forbids. Neutralized to a generic `$ incident ack/resolve` CLI (story intact, no unverified vendor).
  Helm was kept — it appears only as generic flavor in a `cat`'d Jenkinsfile, never as a claimed skill.
  See [[portfolio-toulinov]] content-truth audit and [[verify-content-truth-separately-from-tests]].
- **Mobile horizontal overflow (~200px).** The thesis scatter words (`.tw`, translated ±58vw at init)
  weren't clipped: `.thesis__beat{position:absolute;inset:0}` resolved its containing block to the
  `position:relative` `.thesis` section, *escaping* `.thesis__pin`'s `overflow:hidden`. Fix: add
  `position:relative` to `.thesis__pin` so it becomes the containing block and its clip applies.
  Verified `overflowX === 0` at the top and across the full scrub, at 1440 and 375 widths.

**Self-test extended 69 → 90 checks** (`tests/selftest.js` §12): motion-on, statuspage = 360 bars,
thesis pin + scrub beats + `% compiled` + downstream pipeline reveal, incident → MTTR 47s, **no branded
tool in innerText even after the incident plays**, DAG hover popover + logos, `whoami --json` JSON-LD,
and a no-horizontal-overflow guard. **90/90, 0 console errors** in a real browser (motion ON), desktop
1440 + mobile 375. Backup of the pre-v4 live folder: `../philip-toulinov-portfolio.BACKUP-2026-06-15-design-sync/`.
Feature/edit map: `GUIDE.md`.

---

# v2 (2026-06-15) — "the dev-tool" rebuild (current shipping state)

Full rebuild to read as **premium developer tooling** (Vercel/Linear/Railway/Grafana grade), NOT an
art portfolio and NOT AI-generated. Concept kept (career = CI/CD pipeline) — execution leveled up.
Backup of v1 at `../philip-toulinov-portfolio.BACKUP-2026-06-15/`.

**Typography (THE fix — user rejected the old Fraunces serif as "AI trying to look cool"):**
- **Geist** (display/UI) + **Geist Mono** (labels/data/metrics) — Vercel's developer-tooling typeface,
  free on Google Fonts, no build. Mono-as-accent is the "I build infrastructure" signal.
- **JetBrains Mono** kept ONLY inside the terminal (slashed zero / real-shell glyphs).
- No serif anywhere. This single change kills the "AI-arty" read. (Research-validated.)

**Color = CI-semantic (one map drives DAG/terminal/dashboard so the whole site reads as one tool):**
warm ink `#0c0b10` canvas · surfaces `#14131a`/`#1d1b24` · hairline borders `rgba(237,232,224,.08/.14)` ·
text ramp `#ede8e0`/`#a9a39a`/`#6f6a62` · **amber `#f5b642` = running/active/brand** ·
**mint `#5ee6c0` = passed/healthy** · red `#f8553f` = failed · grey `#555259` = pending. Radii ≤12px,
shadows only on floating UI (palette/deploy overlay/terminal).

**Sections + signature interactions:**
1. Deploy preloader (terminal "deploy" sequence) → wipe.
2. Hero — clean Geist name (line-mask reveal), mono eyebrow, live status line, CTAs incl. `./deploy --prod`.
3. **CENTERPIECE 1 — Career pipeline DAG**: Source(Education)→Build(Catalina)→Test(Tech Mahindra,
   literally conformance testing)→Deploy(LendingClub, literally releases)→Monitor(now). Nodes run a
   deterministic queued→running→✓passed sequence (monitor stays live) when the strip enters view, with
   a filling connector + flowing packets; stage detail cards reveal on their own scroll. Mapping is authentic.
4. Observability strip — Grafana-style tiles (deploy −30%, setup −25%, shipping-since 2020, status passing)
   with count-ups, canvas sparklines, a gauge.
5. **CENTERPIECE 2 — Explorable terminal shell**: real commands — help, ls, cat <file>, whoami, skills,
   experience, education, contact, **git log** (career as commits), **git show <hash>**, **kubectl get skills**
   (pods), **top/htop** (skill monitor w/ htop bracket-bars), neofetch, theme <env>, bonjour (FR), man,
   history, sudo easter eggs, **Tab-completion**, ↑/↓ history. Auto-runs `skills` on load (skimmers/crawlers).
6. About / whoami — de-AI'd voice (from the resume review) + mono facts panel.
7. Contact — clean CTA, magnetic links, click-to-copy email.
8. Footer — build status + FR sign-off.

**Polish set (all built):** ⌘K command palette (fuzzy, keyboard nav, shared actions — jump/copy/résumé/
LinkedIn/run deploy/theme/sound/motion) · contextual spring cursor + magnetic (fine-pointer only) ·
**cursor-lit code field** (varied, NON-repeating CI/CD config that scrolls with the page; tokens varied
per pass so no identical blocks; flashlight idle-drifts on load + after 5s idle, follows instantly on use) ·
env switcher (prod amber / staging cyan / dev magenta, persisted) · Web-Audio sound (off by default) ·
"deploy this site" overlay · build-progress bar · nav hide-on-scroll.

**Robustness fixes vs v1:**
- Reveals/pipeline/counters/sparklines moved from ScrollTrigger to **IntersectionObserver** → fire reliably
  on deep-links and ⌘K jumps (v1's "section stays hidden on jump" bug is gone).
- TDZ bug fixed (boot() now invoked at end of file, after module `let`s init).
- Résumé bundled at `assets/philip-toulinov-resume.pdf`; og.svg re-rendered without serif.

## v2.1 — differentiators (research-ranked, on-brand, honest, no backend)
Added to separate from competition (kept everything above):
- **Clickable DAG nodes** → smooth-jump to that role's card + amber flash.
- **Terminal quick-command chips** (help · git log · kubectl get skills · top · cat · deploy) for visitors
  who won't type, + a `deploy` command wired to the deploy overlay.
- **Keyboard shortcuts**: `g`+p/s/a/c/h/m navigation, `/` focus terminal, `?` opens a cheatsheet overlay
  (also in ⌘K). Typing-guarded so it never fires inside the terminal/form.
- **Honest live status** (footer): "all systems operational · shipped <relative> · session <uptime>" with a
  witty honest tooltip — NO fabricated SLA/uptime (the one true uptime = this tab's session). Live SF clock
  in the hero. Per-stage "passed · 0.Xs" durations.
- **`git commit` → `git push` contact form** (terminal-styled): subject→commit summary, body, author email;
  animates a push then opens a prefilled `mailto:` — 100% backend-free. The theme as a working feature.
- **Print/PDF résumé** (`@media print`): Ctrl/⌘+P yields a clean single-doc B&W résumé from the live HTML
  (decorations hidden, links expanded). Complements the bundled PDF.

## v2.2 — best-of-research wave (custom font + unique animations)
- **Custom display font**: **Bricolage Grotesque** (variable, distinctive, professional) for the hero name,
  section titles, contact headline — a voice that isn't the generic Inter/Geist. Geist stays for UI/body,
  Geist Mono + JetBrains Mono for technical.
- **Signature kinetic type**: the hero name "compiles" from weight 300→800 (variable-font axis sweep) as
  each word rises. Section labels **decode/scramble** in on reveal (terminal style).
- **Stage build-log micro-stream**: each pipeline stage streams a tiny CI log (`$ pytest` → `✓ passed`)
  when it runs — reinforces the theme.
- **Env switcher in nav** (prod→staging→dev) with a **View-Transitions clip-path bloom** from the chip
  (graceful instant fallback; respects reduced-motion).
- **Optimistic copy-to-clipboard** (email) with icon→"✓ copied" morph + `aria-live` announce.
- **Reachability**: "probably awake/asleep in SF + you're Nh ahead/behind" (computed from real time).
- **Pulsing presence dot** on the "passing" status tile.
- **Console hire-me banner** (DevTools) + **Konami code → rollback/retro mode** (orange theme, gated by reduced-motion).
- **In-character 404** (`404.html`): `cd: no such file or directory` + back-home (deploy host maps 404→this).
- **CI-ready**: `window.DEPLOYED_AT` (ISO) overrides the shipped-ago timestamp at deploy time.

**Validation:** `tests/selftest.js` — `await runSelfTest()` in console. **66/66 pass desktop + mobile
(~520px), 0 real console errors** (one info-level log = the commit form's mailto + the console hire-me
banner). Covers all of the above plus everything from v2/v2.1.

**Known environment quirk (NOT a site bug):** Playwright headless *cropped-viewport* screenshots come back
black after a programmatic scroll (compositor capture artifact). Use `fullPage:true` screenshots (render
correctly) + DOM assertions / selftest to validate. The real page renders correctly everywhere.

**Open / nice-to-have next:** real GitHub contribution heatmap (needs handle); View-Transitions section
morphs; PWA + styled 503 page; deploy to a real domain.

## v3 — content-truth audit, readability fix, toolchain logos
- **NO-FABRICATION audit (advisor-driven):** swept every number/date/company/claim against
  `assets/philip-toulinov-resume.pdf`. All major claims verified true (−30% deploy, −25% setup, all
  hardware: Keysight E7515B, Anritsu MD8430A, Qualcomm Snapdragon, Lauterbach Trace32, R&S CMW500).
  **Removed invented specificity** that wasn't on the résumé: a whole fabricated *observability* skills
  category (Splunk / New Relic / PagerDuty / CloudWatch), plus TestNG, JFrog Artifactory, "GitHub
  Enterprise" (→ GitHub, GitLab), Helm (skills only — `helm` stays in the shell demo), and the "Layer-1"
  qualifier on the 5G/RRM line. A **selftest guard** now fails if any removed token reappears on the page.
- **Readability fix** (user reported code bleeding through copy): the cursor-lit `.codefield__glow` was
  `opacity:1` full-amber and competed with text. Dropped glow → `.34` + lighter shadow, base → `.02`,
  spotlight tint → `.028`, and added a **`var(--bg)` text-shadow halo** behind all naked copy
  (`.hero__lede/.hero__status/.sec__*/.about__*`) so the code stays a *texture*, never foreground.
- **Toolchain logo grid** (`#toolchain`, Stack section): 15 résumé-backed brand logos (vendored
  monochrome SVGs in `assets/logos/`, recolorable via CSS `mask`). Muted grey default → **brand colour on
  hover/tap**; a **reveal wave** flashes each to its brand colour on scroll-in so touch sees colour too.
  Responsive (auto-fill grid; 3 cols @ 390px). Gotcha: `url()` in a CSS custom property consumed in
  `main.css` resolves relative to the *stylesheet* (→ `styles/assets/...` 404) — mask is set **inline**
  on each icon so it resolves against the HTML base.
- **Perf:** flashlight rAF now dirty-checks `--mx/--my` and skips the write (and the codefield repaint)
  when nothing moved.

**Validation:** **69/69 selftest pass** desktop (1440) + mobile (390), **0 console errors**, no mobile
horizontal overflow. Logos load (no 404s). Hero copy crisp with the flashlight parked on it.

---

# PART A — Project status

## The concept
An interactive personal site for **Philip Toulinov**, framed as **"a career rendered as a CI/CD deployment pipeline."** The metaphor is authentic to his profession (Release / DevOps engineer), gives every animation a reason to exist, and avoids the generic "creative portfolio" look. Tone: a thoughtful engineer — literary serif × terminal mono.

## Subject (verified from the resume PDF, char-by-char)
- **Philip Toulinov** — Release & Software Engineer, San Francisco Bay Area
- Phone **+1 (415) 823-7537** · Email **toulinov.philip@yahoo.com** · LinkedIn **linkedin.com/in/ptoulinov**
- **LendingClub** — Release Engineer · Hybrid · Dec 2021 – Jan 2024 (cut deploy times 30%, Mabl test automation, GitHub platform, monitoring/incident response)
- **Tech Mahindra** — Software & Device Engineer · On-site · Sep 2021 – Dec 2021 (LTE/5G NR Layer-1 + RF RRM conformance; Keysight E7515B, Anritsu MD8430A, R&S CMW500, Keysight Nemo; Lauterbach Trace32 on Qualcomm Snapdragon; −25% setup time)
- **Catalina USA** — Software Engineer Intern · Remote · Jun 2020 – Sep 2020 (Selenium, Jenkins CD, Docker IaC, JIRA)
- **Education:** B.S. Computer Science, Humboldt State University (2021); Lycée Français La Pérouse (bilingual EN/FR)
- **Skills:** CI/CD (Jenkins, GitHub Actions, GitLab CI/CD), GitOps, Kubernetes, AWS, Docker, Terraform, Python/Java/JS/C++, Selenium, Mabl, Pytest, JUnit, Maven, Gradle, SQL
- _No fabrication anywhere — every fact above is on his resume._

## Stack (deliberately no framework / no build step)
- **Hand-written HTML + CSS + ES-module JS** — runs from any static server, no toolchain. Hand-rolled CSS (not Tailwind) so it reads as human-made and unique.
- **Vendored locally** (no runtime CDN, self-contained, test-stable): `vendor/gsap.min.js`, `vendor/ScrollTrigger.min.js`, `vendor/lenis.min.js` (GSAP 3.12.5, Lenis 1.1.14).
- **Hand-written effects** (no extra deps): cursor-lit code-field background, custom cursor + magnetic, interactive terminal, deploy preloader.
- Fonts (Google Fonts + system fallback): **Fraunces** (display serif), **Space Grotesk** (UI), **JetBrains Mono** (terminal/labels).

## File structure
```
philip-toulinov-portfolio/
  index.html            markup, SEO meta, JSON-LD Person, <noscript> fallback
  styles/main.css        full design system + all sections + responsive + reduced-motion
  scripts/main.js        engine: preloader, cursor, Lenis, reveals, pipeline, terminal, code-field
  vendor/                gsap.min.js, ScrollTrigger.min.js, lenis.min.js
  assets/                favicon.svg, og.svg
  README.md              run instructions
  PROJECT-NOTES.md       this file
```

## Design system
- **Palette (intentionally non-default — not black+electric-blue):** warm ink `#0c0b10`, paper `#ede8e0`, signature **signal-amber** `#f5b642`, **mint** `#5ee6c0` reserved for "✓ passed" / success states (reads like CI status).
- **Type:** Fraunces serif for the name + section titles; Space Grotesk for body/UI; JetBrains Mono for terminal, labels, the code field.
- Subtle film-grain overlay for texture; `::selection` in amber.

## Sections & features implemented
1. **Deploy preloader** — a terminal "deploy" sequence (`philip deploy --env production` → steps tick green → "deployed in 1.2s") then wipes to reveal the site. Skippable; instant under reduced-motion.
2. **Hero** — kinetic serif name reveal (line-mask `fromTo yPercent`), mono eyebrow, italic-amber lede ("…fast, tested, and boringly reliable."), live status line, magnetic CTAs.
3. **Cursor-lit code field (background)** — a faint full-page field of real CI/CD config (GitHub Actions / Jenkinsfile / Terraform / Dockerfile / GitLab CI) that **illuminates in amber around the cursor** like a flashlight. (⚠️ being refined — see Open items.)
4. **About** — editorial serif statement + first-person body (real achievements) + mono facts panel (`based / langs / study / focus / status: open to work`).
5. **Pipeline (experience)** — vertical pipeline spine with a scrubbed amber→mint fill; each role is a "stage" that animates **queued → running → ✓ passed** on scroll, with staggered bullet reveals, count-up metrics (30%, 25%), and an `artifacts:` tool line.
6. **Interactive terminal (stack)** — a **real terminal** you can type into: `help`, `skills`, `whoami`, `experience`, `education`, `contact`, `bonjour` (French easter egg), `clear`, `ls`, `sudo`, command history (↑/↓), unknown-command handling. Auto-runs `skills` on load so the content is visible for skimmers + crawlers.
7. **Contact** — big serif CTA ("Let's ship something good."), magnetic email/phone/LinkedIn links, email copy-to-clipboard.
8. **Footer** — build status line + French sign-off (`// construit avec soin à San Francisco`).
- **Global:** Lenis smooth scroll, custom blend-mode cursor + magnetic elements, top scroll/"build" progress bar, nav hide-on-scroll-down, `motion: on/off` toggle.

## Accessibility & SEO
- Full `prefers-reduced-motion` path (animations collapse, content shows immediately, cinemagraph/ambient motion off).
- Custom cursor only on fine-pointer devices; touch gets native behavior.
- Semantic landmarks, keyboard-operable terminal, `<noscript>` fallback listing skills/education.
- SEO: title/description/OG/Twitter, canonical, **JSON-LD Person** (jobTitle, email, phone, sameAs LinkedIn, alumniOf, knowsLanguage en/fr, knowsAbout).

## Verified working (via Playwright local tests)
- **Zero console errors / warnings** on load.
- Libraries load and init; WebGL-free (code field is DOM+CSS-mask, very reliable).
- Hero reveal, About, Pipeline stage animation (queued→passed + counters), Contact, and the **interactive terminal all render and respond** (typed `whoami` / `bonjour` / unknown-command confirmed).
- Smooth scroll + nav + build bar functioning.

## Bugs found & fixed during the build
- **GSAP/CSS transform desync** — hero/contact words used CSS `translateY(110%)` + GSAP `yPercent:0` (a no-op because GSAP read the matrix as `yPercent:0`). Fixed with a single `gsap.fromTo(yPercent:120→0)` that GSAP fully owns.
- **`ScrollTrigger.batch` reveals didn't fire** for elements jumped into view (deep-link/programmatic). Replaced with **per-element ScrollTriggers** (`once:true`), which also fire on `refresh()` for already-in-view elements.
- **Lenis driven twice per frame** (manual rAF loop _and_ `gsap.ticker`) → scroll jitter. Now a **single** `gsap.ticker` driver.
- **Workflow sandbox** has no `URL` constructor (separate research tooling) — noted for future scripts.

## Open items / current focus
- **Code-field background polish (in progress).** Full-width columns made it cover the whole page but read as a **uniform "wall of code"** (user feedback: "everything is the same … looks like shit"). Next direction options:
  1. Make the base **nearly invisible** so the page reads clean/dark and the **flashlight reveal is the star** (code appears only around the cursor).
  2. Add **variety** so it isn't repetitive — interleave a few large faint **tech marks (GitHub, Docker, Jenkins, Kubernetes, Terraform, AWS)** at varied positions, revealed by the cursor.
  3. Possibly make the field **scroll with the page** so different sections reveal different content (vs. one fixed backdrop everywhere).
- **Reveal-on-deep-link** edge case: a programmatic _immediate_ jump doesn't emit scroll events, so a section can stay hidden until the first real scroll. Natural scrolling works; consider a load-time "reveal anything already in viewport" pass for robustness.
- Mobile pass not yet visually verified end-to-end (responsive CSS is in; needs a device-width screenshot review).

## User feedback log (what was asked → done)
- Remove the scrolling tech **marquee** → ✅ removed.
- Replace the **WebGL glow background** with a **code/terminal reveal on mouse move** → ✅ cursor-lit code field.
- Replace the **skills chip grid** (felt AI-generated) with something interactive → ✅ real interactive terminal.
- "More interactive sections from the research" → ✅ code-field + live terminal (both interactive).
- Code only revealed on the **left** → ✅ made full-width … but now reads as a uniform wall → **refining** (see Open items).

## How to run
```bash
cd philip-toulinov-portfolio
python -m http.server 8080      # or: npx serve .
# open http://localhost:8080
```

---

# PART B — What I learned from other websites (SOTA interactive UI/UX)

Research method: parallel web research across **10 dimensions** (web search + page fetch, 2025–2026 sources — Awwwards/FWA, Codrops, studio blogs, MDN, web.dev, GitHub), plus **live browser inspection** of reference sites with Playwright (network + JS globals + DOM) to verify how things are actually built.

> The survey was originally framed for an art-portfolio brief, so some examples mention "paintings/timeline." The **techniques, libraries, and references are general-purpose** and several are already used in this site.

## Verified live by me (empirical, Playwright/fetch)
- **lenis.dev** — ships **Lenis** (html class `lenis`), a **custom cursor** (`has-custom-cursor`), built on **Next.js / Turbopack**. _(Confirmed via live JS globals + DOM.)_
- Award context (web search/fetch, 2025–2026): **Lando Norris** (Awwwards Site of the Year 2025, OFF+BRAND — cinematic scroll + 3D helmet tracking), **Messenger** (Awwwards SOTY 2025 — full **WebGL** physics planet), **Bruno Simon 2025** (Three.js + Cannon.js drivable 3D world, SOTM Jan 2026), **Obys Agency** (kinetic typography), **Igloo.inc** (scroll-driven 3D journey), **Active Theory** (WebGL transitions), **Scout Motors / Terminal Industries / Microsoft.ai / Cartier** (immersive 3D & shader storytelling).

## The dominant award-winning stack (2025–2026)
- **GSAP** (ScrollTrigger, ScrollSmoother, Draggable, Observer, Flip, SplitText — **SplitText is free since Apr 2025**) — still owns the high-end scroll/animation tier.
- **Lenis** (4kb smooth scroll by darkroom.engineering) on a **single rAF loop** synced to `gsap.ticker`, with `lenis.on('scroll', ScrollTrigger.update)`.
- **Three.js / React-Three-Fiber / OGL** (+ GLSL) for WebGL; **the DOM→WebGL pattern**: keep real DOM elements for SEO/a11y, overlay 1:1 textured planes for effects.
- **Native platform features** rising fast: **CSS scroll-driven animations** (`animation-timeline: scroll()/view()`, ~85% support), the **View Transitions API** (cross-document + SPA shared-element), `content-visibility`, variable fonts.

---

### 1. Scroll-driven storytelling
Two camps: the **GSAP ecosystem** (pinned narratives, horizontal galleries, scrubbed sequences, velocity-reactive motion) and **native CSS scroll-driven animations** (progress bars, reveals, parallax with zero JS on the compositor thread). Best practice = hybrid: native CSS for cheap effects (battery/perf), GSAP/WebGL for signature moments, all gated behind `prefers-reduced-motion`.
- **Pinned vertical-scroll → horizontal track** — GSAP `ScrollTrigger {pin:true}` + tween `xPercent:-100`, `scrub:true`; snap-compatible with CSS scroll-snap. _(used here for the pipeline feel)_
- **Zero-JS scroll progress + reveals** — `animation-timeline: scroll()` / `view()`, `animation-range`, `timeline-scope`. Refs: Josh W. Comeau "Scroll-Driven Animations"; MDN; Builder.io view-timeline guide.
- **Scroll-scrubbed shader/sequence transitions** — OGL/Three.js fragment shader mixing two textures by a scroll-driven uniform (or canvas image-sequence, Apple-style). Refs: Codrops distortion/grain-on-scroll, OGL rotating gallery.
- Libraries: GSAP, ScrollTrigger, Draggable, Lenis, OGL/Three, native CSS.

### 2. WebGL / 3D / shaders
- **DOM-synced WebGL plane gallery** — each item stays real DOM (SEO/a11y/lazy-load) with a Three.js plane positioned 1:1 via `getBoundingClientRect` + "1px = 1 unit" camera; shader effects on top. Ref: Codrops "Horizontal Parallax Gallery: From DOM to WebGL" (2026).
- **Scroll-velocity distortion** (planes warp / RGB-shift on fling, settle crisp) — feed smoothed scroll velocity into a vertex/fragment shader. Ref: Codrops "Scroll-Reactive 3D Gallery … Velocity."
- **Hover RGB-shift / displacement** per element. **VideoTexture** so looping video clips become shader textures. **Depth-map 2.5D parallax** (single image + grayscale depth → `uv + mouse*depth`). 
- Libraries: three, @react-three/fiber + drei, OGL, vite-plugin-glsl; offline depth via Depth Anything V2 / MiDaS / TensorFlow.js Portrait Depth.

### 3. Image & gallery interactions
- **FLIP shared-element morph** thumbnail→lightbox — `framer-motion` `layoutId` (near-zero cost) or **GSAP Flip** (`Flip.getState` → mutate → `Flip.from`).
- **Image hover distortion** (gooey/displacement/RGB-shift) — curtains.js / OGL / Three.js + GLSL displacement map driven by a tweened `uHover` uniform. Refs: Codrops motion-hover & gooey-hover (akella).
- **View Transitions API** (cross-document + SPA) — `@view-transition {navigation:auto}`, per-element `view-transition-name` + shared `view-transition-class`. Native, no library.
- **Draggable infinite / pan-anywhere canvas** — R3F renders only a 3×3 chunk neighborhood for pseudo-infinity. Ref: Codrops "Infinite Canvas" (2026).
- Libraries: framer-motion, GSAP Flip, curtains.js/OGL/Three, native View Transitions, R3F.

### 4. Cursor & micro-interactions
- **Contextual spring cursor** — one fixed `pointer-events:none` element; track pointer with `useMotionValue` + `useSpring` (damping ~25-30, stiffness ~200-400); morphs to "View / Drag / label." Canonical: **Jesper Landberg**, CUSP, Dorian Lods.
- **Magnetic buttons/thumbnails** — translate element by a fraction (0.2–0.4) of cursor-offset-from-center; framer-motion springs or `gsap.quickTo` with `elastic.out`. _(used here)_
- **`mix-blend-mode: difference` cursor** — white cursor auto-inverts over any background, always legible. _(used here)_
- **Scroll/drag-velocity skew & scale** — read Lenis/`useVelocity`, map through a spring into skew/scale, settle.
- Libraries: framer-motion (`useMotionValue/useSpring/useVelocity`), GSAP `quickTo`, pure CSS `mix-blend-mode`.

### 5. Page transitions & smooth scroll
- **Lenis on a single rAF loop synced with GSAP** — `autoRaf:false`, `gsap.ticker.add(t=>lenis.raf(t*1000))`, `gsap.ticker.lagSmoothing(0)`, `lenis.on('scroll', ScrollTrigger.update)`. _(this exact pattern is now used here)_
- **Horizontal-axis Lenis** (`orientation:'horizontal'`) or the GSAP pin pattern for horizontal timelines.
- **Shared-element morph** via GSAP Flip or **View Transitions API**; React canary `<ViewTransition>` + `addTransitionType` for declarative route morphs.
- Libraries: lenis (+ react-lenis), gsap (ScrollTrigger/Flip), native View Transitions, Barba.js/Swup (route lifecycle).

### 6. Kinetic typography & variable fonts
- **Line-mask reveal** (the award-site workhorse) — SplitText `type:'lines'`, `overflow:hidden` wrappers, `gsap.from yPercent:110→0`, tight char stagger (~0.02s, cascade < 1s). _(used here for hero/contact)_
- **Variable-font axis animation** — animate `font-variation-settings` `wght`/`wdth`/`slnt` (hardware-accelerated, fractional values interpolate).
- **Scramble / decode reveal** — GSAP `ScrambleTextPlugin` (free).
- **Word/line stagger on scroll** — framer-motion variants + `whileInView` (no new dep).
- **Obys-style type-as-layout** — oversized type, strict grid, `clamp()` fluid scale. Ref: Obys Typography Principles microsite.
- Libraries: GSAP (SplitText, ScrambleText, free since 2025), SplitType, framer-motion, CSS `font-variation-settings`.

### 7. Generative, ambient & audio-reactive
- **Ordered (Bayer) dithering** ambient backdrop — fbm noise quantized through a Bayer matrix in a fullscreen-quad fragment shader (the dominant 2025–26 aesthetic; evokes print/engraving). Ref: Codrops Bayer Dithering guide.
- **Halftone / CMYK** image post-effect; **animated noise / mesh-gradient** ambient color field (Paper Shaders `MeshGradient`/`GrainGradient` are near-zero-dep drop-ins).
- **Mouse flowmap / displacement** — velocity-stamped flow render-target sampled to deform content (OGL Flowmap). 
- Libraries: Three.js/OGL + GLSL, **Paper Shaders** (`@paper-design/shaders-react`), ShaderGradient.

### 8. AI-native living media & 2.5D depth
- **Real-time depth-map 2.5D parallax** (the anchor) — original texture + grayscale depth sidecar; shader `texture(img, uv + mouse*depth.r)` so flat images gain mouse/gyro-reactive depth. Generate depth offline with **Depth Anything V2 (ONNX/transformers.js)**. Ref: akella/fake3d.
- **Modern image-to-video cinemagraphs** — still → i2v → looping muted autoplay MP4, with 2026 models (Kling 3.0, Veo 3.1, Runway Gen-4.5).
- **OpenSeadragon gigapixel deep-zoom** — tile high-res images into a DZI pyramid (libvips `dzsave`) for infinite brushstroke-level zoom (low difficulty, high impact).
- **Real-time relighting** via 2.5D normal maps (movable light uniform).
- Libraries: OGL/three/R3F + GLSL, @huggingface/transformers, OpenSeadragon, libvips, ffmpeg.

### 9. Performance, accessibility & craft
- **Lenis horizontal timeline with reduced-motion auto-disable** — same scroll value powers snap; `translate3d` only.
- **IntersectionObserver play/pause manager** for looping video (`autoplay muted loop playsinline preload=none poster=…avif`) — only plays on-screen + tab-visible; AVIF poster is the LCP candidate.
- **`prefers-reduced-motion`** freezes cinemagraphs to their poster (CSS first, JS-gated manager second).
- **AVIF/WebP `<picture>` + srcset/sizes + `fetchpriority`** for the LCP image; **`content-visibility:auto` + `contain-intrinsic-size`** to skip off-screen layout/paint.
- Refs: web.dev (content-visibility), Chrome muted-autoplay, Mux video best-practices.

### 10. Reference landscape & tooling
- **Pattern of the era:** DOM-driven layout (SEO/a11y) mirrored into a WebGL layer (Three.js/OGL); Lenis smooth scroll; GSAP ScrollTrigger/Observer/Draggable unifying wheel+drag+snap; GSAP-animated shader uniforms for signature effects (ripple-on-click, distance-from-center DoF blur, liquid reveals).
- **Studios to study:** Active Theory, Lusion, Obys, Resn, Immersive Garden, Basement, darkroom.engineering, OFF+BRAND.
- **Technique source of record:** **Codrops** (tympanus.net) — most demos here are from Codrops 2024–2026.
- **Toolchain:** GSAP, Lenis, Three.js / R3F / drei, OGL, Paper Shaders, SplitText/SplitType, Theatre.js, Rive, Spline; native CSS scroll-driven animations + View Transitions.

---

## Direction options for "even cooler" (pick to lean into)
- **A — Cinematic Living Gallery:** AI living-media + depth-map 2.5D parallax + film-grade scroll choreography (extends the living-media idea).
- **B — WebGL Immersive Museum:** DOM→WebGL plane gallery, shader image transitions, distance-from-center blur, spatial audio (highest wow, highest effort).
- **C — Editorial Scrollytelling:** kinetic typography + scroll-driven narrative, lighter-weight, fast, SEO-friendly.
- **D — Tactile Interactive Canvas:** draggable/inertial canvas + contextual spring cursor + magnetic micro-interactions + buttery smooth scroll (extends what this site already does).

_(This Philip site currently lives closest to **C + D**: editorial type, smooth scroll, custom cursor, the interactive terminal, and the cursor-lit code field.)_

---

# PART C — State-of-the-art upgrades to add (the "much better" roadmap)

The site already has a strong, coherent identity (career = CI/CD pipeline, terminal aesthetic). The way to go from "good" to "best-in-class" is **not** more generic effects — it's leaning **harder into the engineer/pipeline theme** with a couple of unforgettable, genuinely-interactive centerpieces, then polishing the craft. Each item below is tagged **Impact** (wow) / **Effort** and includes _why it's specifically Philip_ + how to build it (technique + library from Part B).

> Recommended path: ship **1–2 Tier-0 centerpieces** + the **Tier-1 polish set**. That alone beats almost anything templated.

## Tier 0 — Signature centerpieces (pick 1–2; these define the site)

### 0.1 — Live 3D CI/CD pipeline graph (career as an interactive DAG) ★ flagship
- **What:** Replace/augment the experience section with a real, navigable **pipeline DAG** — nodes (Source → Build → Test → Deploy → Monitor, mapped to roles/skills), animated flowing connectors, packets traveling the edges, nodes lighting **pending → running → ✓ passed** as you scroll or click. Think Jenkins Blue Ocean / GitHub Actions graph / Argo CD, but cinematic.
- **Why it's you:** You _build pipelines_. A literal interactive pipeline of your career is unmistakably yours and impossible to mistake for a template.
- **Build:** React-Three-Fiber + drei (or a 2D canvas/SVG version for lower effort), GSAP for sequencing, instanced lines with a flow shader for the "data moving through the pipe." Keep a DOM fallback list for SEO/a11y.
- **Impact: very high · Effort: high** (medium if done in animated SVG/canvas instead of WebGL).

### 0.2 — The terminal becomes a real, explorable shell
- **What:** Grow the current terminal into a believable mini-OS: a **fake filesystem** (`ls`, `cd experience/`, `cat lendingclub.md`), **career as git** (`git log --oneline` → commits = milestones; `git show <hash>` expands a role), `kubectl get skills`, an `htop`-style **system monitor** where skills are "processes" with CPU/mem bars, **tab-completion**, command history, and `man <cmd>`.
- **Why it's you:** You already loved the terminal; this turns it into the site's playground and proves you actually built this.
- **Build:** Extend `initTerminal()` — a command registry + a small in-memory FS object + a tokenizer for args; `requestAnimationFrame` for the htop bars. Pure JS, no deps.
- **Impact: very high · Effort: medium.**

### 0.3 — "Deploy this site" live pipeline run (meta + delightful)
- **What:** A button that runs a **fake-but-convincing deploy** in an overlay: streaming logs, `lint → test → build → push → deploy`, a progress DAG lighting up, ending "✓ deployed to production in 1.2s." A playful, self-aware nod to what you do.
- **Why it's you:** The whole site is a deployment metaphor — let visitors trigger one.
- **Build:** Scripted log stream (timed `print()`), reuse the preloader styling, optional Web Audio "success" chime.
- **Impact: high · Effort: low.**

## Tier 1 — High-impact interaction & polish

### 1.1 — Observability dashboard for skills & impact
- **What:** A Grafana/Datadog-style panel: animated **metrics** (deploy time −30%, setup time −25%, "uptime" = years shipping), **sparklines**, gauge for "release confidence," a heatmap. Count-up + live-feel charts.
- **Why it's you:** You did monitoring & incident response — show the SRE brain.
- **Build:** Canvas or lightweight SVG charts + GSAP count-ups + `IntersectionObserver`. No heavy chart lib needed.
- **Impact: high · Effort: medium.**

### 1.2 — ⌘K command palette (Raycast / Linear style)
- **What:** Press ⌘K (or click) for a fuzzy command palette: jump to sections, run terminal commands, copy email, download résumé, switch theme, "hire me." The most "I live in dev tools" signal there is.
- **Build:** Small custom palette (input + fuzzy filter + keyboard nav); no dependency required.
- **Impact: high · Effort: low–medium.**

### 1.3 — Contextual spring cursor + magnetic everything (upgrade current)
- **What:** Cursor morphs to context labels ("open / drag / run / copy"), spring-trails, inverts via `mix-blend-mode`, with magnetic pull on all interactive elements. (Jesper Landberg / CUSP tier.)
- **Build:** Upgrade `initCursor()` with spring lerp + per-target labels (already partway there).
- **Impact: medium–high · Effort: low.**

### 1.4 — Fix + elevate the cursor-lit background (current open item)
- **What:** Make the base code **nearly invisible** (clean dark page) so the **flashlight reveal is the moment**; add variety with a few large faint **GitHub / Docker / Jenkins / Kubernetes / Terraform** marks at varied positions; optionally make it **scroll with the page** so each section reveals different content.
- **Build:** Lower base opacity; add positioned SVG marks in the base+glow layers; offset the mask by scroll if it scrolls.
- **Impact: medium–high · Effort: low.**

### 1.5 — Section transitions (View Transitions API / GSAP Flip)
- **What:** Smooth shared-element morphs between sections/views (e.g., a pipeline stage expands into a detail panel) instead of hard cuts.
- **Build:** Native View Transitions (`@view-transition`, `view-transition-name`) or GSAP Flip.
- **Impact: medium · Effort: medium.**

## Tier 2 — Depth, real data & delight

### 2.1 — Live GitHub data
- **What:** Pull your real **contribution heatmap** + recent repos via the GitHub API and animate them ("commits" fit the theme perfectly). Live data reads as authentic, not decorative.
- **Build:** GitHub REST/GraphQL (or a cached JSON build step) + canvas/SVG heatmap. **Needs:** your GitHub handle.
- **Impact: high · Effort: medium.**

### 2.2 — Environment switcher + French mode
- **What:** A `prod / staging / dev` switch that re-themes the site (amber=prod, cyan=staging, magenta=dev) — playful and on-brand. Plus a **FR/EN toggle** (you're bilingual, Lycée Français) that translates the UI — a strong, true-to-you personal touch.
- **Build:** CSS custom-property theme sets; a small i18n string map for FR/EN.
- **Impact: medium–high · Effort: medium.**

### 2.3 — Tasteful sound design (off by default)
- **What:** Soft terminal keystroke ticks, hover blips, a "deploy success" chime — with a clear sound toggle. Adds a premium, tactile layer top sites use.
- **Build:** Web Audio API; tiny synthesized clicks (no asset downloads); respect a muted default + toggle.
- **Impact: medium · Effort: low.**

### 2.4 — Kinetic variable-font headings + name scramble
- **What:** The big serif name **scrambles/decodes** on load ("compiling…") and headings animate **font weight** on scroll/hover (variable-font axis).
- **Build:** GSAP ScrambleTextPlugin (free) + animate `font-variation-settings`.
- **Impact: medium · Effort: low.**

### 2.5 — "Build running" pipeline with streaming logs
- **What:** Upgrade the experience stages so each, on enter, shows a **spinner → streaming build log lines → ✓ passed (timing)**, like watching a real CI run.
- **Build:** Extend `initPipeline()` with timed log injection per stage.
- **Impact: medium · Effort: low–medium.**

## Tier 3 — Craft & ship-readiness (table stakes for "best")

- **3.1 Performance to CWV 100** — AVIF/WebP, `content-visibility:auto` + `contain-intrinsic-size`, `fetchpriority` on LCP, lazy everything, full `prefers-reduced-motion` parity. _(low effort, big credibility)_
- **3.2 PWA** — installable, offline, app manifest; a **styled "incident-page" 404** ("503 — this page is being redeployed"). _(low–medium)_
- **3.3 Easter eggs** — Konami code, `sudo` jokes, a hidden mini-game, a `secret` command. _(low; personality)_
- **3.4 Real generated OG image** + analytics + deploy to a real domain (Netlify/Vercel/Cloudflare Pages) so it's shareable for applications. _(low)_

## If we only do three
1. **0.2 Explorable terminal shell** (you love it, it's unique, medium effort)
2. **0.1 Pipeline DAG** _(or 1.1 Observability dashboard if we want lower effort)_ — the on-theme centerpiece
3. **1.2 ⌘K command palette** + **1.4 background fix** + **3.1 performance** — the polish that says "this person ships."

_These map directly to the libraries/techniques in Part B; nothing here needs to be invented from scratch._
