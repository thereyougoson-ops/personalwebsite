/* Console-driven browser validation: the page smoke-tests its own interactive contract and
   reports via console.log; this runner asserts on those console markers + window.__ptValidation +
   a live shell interaction — so validation does not rely on Playwright DOM queries alone.

   Local:  npm run serve   (one shell)
           node tests/run-console-validation.mjs
*/
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8099';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const logs = [], errors = [];
page.on('console', (m) => { (m.type() === 'error' ? errors : logs).push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(4000);                          // preloader + boot + features wired

// trigger the page's own console self-report deterministically (it also auto-runs for real users)
const result = await page.evaluate(() => (window.__ptValidate ? window.__ptValidate() : null));
await page.waitForTimeout(300);                           // let the [PT] console events flush
const ptLines = logs.filter((l) => l.startsWith('[PT]'));
const summary = ptLines.find((l) => /interactive self-check/.test(l));
const failMarkers = ptLines.filter((l) => /\bFAIL\b/.test(l));

// live shell interaction (behavioral): whoami → identity + colorized output; deploy → flow arrows.
// Driven through the hero shell's public window.__heroRun API (the Flux page's only shell).
const shell = await page.evaluate(() => {
  if (typeof window.__heroRun !== 'function') return null;
  if (window.__abortDemo) window.__abortDemo();          // stop the self-running tour for deterministic output
  const body = document.getElementById('heroTermBody'); if (!body) return null;
  body.innerHTML = '';
  window.__heroRun('whoami'); window.__heroRun('deploy');
  return {
    text: body.innerText,
    colored: body.querySelectorAll('.a, .c, .g, .m, .d').length,
    flow: body.querySelectorAll('.flow').length,
  };
});

const benign = (e) =>
  /status of 501|Unsupported method \('POST'\)/i.test(e) || /mailto:/i.test(e) || /user gesture is required/i.test(e);
const realErrors = errors.filter((e) => !benign(e));

let fail = 0;
const assert = (name, cond, detail) => { console.log(`${cond ? '✓' : '✗'} ${name}${detail ? '  — ' + detail : ''}`); if (!cond) fail++; };

assert('page emitted [PT] console self-check markers', ptLines.length > 0, `${ptLines.length} lines`);
assert('self-check summary line present', !!summary, summary || '');
assert('no FAIL markers reported by the page', failMarkers.length === 0, failMarkers.join(' | '));
assert('window.__ptValidation.ok is true', !!(result && result.ok), result ? `${result.pass}/${result.total}` : 'missing');
assert('live whoami output contains "Toulinov"', !!(shell && /Toulinov/.test(shell.text)));
assert('live shell output is colorized', !!(shell && shell.colored > 0), shell ? shell.colored + ' colored spans' : '');
assert('horizontal flow arrows render (deploy)', !!(shell && shell.flow > 0), shell ? shell.flow + ' .flow strips' : '');
assert('no non-benign console / page errors', realErrors.length === 0, realErrors.join(' | '));

console.log(`\n${fail === 0 ? '✓ console-validation passed' : '✗ ' + fail + ' assertion(s) failed'}`);
await browser.close();
process.exit(fail > 0 ? 1 : 0);
