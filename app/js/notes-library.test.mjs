// run with: node --test app/js/notes-library.test.mjs  (Notes library pure layer, #17)
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeImport, waitingCount, notesBySource, listNotes, importIntoLibrary } from './notes-library.js';

const note = (o) => ({ id: 'keep:a', source: 'keep', sourceId: 'a', title: 'T', text: 'body', items: [],
  labels: [], createdAt: 1, editedAt: 2, importedAt: 5, status: 'waiting', ...o });

test('new note is added as waiting', () => {
  const r = mergeImport([], [note({ status: 'x' })], 10);
  assert.deepEqual([r.added, r.updated, r.skipped], [1, 0, 0]);
  assert.equal(r.notes[0].status, 'waiting');
});

test('identical Keep note re-imported is skipped by id', () => {
  const r = mergeImport([note()], [note()], 10);
  assert.deepEqual([r.added, r.updated, r.skipped, r.notes.length], [0, 0, 1, 1]);
});

test('text note re-imported with identical content is skipped', () => {
  const t = note({ id: 'text:h1', source: 'text', sourceId: null });
  const r = mergeImport([t], [{ ...t, importedAt: 99 }], 10);
  assert.equal(r.skipped, 1);
  assert.equal(r.notes.length, 1);
});

test('edited Keep note is updated while waiting', () => {
  const r = mergeImport([note()], [note({ text: 'new', editedAt: 7 })], 10);
  assert.deepEqual([r.added, r.updated, r.skipped], [0, 1, 0]);
  const n = r.notes[0];
  assert.deepEqual([n.text, n.editedAt, n.updatedAt, n.status, n.importedAt], ['new', 7, 10, 'waiting', 5]);
});

for (const status of ['triaged', 'archived']) {
  test('the same edit is skipped and untouched when ' + status, () => {
    const cur = note({ status });
    const r = mergeImport([cur], [note({ text: 'new', editedAt: 7 })], 10);
    assert.deepEqual([r.updated, r.skipped], [0, 1]);
    assert.deepEqual(r.notes[0], cur);
  });
}

test('same content under a different id is skipped', () => {
  const r = mergeImport([note()], [note({ id: 'text:h9', source: 'text' })], 10);
  assert.deepEqual([r.added, r.skipped, r.notes.length], [0, 1, 1]);
});

test('waitingCount and notesBySource', () => {
  const ns = [note({ id: '1' }), note({ id: '2', status: 'triaged' }), note({ id: '3', source: 'text' }),
    note({ id: '4', source: 'word' }), note({ id: '5', source: 'word' })];
  assert.equal(waitingCount(ns), 4);
  assert.deepEqual(notesBySource(ns), { keep: 2, text: 1, word: 2 });
});

test('listNotes filters by source, status, query; newest first', () => {
  const ns = [
    note({ id: '1', title: 'old', editedAt: 1 }),
    note({ id: '2', title: 'new', editedAt: 9, items: [{ text: 'Buy Milk', checked: false }] }),
    note({ id: '3', title: 'mid', source: 'text', editedAt: null, createdAt: 5, labels: ['Garden'], status: 'triaged' }),
    note({ id: '4', title: 'imp', editedAt: null, createdAt: null, importedAt: 3 }),
  ];
  assert.deepEqual(listNotes(ns).map((n) => n.id), ['2', '3', '4', '1']);
  assert.deepEqual(listNotes(ns, { source: 'text' }).map((n) => n.id), ['3']);
  assert.deepEqual(listNotes(ns, { status: 'triaged' }).map((n) => n.id), ['3']);
  assert.deepEqual(listNotes(ns, { query: 'milk' }).map((n) => n.id), ['2']);
  assert.deepEqual(listNotes(ns, { query: 'GARDEN' }).map((n) => n.id), ['3']);
});

test('importIntoLibrary saves only changed notes (fake store)', async () => {
  const saved = [];
  const lib = { all: async () => [note()], saveAll: async (n) => { saved.push(...n); } };
  const r = await importIntoLibrary(lib, [note(), note({ id: 'keep:b', sourceId: 'b', text: 'other' })], 10);
  assert.deepEqual(r, { added: 1, updated: 0, skipped: 1 });
  assert.deepEqual(saved.map((n) => n.id), ['keep:b']);
});
