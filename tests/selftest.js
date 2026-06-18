/* =========================================================================
   Philip Toulinov portfolio — browser self-test
   Paste into DevTools console (or run via Playwright) on the live site.
   Returns a results object: { pass, fail, checks: [...] }.
   Async: await runSelfTest()
   ========================================================================= */
window.runSelfTest = async function runSelfTest(){
  const checks = [];
  const ok = (name, cond, detail) => checks.push({ name, pass: !!cond, detail: detail || '' });
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const q = (s) => document.querySelector(s);
  const op = (s) => { const e = q(s); return e ? parseFloat(getComputedStyle(e).opacity) : -1; };
  const scrollTo = (sel) => { const t = q(sel); if (window.__lenis) window.__lenis.scrollTo(t, { offset: -68, immediate: true }); else t.scrollIntoView(); };

  // 1 — fonts
  try {
    await document.fonts.ready;
    ok('font: Geist loaded', document.fonts.check('16px Geist'));
    ok('font: Geist Mono loaded', document.fonts.check('16px "Geist Mono"'));
    ok('font: JetBrains Mono loaded (terminal)', document.fonts.check('16px "JetBrains Mono"'));
    const fontLinks = [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.href).join(' ');
    ok('NO arty serif requested (Fraunces/Playfair absent)', !/Fraunces|Playfair/i.test(fontLinks));
    ok('UI font is Geist', /Geist/.test(getComputedStyle(document.body).fontFamily));
  } catch(e){ ok('fonts', false, String(e)); }

  // 2 — structure
  ['#hero','#work','#metrics','#stack','#about','#contact','#dag','#terminal','#palette','#codefield'].forEach(s =>
    ok('exists ' + s, !!q(s)));

  // 3 — hero revealed
  scrollTo('#hero'); await sleep(300);
  ok('hero title visible', op('.hero__title') > 0.9);
  ok('hero lede revealed', op('.hero__lede') >= 0.9);

  // 4 — pipeline DAG runs as a sequence on enter + reveals on jump (IntersectionObserver)
  scrollTo('#work'); await sleep(3600);   // let the full DAG sequence execute
  ok('pipeline head revealed on jump', op('#work .sec__title') >= 0.9);
  ok('dag revealed on jump', op('#dag') >= 0.9);
  const nodes = [...document.querySelectorAll('.dnode')];
  ok('5 DAG nodes', nodes.length === 5);
  ok('nodes 0-3 passed (pipeline ran)', nodes.slice(0,4).every(n => n.classList.contains('pass')), nodes.map(n=>n.className).join(' | '));
  ok('monitor node running (live)', nodes[4].classList.contains('run'));
  // deploy stage detail card (scroll to it so its card reveals + counter runs)
  scrollTo('#stage-3'); await sleep(1700);
  ok('deploy stage points revealed', op('.stage[data-stage="3"] [data-point]') >= 0.9);
  const deployCount = q('.stage[data-stage="3"] [data-count]');
  ok('deploy counter reached 30%', deployCount && /30/.test(deployCount.textContent), deployCount && deployCount.textContent);

  // 5 — observability
  scrollTo('#metrics'); await sleep(1600);
  ok('metrics tiles revealed', op('#metrics .tile') >= 0.9);
  const m0 = q('#metrics [data-count]');
  ok('metric counter ran', m0 && m0.textContent.trim().length > 0 && m0.textContent !== '0', m0 && m0.textContent);
  ok('sparkline drawn', (() => { const c = q('canvas[data-spark]'); return c && c.width > 10; })());

  // 6 — terminal (the explorable shell)
  scrollTo('#stack'); await sleep(400);
  ok('terminal revealed on jump', op('#terminal') >= 0.9);
  const input = q('#termInput'); const body = q('#termBody');
  const typeRun = (cmd) => { input.value = cmd; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); };
  const had = (txt) => body.innerText.includes(txt);
  typeRun('whoami'); ok('cmd whoami', had('Toulinov'));
  typeRun('git log'); ok('cmd git log → commits', had('LendingClub') && /[0-9a-f]{7}/.test(body.innerText));
  typeRun('git show a1c2d3e'); ok('cmd git show <hash>', had('commit a1c2d3e'));
  typeRun('kubectl get skills'); ok('cmd kubectl get skills', had('Running'));
  typeRun('top'); ok('cmd top (htop bars)', body.innerText.includes('[') && body.innerText.includes('%'));
  typeRun('cat lendingclub.md'); ok('cmd cat file', had('Release Engineer'));
  typeRun('theme staging'); await sleep(800); ok('cmd theme staging re-themes (view transition)', document.body.dataset.env === 'staging', 'env=' + document.body.dataset.env);
  typeRun('theme production'); await sleep(800);
  typeRun('definitelynotacommand'); ok('unknown cmd handled', had('command not found'));
  // tab-completion
  input.value = 'kube'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  ok('tab-completion', input.value.startsWith('kubectl'), 'got: ' + input.value); input.value = '';

  // 6b — toolchain logos + NO-FABRICATION guard
  const tools = [...document.querySelectorAll('#toolchain .tool')];
  ok('toolchain has 15 tool logos', tools.length === 15, 'count=' + tools.length);
  ok('every tool logo has a mask + name', tools.length > 0 && tools.every(t => {
    const ico = t.querySelector('.tool__ico'); const nm = t.querySelector('.tool__name');
    const cs = ico && getComputedStyle(ico);
    const mask = cs && (cs.maskImage !== 'none' ? cs.maskImage : cs.webkitMaskImage);
    return mask && mask !== 'none' && mask.indexOf('url(') === 0 && nm && nm.textContent.trim().length > 0;
  }));
  ok('no fabricated tools on page', !/(TestNG|JFrog|Splunk|New Relic|PagerDuty|CloudWatch|GitHub Enterprise)/i.test(document.body.innerText), 'a removed/fabricated tool reappeared');

  // 7 — command palette (⌘K)
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  await sleep(120);
  ok('⌘K opens palette', q('#palette').classList.contains('open'));
  const pin = q('#paletteInput'); pin.value = 'email'; pin.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(60);
  ok('palette fuzzy-filters', [...document.querySelectorAll('.palette__item')].some(li => /email/i.test(li.textContent)));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(120);
  ok('palette closes on Esc', !q('#palette').classList.contains('open'));

  // 8 — code field present + scroll-aware sizing
  ok('codefield is a fixed viewport layer', (() => { const cf = q('#codefield'); if (!cf) return false; const cs = getComputedStyle(cf); return cs.position === 'fixed' && Math.abs(cf.getBoundingClientRect().height - window.innerHeight) <= 4; })());
  ok('codefield has varied content', (() => { const b = q('#codeBase'); return b && b.textContent.includes('Jenkinsfile') && b.textContent.includes('Terraform') && b.textContent.includes('Dockerfile'); })());

  // 9 — v2.1 differentiators
  // live clock
  ok('hero live clock populated', (() => { const c = q('#heroClock'); return c && /\d\d:\d\d/.test(c.textContent); })(), q('#heroClock') && q('#heroClock').textContent);
  // DAG node click → jump + flash
  scrollTo('#work'); await sleep(300);
  const node3 = q('.dnode[data-node="3"] button'); node3 && node3.click(); await sleep(200);
  ok('DAG node click flashes target card', q('#stage-3').classList.contains('stage--flash'));
  // terminal quick chips + deploy command
  ok('terminal quick-command chips present', document.querySelectorAll('#termChips button').length >= 5);
  scrollTo('#stack'); await sleep(300);
  const cmdsBefore = q('#termBody').querySelectorAll('.cmd').length;
  const chip = [...document.querySelectorAll('#termChips button')].find(b => b.dataset.cmd === 'git log');
  chip && chip.click(); await sleep(150);
  ok('chip click runs command', q('#termBody').querySelectorAll('.cmd').length > cmdsBefore);
  q('#termInput').value = 'deploy'; q('#termInput').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await sleep(300);
  ok('terminal deploy cmd opens overlay', !!document.getElementById('deployOv'));
  document.getElementById('deployOv') && document.getElementById('deployOv').remove();
  // keyboard shortcuts: ? opens cheatsheet
  document.body.focus();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
  await sleep(120);
  ok('? opens shortcuts cheatsheet', q('#sheet').classList.contains('open'));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(120);
  ok('Esc closes cheatsheet', !q('#sheet').classList.contains('open'));
  // g+c navigation → contact lands near top of viewport
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
  await sleep(1500);
  ok('g+c jumps to contact', Math.abs(q('#contact').getBoundingClientRect().top - 68) < 220, 'contactTop=' + Math.round(q('#contact').getBoundingClientRect().top));
  // palette has shortcuts item
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })); await sleep(100);
  ok('palette lists Keyboard shortcuts', [...document.querySelectorAll('.palette__item')].some(li => /keyboard/i.test(li.textContent)));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(100);

  // 10 — honest live status + commit-a-message form
  ok('footer year current', q('#footYear') && q('#footYear').textContent === String(new Date().getFullYear()));
  ok('shipped-ago shown', q('#deployedAgo') && /shipped/.test(q('#deployedAgo').textContent), q('#deployedAgo') && q('#deployedAgo').textContent);
  await sleep(1100);
  ok('session uptime ticking', q('#sessUptime') && /session \d/.test(q('#sessUptime').textContent), q('#sessUptime') && q('#sessUptime').textContent);
  scrollTo('#contact'); await sleep(300);
  ok('commit form present', !!q('#commitForm'));
  q('#cmSubject').value = ''; q('#commitForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(80);
  ok('commit empty-subject guarded', /aborting/.test(q('#cmOut').innerText));
  q('#cmSubject').value = 'release role at Acme'; q('#cmBody').value = 'hello there';
  q('#commitForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await sleep(500);
  ok('commit push animates output', /contact [0-9a-f]{7}|git commit/i.test(q('#cmOut').innerText), q('#cmOut').innerText.slice(0,40));

  // 11 — best-of wave (custom font + unique animations + research differentiators)
  try { await document.fonts.ready; ok('display font Bricolage Grotesque loaded', document.fonts.check('700 32px "Bricolage Grotesque"')); } catch(e){ ok('display font', false, String(e)); }
  ok('hero title uses display font', /Bricolage/.test(getComputedStyle(q('.hero__title')).fontFamily));
  // env chip → theme switch (View Transitions)
  ok('env chip present', !!q('#envChip'));
  const env0 = document.body.dataset.env || 'production';
  q('#envChip') && q('#envChip').click(); await sleep(750);
  ok('env chip switches theme', (document.body.dataset.env || 'production') !== env0, 'env=' + (document.body.dataset.env || 'production'));
  // reachability
  ok('reachability status populated', q('#reach') && /awake|asleep/i.test(q('#reach').innerText), q('#reach') && q('#reach').innerText.slice(0, 36));
  // copy morph
  scrollTo('#contact'); await sleep(300);
  const cp = q('#copyEmail'); cp && cp.click(); await sleep(140);
  ok('copy button morphs to copied', cp && /copied/i.test(cp.textContent));
  // build-log micro-stream
  scrollTo('#stage-3'); await sleep(1500);
  const slog = q('.stage[data-stage="3"] .stage__log');
  ok('stage build-log streamed', slog && slog.innerText.includes('✓'), slog && slog.innerText.replace(/\n/g, ' ').slice(0, 50));
  // konami → rollback
  ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'].forEach(k => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })));
  await sleep(120);
  ok('konami toggles rollback mode', document.body.classList.contains('rollback'));
  document.body.classList.remove('rollback');
  // pulsing presence dot on passing tile
  ok('pulsing status dot present', !!q('.tile__v .tdot.ping'));
  // reset env to production so final captures are amber
  try { localStorage.setItem('pt_env', 'production'); } catch(e){}
  document.body.dataset.env = '';

  // 12 — design-implementation features (thesis / statuspage / playable incident / DAG hover / whoami --json)
  // motion ALWAYS plays: no in-site toggle, and the OS reduce-motion setting is intentionally not honored
  ok('motion always on (body not .no-motion)', !document.body.classList.contains('no-motion'));
  ok('no in-site motion toggle remains', !document.getElementById('motionToggle'));

  // hero statuspage — 4 component rows × 90 daily bars = 360, with the live clock nested inside
  ok('hero statuspage present', !!q('#statuspage'));
  ok('statuspage has 4 component rows', document.querySelectorAll('#statuspage .sp__row').length === 4, 'rows=' + document.querySelectorAll('#statuspage .sp__row').length);
  ok('statuspage rendered 360 uptime bars', document.querySelectorAll('#statuspage .sp__bars *').length === 360, 'bars=' + document.querySelectorAll('#statuspage .sp__bars *').length);
  ok('live clock lives inside statuspage', !!q('#statuspage #heroClock'));

  // thesis — pinned, scrubbed kinetic typography sitting between hero and pipeline
  const secIds = [...document.querySelectorAll('section[id]')].map(s => s.id);
  ok('thesis section sits between hero and work', secIds.indexOf('thesis') > secIds.indexOf('hero') && secIds.indexOf('thesis') < secIds.indexOf('work'), secIds.join(','));
  ok('thesis beat 0 has 6 scatter words', document.querySelectorAll('#thesis [data-beat="0"] .tw').length === 6, 'tw=' + document.querySelectorAll('#thesis [data-beat="0"] .tw').length);
  const thesisST = (window.ScrollTrigger ? ScrollTrigger.getAll() : []).find(t => t.vars.trigger && t.vars.trigger.id === 'thesis');
  ok('thesis is pinned + scrubbed (ScrollTrigger)', !!(thesisST && thesisST.vars.pin), thesisST ? ('pin=' + !!thesisST.vars.pin + ' scrub=' + thesisST.vars.scrub) : 'no ScrollTrigger on #thesis');
  if (thesisST) {
    const span = thesisST.end - thesisST.start;
    const beatOp = () => [...document.querySelectorAll('#thesis .thesis__beat')].map(b => parseFloat(getComputedStyle(b).opacity));
    const goP = (f) => { const y = thesisST.start + span * f; if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y); window.ScrollTrigger && ScrollTrigger.update(); };
    goP(0.42); await sleep(760);
    const mid = beatOp(); const pctMid = (q('#thesis .thesis__pct') || {}).textContent || '';
    ok('thesis beat 0 converged mid-scrub', mid[0] > 0.6 && mid[1] < 0.2, 'op=' + mid.map(x => x.toFixed(2)).join(','));
    ok('thesis "% compiled" readout tracks scroll', /\d+% compiled/.test(pctMid), 'pct=' + pctMid);
    goP(1); await sleep(760);
    const end = beatOp();
    ok('thesis locks to final beat at 100%', end[2] > 0.6 && end[0] < 0.2, 'op=' + end.map(x => x.toFixed(2)).join(','));
    ok('thesis readout reaches 100% compiled', /100% compiled/.test((q('#thesis .thesis__pct') || {}).textContent || ''));
    scrollTo('#work'); await sleep(2600);
    ok('pipeline reveals + runs after the thesis pin', parseFloat(getComputedStyle(q('#dag')).opacity) >= 0.9 && [...document.querySelectorAll('.dnode')].slice(0, 4).every(n => n.classList.contains('pass')));
  }

  // playable incident — acknowledge → investigate → rollback → resolve → MTTR 47s
  scrollTo('#metrics'); await sleep(500);
  const incBtns = [...document.querySelectorAll('#incident .incident__btn[data-step]')];
  ok('incident exposes 4 steps', incBtns.length === 4, 'btns=' + incBtns.length);
  const incResult = q('#incResult'), incTimer = q('#incTimer');
  for (let i = 0; i < 4 && incBtns.length === 4; i++) {
    let t = 0; while (incBtns[i].disabled && t < 40) { await sleep(100); t++; }
    if (incBtns[i].disabled) break;
    incBtns[i].click();
    t = 0; while (t < 70) { await sleep(100); t++; if (i < 3 && !incBtns[i + 1].disabled) break; if (i === 3 && incResult && !incResult.hidden) break; }
  }
  await sleep(300);
  ok('incident resolves on MTTR 47s', incResult && !incResult.hidden && /MTTR 47s/.test(incResult.textContent), incResult && incResult.textContent.trim().slice(0, 44));
  ok('incident clock reaches 00:47', incTimer && incTimer.textContent === '00:47', incTimer && incTimer.textContent);
  // content-truth holds EVEN AFTER the incident streams its logs (no branded on-call tool reintroduced)
  ok('no branded/fabricated tool after incident plays', q('#incLog') && !/pagerduty/i.test(q('#incLog').innerText) && !/(TestNG|JFrog|Splunk|New Relic|PagerDuty|CloudWatch|GitHub Enterprise)/i.test(document.body.innerText), (q('#incLog') || {}).innerText && q('#incLog').innerText.replace(/\n/g, ' ').slice(0, 50));

  // DAG node hover preview (desktop pointers only)
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) {
    scrollTo('#work'); await sleep(300);
    const dnode = q('.dnode[data-node="3"]');
    dnode && dnode.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await sleep(150);
    const dpop = q('.dagpop');
    ok('DAG hover shows a role popover', !!dpop && dpop.classList.contains('show') && /LendingClub|Release/i.test(dpop.innerText), dpop && dpop.innerText.replace(/\n/g, ' ').slice(0, 44));
    ok('DAG popover carries tool logos', !!dpop && dpop.querySelectorAll('.dagpop__logos i').length >= 3, dpop && ('logos=' + dpop.querySelectorAll('.dagpop__logos i').length));
    dnode && dnode.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
  }

  // whoami --json → the page's real schema.org/Person JSON-LD
  scrollTo('#stack'); await sleep(400);
  const wjIn = q('#termInput'), wjBody = q('#termBody');
  wjIn.value = 'whoami --json'; wjIn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await sleep(160);
  ok('whoami --json prints schema.org/Person JSON-LD', /"@type"\s*:\s*"Person"|schema\.org/i.test(wjBody.innerText) && /Toulinov/.test(wjBody.innerText));

  // no horizontal page overflow (the thesis scatter-word overflow bug must stay fixed)
  scrollTo('#hero'); await sleep(400);
  ok('no horizontal page overflow', (document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, 'overflowX=' + (document.documentElement.scrollWidth - document.documentElement.clientWidth));

  // a11y: a visible keyboard focus ring is defined (guards the :focus-visible fix)
  ok('keyboard :focus-visible ring defined', [...document.styleSheets].some(ss => { try { return [...ss.cssRules].some(r => /:focus-visible/.test(r.selectorText || '')); } catch(e){ return false; } }));

  // hero terminal · pinned ascii banner · collapse-to-dock + expand-overlay (the signature interaction)
  ok('hero terminal banner pinned', !!q('#heroTerm .heroterm__banner .term-banner'));
  ok('whoami.yaml profile renders', document.querySelectorAll('#about .pln').length >= 6);
  if (window.__termDock){
    scrollTo('#contact'); await sleep(300);
    const yBefore = Math.round(window.scrollY);
    // dock opens a SMALL, NON-modal window — the page must stay usable (not inert)
    window.__termDock.open(); await sleep(440);
    ok('dock opens the mini terminal', window.__termDock.isOpen() && window.__termDock.state() === 'mini' && !q('#termOverlay').hidden);
    ok('mini keeps focus inside the shell', q('#termOverlay').contains(document.activeElement));
    ok('mini is NON-modal (page not inert)', document.querySelector('main').inert === false);
    ok('mini holds the scroll position', Math.abs(Math.round(window.scrollY) - yBefore) <= 2, 'dy=' + (Math.round(window.scrollY) - yBefore));
    // expand → a centered MODAL overlay (focus-trapped, background inert, scroll held)
    window.__termDock.expand(); await sleep(440);
    ok('expand → modal (background inert)', window.__termDock.state() === 'expanded' && document.querySelector('main').inert === true);
    ok('expanded keeps focus inside the shell', q('#termOverlay').contains(document.activeElement));
    ok('expanded holds the scroll position', Math.abs(Math.round(window.scrollY) - yBefore) <= 2, 'dy=' + (Math.round(window.scrollY) - yBefore));
    window.__termDock.close(); await sleep(420);
    ok('close restores the exact scroll position', Math.abs(Math.round(window.scrollY) - yBefore) <= 2, 'dy=' + (Math.round(window.scrollY) - yBefore));
    ok('closed · shell back home · page restored', !window.__termDock.isOpen() && q('#heroTermSlot').contains(q('#heroTerm')) && document.querySelector('main').inert === false);
  }

  const fail = checks.filter(c => !c.pass);
  scrollTo('#hero');
  return { pass: checks.length - fail.length, fail: fail.length, total: checks.length, failed: fail, checks };
};
