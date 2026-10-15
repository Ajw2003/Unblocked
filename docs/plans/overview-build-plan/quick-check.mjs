// Quick check, not the real browser check (that is the next issue): the Overview renders from the rail
// with no console errors at 1440 and 390 wide, and the page does not scroll sideways.
// Needs: python3 -m http.server 8137 from the repo root.
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const iso = (d) => { const x = new Date(Date.now() + d * 864e5); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const t = (id, title, deadline) => Object.assign({ id, title, status: 'next', updatedAt: 1, order: 0, categoryIds: [] }, deadline ? { deadline } : {});
const seed = { projects: [
  { id: 'p0', name: 'Home', color: '#3E8E5E', categoryId: 'c1', tasks: [t('a', 'Car tax <renewal>', iso(-1)), t('b', 'Bins out', iso(1)), t('c', 'Pay rent', iso(5)), t('d', 'Someday')] },
  { id: 'p1', name: 'Loose', color: '#4D6FB8', tasks: [t('e', 'Call Gran', iso(3))] }],
  projectCategories: [{ id: 'c1', name: 'Home', color: '#3E8E5E' }], categories: [], inbox: [{ id: 'i1', text: 'idea', createdAt: 1 }], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 } };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
let bad = 0;
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.addInitScript((s) => { if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1'); localStorage.setItem('unblock-onboarding', 'done'); localStorage.setItem('unblock-state-v1', JSON.stringify(s)); }, seed);
  await page.goto('http://127.0.0.1:8137/app/');
  await page.click('.rail-item[data-screen="overview"]');
  await page.waitForSelector('.screen-overview .overview-day');
  const info = await page.evaluate(() => ({ days: document.querySelectorAll('.overview-day').length, chips: document.querySelectorAll('.overview-chip').length, areas: document.querySelectorAll('.overview-area').length, sort: !!document.querySelector('.overview-sort'), sideways: document.documentElement.scrollWidth > innerWidth }));
  await page.screenshot({ path: new URL('overview-' + w + '.png', import.meta.url).pathname });
  const ok = info.days === 7 && info.chips === 4 && info.areas === 2 && info.sort && !info.sideways && !errs.length;
  if (!ok) bad++;
  console.log((ok ? 'PASS ' : 'FAIL ') + w + ' ' + JSON.stringify(info) + ' errors=' + JSON.stringify(errs));
  await ctx.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
