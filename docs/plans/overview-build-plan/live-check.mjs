// Checks the deployed app (GitHub Pages) shows the Overview screen: seeds one project with a task due
// today, opens the Overview from the rail at phone width, and reports page errors.
// Usage: node docs/plans/overview-build-plan/live-check.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');

const LIVE_APP = 'https://ajw2003.github.io/Unblocked/app/';
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy, args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const d = new Date();
const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const seed = { projects: [{ id: 'p0', name: 'Home', color: '#3E8E5E', tasks: [{ id: 'a', title: 'Bins out', status: 'next', deadline: today, updatedAt: 1, categoryIds: [] }] }],
  projectCategories: [], categories: [], inbox: [], completedLog: [], deletedTaskIds: {} };
await page.addInitScript((s) => { if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1'); localStorage.setItem('unblock-onboarding', 'done'); localStorage.setItem('unblock-state-v1', JSON.stringify(s)); }, seed);
await page.goto(LIVE_APP, { waitUntil: 'networkidle', timeout: 60000 });
const button = page.locator('.rail-item[data-screen="overview"]');
const hasButton = await button.count() > 0;
let chip = '';
if (hasButton) {
  await button.click();
  chip = (await page.locator('.overview-day.is-today .overview-chip').first().textContent({ timeout: 5000 }).catch(() => '')) || '';
}
await page.screenshot({ path: new URL('live-390.png', import.meta.url).pathname });
const ok = hasButton && chip.includes('Bins out') && !errors.length;
console.log((ok ? 'PASS' : 'FAIL') + ' live: Overview button ' + (hasButton ? 'found' : 'missing') + ', today chip "' + chip + '", errors ' + JSON.stringify(errors));
await browser.close();
process.exit(ok ? 0 : 1);
