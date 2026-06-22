/* =====================  TRANSIT MAP — Experience into Builds  =====================
   A subway-style diagram that fuses the career (5 role "interchange" stations on one
   line) with the products (10 builds branching off at the role that shipped them).
   Hover/tap a station → reader panel (desktop) or bottom sheet (mobile); launch a build
   → loads the REAL same-origin /demos/<slug>/ app in an iframe dock.

   Recreated 1:1 from the claude.ai/design handoff "Transit Map - Experience into Builds"
   as a self-contained vanilla module (the prototype's support.js streaming runtime is NOT
   used). ONE responsive component: horizontal ≥880px, vertical + bottom sheet <880px.
   The signal animation pauses when off-screen / tab-hidden (no idle CPU, no lag).        */
(function () {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';
  function mk(t, a) { var e = document.createElementNS(SVGNS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function el(t, style, html) { var e = document.createElement(t); if (style) e.style.cssText = style; if (html != null) e.innerHTML = html; return e; }
  var FIRE = ['#7c6cff', '#5ee6c0', '#3fe0d0', '#f5b642', '#f8553f', '#e878f5', '#62b6ff', '#9ae85e', '#ff9e64', '#c792ea'];

  /* ---------- data (lifted verbatim from the design's initData) ---------- */
  var ROLES = [
    { i: 0, num: '01', yr: "'17–'21", org: 'Humboldt State', role: 'B.S. Computer Science', loc: 'Arcata, CA', color: '#7c6cff', metric: null, bullets: ['CS degree — the foundation everything compiles from.', 'Bilingual EN / FR (Lycée Français La Pérouse), conversational RU.', 'First taste of systems thinking and shipping working code.'] },
    { i: 1, num: '02', yr: '2020', org: 'Catalina USA', role: 'Software Engineer Intern', loc: 'Remote', color: '#7c6cff', metric: null, bullets: ['Selenium WebDriver integration & regression suites.', 'Jenkins continuous delivery wired into JIRA.', 'Dockerized, pinned build environments.'] },
    { i: 2, num: '03', yr: '2021', org: 'Tech Mahindra', role: 'Software & Device Engineer', loc: 'On-site', color: '#7c6cff', metric: ['−25%', 'rig setup'], bullets: ['LTE / 5G NR protocol & RF conformance on Keysight / Anritsu.', 'Scripted automated test rigs — cut manual setup 25%.', 'Firmware debug on Snapdragon with Trace32.'] },
    { i: 3, num: '04', yr: "'21–'24", org: 'LendingClub', role: 'Release Engineer', loc: 'SF · Hybrid', color: '#7c6cff', metric: ['−30%', 'deploy time'], bullets: ['CI/CD pipelines — cut deployment time 30%.', 'Mabl end-to-end tests as a release gate.', 'Internal GitHub platform + incident-response automation.'] },
    { i: 4, num: '05', yr: '2024–', org: 'Independent', role: 'Engineer & Builder', loc: 'SF Bay Area', color: '#5ee6c0', metric: ['10', 'shipped solo'], live: true, bullets: ['Design, ship & operate my own products end to end.', 'Trading, real-time data, fintech & AI-infra — all solo.', 'Open to release / DevOps / SRE roles.'] }
  ];
  var BUILDS = [
    { n: '01', slug: 'sokoloff', title: 'A Visual Journey', cat: 'Creative web app', accent: '#7c6cff', from: [0, 4], lede: 'An installable PWA presenting a 150+ work catalogue as a scrolling timeline; a Python pipeline turns stills into AI cinemagraphs.', facts: [['150+', 'works'], ['4', 'series'], ['30', 'cinemagraphs']] },
    { n: '02', slug: 'freqtrade', title: 'Freqtrade · Hyperliquid', cat: 'Algorithmic trading', accent: '#5ee6c0', from: [1, 2, 4], lede: 'A freqtrade stack wired to Hyperliquid with a REST/WS control UI, running a dry-run strategy with backtests persisted to Feather.', facts: [['+6.82', 'USDC P&L'], ['26', 'trades'], ['65%', 'win rate']] },
    { n: '03', slug: 'stakeodds', title: 'STAKE·ODDS', cat: 'Real-time data', accent: '#3fe0d0', from: [2, 4], lede: 'Two odds feeds reconciled into one movement view, driven over the Chrome DevTools Protocol with inline-SVG dashboards.', facts: [['2', 'feeds'], ['30/min', 'ticks'], ['10s', 'poll']] },
    { n: '04', slug: 'loansy', title: 'Loansy', cat: 'Fintech ops', accent: '#7c6cff', from: [0, 3, 4], lede: 'An admin console over a Mongo/Redis lending core with multi-chain payouts (TON, Solana), scheduled jobs and a live activity stream.', facts: [['248', 'active loans'], ['$1.28M', 'volume'], ['92.4%', 'repaid']] },
    { n: '05', slug: 'claudedown', title: 'ClaudeDown', cat: 'Monitoring', accent: '#5ee6c0', from: [3, 4], lede: 'A no-framework Node service polling provider status into Postgres, charted with inline SVG and a Statuspage-style timeline.', facts: [['99.90%', 'uptime'], ['11', 'providers'], ['314ms', 'avg']] },
    { n: '06', slug: 'flex-lane', title: 'Flex Lane', cat: 'Civic data', accent: '#3fe0d0', from: [4], lede: 'A React + Vite front-end over an Express reader of the 511 Toll Data API, designed to degrade honestly when the feed is missing.', facts: [['live', 'pricing'], ['honest', 'fallbacks'], ['511', 'feed']] },
    { n: '07', slug: 'renovation', title: 'Renovation Watchlist', cat: 'Civic data', accent: '#7c6cff', from: [4], lede: 'A Python pipeline scores DataSF permit records for displacement risk; a MapLibre editorial front-end maps and ranks them.', facts: [['985', 'flagged'], ['1,449', 'violations'], ['34', 'hoods']] },
    { n: '08', slug: 'urbanforest', title: 'The Urban Forest', cat: 'Civic data', accent: '#5ee6c0', from: [4], isNew: true, lede: 'A pure-Python pipeline pulls the DPW Street Tree List; a 195K-point deck.gl map renders every tree, colored by genus.', facts: [['198,435', 'trees'], ['586', 'species'], ['195K', 'mapped']] },
    { n: '09', slug: 'hidden-sf', title: 'Hidden SF', cat: 'Civic data', accent: '#3fe0d0', from: [4], isNew: true, lede: 'The rooftop terraces downtown developers owe the public under Planning Code §138 — mapped, with a brass / petrol duotone.', facts: [['81', 'POPOS'], ['§138', 'code'], ['1959', 'since']] },
    { n: '10', slug: 'sf-on-screen', title: 'SF on Screen', cat: 'Civic data', accent: '#7c6cff', from: [4], isNew: true, lede: 'Every location the SF Film Commission has logged since 1915, pinned to the corner it was filmed on; press Play to watch the century fill in.', facts: [['2,118', 'locations'], ['295', 'productions'], ['1915', 'since']] }
  ];
  // same-origin relative demo paths (match the existing Builds grid embeds; work on Railway + Netlify)
  var SRC = { sokoloff: 'demos/sokoloff/', freqtrade: 'demos/freqtrade/', stakeodds: 'demos/stakeodds/#demo', loansy: 'demos/loansy/', claudedown: 'demos/claudedown/', 'flex-lane': 'demos/flex-lane/', renovation: 'demos/renovation-watchlist/', urbanforest: 'demos/urbanforest/', 'hidden-sf': 'demos/hidden-sf/', 'sf-on-screen': 'demos/sf-on-screen/' };
  BUILDS.forEach(function (b) { b.url = SRC[b.slug] || ('demos/' + b.slug + '/'); });

  function bySlug(s) { for (var i = 0; i < BUILDS.length; i++) if (BUILDS[i].slug === s) return BUILDS[i]; }
  function builtBy(i) { return BUILDS.filter(function (b) { return b.from.indexOf(i) !== -1; }); }
  function short(t) { return t.length > 16 ? t.slice(0, 15) + '…' : t; }
  function shortM(t) { return t.length > 13 ? t.slice(0, 12) + '…' : t; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---------- reader content (verbatim markup from the design) ---------- */
  function rolePanelHTML(r, withChips) {
    return '<div style="font-family:\'Geist Mono\',monospace;font-size:11px;color:' + r.color + ';letter-spacing:.1em;text-transform:uppercase;">' + r.num + ' · ' + r.yr + (r.live ? ' · <span style="color:#5ee6c0;">● now</span>' : '') + '</div>'
      + '<div style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:23px;color:#fff;margin:8px 0 3px;letter-spacing:-.02em;">' + esc(r.org) + '</div>'
      + '<div style="font-size:13.5px;color:#9a9aae;margin-bottom:15px;">' + esc(r.role) + ' · ' + esc(r.loc) + '</div>'
      + (r.metric ? '<div style="display:flex;align-items:baseline;gap:9px;margin-bottom:15px;"><span style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:34px;color:#3fe0d0;letter-spacing:-.03em;">' + r.metric[0] + '</span><span style="font-family:\'Geist Mono\',monospace;font-size:11px;color:#7a7a90;">' + r.metric[1] + '</span></div>' : '')
      + r.bullets.map(function (x) { return '<div style="position:relative;padding-left:16px;font-size:13px;color:#c8c8d4;line-height:1.55;margin-bottom:9px;"><span style="position:absolute;left:0;top:7px;width:5px;height:5px;border-radius:50%;background:' + r.color + ';"></span>' + esc(x) + '</div>'; }).join('')
      + (withChips ? '<div style="margin-top:16px;font-family:\'Geist Mono\',monospace;font-size:11px;color:#7a7a90;text-transform:uppercase;letter-spacing:.06em;">stations on this branch</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;">' + builtBy(r.i).map(function (b) { return '<button type="button" data-go="' + b.slug + '" style="cursor:pointer;font-family:\'Geist Mono\',monospace;font-size:11px;color:#cfcfe0;background:#12101a;border:1px solid ' + b.accent + '55;border-radius:20px;padding:5px 10px;">' + esc(b.title) + '</button>'; }).join('') + '</div>' : '');
  }
  function buildPanelHTML(b) {
    return '<div style="font-family:\'Geist Mono\',monospace;font-size:11px;color:' + b.accent + ';letter-spacing:.1em;text-transform:uppercase;">' + b.n + ' · ' + esc(b.cat) + (b.isNew ? ' · <span style="color:#5ee6c0;">new</span>' : '') + '</div>'
      + '<div style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:22px;color:#fff;margin:8px 0 6px;letter-spacing:-.02em;">' + esc(b.title) + '</div>'
      + '<p style="font-size:13px;color:#9a9aae;line-height:1.55;margin:0 0 13px;">' + esc(b.lede) + '</p>'
      + '<div style="display:flex;gap:14px;margin-bottom:15px;flex-wrap:wrap;">' + b.facts.map(function (f) { return '<div><div style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:18px;color:' + b.accent + ';">' + f[0] + '</div><div style="font-family:\'Geist Mono\',monospace;font-size:9.5px;color:#7a7a90;text-transform:uppercase;">' + f[1] + '</div></div>'; }).join('') + '</div>'
      + '<button type="button" data-launch="' + b.slug + '" style="cursor:pointer;font-family:\'Geist Mono\',monospace;font-size:12.5px;color:#fff;background:' + b.accent + '1f;border:1px solid ' + b.accent + '66;border-radius:9px;padding:11px 15px;display:inline-flex;align-items:center;gap:8px;"><span style="display:inline-grid;place-items:center;width:18px;height:18px;border-radius:50%;background:' + b.accent + ';color:#06060a;font-size:8px;">▶</span> launch live app</button>'
      + '<div style="margin-top:15px;font-family:\'Geist Mono\',monospace;font-size:11px;color:#7a7a90;text-transform:uppercase;letter-spacing:.06em;">skills feeding it</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;">' + b.from.map(function (i) { return '<button type="button" data-role2="' + i + '" style="cursor:pointer;font-family:\'Geist Mono\',monospace;font-size:11px;color:#cfcfe0;background:#12101a;border:1px solid rgba(230,230,255,.14);border-radius:20px;padding:5px 10px;">' + esc(ROLES[i].org) + '</button>'; }).join('') + '</div>';
  }

  /* ---------- signal animation: white "trains" + per-branch fire-off bursts ---------- */
  function trainAnim(svg, mainLine, branches) {
    var layer = mk('g', {}); svg.appendChild(layer);
    var len = 0; try { len = mainLine.getTotalLength(); } catch (e) {}
    if (!len) return function () {};
    var coarse = window.matchMedia('(pointer:coarse)').matches;
    var NW = coarse ? 6 : 9, whites = [], i;
    for (i = 0; i < NW; i++) { var c = mk('circle', { r: 3, fill: '#fff' }); c.style.filter = 'drop-shadow(0 0 5px #fff)'; layer.appendChild(c); whites.push({ el: c, phase: i / NW }); }
    var fired = [], trainDur = 2600, cap = coarse ? 33 : 0;
    var cyc = -1, raf = 0, lastF = 0;
    function tick(now) {
      raf = requestAnimationFrame(tick);
      if (document.hidden || window.__motionPaused) return;
      if (cap && now - lastF < cap) return; lastF = now;
      for (var j = 0; j < whites.length; j++) {
        var w = whites[j], p = ((now / trainDur) + w.phase) % 1, ep = Math.pow(p, 2.7), pt = mainLine.getPointAtLength(ep * len);
        w.el.setAttribute('cx', pt.x); w.el.setAttribute('cy', pt.y);
        w.el.setAttribute('r', (2 + ep * 3.2).toFixed(2)); w.el.setAttribute('opacity', Math.min(1, p * 5).toFixed(2));
      }
      var cc = Math.floor(now / trainDur);
      if (cc !== cyc) {
        cyc = cc;
        for (var b = 0; b < branches.length; b++) {
          var br = branches[b], bl = 0; try { bl = br.el.getTotalLength(); } catch (e) {} if (!bl) continue;
          var fc = br.fireColor || br.color, fe = mk('circle', { r: 4.2, fill: fc }); fe.style.filter = 'drop-shadow(0 0 7px ' + fc + ')'; layer.appendChild(fe);
          fired.push({ el: fe, path: br.el, len: bl, t0: now, dur: 820 + Math.random() * 620 });
        }
      }
      for (var k = fired.length - 1; k >= 0; k--) {
        var f = fired[k], fp = (now - f.t0) / f.dur;
        if (fp >= 1) { f.el.remove(); fired.splice(k, 1); continue; }
        var fpt = f.path.getPointAtLength(fp * f.len);
        f.el.setAttribute('cx', fpt.x); f.el.setAttribute('cy', fpt.y);
        f.el.setAttribute('opacity', (1 - fp * 0.25).toFixed(2)); f.el.setAttribute('r', (4.2 * (1 - fp * 0.4)).toFixed(2));
      }
    }
    function startA() { if (!raf) raf = requestAnimationFrame(tick); }
    function stopA() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    var io = null;
    try { io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) startA(); else stopA(); }, { rootMargin: '140px' }); io.observe(svg); }
    catch (e) { startA(); }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) startA(); });
    return function () { stopA(); if (io) io.disconnect(); };
  }

  /* ---------- the live-app dock (body-level, fixed; reveal is INSTANT, never a height transition) ---------- */
  function setupLiveDock() {
    var ex = document.getElementById('tmLive'); if (ex && ex.__api) return ex.__api;
    var dock = el('div', 'position:fixed;left:0;right:0;top:0;height:0;z-index:9000;overflow:hidden;background:#08080d;border-bottom:1px solid rgba(230,230,255,.1);display:flex;flex-direction:column;');
    dock.id = 'tmLive'; dock.setAttribute('aria-hidden', 'true');
    dock.innerHTML = '<div style="height:100%;width:100%;max-width:1340px;margin:0 auto;padding:12px clamp(14px,3vw,40px) 16px;display:flex;flex-direction:column;">'
      + '<div style="flex:none;display:flex;align-items:center;gap:11px;padding:0 2px 11px;">'
      + '<span style="display:flex;gap:6px;flex:none;"><i style="width:11px;height:11px;border-radius:50%;background:#f8553f;display:block;"></i><i style="width:11px;height:11px;border-radius:50%;background:#f5b642;display:block;"></i><i style="width:11px;height:11px;border-radius:50%;background:#5ee6c0;display:block;"></i></span>'
      + '<span style="font-family:\'Geist Mono\',monospace;font-size:12px;color:#5ee6c0;display:inline-flex;align-items:center;gap:7px;flex:none;"><span style="width:7px;height:7px;border-radius:50%;background:#5ee6c0;box-shadow:0 0 8px #5ee6c0;"></span>live</span>'
      + '<span id="tmLiveAddr" style="font-family:\'Geist Mono\',monospace;font-size:12px;color:#9a9aae;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;"></span>'
      + '<a id="tmLiveOpen" target="_blank" rel="noopener" style="font-family:\'Geist Mono\',monospace;font-size:11.5px;color:#cfcfe0;text-decoration:none;border:1px solid rgba(230,230,255,.18);border-radius:7px;padding:6px 11px;flex:none;">open ↗</a>'
      + '<button id="tmLiveClose" type="button" aria-label="Close live app" style="cursor:pointer;font-family:\'Geist Mono\',monospace;font-size:11.5px;color:#cfcfe0;background:transparent;border:1px solid rgba(230,230,255,.18);border-radius:7px;padding:6px 11px;flex:none;">✕ close</button>'
      + '</div>'
      + '<div style="flex:1;min-height:0;border:1px solid rgba(230,230,255,.14);border-radius:12px;overflow:hidden;background:#0b0a10;position:relative;">'
      + '<iframe id="tmLiveFrame" title="Live app preview" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals" referrerpolicy="no-referrer" style="width:100%;height:100%;border:0;display:block;background:#0b0a10;"></iframe>'
      + '<div id="tmLiveLoad" style="position:absolute;inset:0;display:none;place-items:center;background:#0b0a10;font-family:\'Geist Mono\',monospace;font-size:12.5px;color:#7a7a90;text-align:center;padding:20px;"><span><span id="tmLoadT">loading …</span><br><span style="font-size:11px;color:#5b5b6e;">if it doesn\'t appear, the app blocks embedding — use <b style="color:#9a9aae;">open ↗</b></span></span></div>'
      + '</div></div>';
    document.body.appendChild(dock);
    var frame = dock.querySelector('#tmLiveFrame'), addr = dock.querySelector('#tmLiveAddr'), openA = dock.querySelector('#tmLiveOpen'), load = dock.querySelector('#tmLiveLoad'), loadT = dock.querySelector('#tmLoadT');
    var mq = window.matchMedia('(min-width: 880px)');
    function open(b) {
      addr.textContent = (location.host ? location.host + '/' : '') + b.url;
      openA.href = b.url;
      load.style.display = 'grid'; loadT.textContent = 'loading ' + b.title + ' …';
      frame.onload = function () { load.style.display = 'none'; };
      frame.src = b.url;
      dock.setAttribute('aria-hidden', 'false');
      if (mq.matches) { dock.style.height = Math.min(window.innerHeight * 0.86, 880) + 'px'; try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); } }
      else { dock.style.height = '100dvh'; }   // mobile: full-screen so the app renders at true width
    }
    function close() { dock.style.height = '0'; dock.setAttribute('aria-hidden', 'true'); setTimeout(function () { try { frame.src = 'about:blank'; } catch (e) {} }, 120); }
    dock.querySelector('#tmLiveClose').onclick = close;
    dock.__api = { dock: dock, open: open, close: close };
    return dock.__api;
  }

  /* ============ DESKTOP — horizontal line, builds branch up & down ============ */
  function makeDesktop(root, live) {
    var W = 1280, H = 560, VW = W - 340;
    root.innerHTML = '<div style="display:grid;grid-template-columns:1fr 340px;min-height:560px;background:#08080d;border:1px solid rgba(230,230,255,.1);border-radius:14px;box-shadow:0 40px 100px -50px rgba(0,0,0,.85);overflow:hidden;">'
      + '<div style="position:relative;min-width:0;"><svg id="tmd-svg" viewBox="0 0 ' + VW + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Career line with builds branching off" style="width:100%;height:100%;display:block;"></svg></div>'
      + '<div id="tmd-panel" style="border-left:1px solid rgba(230,230,255,.08);background:#0b0a10;padding:24px;overflow:auto;"></div></div>';
    var svg = root.querySelector('#tmd-svg'), panel = root.querySelector('#tmd-panel');
    var ly = 294, x0 = 84, x1 = VW - 104, rx = function (i) { return x0 + (x1 - x0) * (i / 4); };
    var mainLine = mk('path', { d: 'M ' + x0 + ' ' + ly + ' L ' + x1 + ' ' + ly, fill: 'none', stroke: '#7c6cff', 'stroke-width': 6, 'stroke-linecap': 'round', opacity: .5 }); svg.appendChild(mainLine);
    var branches = [];
    BUILDS.forEach(function (b, k) {
      var pr = b.from[b.from.length - 1], sx = rx(pr), up = k % 2 === 0 ? -1 : 1, tier = Math.floor(k / 2) % 2, bx = x0 + (x1 - x0) * ((k + 0.5) / BUILDS.length), by = ly + up * (96 + tier * 70);
      var bp = mk('path', { d: 'M ' + sx + ' ' + ly + ' C ' + sx + ' ' + ((ly + by) / 2) + ', ' + bx + ' ' + ((ly + by) / 2) + ', ' + bx + ' ' + by, fill: 'none', stroke: b.accent, 'stroke-width': 2.2, opacity: .5 }); svg.appendChild(bp);
      branches.push({ el: bp, color: b.accent, fireColor: FIRE[k % FIRE.length] });
      var st = mk('circle', { cx: bx, cy: by, r: 8, fill: '#0b0a10', stroke: b.accent, 'stroke-width': 2.6, cursor: 'pointer' }); st.dataset.slug = b.slug; svg.appendChild(st);
      var lab = mk('text', { x: bx, y: by + (up < 0 ? -15 : 23), fill: '#cfcfe0', 'font-size': 11.5, 'font-family': 'Geist Mono, monospace', 'text-anchor': 'middle', cursor: 'pointer' }); lab.dataset.slug = b.slug; lab.textContent = short(b.title); svg.appendChild(lab);
    });
    ROLES.forEach(function (r) {
      var x = rx(r.i);
      svg.appendChild(mk('rect', { x: x - 82, y: ly + 29, width: 164, height: 38, rx: 8, fill: '#08080d', opacity: .82, 'pointer-events': 'none' }));
      var ring = mk('circle', { cx: x, cy: ly, r: 13, fill: '#0b0a10', stroke: r.color, 'stroke-width': 3, cursor: 'pointer' }); ring.dataset.role = r.i; svg.appendChild(ring);
      svg.appendChild(mk('circle', { cx: x, cy: ly, r: 5, fill: r.color, 'pointer-events': 'none' }));
      var t1 = mk('text', { x: x, y: ly + 40, fill: '#f2f2f7', 'font-size': 14, 'font-family': 'Space Grotesk, sans-serif', 'font-weight': 600, 'text-anchor': 'middle', cursor: 'pointer' }); t1.dataset.role = r.i; t1.textContent = r.org; svg.appendChild(t1);
      var t2 = mk('text', { x: x, y: ly + 58, fill: '#7a7a90', 'font-size': 11, 'font-family': 'Geist Mono, monospace', 'text-anchor': 'middle', 'pointer-events': 'none' }); t2.textContent = r.num + ' · ' + r.yr; svg.appendChild(t2);
    });
    var stop = trainAnim(svg, mainLine, branches);
    function showRole(r) { panel.innerHTML = rolePanelHTML(r, true); panel.querySelectorAll('[data-go]').forEach(function (btn) { btn.onclick = function () { sel(btn.dataset.go, 'build'); }; }); }
    function showBuild(b) { panel.innerHTML = buildPanelHTML(b); var lb = panel.querySelector('[data-launch]'); if (lb) lb.onclick = function () { live.open(b); }; panel.querySelectorAll('[data-role2]').forEach(function (btn) { btn.onclick = function () { sel(+btn.dataset.role2, 'role'); }; }); }
    function sel(id, type) {
      svg.querySelectorAll('[data-role]').forEach(function (n) { n.setAttribute('r', 13); });
      svg.querySelectorAll('circle[data-slug]').forEach(function (n) { n.setAttribute('r', 8); });
      if (type === 'role') { var n = svg.querySelector('circle[data-role="' + id + '"]'); if (n) n.setAttribute('r', 17); showRole(ROLES[id]); }
      else { var m = svg.querySelector('circle[data-slug="' + id + '"]'); if (m) m.setAttribute('r', 11); showBuild(bySlug(id)); }
    }
    svg.querySelectorAll('[data-role]').forEach(function (n) { n.addEventListener('mouseenter', function () { sel(+n.dataset.role, 'role'); }); n.addEventListener('click', function () { sel(+n.dataset.role, 'role'); }); });
    svg.querySelectorAll('[data-slug]').forEach(function (n) { n.addEventListener('mouseenter', function () { sel(n.dataset.slug, 'build'); }); n.addEventListener('click', function () { sel(n.dataset.slug, 'build'); }); });
    sel(4, 'role');   // default: Independent
    return stop;
  }

  /* ============ MOBILE — same map, vertical; tap → bottom sheet ============ */
  function makeMobile(root, live) {
    var VW = 372, H = 1400, lx = 168, y0 = 124, y1 = H - 120, ry = function (i) { return y0 + (y1 - y0) * (i / 4); };
    root.innerHTML = '<div style="background:#08080d;border:1px solid rgba(230,230,255,.1);border-radius:14px;overflow:hidden;padding:6px 0;"><svg id="tmm-svg" viewBox="0 0 ' + VW + ' ' + H + '" role="img" aria-label="Career line with builds branching off" style="width:100%;height:auto;display:block;"></svg></div>';
    var svg = root.querySelector('#tmm-svg');
    var mainLine = mk('path', { d: 'M ' + lx + ' ' + y0 + ' L ' + lx + ' ' + y1, fill: 'none', stroke: '#7c6cff', 'stroke-width': 6, 'stroke-linecap': 'round', opacity: .5 }); svg.appendChild(mainLine);
    var branches = [];
    BUILDS.forEach(function (b, k) {
      var pr = b.from[b.from.length - 1], sy = ry(pr), right = k % 2 === 0, by = y0 + (y1 - y0) * ((k + 0.5) / BUILDS.length), bx = right ? (lx + 66) : (lx - 66);
      var bp = mk('path', { d: 'M ' + lx + ' ' + sy + ' C ' + ((lx + bx) / 2) + ' ' + sy + ', ' + ((lx + bx) / 2) + ' ' + by + ', ' + bx + ' ' + by, fill: 'none', stroke: b.accent, 'stroke-width': 2.2, opacity: .5 }); svg.appendChild(bp);
      branches.push({ el: bp, color: b.accent, fireColor: FIRE[k % FIRE.length] });
      var st = mk('circle', { cx: bx, cy: by, r: 8, fill: '#0b0a10', stroke: b.accent, 'stroke-width': 2.6, cursor: 'pointer' }); st.dataset.slug = b.slug; svg.appendChild(st);
      var lab = mk('text', { x: right ? bx + 14 : bx - 14, y: by + 4, fill: '#cfcfe0', 'font-size': 12, 'font-family': 'Geist Mono, monospace', 'text-anchor': right ? 'start' : 'end', cursor: 'pointer' }); lab.dataset.slug = b.slug; lab.textContent = shortM(b.title); svg.appendChild(lab);
      var lab2 = mk('text', { x: right ? bx + 14 : bx - 14, y: by + 20, fill: b.accent, 'font-size': 10, 'font-family': 'Geist Mono, monospace', 'text-anchor': right ? 'start' : 'end', cursor: 'pointer' }); lab2.dataset.slug = b.slug; lab2.textContent = '▶ open'; svg.appendChild(lab2);
    });
    ROLES.forEach(function (r) {
      var y = ry(r.i);
      svg.appendChild(mk('rect', { x: lx - 76, y: y - 43, width: 152, height: 23, rx: 7, fill: '#08080d', opacity: .86, 'pointer-events': 'none' }));
      svg.appendChild(mk('rect', { x: lx - 58, y: y + 22, width: 116, height: 23, rx: 7, fill: '#08080d', opacity: .86, 'pointer-events': 'none' }));
      svg.appendChild(mk('rect', { x: lx - 24, y: y - 18, width: 48, height: 36, rx: 9, fill: '#08080d', 'pointer-events': 'none' }));
      var ring = mk('circle', { cx: lx, cy: y, r: 14, fill: '#0b0a10', stroke: r.color, 'stroke-width': 3, cursor: 'pointer' }); ring.dataset.role = r.i; svg.appendChild(ring);
      svg.appendChild(mk('circle', { cx: lx, cy: y, r: 5.5, fill: r.color, 'pointer-events': 'none' }));
      var t1 = mk('text', { x: lx, y: y - 26, fill: '#f2f2f7', 'font-size': 15, 'font-family': 'Space Grotesk, sans-serif', 'font-weight': 700, 'text-anchor': 'middle', cursor: 'pointer' }); t1.dataset.role = r.i; t1.textContent = r.org; svg.appendChild(t1);
      var t2 = mk('text', { x: lx, y: y + 34, fill: '#7a7a90', 'font-size': 10.5, 'font-family': 'Geist Mono, monospace', 'text-anchor': 'middle', 'pointer-events': 'none' }); t2.textContent = r.num + ' · ' + r.yr; svg.appendChild(t2);
    });
    var stop = trainAnim(svg, mainLine, branches);
    // bottom sheet, fixed to the viewport
    var sheet = document.getElementById('tmm-sheet');
    if (!sheet) { sheet = el('div', 'position:fixed;left:0;right:0;bottom:0;z-index:9001;background:#0b0a10;border-top:1px solid rgba(230,230,255,.14);border-radius:20px 20px 0 0;box-shadow:0 -20px 50px -20px #000;padding:8px 20px 26px;max-height:74vh;overflow:auto;transform:translateY(105%);transition:transform .4s cubic-bezier(.16,1,.3,1);'); sheet.id = 'tmm-sheet'; document.body.appendChild(sheet); }
    function closeSheet() { sheet.style.transform = 'translateY(105%)'; }
    function openSheet(html) {
      sheet.innerHTML = '<div style="width:42px;height:4px;border-radius:3px;background:#3a3942;margin:6px auto 14px;"></div><button data-close type="button" aria-label="Close" style="position:absolute;top:14px;right:18px;cursor:pointer;font-family:\'Geist Mono\',monospace;font-size:11px;color:#9a9aae;background:transparent;border:1px solid rgba(230,230,255,.18);border-radius:7px;padding:5px 9px;">✕</button>' + html;
      sheet.style.transform = 'translateY(0)';
      sheet.querySelector('[data-close]').onclick = closeSheet;
      var lb = sheet.querySelector('[data-launch]'); if (lb) lb.onclick = function () { closeSheet(); live.open(bySlug(lb.dataset.launch)); };
      sheet.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { selM(b.dataset.go, 'build'); }; });
      sheet.querySelectorAll('[data-role2]').forEach(function (b) { b.onclick = function () { selM(+b.dataset.role2, 'role'); }; });
    }
    function selM(id, type) {
      svg.querySelectorAll('[data-role]').forEach(function (n) { n.setAttribute('r', 14); });
      svg.querySelectorAll('circle[data-slug]').forEach(function (n) { n.setAttribute('r', 8); });
      if (type === 'role') { var n = svg.querySelector('circle[data-role="' + id + '"]'); if (n) n.setAttribute('r', 18); openSheet(rolePanelHTML(ROLES[id], true)); }
      else { var m = svg.querySelector('circle[data-slug="' + id + '"]'); if (m) m.setAttribute('r', 11); openSheet(buildPanelHTML(bySlug(id))); }
    }
    svg.querySelectorAll('[data-role]').forEach(function (n) { n.addEventListener('click', function () { selM(+n.dataset.role, 'role'); }); });
    svg.querySelectorAll('[data-slug]').forEach(function (n) { n.addEventListener('click', function () { selM(n.dataset.slug, 'build'); }); });
    return function () { stop(); if (sheet && sheet.parentNode) sheet.parentNode.removeChild(sheet); };
  }

  /* ---------- one responsive component: switch renderers at the 880px breakpoint ---------- */
  function initTransitMap() {
    var root = document.getElementById('tmRoot'); if (!root || root.__tm) return; root.__tm = true;
    var live = setupLiveDock();
    var mq = window.matchMedia('(min-width: 880px)');
    var mode = null, stopAnim = null;
    function render() {
      var want = mq.matches ? 'desk' : 'mob';
      if (want === mode) return; mode = want;
      if (stopAnim) { stopAnim(); stopAnim = null; }
      root.innerHTML = '';
      stopAnim = (want === 'desk') ? makeDesktop(root, live) : makeMobile(root, live);
    }
    render();
    if (mq.addEventListener) mq.addEventListener('change', render); else if (mq.addListener) mq.addListener(render);
  }
  window.initTransitMap = initTransitMap;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTransitMap); else initTransitMap();
})();
