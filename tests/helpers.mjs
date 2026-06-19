/* Shared headless-validation helpers — they encode gotchas learned the hard way while testing
   this site's scroll/terminal interactions. Import from any tests/run-*.mjs runner.

   WHY each exists (don't "simplify" these away):
   - settle():        the vendored Lenis does NOT reliably honor scrollTo({immediate:true}) and keeps
                      easing for a few frames; a measurement taken too early reads Lenis's residual
                      motion as if the thing under test moved the page. Poll until scrollY is stable.
   - trustedWheel():  a synthetic `el.dispatchEvent(new WheelEvent(...))` does NOT perform the default
                      scroll action, so it can't test real wheel behaviour. Playwright's mouse.wheel()
                      dispatches a TRUSTED event that scrolls. Move the pointer over the target first.
   - fullShot():      CDP Page.captureScreenshot with a `clip` repeatedly captures black/blank regions
                      here; full-viewport page.screenshot() at deviceScaleFactor:1 is reliable.
   - stabilizeTerminal(): the hero terminal runs a forever-looping attract demo that wipes/retypes its
                      body; measuring mid-loop is non-deterministic. Abort it, inject fixed content. */

export async function settle(page, { tries = 40, gap = 80 } = {}) {
  let prev = -1;
  for (let i = 0; i < tries; i++) {
    const y = await page.evaluate(() => Math.round(window.scrollY));
    if (y === prev) return y;
    prev = y;
    await page.waitForTimeout(gap);
  }
  return prev;
}

export async function centerOf(page, selector) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
  }, selector);
}

// trusted wheel over the centre of `selector`; settles the page first so residual Lenis motion
// can't masquerade as the wheel's effect. Returns {before,after} scrollY + the element's scrollTop.
export async function trustedWheel(page, selector, deltaY, { settleFirst = true } = {}) {
  if (settleFirst) await settle(page);
  const c = await centerOf(page, selector);
  if (!c) throw new Error(`trustedWheel: ${selector} not found`);
  await page.mouse.move(c.x, c.y);
  const read = () => page.evaluate((s) => {
    const el = document.querySelector(s);
    return { st: el ? Math.round(el.scrollTop) : null, sy: Math.round(window.scrollY) };
  }, selector);
  const before = await read();
  await page.mouse.wheel(0, deltaY);
  await page.waitForTimeout(450);
  const after = await read();
  return { before, after };
}

export async function stabilizeTerminal(page, lines = 60) {
  await page.evaluate((n) => {
    if (window.__abortDemo) window.__abortDemo();
    const body = document.getElementById('heroTermBody');
    if (body) {
      body.innerHTML = '';
      for (let i = 0; i < n; i++) {
        const d = document.createElement('div');
        d.className = 'row';
        d.textContent = 'log line ' + i + ' — fixed content for deterministic scroll measurement';
        body.appendChild(d);
      }
    }
  }, lines);
  await page.waitForTimeout(250);
}

export async function fullShot(page, path) {
  await page.screenshot({ path, type: 'jpeg', quality: 84 }); // full-viewport, NOT a CDP clip (see header)
}
