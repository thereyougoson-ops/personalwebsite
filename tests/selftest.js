/* =========================================================================
   Philip Toulinov portfolio — browser self-test ("Flux" redesign contract)
   Paste into DevTools console (or run via Playwright) on the live site.
   Returns a results object: { pass, fail, checks: [...] }.
   Async: await runSelfTest()

   The page is the "Flux" world: hero (kept) → thesis (kept) → #fluxRoot
   { 01 Experience (WebGL field) · 02 Builds (cinematic showcase) ·
     03 Contact (terminal commit form) · System Status } → footer (kept).
   Removed/subsumed: pipeline DAG, observability tiles, explorable stack
   terminal, about prose, playable incident, hero statuspage — every such
   module self-guards in main.js, so this test asserts they are ABSENT.
   ========================================================================= */
window.runSelfTest = async function runSelfTest(){
  const checks = [];
  const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail: detail || '' });
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const op = (s) => { const e = q(s); return e ? parseFloat(getComputedStyle(e).opacity) : -1; };
  const scrollTo = (sel) => { const t = q(sel); if (!t) return; if (window.__lenis) window.__lenis.scrollTo(t, { offset: -68, immediate: true }); else t.scrollIntoView(); };

  // 1 — Flux type system: Space Grotesk (display) · Silkscreen (eyebrow) · Geist (body) · Geist Mono (terminal)
  try {
    await document.fonts.ready;
    ok('font: Geist (body) loaded', document.fonts.check('16px Geist'));
    ok('font: Geist Mono (terminal) loaded', document.fonts.check('16px "Geist Mono"'));
    ok('font: Space Grotesk (display) loaded', document.fonts.check('500 32px "Space Grotesk"'));
    ok('font: Silkscreen (pixel eyebrow) loaded', document.fonts.check('16px "Silkscreen"'));
    const fontLinks = qa('link[rel="stylesheet"]').map(l => l.href).join(' ');
    ok('NO arty serif requested (Fraunces/Playfair absent)', !/Fraunces|Playfair/i.test(fontLinks));
    ok('display headings use Space Grotesk', /Space Grotesk/.test(getComputedStyle(q('#fluxHead') || document.body).fontFamily));
    ok('UI body font is Geist', /Geist/.test(getComputedStyle(document.body).fontFamily));
  } catch(e){ ok('fonts', false, String(e)); }

  // 2 — structure: the Flux world is present; removed modules are gone
  ['#hero','#thesis','#fluxRoot','#work','#transitMap','#contact','#status','#codefield','#palette','#sheet','#nav','#heroTerm','#termDock'].forEach(s =>
    ok('exists ' + s, !!q(s)));
  ['#dag','#metrics','#incident','#statuspage','#toolchain','#envChip','#stack','#about','#terminal','#commitForm'].forEach(s =>
    ok('removed ' + s, !q(s)));

  // 3 — hero + thesis (both kept from the original page)
  scrollTo('#hero'); await sleep(300);
  ok('hero title rendered', !!q('.hero__title') && q('.hero__title').textContent.trim().length > 0, q('.hero__title') && q('.hero__title').textContent.trim().slice(0,24));
  ok('hero lede present', !!(q('.hero__lede') || q('#hero p')));
  ok('hero ASCII banner pinned in shell', !!q('#heroTerm .term-banner'));
  const secIds = qa('section[id]').map(s => s.id);
  ok('thesis sits between hero and the Flux root', secIds.indexOf('thesis') > secIds.indexOf('hero'), secIds.join(','));
  ok('thesis has 3 kinetic beats', qa('#thesis .thesis__beat').length === 3, 'beats=' + qa('#thesis .thesis__beat').length);
  const thesisST = (window.ScrollTrigger ? ScrollTrigger.getAll() : []).find(t => t.vars.trigger && t.vars.trigger.id === 'thesis');
  ok('thesis is pinned + scrubbed (ScrollTrigger)', !!(thesisST && thesisST.vars.pin), thesisST ? ('pin=' + !!thesisST.vars.pin) : 'no ScrollTrigger on #thesis');

  // 4 — 01 Experience (intro heading + lab effects). The hand-written WebGL "field" + magnetic station
  // nav were removed — the Transit Map is now the sole Experience visual; the #work intro heading stays.
  scrollTo('#work'); await sleep(600);
  ok('experience eyebrow present', !!q('#work .fx-eb'), q('#work .fx-eb') && q('#work .fx-eb').textContent.trim());
  ['#fluxStage', '#fluxCanvas', '#fluxStations', '#fluxDetail', '#fluxMotion'].forEach(s =>
    ok('removed (flux field) ' + s, !q(s)));
  ok('compiler-lens active (or graceful CSS fallback)', !window.__compilerLens || window.__compilerLens.active || window.__compilerLens.fellBack);
  // ---- ported lab effects (Wave 1) — active OR graceful fallback, never broken ----
  ok('#1 velocity-skew active (or graceful fallback)', !!window.__velocitySkew && (window.__velocitySkew.active || window.__velocitySkew.fellBack),
    window.__velocitySkew && ('active=' + window.__velocitySkew.active + (window.__velocitySkew.count ? ' n=' + window.__velocitySkew.count : '')));
  // #2 deploy-handoff (.pj-build → projects.html) and #3 builds scroll-state strip were removed with the Builds grid.
  ok('#5 status popover + anchored info button present', !!q('#fxStatusPop[popover]') && !!q('.fx-info[popovertarget="fxStatusPop"]'));
  // #6 scan panel draws frames only while on-screen (rAF; pauses off-screen). Removing the Builds grid +
  // V8u carousel shortened the page and shifted this panel, so explicitly bring it into view and give it
  // rAF time before asserting frames>0 (verified live: ~23 frames within ~1.6s on-screen).
  if (q('#scanCanvas')) q('#scanCanvas').scrollIntoView({ block: 'center' });
  await sleep(1100);
  ok('#6 scan panel drawing frames (or graceful CSS fallback)', !!q('#scanCanvas') && !!window.__scanPanel && ((window.__scanPanel.active && window.__scanPanel.frames > 0) || window.__scanPanel.fellBack),
    window.__scanPanel && ('active=' + window.__scanPanel.active + ' frames=' + window.__scanPanel.frames));
  // (the 5 magnetic stations + #fluxDetail panel were removed with the WebGL field — asserted gone above.)

  // 5 — 02 Builds is now the Transit Map (Experience × Builds) — the sole builds surface.
  // The old <demo-card> grid (#bdGrid) and the #bdStage / #v8uStage carousels were removed;
  // each real /demos/<slug>/ app still loads in the Transit Map's live dock and is boot-verified
  // end-to-end by tests/run-demos.mjs. Here we assert the map renders and removed surfaces are gone.
  scrollTo('#transitMap'); await sleep(300);
  // the transit map is constructed lazily when scrolled into view — poll up to ~1.8s for its render
  for (let i = 0; i < 12 && !(q('#tmRoot') && q('#tmRoot').children.length); i++) await sleep(150);
  ok('transit map section + dock root present', !!q('#transitMap') && !!q('#tmRoot'));
  ok('transit map rendered into #tmRoot', !!q('#tmRoot') && q('#tmRoot').children.length > 0,
    q('#tmRoot') && (q('#tmRoot').children.length + ' nodes'));
  ok('transit reader content is wrapped as a magnetic info card', !!q('#tmd-panel .tm-info-card'));
  ['#bdGrid', '#v8uStage', '#bdStage'].forEach(s =>
    ok('removed (builds grid / carousel) ' + s, !q(s)));

  // 6 — 03 Contact (vibrant terminal commit form → mailto; live SF clock)
  scrollTo('#contact'); await sleep(400);
  ok('contact commit form present', !!q('#ctForm') && !!q('#ctSubj') && !!q('#ctBody'));
  ok('contact exposes a mailto address', qa('#contact a[href^="mailto:"]').length >= 1);
  ok('live SF clock ticking in contact', !!q('#ctClock') && /\d\d?:\d\d/.test(q('#ctClock').textContent), q('#ctClock') && q('#ctClock').textContent);
  if (q('#ctForm') && q('#ctSubj') && q('#ctOut')){
    q('#ctSubj').value = ''; q('#ctForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(120);
    ok('empty-subject submit is guarded (no commit)', !/\[contact [0-9a-f]{7}\]/.test(q('#ctOut').innerText), q('#ctOut').innerText.slice(0, 40));
    q('#ctSubj').value = 'release role at Acme'; q('#ctBody').value = 'hello there';
    q('#ctForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(700);
    ok('filled submit types a git commit into the output', /\[contact [0-9a-f]{7}\]|git commit/i.test(q('#ctOut').innerText), q('#ctOut').innerText.replace(/\n/g, ' ').slice(0, 48));
  }

  // 7 — System Status (closing dashboard: 90-day uptime strips + live session timer)
  scrollTo('#status'); await sleep(500);
  ok('status dashboard present', !!q('#status') && !!q('#fxStatus'));
  ok('status renders animated uptime bars', qa('#status [class*="bar"], #fxStatus *').length > 50, 'bars=' + qa('#status [class*="bar"], #fxStatus *').length);
  ok('status live clock ticking', !!q('#fxStatClock') && /\d\d?:\d\d/.test(q('#fxStatClock').textContent), q('#fxStatClock') && q('#fxStatClock').textContent);

  // 8 — terminal (retro-TUI showcase) — driven through the public window.__heroRun API
  ok('hero shell exposes window.__heroRun', typeof window.__heroRun === 'function');
  const body = q('#heroTermBody');
  if (typeof window.__heroRun === 'function' && body){
    if (window.__abortDemo) window.__abortDemo();          // stop the self-running tour for deterministic output
    await sleep(60); body.innerHTML = '';
    const run = (c) => window.__heroRun(c);
    const had = (re) => re.test(body.innerText);
    run('whoami');            ok('cmd whoami → identity', /Toulinov/.test(body.innerText));
    run('git log');           ok('cmd git log → graph rail + hashes', had(/[0-9a-f]{7}/) && /LendingClub|commit/i.test(body.innerText));
    run('skills');            ok('cmd skills → systemctl units', /active|\.target|\.service|●/i.test(body.innerText));
    run('experience');        ok('cmd experience → role panels', /LendingClub|Tech Mahindra|Release/i.test(body.innerText));
    const terminalCard = body.querySelector('.box');
    ok('terminal experience cards expose magnetic card vars', !!terminalCard && getComputedStyle(terminalCard).getPropertyValue('--card-rx').trim() === '0deg');
    run('ls');                ok('cmd ls → directory tree', /philip|├──|└──|\.md|\.yml/i.test(body.innerText));
    run('help');              ok('cmd help → TUI launcher', body.innerText.length > 0);
    run('deploy');            ok('cmd deploy → horizontal flow rail', body.querySelectorAll('.flow').length >= 1);
    run('definitelynotacmd'); ok('unknown command handled', /command not found/.test(body.innerText));
    ok('terminal output is colorized', body.querySelectorAll('.a,.c,.g,.m,.d').length > 0, body.querySelectorAll('.a,.c,.g,.m,.d').length + ' colored spans');
    const input = q('#heroTermInput');
    if (input){ input.value = 'kube'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      ok('tab-completion expands the command', input.value.startsWith('kubectl'), 'got: ' + input.value); input.value = ''; }
  }

  // 9 — hero terminal dock: mini (non-modal) → expanded (modal, inert bg) → close (scroll held)
  if (window.__termDock){
    scrollTo('#contact'); await sleep(300);
    const y0 = Math.round(window.scrollY);
    window.__termDock.open(); await sleep(420);
    ok('dock opens a mini, non-modal shell', window.__termDock.isOpen() && window.__termDock.state() === 'mini' && document.querySelector('main').inert === false);
    ok('mini keeps focus inside the shell', q('#termOverlay').contains(document.activeElement));
    ok('mini holds the scroll position', Math.abs(Math.round(window.scrollY) - y0) <= 2, 'dy=' + (Math.round(window.scrollY) - y0));
    window.__termDock.expand(); await sleep(420);
    ok('expand → modal with inert background', window.__termDock.state() === 'expanded' && document.querySelector('main').inert === true);
    ok('expanded keeps focus inside the shell', q('#termOverlay').contains(document.activeElement));
    window.__termDock.close(); await sleep(420);
    ok('close restores page + exact scroll position', !window.__termDock.isOpen() && document.querySelector('main').inert === false && Math.abs(Math.round(window.scrollY) - y0) <= 2);
  }

  // 10 — command palette (⌘K) + shortcuts cheatsheet (?) + g-then-c jump
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })); await sleep(140);
  ok('⌘K opens the command palette', q('#palette').classList.contains('open'));
  const pin = q('#paletteInput'); if (pin){ pin.value = 'contact'; pin.dispatchEvent(new Event('input', { bubbles: true })); await sleep(70);
    ok('palette fuzzy-filters', qa('.palette__item').some(li => /contact/i.test(li.textContent))); }
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(120);
  ok('palette closes on Esc', !q('#palette').classList.contains('open'));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true })); await sleep(120);
  ok('? opens the shortcuts cheatsheet', q('#sheet').classList.contains('open'));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(120);
  ok('Esc closes the cheatsheet', !q('#sheet').classList.contains('open'));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true })); await sleep(1400);
  ok('g+c jumps to contact', Math.abs(q('#contact').getBoundingClientRect().top - 68) < 240, 'contactTop=' + Math.round(q('#contact').getBoundingClientRect().top));

  // 11 — global chrome + content-truth + a11y + motion policy
  ok('scroll-progress bar present', !!q('#buildbar'));
  ok('global magnetic pull wired ([data-mag])', qa('[data-mag]').length >= 5, qa('[data-mag]').length + ' magnets');
  ok('codefield is a fixed, full-viewport layer', (() => { const cf = q('#codefield'); if (!cf) return false; const cs = getComputedStyle(cf); return cs.position === 'fixed' && Math.abs(cf.offsetHeight - window.innerHeight) <= 8; })());
  ok('codefield flashlight active (--mx set)', getComputedStyle(q('#codefield') || document.documentElement).getPropertyValue('--mx').trim() !== '');
  scrollTo('#hero'); await sleep(300);
  ok('no horizontal page overflow', (document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, 'overflowX=' + (document.documentElement.scrollWidth - document.documentElement.clientWidth));
  ok('keyboard :focus-visible ring defined', [...document.styleSheets].some(ss => { try { return [...ss.cssRules].some(r => /:focus-visible/.test(r.selectorText || '')); } catch(e){ return false; } }));
  ok('motion always on (body not .no-motion)', !document.body.classList.contains('no-motion'));
  ok('no in-site motion toggle remains', !document.getElementById('motionToggle'));
  ok('no fabricated tools on page', !/(TestNG|JFrog|Splunk|New Relic|PagerDuty|CloudWatch|GitHub Enterprise)/i.test(document.body.innerText));
  ok('footer year current', !!q('#footYear') && q('#footYear').textContent === String(new Date().getFullYear()), q('#footYear') && q('#footYear').textContent);
  ok('shipped-ago shown', !!q('#deployedAgo') && /shipped/.test(q('#deployedAgo').textContent), q('#deployedAgo') && q('#deployedAgo').textContent);
  await sleep(1100);
  ok('session uptime ticking', !!q('#sessUptime') && /session \d/.test(q('#sessUptime').textContent), q('#sessUptime') && q('#sessUptime').textContent);

  const fail = checks.filter(c => !c.pass);
  scrollTo('#hero');
  return { pass: checks.length - fail.length, fail: fail.length, total: checks.length, failed: fail, checks };
};
