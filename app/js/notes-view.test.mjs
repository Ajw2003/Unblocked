// run with: node --test app/js/notes-view.test.mjs  (Sort screen Notes tab markup, #18)
import test from 'node:test';
import assert from 'node:assert';
import { renderSortTabs, renderNotesPanel } from './notes-view.js';

const note = (o) => Object.assign({ id: 'keep:1', source: 'keep', title: 'Shop', text: '', items: [], labels: [], status: 'waiting' }, o);
const view = (o) => Object.assign({ notes: [], counts: { keep: 0, text: 0, word: 0 }, waiting: 0, query: '', source: '', preview: null }, o);

test('tabs show counts and mark the active one', () => {
  const html = renderSortTabs('notes', { unsortedCount: 3, waitingNotes: 212 });
  assert.ok(html.includes('Unsorted (3)') && html.includes('Notes (212 waiting)'));
  assert.ok(/data-tab="notes" aria-selected="true"/.test(html) && /data-tab="unsorted" aria-selected="false"/.test(html));
});

test('empty library explains each export', () => {
  const html = renderNotesPanel(view());
  for (const s of ['Google Takeout', 'Samsung Notes', 'Apple Notes', 'Google Docs']) assert.ok(html.includes(s), s);
  assert.ok(html.includes('id="import-files"') && html.includes('import-drop') && html.includes('PDFs aren&#39;t read yet'));
});

test('preview shows counts, skipped reasons and buttons', () => {
  const preview = { notes: [note({}), note({ id: 'k2' })], counts: { keep: 2, word: 0, text: 0 }, already: 1, skipped: [{ name: 'a.pdf', reason: 'PDFs are not read yet' }] };
  const html = renderNotesPanel(view({ preview }));
  assert.ok(html.includes('Found 2 notes: Keep 2 · Word 0 · Text 0'));
  assert.ok(html.includes('1 note already in your library will be skipped or updated'));
  assert.ok(html.includes('a.pdf') && html.includes('PDFs are not read yet'));
  assert.ok(html.includes('data-action="import-confirm"') && html.includes('Import 2 notes') && html.includes('data-action="import-cancel"'));
});

test('note card: checklist count, labels, archived, escaping', () => {
  const n = note({ title: '<b>Hi</b>', items: [{ text: 'a', checked: true }, { text: 'b', checked: false }, { text: 'c', checked: false }], labels: ['Home'], archived: true });
  const html = renderNotesPanel(view({ notes: [n], counts: { keep: 1, text: 0, word: 0 } }));
  assert.ok(html.includes('1 of 3 ticked') && html.includes('Home') && html.includes('archived in Keep'));
  assert.ok(!html.includes('<b>Hi') && html.includes('&lt;b&gt;Hi'));
});

test('active source pill is marked', () => {
  const html = renderNotesPanel(view({ notes: [note({})], counts: { keep: 1, text: 0, word: 0 }, source: 'keep' }));
  assert.ok(/is-active" data-action="notes-source" data-source="keep" aria-pressed="true"/.test(html));
  assert.ok(/data-source="" aria-pressed="false"/.test(html));
});
