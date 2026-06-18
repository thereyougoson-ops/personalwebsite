# Build & delivery pipeline

This site is hand-built and **runs with no build step** — `npm run serve` serves the source tree as-is.
On top of that there is an **additive** release pipeline: a build, CI quality gates, and per-PR preview deploys.

## Build — content-hash + minify

```bash
npm run build        # node build/build.mjs → ./dist
npm run serve:dist   # serve the built output on :8098
```

`build/build.mjs`:
1. copies the site into `dist/` (minus dev-only dirs),
2. minifies `styles/main.css` + `scripts/main.js` with **esbuild** and renames them
   `main.<sha256-10>.css/.js` (esbuild is optional — without it files are copied verbatim, still hashed),
3. rewrites the `<link>`/`<script>` references in the built HTML,
4. emits `dist/_headers` that marks `/styles/*` and `/scripts/*` **`immutable`** — safe because the
   filename now changes whenever the content does. This closes the cache-TODO in the source `_headers`.

Typical result: CSS ~−19%, JS ~−30%, and hashed assets cache for a year.

## CI quality gates — `.github/workflows/test.yml`

Every push/PR builds `dist/`, serves it, and runs the gates **against the built output**:

| Gate | Script | Blocks build |
|---|---|---|
| Functional self-test (103 assertions) | `npm test` | ✓ |
| Accessibility — axe-core, WCAG 2.0/2.1 A+AA | `npm run test:axe` | ✓ |
| Internal link / asset check | `npm run test:links` | ✓ |
| Lighthouse budgets (perf/a11y/best-practices/SEO) | `@lhci/cli` + `lighthouserc.json` | informational* |

\* Lighthouse assertions start as `warn`; ratchet to `error` in `lighthouserc.json` once tuned, then drop
`continue-on-error` from the `lighthouse` job.

Run them locally:

```bash
npm run build && npm run serve:dist &
BASE_URL=http://127.0.0.1:8098 npm test
BASE_URL=http://127.0.0.1:8098 npm run test:axe
BASE_URL=http://127.0.0.1:8098 npm run test:links
```

## Deploy — Netlify

`netlify.toml` builds with `npm run build` and publishes `dist/`. Once the repo is connected to Netlify:
- **production** deploys on push to the default branch,
- **Deploy Previews** are created automatically for every pull request (unique URL per PR),
- the Lighthouse CI job reports scores per build (uploaded to temporary public storage).

The source tree never needs the build to run — `npm run serve` always works for local hacking.
