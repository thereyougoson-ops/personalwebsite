/* Terminal-fix regression test — runs under WEBKIT (iOS Safari engine) + iPhone emulation,
   because all four bugs are mobile/Safari-specific. Covers:

     1+3. Auto-ride (home→Experience) is GESTURE-GATED: a focus/layout/programmatic scroll never
          rides (so a chip tap can't yank the page), but a REAL wheel/touch gesture does — even with
          the terminal focused — and the reverse (wheel-up → home) works too.
     2.   Inline vs collapsed/floating terminal produce the SAME output / focus / scroll-to-bottom.
     4.   Re-opening the minimised terminal lands the body at the BOTTOM (latest output + input),
          not the top.

   Caveat: no headless engine (Chromium or WebKit) opens a real iOS soft keyboard, so the
   keyboard→visualViewport shrink that originally *triggered* the bug can't be summoned here.
   The fixes don't depend on it: Fix A keys off whether a real scroll gesture was just made (focus
   alone never arms it), Fix C is an unconditional scroll-pin on re-open — both exercised below.

   Local:  npm run serve   (port 8099)
           node tests/run-terminal.mjs
*/
import { webkit, devices } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8099';
const results = [];
const ok = (name, cond, extra = '') => results.push({ pass: !!cond, name, extra });
const sleep = (p, ms) => p.waitForTimeout(ms);

const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });

// each group reloads to a clean landing — the ride test parks lenis near #work, which would
// otherwise pollute the next group's scroll baseline.
const fresh = async () => { await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await sleep(page, 1600); };
await fresh();

// ── 1+3. gesture-gated auto-ride: a focus/programmatic scroll never rides; a REAL wheel gesture
//    does — even with the terminal focused — and the reverse (wheel-up → home) works too. ──────
//    A synthetic WheelEvent faithfully simulates "user scrolled": focusing the input or tapping a
//    chip dispatches no wheel/touchmove, so only a true scroll gesture arms the ride.
const ride = await page.evaluate(async () => {
  const nap = ms => new Promise(r => setTimeout(r, ms));
  const work = document.getElementById('work');
  const input = document.getElementById('heroTermInput');
  const vh = window.innerHeight;
  const workTop = work.getBoundingClientRect().top + window.scrollY;
  const near = y => y > workTop - vh;          // within a viewport of #work = "rode down"
  const wheel = dy => window.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, bubbles: true }));
  // (a) focus the terminal, cross the trigger with a PROGRAMMATIC scroll (no gesture) → must NOT ride
  window.scrollTo(0, 0); input.focus(); await nap(80);
  window.scrollTo(0, Math.round(vh * 0.25)); await nap(2600);
  const focusNoGestureRode = near(window.scrollY);
  // (b) a real wheel gesture, terminal STILL focused → rides into Experience (the headline fix)
  window.scrollTo(0, 0); input.focus(); await nap(800);
  wheel(240); window.scrollTo(0, Math.round(vh * 0.25)); await nap(3800);
  const gestureRode = near(window.scrollY);
  await nap(2600);                              // let the ride fully settle before testing the reverse
  // (c) reverse: from Experience, a wheel-up gesture rides back home
  let reverseRode = false;
  if (gestureRode) {
    input.blur(); await nap(400);
    wheel(-240); window.scrollTo(0, Math.round(workTop - vh * 0.30)); await nap(3800);
    reverseRode = window.scrollY < vh;
  }
  return { focusNoGestureRode, gestureRode, reverseRode, workTop, vh };
});
ok('gate: focus/programmatic scroll (no gesture) does NOT auto-ride', ride.focusNoGestureRode === false, JSON.stringify(ride));
ok('gate: a real wheel gesture rides even with the terminal focused', ride.gestureRode === true, JSON.stringify(ride));
ok('gate: wheel-up from Experience rides back home', ride.reverseRode === true, JSON.stringify(ride));

