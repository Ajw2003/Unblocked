// run with: node --test app/js/import-read.test.mjs  (Importer file readers, #16)
import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { readKeepJson, readText, readDocxXml, readFiles, browserJSZip } from './import-read.js';

const JSZip = createRequire(import.meta.url)('../vendor/jszip.min.js');
const NOW = 1760000000000;

const keepList = {
  title: 'Shopping', isTrashed: false, isArchived: false,
  listContent: [{ text: 'milk', isChecked: true }, { text: 'eggs', isChecked: false }],
  labels: [{ name: 'home' }, { name: 'weekly' }],
  createdTimestampUsec: 1700000000000000, userEditedTimestampUsec: 1700000100000000,
};
const keepText = { title: 'Idea', textContent: 'Build a thing', isTrashed: false, isArchived: false };

const docXml = (paras) => '<w:document><w:body>' + paras.join('') + '</w:body></w:document>';
const para = (text, extra = '') => `<w:p><w:pPr>${extra}</w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const sampleDoc = docXml([
  para('Trip plan', '<w:pStyle w:val="Heading1"/>'),
  para('Fish &amp; chips by the sea'),
  '<w:p></w:p>',
  para('Pack bags', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'),
  para('Book &lt;hotel&gt;', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'),
]);

async function docxBytes(xml) {
  const z = new JSZip();
  z.file('word/document.xml', xml);
  return z.generateAsync({ type: 'uint8array' });
}

test('Keep checklist: items, labels, microseconds to ms, id from file name', () => {
  const n = readKeepJson(keepList, 'Shopping.json', NOW);
  assert.strictEqual(n.id, 'keep:Shopping');
  assert.strictEqual(n.source, 'keep');
  assert.deepStrictEqual(n.items, [{ text: 'milk', checked: true }, { text: 'eggs', checked: false }]);
  assert.deepStrictEqual(n.labels, ['home', 'weekly']);
  assert.strictEqual(n.createdAt, 1700000000000);
  assert.strictEqual(n.editedAt, 1700000100000);
  assert.strictEqual(n.importedAt, NOW);
  assert.strictEqual(n.status, 'waiting');
  assert.strictEqual(n.archived, undefined);
});

test('trashed Keep note is null', () => {
  assert.strictEqual(readKeepJson({ ...keepText, isTrashed: true }, 'x.json', NOW), null);
});

test('archived Keep note is imported and flagged', () => {
  const n = readKeepJson({ ...keepText, isArchived: true }, 'Idea.json', NOW);
  assert.strictEqual(n.archived, true);
  assert.strictEqual(n.text, 'Build a thing');
});

test('Markdown: title, text and checklist lines', () => {
  const n = readText('# My Title\n\nSome text\n- [ ] one\n* [x] two\nmore\n', 'a.md', NOW);
  assert.strictEqual(n.title, 'My Title');
  assert.strictEqual(n.text, 'Some text\nmore');
  assert.deepStrictEqual(n.items, [{ text: 'one', checked: false }, { text: 'two', checked: true }]);
  assert.strictEqual(n.source, 'text');
  assert.strictEqual(n.sourceId, null);
});

test('docx XML: Heading1 title, paragraph, numPr items, entities decoded', () => {
  const n = readDocxXml(sampleDoc, 'trip.docx', NOW);
  assert.strictEqual(n.source, 'word');
  assert.strictEqual(n.title, 'Trip plan');
  assert.strictEqual(n.text, 'Fish & chips by the sea');
  assert.deepStrictEqual(n.items, [{ text: 'Pack bags', checked: false }, { text: 'Book <hotel>', checked: false }]);
});

test('docx file is opened through JSZip', async () => {
  const r = await readFiles([{ name: 'trip.docx', data: await docxBytes(sampleDoc) }], { JSZip, now: NOW });
  assert.strictEqual(r.notes.length, 1);
  assert.strictEqual(r.notes[0].title, 'Trip plan');
  assert.deepStrictEqual(r.skipped, []);
});

test('Takeout zip: Keep notes, trash skipped, html and text handled', async () => {
  const z = new JSZip();
  z.file('Takeout/Keep/Shopping.json', JSON.stringify(keepList));
  z.file('Takeout/Keep/Idea.json', JSON.stringify(keepText));
  z.file('Takeout/Keep/Old.json', JSON.stringify({ ...keepText, isTrashed: true }));
  z.file('Takeout/Keep/Shopping.html', '<html></html>');
  z.file('Takeout/Keep/loose.txt', 'Loose\nbody');
  const data = await z.generateAsync({ type: 'arraybuffer' });
  const r = await readFiles([{ name: 'takeout.zip', data }], { JSZip, now: NOW });
  assert.deepStrictEqual(r.notes.map((n) => n.id).sort(), ['keep:Idea', 'keep:Shopping', r.notes.find((n) => n.source === 'text').id].sort());
  assert.strictEqual(r.notes.length, 3);
  assert.ok(r.skipped.some((s) => s.name.endsWith('Shopping.html') && s.reason === 'not a note'));
  assert.ok(r.skipped.some((s) => s.name.endsWith('Old.json')));
  assert.strictEqual(r.skipped.length, 2);
});

test('corrupt zip and bad JSON are reported, never thrown', async () => {
  const r = await readFiles([
    { name: 'bad.zip', data: new Uint8Array([1, 2, 3, 4]) },
    { name: 'bad.json', data: '{not json' },
    { name: 'broken.docx', data: new Uint8Array([9, 9]) },
  ], { JSZip, now: NOW });
  assert.strictEqual(r.notes.length, 0);
  assert.deepStrictEqual(r.skipped.map((s) => s.name), ['bad.zip', 'bad.json', 'broken.docx']);
  r.skipped.forEach((s) => assert.ok(s.reason.length > 0));
});

test('pdf and unknown types are skipped with a reason', async () => {
  const r = await readFiles([{ name: 'a.pdf', data: new Uint8Array() }, { name: 'a.xyz', data: '' }], { JSZip, now: NOW });
  assert.deepStrictEqual(r.skipped, [
    { name: 'a.pdf', reason: 'PDF files are not read yet' },
    { name: 'a.xyz', reason: 'unknown file type' },
  ]);
});

test('same text imported twice gets the same id; different text does not', () => {
  const a = readText('# T\nbody', 'one.md', NOW);
  const b = readText('# T\nbody', 'two.md', NOW + 5);
  assert.strictEqual(a.id, b.id);
  assert.notStrictEqual(a.id, readText('# T\nbody!', 'one.md', NOW).id);
});

test('browserJSZip is null when no script defined it', () => {
  assert.strictEqual(browserJSZip(), null);
});
