/* =========================================================================
   Philip Toulinov — portfolio engine v2
   vendored: gsap, ScrollTrigger, Lenis  (window globals)
   ========================================================================= */

// Motion is ALWAYS on, never auto-off (product decision, re-confirmed 2026-06-17). The site does
// NOT honor the OS "reduce motion" setting — it suppressed the signature animations the portfolio
// is built around — and there is no in-site toggle (the self-test asserts #motionToggle is absent).
// The ambient code-field flashlight in particular must keep moving; it is never turned off.
// reduceQuery is a stub shaped like a MediaQueryList so the legacy `reduceQuery.matches` guards
// simply never trip.
const reduceQuery = { matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} };
const isTouch = window.matchMedia('(hover: none)').matches;
const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
let motionOn = true;   // always animate, never auto-off
let lenis = null;

if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

/* cross-document deploy-handoff to projects.html removed: projects.html and the #bdGrid demo-card
   grid (.pj-build / .pj-case cards) no longer exist — the Transit Map is the sole builds surface. */

/* ---------- boot (invoked at end of file, after all module state is initialized) ---------- */
function boot(){
  // motion is always-on by design (see header note); reduceQuery is stubbed, so this branch only
  // trips the no-motion fallback when GSAP failed to load — never from an OS reduce-motion setting.
  if (!motionOn) window.__motionPaused = true;   // halt the ambient rAF loop in the no-motion fallback
  if (!motionOn || !hasGSAP){
    document.body.classList.add('no-motion');
    runPreloader(true);
  } else {
    primeHidden();
    runPreloader(false);
  }
  if (!isTouch) initCursor();
  initCodeField();
  initNav();
  initTerminal();
  initHeroDock();
  initPalette();
  initNavHint();
  initEnvFromStorage();
  initClock();
  initShortcuts();
  initDagNav();
  initStatus();
  initCommit();
  initEnvChip();
  initCopy();
  initToolchain();
  initStatuspage();
  initIncident();
  initDagHover();
  initStageLogos();
  initBanner();
  initConsole();
  initKonami();
}

/* =====================  TOOLCHAIN — logos light up in a wave on scroll-in  ===================== */
function initToolchain(){
  const grid = document.getElementById('toolchain'); if (!grid) return;
  const tools = [...grid.querySelectorAll('.tool')];
  if (reduceQuery.matches) return;                 // hover still works; skip the motion wave
  inView(grid, () => {
    tools.forEach((t, i) => setTimeout(() => {
      t.classList.add('tool--lit');
      setTimeout(() => t.classList.remove('tool--lit'), 650);
    }, i * 60));
  }, { threshold: .2 });
}

/* =====================  CONSOLE HIRE-ME BANNER  ===================== */
function initConsole(){
  try {
    const big = 'color:#f5b642;font:700 22px ui-monospace,monospace';
    const dim = 'color:#a9a39a;font:400 12px ui-monospace,monospace';
    const ok  = 'color:#5ee6c0;font:500 12px ui-monospace,monospace';
    console.log('%c> philip toulinov', big);
    console.log('%crelease & devops engineer · you opened the console — respect.', dim);
    console.log('%c✓ hiring? toulinov.philip@yahoo.com  (mention you found this in DevTools)', ok);
    console.log('%ctry the Konami code on the page. ↑↑↓↓←→←→ b a', dim);
  } catch(e){}
}

/* =====================  KONAMI → rollback/retro mode  ===================== */
function initKonami(){
  const seq = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
  let idx = 0;
  document.addEventListener('keydown', (e) => {
    const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const k = e.key.toLowerCase();
    idx = (k === seq[idx]) ? idx + 1 : (k === seq[0] ? 1 : 0);
    if (idx === seq.length){ idx = 0; rollback(); }
  });
}
function rollback(){
  document.body.classList.toggle('rollback');
  const on = document.body.classList.contains('rollback');
  toast(on ? '⟲ git revert HEAD — rolled back to retro mode' : '✓ git redo — back to production');
  chime();
}

/* =====================  COMMIT-A-MESSAGE CONTACT FORM (mailto, no backend)  ===================== */
function hashStr(s){ let h = 0; for (let i = 0; i < s.length; i++){ h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return h; }
function initCommit(){
  const form = document.getElementById('commitForm');
  if (!form) return;
  const out = document.getElementById('cmOut');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const subj = document.getElementById('cmSubject').value.trim();
    const body = document.getElementById('cmBody').value.trim();
    const email = document.getElementById('cmEmail').value.trim();
    if (!subj){ out.innerHTML = '<span class="r">✗ aborting commit — the message subject is empty.</span>'; document.getElementById('cmSubject').focus(); return; }
    const sha = (hashStr(subj + body + email) >>> 0).toString(16).padStart(8, '0').slice(0, 7);
    const words = body ? body.split(/\s+/).filter(Boolean).length : 1;
    const lines = [
      `<span class="d">$</span> git commit -m "${escapeHtml(subj)}"`,
      `<span class="g">[contact ${sha}]</span> ${escapeHtml(subj)}`,
      ` 1 file changed, ${words} insertion${words === 1 ? '' : 's'}(+)`,
      `<span class="d">$</span> git push origin contact`,
      ` Enumerating objects: 3, done.`,
      ` To philip:~/inbox — pushing…`
    ];
    // progressive enhancement: POST to the Netlify Forms backend; if that endpoint
    // isn't there (local/static host, network error), fall back to the mail client.
    const mailFallback = () => {
      const subject = encodeURIComponent('[portfolio] ' + subj);
      const mailBody = encodeURIComponent((body || '') + (email ? `\n\n— ${email}` : '') + '\n\n(sent from philiptoulinov.com)');
      out.innerHTML += `\n <span class="d">no inbox endpoint here — opening your mail client…</span>`;
      try { window.location.href = `mailto:toulinov.philip@yahoo.com?subject=${subject}&body=${mailBody}`; } catch(err){}
    };
    const deliver = () => {
      const data = new URLSearchParams();
      data.append('form-name', 'contact'); data.append('subject', subj);
      data.append('message', body); data.append('email', email);
      // a static host (e.g. python http.server) rejects POST → fetch rejects/!ok → mailto.
      fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: data.toString() })
        .then(r => { if (r && r.ok){ out.innerHTML += `\n To philip:~/inbox — <span class="g">✓ delivered</span>. I'll reply soon.`; } else { mailFallback(); } })
        .catch(() => mailFallback());
    };
    let i = 0; out.innerHTML = '';
    const step = () => {
      if (i < lines.length){ out.innerHTML = lines.slice(0, i + 1).join('\n'); i++; blip(440 + i * 40, .04, 'square', .025); setTimeout(step, 230); }
      else { chime(); deliver(); }
    };
    step();
  });
}

/* =====================  HONEST LIVE STATUS (shipped-ago + session uptime)  ===================== */
function initStatus(){
  // CI-ready: a deploy step can emit window.DEPLOYED_AT (ISO) to make this the REAL ship time.
  const BUILD_TS = (typeof window.DEPLOYED_AT === 'string') ? window.DEPLOYED_AT : '2026-06-15T11:30:00-07:00';
  const yEl = document.getElementById('footYear'); if (yEl) yEl.textContent = new Date().getFullYear();
  const dEl = document.getElementById('deployedAgo');
  if (dEl){
    try {
      const diff = Date.now() - new Date(BUILD_TS).getTime();
      const day = 86400000;
      if (diff < day) dEl.textContent = 'shipped today';
      else if (diff < 14 * day) { const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' }); dEl.textContent = 'shipped ' + rtf.format(-Math.floor(diff / day), 'day'); }
      // cap the drift: past two weeks, show the build month instead of an ever-growing "N weeks ago" that reads stale
      else { const b = new Date(BUILD_TS); dEl.textContent = 'shipped ' + b.getFullYear() + '.' + String(b.getMonth() + 1).padStart(2, '0'); }
    } catch(e){ dEl.textContent = 'shipped 2026.06'; }
  }
  const uEl = document.getElementById('sessUptime');
  if (uEl){
    const t0 = performance.now();
    const tick = () => { const s = Math.floor((performance.now() - t0) / 1000), m = Math.floor(s / 60); uEl.textContent = m > 0 ? `session ${m}m ${s % 60}s` : `session ${s}s`; };
    tick(); setInterval(tick, 1000);
  }
}

/* =====================  LIVE CLOCK + REACHABILITY (SF local time)  ===================== */
function sfOffsetHours(){
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'shortOffset' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName');
    const m = part && part.value.match(/GMT([+-]\d+)/); if (m) return parseInt(m[1], 10);
  } catch(e){}
  return -7;
}
function initClock(){
  const el = document.getElementById('heroClock');
  const reach = document.getElementById('reach');
  const tick = () => {
    let sfHour = null;
    try {
      if (el) el.textContent = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hour12: false }) + ' PT';
      sfHour = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', hour12: false }).format(new Date()), 10);
    } catch(e){ if (el) el.textContent = new Date().toTimeString().slice(0, 5) + ' PT'; }
    if (reach && sfHour != null && !isNaN(sfHour)){
      const awake = sfHour >= 8 && sfHour <= 23;
      let diff = '';
      try { const d = Math.round((-new Date().getTimezoneOffset() / 60) - sfOffsetHours()); if (d) diff = ` · you're ${Math.abs(d)}h ${d > 0 ? 'ahead' : 'behind'}`; } catch(e){}
      reach.innerHTML = awake
        ? `<span class="dot-ok"></span>probably awake in SF — quick to reply${diff}`
        : `<span class="dot-idle"></span>likely asleep in SF — I'll reply in the morning${diff}`;
    }
  };
  tick(); setInterval(tick, 30000);
}

/* =====================  KEYBOARD SHORTCUTS (g+key nav, ? cheatsheet, / terminal)  ===================== */
function toggleSheet(){ const s = document.getElementById('sheet'); if (!s) return; const open = !s.classList.contains('open'); s.classList.toggle('open', open); s.setAttribute('aria-hidden', String(!open)); }
function closeSheet(){ const s = document.getElementById('sheet'); if (s){ s.classList.remove('open'); s.setAttribute('aria-hidden', 'true'); } }
function initShortcuts(){
  let gPending = false, gTimer = null;
  const typing = (e) => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape'){ closeSheet(); }
    if (e.metaKey || e.ctrlKey || e.altKey || typing(e)) return;
    if (e.key === '?'){ e.preventDefault(); toggleSheet(); return; }
    if (e.key === '/'){ e.preventDefault(); scrollToId('#top'); setTimeout(() => document.getElementById('heroTermInput')?.focus(), 700); return; }
    const k = e.key.toLowerCase();
    if (k === 'g'){ gPending = true; clearTimeout(gTimer); gTimer = setTimeout(() => gPending = false, 1200); return; }
    if (gPending){
      gPending = false; clearTimeout(gTimer);
      const map = { p:'#work', b:'#transitMap', c:'#contact', h:'#top' };
      if (map[k]){ e.preventDefault(); scrollToId(map[k]); }
    }
  });
  document.getElementById('sheetScrim')?.addEventListener('click', closeSheet);
}

/* =====================  DAG NODE → JUMP TO STAGE (always wired)  ===================== */
function initDagNav(){
  document.querySelectorAll('.dnode[data-node]').forEach((node) => {
    const i = parseInt(node.dataset.node, 10);
    const btn = node.querySelector('button');
    if (!btn) return;
    btn.setAttribute('data-cursor', 'open');
    btn.addEventListener('click', () => {
      scrollToId('#stage-' + i);
      const card = document.getElementById('stage-' + i);
      if (card){ card.classList.add('stage--flash'); setTimeout(() => card.classList.remove('stage--flash'), 1300); }
    });
  });
}

function primeHidden(){
  const rv = gsap.utils.toArray('[data-reveal]'); if (rv.length) gsap.set(rv, { opacity: 0, y: 22 });
  const pt = gsap.utils.toArray('[data-point]'); if (pt.length) gsap.set(pt, { opacity: 0, y: 12 });   // [data-point] is empty in Flux (pipeline removed) — skip to avoid GSAP empty-target warning
}

/* =====================  PRELOADER  ===================== */
function runPreloader(instant){
  const el = document.getElementById('preloader');
  const logEl = document.getElementById('preLog');
  const prog = document.getElementById('preProgress');
  const skip = document.getElementById('preSkip');
  if (!el){ afterLoad(); return; }

  const lines = [
    '<span class="d">$</span> philip deploy <span class="a">--target</span> portfolio <span class="a">--env</span> production',
    '  ↳ resolving identity ............ <span class="g">ok</span>',
    '  ↳ compiling experience .......... <span class="g">ok</span>',
    '  ↳ running checks ................ <span class="g">passed</span>',
    '  ↳ provisioning interface ........ <span class="g">ok</span>',
    '<span class="g">✓</span> deployed in 1.2s — <span class="a">welcome.</span>'
  ];

  let done = false;
  const finish = () => {
    if (done) return; done = true;
    if (!hasGSAP){ el.style.display = 'none'; afterLoad(); return; }
    gsap.to(el, { autoAlpha: 0, duration: .4, ease: 'power2.inOut',
      onComplete: () => { el.style.display = 'none'; afterLoad(); } });
  };
  if (skip) skip.addEventListener('click', finish);

  if (instant){
    logEl.innerHTML = lines.join('\n');
    if (prog) prog.style.width = '100%';
    setTimeout(finish, 220);
    return;
  }

  let i = 0;
  const step = () => {
    if (i < lines.length){
      logEl.innerHTML = lines.slice(0, i + 1).join('\n');
      if (prog) prog.style.width = Math.round(((i + 1) / lines.length) * 100) + '%';
      i++;
      setTimeout(step, i === 1 ? 150 : 85);
    } else {
      setTimeout(finish, 170);
    }
  };
  setTimeout(step, 170);
}

function afterLoad(){
  document.body.classList.remove('is-loading');
  initProfile();
  initDecode();
  initFlowRails();
  initSectionShells();
  initCardFX();
  window.__ptValidate = consoleValidation;                               // exposed so the runner can trigger it deterministically
  setTimeout(() => { try { consoleValidation(); } catch(e){} }, 3000);   // and auto-report once the page has settled
  initHeroLinks();                                                       // hero CTAs (resume jump) — no-ops when absent; runs on both paths
  initContactHeadline();                                                 // "compile by sweep" on the contact headline (#ctHead)
  if (!motionOn || !hasGSAP){ initBuildbar(); initCounters(); initSparklines(); initPipelineStatic(); return; }
  initLenis();
  revealHero();
  initScrollReveals();
  initVelocitySkew();
  initScanPanel();
  initHeadlineCompile();
  initThroughput();
  initThesis();
  initThesisAutoScroll();
  initHeroDots();                                                        // clickable terminal traffic-light dots → jump to Builds
  initPipeline();
  initBuildbar();
  initCounters();
  initSparklines();
  if (window.ScrollTrigger) ScrollTrigger.refresh();
  // keep the pinned thesis aligned + every section correctly triggered after a viewport or
  // orientation change (the self-test resizes between 1280px and mobile; previously only the
  // sparkline canvas redrew on resize, so the pin could drift).
  const refreshST = debounce(() => { if (window.ScrollTrigger) ScrollTrigger.refresh(); }, 180);
  window.addEventListener('resize', refreshST);
  window.addEventListener('orientationchange', refreshST);
}

/* =====================  HERO REVEAL — "compile in" entrance (variation #12)  =====================
   The terminal scatter-assembles from blurred/rotated pieces, a CRT scan bar finishes it
   with chromatic aberration, the ASCII name + the side paragraph each pixel-dissolve in,
   then the phrase after the em-dash keeps retyping itself. Tilt / spotlight / glitch stay
   live on the in-page shell. Runs only on the motion path (afterLoad gates it). */
function revealHero(){
  const term = document.getElementById('heroTerm');
  const wrap = document.querySelector('.hero__term');
  // reveal the surrounding hero chrome (eyebrow, CTAs, scroll cue) with a quick rise
  const chrome = gsap.utils.toArray('.hero [data-reveal]').filter((el) => el !== wrap && !el.closest('.hero__side'));
  if (chrome.length) gsap.to(chrome, { opacity: 1, y: 0, duration: .8, stagger: .07, ease: 'expo.out' });
  if (!term || !wrap){ gsap.to(gsap.utils.toArray('.hero [data-reveal]'), { opacity: 1, y: 0, duration: .6 }); return; }
  heroEntrance(term, wrap);
}

function injectHeroFX(){
  if (document.getElementById('hero-fx-css')) return;
  const s = document.createElement('style'); s.id = 'hero-fx-css';
  s.textContent = '@keyframes heroTagBlink{0%,49%{opacity:1}50%,100%{opacity:0}}';
  document.head.appendChild(s);
}

function heroEntrance(term, wrap){
  injectHeroFX();
  const side  = document.querySelector('.hero__side');
  const lede  = document.querySelector('.hero__lede');
  const pitch = document.querySelector('.hero__pitch');
  // we drive the inner pieces ourselves — clear the GSAP-primed hidden state on the wrappers
  gsap.set(wrap, { opacity: 1, y: 0, clearProps: 'transform' });
  if (lede || pitch) gsap.set([lede, pitch].filter(Boolean), { opacity: 1, y: 0, clearProps: 'transform' });

  // 1 — scatter-assemble the terminal pieces
  const pieces = ['.terminal__bar', '.term-chips', '.heroterm__banner', '.terminal__scroll']
    .map((s) => term.querySelector(s)).filter(Boolean);
  const SCAT = Math.min(1, (window.innerWidth || 1200) / 900);   // tighter fly-in on phones so pieces never bleed past the viewport
  const rnd = (a) => (Math.random() * 2 - 1) * a * SCAT;
  const prevOX = document.documentElement.style.overflowX;
  document.documentElement.style.overflowX = 'hidden';           // clip any transient horizontal bleed during the scatter
  pieces.forEach((p) => {
    p.style.willChange = 'transform,opacity,filter';
    p.style.transition = 'none'; p.style.opacity = '0'; p.style.filter = 'blur(7px)';
    p.style.transform = 'translate(' + rnd(120) + 'px,' + rnd(-90) + 'px) rotate(' + ((Math.random() * 2 - 1) * 10) + 'deg)';
  });
  void term.offsetWidth;
  pieces.forEach((p, i) => setTimeout(() => {
    p.style.transition = 'transform .6s cubic-bezier(.34,1.4,.32,1), opacity .3s, filter .4s';
    p.style.transform = 'translate(0,0) rotate(0)'; p.style.opacity = '1'; p.style.filter = 'blur(0)';
  }, 90 + i * 95));
  const scatterDone = 90 + pieces.length * 95 + 560;

  // 2 — CRT scan-bar + chromatic aberration finish
  setTimeout(() => heroScanPass(term), Math.max(320, scatterDone - 380));
  // 3 — pixel-dissolve the ASCII name
  const banner = term.querySelector('.heroterm__banner');
  if (banner) setTimeout(() => heroPixelDissolve(banner, 18, 8, 700), Math.max(360, scatterDone - 280));
  // 4 — pixel-dissolve the side paragraph
  if (side) setTimeout(() => heroPixelDissolve(side, 16, 7, 720), Math.max(420, scatterDone - 180));

  // 5 — settle safeguard, then the live tagline + interactive layer
  setTimeout(() => { pieces.forEach((p) => {
    p.style.transition = 'none'; p.style.transform = 'none'; p.style.opacity = '1'; p.style.filter = 'none'; p.style.willChange = '';
  }); document.documentElement.style.overflowX = prevOX; }, scatterDone + 1100);
  setTimeout(() => { startHeroTagline(); setupHeroInteractive(term); }, scatterDone + 720);
}

