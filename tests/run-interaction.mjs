/* Headless interaction regression test — covers two behaviours that the in-page selftest.js cannot
   reach because they need TRUSTED input / multi-frame timing:

     A. The terminal output scrolls on wheel WITHOUT the page moving (Lenis must not eat the wheel),
        and hands the scroll back to the page at the top/bottom edge.
     B. The hero ASCII banner stays a constant height as frames cycle (so the hero doesn't breathe
        and drift the page under scroll-anchoring).

   Both are things we fixed this session; this codifies them so a revert turns red.
   Informational in CI (continue-on-error) — trusted-input + animation timing is inherently a bit
   flakier than DOM assertions, so it must never block a correct change.

   Local:  npm run serve:dist   (or npm run serve)
           node tests/run-interaction.mjs
*/
import { chromium } from 'playwright';
import { settle, trustedWheel, stabilizeTerminal } from './helpers.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8099';
const results = [];
const ok = (name, cond, extra = '') => results.push({ pass: !!cond, name, extra });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

await page.goto(BASE + '/index.html', { waitUntil: 'load' });
await page.waitForTimeout(1500);

// ── A. terminal wheel-scroll vs page ─────────────────────────────────────────
await stabilizeTerminal(page);                 // stop the attract loop, inject fixed overflowing content
const hero = await page.evaluate(() => {
  const s = document.getElementById('heroTermScroll');
  return s ? { overflows: s.scrollHeight > s.clientHeight + 5, oy: getComputedStyle(s).overflowY } : null;
});
ok('hero terminal overflows & is scrollable', hero && hero.overflows && (hero.oy === 'auto' || hero.oy === 'scroll'), JSON.stringify(hero));

await page.evaluate(() => { document.getElementById('heroTermScroll').scrollTop = 0; });
const a1 = await trustedWheel(page, '#heroTermScroll', 320);
ok('wheel scrolls the terminal output', a1.after.st > a1.before.st + 10, `st ${a1.before.st}->${a1.after.st}`);
// the load-bearing assertion: if stopPropagation were removed, Lenis would scroll the PAGE here.
ok('wheel does NOT move the page while terminal can scroll', Math.abs(a1.after.sy - a1.before.sy) < 6, `sy ${a1.before.sy}->${a1.after.sy}`);

await page.evaluate(() => { const s = document.getElementById('heroTermScroll'); s.scrollTop = s.scrollHeight; });
const a2 = await trustedWheel(page, '#heroTermScroll', 320);
ok('at the bottom edge, wheel hands off to the page (Lenis)', a2.after.sy > a2.before.sy + 10, `sy ${a2.before.sy}->${a2.after.sy}`);

// ── B. hero banner stays a constant height across frames, at wide AND narrow widths ──
async function bannerVariance() {
  const heights = new Set();
  for (let i = 0; i < 26; i++) {
    const h = await page.evaluate(() => {
      const b = document.querySelector('.heroterm__banner');
      return b ? Math.round(b.getBoundingClientRect().height) : -1;
    });
    heights.add(h);
    await page.waitForTimeout(360);
  }
  const arr = [...heights];
  return { variance: Math.max(...arr) - Math.min(...arr), seen: arr.sort((x, y) => x - y) };
}
await settle(page);
await page.evaluate(() => window.scrollTo(0, 0));
const wide = await bannerVariance();
ok('banner height constant at 1280w (no breathing)', wide.variance <= 1, `variance=${wide.variance}px seen=[${wide.seen}]`);

await page.setViewportSize({ width: 380, height: 820 });
await page.waitForTimeout(600);
const narrow = await bannerVariance();
ok('banner height constant at 380w (em min-height holds)', narrow.variance <= 1, `variance=${narrow.variance}px seen=[${narrow.seen}]`);

ok('no console / page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

// ── report ───────────────────────────────────────────────────────────────────
const fails = results.filter((r) => !r.pass);
for (const r of results) console.log(`${r.pass ? '✓' : '✗'} ${r.name}${r.extra ? '  — ' + r.extra : ''}`);
console.log(`\n${results.length - fails.length} passed, ${fails.length} failed  (BASE=${BASE})`);
await browser.close();
process.exit(fails.length ? 1 : 0);
