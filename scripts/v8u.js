/* =============================================================================
   V8u — "Orbital Carousel"
   Ported 1:1 from the Claude Design project "Personal website redesign"
   (Redesigns.dc.html → build_7_20 + cosmosWebGPU, Card-deck family, accent #e878f5).

   A 3D cylindrical card carousel (16 cards: 5 roles + 10 builds + contact) floating
   inside a live cosmos — WGSL raymarch on WebGPU when available, full Canvas-2D
   fallback otherwise. Pointer tilt, hover lift, drag/swipe + horizontal-wheel rotate,
   click → shared detail modal, decelerating intro spin.

   Deliberate adaptations for this live, scrolling portfolio page (not the full-screen
   design-canvas stage it was authored in):
     • Self-contained class carrying only the dc-framework helpers it needs; self-mounts
       into #v8uStage. No build step, no framework.
     • NO vertical scroll-jacking. In the canvas a vertical scroll "domino-collapsed" the
       deck and advanced to the next design variant (switchTo) — there is no next variant
       here, so that hand-off is removed and vertical wheel/touch scrolls the page normally.
       Rotation = horizontal swipe / drag / wheel-x + the ← → buttons.
     • Mobile/perf: 2D galaxy star-count scales down under 700px; all rAF loops pause when
       the section is scrolled out of view (IntersectionObserver). The WebGPU path, when it
       wins, hides the 2D canvas (whose loop then no-ops via its 0-size guard).
     • Motion is always on (site-wide product decision); reduced-motion is intentionally
       not gated, matching the rest of the site.
   ============================================================================= */