function heroPixelDissolve(host, cols, rows, dur){
  if (!host) return;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const grid = document.createElement('div');
  grid.style.cssText = 'position:absolute;inset:0;z-index:7;display:grid;pointer-events:none;grid-template-columns:repeat(' + cols + ',1fr);grid-template-rows:repeat(' + rows + ',1fr);';
  const n = cols * rows, cells = [];
  for (let i = 0; i < n; i++){ const c = document.createElement('div'); c.style.cssText = 'background:#0c0b10;transition:opacity .42s ease-out;'; grid.appendChild(c); cells.push(c); }
  host.appendChild(grid);
  cells.map((c, i) => i).sort(() => Math.random() - 0.5).forEach((ci, k) => setTimeout(() => { cells[ci].style.opacity = '0'; }, k * (dur / n)));
  setTimeout(() => { try { grid.remove(); } catch(e){} }, dur + 560);
}

function heroScanPass(term){
  if (getComputedStyle(term).position === 'static') term.style.position = 'relative';
  const h = term.offsetHeight || 380;
  const bar = document.createElement('div');
  bar.style.cssText = 'position:absolute;left:0;right:0;top:0;height:3px;z-index:9;pointer-events:none;background:linear-gradient(90deg,transparent,#f5b642,transparent);box-shadow:0 0 18px 3px rgba(245,182,66,.7);';
  term.appendChild(bar);
  if (bar.animate) bar.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(' + h + 'px)' }], { duration: 860, easing: 'linear' });
  term.style.filter = 'drop-shadow(2px 0 rgba(248,85,63,.45)) drop-shadow(-2px 0 rgba(94,200,255,.45))';
  setTimeout(() => { term.style.filter = 'none'; try { bar.remove(); } catch(e){} }, 900);
}

function startHeroTagline(){
  const hl = document.querySelector('.hero__lede .hl');
  if (!hl || hl.__rotating) return; hl.__rotating = true;
  let cur = hl.nextElementSibling;
  if (!(cur && cur.classList && cur.classList.contains('hero-tagcur'))){
    cur = document.createElement('span'); cur.className = 'hero-tagcur';
    cur.style.cssText = 'display:inline-block;width:.5em;height:1.05em;background:#f5b642;transform:translateY(2px);margin-left:1px;vertical-align:middle;animation:heroTagBlink 1.05s steps(1) infinite;';
    hl.parentNode.insertBefore(cur, hl.nextSibling);
  }
  if (reduceQuery && reduceQuery.matches) return;   // reduced-motion: keep the caret, don't auto-retype
  const tags = ['fast, tested, and boringly reliable.', 'green builds, every single time.', 'zero-downtime, even on a Friday.', 'automated from commit to prod.', 'observable, reversible, and calm.', 'shipped in 1.2s, not 12 minutes.'];
  let idx = 0;
  const schedule = () => { hl.__t = setTimeout(cycle, 2400 + Math.random() * 2600); };
  const type = (txt, i) => { hl.textContent = txt.slice(0, i); if (i < txt.length) hl.__t = setTimeout(() => type(txt, i + 1), 44); else schedule(); };
  const cycle = () => { let s = hl.textContent; const del = () => { if (s.length){ s = s.slice(0, -1); hl.textContent = s; hl.__t = setTimeout(del, 24); } else { idx = (idx + 1) % tags.length; type(tags[idx], 1); } }; del(); };
  schedule();
}

/* live interactive layer on the in-page hero shell: cursor spotlight wash, a subtle 3D tilt,
   and an occasional chromatic-aberration glitch on a fast flick. Bails while the shell is docked
   (is-floating) and on touch. */
function setupHeroInteractive(term){
  if (isTouch) return;
  const hero = document.querySelector('.hero');
  if (getComputedStyle(term).position === 'static') term.style.position = 'relative';
  const sp = document.createElement('div');
  sp.style.cssText = 'position:absolute;inset:0;z-index:6;pointer-events:none;opacity:0;transition:opacity .3s;background:radial-gradient(220px 220px at var(--sx,50%) var(--sy,40%),rgba(245,182,66,.13),transparent 70%);';
  term.appendChild(sp);
  term.style.transition = 'transform .25s ease-out, filter .2s';
  term.style.transformStyle = 'preserve-3d';
  let raf = 0, tx = 0, ty = 0;
  const apply = () => {
    raf = 0;
    term.style.transform = 'perspective(900px) rotateY(' + (tx * 5).toFixed(2) + 'deg) rotateX(' + (-ty * 5).toFixed(2) + 'deg)';
  };
  const onMove = (e) => {
    if (term.classList.contains('is-floating')) return;
    const r = term.getBoundingClientRect(); if (!r.width) return;
    tx = (e.clientX - (r.left + r.width / 2)) / r.width;     // -0.5..0.5
    ty = (e.clientY - (r.top + r.height / 2)) / r.height;
    sp.style.setProperty('--sx', ((e.clientX - r.left) / r.width * 100) + '%');
    sp.style.setProperty('--sy', ((e.clientY - r.top) / r.height * 100) + '%');
    sp.style.opacity = '1';
    if (!raf) raf = requestAnimationFrame(apply);
  };
  const reset = () => { sp.style.opacity = '0'; term.style.transform = 'perspective(900px) rotateY(0) rotateX(0)'; };
  (hero || term).addEventListener('pointermove', onMove);
  (hero || term).addEventListener('pointerleave', reset);
}

/* Hero CTAs: "Get in touch" → contact (handled by the anchor handler); "résumé" → scroll to contact, THEN open the PDF. */
function initHeroLinks(){
  const resume = document.getElementById('heroResume');
  if (!resume) return;
  resume.addEventListener('click', (e) => {
    e.preventDefault();
    const open = () => { try { window.open('assets/philip-toulinov-resume.pdf', '_blank', 'noopener'); } catch(_){ location.href = 'assets/philip-toulinov-resume.pdf'; } };
    const t = document.getElementById('contact');
    if (!t){ open(); return; }
    const y = Math.max(0, Math.round(t.getBoundingClientRect().top + window.scrollY - 68));
    if (window.__autoRideSync) window.__autoRideSync(y);
    if (lenis && lenis.scrollTo) lenis.scrollTo(y, { duration: 1.2, force: true, onComplete: () => setTimeout(open, 200) });
    else { try { window.scrollTo({ top: y, behavior: 'smooth' }); } catch(_){ window.scrollTo(0, y); } setTimeout(open, 700); }
  });
}
/* Contact headline — a "compile by sweep" interaction. Move the cursor across the words and they compile
   in CI semantics: pending letters sit dim (source), the cursor is the amber compile head, and the mint
   trail it leaves is "✓ passed", with a live `compiling NN% → ✓ ready to ship` readout. Pointer-only. */
function initContactHeadline(){
  const h = document.getElementById('ctHead');
  if (!h || isTouch || reduceQuery.matches) return;
  const text = h.dataset.text || h.textContent; h.dataset.text = text;
  h.textContent = '';
  h.style.background = 'none'; h.style.webkitBackgroundClip = 'border-box'; h.style.backgroundClip = 'border-box';
  h.style.color = '#f2f2f7'; h.style.webkitTextFillColor = '#f2f2f7'; h.style.animation = 'none';
  const chars = [];
  text.split(' ').forEach((word, wi, arr) => {
    const w = document.createElement('span'); w.style.display = 'inline-block'; w.style.whiteSpace = 'nowrap';
    [...word].forEach((ch) => {
      const s = document.createElement('span'); s.textContent = ch; s.dataset.ch = ch;
      s.style.display = 'inline-block'; s.style.transition = 'color .22s, opacity .22s, transform .22s, text-shadow .22s'; s.style.willChange = 'transform';
      w.appendChild(s); chars.push(s);
    });
    h.appendChild(w);
    if (wi < arr.length - 1){ const sp = document.createElement('span'); sp.textContent = ' '; sp.style.display = 'inline-block'; sp.style.width = '.26em'; h.appendChild(sp); }
  });
  const real = chars.filter((s) => s.dataset.ch.trim());
  const read = document.createElement('div');
  read.setAttribute('aria-hidden', 'true');
  read.style.cssText = "font-family:'Geist Mono',monospace;font-size:12px;letter-spacing:.06em;color:#5ee6c0;margin:10px 0 0;height:1.3em;opacity:0;transition:opacity .3s;";
  h.insertAdjacentElement('afterend', read);
  let raf = 0, cx = -1; const swept = new Set();
  const tick = () => {
    raf = 0;
    chars.forEach((s) => {
      const r = s.getBoundingClientRect(); const mid = r.left + r.width / 2;
      const d = cx >= 0 ? Math.abs(mid - cx) : 1e9;
      if (d < 52){
        swept.add(s);
        s.style.opacity = '1'; s.style.color = '#f5b642'; s.style.textShadow = '0 0 18px rgba(245,182,66,.75)'; s.style.transform = 'translateY(-3px)';
      } else {
        s.style.transform = 'none'; s.style.textShadow = 'none';
        if (swept.has(s)){ s.style.opacity = '1'; s.style.color = '#5ee6c0'; }   // compiled · passed (mint trail)
        else { s.style.opacity = '.30'; s.style.color = '#f2f2f7'; }              // source · pending (dim)
      }
    });
    const pct = Math.round([...swept].filter((s) => s.dataset.ch.trim()).length / Math.max(1, real.length) * 100);
    read.style.opacity = '1';
    read.textContent = pct >= 100 ? '✓ compiled — ready to ship' : '› compiling ' + Math.min(99, Math.max(1, pct)) + '%';
    if (cx >= 0) raf = requestAnimationFrame(tick);
  };
  h.addEventListener('pointermove', (e) => { cx = e.clientX; if (!raf) raf = requestAnimationFrame(tick); });
  h.addEventListener('pointerleave', () => {
    cx = -1; if (raf){ cancelAnimationFrame(raf); raf = 0; }
    swept.clear();
    chars.forEach((s) => { s.style.opacity = '1'; s.style.color = ''; s.style.textShadow = 'none'; s.style.transform = 'none'; });
    read.style.opacity = '0';
  });
}

function initHeroDots(){
  const dots = document.querySelectorAll('#heroTerm .terminal__bar .pre__dot');
  if (!dots.length) return;
  const go = () => scrollToId('#transitMap');
  dots.forEach((d) => {
    d.style.cursor = 'pointer';
    d.setAttribute('role', 'button');
    d.setAttribute('tabindex', '0');
    d.setAttribute('aria-label', 'Jump to Builds');
    d.title = 'Builds';
    d.addEventListener('click', (e) => { e.stopPropagation(); go(); });
    d.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); go(); } });
  });
}

/* =====================  LENIS  ===================== */
function initLenis(){
  if (typeof window.Lenis === 'undefined') return;
  lenis = new Lenis({ lerp: .11, wheelMultiplier: 1, smoothWheel: true, touchMultiplier: 1.4 });   // .11 settles faster — content feels attached to the wheel (premium-tight), not floaty
  window.__lenis = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -68, duration: 1.2 });
    });
  });
}
function scrollToId(id){
  const t = document.querySelector(id); if (!t) return;
  if (lenis) lenis.scrollTo(t, { offset: -68, duration: 1.2 });
  else t.scrollIntoView({ behavior: 'smooth' });
}

/* =====================  IN-VIEW (IntersectionObserver — robust to jumps/deep-links)  ===================== */
function inView(el, cb, opts){
  opts = opts || {};
  if (!('IntersectionObserver' in window)){ cb(); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting){ cb(); if (opts.once !== false) io.unobserve(e.target); } });
  }, { threshold: opts.threshold || 0, rootMargin: opts.rootMargin || '0px 0px -8% 0px' });
  io.observe(el);
}

/* terminal-style decode/scramble reveal for mono section labels */
function scrambleText(el, opts){
  if (el.__decoding) return;                          // ignore re-triggers while a decode is running
  opts = opts || {};
  const final = el.dataset.txt || el.textContent; el.dataset.txt = final;
  const chars = '!<>-_\\/[]{}=+*^?#01abcdef';
  const dur = opts.dur || 26; let frame = 0;
  el.__decoding = true;
  // lock the box width so scrambling proportional text can never reflow its neighbours (no layout shift)
  const w = el.getBoundingClientRect().width; const prevMin = el.style.minWidth;
  if (w) el.style.minWidth = w + 'px';
  const run = () => {
    let out = '';
    for (let i = 0; i < final.length; i++){
      if (i < (frame / dur) * final.length || final[i] === ' ' || final[i] === '—') out += final[i];
      else out += chars[Math.floor(Math.random() * chars.length)];
    }
    el.textContent = out; frame++;
    if (frame <= dur) requestAnimationFrame(run);
    else { el.textContent = final; el.style.minWidth = prevMin; el.__decoding = false; }
  };
  run();
}

/* "DECRYPTED" hover/focus decode on labelled text in every section — reuses scrambleText */
function initDecode(){
  const sel = '.sec__label, .hero__eyebrow, .tool__name, .fx-eb, [data-decode]';
  document.querySelectorAll(sel).forEach((el) => {
    if (!el.textContent.trim() || el.dataset.noDecode != null) return;
    el.classList.add('decodable');
    const fire = () => scrambleText(el, { dur: 16 });
    el.addEventListener('mouseenter', fire);
    el.addEventListener('focus', fire);               // keyboard parity where the element is focusable
  });
}

/* deploy-flow connectors: a thin vertical "----->" rail threading the sections together (the
   pipeline visibly flows DOWN the page). Injected, so no markup churn + the section order is intact. */
function initFlowRails(){
  const stages = [['stack', 'build'], ['about', 'test'], ['contact', 'deploy']];
  stages.forEach(([id, label]) => {
    const sec = document.getElementById(id);
    if (!sec || (sec.previousElementSibling && sec.previousElementSibling.classList.contains('flow-rail'))) return;
    const rail = document.createElement('div');
    rail.className = 'flow-rail'; rail.setAttribute('aria-hidden', 'true');
    rail.innerHTML = `<span class="flow-rail__line"></span><span class="flow-rail__tip">▼ <b>${label}</b></span><span class="flow-rail__line"></span>`;
    sec.parentNode.insertBefore(rail, sec);
  });
}

/* A full, working shell embedded in each major section — CONTEXTUAL, not five identical clones
   (that would read as a template). Each clones the canonical terminal markup with UNIQUE ids,
   gets an aria-labelled input, and inherits the looping + off-screen-pause demo. */
function initSectionShells(){
  if (!document.getElementById('terminal')) return;        // engine present?
  const SHELLS = [
    { sec: 'about', path: '~/about', label: '// the human behind the pipeline — ask away',
      demo: ['whoami', 'cat about.txt', 'bonjour'], chips: ['whoami', 'cat about.txt', 'education', 'bonjour', 'help'] },
    { sec: 'builds', path: '~/builds', label: '// the shipping record — read it as commits',
      demo: ['git log', 'experience', 'kubectl get skills'], chips: ['git log', 'experience', 'git show a1c2d3e', 'top', 'help'] },
    { sec: 'contact', path: '~/contact', label: '// open to the next deploy — reach me here',
      demo: ['hire', 'contact'], chips: ['hire', 'contact', 'cat contact.txt', 'deploy', 'help'] },
  ];
  SHELLS.forEach((s, idx) => {
    const sec = document.getElementById(s.sec);
    if (!sec || sec.querySelector('.terminal--sec')) return;
    const uid = 'sh' + idx + '_' + s.sec;
    const wrap = document.createElement('div');
    wrap.className = 'sec-shell';
    wrap.innerHTML =
      `<p class="sec-shell__label mono">${s.label}</p>` +
      `<div class="terminal terminal--sec" id="${uid}">` +
        `<div class="terminal__bar"><span class="pre__dot"></span><span class="pre__dot"></span><span class="pre__dot"></span>` +
          `<span class="terminal__path mono">philip@toulinov: ${s.path}</span>` +
          `<span class="terminal__hint mono">type <b>help</b> or click ↓</span></div>` +
        `<div class="term-chips mono" id="${uid}_chips">` +
          s.chips.map((c) => `<button type="button" data-cmd="${c}" data-magnetic>${c}</button>`).join('') +
        `</div>` +
        `<div class="terminal__scroll" id="${uid}_scroll">` +
          `<div class="terminal__body mono" id="${uid}_body" role="log" aria-live="off" aria-label="${s.sec} section terminal output"></div>` +
          `<div class="terminal__line mono"><span class="terminal__prompt">philip@toulinov <span class="ok">$</span></span>` +
            `<input class="terminal__input" id="${uid}_input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="${s.sec} section terminal command input" /></div>` +
        `</div>` +
      `</div>`;
    sec.appendChild(wrap);
    if (typeof makeShell === 'function'){
      makeShell({ rootId: uid, bodyId: uid + '_body', inputId: uid + '_input', scrollId: uid + '_scroll', chipsId: uid + '_chips', demo: s.demo, clearAfterDemo: true });
    }
    if (window.__bindCursor) wrap.querySelectorAll('a, button, [data-magnetic]').forEach(window.__bindCursor);
    if (hasGSAP && motionOn){ gsap.set(wrap, { opacity: 0, y: 24 }); inView(wrap, () => gsap.to(wrap, { opacity: 1, y: 0, duration: .85, ease: 'expo.out' })); }
  });
}

/* cursor-tracked "inspection" sheen on the build cards — a soft amber spotlight follows the pointer
   across each card (pure CSS var + a screen-blended ::after; no transform, so no overflow/focus risk) */
function initCardFX(){
  if (isTouch) return;
  document.querySelectorAll('.bd-card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--px', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      card.style.setProperty('--py', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    }, { passive: true });
  });
}

/* In-browser self-validation — the site smoke-tests its own interactive contract and reports it
   through console.log (NEVER console.error, which would trip the headless self-test's error gate).
   tests/run-console-validation.mjs reads these markers + window.__ptValidation, so validation does
   not rely on Playwright DOM queries alone. On-brand for a reliability engineer's portfolio. */
function consoleValidation(){
  const checks = [];
  const ck = (name, cond) => checks.push({ name, pass: !!cond });
  const cf = document.getElementById('codefield');
  const cs = (el, prop) => el ? getComputedStyle(el).getPropertyValue(prop).trim() : '';
  ck('codefield is fixed, full-height', cf && getComputedStyle(cf).position === 'fixed' && Math.abs(cf.offsetHeight - window.innerHeight) < 8);
  ck('hero ASCII banner present', !!document.querySelector('#heroTerm .term-banner'));
  const inputs = document.querySelectorAll('.terminal__input');
  ck('interactive shell input(s) present', inputs.length >= 1);
  ck('every shell input is labelled (a11y)', [...inputs].every(i => i.getAttribute('aria-label') || (i.labels && i.labels.length) || i.getAttribute('aria-labelledby')));
  ck('hover-decode bound on labels (>=3)', document.querySelectorAll('.decodable').length >= 3);
  ck('vertical deploy-flow rails present', document.querySelectorAll('.flow-rail').length >= 1);
  ck('motion is on (never forced off)', !document.body.classList.contains('no-motion'));
  ck('no rogue #motionToggle', !document.getElementById('motionToggle'));
  ck('scroll-throughput var wired', cs(document.documentElement, '--throughput') !== '');
  ck('codefield flashlight active (--mx set)', cs(cf, '--mx') !== '');
  ck('webgl compiler-lens (or graceful CSS fallback)', !!window.__compilerLens ? window.__compilerLens.active || window.__compilerLens.fellBack : true);
  const failed = checks.filter(c => !c.pass);
  console.log(`[PT] interactive self-check — ${checks.length - failed.length}/${checks.length} passed`);
  checks.forEach(c => console.log(`[PT] ${c.pass ? 'PASS' : 'FAIL'} · ${c.name}`));
  window.__ptValidation = { pass: checks.length - failed.length, total: checks.length, checks, ok: failed.length === 0 };
  return window.__ptValidation;
}

