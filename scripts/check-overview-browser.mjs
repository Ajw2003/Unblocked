// scripts/check-overview-browser.mjs -- the Overview screen in real Chromium (#12, part of the life dashboard),
// at 1440 and 390 wide, light and dark: no sideways scroll, the five-button rail inside the viewport, the
// week strip (7 columns, today first, overdue chips red), the count line and area cards matching the seed,
// done tasks hidden, chips and area cards navigating to Projects, and no console or page errors.
// Usage: node scripts/check-overview-browser.mjs
// Serves the repo root itself on 127.0.0.1:8138. Screenshots: docs/generated/overview/overview-<width>-<theme>.png
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join, extname, normalize } from 'node:path';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/generated/overview/');
mkdirSync(OUT, { recursive: true });
const BASE = 'http://127.0.0.1:8138/app/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = createServer((req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  let file = join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(8138, '127.0.0.1', ok));

let bad = 0;
const check = (ok, name, extra) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); if (!ok) bad++; };

// ---- the seed: 19 projects, 60 tasks, deadlines relative to the real today ----
const ymd = (offset) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const CATS = [
  { id: 'pcat_work', name: 'Work', color: 'hsl(210 55% 45%)' },
  { id: 'pcat_personal', name: 'Personal', color: 'hsl(150 50% 40%)' },
  { id: 'pcat_learning', name: 'Learning', color: 'hsl(35 65% 45%)' },
];
// 6 Work, 5 Personal, 4 Learning, 4 with no category = 19
const catOf = (i) => (i < 6 ? 'pcat_work' : i < 11 ? 'pcat_personal' : i < 15 ? 'pcat_learning' : null);
const NAMES = ['Quarterly planning and budget reconciliation for the whole regional team', 'Website', 'Hiring', 'Client onboarding revamp', 'Ops', 'Security review',
  'Flat', 'Garden and allotment', 'Family trip to the coast next summer', 'Health', 'Money admin',
  'Spanish', 'Piano grade 5 preparation and theory revision', 'Statistics course', 'Woodworking',
  'Shed clear-out', 'Car', 'Old photos scan and sort into albums by year', 'Misc'];
// offset cycle (days from today; null = undated): one overdue, three in the week, one later, the rest undated
const CYCLE = [null, null, 'over', null, 3, null, 10, null, 0, null, 5, null];
const projects = NAMES.map((name, i) => ({ id: 'p' + i, name, color: '#' + ((i * 2654435) % 0xffffff).toString(16).padStart(6, '0'), categoryId: catOf(i), tasks: [] }));
for (let i = 0; i < 60; i++) {
  const slot = CYCLE[i % 12];
  const offset = slot === 'over' ? -(Math.floor(i / 12) + 1) : slot;
  const title = 'Task ' + (i + 1) + (i % 4 === 0 ? ': a deliberately long task title that keeps going to test wrapping inside the narrow chip' : '');
  const done = i % 7 === 3;
  projects[i % 19].tasks.push({ id: 't' + i, title, status: done ? 'done' : 'next', updatedAt: 1, order: i, deadline: offset === null ? undefined : ymd(offset), completedAt: done ? Date.now() - 1000 : undefined });
}
const seed = { projects, projectCategories: CATS, categories: [], inbox: [], completedLog: [], deletedTaskIds: {}, choosingMode: { mode: 'twice', updatedAt: 1 } };
const all = projects.flatMap((p) => p.tasks.map((t) => Object.assign({ p }, t)));
const open = all.filter((t) => t.status !== 'done');
const stageOf = (t) => (t.deadline < ymd(0) ? 'over' : t.deadline <= ymd(6) ? 'week' : 'later');
const overdue = open.filter((t) => t.deadline && stageOf(t) === 'over');
const weekOpen = open.filter((t) => t.deadline && stageOf(t) === 'week');
const undated = open.filter((t) => !t.deadline);
const doneWeek = all.filter((t) => t.status === 'done' && t.deadline && stageOf(t) === 'week');
check(projects.length === 19, 'seed has exactly 19 projects', String(projects.length));
check(all.length === 60, 'seed has exactly 60 tasks', String(all.length));
check(projects.filter((p) => !p.categoryId).length >= 2, 'seed has at least 2 projects with no category');
check(overdue.length >= 3 && weekOpen.length >= 3 && undated.length >= 10 && open.some((t) => t.deadline && stageOf(t) === 'later'), 'seed spreads deadlines',
  'overdue ' + overdue.length + ', week ' + weekOpen.length + ', undated ' + undated.length);
check(doneWeek.length >= 1, 'seed has a done task with a deadline inside the week', doneWeek.map((t) => t.id).join());
const expectAreas = CATS.filter((c) => projects.some((p) => p.categoryId === c.id)).map((c) => c.name).concat('No area');

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });

