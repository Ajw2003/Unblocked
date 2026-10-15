// docs/plans/life-dashboard/shoot-mockups.mjs -- screenshots each mockup on the hand-built proposal
// (docs/plans/life-dashboard-proposal.html) so the template-built page can show them as pictures.
// Usage: node docs/plans/life-dashboard/shoot-mockups.mjs
// Output: docs/plans/life-dashboard/pics/*.png, light theme, 2x pixel density.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const HERE = fileURLToPath(new URL('.', import.meta.url));
const SOURCE = join(HERE, '..', 'life-dashboard-proposal.html');
const OUT = join(HERE, 'pics');
mkdirSync(OUT, { recursive: true });

// [output name, CSS selector, which match (0-based)]
const SHOTS = [
  ['what-exists', '.grid3', 0],
  ['overview-screen', '.shell', 0],
  ['shape-week-strip', '.thumb', 0],
  ['shape-month', '.thumb', 1],
  ['shape-timeline', '.thumb', 2],
  ['export-table', '.tablebox', 0],
  ['triage-card', '.triage', 0],
  ['ai-line', '.grid3', 1],
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light' });
await page.goto(pathToFileURL(SOURCE).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const fontsLoaded = await page.evaluate(() => document.fonts.check('16px Figtree') && document.fonts.check('16px "Young Serif"'));
console.log('web fonts loaded: ' + fontsLoaded);
let failed = 0;
for (const [name, selector, index] of SHOTS) {
  const el = page.locator(selector).nth(index);
  if (await el.count() === 0) { console.log('MISSING ' + name + ': no match ' + index + ' for ' + selector); failed++; continue; }
  // A 12px margin keeps the tilted note slip and the shadows from being cut at the edge.
  // Page coordinates, not viewport ones, because the clip is taken from the full page.
  const box = await el.evaluate((node) => {
    const r = node.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
  });
  const pad = 12;
  await page.screenshot({ path: join(OUT, name + '.png'), fullPage: true,
    clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 } });
  console.log('shot ' + name + '.png ' + Math.round(box.width) + 'x' + Math.round(box.height));
}
await browser.close();
process.exit(failed ? 1 : 0);