/* =====================  SCROLL REVEALS  ===================== */
function initScrollReveals(){
  gsap.utils.toArray('[data-reveal]').filter((el) => !el.closest('.hero') && !el.matches('.sec__title')).forEach((el) => {
    inView(el, () => { gsap.to(el, { opacity: 1, y: 0, duration: .85, ease: 'expo.out' }); if (el.classList.contains('sec__label')) scrambleText(el); });
  });
  gsap.utils.toArray('.contact__big .line').forEach((line) => {
    const w = line.querySelector('[data-word]'); if (!w) return;
    inView(line, () => gsap.fromTo(w, { yPercent: 120 }, { yPercent: 0, duration: 1.05, ease: 'expo.out' }));
  });
}

/* =====================  HEADLINE "COMPILE" REVEAL  =====================
   Each section title builds into place: chars stagger up while the variable Bricolage weight
   ramps thin->bold, like type finishing its build. The locked type system becomes the motion. */
/* =====================  SCROLL-VELOCITY SKEW  =====================
   Award-tier "motion blur" feel: section headings shear with scroll velocity and ease back to rest,
   so the page reads as a pipeline accelerating under load. Peak-velocity model (snap to the fastest
   sample, tween home) so it always relaxes to 0 even after the scroll stops firing onUpdate. Skews
   only a curated set of text headings — never the fixed nav/codefield/cursor/terminal or the live
   Builds iframe grid (transforms on iframe ancestors are settled to 0 at rest, so interaction is clean). */
function initVelocitySkew(){
  try {
    if (!hasGSAP || !motionOn || !window.ScrollTrigger){ window.__velocitySkew = { active:false, fellBack:true }; return; }
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches){ window.__velocitySkew = { active:false, fellBack:true }; return; }  // touch: skip (no real fling velocity, perf)
    const targets = gsap.utils.toArray('#fluxHead, #bdHead, #contact h2, #status h2').filter(Boolean);
    if (!targets.length){ window.__velocitySkew = { active:false, fellBack:true }; return; }
    gsap.set(targets, { transformOrigin: '0% 50%', force3D: true });
    const setter = gsap.quickSetter(targets, 'skewY', 'deg');
    const clamp = gsap.utils.clamp(-6, 6);
    const proxy = { skew: 0 };
    ScrollTrigger.create({
      onUpdate: (self) => {
        if (window.__motionPaused) return;
        const skew = clamp(self.getVelocity() / -320);
        if (Math.abs(skew) > Math.abs(proxy.skew)){
          proxy.skew = skew;
          window.__velocitySkewPeak = skew;                       // exposed for live validation (mid-scroll assertion)
          gsap.to(proxy, { skew: 0, duration: .8, ease: 'power3', overwrite: true, onUpdate: () => setter(proxy.skew) });
        }
      }
    });
    window.__velocitySkew = { active:true, fellBack:false, count: targets.length };
  } catch(e){ window.__velocitySkew = { active:false, fellBack:true }; }   // silent degrade — never trip the console-error gate
}

/* =====================  #6 · CI SECURITY-SCAN BEAM (raw WebGL)  =====================
   A single fragment shader over a #status panel: a soft light beam travels up the frame and develops a
   dot-grid where it passes, fading behind it — "a scan in progress". Section-scoped (one GL context),
   DPR-capped, paused offscreen/hidden, and — like initCompilerLens — every failure path degrades SILENTLY
   to the CSS gradient panel (no console.warn/error) so the zero-console-error gate always holds. */
function initScanPanel(){
  const canvas = document.getElementById('scanCanvas');
  if (!canvas){ window.__scanPanel = { active:false, fellBack:true }; return; }
  try {
    const gl = canvas.getContext('webgl', { alpha:true, antialias:false, premultipliedAlpha:false })
            || canvas.getContext('experimental-webgl');
    if (!gl){ window.__scanPanel = { active:false, fellBack:true }; return; }
    const vsSrc = 'attribute vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }';
    const fsSrc = [
      'precision highp float;',
      'uniform vec2 uRes; uniform float uTime;',
      'float hash(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }',
      'void main(){',
      '  vec2 uv = gl_FragCoord.xy/uRes;',
      '  vec2 g = uv*vec2(uRes.x/uRes.y,1.0);',
      '  vec2 cell = fract(g*24.0)-0.5;',
      '  float grid = smoothstep(0.46,0.5,max(abs(cell.x),abs(cell.y)))*0.05;',  // faint base lattice
      '  float beam = fract(uTime*0.16);',                                        // beam sweeps upward, loops
      '  float d = uv.y - beam;',
      '  float band = exp(-d*d*46.0);',                                           // soft beam core
      '  float lead = smoothstep(0.0,0.18,d)*exp(-d*8.0);',                       // structure develops ahead, fades behind
      '  vec2 dc = fract(g*38.0)-0.5;',
      '  float dots = smoothstep(0.34,0.24,length(dc)) * (0.6+0.4*hash(floor(g*38.0)));',
      '  float reveal = dots*(band*1.25 + lead*0.7);',
      '  vec3 amber = vec3(0.96,0.71,0.26), green = vec3(0.37,0.9,0.75);',
      '  vec3 col = amber*grid;',
      '  col += mix(amber,green,smoothstep(0.0,1.0,uv.y))*reveal;',
      '  col += green*band*0.10;',                                               // beam glow
      '  float a = clamp(max(reveal, grid+band*0.14), 0.0, 1.0);',
      '  gl_FragColor = vec4(col, a);',
      '}'
    ].join('\n');
    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const vs = compile(gl.VERTEX_SHADER, vsSrc), fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs){ window.__scanPanel = { active:false, fellBack:true }; return; }
    const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)){ window.__scanPanel = { active:false, fellBack:true }; return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const pLoc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(pLoc); gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, 'uRes'), uTime = gl.getUniformLocation(prog, 'uTime');
    gl.clearColor(0, 0, 0, 0);
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
    };
    let onScreen = true;
    if ('IntersectionObserver' in window){
      new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; }, { rootMargin: '120px' }).observe(canvas);
    }
    const t0 = performance.now();
    let lastFrame = 0;
    const render = (now) => {
      requestAnimationFrame(render);
      if (!onScreen || document.hidden || window.__motionPaused) return;
      if (now - lastFrame < 33) return;                      // ~30fps cap — plenty for a slow beam, saves battery
      lastFrame = now;
      resize();
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - t0) / 1000);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      window.__scanPanel.frames++;                          // proof-of-life for validation: increments only while actually drawing
    };
    window.__scanPanel = { active:true, fellBack:false, frames:0 };
    requestAnimationFrame(render);
  } catch(e){ window.__scanPanel = { active:false, fellBack:true }; }   // silent — the CSS gradient panel remains
}

function initHeadlineCompile(){
  if (!hasGSAP || reduceQuery.matches) return;
  document.querySelectorAll('.sec__title').forEach((el) => {
    inView(el, () => compileHeadline(el), { once: true, rootMargin: '0px 0px -12% 0px' });
  });
}
function compileHeadline(el){
  if (el.__compiled) return; el.__compiled = true;
  const original = el.textContent;
  el.setAttribute('aria-label', original);                 // screen readers read the whole title, not the char soup
  const frag = document.createDocumentFragment();
  original.split(/(\s+)/).forEach((tok) => {
    if (tok === '' ) return;
    if (/^\s+$/.test(tok)){ frag.appendChild(document.createTextNode(tok)); return; }   // real spaces → wrap points
    const word = document.createElement('span'); word.className = 'cw'; word.setAttribute('aria-hidden', 'true');
    for (const ch of tok){ const c = document.createElement('span'); c.className = 'cc'; c.textContent = ch; word.appendChild(c); }
    frag.appendChild(word);
  });
  el.replaceChildren(frag);
  el.classList.add('is-compiling');
  const chars = el.querySelectorAll('.cc');
  gsap.set(el, { opacity: 1, y: 0, '--wght': 320 });        // parent visible; chars carry the motion (no flash)
  gsap.set(chars, { opacity: 0, yPercent: 42 });
  const tl = gsap.timeline({ onComplete: () => {
    el.textContent = original;                              // revert to clean text — tidy DOM + a11y
    el.classList.remove('is-compiling');
    el.style.removeProperty('--wght');
    el.removeAttribute('aria-label');
  }});
  tl.to(chars, { opacity: 1, yPercent: 0, duration: .5, stagger: { each: .018, from: 'start' }, ease: 'expo.out' }, 0)
    .to(el, { '--wght': 700, duration: .85, ease: 'power2.out' }, 0);
}

/* =====================  SCROLL-THROUGHPUT REACTIVITY  =====================
   Scroll speed reads as deploy throughput: damped scroll velocity -> --throughput (0..1), which
   CSS uses to swell the running monitor-node glow + the banner sweep. Rides the existing ticker. */
function initThroughput(){
  if (!hasGSAP) return;
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;   // touch: skip the per-scroll-frame --throughput write + the glow/banner repaints it drives (desktop-only, like the velocity-skew)
  const root = document.documentElement;
  let last = window.scrollY, val = 0, lastWritten = -1;
  gsap.ticker.add(() => {
    if (window.__motionPaused || document.hidden) return;
    const y = window.scrollY;
    const inst = Math.min(1, Math.abs(y - last) / 90);     // normalized per-frame scroll delta
    last = y;
    val += (inst - val) * (inst > val ? 0.5 : 0.06);       // fast attack, slow decay back to calm
    if (val < 0.001) val = 0;                              // snap to rest so we stop writing when calm
    const out = +val.toFixed(3);
    if (out === lastWritten) return;                       // dirty-check: no write (and no banner/glow repaint) when unchanged
    lastWritten = out;
    window.__throughputVal = out;                          // cheap read for the WebGL lens (avoids getComputedStyle/frame)
    root.style.setProperty('--throughput', out);
  });
}

/* =====================  ABOUT PROFILE — yaml lines reveal line-by-line  ===================== */
function initProfile(){
  const p = document.querySelector('.profile'); if (!p) return;
  if (reduceQuery.matches || !motionOn){ p.classList.add('is-in'); return; }   // honor reduced motion / motion-off
  inView(p, () => p.classList.add('is-in'), { threshold: .18 });
}

/* =====================  PIPELINE DAG + STAGES  ===================== */
const NODE_N = 5;
function nodeCenter(i){ return ((i + 0.5) / NODE_N) * 100; }

function setNodeState(i, state){
  const node = document.querySelector(`.dnode[data-node="${i}"]`);
  if (!node) return;
  node.classList.remove('run', 'pass');
  if (state) node.classList.add(state);
  const st = node.querySelector('.dnode__st');
  if (st) st.textContent = state === 'pass' ? 'passed' : state === 'run' ? 'running' : 'queued';
}
function fillTrackTo(i){
  const fill = document.querySelector('.dag__track > i');
  if (fill) fill.style.width = nodeCenter(i) + '%';
}
function firePacket(from, to){
  const track = document.getElementById('dagTrack');
  if (!track || !hasGSAP) return;
  const p = document.createElement('i');
  p.className = 'dag__packet';
  track.parentElement.appendChild(p);
  gsap.fromTo(p,
    { left: nodeCenter(from) + '%', opacity: 0 },
    { left: nodeCenter(to) + '%', opacity: 1, duration: .55, ease: 'power2.inOut',
      onComplete: () => { gsap.to(p, { opacity: 0, duration: .2, onComplete: () => p.remove() }); } });
}

/* the DAG node animation runs as a deterministic sequence when the strip enters view
   (so the whole pipeline visibly "executes"); the stage cards reveal on their own scroll. */
let dagRan = false;
function runDagSequence(){
  if (dagRan) return; dagRan = true;
  let i = 0;
  const step = () => {
    if (i >= NODE_N) return;
    const idx = i; i++;
    const isMonitor = (idx === NODE_N - 1);
    setNodeState(idx, 'run');
    gsap.delayedCall(.42, () => {
      if (isMonitor){ fillTrackTo(idx); return; }       // monitoring is ongoing — stays running
      setNodeState(idx, 'pass'); fillTrackTo(idx + 1); firePacket(idx, idx + 1);
    });
    gsap.delayedCall(.6, step);
  };
  step();
}

const STAGE_LOGS = [
  ['$ git checkout main', '✓ source resolved'],
  ['$ ./gradlew build', '$ docker build -t app .', '✓ image built'],
  ['$ pytest -q', '$ mabl tests run', '✓ all checks passed'],
  ['$ helm upgrade --install app', '$ kubectl rollout status', '✓ deployed to prod'],
  ['$ watch -n5 /healthz', '● monitoring — on call']
];
function activateCard(i, animate){
  const stage = document.querySelector(`.stage[data-stage="${i}"]`);
  if (!stage) return;
  const chip = stage.querySelector('[data-chip]');
  const points = stage.querySelectorAll('[data-point]');
  const isMonitor = (i === NODE_N - 1);
  stage.classList.add('is-live');
  if (chip && !chip.hasAttribute('data-live')){ chip.textContent = 'running'; chip.classList.remove('pass'); chip.classList.add('live'); }
  if (animate && hasGSAP) gsap.to(points, { opacity: 1, y: 0, duration: .6, stagger: .08, ease: 'expo.out' });   // unified entrance ease (matches every other reveal)
  else points.forEach(p => { p.style.opacity = 1; p.style.transform = 'none'; });

  // build-log micro-stream
  let log = stage.querySelector('.stage__log');
  if (!log){ log = document.createElement('pre'); log.className = 'stage__log'; const card = stage.querySelector('.stage__card'); const art = stage.querySelector('.stage__art'); card.insertBefore(log, art); }
  const lines = STAGE_LOGS[i] || [];
  const cls = (ix) => ix === lines.length - 1 ? (isMonitor ? 'a' : 'g') : 'd';
  if (animate && hasGSAP){
    log.innerHTML = ''; let li = 0;
    const stepLog = () => { if (li >= lines.length) return; log.innerHTML += (li ? '\n' : '') + `<span class="${cls(li)}">${lines[li]}</span>`; li++; gsap.delayedCall(.18, stepLog); };
    stepLog();
  } else { log.innerHTML = lines.map((t, ix) => `<span class="${cls(ix)}">${t}</span>`).join('\n'); }

  const DUR = ['0.3s', '0.5s', '0.8s', '1.1s'];
  const settle = () => {
    if (isMonitor) return;          // "monitoring" card stays live (ongoing)
    stage.classList.remove('is-live'); stage.classList.add('is-pass');
    if (chip){ chip.classList.remove('live'); chip.classList.add('pass'); chip.textContent = 'passed · ' + (DUR[i] || '0.6s'); }
  };
  if (animate && hasGSAP) gsap.delayedCall(.85, settle); else settle();
}

function initPipeline(){
  fillTrackTo(0);
  const dag = document.getElementById('dag');
  if (dag) inView(dag, runDagSequence, { rootMargin: '0px 0px -12% 0px' });
  gsap.utils.toArray('.stage').forEach((stage) => {
    const i = parseInt(stage.dataset.stage, 10);
    inView(stage, () => activateCard(i, true), { rootMargin: '0px 0px -15% 0px' });
  });
}
function initPipelineStatic(){
  for (let i = 0; i < NODE_N; i++){ setNodeState(i, i === NODE_N - 1 ? 'run' : 'pass'); activateCard(i, false); }
  fillTrackTo(NODE_N - 1);
}

/* =====================  COUNTERS  ===================== */
function initCounters(){
  gsap.utils ? gsap.utils.toArray('[data-count]').forEach(setupCounter)
             : document.querySelectorAll('[data-count]').forEach(setupCounter);
  function setupCounter(el){
    const to = parseFloat(el.dataset.to || '0');
    const pre = el.dataset.prefix || '';
    const suf = el.dataset.suffix || '';
    const render = (v) => { el.textContent = pre + Math.round(v) + suf; };
    if (!motionOn || !hasGSAP){ render(to); return; }
    const obj = { v: 0 };
    inView(el, () => gsap.to(obj, { v: to, duration: 1.5, ease: 'power2.out', onUpdate: () => render(obj.v) }));
  }
}

/* =====================  SPARKLINES + GAUGE  ===================== */
function initSparklines(){
  document.querySelectorAll('canvas[data-spark]').forEach((cv) => {
    const dir = cv.dataset.spark;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);   // cap backing-store on hi-DPI displays (less fill-rate, identical geometry)
      const w = cv.clientWidth || 220, h = cv.clientHeight || 48;
      cv.width = w * dpr; cv.height = h * dpr;
      const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
      const pts = 24, data = [];
      let base = dir === 'down' ? 0.85 : 0.25;
      for (let i = 0; i < pts; i++){
        const t = i / (pts - 1);
        const trend = dir === 'down' ? (0.85 - t * 0.6) : (0.25 + t * 0.6);
        const jitter = (Math.sin(i * 1.7) * 0.06) + (Math.sin(i * 0.6) * 0.05);
        data.push(Math.max(0.08, Math.min(0.95, trend + jitter)));
      }
      const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#f5b642';
      const x = (i) => (i / (pts - 1)) * (w - 4) + 2;
      const y = (v) => h - v * (h - 6) - 3;
      // area
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, hexA(accent, .28)); grad.addColorStop(1, hexA(accent, 0));
      ctx.beginPath(); ctx.moveTo(x(0), h);
      data.forEach((v, i) => ctx.lineTo(x(i), y(v)));
      ctx.lineTo(x(pts - 1), h); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
      // line
      ctx.beginPath(); data.forEach((v, i) => i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)));
      ctx.strokeStyle = accent; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke();
      // head dot
      ctx.beginPath(); ctx.arc(x(pts - 1), y(data[pts - 1]), 2.4, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill();
    };
    inView(cv, draw);
    window.addEventListener('resize', debounce(draw, 200));
  });
  // gauge
  document.querySelectorAll('.tile__gauge > i').forEach((g) => {
    inView(g, () => { g.style.transition = 'width 1.4s var(--ease)'; g.style.width = '100%'; });
  });
}
function hexA(hex, a){
  hex = hex.replace('#',''); if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
  const n = parseInt(hex, 16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}
function debounce(fn, ms){ let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

/* =====================  NAV + BUILD BAR  ===================== */
function initNav(){
  const nav = document.getElementById('nav');
  let last = 0;
  const onScroll = (y) => {
    nav.classList.toggle('scrolled', y > 12);
    if (y > last && y > 320) nav.classList.add('hide'); else nav.classList.remove('hide');
    last = y;
  };
  if (lenis && lenis.on) lenis.on('scroll', (e) => onScroll(e.animatedScroll || window.scrollY));
  window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });
  const open = document.getElementById('paletteOpen');
  if (open) open.addEventListener('click', () => togglePalette(true));
  const run = document.getElementById('runDeploy');
  if (run) run.addEventListener('click', () => deployOverlay());
}
function initBuildbar(){
  const bar = document.getElementById('buildbar');
  if (!bar) return;
  const update = () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
  };
  window.addEventListener('scroll', update, { passive: true });
  if (lenis) lenis.on('scroll', update);
  update();
}

