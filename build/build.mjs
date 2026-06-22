// Additive content-hash + minify build for the portfolio.
//
//   node build/build.mjs        →  emits ./dist
//
// What it does (and ONLY this — the source tree stays a runnable no-build static site):
//   1. copies the whole site into ./dist (minus dev-only dirs)
//   2. minifies + content-hashes styles/main.css and scripts/main.js → main.<hash>.css/js
//   3. rewrites every <link>/<script> reference in the dist HTML to the hashed names
//   4. writes dist/_headers that marks /styles/* and /scripts/* `immutable`
//      (safe now: the filenames carry a content hash, so a new build = a new URL)
//
// Minification uses esbuild if it's installed; if not, files are copied verbatim
// (still hashed → still immutable-cacheable). So `npm run build` works with zero deps.

import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

// dirs that must never ship to the published site
const SKIP = new Set(['dist', 'node_modules', '.git', '.github', 'build', '.playwright-mcp', 'tests']);
// dev-only files (config, lockfiles, internal docs) — kept out of the published output
const SKIP_FILES = new Set(['package.json', 'package-lock.json', 'lighthouserc.json', 'netlify.toml', '.gitignore']);
const skipFile = (name) => SKIP_FILES.has(name) || name.endsWith('.md');

// the two unhashed runtime assets we hash; key = source rel path, type for esbuild
const HASHED = [
  { rel: 'styles/main.css', loader: 'css' },
  { rel: 'scripts/main.js', loader: 'js' },
  { rel: 'scripts/transit.js', loader: 'js' },
];

let minify = async (code /*, loader */) => code;        // default: identity (no esbuild)
try {
  const esbuild = await import('esbuild');
  minify = async (code, loader) => (await esbuild.transform(code, { loader, minify: true, legalComments: 'none' })).code;
  console.log('· esbuild found — minifying');
} catch {
  console.log('· esbuild not installed — hashing without minification (run `npm i -D esbuild` to shrink bytes)');
}

const sh = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 10);

async function rmrf(p) { await fs.rm(p, { recursive: true, force: true }); }

async function copyTree(src, dst) {
  const entries = await fs.readdir(src, { withFileTypes: true });
  await fs.mkdir(dst, { recursive: true });
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    if (e.isFile() && skipFile(e.name)) continue;       // dev-only files never reach dist
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) await copyTree(s, d);
    else await fs.copyFile(s, d);
  }
}

async function listHtml(dir, acc = []) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await listHtml(p, acc);
    else if (e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

async function main() {
  await rmrf(DIST);
  await copyTree(ROOT, DIST);

  // hash + minify the two runtime assets, recording old→new path rewrites
  const rewrites = [];
  for (const { rel, loader } of HASHED) {
    const srcAbs = path.join(ROOT, rel);
    const raw = await fs.readFile(srcAbs, 'utf8');
    const out = await minify(raw, loader);
    const hash = sh(out);
    const ext = path.extname(rel);
    const hashedRel = rel.replace(new RegExp(ext.replace('.', '\\.') + '$'), `.${hash}${ext}`);
    // remove the verbatim copy, write the hashed one
    await rmrf(path.join(DIST, rel));
    await fs.mkdir(path.join(DIST, path.dirname(hashedRel)), { recursive: true });
    await fs.writeFile(path.join(DIST, hashedRel), out);
    rewrites.push({ from: rel, to: hashedRel });
    console.log(`  ${rel}  →  ${hashedRel}  (${out.length} bytes)`);
  }

  // rewrite references in every dist HTML file (handles href/src with or without leading slash)
  for (const html of await listHtml(DIST)) {
    let txt = await fs.readFile(html, 'utf8');
    let changed = false;
    for (const { from, to } of rewrites) {
      for (const variant of [from, '/' + from]) {
        if (txt.includes(variant)) { txt = txt.split(variant).join(variant.startsWith('/') ? '/' + to : to); changed = true; }
      }
    }
    if (changed) await fs.writeFile(html, txt);
  }

  // generate dist/_headers: same policy as source, but /styles/* and /scripts/* are now immutable
  const srcHeaders = await fs.readFile(path.join(ROOT, '_headers'), 'utf8');
  const distHeaders = srcHeaders
    .replace(/\/styles\/\*\n  Cache-Control: public, max-age=3600, must-revalidate/,
             '/styles/*\n  Cache-Control: public, max-age=31536000, immutable')
    .replace(/\/scripts\/\*\n  Cache-Control: public, max-age=3600, must-revalidate/,
             '/scripts/*\n  Cache-Control: public, max-age=31536000, immutable')
    .replace('# main.css / main.js change WITHOUT a content hash in the filename, so they must\n# revalidate (add a hashed build step later to make these immutable too).',
             '# main.<hash>.css / main.<hash>.js carry a content hash (build/build.mjs), so they are immutable.');
  await fs.writeFile(path.join(DIST, '_headers'), distHeaders);

  console.log(`✓ built → dist/  (${rewrites.length} hashed asset(s))`);
}

main().catch((e) => { console.error(e); process.exit(1); });