(function () {
  'use strict';

  class V8U {
    constructor() { this.cleanup = []; this.props = {}; }

    /* ---- core element helpers (verbatim) ---- */
    h(t, s, p) { const e = document.createElement(t); if (s) e.style.cssText = s; if (p) for (const k in p) { const v = p[k]; if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v; else if (k === 'class') e.className = v; else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v); else if (v != null) e.setAttribute(k, v); } return e; }
    add(p) { for (let i = 1; i < arguments.length; i++) { const k = arguments[i]; if (k) p.appendChild(k); } return p; }
    esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    hexRgb(hex) { const n = hex.replace('#', ''); const v = n.length === 3 ? n.split('').map(c => c + c).join('') : n; return [parseInt(v.substr(0, 2), 16), parseInt(v.substr(2, 2), 16), parseInt(v.substr(4, 2), 16)].join(','); }
    get F() { return { mono: "'Geist Mono',ui-monospace,monospace", sans: "'Geist',ui-sans-serif,system-ui,sans-serif", disp: "'Space Grotesk',ui-sans-serif,sans-serif", term: "'JetBrains Mono',ui-monospace,monospace", bric: "'Bricolage Grotesque',sans-serif" }; }
    mailto(su, bo) { window.location.href = 'mailto:' + this.CT.email + '?subject=' + encodeURIComponent(su || '') + (bo ? '&body=' + encodeURIComponent(bo) : ''); }

    /* ---- data (verbatim from the canvas) ---- */
    get CT() { return { name: 'Philip Toulinov', email: 'toulinov.philip@yahoo.com', phone: '+1 (415) 823-7537', phoneHref: '+14158237537', linkedin: 'in/ptoulinov', linkedinUrl: 'https://www.linkedin.com/in/ptoulinov', langs: 'English · Français · Русский', blurb: 'Open to release-engineering, DevOps and SRE roles. The fastest way to reach me is email.', loc: 'San Francisco Bay Area · PT' }; }
    get XP() {
      return [
        { num: '01', org: 'Education', role: 'B.S. Computer Science', sub: 'Humboldt State University', period: '2021', meta: 'EN · FR · Русский', color: '#7c6cff',
          bullets: ['Computer Science degree — the foundation everything else compiles from.', 'Schooled in French at Lycée Français La Pérouse — fully bilingual English / Français.'],
          stack: ['Python', 'Java', 'JavaScript', 'C++', 'SQL'] },
        { num: '02', org: 'Catalina USA', role: 'Software Engineer Intern', sub: 'Remote', period: 'Jun — Sep 2020', meta: 'Internship', color: '#5ec8ff',
          bullets: ['Built integration, acceptance & regression tests in Selenium WebDriver.', 'Set up & troubleshot Continuous Delivery builds in Jenkins, wired into JIRA.', 'Containerized build environments with Docker for a clean, pinned toolchain.'],
          stack: ['Selenium', 'Jenkins', 'Docker', 'Jira'] },
        { num: '03', org: 'Tech Mahindra', role: 'Software & Device Engineer', sub: 'On-site', period: 'Sep — Dec 2021', meta: 'Full-time', color: '#e878f5', metric: { value: '−25%', label: 'manual rig setup time' },
          bullets: ['Led LTE / 5G NR protocol & RF RRM conformance on Keysight E7515B and Anritsu MD8430A.', 'Scripted automated test rigs (R&S CMW500, Keysight Nemo) — cut manual setup 25%.', 'Debugged firmware on Qualcomm Snapdragon with RTOS tooling & Lauterbach Trace32.'],
          stack: ['Git', 'Jira', 'Python', 'C', 'RTOS'] },
        { num: '04', org: 'LendingClub', role: 'Release Engineer', sub: 'Hybrid', period: 'Dec 2021 — Jan 2024', meta: 'Full-time', color: '#f5b642', metric: { value: '−30%', label: 'deployment time' },
          bullets: ['Designed & ran CI/CD pipelines that cut deployment time 30% and tightened the whole dev loop.', 'Added Mabl end-to-end tests as a release gate — regressions caught before deploy, not in prod.', 'Maintained the internal GitHub platform; built monitoring & incident-response automation.'],
          stack: ['Jenkins', 'GitHub Actions', 'Kubernetes', 'Mabl', 'Docker'] },
        { num: '05', org: 'Independent', role: 'Independent Engineer & Builder', sub: 'SF Bay Area · remote / hybrid', period: '2024 — present', meta: 'Open to work', color: '#5ee6c0', current: true,
          bullets: ['Designing, shipping & operating my own products end to end.', 'Across trading automation, real-time data, fintech & AI-infra monitoring — built solo.', 'Open to release-engineering, DevOps & SRE roles. On-call for the right team.'],
          stack: ['Python', 'Docker', 'AWS', 'React', 'Postgres'] }];
    }
    get BUILDS() {
      return [
        { n: '01', t: 'Anatoly Sokoloff: A Visual Journey', cat: 'Creative web app · PWA gallery', tag: 'A data-driven artist gallery with an AI cinemagraph pipeline.', pills: ['React', 'PWA', 'Supabase', 'Python', 'Kling'], facts: [['150+', 'works'], ['4', 'series'], ['30', 'cinemagraphs']], addr: 'anatoly-sokoloff · a visual journey', dom: 'gallery', a: '#7c6cff' },
        { n: '02', t: 'Freqtrade · Hyperliquid', cat: 'Algorithmic trading · Dockerized bot', tag: 'A Dockerized crypto trading bot on the Hyperliquid DEX.', pills: ['Python', 'freqtrade', 'pandas', 'CCXT', 'Docker'], facts: [['FreqUI', 'REST/WS'], ['dry-run', 'paper'], ['26', 'trades']], addr: '127.0.0.1:8080 — frequi', dom: 'fintech', a: '#5ee6c0' },
        { n: '03', t: 'STAKE·ODDS — Live Odds Tracker', cat: 'Real-time data · dual-feed odds engine', tag: 'A dual-feed live sports-odds tracking & movement engine.', pills: ['Node.js', 'CDP', 'GraphQL', 'JSONL'], facts: [['2', 'feeds'], ['live', 'movement'], ['CDP', 'driven']], addr: 'localhost — stake·odds', dom: 'real-time', a: '#3fe0d0' },
        { n: '04', t: 'Loansy', cat: 'Fintech ops · Telegram bot + Flask console', tag: 'A Telegram P2P crypto-lending bot with a 60-view Flask ops console.', pills: ['Python', 'Flask', 'MongoDB', 'Redis', 'TON', 'Solana'], facts: [['60', 'admin views'], ['2', 'chains'], ['248', 'active loans']], addr: 'loansy-admin · flask ops', dom: 'fintech', a: '#f5b642' },
        { n: '05', t: 'ClaudeDown', cat: 'Monitoring · status page', tag: 'A real-time availability monitor for AI infrastructure.', pills: ['Node.js', 'node:http', 'PostgreSQL', 'Redis', 'Playwright'], facts: [['11', 'providers'], ['live', 'latency'], ['99.90%', 'uptime']], addr: 'claudedown — infra monitor', dom: 'monitoring', a: '#5ec8ff' },
        { n: '06', t: 'Flex Lane Fare Console', cat: 'Civic data · express-lane pricing', tag: 'What every Bay Area express lane costs — live, with honest fallbacks.', pills: ['TypeScript', 'React 18', 'Vite', 'Express', '511 API'], facts: [['honest', 'fallbacks'], ['live', 'pricing'], ['MapLibre', 'map']], addr: 'flex-lane · bay area', dom: 'civic', a: '#e878f5' },
        { n: '07', t: 'The Renovation Watchlist', cat: 'Civic data · DataSF + MapLibre', tag: 'The earliest public signal of renovation-driven displacement in SF — ranked.', pills: ['Python', 'DataSF', 'MapLibre GL', 'GSAP', 'No build'], facts: [['985', 'flagged'], ['1,449', 'violations'], ['34', 'neighborhoods']], addr: 'renovation-watchlist · datasf', dom: 'civic', a: '#7c6cff' },
        { n: '08', t: 'The Urban Forest', cat: 'Civic data · DataSF + deck.gl map', tag: 'An art-directed botanical map of every street tree SF keeps a record of.', pills: ['Python', 'DataSF', 'deck.gl', 'No build'], facts: [['198,435', 'trees'], ['586', 'species'], ['195K', 'mapped']], addr: 'the-urban-forest · datasf', dom: 'civic', a: '#5ee6c0', isNew: true },
        { n: '09', t: 'Hidden SF', cat: 'Civic data · DataSF + MapLibre field guide', tag: "A field guide to San Francisco's 81 privately-owned public open spaces.", pills: ['Python', 'DataSF', 'MapLibre GL', 'No build'], facts: [['81', 'POPOS'], ['§138', 'planning'], ['1959', 'since']], addr: 'hidden-sf · popos guide', dom: 'civic', a: '#5ec8ff', isNew: true },
        { n: '10', t: 'SF on Screen', cat: 'Civic data · SF Film Commission + MapLibre', tag: 'A century of film & television shot on location in San Francisco.', pills: ['Python', 'Film locations', 'MapLibre GL', 'No build'], facts: [['2,118', 'locations'], ['295', 'productions'], ['1915–25', 'span']], addr: 'sf-on-screen · film', dom: 'civic', a: '#f5b642', isNew: true }];
    }

    /* ---- shared visual helpers (verbatim) ---- */
    pillRow(arr, c) { const F = this.F; const w = this.h('div', 'display:flex;flex-wrap:wrap;gap:7px;margin-top:8px;'); arr.forEach(p => w.appendChild(this.h('span', 'font-family:' + F.term + ';font-size:11px;color:#b8b4c8;border:1px solid rgba(230,230,255,.14);border-radius:6px;padding:4px 9px;', { text: p }))); return w; }
    glass(extra) { return 'background:rgba(20,19,28,.55);backdrop-filter:blur(22px) saturate(1.4);-webkit-backdrop-filter:blur(22px) saturate(1.4);border:1px solid rgba(255,255,255,.1);box-shadow:0 1px 0 rgba(255,255,255,.08) inset,0 30px 70px -30px rgba(0,0,0,.8);' + (extra || ''); }

    fitCanvas(cvs) { const ctx = cvs.getContext('2d'); const set = () => { const r = Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.5 : 2); const w = cvs.clientWidth || cvs.parentNode.clientWidth, h = cvs.clientHeight || cvs.parentNode.clientHeight; if (w && h) { cvs.width = w * r; cvs.height = h * r; ctx.setTransform(r, 0, 0, r, 0, 0); } }; set(); let tries = 0; const iv = setInterval(() => { const r = Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.5 : 2); const wn = Math.round((cvs.clientWidth || (cvs.parentNode ? cvs.parentNode.clientWidth : 0) || 0) * r); if (wn > 0 && cvs.width !== wn) set(); if (++tries > 60) clearInterval(iv); }, 90); let ro; try { ro = new ResizeObserver(() => set()); ro.observe(cvs); } catch (e) {} window.addEventListener('resize', set); this.cleanup.push(() => { clearInterval(iv); window.removeEventListener('resize', set); if (ro) ro.disconnect(); }); return ctx; }

    tilt3d(el, opts) { opts = opts || {}; const max = opts.max || 12; el.style.transformStyle = 'preserve-3d'; el.style.transition = 'transform .18s cubic-bezier(.16,1,.3,1)'; let glare = null; if (opts.glare) { glare = this.h('div', 'position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;transition:opacity .2s;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.28),transparent 60%);mix-blend-mode:overlay;'); el.appendChild(glare); }
      const move = e => { const r = el.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height; el.style.transform = 'perspective(900px) rotateY(' + ((px - .5) * max * 2) + 'deg) rotateX(' + ((.5 - py) * max * 2) + 'deg) translateZ(0)'; if (glare) { glare.style.opacity = '1'; glare.style.background = 'radial-gradient(circle at ' + (px * 100) + '% ' + (py * 100) + '%,rgba(255,255,255,.3),transparent 55%)'; } };
      const leave = () => { el.style.transform = 'perspective(900px) rotateY(0) rotateX(0)'; if (glare) glare.style.opacity = '0'; };
      el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave); }

    loop(fn) { let raf, alive = true; if (this._lowFps == null) this._lowFps = matchMedia('(pointer:coarse)').matches; const cap = this._lowFps; let last = 0; const tick = t => { if (!alive) return; if (cap && t - last < 32) { raf = requestAnimationFrame(tick); return; } last = t; if (this._fc) { for (let i = 0; i < this._fc.length; i++) this._fc[i](); } fn(t); raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); this.cleanup.push(() => { alive = false; cancelAnimationFrame(raf); }); return () => { alive = false; cancelAnimationFrame(raf); }; }

    particleField(host, a, opts) { opts = opts || {}; const cvs = this.h('canvas', 'position:absolute;inset:0;width:100%;height:100%;display:block;'); host.appendChild(cvs); const ctx = this.fitCanvas(cvs); const N = opts.count || 70; const pts = []; const rgb = this.hexRgb(a);
      for (let i = 0; i < N; i++) pts.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - .5) * 0.0006, vy: (Math.random() - .5) * 0.0006, r: Math.random() * 1.6 + .4 });
      const mouse = { x: .5, y: .5, on: false }; host.addEventListener('pointermove', e => { const r = host.getBoundingClientRect(); mouse.x = (e.clientX - r.left) / r.width; mouse.y = (e.clientY - r.top) / r.height; mouse.on = true; }); host.addEventListener('pointerleave', () => mouse.on = false);
      this.loop(() => { const w = cvs.clientWidth, h = cvs.clientHeight; if (!w || !h || (opts.isView && !opts.isView())) return; ctx.clearRect(0, 0, w, h); pts.forEach(p => { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > 1) p.vx *= -1; if (p.y < 0 || p.y > 1) p.vy *= -1; if (mouse.on) { const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy); if (d < 0.16) { p.x += dx / d * 0.0014; p.y += dy / d * 0.0014; } } });
        for (let i = 0; i < N; i++) { for (let j = i + 1; j < N; j++) { const a1 = pts[i], b1 = pts[j]; const dx = (a1.x - b1.x) * w, dy = (a1.y - b1.y) * h, d = Math.hypot(dx, dy); if (d < 120) { ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.14 * (1 - d / 120)) + ')'; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(a1.x * w, a1.y * h); ctx.lineTo(b1.x * w, b1.y * h); ctx.stroke(); } } }
        pts.forEach(p => { ctx.fillStyle = 'rgba(' + rgb + ',.7)'; ctx.beginPath(); ctx.arc(p.x * w, p.y * h, p.r, 0, 6.28); ctx.fill(); }); }); return cvs; }

    /* ---- mini card face (verbatim) ---- */
    miniCard(item, a) {
      const F = this.F, self = this; const c = this.h('div', 'border-radius:16px;border:1px solid rgba(230,230,255,.12);background:linear-gradient(180deg,#16151f,#0e0d15);box-shadow:0 30px 70px -28px rgba(0,0,0,.8);padding:24px;display:flex;flex-direction:column;overflow:hidden;height:100%;');
      if (item.k === 'xp') { const x = item.d; c.style.borderTop = '3px solid ' + x.color;
        this.add(c, this.h('div', 'font-family:' + F.disp + ';font-weight:800;font-size:54px;line-height:1;color:transparent;-webkit-text-stroke:1.4px ' + x.color + '77;', { text: x.num }), this.h('div', 'font-family:' + F.mono + ';font-size:10.5px;color:' + x.color + ';margin:12px 0 5px;', { text: x.period + ' · ' + x.sub }), this.h('div', 'font-family:' + F.disp + ';font-weight:700;font-size:20px;color:#fff;line-height:1.1;', { text: x.role }), this.h('div', 'font-family:' + F.sans + ';font-size:13px;color:#9a9aae;margin-bottom:12px;', { text: x.org }));
        x.bullets.slice(0, 2).forEach(b => c.appendChild(this.h('p', 'font-family:' + F.sans + ';font-size:12.5px;line-height:1.5;color:#c8c8d4;margin:0 0 7px;padding-left:13px;position:relative;', { html: '<span style="position:absolute;left:0;top:7px;width:5px;height:5px;border-radius:50%;background:' + x.color + '"></span>' + self.esc(b) })));
        const sp = this.h('div', 'margin-top:auto;display:flex;flex-wrap:wrap;gap:5px;'); x.stack.slice(0, 4).forEach(s => sp.appendChild(this.h('span', 'font-family:' + F.mono + ';font-size:10px;color:#b8b4c8;border:1px solid rgba(230,230,255,.14);border-radius:5px;padding:2px 7px;', { text: s }))); c.appendChild(sp);
      } else if (item.k === 'build') { const b = item.d; c.style.borderTop = '3px solid ' + b.a;
        this.add(c, this.h('div', 'font-family:' + F.mono + ';font-size:10.5px;color:' + b.a + ';', { html: 'BUILD ' + b.n + (b.isNew ? ' · <span style="color:#5ee6c0">NEW</span>' : '') }), this.h('div', 'font-family:' + F.disp + ';font-weight:700;font-size:20px;color:#fff;line-height:1.12;margin:9px 0 7px;', { text: b.t }), this.h('p', 'font-family:' + F.sans + ';font-size:13px;line-height:1.5;color:#c8c8d4;margin:0 0 12px;', { text: b.tag }));
        const ff = this.h('div', 'display:flex;gap:16px;flex-wrap:wrap;margin-top:auto;'); b.facts.forEach(f => ff.appendChild(this.h('div', '', { html: '<div style="font-family:' + F.disp + ';font-weight:700;font-size:19px;color:#fff">' + f[0] + '</div><div style="font-family:' + F.mono + ';font-size:9px;color:#7a7a90">' + f[1] + '</div>' }))); c.appendChild(ff);
      } else { const C = self.CT; c.style.borderTop = '3px solid ' + a; c.style.justifyContent = 'center'; c.style.textAlign = 'center';
        this.add(c, this.h('div', 'font-family:' + F.mono + ';font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:' + a + ';margin-bottom:10px;', { text: 'contact' }), this.h('div', 'font-family:' + F.disp + ';font-weight:700;font-size:24px;color:#fff;line-height:1.05;margin-bottom:14px;', { text: "Let's ship your next release." }), this.h('div', 'font-family:' + F.mono + ';font-size:13px;color:#c8c8d4;', { text: C.email }));
        // visual-only pill (not a <button>): the card itself is the interactive control and opens the
        // contact modal, which carries the real email link + "Compose a message" button. Avoids an
        // invalid/inaccessible button-inside-button (axe: nested-interactive).
        c.appendChild(this.h('span', 'align-self:center;margin-top:16px;font-family:' + F.mono + ';font-size:12px;color:#06060a;background:' + a + ';border-radius:8px;padding:9px 18px;font-weight:600;', { text: '✉ Email' }));
      }
      return c;
    }
    deckItems() { const it = []; this.XP.forEach(x => it.push({ k: 'xp', d: x, color: x.color })); this.BUILDS.forEach(b => it.push({ k: 'build', d: b, color: b.a })); it.push({ k: 'contact', color: '#f5b642' }); return it; }
    openItem(item, a) { if (item.k === 'xp') this.openModal(p => this.detailXP(p, item.d, a), a); else if (item.k === 'build') this.openModal(p => this.detailBuild(p, item.d, a), a); else this.openModal(p => this.detailContact(p, a), a); }

    /* ---- shared detail renderers (verbatim) ---- */
    detailXP(host, x, a) { const F = this.F; host.innerHTML = ''; this.add(host,
      this.h('div', 'font-family:' + F.mono + ';font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:' + x.color + ';margin-bottom:10px;', { text: x.period + ' · ' + x.sub }),
      this.h('div', 'font-family:' + F.disp + ';font-weight:700;font-size:clamp(22px,2.6vw,30px);color:#fff;line-height:1.05;margin-bottom:4px;', { text: x.role }),
      this.h('div', 'font-family:' + F.sans + ';font-size:15px;color:#9a9aae;margin-bottom:18px;', { text: x.org }));
      x.bullets.forEach(b => host.appendChild(this.h('p', 'margin:0 0 11px;padding-left:18px;position:relative;font-size:14px;line-height:1.55;color:#c8c8d4;', { html: '<span style="position:absolute;left:0;top:8px;width:6px;height:6px;border-radius:50%;background:' + x.color + '"></span>' + this.esc(b) })));
      if (x.metric) host.appendChild(this.h('div', 'margin:16px 0;', { html: '<span style="font-family:' + F.disp + ';font-size:38px;font-weight:700;color:' + x.color + '">' + x.metric.value + '</span> <span style="font-family:' + F.mono + ';font-size:12px;color:#7a7a90">' + x.metric.label + '</span>' }));
      host.appendChild(this.pillRow(x.stack, x.color));
    }
    detailBuild(host, b, a) { const F = this.F, self = this; host.innerHTML = '';
      const wrap = this.h('div', 'position:relative;overflow:hidden;');
      wrap.appendChild(this.h('div', 'position:absolute;top:-18px;right:-6px;font-family:' + F.disp + ';font-weight:800;font-size:120px;line-height:.8;color:transparent;-webkit-text-stroke:1.5px ' + b.a + '2e;pointer-events:none;user-select:none;', { text: b.n }));
      wrap.appendChild(this.h('div', 'position:relative;font-family:' + F.mono + ';font-size:10.5px;letter-spacing:.14em;color:' + b.a + ';margin-bottom:14px;', { html: (b.isNew ? '<span style="color:#5ee6c0">●&nbsp;</span>' : '') + '┌─ BUILD_' + b.n + '.manifest' }));
      wrap.appendChild(this.h('div', 'position:relative;font-family:' + F.disp + ';font-weight:700;font-size:clamp(21px,2.6vw,30px);color:#fff;line-height:1.05;margin:0 0 4px;max-width:18ch;', { text: b.t }));
      wrap.appendChild(this.h('div', 'position:relative;font-family:' + F.mono + ';font-size:11.5px;color:#7a7a90;margin-bottom:16px;', { text: '// ' + b.cat }));
      const spec = this.h('div', 'position:relative;border-left:2px solid ' + b.a + '55;padding-left:14px;margin:0 0 16px;display:flex;flex-direction:column;gap:7px;');
      const rows = [['desc', b.tag], ['domain', b.dom], ...b.facts.map(f => [String(f[1]).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 12), f[0]]), ['addr', b.addr]];
      rows.forEach(r => { const row = self.h('div', 'display:grid;grid-template-columns:88px 1fr;gap:12px;align-items:baseline;'); self.add(row, self.h('span', 'font-family:' + F.mono + ';font-size:11px;color:#5a5a68;white-space:nowrap;', { text: r[0] }), self.h('span', 'font-family:' + (typeof r[1] === 'string' && r[1].length > 24 ? F.sans : F.mono) + ';font-size:13px;color:#e8e6ef;line-height:1.45;', { html: '<span style="color:' + b.a + '">"</span>' + self.esc(r[1]) + '<span style="color:' + b.a + '">"</span>' })); spec.appendChild(row); });
      wrap.appendChild(spec);
      const deps = this.h('div', 'position:relative;font-family:' + F.mono + ';font-size:12px;color:#7a7a90;line-height:1.9;');
      deps.innerHTML = 'deps: [ ' + b.pills.map(p => '<span style="color:#b8b4c8;background:rgba(230,230,255,.05);border:1px solid ' + b.a + '33;border-radius:4px;padding:1px 7px;margin:0 1px">' + self.esc(p) + '</span>').join(' ') + ' ]';
      wrap.appendChild(deps);
      wrap.appendChild(this.h('div', 'position:relative;font-family:' + F.mono + ';font-size:10.5px;letter-spacing:.14em;color:' + b.a + ';margin-top:12px;', { text: '└─ EOF' }));
      host.appendChild(wrap);
    }
    detailContact(host, a) { const F = this.F, C = this.CT; host.innerHTML = '';
      this.add(host, this.h('div', 'font-family:' + F.mono + ';font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:' + a + ';margin-bottom:10px;', { text: 'terminus · contact' }),
        this.h('div', 'font-family:' + F.disp + ';font-weight:700;font-size:clamp(22px,2.6vw,30px);color:#fff;margin-bottom:6px;', { text: "Let's ship your next release." }),
        this.h('p', 'font-size:14.5px;line-height:1.6;color:#9a9aae;margin:0 0 18px;max-width:42ch;', { text: C.blurb }));
      const rows = [['email', C.email, 'mailto:' + C.email], ['phone', C.phone, 'tel:' + C.phoneHref], ['linkedin', C.linkedin, C.linkedinUrl]];
      rows.forEach(r => { const row = this.h('a', 'display:flex;align-items:center;gap:14px;padding:13px 4px;border-bottom:1px solid rgba(230,230,255,.08);text-decoration:none;cursor:pointer;', { href: r[2] }); if (r[0] === 'linkedin') row.target = '_blank';
        this.add(row, this.h('span', 'font-family:' + F.mono + ';font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7a7a90;width:78px;flex:none;', { text: r[0] }), this.h('span', 'font-family:' + F.sans + ';font-size:clamp(16px,1.8vw,20px);font-weight:500;color:#f2f2f7;', { text: r[1] }), this.h('span', 'margin-left:auto;color:' + a + ';font-family:' + F.mono + ';font-size:12px;', { text: '↗' }));
        host.appendChild(row); });
      host.appendChild(this.h('div', 'font-family:' + F.mono + ';font-size:12px;color:#7a7a90;margin-top:14px;', { text: C.langs }));
      const btn = this.h('button', 'margin-top:18px;font-family:' + F.mono + ';font-size:13px;color:#06060a;background:' + a + ';border:none;border-radius:8px;padding:11px 20px;cursor:pointer;font-weight:600;', { text: '✉ Compose a message', onclick: () => this.mailto('Hello Philip', 'Hi Philip,\n\n') });
      host.appendChild(btn);
    }

    /* ---- reusable modal (verbatim) ---- */
    openModal(renderFn, accent) {
      const F = this.F, self = this;
      const ov = this.h('div', 'position:fixed;inset:0;z-index:200;display:grid;place-items:center;padding:clamp(14px,3vw,40px);');
      const bd = this.h('div', 'position:absolute;inset:0;background:rgba(6,5,9,.78);backdrop-filter:blur(7px);opacity:0;transition:opacity .25s;');
      const panel = this.h('div', 'position:relative;width:min(660px,96vw);max-height:90vh;overflow:auto;border:1px solid rgba(230,230,255,.14);border-radius:16px;background:linear-gradient(180deg,#14131c,#0c0b12);padding:clamp(24px,4vw,40px);box-shadow:0 50px 120px -30px rgba(0,0,0,.9);transform:scale(.96);opacity:0;transition:all .28s cubic-bezier(.16,1,.3,1);');
      const close = this.h('button', 'position:absolute;top:14px;right:16px;font-family:' + F.mono + ';font-size:12px;color:#9a9aae;border:1px solid rgba(230,230,255,.14);border-radius:7px;padding:5px 11px;cursor:pointer;z-index:2;', { text: 'esc ✕', 'aria-label': 'Close dialog' });
      const done = () => { bd.style.opacity = '0'; panel.style.opacity = '0'; panel.style.transform = 'scale(.96)'; setTimeout(() => ov.remove(), 240); document.removeEventListener('keydown', onkey); };
      const onkey = e => { if (e.key === 'Escape') done(); };
      bd.onclick = done; close.onclick = done; document.addEventListener('keydown', onkey);
      ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
      renderFn(panel); panel.appendChild(close); self.tilt3d(panel, { max: 6, glare: true });
      this.add(ov, bd, panel); document.body.appendChild(ov);
      requestAnimationFrame(() => { bd.style.opacity = '1'; panel.style.opacity = '1'; panel.style.transform = 'scale(1)'; });
      this.cleanup.push(() => ov.remove());
      return done;
    }

    /* ---- WebGPU / WGSL cosmos (verbatim, with off-screen pause via getState().paused) ---- */
    async cosmosWebGPU(canvas, getState) {
      if (!navigator.gpu) return false;
      let device, ctx, fmt;
      try {
        const adapter = await navigator.gpu.requestAdapter(); if (!adapter) return false;
        device = await adapter.requestDevice(); if (!device) return false;
        ctx = canvas.getContext('webgpu'); if (!ctx) return false;
        fmt = navigator.gpu.getPreferredCanvasFormat();
        ctx.configure({ device, format: fmt, alphaMode: 'premultiplied' });
      } catch (e) { return false; }
      const wgsl = `
struct U { res:vec2<f32>, time:f32, rot:f32, fade:f32, px:f32, py:f32, pad:f32 };
@group(0) @binding(0) var<uniform> u:U;
@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4<f32>{
  var p=array<vec2<f32>,3>(vec2<f32>(-1.0,-1.0),vec2<f32>(3.0,-1.0),vec2<f32>(-1.0,3.0));
  return vec4<f32>(p[i],0.0,1.0);
}
fn hash13(p:vec3<f32>)->f32{ return fract(sin(dot(p,vec3<f32>(127.1,311.7,74.7)))*43758.5453); }
fn noise3(p:vec3<f32>)->f32{
  let i=floor(p); let f=fract(p); let w=f*f*(3.0-2.0*f);
  let a=hash13(i+vec3<f32>(0.0,0.0,0.0)); let b=hash13(i+vec3<f32>(1.0,0.0,0.0));
  let c=hash13(i+vec3<f32>(0.0,1.0,0.0)); let d=hash13(i+vec3<f32>(1.0,1.0,0.0));
  let e=hash13(i+vec3<f32>(0.0,0.0,1.0)); let g=hash13(i+vec3<f32>(1.0,0.0,1.0));
  let h=hash13(i+vec3<f32>(0.0,1.0,1.0)); let k=hash13(i+vec3<f32>(1.0,1.0,1.0));
  let k0=mix(mix(a,b,w.x),mix(c,d,w.x),w.y); let k1=mix(mix(e,g,w.x),mix(h,k,w.x),w.y);
  return mix(k0,k1,w.z);
}
fn fbm(p:vec3<f32>)->f32{ var v=0.0; var a=0.5; var q=p; for(var i=0;i<5;i++){ v+=a*noise3(q); q*=2.03; a*=0.5; } return v; }
fn rotY(a:f32)->mat3x3<f32>{ let c=cos(a); let s=sin(a); return mat3x3<f32>(vec3<f32>(c,0.0,s),vec3<f32>(0.0,1.0,0.0),vec3<f32>(-s,0.0,c)); }
fn galaxy(rd:vec3<f32>)->vec3<f32>{
  let d=normalize(rd);
  var col=vec3<f32>(0.004,0.006,0.014);
  for(var L=0;L<3;L=L+1){ let sca=120.0+f32(L)*150.0; let g=floor(d.xy*sca); let hh=hash13(vec3<f32>(g,f32(L)*9.1)); let thr=0.972-f32(L)*0.006; if(hh>thr){ let tw=0.6+0.4*sin(u.time*2.0+hh*60.0); let b=pow((hh-thr)/(1.0-thr),4.0)*tw; let warm=hash13(vec3<f32>(g,2.0)); let sccol=mix(vec3<f32>(0.7,0.8,1.0),vec3<f32>(1.0,0.85,0.6),warm); col+=sccol*b*(1.2-f32(L)*0.3); } }
  let ca=cos(0.6); let sa=sin(0.6); let bx=d.x*ca+d.y*sa; let by=-d.x*sa+d.y*ca;
  let warp=fbm(vec3<f32>(bx*1.5,by*1.5,u.rot*0.08))*0.5;
  let byw=by+warp*0.15;
  let band=exp(-byw*byw*9.0);
  let n1=fbm(vec3<f32>(bx*2.5+u.rot*0.1,by*4.0+warp,1.3));
  let n2=fbm(vec3<f32>(bx*6.0-u.rot*0.06,by*10.0,4.7));
  let cloud=clamp(n1*1.3-0.15,0.0,1.0);
  let dust=smoothstep(0.45,0.75,n2);
  let core=exp(-bx*bx*1.6);
  let temp=mix(vec3<f32>(0.30,0.36,0.62),vec3<f32>(0.95,0.78,0.55),clamp(core+0.2,0.0,1.0));
  col+=temp*band*cloud*(1.0-dust*0.8)*0.9;
  col+=vec3<f32>(0.7,0.55,0.85)*band*core*0.35;
  col+=vec3<f32>(0.5,0.1,0.2)*band*smoothstep(0.4,0.9,n1)*(1.0-dust)*0.15;
  let au=clamp(d.y,0.0,1.0); let aw=sin(d.x*9.0+u.rot*2.0)*0.5+0.5;
  col+=vec3<f32>(0.2,0.85,0.55)*smoothstep(0.35,0.95,au)*aw*0.16;
  return col;
}
fn ringedPlanet(rd:vec3<f32>, ro:vec3<f32>, c:vec3<f32>, rad:f32, tint:vec3<f32>)->vec4<f32>{
  let oc=ro-c; let b=dot(oc,rd); let h=b*b-(dot(oc,oc)-rad*rad);
  if(h<0.0){ return vec4<f32>(0.0); }
  let t=-b-sqrt(h); if(t<0.0){ return vec4<f32>(0.0); }
  let p=ro+rd*t; let n=normalize(p-c);
  let band=sin(n.y*14.0+fbm(n*4.0)*3.0)*0.5+0.5;
  let blotch=fbm(n*6.0+vec3<f32>(u.rot*0.2,0.0,0.0));
  let surf=tint*mix(0.78,1.18,band)*mix(0.82,1.12,blotch);
  let lig=normalize(vec3<f32>(-0.6,0.5,-0.6));
  let dif=max(dot(n,lig),0.0)*0.9+0.1;
  let rim=pow(1.0-max(dot(n,-rd),0.0),3.0)*0.3;
  return vec4<f32>(surf*dif+tint*rim,t);
}
@fragment fn fs(@builtin(position) frag:vec4<f32>)->@location(0) vec4<f32>{
  let uv=(frag.xy*2.0-u.res)/u.res.y;
  let ro=vec3<f32>(0.0,0.0,-3.4);
  let rd=normalize(vec3<f32>(uv.x,-uv.y,1.6));
  var col=galaxy(rd);
  let f1=0.35+0.65*(sin(u.time*0.5)*0.5+0.5);
  let satC=vec3<f32>(cos(u.rot*0.4)*1.6,2.5,3.0);
  let satN=normalize(vec3<f32>(0.25,1.0,0.12));
  let dn=dot(rd,satN);
  if(abs(dn)>0.001){ let tpl=dot(satC-ro,satN)/dn; if(tpl>0.0){ let pp=ro+rd*tpl; let rr=length(pp-satC); if(rr>0.62 && rr<1.05){ let ringA=(1.0-smoothstep(0.96,1.05,rr))*smoothstep(0.62,0.72,rr); col=mix(col,vec3<f32>(0.82,0.74,0.56),ringA*0.8*f1); } } }
  let gp=ringedPlanet(rd,ro,satC,0.5,vec3<f32>(0.88,0.74,0.46));
  if(gp.w>0.0){ col=mix(col,gp.rgb,0.98*f1); }
  let f2=0.35+0.65*(sin(u.time*0.7+2.0)*0.5+0.5);
  let p2=ringedPlanet(rd,ro,vec3<f32>(sin(u.rot*0.7)*1.9,-2.5,2.6),0.30,vec3<f32>(0.82,0.34,0.2));
  if(p2.w>0.0){ col=mix(col,p2.rgb,0.98*f2); }
  let f3=0.35+0.65*(sin(u.time*0.9+4.0)*0.5+0.5);
  let p3=ringedPlanet(rd,ro,vec3<f32>(cos(u.rot*1.0+2.0)*1.5,2.1,2.3),0.20,vec3<f32>(0.55,0.62,0.82));
  if(p3.w>0.0){ col=mix(col,p3.rgb,0.98*f3); }
  var t=0.0; var hit=false; var pos=vec3<f32>(0.0);
  for(var i=0;i<90;i++){ pos=ro+rd*t; let dd=length(pos)-1.0; if(dd<0.0015){ hit=true; break; } t+=dd; if(t>7.0){ break; } }
  if(hit){
    let n=normalize(pos);
    let sp=rotY(u.rot*1.2)*pos;
    let land=fbm(sp*2.3+vec3<f32>(0.0,0.0,3.0));
    let isLand=smoothstep(0.48,0.54,land);
    var surf=mix(vec3<f32>(0.04,0.18,0.5), mix(vec3<f32>(0.1,0.42,0.16),vec3<f32>(0.5,0.42,0.24),smoothstep(0.62,0.82,land)), isLand);
    surf=mix(surf,vec3<f32>(0.92,0.96,1.0),smoothstep(0.82,0.93,abs(n.y)));
    let cl=fbm(rotY(u.rot*0.8)*pos*3.1+vec3<f32>(u.time*0.03,0.0,0.0));
    surf=mix(surf,vec3<f32>(1.0),smoothstep(0.55,0.78,cl)*0.55);
    let lig=normalize(vec3<f32>(-0.6,0.45,-0.7));
    let dif=max(dot(n,lig),0.0);
    let spec=pow(max(dot(reflect(lig,n),rd),0.0),28.0)*(1.0-isLand)*0.8;
    col=surf*(0.1+dif)+vec3<f32>(0.6,0.8,1.0)*spec;
    let rim=pow(1.0-max(dot(n,-rd),0.0),3.0);
    col+=vec3<f32>(0.3,0.55,1.0)*rim*0.9;
  }
  return vec4<f32>(col*u.fade, u.fade);
}`;
      let module;
      try { module = device.createShaderModule({ code: wgsl }); } catch (e) { return false; }
      let pipeline;
      try { pipeline = device.createRenderPipeline({ layout: 'auto', vertex: { module, entryPoint: 'vs' }, fragment: { module, entryPoint: 'fs', targets: [{ format: fmt }] }, primitive: { topology: 'triangle-list' } }); } catch (e) { return false; }
      const ubuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubuf } }] });
      // full-viewport WGSL raymarch is fill-bound — cap backing-store DPR harder on phones
      const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.25 : 2);
      const resize = () => { canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr)); canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr)); };
      resize(); window.addEventListener('resize', resize);
      const u = new Float32Array(8); let alive = true;
      const frame = (ts) => {
        if (!alive) return; const st = getState() || {};
        if (st.paused) { requestAnimationFrame(frame); return; }
        u[0] = canvas.width; u[1] = canvas.height; u[2] = ts * 0.001; u[3] = st.rot || 0; u[4] = (st.fade == null ? 1 : st.fade); u[5] = st.px || 0.5; u[6] = st.py || 0.5; device.queue.writeBuffer(ubuf, 0, u);
        try { const enc = device.createCommandEncoder(); const pass = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] }); pass.setPipeline(pipeline); pass.setBindGroup(0, bind); pass.draw(3); pass.end(); device.queue.submit([enc.finish()]); } catch (e) { alive = false; return; }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      this.cleanup.push(() => { alive = false; window.removeEventListener('resize', resize); try { device.destroy(); } catch (e) {} });
      return true;
    }

    /* =========================================================================
       The carousel — build_7_20, adapted to mount into a page section.
       ========================================================================= */
    mountCarousel(stage, a) {
      const F = this.F, self = this; const items = this.deckItems();
      const P = this.props || {}; const useTilt = P.v8uTilt !== false, useConfetti = P.v8uConfetti !== false, useIntro = P.v8uIntroSpin !== false, holo = (P.v8uCardStyle || 'holographic') === 'holographic';

      // off-screen pause flag (mobile/perf): all rAF draw work no-ops while the section is out of view
      let inView = true;
      try { const io = new IntersectionObserver((es) => { inView = es[0].isIntersecting; }, { threshold: 0.01 }); io.observe(stage); this.cleanup.push(() => io.disconnect()); } catch (e) {}
      if (this._lowFps == null) this._lowFps = matchMedia('(pointer:coarse)').matches;
      const mob = this._lowFps;   // phones: cheap static cosmos + lighter loops (the live raymarch tanked FPS)

      const wrap = this.h('div', 'position:absolute;inset:0;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(16px,3vw,40px);perspective:1400px;background:transparent;touch-action:pan-y;');
      const conf = this.h('canvas', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:6;'); wrap.appendChild(conf); const cctx = this.fitCanvas(conf); let confParts = []; const burst = (col) => { const w = conf.clientWidth, h = conf.clientHeight, cols = ['#7c6cff', '#5ec8ff', '#e878f5', '#f5b642', '#5ee6c0', col]; for (let k = 0; k < 80; k++) { const ang = Math.random() * 6.28, sp = Math.random() * 8 + 2; confParts.push({ x: w / 2, y: h / 2, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: Math.random() * 3 + 1, life: 1, c: cols[k % cols.length] }); } };
      this.loop(() => { if (!inView && !confParts.length) return; const w = conf.clientWidth, h = conf.clientHeight; cctx.clearRect(0, 0, w, h); confParts = confParts.filter(p => p.life > 0); confParts.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.13; p.life -= 0.02; cctx.globalAlpha = Math.max(0, p.life); cctx.fillStyle = p.c; cctx.beginPath(); cctx.arc(p.x, p.y, p.r, 0, 6.28); cctx.fill(); }); cctx.globalAlpha = 1; });

      // Cosmos removed (perf) — the cards now float on the site-wide #codefield code background (stage is
      // transparent). These vars are still written by intro/step/domino/resetDeck but drive no cosmos draw.
      let cosmosRot = 0, cosmosTarget = 0, cosmosFade = 1, auroraPh = 0; const dStreaks = [];
      void cosmosRot; void auroraPh;   // (formerly drove the cosmos draw; kept declared for intro/domino)


      const tiltBox = this.h('div', 'position:relative;z-index:2;width:min(240px,60vw);height:min(320px,52vh);transform-style:preserve-3d;transition:transform .25s ease-out;'); wrap.appendChild(tiltBox);
      const ring = this.h('div', 'position:absolute;inset:0;transform-style:preserve-3d;transition:transform .5s cubic-bezier(.16,1,.3,1);will-change:transform;'); tiltBox.appendChild(ring);
      const N = items.length; const R = Math.round(240 / (2 * Math.tan(Math.PI / N))) + 80;
      const cards = items.map((it, i) => { const card = self.h('button', self.glass('position:absolute;inset:0;border-radius:16px;cursor:pointer;border:1px solid ' + it.color + '66;box-shadow:0 0 40px -12px ' + it.color + ';padding:0;overflow:hidden;'), { 'aria-label': (it.k === 'contact' ? 'Open contact card' : (it.k === 'xp' ? 'Open role: ' + it.d.org : 'Open build: ' + it.d.t)), onclick: () => { if (useConfetti) burst(it.color); const tgt = it.k === 'contact' ? { k: 'contact' } : (it.k === 'xp' ? { k: 'xp', d: it.d } : { k: 'build', d: it.d }); card.style.zIndex = '9'; card.style.transform = base + ' translateZ(140px) scale(1.16)'; const bk = self.h('div', 'position:absolute;inset:0;border-radius:16px;background:linear-gradient(160deg,#1a1925,#0c0b12);display:flex;flex-direction:column;justify-content:center;padding:20px;opacity:0;transition:opacity .35s;border:1px solid ' + it.color + '66;', { html: '<div style="font-family:' + F.mono + ';font-size:10px;letter-spacing:.16em;color:' + it.color + '">◈ BACK</div><div style="font-family:' + F.disp + ';font-weight:700;font-size:18px;color:#fff;margin-top:8px;line-height:1.1">' + self.esc(it.k === "contact" ? self.CT.name : (it.k === "xp" ? it.d.org : it.d.t)) + '</div><div style="font-family:' + F.mono + ';font-size:11px;color:#9a9aae;margin-top:8px">opening…</div>' }); card.appendChild(bk); requestAnimationFrame(() => bk.style.opacity = '1'); setTimeout(() => { self.openItem(tgt, a); card.style.transform = base; card.style.zIndex = ''; setTimeout(() => bk.remove(), 300); }, 560); } }); const base = 'rotateY(' + (i * 360 / N) + 'deg) translateZ(' + R + 'px)'; card.style.transform = base; card.style.transition = 'transform .3s cubic-bezier(.16,1,.3,1)'; card.addEventListener('mouseenter', () => { if (!intro) { card.style.transform = base + ' translateZ(56px) rotateX(-8deg) scale(1.06)'; card.style.zIndex = '5'; } }); card.addEventListener('mouseleave', () => { card.style.transform = base; card.style.zIndex = ''; }); const face = self.miniCard(it.k === 'contact' ? { k: 'contact' } : (it.k === 'xp' ? { k: 'xp', d: it.d } : { k: 'build', d: it.d }), a); face.style.height = '100%'; face.style.background = 'transparent'; face.style.border = 'none'; face.style.boxShadow = 'none'; card.appendChild(face);
        if (holo && !mob) { const foil = self.h('div', 'position:absolute;inset:0;border-radius:16px;pointer-events:none;mix-blend-mode:color-dodge;opacity:.38;background:linear-gradient(115deg,transparent 32%,' + it.color + '88 46%,#5ec8ff88 54%,transparent 68%);'); card.appendChild(foil); const refl = self.h('div', 'position:absolute;left:0;right:0;top:100%;height:42%;border-radius:0 0 16px 16px;background:linear-gradient(180deg,' + it.color + '4d,transparent);transform:scaleY(-1);opacity:.32;pointer-events:none;'); card.appendChild(refl); }
        ring.appendChild(card); return card; });
      let cur = 0, intro = true; function spin() { if (intro) return; ring.style.transform = 'translateZ(-' + R + 'px) rotateY(' + (-cur * 360 / N) + 'deg)'; }
      // intro: spin fast, decelerate, settle on Education (front card)
      if (useIntro) { ring.style.transition = 'none'; } else { intro = false; ring.style.transform = 'translateZ(-' + R + 'px) rotateY(0deg)'; }
      const introStart = performance.now(), introDur = 2600, introTurns = 360 * 5;
      const introTick = (now) => { if (!document.body.contains(ring)) return; const t = Math.min(1, (now - introStart) / introDur); const ease = 1 - Math.pow(1 - t, 3); const ang = introTurns * (1 - ease); cosmosTarget = -ang * Math.PI / 180 * 0.25; ring.style.transform = 'translateZ(-' + R + 'px) rotateY(' + (-ang) + 'deg)'; if (t < 1) { requestAnimationFrame(introTick); } else { ring.style.transform = 'translateZ(-' + R + 'px) rotateY(0deg)'; ring.style.transition = 'transform .6s cubic-bezier(.16,1,.3,1)'; intro = false; cur = 0; } };
      if (useIntro) requestAnimationFrame(introTick);
      // Domino hand-off → the REAL next portfolio section (#fluxStage). Faithful flourish from the
      // source build_7_20: cards tip & fade staggered (140ms), cosmos fades, light-streaks converge
      // on Earth, "→ next section" caption, then a smooth-scroll to the next section. Trigger is
      // SCROLL-POSITION based (not wheel) so it fires identically on desktop + touch; it fires once
      // and RESETS on scroll-back, so the section is replayable. No scroll-lock / pin — kept light
      // for mobile (the prior heavy scroll-jack pattern was rejected; this just plays as you leave).
      let dominoing = false, dominoCap = null, dominoStart = 0;
      function step(d) { if (dominoing) return; cur += d; cosmosTarget += d * 0.5; spin(); }
      function resetDeck() {
        if (!dominoing) return;
        dominoing = false; cosmosFade = 1; dStreaks.length = 0;
        if (dominoCap) { dominoCap.remove(); dominoCap = null; }
        cards.forEach((c, i) => { const b = 'rotateY(' + (i * 360 / N) + 'deg) translateZ(' + R + 'px)'; c.style.transition = 'transform .6s cubic-bezier(.16,1,.3,1),opacity .6s'; c.style.transform = b; c.style.opacity = '1'; c.style.zIndex = ''; });
      }
      // Pure scroll-DRIVEN flourish: as the user scrolls down past the full-bleed stage the cards
      // tip & fade and the cosmos collapses, and their OWN scroll momentum carries them straight into
      // the next section (#fluxStage sits directly below). No forced auto-scroll — a fixed-delay
      // scrollTo fought continued input and yanked fast / through-scrollers backward.
      function domino() {
        if (dominoing || intro) return; dominoing = true; dominoStart = performance.now(); const SLOW = 55;
        cards.forEach((c, k) => { setTimeout(() => { if (!dominoing) return; c.style.transition = 'transform .7s cubic-bezier(.5,0,.8,1),opacity .7s'; c.style.transform += ' translateY(260px) rotateX(82deg)'; c.style.opacity = '0'; }, k * SLOW); });
        dominoCap = self.h('div', 'position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);z-index:7;font-family:' + F.disp + ';font-weight:700;font-size:clamp(18px,3vw,26px);color:#5ee6c0;text-shadow:0 0 16px #5ee6c0;opacity:0;transition:opacity .5s;pointer-events:none;', { text: '↓ next section' }); wrap.appendChild(dominoCap);
        setTimeout(() => { if (dominoCap) dominoCap.style.opacity = '1'; }, cards.length * SLOW);
      }
      let wheelAcc = 0;
      // horizontal wheel still rotates the deck; vertical scroll is the page + the domino trigger
      wrap.addEventListener('wheel', e => { if (intro || dominoing) return; if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { wheelAcc += e.deltaX; if (Math.abs(wheelAcc) > 55) { step(wheelAcc > 0 ? 1 : -1); wheelAcc = 0; } } }, { passive: true });
      // scroll-position domino trigger (touch-safe): fire once when the full-bleed stage fills the top
      // of the viewport and the user keeps scrolling DOWN; reset when scrolled back up into it.
      let lastY = (window.__lenis && typeof window.__lenis.scroll === 'number') ? window.__lenis.scroll : (window.scrollY || 0);
      const onScrollDom = () => {
        if (!document.body.contains(stage)) return;
        const y = (window.__lenis && typeof window.__lenis.scroll === 'number') ? window.__lenis.scroll : window.scrollY;
        const dy = y - lastY;
        if (Math.abs(dy) < 0.5) return;   // ignore no-op duplicates: window + lenis 'scroll' both fire per frame
        lastY = y; const down = dy > 0;
        const r = stage.getBoundingClientRect(), vh = window.innerHeight || 1;
        // NON-OVERLAPPING hysteresis (no leftView latch needed): domino fires only once the carousel is
        // clearly LEAVING (top scrolled past -15%vh while going down); reset fires once it RETURNS past
        // -5%vh while going up. The 10%vh gap is the latch — crucially it sits BELOW the deck-view position
        // (r.top≈0), so a momentum settle/jitter there can never re-trigger the domino (the bug that left
        // cards stuck/flickering on scroll-up). A short post-domino debounce guards the boundary.
        if (!dominoing) { if (down && !intro && r.top <= -vh * 0.15 && r.bottom > vh * 0.45) domino(); return; }
        if (!down && (performance.now() - dominoStart) > 300 && r.top > -vh * 0.05) resetDeck();
      };
      window.addEventListener('scroll', onScrollDom, { passive: true });
      // Lenis may init after this mounts — attach to its scroll stream as soon as it exists.
      const attachLenis = () => { if (window.__lenis && window.__lenis.on) { window.__lenis.on('scroll', onScrollDom); return true; } return false; };
      if (!attachLenis()) { let n = 0; const li = setInterval(() => { if (attachLenis() || ++n > 40) clearInterval(li); }, 120); this.cleanup.push(() => clearInterval(li)); }
      this.cleanup.push(() => { window.removeEventListener('scroll', onScrollDom); if (window.__lenis && window.__lenis.off) { try { window.__lenis.off('scroll', onScrollDom); } catch (e) {} } });
      const ctr = this.h('div', 'position:relative;z-index:2;display:flex;gap:16px;margin-top:24px;'); const mk = (t, fn, col, label) => { const b = self.h('button', 'width:58px;height:58px;border-radius:50%;border:1.5px solid ' + col + ';background:radial-gradient(circle at 50% 32%,' + col + '40,rgba(10,9,16,.55));color:' + col + ';font-size:20px;cursor:pointer;backdrop-filter:blur(8px);transition:transform .18s,box-shadow .18s;display:grid;place-items:center;', { html: t, 'aria-label': label, onclick: fn }); b.style.boxShadow = '0 0 22px -4px ' + col + ',inset 0 0 12px -5px ' + col; b.addEventListener('mouseenter', () => { b.style.transform = 'scale(1.12)'; b.style.boxShadow = '0 0 34px -2px ' + col + ',inset 0 0 16px -3px ' + col; }); b.addEventListener('mouseleave', () => { b.style.transform = 'scale(1)'; b.style.boxShadow = '0 0 22px -4px ' + col + ',inset 0 0 12px -5px ' + col; }); return b; }; this.add(ctr, mk('←', () => step(-1), '#f8553f', 'Previous card'), mk('→', () => step(1), '#5ee6c0', 'Next card')); wrap.appendChild(ctr);
      // SMOOTH live drag: the ring tracks the finger horizontally and snaps to the nearest card on
      // release. touch-action:pan-y on the wrap lets vertical swipes scroll the page; axis lock keeps
      // a diagonal swipe from hijacking either gesture.
      const DEG = 360 / N; let sx = 0, sy = 0, sRot = 0, dragging = false, axis = 0;
      wrap.addEventListener('pointerdown', e => { if (intro || dominoing) return; dragging = true; axis = 0; sx = e.clientX; sy = e.clientY; sRot = -cur * DEG; });
      wrap.addEventListener('pointermove', e => { if (!dragging) return; const dx = e.clientX - sx, dy = e.clientY - sy; if (!axis) { if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return; axis = Math.abs(dx) >= Math.abs(dy) ? 1 : -1; if (axis === 1) ring.style.transition = 'none'; } if (axis === 1) ring.style.transform = 'translateZ(-' + R + 'px) rotateY(' + (sRot + dx * 0.38) + 'deg)'; });
      const endDrag = e => { if (!dragging) return; dragging = false; if (axis === 1) { const dx = ((e && typeof e.clientX === 'number') ? e.clientX : sx) - sx; cur = Math.round(-(sRot + dx * 0.38) / DEG); ring.style.transition = 'transform .5s cubic-bezier(.16,1,.3,1)'; spin(); } axis = 0; };
      wrap.addEventListener('pointerup', endDrag); wrap.addEventListener('pointercancel', endDrag); wrap.addEventListener('pointerleave', endDrag);
      // tilt the whole ring toward the pointer — desktop only (no hover on touch; skip while dragging)
      wrap.addEventListener('pointermove', e => { if (intro || !useTilt || dragging || !matchMedia('(pointer:fine)').matches) return; const r = wrap.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5; tiltBox.style.transform = 'rotateX(' + (-py * 12) + 'deg) rotateY(' + (px * 12) + 'deg)'; }); wrap.addEventListener('pointerleave', () => tiltBox.style.transform = 'rotateX(0deg) rotateY(0deg)');
      wrap.appendChild(this.h('div', 'position:absolute;bottom:14px;left:50%;transform:translateX(-50%);font-family:' + F.mono + ';font-size:11px;color:#9a9aae;z-index:3;text-align:center;padding:0 12px;', { text: 'swipe / drag ↔ rotate cards · scroll ↓ next section · click to open' }));
      stage.appendChild(wrap);
    }
  }

  function boot() {
    const stage = document.getElementById('v8uStage');
    if (!stage || stage.dataset.mounted) return;
    const mount = () => {
      if (stage.dataset.mounted) return; stage.dataset.mounted = '1';
      try { new V8U().mountCarousel(stage, '#e878f5'); }
      catch (e) { if (window.console) console.error('[v8u] mount failed', e); }
    };
    // RENDER SMART: the 16-card 3D deck sits far below the fold — building it on load was a heavy
    // main-thread task. Defer CONSTRUCTION until the stage nears the viewport; the deck's rAF/intro
    // is already inView-gated so motion is unchanged (it just builds when you scroll toward it).
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); mount(); } }, { rootMargin: '600px 0px' });
      io.observe(stage);
    } else { mount(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