/* =====================  CURSOR-LIT CODE FIELD  ===================== */
function initCodeField(){
  const field = document.getElementById('codefield');
  const base = document.getElementById('codeBase');
  const glow = document.getElementById('codeGlow');
  if (!field || !base) return;

  // ONE long, varied, NON-repeating CI/CD sequence — different code in every region of the page.
  const CODE = [
    "# ── .github/workflows/release.yml ──────────",
    "name: release",
    "on:",
    "  push: { branches: [ main ] }",
    "  workflow_dispatch: {}",
    "concurrency: { group: release-${{ github.ref }}, cancel-in-progress: true }",
    "jobs:",
    "  ship:",
    "    runs-on: ubuntu-latest",
    "    permissions: { contents: write, packages: write, id-token: write }",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: actions/setup-java@v4",
    "        with: { distribution: temurin, java-version: '21' }",
    "      - run: ./gradlew build --no-daemon",
    "      - run: pytest -q --maxfail=1",
    "      - run: mabl tests run --application-id $MABL_APP --environment-id prod",
    "      - run: docker build -t ghcr.io/ptoulinov/app:${{ github.sha }} .",
    "      - run: docker push ghcr.io/ptoulinov/app:${{ github.sha }}",
    "      - run: helm upgrade --install app ./chart -n prod --atomic --wait",
    "      - run: kubectl rollout status deploy/app -n prod --timeout=120s",
    "      - if: failure()",
    "        run: kubectl rollout undo deploy/app -n prod",
    "",
    "# ── Jenkinsfile ─────────────────────────────",
    "pipeline {",
    "  agent { kubernetes { yaml libraryResource('pod.yaml') } }",
    "  options { timeout(time: 30, unit: 'MINUTES'); disableConcurrentBuilds() }",
    "  environment { REGISTRY = 'ghcr.io/ptoulinov'; AWS_REGION = 'us-west-2' }",
    "  stages {",
    "    stage('checkout') { steps { checkout scm } }",
    "    stage('build')  { steps { sh './gradlew assemble' } }",
    "    stage('test')   { steps { sh 'pytest -q'; sh 'mabl tests run' } }",
    "    stage('scan')   { steps { sh 'trivy image $REGISTRY/app:$GIT_COMMIT' } }",
    "    stage('deploy') {",
    "      when { branch 'main' }",
    "      steps { sh 'helm upgrade --install app ./chart -n prod --wait' }",
    "    }",
    "  }",
    "  post {",
    "    success { slackSend channel: '#releases', message: \"deployed ${GIT_COMMIT.take(7)} ✓\" }",
    "    failure { slackSend channel: '#releases', color: 'danger', message: 'build failed' }",
    "  }",
    "}",
    "",
    "# ── infra/eks.tf (Terraform) ────────────────",
    'terraform {',
    '  required_version = ">= 1.7"',
    '  backend "s3" { bucket = "ptoulinov-tfstate"; key = "prod/eks"; region = "us-west-2" }',
    '}',
    'module "eks" {',
    '  source          = "terraform-aws-modules/eks/aws"',
    '  cluster_name    = "release-prod"',
    '  cluster_version = "1.29"',
    '  vpc_id          = module.vpc.vpc_id',
    '  eks_managed_node_groups = {',
    '    default = { instance_types = ["m6i.large"], min_size = 2, max_size = 6, desired_size = 3 }',
    '  }',
    '}',
    'resource "aws_ecr_repository" "app" {',
    '  name                 = "ptoulinov/app"',
    '  image_scanning_configuration { scan_on_push = true }',
    '}',
    "",
    "# ── Dockerfile ──────────────────────────────",
    "FROM python:3.12-slim AS base",
    "WORKDIR /app",
    "COPY requirements.txt .",
    "RUN pip install --no-cache-dir -r requirements.txt",
    "COPY . .",
    "EXPOSE 8000",
    "HEALTHCHECK CMD curl -f http://localhost:8000/healthz || exit 1",
    'CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:8000", "app:server"]',
    "",
    "# ── k8s/deployment.yaml ─────────────────────",
    "apiVersion: apps/v1",
    "kind: Deployment",
    "metadata: { name: app, namespace: prod, labels: { app: app } }",
    "spec:",
    "  replicas: 3",
    "  strategy: { type: RollingUpdate, rollingUpdate: { maxSurge: 1, maxUnavailable: 0 } }",
    "  selector: { matchLabels: { app: app } }",
    "  template:",
    "    spec:",
    "      containers:",
    "        - name: app",
    "          image: ghcr.io/ptoulinov/app:latest",
    "          ports: [ { containerPort: 8000 } ]",
    "          readinessProbe: { httpGet: { path: /healthz, port: 8000 } }",
    "          resources: { requests: { cpu: 250m, memory: 256Mi } }",
    "---",
    "apiVersion: autoscaling/v2",
    "kind: HorizontalPodAutoscaler",
    "metadata: { name: app, namespace: prod }",
    "spec: { minReplicas: 3, maxReplicas: 12, metrics: [ { type: Resource, resource: { name: cpu, target: { averageUtilization: 70 } } } ] }",
    "",
    "# ── .gitlab-ci.yml ──────────────────────────",
    "stages: [ build, test, deploy ]",
    "deploy:prod:",
    "  stage: deploy",
    "  image: hashicorp/terraform:1.7",
    "  script:",
    "    - terraform init -input=false",
    "    - terraform apply -auto-approve",
    "  environment: { name: production, url: https://app.prod }",
    "  rules: [ { if: '$CI_COMMIT_BRANCH == \"main\"' } ]",
    "",
    "# ── monitoring/alerts.yml (Prometheus) ──────",
    "groups:",
    "  - name: slo",
    "    rules:",
    "      - alert: HighErrorRate",
    "        expr: sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m])) > 0.02",
    "        for: 5m",
    "        labels: { severity: page }",
    "        annotations: { summary: \"error budget burning\" }",
    "",
    "# ── deploy.sh ───────────────────────────────",
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "git tag -a \"v$(date +%Y.%m.%d)\" -m 'release'",
    "git push --tags",
    "gh release create \"v$(date +%Y.%m.%d)\" --generate-notes",
    "echo 'remote: checks passed — deployed in 1.2s'",
    ""
  ].join("\n");

  // fill the field by repeating the sequence — but VARY tokens each pass (service, region,
  // version, cluster) so no two blocks are identical (no tiled "wall of the same block").
  const SVC = ['app','api','worker','gateway','scheduler','ingestor','billing','notifier','indexer','router'];
  const REG = ['us-west-2','us-east-1','eu-west-1','ap-south-1','eu-central-1'];
  let txt = "";
  for (let n = 0; txt.length < 30000; n++){
    const svc = SVC[n % SVC.length], reg = REG[n % REG.length];
    txt += CODE
      .replaceAll('app', svc)
      .replaceAll('us-west-2', reg)
      .replaceAll('1.29', '1.' + (27 + (n % 5)))
      .replaceAll('release-prod', 'release-' + svc)
      .replaceAll('replicas: 3', 'replicas: ' + (2 + (n % 4)))
      + "\n\n";
  }
  base.textContent = txt;
  if (glow) glow.textContent = txt;

  // the field is position:fixed at 100dvh (see .codefield in main.css), so it can never
  // inflate the document height or spill below the footer — robust against resize/zoom.

  // flashlight: mask in VIEWPORT coords (the field is fixed). Desktop tracks the cursor; touch has no
  // cursor so it runs the autonomous scroll-sweep + idle-orbit (capped ~30fps, no WebGL lens — keeps it moving on phones).
  if (reduceQuery.matches || (navigator.connection && navigator.connection.saveData)){
    field.style.setProperty('--mx', '76%'); field.style.setProperty('--my', '260px'); return;   // static for reduced-motion + data-saver only
  }
  const mob = isTouch;
  const cfGlow = document.getElementById('cfGlow');   // mobile: a composited blob moved via translate3d (no --mx/--my repaint)
  const targ = { x: window.innerWidth * .7, y: window.innerHeight * .32 };
  const cur = { x: targ.x, y: targ.y };
  let t = 0, lastActive = -1e9, lastScroll = -1e9;   // start idle-drifting immediately on load
  let lastX = NaN, lastY = NaN;             // last values written to --mx/--my (dirty-check)
  const IDLE_MS = 2000;                      // resume the autonomous orbit 2s after the last mouse move
  const bump = () => { lastActive = performance.now(); };
  if (!mob) window.addEventListener('mousemove', (e) => { targ.x = e.clientX; targ.y = e.clientY; bump(); }, { passive: true });
  window.addEventListener('scroll', () => { lastScroll = performance.now(); }, { passive: true });   // scrolling DRIVES the light (below)
  let lastFrame = 0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (window.__motionPaused || document.hidden) return;   // pause only when the tab is backgrounded (battery/CPU); never "off"
    if (mob && now - lastFrame < 32) return;   // ~30fps on phones — halve the mask repaints
    // MOBILE SMOOTHNESS: don't composite the glow WHILE the user is actively scrolling — the per-frame
    // layer composite was ~halving the scroll framerate (measured). Nobody watches the background mid-scroll;
    // the orbit resumes ~140ms after they stop. (Frozen `t` means it resumes from the same phase — no jump.)
    if (mob && (now - lastScroll) < 140) return;
    lastFrame = now;
    t += mob ? .03 : .024;                   // larger step on mobile keeps the orbit speed at the 30fps cap
    const mouseActive = (now - lastActive) < IDLE_MS;                  // following the cursor (now = rAF timestamp, same timebase as performance.now())
    const scrollActive = !mouseActive && (now - lastScroll) < 700;     // scrolling → sweep the light so it highlights code as you scroll
    if (scrollActive){                       // tie the flashlight to the scroll position so it visibly travels through the code while scrolling
      const sy = window.scrollY || window.pageYOffset || 0;
      targ.x = window.innerWidth * (.5 + .40 * Math.cos(sy * .0012));
      targ.y = window.innerHeight * (.5 + .34 * Math.sin(sy * .0019));
    } else if (!mouseActive){                // fully idle → autonomous orbit
      targ.x = window.innerWidth * (.5 + .34 * Math.cos(t * .27));
      targ.y = window.innerHeight * (.44 + .30 * Math.sin(t * .35));
    }
    const ease = mouseActive ? .14 : .075;   // snappy when following the cursor; smooth for the scroll-sweep / orbit
    cur.x += (targ.x - cur.x) * ease; cur.y += (targ.y - cur.y) * ease;
    const nx = +cur.x.toFixed(1), ny = +cur.y.toFixed(1);   // viewport coords — field is position:fixed
    // dirty-check: skip the write (and the repaint it triggers) only when truly converged & still.
    if (nx === lastX && ny === lastY) return;
    lastX = nx; lastY = ny;
    if (mob && cfGlow){                       // mobile: GPU-composited transform — no full-screen repaint
      cfGlow.style.transform = 'translate3d(' + nx + 'px,' + ny + 'px,0)';
    } else {                                  // desktop: the --mx/--my mask + WebGL lens (unchanged)
      field.style.setProperty('--mx', nx + 'px');
      field.style.setProperty('--my', ny + 'px');
    }
  };
  requestAnimationFrame(loop);
  if (!mob) initCompilerLens(field, txt);   // desktop only — the per-frame WebGL lens janks mobile scrolling; touch keeps the CSS flashlight
}

/* =====================  WEBGL "COMPILER LENS"  =====================
   A real GPU phosphor/CRT pass over the codefield: faint amber code everywhere + a brighter
   cursor-lit reveal with chromatic-aberration that shears with scroll velocity. It reads the SAME
   --mx/--my the CSS flashlight already drives (one mouse source) and --throughputVal for shear.
   EVERY failure path degrades SILENTLY to the CSS flashlight (no console.warn/error) so the
   zero-console-error self-test gate holds even where WebGL is absent or SwiftShader-only. */
function initCompilerLens(field, codeText){
  window.__compilerLens = { active: false, fellBack: false };
  if (isTouch) { window.__compilerLens.fellBack = true; return false; }   // pointer-driven; skip touch
  try {
    const canvas = document.createElement('canvas');
    canvas.id = 'codeGL'; canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) { window.__compilerLens.fellBack = true; return false; }
    // Skip the GPU lens on SOFTWARE renderers (SwiftShader / llvmpipe / Basic Render): there a
    // per-frame fullscreen shader is slow enough to jank scrolling — the CSS flashlight is the
    // better experience. (This also keeps CI/Playwright, which uses SwiftShader, on the stable path.)
    try {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const rend = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
      if (/swiftshader|llvmpipe|software|basic render|paravirtual/i.test(rend) && !window.__PT_FORCE_LENS) { window.__compilerLens.fellBack = true; return false; }
    } catch (_) {}

    const vsSrc = 'attribute vec2 p; varying vec2 uv; void main(){ uv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }';
    const fsSrc = [
      'precision mediump float;',
      'varying vec2 uv; uniform sampler2D uTex; uniform vec2 uRes; uniform vec2 uMouse; uniform float uTime; uniform float uVel;',
      'float lum(vec2 c){ return texture2D(uTex, c).r; }',
      'void main(){',
      '  vec2 d = uv - uMouse; d.x *= uRes.x / uRes.y;',
      '  float dist = length(d);',
      '  float light = smoothstep(0.34, 0.0, dist);',                 // cursor flashlight falloff
      '  float ab = (0.0011 + uVel * 0.006) * smoothstep(0.0, 0.45, dist);',  // aberration grows with scroll velocity, toward the rim
      '  vec2 dir = normalize(d + 1e-4);',
      '  float r = lum(uv + dir*ab); float g = lum(uv); float b = lum(uv - dir*ab);',
      '  float intensity = 0.05 + light * 0.62;',                     // faint ambient everywhere + reveal (eased back a touch so copy on top stays readable)
      '  float scan = 0.92 + 0.08 * sin(uv.y * 760.0 + uTime * 1.4);',// subtle CRT scanline
      '  vec3 col = vec3(r * 1.0, g * 0.74, b * 0.34) * intensity * scan;',   // amber-weighted channels = phosphor fringe
      '  gl_FragColor = vec4(col, g * intensity * scan);',
      '}'
    ].join('\n');

    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const vs = compile(gl.VERTEX_SHADER, vsSrc), fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) { window.__compilerLens.fellBack = true; return false; }
    const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { window.__compilerLens.fellBack = true; return false; }
    gl.useProgram(prog);

    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const pLoc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(pLoc); gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);
    const uTex = gl.getUniformLocation(prog, 'uTex'), uRes = gl.getUniformLocation(prog, 'uRes'),
          uMouse = gl.getUniformLocation(prog, 'uMouse'), uTime = gl.getUniformLocation(prog, 'uTime'), uVel = gl.getUniformLocation(prog, 'uVel');

    const tex = gl.createTexture();
    const off = document.createElement('canvas'); const octx = off.getContext('2d');
    let DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const bake = () => {
      const w = off.width, h = off.height;
      octx.clearRect(0, 0, w, h); octx.fillStyle = '#fff';
      const fz = 12.5 * DPR, lh = fz * 1.7, colW = 340 * DPR, gap = 48 * DPR, padX = 24 * DPR, padY = 60 * DPR;
      octx.font = fz + 'px "JetBrains Mono", ui-monospace, monospace'; octx.textBaseline = 'top';
      // fillText does NOT wrap — pre-wrap every line to the column width so long lines can't bleed
      // across the gap and overlap the next column (monospace → wrap by char count is exact + fast).
      const charW = octx.measureText('M').width || (fz * 0.6);
      const maxChars = Math.max(10, Math.floor((colW - 10 * DPR) / charW));
      const rawLines = codeText.split('\n'); const lines = [];
      for (const ln of rawLines) {
        if (ln.length <= maxChars) { lines.push(ln); continue; }
        let s = ln;
        while (s.length > maxChars) { let cut = s.lastIndexOf(' ', maxChars); if (cut < maxChars * 0.55) cut = maxChars; lines.push(s.slice(0, cut)); s = s.slice(cut).replace(/^\s+/, ''); }
        lines.push(s);
      }
      let x = padX, li = 0;
      while (x < w) { let y = padY; for (; li < lines.length && y < h; li++, y += lh) octx.fillText(lines[li], x, y); if (li >= lines.length) li = 0; x += colW + gap; }
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);   // canvas origin is top-left, WebGL's is bottom-left — flip or the code renders mirrored/upside-down
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    const resize = () => {
      DPR = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = off.width = Math.floor(window.innerWidth * DPR);
      canvas.height = off.height = Math.floor(window.innerHeight * DPR);
      canvas.style.width = window.innerWidth + 'px'; canvas.style.height = window.innerHeight + 'px';
      gl.viewport(0, 0, canvas.width, canvas.height); bake();
    };

    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;';
    field.parentNode.insertBefore(canvas, field.nextSibling);
    resize();
    gl.clearColor(0, 0, 0, 0); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(uTex, 0);

    // GL owns the reveal now — hide the CSS lit/base layers (their TEXT stays in the DOM for the self-test)
    const cg = document.getElementById('codeGlow'); if (cg) cg.style.opacity = '0';
    const cb = document.getElementById('codeBase'); if (cb) cb.style.opacity = '0';
    // …and kill the .codefield --mx-driven radial BACKGROUND: with codeGlow hidden the lens is the only
    // visible reveal, so that gradient now repaints the full fixed viewport every frame for nothing.
    // Removing it means the per-frame --mx write (still read by the lens uniform) drives ZERO paint.
    field.style.background = 'none';

    let mx = window.innerWidth * 0.7, my = window.innerHeight * 0.32, t0 = performance.now(), paused = false, inView = true;
    const rv = (name, fb) => { const v = parseFloat(field.style.getPropertyValue(name)); return isNaN(v) ? fb : v; };
    const render = () => {
      if (paused || document.hidden || !inView) return;   // also idle the GPU when the field is scrolled off-screen
      try {
        mx = rv('--mx', mx); my = rv('--my', my);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform2f(uMouse, mx / window.innerWidth, 1.0 - my / window.innerHeight);
        gl.uniform1f(uTime, (performance.now() - t0) / 1000);
        gl.uniform1f(uVel, Math.min(1, window.__throughputVal || 0));
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      } catch (_) { paused = true; }   // never throw out of the frame loop (would trip the console-error gate)
    };
    // Drive the lens from its OWN rAF, NOT gsap.ticker — the ticker also runs lenis.raf(), and adding
    // per-frame GPU work ahead of it jitters Lenis's scrollTo (it was destabilizing the dock's exact
    // scroll-restore). This is not the forbidden double-rAF: that rule is only about driving lenis twice.
    let rafId = 0;
    const loop = () => { render(); rafId = (paused || document.hidden || !inView) ? 0 : requestAnimationFrame(loop); };
    const kick = () => { if (!rafId && !paused && !document.hidden && inView) rafId = requestAnimationFrame(loop); };
    kick();
    // pause the field's GPU work — and stop the rAF heartbeat entirely — while the field is off-screen (battery/CPU)
    try { new IntersectionObserver((es) => { inView = es[0].isIntersecting; kick(); }, { rootMargin: '160px' }).observe(canvas); } catch (_) {}
    document.addEventListener('visibilitychange', kick);
    window.addEventListener('resize', debounce(() => { try { resize(); } catch (_) {} }, 200));
    document.addEventListener('visibilitychange', () => { paused = document.hidden; });
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); paused = true; }, false);
    canvas.addEventListener('webglcontextrestored', () => { try { resize(); paused = false; } catch (_) {} }, false);

    window.__compilerLens = { active: true, fellBack: false };
    return true;
  } catch (e) {
    window.__compilerLens = { active: false, fellBack: true };   // silent: the CSS flashlight remains
    return false;
  }
}

