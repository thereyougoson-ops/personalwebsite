/* Headless runner for the browser self-test (tests/selftest.js).
   Loads the served site, injects the self-test, runs it, and exits non-zero
   if any check fails or the page throws. Used by .github/workflows/test.yml.

   Local:  npm run serve   (in one shell)
           node tests/run-selftest.mjs
*/
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8099';
const selftestPath = fileURLToPath(new URL('./selftest.js', import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(2500);             // let the preloader finish + boot() run
await page.addScriptTag({ path: selftestPath });
const res = await page.evaluate(() => window.runSelfTest());

for (const c of res.checks) {
  console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? '  — ' + c.detail : ''}`);
}
console.log(`\n${res.pass} passed, ${res.fail} failed`);

// The contact form is a Netlify Form: the self-test submits it, which POSTs to "/".
// Against a plain static dev/CI server that POST 501s and we fall back to mailto — both
// are by-design (progressive enhancement), not bugs, and only happen off Netlify. Ignore them.
const benign = (e) =>
  /status of 501|Unsupported method \('POST'\)/i.test(e) ||
  /mailto:/i.test(e) ||
  /user gesture is required/i.test(e);
// projects.html runs its own inline script (no main.js) and now carries ported effects
// (#4 grayscale→colour thumbnail shader, #2 View-Transition destination). It isn't covered by
// selftest.js, so at minimum gate it for console/page errors under the same allowlist.
const pjErrors = [];
const pj = await browser.newPage({ viewport: { width: 1280, height: 900 } });
pj.on('pageerror', (e) => pjErrors.push('pageerror: ' + e.message));
pj.on('console', (m) => { if (m.type() === 'error') pjErrors.push('console.error: ' + m.text()); });
await pj.goto(`${BASE}/projects.html`, { waitUntil: 'load' });
await pj.waitForTimeout(1800);
// scroll through so the thumbnail reveal shaders init + run their fallback path if WebGL is absent
await pj.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700){ window.scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); } });
await pj.waitForTimeout(400);
const pjReal = pjErrors.filter((e) => !benign(e));
console.log(`\nprojects.html: ${pjReal.length ? pjReal.length + ' error(s)' : 'clean'}`);
for (const e of pjErrors) console.log('  ' + (benign(e) ? '(benign, ignored) ' : '') + e);

const realErrors = errors.filter((e) => !benign(e));
if (errors.length) {
  console.log('\nconsole / page errors:');
  for (const e of errors) console.log('  ' + (benign(e) ? '(benign, ignored) ' : '') + e);
}

await browser.close();
process.exit(res.fail > 0 || realErrors.length > 0 || pjReal.length > 0 ? 1 : 0);
