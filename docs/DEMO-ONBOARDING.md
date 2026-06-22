# Onboarding a live app as a same-origin demo

How to prepare a **dynamic backend app** (Flask/Django/Node/Express + a DB, or an SSR/SPA app)
so it can be handed over and integrated into this portfolio as a **same-origin live demo** at
`/demos/<slug>/`, automatically populating the Builds grid, the 3D carousel, the transit map, and
projects.html.

> **The one hard rule:** in production this site ships **static files only** (no app server, no DB).
> So the app's backend must be **eliminated** — replaced with client-side substitutes — and only its
> built front-end + a mocked/seeded data layer ships under `/demos/<slug>/`. The demo must still be the
> **real UI running real interactions** on **seeded, non-sensitive** data (no toy/fake widgets).

Evidence behind every technique here is cited inline (deep-research, 20 verified claims).

---

## 0. Where a demo plugs in (this repo)

A project appears in **four** places; onboarding = bundling the app + filling this metadata:

| Place | File | Per-project shape (fields) |
|---|---|---|
| **Builds grid** (poster → live iframe) | `index.html` `PROJECTS[]` | `num, slug, mode:"live", isNew, caseId:"build-<slug>", title, cat, tag, lede, pills[~6], facts[3], addr, poster:"assets/projects/<slug>-1280.webp", src:"demos/<slug>/", note, tour[{x,y,t,c}]` |
| **3D carousel card** | `scripts/v8u.js` `builds[]` | `n, t(title), cat, tag, pills[], facts[[val,label]×3], addr, dom, a(accent hex), isNew` |
| **Transit map station** | `scripts/transit.js` `BUILDS[]` + `SRC` | `n, slug, title, cat, accent, from:[roleIndices], lede, facts[[val,label]×3], isNew` + `SRC[slug]="demos/<slug>/"` |
| **Projects page** | `projects.html` | a `.pj-*` project card (match the existing pattern) |

The live app's static bundle goes in **`/demos/<slug>/`** (served same-origin; copied verbatim into
`dist/` by `build/build.mjs`). Poster screenshot → `assets/projects/<slug>-1280.webp`.

---

## A. Decision tree — how to bake THIS app

Answer top-down; the first match is your path.

```
Is the app already a pure client-side SPA (no backend calls, or calls a public CORS API)?
│  YES → PATH 1 (Static SPA): just set the base path + drop the build in. Easiest.
│
Does it have a backend the front-end calls (REST/GraphQL), but no hard SQL needs in the browser?
│  YES → PATH 2 (Mock the network): real front-end + Mock Service Worker (MSW) + seeded fixtures
│        (@mswjs/data). Highest realism — the actual UI runs against a fake backend. [mswjs.io]
│
Does the app genuinely need a relational DB in the browser (complex queries)?
│  YES → PATH 3 (DB in WASM): run real Postgres via PGlite, or SQLite via sql.js, loaded from a
│        sanitized snapshot exported from the real DB. [pglite.dev, sql.js.org]
│
Is it an SSR/SSG framework app (Next.js / Nuxt)?
│  YES → PATH 4 (Static export): `output:'export'` (Next) / `nuxt generate` (Nuxt) — ONLY if it
│        avoids server-only features (see gate below); any remaining server bit → mock via PATH 2.
│
Can't be rebuilt and is essentially read-only content?
   → PATH 5 (Mirror, last resort): HTTrack/wget a running instance to flat HTML. Captures rendered
     output ONLY — no server logic, no real interactivity. Poster-grade. [httrack.com] Avoid unless
     nothing else works; it usually fails the "real interaction" bar.
```

**Prior art in this repo** (all PATH 2/3 variants): Loansy = Flask on `mongomock`+`fakeredis`, auth
stripped; FreqUI = real upstream build + mocked XHR/fetch + seeded-JWT login bypass; ClaudeDown =
single-file SPA + fetch mock. The modern same-origin equivalent for new apps is **PATH 2/3** (MSW +
in-WASM DB), which needs no Python/Node runtime at all.

---