/* =====================  CURSOR + MAGNETIC  ===================== */
function initCursor(){
  const cur = document.getElementById('cursor');
  if (!cur || !hasGSAP) return;
  const dot = cur.querySelector('.cursor__dot');
  const ring = cur.querySelector('.cursor__ring');
  const label = cur.querySelector('.cursor__label');
  const dx = gsap.quickTo(dot,'x',{duration:.12,ease:'power3'}), dy = gsap.quickTo(dot,'y',{duration:.12,ease:'power3'});
  const rx = gsap.quickTo(ring,'x',{duration:.4,ease:'power3'}),  ry = gsap.quickTo(ring,'y',{duration:.4,ease:'power3'});
  const lx = gsap.quickTo(label,'x',{duration:.4,ease:'power3'}), ly = gsap.quickTo(label,'y',{duration:.4,ease:'power3'});
  // velocity skew: the ring stretches along its travel direction on fast moves, relaxing to a circle at rest
  const rsx = gsap.quickTo(ring,'scaleX',{duration:.3,ease:'power3'}), rsy = gsap.quickTo(ring,'scaleY',{duration:.3,ease:'power3'});
  const rrot = gsap.quickTo(ring,'rotation',{duration:.25,ease:'power3'});
  let px = 0, py = 0, pt = 0, relax;
  window.addEventListener('mousemove', (e) => {
    dx(e.clientX);dy(e.clientY);rx(e.clientX);ry(e.clientY);lx(e.clientX);ly(e.clientY);
    const now = performance.now();
    if (pt){
      const dt = Math.max(1, now - pt);
      const ddx = e.clientX - px, ddy = e.clientY - py;
      const speed = Math.min(1, Math.hypot(ddx, ddy) / dt / 2.2);
      rrot(Math.atan2(ddy, ddx) * 180 / Math.PI);
      rsx(1 + speed * 0.55); rsy(1 - speed * 0.32);
      clearTimeout(relax); relax = setTimeout(() => { rsx(1); rsy(1); }, 90);
    }
    px = e.clientX; py = e.clientY; pt = now;
  });

  const bind = (el) => {
    const t = el.getAttribute('data-cursor');
    el.addEventListener('mouseenter', () => { document.body.classList.add('cursor-hover'); if (t){ document.body.classList.add('cursor-label'); label.textContent = t; } });
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover','cursor-label'));
  };
  document.querySelectorAll('a, button, [data-magnetic]').forEach(bind);
  window.__bindCursor = bind;

  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const mx = gsap.quickTo(el,'x',{duration:.4,ease:'power3'}), my = gsap.quickTo(el,'y',{duration:.4,ease:'power3'});
    el.addEventListener('mousemove', (e) => { const r = el.getBoundingClientRect(); mx((e.clientX-(r.left+r.width/2))*.3); my((e.clientY-(r.top+r.height/2))*.3); });
    el.addEventListener('mouseleave', () => { mx(0); my(0); });
  });

  const email = document.querySelector('a[href^="mailto:"]');
  if (email) email.addEventListener('click', () => {
    if (navigator.clipboard){ navigator.clipboard.writeText('toulinov.philip@yahoo.com').catch(()=>{}); if (label) label.textContent = 'copied'; setTimeout(()=>{ if (label && document.body.classList.contains('cursor-label')) label.textContent='copy'; },1100); }
  });
}

