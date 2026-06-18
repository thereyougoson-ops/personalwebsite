# Future-Improvements Roadmap — Philip Toulinov Portfolio
_Generated 2026-06-17 by a 6-agent component/dimension review (hero/interaction · content/conversion · projects showcase · performance/infra · a11y/responsive/i18n · SEO/analytics/design) → synthesis. 41 raw suggestions → 19 distinct, ranked by impact on landing DevOps/SRE/Release-Engineering interviews._

> Context: the site is already polished and verified (self-test 105/0, 0 axe violations, responsive 320–1280px, self-hosted fonts, WebP, CI, sitemap/manifest/headers, the new Builds section, the 12-frame banner). This roadmap is purely forward-looking — none of it is a regression.

---

## TIER 1 — Quick wins (trivial/small effort, real impact)

1. **Stop the contact form from silently dropping leads** — wire `#commitForm` to Netlify Forms (`data-netlify`, hidden `form-name`, honeypot; keep the "git commit" typing animation and the `mailto:` as a progressive-enhancement fallback). The whole site is engineered for reliability, yet its single most valuable endpoint silently no-ops on any laptop without a configured mail client — and captures zero submission data. `netlify.toml` already exists. **Funnel-floor prerequisite. Effort: small.**

2. **Make the ⌘K trigger usable on touch** — under `@media (hover:none)` / ≤760px, swap the bare `⌘K` glyphs (meaningless on a phone) for a labelled "☰ Navigate" affordance that opens the existing palette; add a one-time first-visit coach-mark gated on a localStorage flag (like `pt_motion`), no pulse under reduced-motion. Recruiters first-touch on mobile, and the palette-only nav currently has no discoverable entry point on touch — a hard bounce. **Funnel-floor prerequisite. Effort: small.**

3. **Own the 2024–2026 timeline gap** — insert a dated `BUILD · 2024–present · Independent Engineer / Builder` stage into the career DAG between "deploy" and "monitor," with 2–3 points linking into `#builds`. A ~29-month unexplained gap is the fastest way an SRE recruiter screens you out; the "open to the next deploy · now" node cosmetically hides it rather than answering it. **Outsized payoff. Effort: small.**

4. **Extract a scannable "How it stays reliable / Ops" facet per build** — pull the operational engineering currently buried in product prose (freqtrade paper/funded stack isolation, the idempotent operator scripts, the self-healing poller + STALE guard, tiered Postgres rollups, ETag conditional-GET) into a consistent `pj-ops` block, with a one-line ops pill on each homepage card. The hiring target is SRE, but a skimming manager has to dig for the reliability signal. **Outsized payoff. Effort: small.**

5. **Add a reverse-job-req to `whoami.yaml`** — machine-readable `seeking`, `start/notice`, `work_auth`, `oncall`, `not_looking_for` fields in the existing YAML aesthetic; bundle the same answers into a discoverable `hire` terminal command (promote the `sudo hire` easter egg) added to `help`, `COMPLETIONS`, and the chips. Vague availability forces a recruiter to email just to learn fit; precise specs let the right ones self-qualify. **Effort: trivial–small.**

6. **Ship the staged ATS-text résumé** — finish reviewing and link `assets/philip-toulinov-resume-text.pdf` as the primary download (keep the image PDF as the "designed version"). An image-only résumé is invisible to ATS keyword parsers and AI sourcers — a silent disqualifier. **Effort: trivial.**

