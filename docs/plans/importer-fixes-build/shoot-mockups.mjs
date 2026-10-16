// docs/plans/importer-fixes-build/shoot-mockups.mjs -- pictures for the importer fixes build plan.
// The "before" card is drawn by the app's real noteCard() (app/js/notes-view.js) from a one-paragraph
// note, the way a Samsung Notes text export imports today. The "after" card and the note view are
// mockups in the app's own stylesheet (app/css/app.css). The sample note is made up.
// Usage: node docs/plans/importer-fixes-build/shoot-mockups.mjs
// Output: docs/plans/importer-fixes-build/pics/{card-before,card-after,note-view}-{light,dark}.png
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { noteCard } from '../../../app/js/notes-view.js';
const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUT = join(HERE, 'pics');
mkdirSync(OUT, { recursive: true });

const LONG = 'Thinking about finally building the garden shed this spring, I would need to measure the corner by the fence, price up timber and a felt roof, and ask Sam whether he still has the spare door from his old shed before I order anything at all.';
const SHORT_TITLE = LONG.split(/\s+/).slice(0, 8).join(' ').replace(/[,.;:]$/, '') + '…';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const before = noteCard({ source: 'text', title: LONG, text: '', items: [], labels: [] })
  + noteCard({ source: 'text', title: 'Groceries for Sunday', text: 'Eggs, flour, the good coffee', items: [], labels: [] });
const after = noteCard({ source: 'text', title: SHORT_TITLE, text: LONG, items: [], labels: [] })
  + noteCard({ source: 'text', title: 'Groceries for Sunday', text: 'Eggs, flour, the good coffee', items: [], labels: [] });

// The note view: its own screen, opened by tapping a card (decision 1A in docs/6-decisions/Decisions.md).
const noteView = '<div class="mock-view">'
  + '<button type="button" class="btn mock-back">‹ Back to notes</button>'
  + '<p class="mock-meta"><span class="source-badge source-text">Text</span> From <b>shed-plans.txt</b> · imported 16 Oct 2026</p>'
  + '<label class="mock-label" for="mock-title">Title</label>'
  // two rows: an eight-word title does not fit one line of a phone-width box
  + '<textarea id="mock-title" class="notes-query mock-title" rows="2">' + esc(SHORT_TITLE) + '</textarea>'
  + '<p class="mock-hint">Tap the title to rename the note. A later re-import keeps your title.</p>'
  + '<div class="mock-body"><p>' + esc(LONG) + '</p></div>'
  + '<ul class="mock-items"><li><span class="mock-box">✓</span> Measure the corner by the fence</li><li><span class="mock-box"></span> Ask Sam about the spare door</li></ul>'
  + '<p class="note-card-labels"><span class="note-label">Garden</span></p>'
  + '</div>';

const page = (inner) => '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Young+Serif&family=Figtree:wght@400;500;600;700&family=Atkinson+Hyperlegible:wght@400;700&display=swap">'
  + '<link rel="stylesheet" href="' + pathToFileURL(join(HERE, '../../../app/css/app.css')).href + '">'
  + '<style>body{margin:0;padding:16px;background:var(--bg);color:var(--ink);font-family:var(--font-ui);}'
  + '.mock-view{display:flex;flex-direction:column;gap:10px;max-width:720px;}'
  + '.mock-back{align-self:flex-start;}'
  + '.mock-meta{margin:0;display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:var(--ink-soft);font-size:var(--text-sm);}'
  + '.mock-label{font-weight:600;font-size:var(--text-sm);color:var(--ink-soft);}'
  + '.mock-title{font-family:var(--font-display);font-size:1.25rem;line-height:1.3;resize:none;}'
  + '.mock-hint{margin:0;color:var(--ink-soft);font-size:var(--text-sm);}'
  + '.mock-body{padding:12px;border:1px solid var(--line);border-radius:var(--r-control);background:var(--surface);line-height:1.5;}'
  + '.mock-body p{margin:0;}'
  + '.mock-items{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;}'
  + '.mock-items li{display:flex;gap:8px;align-items:center;}'
  + '.mock-box{width:18px;height:18px;border:1.5px solid var(--ink-soft);border-radius:4px;display:inline-grid;place-items:center;font-size:12px;color:var(--accent);}'
  + '</style></head><body><div class="notes-panel">' + inner + '</div></body></html>';

const shots = [
  ['card-before', '<ul class="notes-list">' + before + '</ul>'],
  ['card-after', '<ul class="notes-list">' + after + '</ul>'],
  ['note-view', noteView],
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, colorScheme: scheme });
  const tab = await ctx.newPage();
  for (const [name, inner] of shots) {
    const file = join(HERE, 'mock-' + name + '.html');
    writeFileSync(file, page(inner));
    await tab.goto(pathToFileURL(file).href, { waitUntil: 'load' });
    await tab.evaluate(() => document.fonts.ready);
    const panel = tab.locator('.notes-panel');
    await panel.screenshot({ path: join(OUT, name + '-' + scheme + '.png') });
    const box = await panel.boundingBox();
    const sideways = await tab.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    console.log('shot ' + name + '-' + scheme + '.png ' + Math.round(box.width) + 'x' + Math.round(box.height) + (sideways ? ' SIDEWAYS SCROLL' : ''));
  }
  await ctx.close();
}
await browser.close();