/* =====================  ENV THEME SWITCH (+ View-Transition clip-path bloom)  ===================== */
let currentEnv = 'production';
const ENV_LABEL = { production: 'prod', staging: 'staging', dev: 'dev' };
function updateEnvChip(env){ const l = document.getElementById('envLabel'); if (l) l.textContent = ENV_LABEL[env] || 'prod'; }
function applyEnv(env){ document.body.dataset.env = env === 'production' ? '' : env; currentEnv = env; updateEnvChip(env); try { localStorage.setItem('pt_env', env); } catch(e){} }
function setEnv(env, origin){
  if (!['production','staging','dev'].includes(env)) env = 'production';
  const canVT = document.startViewTransition && motionOn && !reduceQuery.matches;
  if (!canVT){ applyEnv(env); return; }
  const ox = origin ? origin.x : window.innerWidth / 2, oy = origin ? origin.y : 72;
  try {
    const t = document.startViewTransition(() => applyEnv(env));
    t.ready.then(() => {
      const maxR = Math.hypot(Math.max(ox, window.innerWidth - ox), Math.max(oy, window.innerHeight - oy));
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${ox}px ${oy}px)`, `circle(${maxR}px at ${ox}px ${oy}px)`] },
        { duration: 620, easing: 'cubic-bezier(.16,1,.3,1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
  } catch(e){ applyEnv(env); }
}
function initEnvFromStorage(){
  let env = 'production';
  try { env = localStorage.getItem('pt_env') || 'production'; } catch(e){}
  if (!['production','staging','dev'].includes(env)) env = 'production';
  applyEnv(env);   // no bloom on initial load
}
function initEnvChip(){
  const chip = document.getElementById('envChip'); if (!chip) return;
  updateEnvChip(currentEnv);
  chip.addEventListener('click', () => {
    const order = ['production', 'staging', 'dev'];
    const next = order[(order.indexOf(currentEnv) + 1) % order.length];
    const r = chip.getBoundingClientRect();
    setEnv(next, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    toast('env → ' + next);
  });
}

/* =====================  COPY-TO-CLIPBOARD (optimistic morph + aria-live)  ===================== */
function srAnnounce(msg){ const el = document.getElementById('srLive'); if (el){ el.textContent = ''; setTimeout(() => { el.textContent = msg; }, 30); } }
function initCopy(){
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    const original = btn.textContent;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const txt = btn.getAttribute('data-copy');
      // optimistic: morph immediately, then write to clipboard in the background
      btn.classList.add('done'); btn.textContent = '✓ copied'; srAnnounce('Copied ' + txt + ' to clipboard'); blip(880, .05, 'triangle', .03);
      setTimeout(() => { btn.classList.remove('done'); btn.textContent = original; }, 1500);
      try { if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(() => {}); } catch(err){}
    });
  });
}

/* =====================  SOUND (off by default)  ===================== */
let soundOn = false, audioCtx = null;
function ensureAudio(){ if (!audioCtx){ try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} } return audioCtx; }
function blip(freq, dur, type, gain){
  if (!soundOn) return; const ctx = ensureAudio(); if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || 'sine'; o.frequency.value = freq;
  g.gain.value = gain || .04; o.connect(g); g.connect(ctx.destination);
  const t = ctx.currentTime; o.start(t);
  g.gain.exponentialRampToValueAtTime(.0001, t + (dur || .08)); o.stop(t + (dur || .08) + .02);
}
function chime(){ if (!soundOn) return; [523,659,784,1046].forEach((f,i)=>setTimeout(()=>blip(f,.18,'sine',.05),i*70)); }
function toggleSound(on){ soundOn = (on === undefined) ? !soundOn : on; if (soundOn){ ensureAudio(); blip(880,.06,'triangle',.04); } }

/* =====================  DEPLOY OVERLAY (./deploy --prod)  ===================== */
function deployOverlay(){
  if (document.getElementById('deployOv')) return;
  const ov = document.createElement('div'); ov.id = 'deployOv';
  ov.setAttribute('style','position:fixed;inset:0;z-index:9600;display:grid;place-items:center;background:rgba(8,8,11,.72);backdrop-filter:blur(8px)');
  ov.innerHTML = `<div class="pre__inner" style="width:min(560px,90vw)">
    <div class="pre__bar"><span class="pre__dot"></span><span class="pre__dot"></span><span class="pre__dot"></span><span class="pre__path">philip@portfolio: ~/deploy --env production</span></div>
    <pre class="pre__log" id="dov"></pre><div class="pre__progress"><i id="dovp"></i></div></div>`;
  document.body.appendChild(ov);
  const log = ov.querySelector('#dov'), pp = ov.querySelector('#dovp');
  const lines = [
    '<span class="d">$</span> ./deploy <span class="a">--env</span> production',
    '  ↳ lint ......................... <span class="g">ok</span>',
    '  ↳ test (pytest, mabl) .......... <span class="g">passed</span>',
    '  ↳ build image .................. <span class="g">ok</span>',
    '  ↳ push ghcr.io/ptoulinov ....... <span class="g">ok</span>',
    '  ↳ rollout deploy/portfolio ..... <span class="g">healthy</span>',
    '<span class="g">✓</span> deployed to production in 1.2s — <span class="a">have a look around.</span>'
  ];
  let i = 0;
  const step = () => {
    if (i < lines.length){ log.innerHTML = lines.slice(0,i+1).join('\n'); pp.style.width = Math.round(((i+1)/lines.length)*100)+'%'; blip(420+i*40,.05,'square',.03); i++; setTimeout(step, i===1?260:190); }
    else { chime(); setTimeout(() => { ov.style.transition='opacity .5s'; ov.style.opacity='0'; setTimeout(()=>ov.remove(),520); }, 900); }
  };
  const close = (e) => { if (e.target === ov){ ov.remove(); } };
  ov.addEventListener('click', close);
  setTimeout(step, 260);
}

/* =====================  COMMAND PALETTE (⌘K)  ===================== */
let paletteItems = [], paletteSel = 0;
function buildPaletteItems(){
  return [
    { ico:'→', t:'Go to Pipeline', d:'01', run:() => scrollToId('#work') },
    { ico:'→', t:'Go to Builds', d:'02', run:() => scrollToId('#transitMap') },
    { ico:'→', t:'Go to Contact', d:'03', run:() => scrollToId('#contact') },
    { ico:'⌘', t:'Run ./deploy --prod', d:'demo', run:() => deployOverlay() },
    { ico:'@', t:'Copy email address', d:'copy', run:() => { if (navigator.clipboard){ navigator.clipboard.writeText('toulinov.philip@yahoo.com').then(()=>toast('email copied')).catch(()=>toast('email: toulinov.philip@yahoo.com')); } else { toast('email: toulinov.philip@yahoo.com'); } } },
    { ico:'↗', t:'Open LinkedIn', d:'in/ptoulinov', run:() => window.open('https://www.linkedin.com/in/ptoulinov','_blank','noopener') },
    { ico:'⬇', t:'Download résumé (PDF)', d:'pdf', run:() => window.open('assets/philip-toulinov-resume.pdf','_blank') },
    { ico:'☎', t:'Call +1 (415) 823-7537', d:'tel', run:() => { location.href = 'tel:+14158237537'; } },
    { ico:'◆', t:'Env: production (amber)', d:'theme', run:() => setEnv('production') },
    { ico:'◆', t:'Env: staging (cyan)', d:'theme', run:() => setEnv('staging') },
    { ico:'◆', t:'Env: dev (magenta)', d:'theme', run:() => setEnv('dev') },
    { ico:'♪', t:'Toggle sound', d:'audio', run:() => { toggleSound(); toast('sound ' + (soundOn?'on':'off')); } },
    { ico:'?', t:'Keyboard shortcuts', d:'keys', run:() => toggleSheet() },
  ];
}
function initPalette(){
  const pal = document.getElementById('palette');
  const input = document.getElementById('paletteInput');
  const list = document.getElementById('paletteList');
  const scrim = document.getElementById('paletteScrim');
  if (!pal || !input || !list) return;
  paletteItems = buildPaletteItems();

  const render = (q) => {
    const f = filterItems(paletteItems, q);
    paletteSel = 0;
    list.innerHTML = f.length ? f.map((it, i) =>
      `<li class="palette__item${i===0?' sel':''}" role="option" data-i="${i}"><span class="pi__ico">${it.ico}</span><span class="pi__t">${it.t}</span><span class="pi__d">${it.d}</span></li>`
    ).join('') : `<li class="palette__empty">no matches for "${escapeHtml(q)}"</li>`;
    list._f = f;
    list.querySelectorAll('.palette__item').forEach((li) => {
      li.addEventListener('mousemove', () => selectItem(parseInt(li.dataset.i,10)));
      li.addEventListener('click', () => execItem(parseInt(li.dataset.i,10)));
    });
  };
  const selectItem = (i) => { paletteSel = i; list.querySelectorAll('.palette__item').forEach((li,j)=>li.classList.toggle('sel', j===i)); };
  const execItem = (i) => { const f = list._f || []; if (f[i]){ togglePalette(false); setTimeout(()=>f[i].run(), 60); } };
  window.__execPaletteSel = () => execItem(paletteSel);
  window.__renderPalette = render;

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', (e) => {
    const f = list._f || [];
    if (e.key === 'ArrowDown'){ e.preventDefault(); selectItem(Math.min(paletteSel+1, f.length-1)); ensureVisible(list); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); selectItem(Math.max(paletteSel-1, 0)); ensureVisible(list); }
    else if (e.key === 'Enter'){ e.preventDefault(); execItem(paletteSel); }
    else if (e.key === 'Escape'){ togglePalette(false); }
    else if (e.key === 'Tab'){ e.preventDefault(); }   // aria-modal dialog: input is the only focusable control — keep Tab inside
  });
  scrim?.addEventListener('click', () => togglePalette(false));

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); togglePalette(); }
    else if (e.key === 'Escape' && document.getElementById('palette').classList.contains('open')){ togglePalette(false); }
  });
  render('');
}
function ensureVisible(list){ const sel = list.querySelector('.palette__item.sel'); sel?.scrollIntoView({ block:'nearest' }); }
function togglePalette(force){
  const pal = document.getElementById('palette'); const input = document.getElementById('paletteInput');
  const open = (force === undefined) ? !pal.classList.contains('open') : force;
  if (open && !pal.classList.contains('open')) window.__paletteReturnFocus = document.activeElement;   // remember opener
  pal.classList.toggle('open', open); pal.setAttribute('aria-hidden', String(!open));
  if (open){ input.value=''; window.__renderPalette && window.__renderPalette(''); setTimeout(()=>input.focus(),30); if (lenis) lenis.stop(); blip(660,.05,'triangle',.03); }
  else { if (lenis) lenis.start(); const r = window.__paletteReturnFocus; if (r && r.focus){ try { r.focus(); } catch(e){} } }   // restore focus to the trigger
}
/* first-visit coach-mark: on touch / narrow screens the palette IS the nav, but the bare ⌘K
   glyph gives no hint of that. Point at the "Menu" button once, then never again (localStorage). */
function initNavHint(){
  const btn = document.getElementById('paletteOpen');
  if (!btn) return;
  const onTouch = isTouch || window.matchMedia('(max-width: 760px)').matches;
  if (!onTouch) return;
  try { if (localStorage.getItem('pt_navhint') === 'seen') return; } catch(e){}
  const mark = () => { try { localStorage.setItem('pt_navhint', 'seen'); } catch(e){} };

  const hint = document.createElement('div');
  hint.className = 'navhint mono';
  hint.setAttribute('role', 'status');
  hint.innerHTML = `<span class="navhint__arrow" aria-hidden="true"></span><b>☰ Menu</b> — tap to navigate &amp; search the site.`;
  document.body.appendChild(hint);

  const place = () => {
    const r = btn.getBoundingClientRect();
    const w = hint.offsetWidth || 240;
    let left = Math.max(8, Math.min(Math.round(r.right - w), window.innerWidth - w - 8));
    hint.style.top = Math.round(r.bottom + 10) + 'px';
    hint.style.left = left + 'px';
    const arrow = hint.querySelector('.navhint__arrow');
    if (arrow) arrow.style.left = Math.max(8, Math.round(r.left + r.width / 2 - left - 5)) + 'px';
  };

  let done = false;
  const dismiss = () => {
    if (done) return; done = true;
    mark();
    hint.classList.remove('is-in');
    document.removeEventListener('click', onDocClick, true);
    setTimeout(() => hint.remove(), 420);
  };
  const onDocClick = () => dismiss();

  // the nav (and so the button) is position:fixed, so the hint tracks it through scroll —
  // dismiss only on an explicit interaction or after a timeout, never on scroll/settle.
  let shown = false;
  const show = () => {
    if (shown || done) return; shown = true;
    place();
    requestAnimationFrame(() => { hint.classList.add('is-in'); if (!reduceQuery.matches) hint.classList.add('navhint__pulse'); });
    setTimeout(() => { document.addEventListener('click', onDocClick, true); }, 400);
    setTimeout(dismiss, 8000);
  };
  hint.addEventListener('click', () => { dismiss(); togglePalette(true); });
  setTimeout(show, 1500);   // let the preloader clear first
}
function filterItems(items, q){
  q = (q||'').trim().toLowerCase(); if (!q) return items;
  return items.filter(it => fuzzy(q, (it.t + ' ' + it.d).toLowerCase()))
    .sort((a,b) => (a.t.toLowerCase().indexOf(q) - b.t.toLowerCase().indexOf(q)));
}
function fuzzy(q, s){ let i = 0; for (const c of s){ if (c === q[i]) i++; if (i === q.length) return true; } return s.includes(q); }
function escapeHtml(s){ return (s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function toast(msg){
  const t = document.createElement('div'); t.textContent = msg;
  t.setAttribute('style','position:fixed;left:50%;bottom:32px;transform:translateX(-50%);z-index:9700;background:var(--bg-3);color:var(--text);border:1px solid var(--line-2);border-radius:8px;padding:.6rem 1rem;font-family:var(--mono);font-size:.8rem;box-shadow:0 20px 50px rgba(0,0,0,.5);opacity:0;transition:opacity .25s,transform .25s');
  document.body.appendChild(t);
  requestAnimationFrame(()=>{ t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(-4px)'; });
  setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.remove(),300); }, 1500);
}

/* =====================  EXPLORABLE TERMINAL  ===================== */
function makeShell(cfg){
  const term = document.getElementById(cfg.rootId);
  const bodyEl = document.getElementById(cfg.bodyId);
  const input = document.getElementById(cfg.inputId);
  const scroll = document.getElementById(cfg.scrollId);
  if (!term || !bodyEl || !input) return null;

  // Keep wheel/touch scrolling INSIDE the terminal output. Lenis binds wheel/touchstart/touchmove on
  // window in the BUBBLE phase ({passive:false}) and preventDefaults to drive the page — so without this
  // the page scrolls and the shell's overflowed output can't be read (no scroll up/down). We stopPropagation
  // here BEFORE the event reaches Lenis, but only while the shell can still absorb the scroll in that
  // direction; at the top/bottom edge we let it bubble so the PAGE keeps scrolling smoothly via Lenis.
  // Bound in makeShell so every shell — hero, floating mini, expanded overlay, section terminals — gets it.
  if (scroll){
    const canTake = (dir) => {
      if (scroll.scrollHeight - scroll.clientHeight <= 1) return false;                       // nothing to scroll
      if (dir < 0) return scroll.scrollTop > 0;                                                // room to scroll up
      if (dir > 0) return scroll.scrollTop + scroll.clientHeight < scroll.scrollHeight - 1;    // room to scroll down
      return false;
    };
    scroll.addEventListener('wheel', (e) => { if (canTake(e.deltaY)) e.stopPropagation(); }, { passive: true });
    let ty = 0;
    scroll.addEventListener('touchstart', (e) => { if (e.touches[0]) ty = e.touches[0].clientY; }, { passive: true });
    scroll.addEventListener('touchmove', (e) => {
      if (!e.touches[0]) return;
      const dir = ty - e.touches[0].clientY;   // finger up = scroll down (positive)
      ty = e.touches[0].clientY;
      if (canTake(dir)) e.stopPropagation();
    }, { passive: true });
  }

  const SKILLS = {
    'ci/cd & devops': ['Jenkins','GitHub Actions','GitLab CI/CD','Release Engineering','GitOps','Kubernetes','AWS','Cloud-Native'],
    'languages': ['Python','Java','JavaScript','C++'],
    'testing': ['Selenium','Mabl','Pytest','JUnit'],
    'build & infra': ['Docker','Terraform','Gradle','Maven','Git','GitHub','GitLab','SQL']
  };
  // career as git history
  const COMMITS = [
    { h:'a1c2d3e', when:'2024-01', msg:'release: close out LendingClub — 2yr of shipping', body:'LendingClub · Release Engineer · Dec 2021–Jan 2024\nCI/CD pipelines (−30% deploy time), Mabl release gate,\ninternal GitHub platform, monitoring + incident-response automation.' },
    { h:'b4f5a6c', when:'2021-12', msg:'feat(release): join LendingClub release engineering', body:'Owned releases end to end on AWS + Kubernetes.\nJenkins / GitHub Actions / GitLab CI/CD pipelines.' },
    { h:'c7d8e9f', when:'2021-09', msg:'test: 5G/LTE conformance @ Tech Mahindra', body:'Tech Mahindra · Software & Device Engineer · Sep–Dec 2021\nLTE/5G NR + RF RRM conformance on Keysight E7515B,\nAnritsu MD8430A. Trace32 on Snapdragon. −25% rig setup.' },
    { h:'d1a2b3c', when:'2021-05', msg:'build: B.S. Computer Science, Humboldt State', body:'Education / source checkout. Bilingual EN/FR (Lycée Français).' },
    { h:'e4f5a6b', when:'2020-06', msg:'build: SWE intern @ Catalina USA', body:'Selenium, Jenkins CD, Docker-ized build envs, JIRA.' },
    { h:'f0000001', when:'2020-01', msg:'init: hello, world', body:'Started the pipeline.' }
  ];
  const FILES = {
    'lendingclub.md': `# LendingClub — Release Engineer (Dec 2021–Jan 2024)\n- CI/CD pipelines, cut deploy time ~30%\n- Mabl end-to-end tests as a release gate\n- internal GitHub platform admin\n- monitoring + incident-response automation\nstack: Jenkins · GitHub Actions · Mabl · Kubernetes · AWS`,
    'techmahindra.md': `# Tech Mahindra — Software & Device Engineer (Sep–Dec 2021)\n- LTE/5G NR + RF RRM conformance\n- Keysight E7515B · Anritsu MD8430A · R&S CMW500 · Keysight Nemo\n- Lauterbach Trace32 on Qualcomm Snapdragon\n- automated test rigs → −25% setup time`,
    'catalina.md': `# Catalina USA — SWE Intern (Jun–Sep 2020)\n- Selenium WebDriver test suite\n- Jenkins Continuous Delivery builds, wired to JIRA\n- Docker-ized build environments`,
    'education.md': `# Education\n- B.S. Computer Science — Humboldt State University (2021)\n- Lycée Français La Pérouse — bilingual EN / FR`,
    'about.txt': `Release & software engineer, San Francisco Bay Area.\nCI/CD, test automation, cloud-native deploys. Comfortable in a\nJenkinsfile and on a 5G RF test bench. Bilingual EN/FR.`,
    'contact.txt': `email    toulinov.philip@yahoo.com\nphone    +1 (415) 823-7537\nlinkedin linkedin.com/in/ptoulinov`,
    'resume.pdf': `__OPEN__assets/philip-toulinov-resume.pdf`
  };

  const esc = escapeHtml;   // single source of truth — escapes & < > " (the local 3-char esc dropped the quote)
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);   // own-prop only: 'constructor'/'toString' must not resolve up the prototype chain
  const skillsBlock = () => {
    const SCOL={'ci/cd & devops':'#5ec8ff','languages':'#5ee6c0','testing':'#b89cff','build & infra':'#f5b642'};
    return `<div class="sc">`+Object.keys(SKILLS).map((k)=>{
      const units=SKILLS[k].map((s)=>`<div class="sc-unit"><span class="sc-led led-on"></span><span class="sc-name">${s}<span class="svc">.service</span></span><span class="sc-state st-on">active</span></div>`).join('');
      return `<div class="sc-group"><div class="sc-gtitle" style="color:${SCOL[k]||'#7c6cff'}">${k}.target</div>${units}</div>`;
    }).join('')+`</div>`;
  };

  const COMMANDS = {
    help: () => {
      const sec=(label,color)=>`<div class="tui-sec" style="color:${color}">${label}</div>`;
      const it=(k,name,desc,cmd)=>`<div class="tui-item"${cmd?` data-cmd="${cmd}"`:''}><span class="k">${k}</span><span class="tn">${name}</span><span class="td">${desc}</span></div>`;
      return `<div class="tui"><div class="tui-head">▌ SELECT A COMMAND</div><div class="tui-body">`+
        sec('identity','#5ee6c0')+
        it('1','whoami','who is philip','whoami')+it('2','neofetch','system info','neofetch')+it('3','bonjour','fr greeting','bonjour')+it('4','whoami --json','raw schema','whoami --json')+
        sec('career','#5ec8ff')+
        it('5','skills','the stack','skills')+it('6','experience','roles','experience')+it('7','git log','career as commits','git log')+it('8','git show &lt;h&gt;','expand a role','')+it('9','education','school','education')+it('·','kubectl','get skills (pods)','kubectl get skills')+
        sec('filesystem','#b89cff')+
        it('·','ls','list files','ls')+it('·','cat &lt;file&gt;','read a file','')+
        sec('actions','#f5b642')+
        it('·','hire','reverse job-req','hire')+it('·','contact','reach me','contact')+it('·','deploy','run a live deploy','deploy')+it('·','theme &lt;env&gt;','prod|staging|dev','')+it('·','top','skill monitor','top')+it('·','clear','wipe screen','clear')+
        `</div><div class="tui-foot"><b>click</b> a row to run · <b>⌘K</b> palette · <b>?</b> shortcuts · <b>Tab</b> completes</div></div>`;
    },
    menu: () => COMMANDS.help(),
    ls: () => { var ff=Object.keys(FILES); return '<div class="tree"><div class="tree-folder">▾ ~/philip/</div>'+ff.map(function(f,i){var last=i===ff.length-1;var cls=f.endsWith('.md')?'c':f.endsWith('.txt')?'a':'g';var nm=f.endsWith('.pdf')?'<a href="assets/philip-toulinov-resume.pdf" target="_blank">'+f+'</a>':'<span class="'+cls+'">'+f+'</span>';return '<div class="tree-leaf"><span class="tree-pipe">'+(last?'└── ':'├── ')+'</span>'+nm+'</div>';}).join('')+'</div>'; },
    'ls -la': () => COMMANDS.ls(),
    pwd: () => `<span class="d">/home/philip/</span><span class="a">stack</span>`,
    whoami: () => { var KV=[['name','Philip Toulinov'],['role','Release & Software Engineer'],['based','San Francisco Bay Area'],['speaks','English · Français · Русский'],['focus','CI/CD · test automation · cloud-native']]; return '<div class="boxes"><div class="box" style="--bc:#7c6cff"><div class="box-top">~/philip · whoami<span class="bn">id card</span></div><div class="box-body"><div class="nf-info">'+KV.map(function(x){return '<div class="kvr"><span class="kvk">'+x[0]+'</span><span class="kvv">'+x[1]+'</span></div>';}).join('')+'</div></div></div></div><span class="row d">I automate the parts of shipping that page people at 2am — comfortable in a <span class="a">Jenkinsfile</span> and on a <span class="m">5G RF test bench</span>.</span>'; },
    skills: skillsBlock, stack: skillsBlock,
    experience: () => {
      var R=[['LendingClub','#7c6cff','Release Engineer','Dec 2021 – Jan 2024','CI/CD pipelines · −30% deploy time · Mabl release gates'],['Tech Mahindra','#5ec8ff','Software & Device Engineer','Sep – Dec 2021','LTE / 5G NR conformance · automated RF test rigs'],['Catalina USA','#5ee6c0','SWE Intern','Jun – Sep 2020','Selenium suites · Jenkins CD · Dockerized envs']];
      return '<div class="boxes">'+R.map(function(x){return '<div class="box" style="--bc:'+x[1]+'"><div class="box-top">'+x[0]+'<span class="bn">'+x[3]+'</span></div><div class="box-body"><div class="box-row"><b>'+x[2]+'</b><span class="bd">'+x[4]+'</span></div></div></div>';}).join('')+'</div><span class="row d">tip: git show &lt;hash&gt; · or cat lendingclub.md</span>';
    },
    education: () => '<div class="boxes"><div class="box" style="--bc:#5ee6c0"><div class="box-top">Humboldt State University<span class="bn">2021</span></div><div class="box-body"><div class="box-row"><b>B.S. Computer Science</b></div></div></div><div class="box" style="--bc:#b89cff"><div class="box-top">Lycée Français La Pérouse<span class="bn">EN · FR · RU</span></div><div class="box-body"><div class="box-row"><b>Bilingual schooling</b></div></div></div></div>',
    contact: () => `<span class="head">contact</span>` +
      `<span class="row">› <a href="mailto:toulinov.philip@yahoo.com">toulinov.philip@yahoo.com</a></span>` +
      `<span class="row">› <a href="tel:+14158237537">+1 (415) 823-7537</a></span>` +
      `<span class="row">› <a href="https://www.linkedin.com/in/ptoulinov" target="_blank" rel="noopener">linkedin.com/in/ptoulinov</a></span>`,
    neofetch: () => { var L='██████╗ ████████╗\n██╔══██╗╚══██╔══╝\n██████╔╝   ██║\n██╔═══╝    ██║\n██║        ██║\n╚═╝        ╚═╝'; var KV=[['os','Release Engineer · SF Bay Area'],['uptime','shipping since 2020'],['shell','bash · zsh · Jenkinsfile'],['kernel','CI/CD · Kubernetes · AWS'],['langs','Python · Java · JS · C++'],['speaks','English · Français · Русский'],['status','<span class="g">● available</span>']]; return '<div class="nf"><pre class="nf-logo">'+L+'</pre><div class="nf-info">'+KV.map(function(x){return '<div class="kvr"><span class="kvk">'+x[0]+'</span><span class="kvv">'+x[1]+'</span></div>';}).join('')+'</div></div>'; },
    bonjour: () => `<span class="a">Salut</span> — merci d'être passé. Élevé et scolarisé en <span class="c">français</span> à San Francisco. On parle&nbsp;? <a href="mailto:toulinov.philip@yahoo.com">écris-moi</a>.`,
    sudo: () => `<span class="r">nice try.</span> <span class="d">this incident has been logged. 📟</span>`,
    'sudo hire philip': () => `<span class="g">✓</span> escalating privileges… <a href="mailto:toulinov.philip@yahoo.com">toulinov.philip@yahoo.com</a> — let's talk.`,
    hire: () => `<span class="head">// reverse job-req — what I'm looking for</span>` +
      `<span class="row">› <span class="a">seeking</span>   Release Engineering · DevOps · SRE</span>` +
      `<span class="row">› <span class="a">based</span>     San Francisco Bay Area</span>` +
      `<span class="row">› <span class="a">setup</span>     remote or hybrid</span>` +
      `<span class="row">› <span class="a">langs</span>     English · Français</span>` +
      `<span class="row">› <span class="a">status</span>    <span class="g">● open to work — available now</span></span>` +
      `<span class="row d">a fit? → <a href="mailto:toulinov.philip@yahoo.com?subject=${encodeURIComponent('[hire] release / devops / sre')}">toulinov.philip@yahoo.com</a> · or run <span class="a">contact</span></span>`,
    exit: () => `<span class="d">there's no exit — but there's a contact section. try: contact</span>`,
    clear: () => { bodyEl.innerHTML = ''; return ''; }
  };

  const kubectl = (arg) => {
    if (/skills|pods/.test(arg) || arg === '') {
      const rows = [];
      rows.push(`<span class="d">NAME                 READY   STATUS    RESTARTS</span>`);
      const pods = [['ci-cd-pipeline','5/5','Running'],['kubernetes-aws','4/4','Running'],['test-automation','3/3','Running'],['observability','2/2','Running'],['five-g-lte','1/1','Running']];
      pods.forEach(([n,r,s]) => rows.push(`${n.padEnd(20)} ${r.padEnd(7)} <span class="g">${s}</span>     0`));
      return rows.join('\n');
    }
    return `error: the server doesn't have a resource type "${esc(arg)}". try: kubectl get skills`;
  };
  const topCmd = () => {
    const procs = [
      ['ci/cd & release','99'],['kubernetes / aws','94'],['test automation','88'],
      ['observability','81'],['terraform / iac','76'],['5g/lte protocol','61']
    ];
    const bar = (p) => { const w = 18, n = Math.round(w * p / 100); return `[<span class="bar">${'|'.repeat(n)}</span><span class="e">${'·'.repeat(w-n)}</span>]`; };
    let out = `<span class="d">PID  SKILL                LOAD                 %</span>\n`;
    out += procs.map((p,i) => `${String(101+i).padEnd(4)} ${p[0].padEnd(20)} ${bar(+p[1])} ${p[1]}%`).join('\n');
    out += `\n<span class="d">load: shipping · mem: caffeinated · 1 user (you)</span>`;
    return out;
  };
  const gitCmd = (arg) => {
    if (/^log/.test(arg) || arg === ''){
      return '<span class="head">git log --oneline --graph (career)</span><div class="gl">'+COMMITS.map(function(c){return '<div class="gl-row"><span class="gl-g">●</span><span class="gl-h">'+c.h+'</span><span class="gl-m"><span class="gl-w">('+c.when+')</span> '+esc(c.msg)+'</span></div>';}).join('')+'</div><span class="row d">tip: git show '+COMMITS[0].h+'</span>';
    }
    const m = arg.match(/^show\s+([0-9a-f]{3,})/);
    if (m){
      const c = COMMITS.find(x => x.h.startsWith(m[1]));
      if (!c) return `fatal: bad object ${esc(m[1])}`;
      return `<span class="a">commit ${c.h}</span>\n<span class="d">Date: ${c.when}</span>\n\n    ${esc(c.msg)}\n\n${esc(c.body).split('\n').map(l=>'    '+l).join('\n')}`;
    }
    if (/^status/.test(arg)) return `On branch <span class="a">main</span>\nYour career is up to date.\nnothing to commit — working tree clean <span class="g">✓</span>`;
    return `git: '${esc(arg)}' is not a git command. try: git log`;
  };
  const catCmd = (arg) => {
    const f = arg.trim();
    if (!f) return `usage: cat &lt;file&gt; — try: ${Object.keys(FILES).join(', ')}`;
    if (has(FILES, f)){
      const v = FILES[f];
      if (v.startsWith('__OPEN__')){ const url = v.replace('__OPEN__',''); window.open(url,'_blank'); return `<span class="g">opening</span> ${esc(f)} → <a href="${url}" target="_blank">${url}</a>`; }
      return esc(v).split('\n').map((ln) => {
        if (/^#\s/.test(ln)) return `<span class="head">${ln.replace(/^#\s*/, '')}</span>`;
        if (/^-\s/.test(ln)) return `<span class="g">•</span> ${ln.replace(/^-\s*/, '')}`;
        if (/^stack:/.test(ln)) return `<span class="d">${ln}</span>`;
        const kv = ln.match(/^(\w+)(\s{2,})(.+)$/);   // contact.txt key/value rows
        if (kv) return `<span class="a">${kv[1]}</span>${kv[2]}<span class="c">${kv[3]}</span>`;
        return ln;
      }).join('\n');
    }
    return `cat: ${esc(f)}: No such file or directory`;
  };
  const themeCmd = (arg) => {
    const e = arg.trim() || 'production';
    if (!['production','staging','dev'].includes(e)) return `usage: theme &lt;production|staging|dev&gt;`;
    setEnv(e); return `<span class="g">✓</span> switched to <span class="a">${e}</span> environment.`;
  };
  const manCmd = (arg) => {
    const t = arg.trim();
    const docs = { git:'git — your career, as version control. try: git log, git show <hash>', kubectl:'kubectl — get skills as running pods.', top:'top — live monitor of skill load.', cat:'cat <file> — read a file. ls to list.', theme:'theme <env> — re-skin the site: production|staging|dev.' };
    if (!t) return `What manual page do you want? try: <span class="a">man git</span>`;
    return has(docs, t) ? `<span class="c">${esc(t)}</span> <span class="d">—</span> ${esc(docs[t].replace(/^\w+\s—\s/, ''))}` : `<span class="d">No manual entry for ${esc(t)}</span>`;
  };
  const whoamiJson = () => {
    const tag = [...document.querySelectorAll('script')].find(s => s.type === 'application/ld+json');
    let data; try { data = JSON.parse(tag.textContent); } catch(e){ return 'schema.org data unavailable'; }
    const j = esc(JSON.stringify(data, null, 2));
    return `<span class='d'># schema.org/Person — the JSON-LD this page ships to crawlers. yes, it's real.</span>` + String.fromCharCode(10) + `<span class='g'>` + j + `</span>`;
  };

  const hist = []; let hi = 0;
  const print = (html, cls) => {
    // stick to the latest line only if the reader is already at the bottom — if they scrolled up to
    // re-read earlier output, don't yank them back down on the next print (the attract loop keeps printing).
    const stick = !scroll || (scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight) < 40;
    const d = document.createElement('div'); d.className = 'row' + (cls ? ' ' + cls : '');
    d.innerHTML = html; bodyEl.appendChild(d);
    if (scroll && stick) scroll.scrollTop = scroll.scrollHeight;
    if (window.__bindCursor){ d.querySelectorAll('a').forEach(window.__bindCursor); }
  };
  const run = (raw) => {
    const line = raw.trim(); const low = line.toLowerCase();
    print(`<span class="cmd">${esc(raw)}</span>`);
    if (!line) return;
    const [c, ...rest] = low.split(/\s+/); const arg = line.slice(line.toLowerCase().indexOf(c) + c.length).trim();
    let out = '';
    if (has(COMMANDS, low)) out = COMMANDS[low]();
    else if (c === 'cat') out = catCmd(arg);
    else if (c === 'git') out = gitCmd(low.slice(3).trim());
    else if (c === 'kubectl') out = kubectl(low.replace(/^kubectl\s*(get)?\s*/,'').trim());
    else if (c === 'top' || c === 'htop') out = topCmd();
    else if (c === 'theme') out = themeCmd(arg);
    else if (c === 'man') out = manCmd(arg);
    else if (c === 'echo') out = arg ? `<span class="c">${esc(arg)}</span>` : '';
    else if (c === 'history') out = hist.length ? hist.map((h,i)=>`<span class="row"> ${String(i+1).padStart(3)}  ${esc(h)}</span>`).join('') : '<span class="d">no history yet</span>';
    else if (c === 'date') out = `<span class="d">${new Date().toString()}</span>`;
    else if (c === 'cd') out = arg ? `<span class="d">(it's all one directory here — try: ls)</span>` : '';
    else if (c === 'deploy'){ if (typeof deployOverlay === 'function') deployOverlay(); out = `<span class="g">▶</span> running <span class="a">./deploy --env production</span> …\n<span class="flow"><span class="on">checkout</span> <span class="ar">──▶</span> <span class="on">build</span> <span class="ar">──▶</span> <span class="on">test</span> <span class="ar">──▶</span> <span class="on">scan</span> <span class="ar">──▶</span> <span class="nx">deploy</span></span>`; }
    else if (c === 'whoami' && /--?json/.test(low)) out = whoamiJson();
    else if (has(COMMANDS, c)) out = COMMANDS[c]();
    else out = `command not found: ${esc(c)} — try <span class="a">help</span>`;
    if (out) print(out);
  };
  try{ window.__heroRun = run; }catch(e){}

  // tab-completion
  const COMPLETIONS = ['help','ls','pwd','whoami','whoami --json','skills','stack','experience','education','contact','hire','neofetch','bonjour','clear','history','date','sudo','exit','deploy',
    'git log','git show ','git status','kubectl get skills','top','htop','theme production','theme staging','theme dev','man git',
    ...Object.keys(FILES).map(f => 'cat ' + f)];
  const complete = () => {
    const v = input.value.toLowerCase(); if (!v) return;
    const hits = COMPLETIONS.filter(c => c.startsWith(v));
    if (hits.length === 1) input.value = hits[0];
    else if (hits.length > 1){ print(`<span class="d">${hits.join('   ')}</span>`);
      // common prefix
      let pre = hits[0];
      hits.forEach(h => { while (!h.startsWith(pre)) pre = pre.slice(0,-1); });
      input.value = pre;
    }
  };

  /* ----- self-running demo: proves the shell is real, then clears for the visitor ----- */
  const hintEl = term.querySelector('.terminal__hint');
  const hintOrig = hintEl ? hintEl.innerHTML : '';
  const DEMO = cfg.demo || ['help', 'whoami', 'git log', 'kubectl get skills', 'top', 'cat lendingclub.md'];
  let demoOn = false, demoAborted = false, demoTimers = [];
  const dsleep = (ms) => new Promise((res) => { const t = setTimeout(res, ms); demoTimers.push(t); });
  const typeInto = (str) => new Promise((res) => {
    let i = 0; input.value = '';
    const step = () => {
      if (demoAborted) return res();
      input.value = str.slice(0, i);
      if (soundOn && i > 0) blip(1200 + Math.random()*200, .012, 'square', .012);
      if (i++ <= str.length){ const t = setTimeout(step, 40 + Math.random()*46); demoTimers.push(t); } else res();
    };
    step();
  });
  function abortDemo(){
    bodyEl.setAttribute('aria-live', 'polite');   // user is taking over — their command output should be announced
    if (!demoOn) return;
    demoAborted = true; demoOn = false;
    demoTimers.forEach(clearTimeout); demoTimers = [];
    input.value = '';
    if (hintEl) hintEl.innerHTML = hintOrig;
  }
  window.__abortDemo = abortDemo;                 // let the nav motion toggle halt the tour
  // pause helper: hold the tour while the shell is off-screen or the tab is hidden (perf/battery —
  // matters now that the demo loops forever and shells live in every section)
  const demoVisible = () => { if (document.hidden) return false; const r = term.getBoundingClientRect(); return r.top < window.innerHeight * 0.95 && r.bottom > window.innerHeight * 0.05; };
  const waitVisible = () => new Promise((res) => {
    // self-resolving poll: keeps at most ONE pending timer and does NOT push to demoTimers, so a
    // long off-screen stretch can't accumulate cleared-timer ids. Resolves within 400ms of an abort.
    const check = () => { if (demoAborted || demoVisible()) return res(); setTimeout(check, 400); };
    check();
  });
  const wipe = () => { bodyEl.innerHTML = ''; };
  // erase the input one character at a time (the "un-type" half of the attract animation)
  const deleteInput = () => new Promise((res) => {
    const step = () => {
      if (demoAborted) return res();
      const v = input.value;
      if (!v.length) return res();
      input.value = v.slice(0, -1);
      if (soundOn) blip(900 + Math.random()*150, .01, 'square', .01);
      const t = setTimeout(step, 55 + Math.random()*45); demoTimers.push(t);
    };
    step();
  });
  // entice: type a command, hold it, then erase it letter-by-letter — NEVER sending it
  const typeAndDelete = async (str) => {
    if (demoAborted) return;
    await typeInto(str); if (demoAborted) return;
    await dsleep(1000); if (demoAborted) return;
    await deleteInput();
  };
  async function runDemo(){
    if (demoOn || demoAborted || !motionOn) return;
    demoOn = true;
    await dsleep(450);
    const tour = DEMO, entice = cfg.entice || ['whoami', 'hire', 'git log', 'skills'];
    let ei = 0;
    // loop the FULL command tour forever until the visitor takes over (types / clicks / taps a chip);
    // run each command, hold so it can be read, then wipe for the next; pauses while off-screen / tab hidden.
    while (!demoAborted){
      await waitVisible(); if (demoAborted) break;
      // FLOATING (scrolled into the mini dock): do NOT run the command tour — just show the shell is
      // live/usable by typing a command and erasing it, letter by letter, without ever sending it.
      if (term.classList.contains('is-floating')){
        if (bodyEl.querySelector('.cmd')) wipe();              // drop any leftover hero output so the mini reads clean
        if (hintEl) hintEl.innerHTML = `<span class='g'>●</span> type a command — it's live`;
        await typeAndDelete(entice[ei++ % entice.length]); if (demoAborted) break;
        await dsleep(900);
        continue;
      }
      // IN-PAGE hero: loop the FULL command tour (type → run → hold → wipe), then a your-turn nudge.
      if (hintEl) hintEl.innerHTML = `<span class='g'>●</span> live demo · type to take over`;
      for (let k = 0; k < tour.length && !demoAborted; k++){
        if (term.classList.contains('is-floating')) break;     // scrolled mid-tour → switch to entice-only next loop
        await waitVisible(); if (demoAborted) break;
        await typeInto(tour[k]); if (demoAborted) break;       // type the command, character by character
        await dsleep(360); if (demoAborted) break;             // a beat, as if reaching for Enter
        run(tour[k]); input.value = '';                         // run it → its output / banner appears
        await dsleep(2300); if (demoAborted) break;             // hold so a visitor can actually read it
        wipe(); await dsleep(300);                              // clean slate for the next command
      }
      if (demoAborted) break;
      // your-turn nudge: type then un-type a command so the caret visibly invites the visitor to take over
      if (hintEl) hintEl.innerHTML = `<span class='g'>●</span> your turn — type a command`;
      await typeAndDelete(entice[ei++ % entice.length]); if (demoAborted) break;
      await dsleep(800);
    }
    demoOn = false;
    if (hintEl) hintEl.innerHTML = hintOrig;
  }

  if (cfg.banner){ print(`<pre class="term-banner" aria-hidden="true">${cfg.banner}</pre>`, 'is-banner'); }
  print(cfg.welcome || `<span class='d'>welcome to philip's shell — a real terminal. watch the tour, or jump in any time.</span>\n<span class="flow"><span class="on">commit</span> <span class="ar">──▶</span> build <span class="ar">──▶</span> test <span class="ar">──▶</span> scan <span class="ar">──▶</span> <span class="nx">deploy</span></span>`);
  if (motionOn && !reduceQuery.matches){          // don't auto-play the >5s tour for reduced-motion users (WCAG 2.2.2)
    let demoArmed = true;
    const maybeStartDemo = () => {
      if (!demoArmed) return;
      const r = term.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.82 && r.bottom > window.innerHeight * 0.1){
        demoArmed = false;
        window.removeEventListener('scroll', maybeStartDemo);
        runDemo();
      }
    };
    window.addEventListener('scroll', maybeStartDemo, { passive: true });
    if (lenis && lenis.on) lenis.on('scroll', maybeStartDemo);
    maybeStartDemo();
  } else if (cfg.heroStatic){
    // reduced-motion / motion-off: no auto-TYPING (WCAG 2.2.2), but still render a populated shell
    (cfg.staticList || ['whoami']).forEach((c) => run(c));
  } else {
    print(`<span class='cmd'>skills</span>`); print(skillsBlock());
  }

  input.addEventListener('keydown', (e) => {
    // Enter: capture the typed command *before* aborting the self-demo, so a visitor's
    // (or the self-test's) first Enter isn't swallowed by the demo-abort clearing the input.
    if (e.key === 'Enter'){
      const v = input.value;
      abortDemo();
      run(v); if (v.trim()){ hist.push(v); } hi = hist.length; input.value = '';
      return;
    }
    abortDemo();
    if (soundOn && e.key.length === 1) blip(1200 + Math.random()*200, .015, 'square', .015);
    if (e.key === 'ArrowUp'){ if (hi > 0){ hi--; input.value = hist[hi] || ''; } e.preventDefault(); }
    else if (e.key === 'ArrowDown'){ if (hi < hist.length){ hi++; input.value = hist[hi] || ''; } }
    else if (e.key === 'Tab'){ e.preventDefault(); complete(); }
    else if (e.key === 'l' && e.ctrlKey){ e.preventDefault(); bodyEl.innerHTML=''; }
  });
  term.addEventListener('click', (e) => { if (e.target.tagName !== 'A' && e.target.tagName !== 'BUTTON'){ abortDemo(); input.focus(); } });

  // quick-command chips (discoverability for visitors who won't type)
  const chips = cfg.chipsId ? document.getElementById(cfg.chipsId) : null;
  if (chips) chips.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    const cmd = b.dataset.cmd; if (!cmd) return;
    abortDemo(); input.focus(); run(cmd); hist.push(cmd); hi = hist.length;
  }));

  // register this shell's demo-abort so the nav motion toggle halts EVERY tour, not just the last
  (window.__shellAborts || (window.__shellAborts = [])).push(abortDemo);
  window.__abortDemo = () => window.__shellAborts.forEach((fn) => fn());
  return { run, abort: abortDemo, focus: () => input.focus(), input, bodyEl, term };
}

