/* Live-demo verifier: loads every <demo-card> embed (the 10 real apps served
   same-origin from /demos/<slug>/) in a real browser and asserts each one
   actually boots — HTTP 200, real DOM/canvas rendered, and NO uncaught JS
   exception. These embeds are facade demos (mongomock/fakeredis bake, seeded
   JWT, client-side fetch/XHR mocks) designed to run standalone, so the hard
   gate is "no pageerror"; console.error noise (absent backends, missing map
   tiles when embedded) is reported but informational — matching the demos'
   honest-fallback design.

   The demo list is parsed straight out of index.html's PROJECTS array, so it
   auto-syncs when a demo is added/removed — no second source of truth.

   Local:  npm run serve            (in one shell — serves project root)
           node tests/run-demos.mjs
   NOTE: the default serve port 8099 is often already busy with another
   server; start your own root server on a free port and point BASE_URL at it:
           python -m http.server 8077 --bind 127.0.0.1
           BASE_URL=http://127.0.0.1:8077 node tests/run-demos.mjs
*/
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8099';

// ---- derive the demo list from index.html (single source of truth) ----
const indexPath = fileURLToPath(new URL('../index.html', import.meta.url));
const html = readFileSync(indexPath, 'utf8');
// each project block carries  slug:"..."  and a later  src:"demos/<slug>/..."
const slugs = [...html.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]);
const srcs = [...html.matchAll(/src:\s*"(demos\/[^"]+)"/g)].map((m) => m[1]);
const DEMOS = srcs.map((src) => {
  const slug = (src.match(/^demos\/([^/#]+)/) || [])[1];
  return { slug, src };
});
if (!DEMOS.length) { console.error('No demos parsed from index.html — abort.'); process.exit(2); }
console.log(`Parsed ${DEMOS.length} demo embed(s) from index.html` +
  (slugs.length !== DEMOS.length ? `  (note: ${slugs.length} project slugs)` : '') + `\n`);

// console.error patterns that are by-design for an embedded, backend-less facade demo
const benign = (t) =>
  /favicon|manifest\.json|\.map\b|source ?map/i.test(t) ||
  /Failed to load resource/i.test(t) ||                       // absent backend / tile / asset, by design
  /net::ERR_|ERR_NETWORK|fetch|XHR|NetworkError|Load failed/i.test(t) ||
  /maplibre|mapbox|deck\.gl|WebGL|telemetry/i.test(t) ||
  /401|403|404|500|502|503/i.test(t) ||
  /service ?worker|sw\.js|Quota/i.test(t);

const browser = await chromium.launch();
const results = [];

for (const d of DEMOS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];          // uncaught exceptions — the hard gate
  const cerr = [];          // console.error — informational
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') cerr.push(m.text()); });

  const url = `${BASE}/${d.src}`;
  let status = 0, rendered = false, detail = '';
  try {
    const resp = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    status = resp ? resp.status() : 0;
    await page.waitForTimeout(2800);     // let the SPA/map/console boot + mocks settle
    const probe = await page.evaluate(() => ({
      nodes: document.querySelectorAll('*').length,
      text: (document.body && document.body.innerText || '').trim().length,
      canvas: !!document.querySelector('canvas'),
      title: document.title || '',
      crash: /Traceback \(most recent|Cannot GET|Internal Server Error|werkzeug|<pre>/i
        .test(document.body && document.body.innerHTML.slice(0, 4000) || ''),
    }));
    // "booted" = healthy 2xx, a non-trivial DOM, and visible text OR a render canvas (maps),
    // and not a server error/stack-trace page
    rendered = status >= 200 && status < 300 && probe.nodes > 40 &&
               (probe.text > 20 || probe.canvas) && !probe.crash;
    detail = `${status} · ${probe.nodes} nodes · ${probe.text} chars` +
             (probe.canvas ? ' · canvas' : '') + (probe.crash ? ' · CRASH-PAGE' : '');
  } catch (e) {
    detail = 'navigation error: ' + e.message;
  }

  const fatal = errs.filter(Boolean);
  const realCerr = cerr.filter((t) => !benign(t));
  const pass = rendered && fatal.length === 0;
  results.push({ slug: d.slug, src: d.src, pass, detail, fatal, cerr, realCerr });

  console.log(`${pass ? '✓' : '✗'} ${d.slug.padEnd(22)} ${detail}`);
  for (const e of fatal) console.log(`      ✗ pageerror: ${e}`);
  if (realCerr.length) for (const e of realCerr.slice(0, 3)) console.log(`      • console.error (non-benign): ${e.slice(0, 120)}`);

  await page.close();
}

await browser.close();

const failed = results.filter((r) => !r.pass);
const noisy = results.filter((r) => r.pass && r.realCerr.length);
console.log(`\n${results.length - failed.length}/${results.length} demos booted clean` +
  (noisy.length ? `  (${noisy.length} passed with non-benign console.error noise — review above)` : ''));
if (failed.length) console.log('failed: ' + failed.map((r) => r.slug).join(', '));
process.exit(failed.length ? 1 : 0);
