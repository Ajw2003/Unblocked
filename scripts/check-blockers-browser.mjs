// scripts/check-blockers-browser.mjs -- blockers (#3) in real Chromium, phone and desktop: name what is
// in the way from the task editor, see it on the row, get the blocker dealt instead of the task, and
// get the task back once the blocker is done.
// Usage: CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node scripts/check-blockers-browser.mjs
// Serves the repo root on 127.0.0.1:8140. Screenshots: docs/generated/blockers/*.png
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/blockers/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8140/app/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  let file = join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(8140, '127.0.0.1', ok));

const t = (id, title, order, extra) => Object.assign({ id, title, status: 'next', source: 'manual', updatedAt: 1, sortOrder: order, categoryIds: ['c1'] }, extra);
const seed = {
  projects: [{ id: 'p0', name: 'Home', color: '#3E8E5E', tasks: [t('dishes', 'Do the dishes', 1), t('bins', 'Take the bins out', 2, { categoryIds: [] })] }],
  categories: [{ id: 'c1', name: 'chore', color: '#8a6d3b', updatedAt: 1 }], inbox: [], completedLog: [], deletedTaskIds: {},
  choosingMode: { mode: 'twice', updatedAt: 1 },
};
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('unblock-state-v1')));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--no-sandbox'] });
let bad = 0;
const check = (ok, name) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) bad++; };
try {
  for (const [tag, vp] of [['390', { width: 390, height: 844 }], ['1440', { width: 1440, height: 900 }]]) {
    const ctx = await browser.newContext({ viewport: vp, serviceWorkers: 'block', hasTouch: tag === '390' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { bad++; console.log('FAIL page error: ' + e.message); });
    await page.addInitScript((s) => {
      if (localStorage.getItem('seeded')) return;
      localStorage.setItem('seeded', '1');
      localStorage.setItem('unblock-onboarding', 'done'); localStorage.setItem('unblock-screen', 'projects');
      localStorage.setItem('unblock-state-v1', JSON.stringify(s));
    }, seed);
    await page.goto(BASE);

    // 1. Name the blocker from the task editor.
    await page.click('.task-title[data-task="dishes"]');
    await page.waitForSelector('.task-edit-form textarea[name="blockers"]');
    await page.screenshot({ path: OUT + tag + '-1-editor.png' });
    await page.fill('.task-edit-form textarea[name="blockers"]', 'Buy dish soap');
    await page.click('.task-edit-form button[type="submit"]');
    await page.waitForSelector('.task-row[data-task="dishes"] .blocked-chip');
    let st = await stored(page);
    const tasks = st.projects[0].tasks;
    const soap = tasks.find((x) => x.title === 'Buy dish soap');
    check(!!soap && soap.categoryIds.join() === 'c1', tag + ': the blocker is saved as a chore task in Home');
    check(tasks.find((x) => x.id === 'dishes').blockedBy.join() === (soap && soap.id), tag + ': the dishes wait on it');
    check((await page.locator('.task-row[data-task="dishes"] .blocked-chip').innerText()).includes('In the way: Buy dish soap'), tag + ': the dishes row says what is in the way');
    check((await page.locator('.task-row[data-task="' + soap.id + '"] .unblocks-chip').innerText()).includes('Unblocks: Do the dishes'), tag + ': the soap row says what it unblocks');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(overflow <= 0, tag + ': no sideways scroll (' + overflow + 'px)');
    await page.screenshot({ path: OUT + tag + '-2-rows.png' });

    // 2. Ask for a chore: only the soap can be dealt, never the blocked dishes.
    let dealtDishes = 0;
    for (let i = 0; i < 6; i++) {
      await page.evaluate(async () => { const M = await import('./js/mutations.js'); M.clearFocus(); M.pickFocus({ categoryId: 'c1' }); });
      st = await stored(page);
      if (st.focus.taskId === 'dishes') dealtDishes++;
    }
    check(dealtDishes === 0, tag + ': six chore picks never dealt the blocked dishes');

    // 3. Focused on the dishes anyway, the card offers the blocker, and one tap switches to it.
    await page.evaluate(async () => { const M = await import('./js/mutations.js'); M.setFocus('dishes'); });
    await page.click('[data-action="set-screen"][data-screen="focus"]:visible');
    await page.waitForSelector('.focus-blockers');
    check((await page.locator('.focus-blockers').innerText()).includes('Buy dish soap, do that first'), tag + ': the focus card says what is in the way');
    await page.screenshot({ path: OUT + tag + '-3-focus-blocked.png' });
    await page.click('.focus-blockers [data-action="focus-task"]');
    await page.waitForTimeout(300);
    check((await page.locator('.focus-title').innerText()).includes('Buy dish soap'), tag + ': one tap puts the soap on the desk');

    // 4. Done with the soap: the dishes are free and can be dealt again.
    await page.click('[data-action="complete-focus"]');
    await page.waitForTimeout(1500);
    await page.evaluate(async () => { const M = await import('./js/mutations.js'); M.clearFocus(); M.pickFocus({ categoryId: 'c1' }); });
    st = await stored(page);
    check(st.focus && st.focus.taskId === 'dishes', tag + ': with the soap done, the dishes are dealt');
    await page.click('[data-action="set-screen"][data-screen="projects"]:visible');
    await page.waitForSelector('.task-row[data-task="dishes"]');
    check(await page.locator('.task-row[data-task="dishes"] .blocked-chip').count() === 0, tag + ': the dishes row no longer says anything is in the way');
    await ctx.close();
  }
} finally {
  await browser.close(); server.close();
}
console.log(bad ? bad + ' FAILED' : 'all passed');
process.exit(bad ? 1 : 0);
