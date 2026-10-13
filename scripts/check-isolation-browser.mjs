// scripts/check-isolation-browser.mjs -- real-Chromium check that Unblock never touches Focus Deck's
// browser data. Both apps are served from ajw2003.github.io, one origin, so they share localStorage
// and caches (docs/6-decisions/Decisions.md, 2026-10-13).
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/check-isolation-browser.mjs
import { createRequire } from 'node:module';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASE = 'http://127.0.0.1:8125/app/';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  let file = join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(8125, '127.0.0.1', r));

// What a real Focus Deck install keeps in this origin's storage and caches.
const FOCUS_DECK = {
  'focusdeck-state-v1': JSON.stringify({ projects: [{ id: 'p1', name: 'Focus Deck project' }], tasks: [] }),
  'focusdeck-github-token': 'github_pat_focusdeck_example',
  'focusdeck-gist-id': 'focusdeck-gist-example',
  'focusdeck-onboarding': 'done',
};
const FOCUS_DECK_CACHE = 'focus-deck-app-shell-v99';

let passed = 0, failed = 0;
const check = (ok, name, detail = '') => { ok ? passed++ : failed++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  [' + detail + ']' : '')); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
try {
  const page = await (await browser.newContext()).newPage();
  await page.goto('http://127.0.0.1:8125/manifest.webmanifest');
  await page.evaluate(async ({ seed, cache }) => {
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    await (await caches.open(cache)).put('/marker', new Response('focus deck'));
  }, { seed: FOCUS_DECK, cache: FOCUS_DECK_CACHE });

  await page.goto(BASE);
  await page.waitForSelector('#app');
  check(await page.isVisible('text=Welcome') || await page.locator('#app').innerText().then((t) => t.length > 0),
    'Unblock opens fresh, not on Focus Deck\'s data');
  // Use it: make a project through first-run, so Unblock writes its own state.
  await page.evaluate(() => localStorage.setItem('unblock-onboarding', 'done'));
  await page.reload();
  await page.waitForSelector('#app');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.fill('#capture-input', 'Buy dish soap');
  await page.press('#capture-input', 'Enter');
  await page.waitForTimeout(1500);
  const saved = await page.evaluate(() => localStorage.getItem('unblock-state-v1') || '');
  check(saved.includes('Buy dish soap'), 'Unblock saves a captured thought under its own key');

  const after = await page.evaluate(async (keys) => ({
    store: Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)])),
    allKeys: Object.keys(localStorage),
    caches: await caches.keys(),
  }), Object.keys(FOCUS_DECK));

  for (const [k, v] of Object.entries(FOCUS_DECK)) check(after.store[k] === v, 'Focus Deck key unchanged: ' + k);
  check(after.caches.includes(FOCUS_DECK_CACHE), 'Focus Deck\'s cache survives Unblock\'s worker', after.caches.join(', '));
  check(after.caches.some((c) => c.startsWith('unblock-app-shell-')), 'Unblock caches under its own prefix', after.caches.join(', '));
  const stray = after.allKeys.filter((k) => !k.startsWith('unblock-') && !(k in FOCUS_DECK));
  check(stray.length === 0, 'Unblock writes only unblock- keys', stray.join(', ') || after.allKeys.join(', '));
} finally {
  await browser.close();
  server.close();
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
