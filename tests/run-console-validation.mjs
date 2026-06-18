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

// live shell interaction (behavioral): whoami → identity + colorized output; deploy → horizontal flow arrows
const shell = await page.evaluate(() => {
  const i = document.getElementById('termInput'); if (!i) return null;
  const send = (cmd) => { i.focus(); i.value = cmd; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); };
  send('whoami'); send('deploy');
  const body = document.getElementById('termBody');
  return {
    text: body ? body.innerText : '',
    colored: body ? body.querySelectorAll('.a, .c, .g, .m').length : 0,
    flow: body ? body.querySelectorAll('.flow').length : 0,
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