// ── real-flick proof (DESKTOP webkit — mobile WebKit has no mouse.wheel): a TRUSTED wheel with NO
//    programmatic scroll must ride via Lenis MOMENTUM — the headline path the gate exists for (one
//    flick coasts past the 20% trigger hundreds of ms later with NO new wheel event; the ~1s armed
//    window must cover that coast). Both directions. The ride machinery is identical on desktop.
{
  const fctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const fp = await fctx.newPage();
  fp.on('dialog', d => d.dismiss().catch(() => {}));
  await fp.goto(BASE + '/index.html', { waitUntil: 'load' });
  await fp.waitForTimeout(1600);
  await fp.evaluate(() => window.__abortDemo && window.__abortDemo());
  const fd = await fp.evaluate(() => ({
    workTop: document.getElementById('work').getBoundingClientRect().top + window.scrollY,
    vh: window.innerHeight, w: window.innerWidth,
  }));
  await fp.mouse.move(Math.round(fd.w / 2), 6);   // top of hero, clear of the terminal's own scroller
  await fp.mouse.wheel(0, 700);                     // ONE downward flick — momentum must carry past the 20% trigger
  await fp.waitForTimeout(4600);
  const flickDownY = await fp.evaluate(() => Math.round(window.scrollY));
  ok('real flick (trusted wheel, momentum-only) rides home→Experience',
     flickDownY > fd.workTop - fd.vh, JSON.stringify({ flickDownY, ...fd }));
  await fp.waitForTimeout(1200);                    // settle + cooldown clear
  await fp.mouse.move(Math.round(fd.w / 2), 6);
  await fp.mouse.wheel(0, -700);                    // flick back up
  await fp.waitForTimeout(4600);
  const flickUpY = await fp.evaluate(() => Math.round(window.scrollY));
  ok('real flick (trusted wheel) rides Experience→home', flickUpY < fd.vh, JSON.stringify({ flickUpY }));
  await fctx.close();
}

// chip path end-to-end on a CLEAN landing: TRUSTED tap runs the command + does not scroll the page
await fresh();
// abort + clear so the demo timeline can't race the measurement (chip output now reveals slowly, ≤2600ms)
await page.evaluate(() => { window.__abortDemo(); document.getElementById('heroTermBody').innerHTML = ''; });
const before = await page.evaluate(() => document.getElementById('heroTermBody').innerText.length);
await page.locator('#heroTermChips button', { hasText: 'git log' }).click();
await sleep(page, 3000);
const chip = await page.evaluate((b) => ({
  grew: document.getElementById('heroTermBody').innerText.length > b,
  hasGit: /init: hello/i.test(document.getElementById('heroTermBody').innerText),
  sy: Math.round(window.scrollY),
}), before);
ok('Issue 1: chip runs its command (output appears)', chip.grew && chip.hasGit, JSON.stringify(chip));
ok('Issue 1: chip does NOT scroll the page away', chip.sy < 50, JSON.stringify(chip));

// regression: a SECOND chip (after the first focused the input) must still run — a mousedown-blur used to
// re-show the banner and reflow the chip out from under the click, so every chip after the first did nothing.
const cmds1 = await page.evaluate(() => document.querySelectorAll('#heroTermBody .cmd').length);
await page.locator('#heroTermChips button', { hasText: 'skills' }).click();
await sleep(page, 3000);
const cmds2 = await page.evaluate(() => document.querySelectorAll('#heroTermBody .cmd').length);
ok('Issue 2: a SECOND chip still runs (no focus-steal reflow)', cmds2 > cmds1, JSON.stringify({ cmds1, cmds2 }));

