/* Internal link / asset checker: every local href & src on the built pages must resolve (HTTP 200).
   Catches a broken hashed-asset rewrite, a renamed file, a typo'd anchor target, etc.
   External (http/https), mailto:, tel: and pure #fragments are skipped.

   Local:  npm run build && npm run serve:dist
           BASE_URL=http://127.0.0.1:8098 node tests/run-linkcheck.mjs
*/
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8099';
const PAGES = ['/index.html', '/404.html'];

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

const seen = new Map();   // url -> status (cache)
let broken = 0, checked = 0;

const resolveUrl = (ref, pageUrl) => { try { return new URL(ref, pageUrl).href; } catch { return null; } };

for (const p of PAGES) {
  const pageUrl = `${BASE}${p}`;
  const resp = await page.goto(pageUrl, { waitUntil: 'load' });
  if (!resp || !resp.ok()) { console.log(`✗ page ${p} → ${resp ? resp.status() : 'no response'}`); broken++; continue; }
  const refs = await page.evaluate(() => {
    const out = new Set();
    document.querySelectorAll('[href],[src]').forEach((el) => {
      const v = el.getAttribute('href') || el.getAttribute('src');
      if (v) out.add(v);
    });
    // also <source srcset> entries
    document.querySelectorAll('source[srcset]').forEach((s) => s.getAttribute('srcset').split(',').forEach((e) => out.add(e.trim().split(/\s+/)[0])));
    return [...out];
  });
  for (const ref of refs) {
    if (/^(https?:)?\/\//i.test(ref) || /^(mailto:|tel:|data:|javascript:)/i.test(ref) || ref.startsWith('#') || !ref.trim()) continue;
    const url = resolveUrl(ref, pageUrl);
    if (!url) continue;
    if (!seen.has(url)) {
      let status = 'ERR';
      try { const r = await context.request.get(url); status = r.status(); } catch { status = 'ERR'; }
      seen.set(url, status);
      checked++;
      if (status !== 200) { console.log(`✗ ${p}  ${ref}  → ${status}`); broken++; }
    }
  }
}
await browser.close();
console.log(`\nchecked ${checked} unique local URL(s) across ${PAGES.length} pages — ${broken === 0 ? '✓ all 200' : '✗ ' + broken + ' broken'}`);
process.exit(broken > 0 ? 1 : 0);