> _Guardrail (attaches to #4 + metrics): keep counts honest — only upgrade `pj-facts` to genuinely measured numbers (scan cadence, retention windows, self-test assertion count); never invent uptime/SLA %. Don't build filter UI at n=5._

---

## TIER 2 — High-impact projects (medium/large; most move the needle; double as DevOps/SRE proof)

7. **★ FLAGSHIP — Make the portfolio's own delivery pipeline the work sample.** One connected release-engineering story, built in sequence:
   - **(a) Content-hash + minify build** — a small Node step (esbuild/lightningcss) emitting `main.<hash>.css/js` into `dist/`, rewriting tags, then flipping `/styles/*` + `/scripts/*` in `_headers` from `must-revalidate` to `immutable`. **This closes the TODO already written in `_headers`** — an interviewer reads the comment, then sees you closed it.
   - **(b) Hard CI quality gates** — extend `test.yml` beyond the one Playwright self-test: Lighthouse-CI with committed budgets, `@axe-core/playwright` (so "0 WCAG violations" becomes *continuously enforced*), a link checker, HTML/CSS lint — all failing the build on regression.
   - **(c) Per-PR preview deploys** — Netlify/Cloudflare Pages previews with a bot comment posting the preview URL + Lighthouse delta vs main, and gated promotion to prod.

   **Why it's the flagship:** with no public GitHub and an image-only résumé, the portfolio's own CI/CD is the candidate's *only publicly inspectable ops artifact* — it IS the GitHub substitute. It converts every unsourced quality claim into a gate an interviewer can watch run, and "preview → Lighthouse delta → gated prod promotion" demonstrates the exact promotion-through-environments workflow the job hires for. **Effort: medium (sequenced).**
   _Riders that generate off this pipeline: SRI hashes on vendored gsap/lenis; AVIF + above-the-fold font preload; per-project OG images._

8. **Inline real code excerpts in each case study** — a collapsible ~10–15 line syntax-highlighted fragment of the *actual* implementation (Hyperliquid RSI entry gate, poller respawn loop, ETag conditional-GET, loan state-machine transition), in the site's mono idiom via `escapeHtml`. With repos off the table, a real code fragment is the most undeniable proof available. **Effort: medium.**

9. **Per-build architecture / data-flow diagrams** in the site's inline-SVG/ASCII idiom (the career DAG proves the capability) — e.g. STAKE·ODDS as `feed → normalizer → diff → freshness guard → archive`. The data-flow diagram is the artifact infra/SRE interviewers respond to most. **Effort: medium.**

10. **Ship demos for the three demo-safe builds; record the unsafe two** — live/static for STAKE·ODDS / Sokoloff PWA / ClaudeDown; a 20–40s muted looping screen-capture (`<video>` poster, reduced-motion-aware) for the fund/data-holding ones (funded freqtrade, Loansy). A working demo retires the "reconstructed screenshot" disclaimer. **Effort: medium.**

11. **Recast impact metrics in DORA terms with scope; make tiles traceable** — deployment frequency / lead time / MTTR / change-failure rate with concrete scope ("from weekly to on-demand deploys"), and anchor-scroll the LendingClub tile to its DAG stage. DORA is the shared vocabulary of release/SRE hiring. **Effort: small–medium.**

12. **A self-hosted SLO / status surface** — a scheduled GH Actions cron probing the live site, committing a tiny history JSON, rendering `/status.html` with uptime, p95 TTFB, last-deploy timestamp, live Lighthouse scores, and an explicit SLO (99.9%, LCP < 2.0s). An SLO + error-budget page proves you think in SLIs/SLOs — and is a live counterpart to the static on-call incident widget. **Effort: medium (builds on the flagship CI).**

13. **Add privacy-friendly self-hosted analytics + complete the security headers (one bundle)** — self-host Plausible/Umami (cookieless, same-origin — itself a "DevOps I operate" talking point) with a CONVERSION vs ENGAGEMENT event taxonomy (résumé download, copy-email, form submit vs ⌘K open, terminal command, incident-widget play). Adding analytics forces the CSP decision anyway — so add CSP (self + analytics origin), HSTS preload, tight Permissions-Policy. A hiring manager running securityheaders.com getting an A+ is a live demonstration of the résumé. **Effort: small–medium.**

14. **Surface 1–2 attributed LinkedIn-recommendation pull-quotes** near contact. A hand-built showpiece is entirely self-asserted; one quote from a named former manager is social proof you can't manufacture (request before launch; never fabricate). **Effort: small.**

---

## TIER 3 — Ambitious / delight (bigger bets, distinctiveness)

15. **Recruiter-personalized, deep-linkable terminal** — read a `?to=` param to print a personalized welcome (`// hello, Stripe team`) through `escapeHtml`, plus a `share` command that copies a `?run=git+log` deep link that auto-executes on load. A link a recruiter forwards to their hiring panel that greets them by name and replays a command is viral inside exactly the target audience. **Effort: medium.**

16. **Codify the hosting as IaC** — a small Terraform module (Cloudflare Pages ruleset, or an opt-in S3+CloudFront "how I'd run this on AWS" dir) that *generates* the cache/security headers, with `terraform fmt/validate` in CI. `knowsAbout` lists Terraform/AWS/K8s but the repo shows none — this turns the strongest unbacked claim into reviewable proof. **Effort: medium.**

17. **Split `projects.html` into per-project URLs** — individually indexable/shareable, each with its own OG image and `SoftwareSourceCode` JSON-LD; add to sitemap. "Here's the Freqtrade build" as a dedicated URL reads more professionally than a deep-link into a long combined page. **Effort: medium.**

18. **Unify the ⌘K palette with the terminal command set** — let the palette run terminal commands ("Run in terminal: git log"), with recents/aliases persisted via localStorage. A single discoverable index of everything the site can do; also a maintainability win (one registry). **Effort: medium.**

19. **A genuine EN/FR bilingual build** — real `/fr/` content or a `data-i18n` dictionary, visible EN|FR toggle, `hreflang` pairs, `lang` update, localStorage persistence. Converts a claimed soft-skill into demonstrated i18n engineering, uniquely credible because he's bilingual. _(Downgraded from a reviewer's "high": large effort, and most SF DevOps reqs don't require FR — a distinctiveness bet, not a needle-mover.)_ **Effort: large.**

_Smaller delight bets, lowest priority:_ harden for Windows forced-colors / `prefers-contrast` (a real a11y gap axe can't catch); tame screen-reader verbosity on the incident widget; haptics (`navigator.vibrate`) + persisted terminal session; container queries for the card grids; deeper Person schema (`worksFor` LendingClub/Tech Mahindra) + `ProfilePage` type; make the prod/staging/dev env-switch more discoverable.

---

## THE SINGLE MOST VALUABLE NEXT THING TO BUILD

**The flagship CI/CD pipeline (Tier 2 #7) — gated behind the two funnel quick-wins (#1 form backend, #2 mobile-nav discoverability) as non-negotiable prerequisites.**

With no public GitHub and an image-only résumé, the portfolio's own pipeline is the candidate's only publicly inspectable ops artifact — it is the GitHub substitute. It is the one item that simultaneously (a) closes the TODO already written in `_headers`, (b) converts every unsourced quality claim (AA contrast, 0 axe, responsive) into a gate an interviewer can watch run on a real PR, and (c) demonstrates the exact promotion-through-environments workflow release/SRE reqs hire for — in one screen. Everything else proves *what he built*; this proves *how he operates*, which is the role. Fix the funnel floor first (a recruiter who can't navigate on mobile, or whose message silently vanishes, never sees the pipeline), then build the pipeline as the centerpiece.
