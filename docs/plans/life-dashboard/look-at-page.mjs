// docs/plans/life-dashboard/look-at-page.mjs -- screenshots the template-built proposal
// (docs/plans/life-dashboard.html) at desktop and phone width, opens the Choices part, and reports
// how many of its pictures loaded.
// Usage: node docs/plans/life-dashboard/look-at-page.mjs <output folder>
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const HERE = fileURLToPath(new URL('.', import.meta.url));
const PAGE = join(HERE, '..', 'life-dashboard.html');
const OUT = process.argv[2];
if (!OUT) { console.error('usage: node look-at-page.mjs <output folder>'); process.exit(2); }

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [width, name] of [[1200, 'wide'], [390, 'phone']]) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  await page.goto(pathToFileURL(PAGE).href, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, 'built-' + name + '-short.png') });
  const loaded = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth > 0).length);
  const total = await page.evaluate(() => document.images.length);
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(name + ': ' + loaded + ' of ' + total + ' pictures loaded; sideways scroll: ' + sideways);
  const notLoaded = await page.evaluate(() => [...document.images].filter((i) => !(i.complete && i.naturalWidth > 0))
    .map((i) => (i.getAttribute('src') || '(no src)').slice(0, 80) + (i.closest('details:not([open])') ? ' [inside a closed panel]' : '')));
  if (notLoaded.length) console.log(name + ': not loaded: ' + notLoaded.join(', '));
  const choicesTab = page.getByRole('button', { name: /Choices/ }).first();
  if (await choicesTab.count()) {
    await choicesTab.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, 'built-' + name + '-choices.png'), fullPage: name === 'wide' });
  } else {
    console.log(name + ': no Choices button found');
  }
}
await browser.close();