function initTerminal(){
  // the hero shell — the ASCII name banner is pinned in the markup; this runs the full feature
  // tour (help → whoami → git log → kubectl → top → cat) but never wipes itself,
  // so the hero always shows a live, fully-populated terminal that invites you to take over.
  makeShell({ rootId:'heroTerm', bodyId:'heroTermBody', inputId:'heroTermInput', scrollId:'heroTermScroll', chipsId:'heroTermChips',
    heroStatic: true, clearAfterDemo: false,
    demo: ['help', 'whoami', 'git log', 'kubectl get skills', 'hire', 'top', 'cat lendingclub.md'],
    entice: ['whoami', 'hire', 'git log', 'skills', 'cat resume.pdf'],
    staticList: ['help', 'whoami', 'git log', 'kubectl get skills'],
    welcome: `<span class='d'>release &amp; software engineer · ci/cd · cloud-native · 5g/lte. this is a real shell — watch the tour, or type <span class='a'>help</span> and take over.</span>`,
    demoEndMsg: `<span class='d'>// that's the tour — your turn. type <span class='a'>help</span>, <span class='a'>git log</span>, <span class='a'>kubectl get skills</span>, or pick a chip ↑</span>` });
}

/* =====================  HERO TERMINAL — minimise to a pinned dock, expand as an overlay  ===================== */
/* the working terminal lives at the top of the page; once you scroll past the hero it minimises into a
   pinned top-right dock. clicking it re-opens the SAME live shell as a floating overlay. the page itself
   never scrolls while it's open, so minimising drops you back at the exact spot you were reading. */