// ── 2. inline vs collapsed parity ────────────────────────────────────────────
await fresh();
const parity = await page.evaluate(async () => {
  const nap = ms => new Promise(r => setTimeout(r, ms));
  const sc = document.getElementById('heroTermScroll');
  const input = document.getElementById('heroTermInput');
  const body = document.getElementById('heroTermBody');
  const term = document.getElementById('heroTerm');
  // inline
  const inlineFloating = term.classList.contains('is-floating');
  window.__heroRun('whoami'); await nap(300);
  const inlineTail = body.innerText.slice(-60);
  input.focus(); await nap(120);
  const inlineFocused = document.activeElement === input;
  // collapsed/expanded (mobile dock → expand modal)
  document.getElementById('termDock').click(); await nap(550);
  const collapsedFloating = term.classList.contains('is-floating');
  window.__heroRun('whoami'); await nap(400);
  const collapsedTail = body.innerText.slice(-60);
  const collapsedFocused = document.activeElement === input;
  const dist = sc.scrollHeight - sc.scrollTop - sc.clientHeight;
  return { inlineFloating, collapsedFloating, sameOutput: inlineTail === collapsedTail,
           inlineFocused, collapsedFocused, distBottom: Math.round(dist) };
});
ok('Issue 2: states differ (inline not floating, collapsed floating)', parity.inlineFloating === false && parity.collapsedFloating === true, JSON.stringify(parity));
ok('Issue 2: same command → same output in both states', parity.sameOutput, JSON.stringify(parity));
ok('Issue 2: input focused in both states', parity.inlineFocused && parity.collapsedFocused, JSON.stringify(parity));
ok('Issue 2: output pinned to bottom in collapsed state', parity.distBottom < 40, JSON.stringify(parity));

// ── 4. re-open lands at the bottom (under real overflow) ─────────────────────
await fresh();
const reopen = await page.evaluate(async () => {
  const nap = ms => new Promise(r => setTimeout(r, ms));
  const sc = document.getElementById('heroTermScroll');
  for (const c of ['help', 'skills', 'git log', 'whoami', 'git log']) window.__heroRun(c);
  await nap(300);
  const overflowed = sc.scrollHeight > sc.clientHeight + 50;
  sc.scrollTop = 0;                                  // the BUG state = top
  document.getElementById('heroTermMin').click(); await nap(380);
  document.getElementById('termDock').click(); await nap(560);
  return { overflowed, dist: Math.round(sc.scrollHeight - sc.scrollTop - sc.clientHeight) };
});
ok('Issue 4: overflow present to test against', reopen.overflowed, JSON.stringify(reopen));
ok('Issue 4: re-open scrolls body to BOTTOM, not top', reopen.dist < 40, JSON.stringify(reopen));

// ── 1 (desktop): chip output must PERSIST regardless of when it's clicked during the attract demo.
// The demo loops type/run/wipe; a tap at the wrong phase used to let a raced wipe() erase the output
// (chip "does nothing"). abortDemo now latches demoAborted and wipe() bails once the user took over.
const deskCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const deskPage = await deskCtx.newPage();
deskPage.on('dialog', d => d.dismiss().catch(() => {}));
let deskFails = 0;
for (const delay of [700, 1500, 2300, 3100]) {          // sample across the demo's race window
  await deskPage.goto(BASE + '/index.html', { waitUntil: 'load' });
  await deskPage.waitForTimeout(delay);
  await deskPage.locator('#heroTermChips button', { hasText: 'git log' }).first().click();
  await deskPage.waitForTimeout(2600);                  // long enough for any demo wipe to have fired
  const persisted = await deskPage.evaluate(() => /init: hello/i.test(document.getElementById('heroTermBody').innerText));
  if (!persisted) deskFails++;
}
await deskCtx.close();
ok('Issue 1 (desktop): chip output persists at every demo phase (no wipe race)', deskFails === 0, `${4 - deskFails}/4 click delays persisted`);