for (const size of ['1440', '390']) for (const scheme of ['light', 'dark']) {
  const phone = size === '390';
  const tag = size + ' ' + scheme + ': ';
  const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, colorScheme: scheme, serviceWorkers: 'block', hasTouch: phone });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { bad++; console.log('FAIL ' + tag + 'page error: ' + e.message); });
  page.on('console', (m) => { if (m.type() === 'error') { bad++; console.log('FAIL ' + tag + 'console error: ' + m.text()); } });
  await page.addInitScript((s) => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    localStorage.setItem('unblock-onboarding', 'done'); localStorage.setItem('unblock-screen', 'focus');
    localStorage.setItem('unblock-state-v1', JSON.stringify(s));
  }, seed);
  await page.goto(BASE);
  await page.waitForSelector('.rail-item');
  const noSideways = async (label) => check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), tag + 'no sideways scroll ' + label);

  // the rail / bottom bar
  const boxes = await page.$$eval('.rail-item', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }));
  const vp = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  check(boxes.length === 5, tag + 'rail shows 5 buttons', String(boxes.length));
  check(boxes.every((b) => b.w > 0 && b.h > 0 && b.l >= 0 && b.t >= 0 && b.r <= vp.w && b.b <= vp.h), tag + 'all 5 rail buttons fully inside the viewport');

  await page.click('.rail-item[data-screen="overview"]');
  await page.waitForSelector('.screen-overview .overview-day');
  await noSideways('on Overview');
  check((await page.$$('.screen-overview .overview-day')).length === 7, tag + '7 day columns');
  check(await page.$eval('.overview-day:first-child', (e) => e.getAttribute('aria-current') === 'date'), tag + 'first column is today (aria-current=date)');

  // overdue chips in the first column
  const firstCol = page.locator('.overview-day').first();
  let okOver = true; const missing = [];
  for (const t of overdue) {
    const chip = firstCol.locator('.overview-chip[data-task-id="' + t.id + '"]');
    const good = (await chip.count()) === 1 && /due-red/.test((await chip.getAttribute('class')) || '') && /overdue/.test(await chip.innerText());
    if (!good) { okOver = false; missing.push(t.id); }
  }
  check(okOver, tag + 'all ' + overdue.length + ' overdue tasks are red "overdue" chips in the first column', missing.join());

  // done tasks stay off the screen
  const text = await page.$eval('.screen-overview', (e) => e.textContent);
  check(doneWeek.every((t) => !text.includes(t.title + ' ') && (text.match(new RegExp('Task ' + t.title.match(/^Task (\d+)/)[1] + '(?!\\d)', 'g')) || []).length === 0)
    && (await page.$$('.screen-overview [data-task-id]')).length === (await page.$$eval('.screen-overview .overview-chip', (e) => e.length)), tag + 'the done task with a week deadline is not on the screen', doneWeek.map((t) => t.id).join());

  // count line
  const counts = (await page.$eval('.overview-counts', (e) => e.textContent)).match(/^(\d+) overdue · (\d+) tasks? due in the next 7 days · (\d+) with no date$/);
  check(!!counts && +counts[1] === overdue.length && +counts[2] === weekOpen.length && +counts[3] === undated.length, tag + 'count line matches the seed',
    (counts ? counts.slice(1).join('/') : 'unparsed') + ' vs ' + [overdue.length, weekOpen.length, undated.length].join('/'));

  // area cards
  const areas = await page.$$eval('.overview-area-name', (els) => els.map((e) => e.textContent));
  check(JSON.stringify(areas) === JSON.stringify(expectAreas), tag + 'one area card per non-empty category plus No area', areas.join(', '));

  await page.screenshot({ path: OUT + 'overview-' + size + '-' + scheme + '.png', fullPage: false });

  // a task chip opens its project
  const target = weekOpen[0];
  await page.click('.overview-chip[data-task-id="' + target.id + '"]');
  await page.waitForSelector('.project-card');
  const onProjects = await page.evaluate(() => !document.querySelector('.screen-overview') && document.querySelector('.rail-item[aria-current="page"]').getAttribute('data-screen'));
  const card = page.locator('#proj-' + target.p.id);
  const current = await page.$$eval('.sidebar-project[aria-current="true"]', (els) => els.map((e) => e.getAttribute('data-project')));
  check(onProjects === 'projects' && (await card.count()) === 1 && (await card.isVisible()) && (current.length === 0 || current[0] === target.p.id),
    tag + 'a task chip opens Projects with that project shown', target.p.name.slice(0, 30) + (current.length ? ' (selected ' + current[0] + ')' : ''));
  await noSideways('on Projects');

  // an area card filters Projects
  await page.click('.rail-item[data-screen="overview"]');
  await page.waitForSelector('.screen-overview .overview-area');
  for (const [label, catId] of [['Learning', 'pcat_learning'], ['No area', null]]) {
    await page.click('.overview-area:has(.overview-area-name:text-is("' + label + '"))');
    await page.waitForSelector('.sidebar-project', { state: 'attached' });
    const names = await page.$$eval('.sidebar-name', (els) => els.map((e) => e.textContent).sort());
    const want = projects.filter((p) => (p.categoryId || null) === catId).map((p) => p.name).sort();
    check(JSON.stringify(names) === JSON.stringify(want), tag + label + ' card filters Projects to its ' + want.length + ' projects', names.length + ' listed');
    await page.click('.rail-item[data-screen="overview"]');
    await page.waitForSelector('.screen-overview .overview-area');
  }
  await ctx.close();
}
await browser.close(); server.close();
console.log(bad ? 'FAILED (' + bad + ')' : 'all overview checks passed');
process.exit(bad ? 1 : 0);