function initHeroDock(){
  const term = document.getElementById('heroTerm');
  const slot = document.getElementById('heroTermSlot');
  const dock = document.getElementById('termDock');
  const overlay = document.getElementById('termOverlay');
  const backdrop = document.getElementById('termBackdrop');
  const hero = document.getElementById('hero');
  const minBtn = document.getElementById('heroTermMin');
  const input = document.getElementById('heroTermInput');
  if (!term || !slot || !dock || !overlay || !backdrop || !hero) return;
  dock.removeAttribute('hidden');   // visibility is governed by the .is-shown opacity transition from here on
  const bgEls = [document.getElementById('nav'), document.querySelector('main'), document.querySelector('.foot')].filter(Boolean);

  let state = 'closed';   // 'closed' | 'mini' (small, non-modal) | 'expanded' (large, modal)
  let heroInView = true, lastFocus = null;
  const bar = term.querySelector('.terminal__bar');

  // window controls built once: an expand/shrink toggle + a close button, shown only while floating
  const expandBtn = document.createElement('button');
  expandBtn.type = 'button'; expandBtn.className = 'heroterm__ctl heroterm__ctl--expand';
  expandBtn.innerHTML = '<span>⤢ expand</span>'; expandBtn.setAttribute('aria-label', 'Expand terminal');
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button'; closeBtn.className = 'heroterm__ctl heroterm__ctl--close';
  closeBtn.innerHTML = '<span aria-hidden="true">✕</span>'; closeBtn.setAttribute('aria-label', 'Close terminal');
  if (bar){ bar.appendChild(expandBtn); bar.appendChild(closeBtn); }
  const labelExpand = () => { const s = expandBtn.querySelector('span'); s.textContent = state === 'expanded' ? '⤡ shrink' : '⤢ expand'; expandBtn.setAttribute('aria-label', state === 'expanded' ? 'Shrink terminal' : 'Expand terminal'); };

  const syncDock = () => {
    const show = !heroInView && state === 'closed' && !document.body.classList.contains('is-loading');
    dock.classList.toggle('is-shown', show);
    dock.setAttribute('aria-hidden', String(!show));
    dock.tabIndex = show ? 0 : -1;
  };

  // SINGLE LAUNCHER (both viewports, user decision 2026-06-21): once the hero scrolls out of view we no
  // longer auto-float the mini terminal — it overlapped every section (V8u deck, live demos, contact).
  // Instead only the small bottom-right dock pill shows (syncDock); tapping it opens the terminal on
  // demand (desktop → floating mini, mobile → full overlay). Returning to the hero tucks any open shell
  // back home. IntersectionObserver survives lenis + deep-link jumps.
  const isMobile = () => window.matchMedia('(max-width:760px)').matches;
  const onHeroVis = () => {
    if (heroInView){ if (state === 'mini') close(true); }   // back at the hero → tuck the shell home
    syncDock();                                             // the dock pill is now the launcher on both viewports
  };
  if ('IntersectionObserver' in window){
    new IntersectionObserver((entries) => {
      entries.forEach((e) => { heroInView = e.isIntersecting; onHeroVis(); });
    }, { rootMargin: '-42% 0px 0px 0px', threshold: 0 }).observe(hero);
  } else {
    const onScroll = () => { heroInView = hero.getBoundingClientRect().bottom > window.innerHeight * 0.55; onHeroVis(); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  // freeze the page WITHOUT moving scrollY (modal only): lenis.stop() preserves position; overflow:hidden is the no-lenis fallback
  const isNoMotion = () => document.body.classList.contains('no-motion');
  const freeze = () => { if (lenis && lenis.stop && !isNoMotion()) lenis.stop(); else document.body.classList.add('term-frozen'); };
  const thaw = () => { document.body.classList.remove('term-frozen'); if (lenis && lenis.start && motionOn && !isNoMotion()) lenis.start(); };

  const focusables = () => [...overlay.querySelectorAll('a[href],button:not([disabled]),input,textarea,[tabindex]:not([tabindex="-1"])')];
  const onKey = (e) => {
    if (state === 'closed') return;
    if (e.key === 'Escape'){ e.preventDefault(); close(); return; }
    if (state === 'expanded' && e.key === 'Tab'){            // focus-trap only in the modal (expanded) state
      const f = focusables(); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
  };

  // reparent the live shell into the body-level overlay (preserves its state + listeners)
  const mount = () => {
    if (term.classList.contains('is-floating')) return;
    slot.style.minHeight = term.offsetHeight + 'px';   // reserve the hero's space → no reflow, no scroll jump
    overlay.hidden = false;
    overlay.appendChild(term);
    term.classList.add('is-floating');
  };
  const unmount = () => {
    term.classList.remove('is-floating');
    slot.appendChild(term);
    slot.style.minHeight = '';
    overlay.hidden = true;
  };
  // modal chrome (backdrop + inert background + scroll-freeze) — ONLY for the expanded view
  const setModal = (on) => {
    if (on){
      backdrop.hidden = false;
      requestAnimationFrame(() => backdrop.classList.add('is-shown'));
      bgEls.forEach((el) => { el.inert = true; el.setAttribute('aria-hidden', 'true'); });
      freeze();
    } else {
      backdrop.classList.remove('is-shown');
      bgEls.forEach((el) => { el.inert = false; el.removeAttribute('aria-hidden'); });
      thaw();
      setTimeout(() => { if (state !== 'expanded') backdrop.hidden = true; }, reduceQuery.matches ? 0 : 320);
    }
  };
  const focusInput = () => setTimeout(() => { if (input && state !== 'closed') input.focus({ preventScroll: true }); }, reduceQuery.matches ? 0 : 90);

  // dock → small, NON-modal docked window (page stays scrollable + usable underneath)
  function openMini(focus){
    // already floating (e.g. auto-floated on scroll without focus): a real open/click should still
    // drop the caret into the shell so you can type — only the auto-float path (focus===false) stays hands-off.
    if (state === 'mini'){ if (focus !== false) focusInput(); return; }
    if (state === 'expanded') return collapse();
    state = 'mini'; lastFocus = document.activeElement;
    mount();
    overlay.classList.remove('is-open'); overlay.classList.add('is-mini');
    labelExpand();
    dock.classList.remove('is-shown'); dock.setAttribute('aria-expanded', 'true'); dock.setAttribute('aria-hidden', 'true'); dock.tabIndex = -1;
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    document.addEventListener('keydown', onKey, true);
    if (focus !== false) focusInput();   // auto-float on scroll passes false → don't steal focus/scroll
  }
  // mini → large centered MODAL overlay (focus-trapped, background inert, scroll held)
  function expand(){
    if (state === 'closed') openMini();
    state = 'expanded';
    overlay.classList.remove('is-mini'); overlay.classList.add('is-open');
    labelExpand();
    setModal(true);
    focusInput();
  }
  // expanded → mini (drop the modal chrome; page usable again)
  function collapse(){
    if (state !== 'expanded') return;
    state = 'mini';
    setModal(false);
    overlay.classList.remove('is-open'); overlay.classList.add('is-mini');
    labelExpand();
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    focusInput();
  }
  // fully close from any state → shell back home, page restored
  function close(skipFocus){
    if (state === 'closed') return;
    const wasModal = state === 'expanded';
    const sy = window.scrollY;                           // where the reader was — survive the unmount reflow
    state = 'closed';
    overlay.classList.remove('is-open');
    document.removeEventListener('keydown', onKey, true);
    if (wasModal) setModal(false); else document.body.classList.remove('term-frozen');
    const settle = () => {
      overlay.classList.remove('is-mini');
      unmount();                                         // clears the hero slot's reserved minHeight → the
      dock.setAttribute('aria-expanded', 'false');       // hero can change height at the top of the page, and
      syncDock();                                        // scroll-anchoring then nudges us a few px off-position
      if (skipFocus) return;                             // auto-close on scroll-back: don't yank focus/scroll
      if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true }); else dock.focus({ preventScroll: true });
      // the hero may resize on unmount (released minHeight / a taller-or-shorter cycling banner) and
      // scroll-anchoring nudges us a few px — applied AFTER this task, so re-pin now AND next frame.
      const pin = () => { if (lenis && lenis.scrollTo) lenis.scrollTo(sy, { immediate: true, force: true }); else window.scrollTo(0, sy); };
      pin(); requestAnimationFrame(pin);
    };
    reduceQuery.matches ? settle() : setTimeout(settle, 300);
  }

  dock.addEventListener('click', () => isMobile() ? expand() : openMini());   // mobile pill → full overlay; desktop → floating mini
  expandBtn.addEventListener('click', () => state === 'expanded' ? collapse() : expand());
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  if (minBtn) minBtn.addEventListener('click', close);   // legacy minimise button → close
  syncDock();
  window.__termDock = { open: openMini, expand, collapse, close, isOpen: () => state !== 'closed', state: () => state };   // self-test hooks
}

/* =====================  HERO ASCII BANNER — cycle name ↔ greetings with per-frame colour  ===================== */
// decorative only (the banner is aria-hidden; the sr-only <h1> carries the name). Frames live in the
// #bannerFrames JSON block; we fade between them and recolour the gradient. Pauses on motion-off / hidden tab.
function initBanner(){
  const els = [...document.querySelectorAll('.term-banner')];
  const tag = document.getElementById('bannerFrames');
  if (!els.length || !tag) return;
  let frames = [];
  try { frames = JSON.parse(tag.textContent); } catch(e){ return; }
  if (frames.length < 2) return;

  // a fun-but-pro caption under each banner: a rotating greeting + a blinking block cursor
  const caps = els.map(el => {
    let cap = el.parentNode && el.parentNode.querySelector(':scope > .term-cap');
    if (!cap){ cap = document.createElement('div'); cap.className = 'term-cap mono'; cap.setAttribute('aria-hidden', 'true'); el.insertAdjacentElement('afterend', cap); }
    return cap;
  });

  const paint = (el, cap, fr) => {
    el.textContent = fr.art;
    const stops = (fr.colors && fr.colors.length ? fr.colors : ['#f5b642']);
    // multi-stop gradient, wrapped so the CSS flow animation loops seamlessly → "moving colours"
    el.style.backgroundImage = `linear-gradient(108deg, ${stops.concat(stops[0]).join(', ')})`;
    el.style.filter = `drop-shadow(0 0 14px ${stops[0]}2e)`;
    if (cap){ cap.innerHTML = (fr.cap ? escapeHtml(fr.cap) : '') + ' <i class="term-cap__cur" aria-hidden="true">▌</i>'; cap.style.color = stops[0]; }
  };

  els.forEach((el, k) => paint(el, caps[k], frames[0]));   // first paint (caption + colours show immediately)

  if (reduceQuery.matches || !motionOn) return;   // reduced-motion / motion-off: static frame, no flow, no cycling

  els.forEach(el => { el.style.transition = 'opacity .5s var(--ease-out, ease)'; el.classList.add('term-banner--flow'); });
  caps.forEach(c => { if (c) c.style.transition = 'opacity .5s var(--ease-out, ease)'; });
  let i = 0;
  setInterval(() => {
    if (window.__motionPaused || document.hidden) return;   // pause while motion is off or the tab is backgrounded
    i = (i + 1) % frames.length;
    const fr = frames[i];
    els.forEach((el, k) => {
      el.style.opacity = '0'; if (caps[k]) caps[k].style.opacity = '0';
      setTimeout(() => { paint(el, caps[k], fr); el.style.opacity = '1'; if (caps[k]) caps[k].style.opacity = '1'; }, 500);
    });
  }, 4200);
}

/* When the visitor first reaches the thesis, gently auto-scroll through its beats all the way into the
   Experience section (slow, hands-off). One-shot, and any wheel/touch/key/click hands control back. */
function initThesisAutoScroll(){
  const thesis = document.getElementById('thesis');
  const target = document.getElementById('work') || (document.querySelector('#fluxStage') && document.querySelector('#fluxStage').closest('section'));
  if (!thesis || !target || !lenis || reduceQuery.matches || !motionOn) return;   // now runs on touch too (user wanted the desktop auto-ride on mobile)
  let armed = true, running = false, riding = false;
  const easeInOutCubic = (t) => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;   // smooth in/out — replaces the mechanical linear ride
  const stop = () => { if (!running) return; running = false; riding = false; try { lenis.scrollTo(window.scrollY, { immediate: true, force: true }); } catch (e) {} };
  // Escape (or any ⌘/Ctrl shortcut) bails out of the guided ride — but the WHEEL that brought the visitor
  // here must NOT cancel it (that was the bug: the reaching-scroll instantly aborted the auto-scroll).
  window.addEventListener('keydown', (e) => { if (running && (e.key === 'Escape' || e.metaKey || e.ctrlKey)) stop(); });
  // Bail only once the ride is actually GLIDING (`riding`), mirroring the desktop wheel-bail. The finger
  // that scrolls the visitor INTO the thesis fires touchstart during the 320ms arming window — gating on
  // `running` alone let that entry touch kill the ride before it ever moved (it never auto-played on phones).
  window.addEventListener('touchstart', () => { if (running && riding) stop(); }, { passive: true });
  // Apple rule: the user always drives. A DELIBERATE wheel/trackpad delta during the ride hands control
  // back instantly. The high threshold (50) ignores the residual entry-momentum tail that the lock exists
  // to survive — only a real scroll attempt (mouse notch ~100, firm swipe) bails. `riding` gates out the
  // 320ms settle window entirely, so the flick that brought them in can never trip it.
  window.addEventListener('wheel', (e) => { if (running && riding && Math.abs(e.deltaY) >= 50) stop(); }, { passive: true });
  const begin = () => {
    if (!armed || running) return;
    const r = thesis.getBoundingClientRect();
    if (!(r.top <= window.innerHeight * 0.30 && r.bottom > window.innerHeight * 0.4)) return;   // arrived at the thesis
    armed = false; running = true;
    // let the reaching flick settle, then take over with a LOCKED smooth scroll so the visitor's own wheel
    // can't fight it off — it glides through the 3 beats and into Experience hands-free.
    setTimeout(() => {
      if (!running) return;
      const endY = Math.round(target.getBoundingClientRect().top + window.scrollY - 64);
      if (endY - window.scrollY < 120){ running = false; return; }
      const dur = Math.min(5.5, Math.max(3, (endY - window.scrollY) / 620));   // ~1.7x faster guided ride
      riding = true;   // arm the deliberate-wheel bail only now — past the entry-momentum settle window
      lenis.scrollTo(endY, { duration: dur, easing: easeInOutCubic, lock: true, force: true, onComplete: () => { running = false; riding = false; } });
    }, 320);
  };
  if (lenis.on) lenis.on('scroll', begin);
  window.addEventListener('scroll', begin, { passive: true });
}

/* =====================  THESIS — pinned kinetic interstitial (hero → pipeline)  ===================== */
function initThesis(){
  const sec = document.getElementById('thesis');
  if (!sec || !hasGSAP || !motionOn) return;   // no-motion renders the static stacked block (CSS .no-motion .thesis__pin)
  const beats = [...sec.querySelectorAll('.thesis__beat')];
  const b0 = beats[0], b1 = beats[1], b2 = beats[2];
  const w0 = [...b0.querySelectorAll('.tw')];
  const barFill = sec.querySelector('.thesis__bar > i');
  const pctEl = sec.querySelector('.thesis__pct');
  const back = (t) => { const c = 1.70158, c3 = c + 1; return 1 + c3*Math.pow(t-1,3) + c*Math.pow(t-1,2); };
  const cl = (p,a,b) => Math.max(0, Math.min(1, (p-a)/(b-a)));
  const sm = motionOn ? 1 : 0;
  const SCAT = isTouch ? 0.45 : 1;   // tighter scatter on phones — the vw/vh fly-in overlapped badly on narrow screens
  const sa = w0.map((_, i) => {
    const ang = (i / w0.length) * Math.PI * 2 + 1.7;
    const dist = 58 + ((i*53 + 29) % 38);
    return { x: Math.cos(ang)*dist, y: Math.sin(ang)*(dist*0.55), r: ((i%2)?1:-1)*(7 + (i*13)%11) };
  });
  gsap.set([b1, b2], { autoAlpha: 0, y: 24 });
  gsap.set(b0, { autoAlpha: 1 });
  w0.forEach((w, i) => gsap.set(w, { x: (sa[i].x * SCAT) + 'vw', y: (sa[i].y * SCAT) + 'vh', rotation: sa[i].r, autoAlpha: 0.12, filter: isTouch ? 'none' : 'blur(8px)' }));
  gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top top', end: '+=176%', pin: true, scrub: 0.5, anticipatePin: 1,
    onUpdate: (self) => {
      const p = self.progress;
      if (barFill) barFill.style.width = (p*100).toFixed(1) + '%';
      if (pctEl) pctEl.textContent = Math.round(p*100) + '% compiled';
      const aIn = cl(p, 0, 0.32), aOut = cl(p, 0.40, 0.50), ak = (1 - back(aIn)) * sm;
      w0.forEach((w, i) => { const s = sa[i];
        w.style.transform = `translate(${(s.x*ak*SCAT).toFixed(2)}vw, ${(s.y*ak*SCAT).toFixed(2)}vh) rotate(${(s.r*ak).toFixed(2)}deg)`;
        w.style.opacity = String(Math.min(1, 0.14 + aIn*1.6));
        if (!isTouch) w.style.filter = `blur(${((1-aIn)*7*sm).toFixed(2)}px)`;
      });
      b0.style.opacity = String(1 - aOut);
      const bIn = cl(p, 0.42, 0.72), bOut = cl(p, 0.80, 0.90);
      gsap.set(b1, { autoAlpha: Math.min(1, bIn*1.3) * (1 - bOut), y: (1 - bIn) * 22 });
      const cIn = cl(p, 0.82, 0.96);
      gsap.set(b2, { autoAlpha: cIn, scale: 0.965 + cIn*0.035 });
    }
  }});
}

/* =====================  HERO STATUSPAGE — 90-day uptime bars  ===================== */
function initStatuspage(){
  const sp = document.getElementById('statuspage'); if (!sp) return;
  const reduce = !motionOn;
  sp.querySelectorAll('.sp__bars').forEach((wrap) => {
    const deg = parseInt(wrap.dataset.deg || '0', 10);
    const marks = new Set(); let guard = 0;
    while (marks.size < deg && guard++ < 500){ marks.add(Math.floor(Math.pow(Math.random(), 1.7) * 90)); }
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 90; i++){
      const b = document.createElement('i');
      b.className = 'sp__bar' + (marks.has(i) ? ' sp__bar--deg' : '');
      if (!reduce) b.style.transitionDelay = (i * 4) + 'ms';
      frag.appendChild(b);
    }
    wrap.appendChild(frag);
    requestAnimationFrame(() => wrap.classList.add('is-in'));
  });
}

/* =====================  PLAYABLE INCIDENT — walk an on-call SEV  ===================== */
function initIncident(){
  const root = document.getElementById('incident'); if (!root) return;
  const logEl = document.getElementById('incLog');
  const timerEl = document.getElementById('incTimer');
  const resultEl = document.getElementById('incResult');
  const resetBtn = document.getElementById('incReset');
  const btns = [...root.querySelectorAll('.incident__btn[data-step]')];
  const LABELS = ['acknowledge', 'investigate', 'rollback', 'resolve'];
  const STEPS = [
    { ts: '00:04', lines: [['cmd', '$ incident ack INC-4127'], ['d', 'acknowledged · 1 responder on call']] },
    { ts: '00:19', lines: [['cmd', '$ kubectl rollout status deploy/web -n prod'], ['d', 'Waiting for rollout: 2 of 5 updated…'], ['r', '✗ readiness probe failed: HTTP 503 (x14)'], ['cmd', '$ kubectl logs deploy/web --since=2m | tail'], ['r', 'panic: config: missing DATABASE_URL'], ['a', 'root cause → bad env in web@sha256:9f2c (rev 42)']] },
    { ts: '00:38', lines: [['cmd', '$ kubectl rollout undo deploy/web -n prod'], ['d', 'rolled back to revision 41'], ['d', 'pods: 5/5 Running · readiness 200 OK'], ['g', '✓ error rate 0.0% · p99 latency 198ms']] },
    { ts: '00:47', lines: [['cmd', '$ incident resolve INC-4127'], ['g', '✓ incident resolved'], ['d', 'postmortem scheduled · action: add env-validation gate to CI']] }
  ];
  let busy = false;
  const append = (cls, text) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; logEl.appendChild(s); logEl.scrollTop = logEl.scrollHeight; };
  const stream = (lines, done) => {
    if (!motionOn){ lines.forEach(([c, t]) => append(c, t)); done(); return; }
    let i = 0; const next = () => { if (i >= lines.length){ done(); return; } const [c, t] = lines[i++]; append(c, t); setTimeout(next, 320 + Math.random()*260); }; next();
  };
  const runStep = (idx) => {
    if (busy) return; const btn = btns[idx]; if (!btn || btn.disabled) return;
    busy = true; btns.forEach(b => b.disabled = true); btn.classList.add('is-active');
    timerEl.textContent = STEPS[idx].ts;
    stream(STEPS[idx].lines, () => {
      btn.classList.remove('is-active'); btn.classList.add('is-done'); busy = false;
      if (idx < STEPS.length - 1){ const nx = btns[idx+1]; nx.disabled = false; nx.classList.add('is-next'); }
      else { root.classList.add('is-resolved'); resultEl.hidden = false; resultEl.innerHTML = `<span class='g'>●</span> resolved · <b>MTTR 47s</b> · 0 customer-facing errors`; if (resetBtn) resetBtn.hidden = false; }
    });
  };
  const reset = () => {
    busy = false; logEl.innerHTML = `<span class='d'>// you are on call. walk the incident →</span>`;
    timerEl.textContent = '00:00'; resultEl.hidden = true; root.classList.remove('is-resolved'); if (resetBtn) resetBtn.hidden = true;
    btns.forEach((b, i) => { b.disabled = i !== 0; b.classList.remove('is-active', 'is-done', 'is-next'); b.textContent = LABELS[i]; });
  };
  btns.forEach((b, i) => b.addEventListener('click', () => runStep(i)));
  if (resetBtn) resetBtn.addEventListener('click', reset);
  reset();
}

/* =====================  DAG NODE HOVER PREVIEW  ===================== */
function initDagHover(){
  if (isTouch) return;
  const dag = document.getElementById('dag'); if (!dag) return;
  const DATA = [
    { role: 'B.S. Computer Science', org: 'Humboldt State University', art: 'CS fundamentals · EN / FR', st: 'passed · 0.3s' },
    { role: 'Software Engineer Intern', org: 'Catalina USA', art: 'Selenium · Jenkins · Docker · JIRA', st: 'passed · 0.5s', logos: [['selenium.svg','#43B02A'],['jenkins.svg','#D24939'],['docker.svg','#2496ED'],['jira.svg','#2684FF']] },
    { role: 'Software · Device Engineer', org: 'Tech Mahindra', art: 'LTE/5G NR · Keysight · Anritsu · Trace32', st: 'passed · 0.8s', logos: [['git.svg','#F05032'],['jira.svg','#2684FF']] },
    { role: 'Release Engineer', org: 'LendingClub', art: 'Jenkins · GitHub Actions · Mabl · K8s · AWS', st: 'passed · 1.1s', logos: [['jenkins.svg','#D24939'],['githubactions.svg','#2088FF'],['kubernetes.svg','#326CE5'],['amazonwebservices.svg','#FF9900'],['git.svg','#F05032']] },
    { role: 'Open to the next deploy', org: 'Now', art: 'release eng · devops · SRE', st: 'monitoring · live' }
  ];
  const pop = document.createElement('div'); pop.className = 'dagpop mono'; pop.setAttribute('aria-hidden', 'true'); dag.appendChild(pop);
  let hideT = null;
  const show = (node, i) => {
    const d = DATA[i]; if (!d) return; clearTimeout(hideT);
    const logoRow = (d.logos && d.logos.length) ? `<span class='dagpop__logos'>` + d.logos.map(l => `<i style='--lb:${l[1]};-webkit-mask:url(assets/logos/${l[0]}) center/contain no-repeat;mask:url(assets/logos/${l[0]}) center/contain no-repeat'></i>`).join('') + `</span>` : '';
    pop.innerHTML = `<span class='dagpop__role'>${d.role}</span><span class='dagpop__org'>${d.org}</span><span class='dagpop__art'>${d.art}</span>` + logoRow + `<span class='dagpop__st'>${d.st}</span>`;
    const nr = node.getBoundingClientRect(), dr = dag.getBoundingClientRect();
    pop.style.left = (nr.left - dr.left + nr.width/2) + 'px';
    pop.style.top = (nr.top - dr.top) + 'px';
    pop.classList.add('show');
  };
  dag.querySelectorAll('.dnode[data-node]').forEach((node) => {
    const i = parseInt(node.dataset.node, 10);
    node.addEventListener('mouseenter', () => show(node, i));
    node.addEventListener('mouseleave', () => { hideT = setTimeout(() => pop.classList.remove('show'), 90); });
  });
  pop.addEventListener('mouseenter', () => clearTimeout(hideT));
  pop.addEventListener('mouseleave', () => pop.classList.remove('show'));
}

/* =====================  STAGE-CARD TOOL CHIPS — pop in as each card reveals  ===================== */
function initStageLogos(){
  [...document.querySelectorAll('.stage__stack')].forEach((row) => {
    inView(row, () => row.classList.add('lit'), { rootMargin: '0px 0px -10% 0px' });
  });
}

/* ---------- start ---------- */
// fail-open: the whole page is opacity:0 under .is-loading until afterLoad() clears it.
// guard boot() and add a hard 3s backstop + global error net so a single throw can never
// leave a recruiter staring at a blank page (a deploy health-check timeout, basically).
function clearLoadingLock(){ try { document.body.classList.remove('is-loading'); } catch(e){} }
const loadingBackstop = setTimeout(clearLoadingLock, 3000);
window.addEventListener('error', clearLoadingLock);
window.addEventListener('unhandledrejection', clearLoadingLock);
try {
  boot();
} catch (e) {
  clearLoadingLock();
  console.error('boot() failed — page shown via failsafe:', e);
}
// once the page is visibly up, the backstop is no longer needed
if (!document.body.classList.contains('is-loading')) clearTimeout(loadingBackstop);