// ── 4 (iOS keyboard): with the soft keyboard open, the input (LAST child inside #heroTermScroll) must
// stay visible above the keyboard — and STAY visible even when the user scrolls the output up (it's
// CSS position:sticky, not a JS pin). Headless can't open a real keyboard, so install a controllable
// fake visualViewport (the exact API termKeyboardFit watches) to drive the keyboard reflow.
const kbCtx = await browser.newContext({ ...devices['iPhone 13'] });
await kbCtx.addInitScript(() => {
  const vv = window.visualViewport; let fake = null;
  Object.defineProperty(vv, 'height', { configurable: true, get(){ return fake == null ? window.innerHeight : fake; } });
  Object.defineProperty(vv, 'offsetTop', { configurable: true, get(){ return 0; } });
  window.__setKeyboard = (px) => { fake = px == null ? null : (window.innerHeight - px); vv.dispatchEvent(new Event('resize')); };
});
const kbPage = await kbCtx.newPage();
await kbPage.goto(BASE + '/index.html', { waitUntil: 'load' });
await kbPage.waitForTimeout(1500);
const kb = await kbPage.evaluate(async () => {
  const nap = ms => new Promise(r => setTimeout(r, ms));
  document.getElementById('heroTermMin').click(); await nap(350);
  document.getElementById('termDock').click(); await nap(500);
  window.__abortDemo();   // user has taken over → demo stops wiping, real output persists (the real scenario)
  for (const c of ['help', 'skills', 'git log', 'whoami', 'git log']) window.__heroRun(c);
  await nap(300);
  const input = document.getElementById('heroTermInput'), sc = document.getElementById('heroTermScroll');
  const KB = 336, visBottom = window.innerHeight - KB;
  // visible AND near the keyboard line (not floating mid-shell): within 80px of the keyboard
  const visNow = () => { const r = input.getBoundingClientRect(); return r.bottom <= visBottom + 4 && r.bottom >= visBottom - 80; };
  input.focus(); await nap(80);
  for (const px of [120, 220, 300, KB]) { window.__setKeyboard(px); await nap(60); }   // keyboard slides up in steps
  await nap(450);
  const visibleOnOpen = visNow();
  const sticky = getComputedStyle(input.closest('.terminal__line')).position === 'sticky';
  const inputBottom = Math.round(input.getBoundingClientRect().bottom);
  // user scrolls the OUTPUT up to read history — the sticky input must STAY visible above the keyboard
  sc.scrollTop = 0; await nap(150);
  const visibleScrolledUp = visNow();
  return { visibleOnOpen, visibleScrolledUp, sticky, inputBottom, visBottom, scrolledTo: Math.round(sc.scrollTop) };
});
await kbCtx.close();
ok('Issue 4 (iOS keyboard): input visible & near the keyboard line on open', kb.visibleOnOpen && kb.sticky, JSON.stringify(kb));
ok('iOS keyboard: input STAYS visible while scrolling output up (sticky, no race)', kb.visibleScrolledUp, JSON.stringify(kb));

// ── send button: flashes only on real keystrokes (not the attract demo) and submits the command ──
const sendCtx = await browser.newContext({ ...devices['iPhone 13'] });
const sendPage = await sendCtx.newPage();
await sendPage.goto(BASE + '/index.html', { waitUntil: 'load' });
await sendPage.waitForTimeout(1500);
const send = await sendPage.evaluate(async () => {
  const nap = ms => new Promise(r => setTimeout(r, ms));
  window.__abortDemo();
  const input = document.getElementById('heroTermInput'), btn = document.getElementById('heroTermSend');
  const line = input.closest('.terminal__line'), body = document.getElementById('heroTermBody');
  const exists = !!btn;
  const flashWhenEmpty = line.classList.contains('has-text');                 // should be false
  input.value = 'whoami'; input.dispatchEvent(new Event('input', { bubbles: true })); await nap(220);   // let the 150ms fill transition settle
  const flashWhenTyped = line.classList.contains('has-text');                 // should be true
  const filled = getComputedStyle(btn).backgroundColor;                       // light-blue fill when has-text
  const before = body.innerText.length;
  btn.click(); await nap(2900);                                               // user output reveals line-by-line (≤2600ms) — assert SETTLED state
  const submitted = body.innerText.length > before && /Toulinov/i.test(body.innerText);
  const clearedAfter = !line.classList.contains('has-text');
  return { exists, flashWhenEmpty, flashWhenTyped, submitted, clearedAfter, filled };
});
await sendCtx.close();
ok('#4 send button: present, flashes only with text, submits, clears', send.exists && !send.flashWhenEmpty && send.flashWhenTyped && send.submitted && send.clearedAfter, JSON.stringify(send));

ok('no console / page errors', errors.length === 0, errors.join(' | '));

await browser.close();
let failed = 0;
for (const r of results) { if (!r.pass) failed++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.extra ? '  — ' + r.extra : ''}`); }
console.log(`\n${results.length - failed}/${results.length} passed (WebKit / iPhone 13)`);
process.exit(failed ? 1 : 0);