## B. Bake steps by path

**PATH 1 — Static SPA**
1. Build with the sub-path base set (see §C).
2. Confirm no calls to a private backend (Network tab). If a public API needs a key, proxy it out or
   mock it (→ PATH 2). Drop the build into `/demos/<slug>/`.

**PATH 2 — Mock the network (the realism engine)** — *recommended default for backend apps*
1. Build the **real front-end** (with sub-path base, §C).
2. Add **MSW** in browser mode: it registers a Service Worker that intercepts requests at the network
   level — the app's real `fetch`/XHR hit mocked responses with **no code change to the app's data
   layer**. [mswjs.io/docs] `mockServiceWorker.js` must be served same-origin — it is, under
   `/demos/<slug>/`.
3. Back it with seeded data: **`@mswjs/data`** (schema'd in-memory store) so the app runs against a
   fully mocked backend, no server/DB. [github.com/mswjs/data] Seed it with realistic, non-sensitive
   fixtures the owner provides.
4. Handle auth as a **bypass**: start "logged in" with a seeded session/JWT (no real credentials).
5. Make all mutations land in the mock store only (read-mostly; writes are local + reset on reload).

**PATH 3 — Real DB in WASM** (when queries are too rich to fixture)
- **Postgres:** PGlite = real Postgres compiled to WASM, no server, single-connection (perfect for a
  one-tab demo). [pglite.dev] Load a sanitized seed.
- **SQLite:** sql.js = SQLite in WASM; it can **load an existing `.sqlite` file** (byte array) and
  **export** one back out — so: take the real DB → export a scrubbed `.sqlite` snapshot → ship it →
  load client-side. [sql.js.org] Pair with PATH 2 to route the app's API calls into the WASM DB.

**PATH 4 — SSR/SSG static export**
- Next: `output:'export'` in `next.config.js` → `next build` emits a static `out/`. [nextjs.org]
- Nuxt: `npx nuxt generate` → `.output/public`. [nuxt.com]
- **GATE — export forbids server-only features:** API routes, Server Actions, cookies/request-reading
  Route Handlers, middleware/proxy, rewrites/redirects/headers, ISR, dynamic routes without
  `generateStaticParams()`, and default image optimization. If the app uses any, that piece must be
  moved client-side (PATH 2) before export. [nextjs.org/docs/messages/api-routes-static-export]
- **Crawler limit:** routes not linked from a discoverable page aren't prerendered — list them
  manually (`generateStaticParams` / `nitro.prerender.routes`).

---

## C. Serve correctly under `/demos/<slug>/` (sub-path)

Every asset/route must resolve under the sub-path or you get `/`-absolute 404s. [vite.dev/guide/build]
- **Vite:** `base: '/demos/<slug>/'` in `vite.config.js` (or `vite build --base=/demos/<slug>/`) — it
  rewrites JS-imported assets, CSS `url()`, and `.html` references.
- **Router basename:** React Router `basename`, Vue Router `base`, etc. = `/demos/<slug>/`.
- **Next/Nuxt:** `basePath`+`assetPrefix` (Next) / `app.baseURL` (Nuxt).
- **Gotchas:** dynamically *concatenated* URLs are NOT auto-rewritten — use `import.meta.env.BASE_URL`.
  Hash routing avoids server-rewrite needs but its `#` can clash with the parent page's anchor scroll.
- **Verify:** after baking, load `/demos/<slug>/` and confirm zero `/`-absolute 404s in the console.

---

## D. Security (non-negotiable — the backend is gone)

The demos use `sandbox="allow-scripts allow-same-origin …"` on **same-origin** content. Per MDN, that
combination provides **essentially no isolation** — the embedded page can remove its own sandbox
attribute. [developer.mozilla.org iframe] So the sandbox is **not** a containment boundary:
1. **Only embed code you trust and have reviewed.**
2. **Strip every secret/API key/credential** from the baked bundle — with the backend removed, any key
   left in client code is fully public.
3. **No real mutations** — writes hit the mock store/WASM DB only; never a live external service.
4. **Auth = seeded bypass**, never real login or real tokens.
5. If a demo ever can't be trusted/scrubbed, serve it from a **separate origin (subdomain)** instead of
   same-origin — that's the only real isolation.

---

## E. Per-app HANDOFF MANIFEST (copy-paste, fill in, hand over with the repo/folder)

```
APP: <name>                         slug: <kebab-case, becomes /demos/<slug>/>
Source: <git URL or local folder path>
Hand-off form: [ ] public repo  [ ] local folder  [ ] live URL (for mirror/screenshot only)

— BUILD —
Type:        [ ] static SPA  [ ] SPA + backend API  [ ] needs relational DB  [ ] SSR/SSG (Next/Nuxt)  [ ] server-rendered/legacy
Framework / tooling: <e.g. React+Vite / Next 14 / Flask+Jinja>
Install + build commands: <e.g. npm ci && npm run build>
Build output dir:         <e.g. dist/ | out/ | .output/public>
Uses any server-only feature? (API routes, SSR cookies, middleware, ISR, server actions): <list, or "none">

— BACKEND TO ELIMINATE —
Backend type:    [ ] REST  [ ] GraphQL  [ ] websockets  [ ] DB-direct
API endpoints + expected response shapes: <list, or attach an OpenAPI/sample-responses file>
Seed data: <attach realistic, SANITIZED fixtures (JSON) — or a scrubbed .sqlite / DB-dump snapshot>
Mutations: <which writes exist; confirm they can be mock-only / reset-on-reload>

— AUTH —
How login works: <session cookie / JWT / OAuth …>
Demo bypass plan: <a seeded demo user + how to start "logged in"; NO real credentials>

— ENV / SECRETS —
Env vars the app reads: <list>  → which to stub/fake for the demo: <list>
Confirm: NO real secrets/keys remain in the client bundle: [ ] confirmed

— PORTFOLIO METADATA (fills the 4 sections) —
title:   <short product name>
cat:     <one-line category, e.g. "Fintech ops · Telegram bot + Flask console">
tag:     <one sentence — what it is>
lede:    <1–2 sentences — what it does / how it's built>
pills:   <~6 tech tags>
facts:   <exactly 3 "value | label" stats, e.g. "248 | active loans">
accent:  <hex color for the card/branch, e.g. #5ee6c0>
from:    <which roles shipped it — role indices 0–4 (0 Education … 4 Independent)>
isNew:   <true/false>
poster:  <attach a 1280px screenshot, OR leave it — I'll capture via Playwright>
```

---

## F. What I (Claude) do once you hand over a prepared app

1. Bake it to `/demos/<slug>/` per the chosen PATH (build with sub-path base; add MSW + seed / WASM DB;
   bypass auth; strip secrets; make mutations mock-only).
2. Capture/optimize the poster (`assets/projects/<slug>-1280.webp`) — Playwright `page.screenshot`.
   [playwright.dev/docs/screenshots]
3. Wire the metadata into all four places (Builds `PROJECTS[]`, v8u `builds[]`, transit `BUILDS[]`+`SRC`,
   projects.html), keeping `slug` identical everywhere.
4. Verify: `node tests/run-demos.mjs` (demo grid + embeds), `node tests/run-selftest.mjs` (target 103/0),
   `node tests/run-axe.mjs` (0), plus a live Playwright check that the iframe loads same-origin with no
   `/`-404s and the real UI is interactive on seeded data.

**Acceptance bar:** real UI · real interactions · seeded non-sensitive data · zero secrets · no live
mutations · loads same-origin under `/demos/<slug>/` · gates green.

---

### Sources (verified)
Next static export — nextjs.org/docs/app/guides/static-exports · Nuxt prerender — nuxt.com ·
MSW — mswjs.io/docs · @mswjs/data — github.com/mswjs/data · PGlite — pglite.dev · sql.js — sql.js.org ·
Vite base — vite.dev/guide/build · iframe sandbox — developer.mozilla.org · HTTrack — httrack.com ·
Playwright screenshots — playwright.dev/docs/screenshots
