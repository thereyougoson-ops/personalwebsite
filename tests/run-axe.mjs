/* Accessibility gate: runs axe-core (WCAG 2.0/2.1 A + AA) over the built pages and
   exits non-zero on any violation. Used by .github/workflows/test.yml.

   Local:  npm run build && npm run serve:dist   (one shell)
           BASE_URL=http://127.0.0.1:8098 node tests/run-axe.mjs
*/
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8099';
const PAGES = ['/index.html', '/projects.html'];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
let total = 0;
for (const p of PAGES) {
  const page = await context.newPage();
  await page.goto(`${BASE}${p}`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);                       // let the preloader finish + content reveal
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  console.log(`\n${p}: ${violations.length} violation(s)`);
  for (const v of violations) {
    console.log(`  ✗ [${v.impact}] ${v.id} — ${v.help}`);
    for (const n of v.nodes.slice(0, 4)) console.log(`      ${n.target.join(' ')}`);
  }
  total += violations.length;
  await page.close();
}
await browser.close();
console.log(`\n${total === 0 ? '✓ 0 WCAG A/AA violations' : '✗ ' + total + ' violation(s)'}`);
process.exit(total > 0 ? 1 : 0);
