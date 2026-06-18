# Interactive upgrade — 2026-06-17

An "immersive" interactive pass, driven by a 9-agent design panel + direct direction. **Additive and gate-safe**: self-test **103/0**, axe **0 WCAG A/AA**, `npm run build` OK, no mobile horizontal overflow (320–1280px), **zero console errors**. Identity locked (warm-ink + amber, Bricolage/Geist/Geist-Mono/JetBrains-Mono, deploy-pipeline concept). Pre-change backups in `.sota-backup/`.

## What shipped

**Foundation**
- `ScrollTrigger.refresh()` now fires on `resize`/`orientationchange` (the pinned `thesis` could drift before).
- Sparkline canvas `devicePixelRatio` capped at 2 (less fill-rate on hi-DPI, identical geometry).

**Motion** — stays **always on**, never auto-off; OS reduce-motion is intentionally not honored and there is no toggle (deliberate product decision).

**Code-field flashlight** — always drifting, a touch faster, and resumes its autonomous orbit 2s after the last scroll **or** mouse move.

**Terminal**
- Every command output is colorized (added cyan/magenta to the CI-semantic palette; colorized the previously-plain `ls/pwd/whoami/bonjour/cat/man/date/echo`). Asserted text strings preserved.
- De-congested spacing (`line-height` 1.7 → 1.85, row/command margins).
- The self-running demo **loops continuously** past cycle 1, pausing while off-screen or the tab is hidden, and still aborts the instant you type.

**A working shell in every major section** — contextual, not five clones: `#about` → `whoami`/`cat about.txt`, `#builds` → `git log`/`experience`, `#contact` → `hire`/`contact`. Hero + stack already had one (5 total). Unique ids, aria-labelled inputs.

**Decode-on-hover** — the terminal "DECRYPTED" scramble now fires on hover/focus across section labels, the hero eyebrow, and tool names (width-locked so it never reflows).

**Headline "compile" reveal** — each section title builds into place: characters stagger up while the variable Bricolage weight ramps thin → bold, then reverts to clean text.

**Scroll-throughput reactivity** — scroll velocity (damped, dirty-checked) drives the running monitor-node glow and the banner sweep's speed + intensity.

**Deploy-flow arrows** — a vertical `----->` rail threads the sections (the pipeline flows down the page); horizontal `checkout ──▶ build ──▶ … ──▶ deploy` arrows in the shell welcome and `deploy` output.

**WebGL "Compiler Lens"** — a real GPU phosphor/CRT shader over the code-field: faint amber code everywhere plus a cursor-lit reveal with chromatic aberration that shears with scroll velocity. Vanilla WebGL (no library), on its own animation frame. It reads the same cursor position the CSS flashlight already drives, and **degrades silently** to that CSS flashlight on any WebGL/shader failure. It is **gated off on software renderers** (SwiftShader / llvmpipe / Basic-Render) — where a per-frame fullscreen shader would jank scrolling — so machines with a real GPU get the lens and everything else (including the SwiftShader-based CI) gets the smooth CSS flashlight. Zero console errors on every path.

**Micro-interactions (second pass)** — three more, all enhancing existing elements (no new chrome):
- **Card inspection sheen** — a soft amber spotlight follows the cursor across each project card (`.bd-card`); pure CSS var + a screen-blended overlay, no transform (so no overflow/focus-ring risk).
- **Deploy packets** — a glowing dot travels down each vertical flow-rail, so the pipeline literally flows through the connector.
- **Cursor velocity skew** — the custom cursor ring stretches along its direction of travel on fast moves and relaxes to a circle at rest.

**Cross-page (third pass) — tying `index.html` and `projects.html` together:**
- **Compiler-lens glow on case-study heroes** — a cursor-tracked amber sheen on each `projects.html` `.pj-frame`, quoting the index "compiler lens" with a ~12-line pointer handler (CSS vars, pointer-only) — no engine imported onto the light page.
- **Cross-document "deploy-handoff"** — clicking a project card morphs its hero + title into the matching case study via the View Transitions API (`@view-transition` in the shared CSS; the destination is named purely by CSS `:target`, the clicked source is scoped by a guarded `pageswap` handler so only it morphs). Degrades to ordinary navigation where unsupported; verified zero console errors through the transition. The `:target` article is force-shown so the morph has a real destination.

**Fixes (fourth pass):**
- **WebGL lens rendered mirrored on real GPUs** — the baked text texture was uploaded without a Y-flip (canvas origin is top-left, WebGL's is bottom-left), so the code read upside-down/mirrored on hardware-GL browsers (invisible in the SwiftShader test screenshots). Fixed with `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)`. Added a `window.__PT_FORCE_LENS` hook to drive the GPU path under the test browser for verification.
- **`projects.html` had no reactive background** — the case-studies page was flat, and the cursor revealed nothing. Added a **self-contained codefield + flashlight** (faint CI/CD code revealed by the cursor, drift/follow/2s-resume, desktop-only) behind the content — the CSS-reveal version, no heavy engine, honoring the light page. No overflow (desktop or mobile), `aria-hidden`, zero console errors.

**`projects.html` redesign (fifth pass) — terminal dossiers:**
- The case-studies page was completely re-laid-out into **terminal "dossiers"**: each build is a window-framed block with a command header (`philip@toulinov ~/builds $ open {slug}`) + a pulsing `● shipped` status, the framed screenshot leading, and a **tight** mono spec (title, one-liner, ops, stack, key facts). The deep detail (lede / problem-build / feature list) is **collapsed behind a `$ cat {slug}.md ▸` expand** (animated `grid-template-rows`), so the page is scannable, not a wall of text. The TOC became a terminal **`ls -l` listing**.
- Built by **restyle + JS DOM-restructure** (inject the header bar, wrap screenshot+spec in a grid, move the deep detail into a collapsible region) — the real content, the `#build-{slug}` ids, the `.pj-frame`/`h2` morph targets, and the codefield all stay intact. Verified: the homepage card→dossier View-Transition morph still works (names intact), axe 0 on both pages, no overflow desktop/mobile, zero console errors, expand is keyboard-accessible (`aria-expanded`/`aria-controls`).

## Tests
- `npm test` — browser self-test (unchanged contract, 103/0).
- `npm run test:console` — **new**: the page self-validates its interactive contract and logs `[PT] PASS/FAIL` to the console; the runner asserts on those markers + a live shell interaction (console-driven, not DOM-only).
- `npm run test:axe` — 0 WCAG A/AA violations.
