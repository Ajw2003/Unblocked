// unblock/js/import-read.js -- the pure file readers for the Importer (#16).
// Turns Keep JSON, text/Markdown, Word XML and zips of those into one note shape (docs/4-systems/importer.md).
// Pure: no DOM, no storage, no clock of its own (the caller passes `now` for importedAt).
// JSZip is a UMD build with no ES export, so it is never imported here: the browser's classic
// <script> defines window.JSZip, Node tests require it, and callers pass the constructor in.

// The constructor the browser's <script src="vendor/jszip.min.js"> tag defined, or null if it did not load.
export function browserJSZip() {
  return (typeof globalThis !== 'undefined' && globalThis.JSZip) || null;
}

// Tiny deterministic string hash (FNV-1a, 32-bit) so the same text always gets the same id.
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function baseName(name) {
  return String(name).split('/').pop();
}

function stripExt(name) {
  return baseName(name).replace(/\.[^.]*$/, '');
}

// Builds a note; id is source:sourceId, or a hash of title+text when the export has no id of its own.
function makeNote(f, now) {
  const hasId = f.sourceId !== undefined && f.sourceId !== null && f.sourceId !== '';
  const sourceId = hasId ? String(f.sourceId) : null;
  const title = f.title || '';
  const text = f.text || '';
  const items = f.items || [];
  const itemText = items.map((i) => (i.checked ? 'x ' : '- ') + i.text).join('\n');
  const note = {
    id: f.source + ':' + (hasId ? sourceId : 'h' + hash(title + '\n' + text + '\n' + itemText)),
    source: f.source,
    sourceId,
    title,
    text,
    items,
    labels: f.labels || [],
    createdAt: f.createdAt === undefined ? null : f.createdAt,
    editedAt: f.editedAt === undefined ? null : f.editedAt,
    importedAt: now,
    status: 'waiting',
  };
  if (f.archived) note.archived = true;
  return note;
}

// Keep stores microseconds; returns ms, or null when absent or not a number.
function usecToMs(v) {
  const n = Number(v);
  return v === undefined || v === null || !isFinite(n) ? null : Math.round(n / 1000);
}

// One Keep Takeout note object -> note, or null when it is in the bin.
export function readKeepJson(obj, fileName, now) {
  if (obj.isTrashed === true) return null;
  const items = (Array.isArray(obj.listContent) ? obj.listContent : [])
    .map((i) => ({ text: String(i.text || ''), checked: i.isChecked === true }));
  const labels = (Array.isArray(obj.labels) ? obj.labels : [])
    .map((l) => (l && l.name) || '').filter(Boolean);
  return makeNote({
    source: 'keep',
    sourceId: stripExt(fileName),
    title: obj.title || '',
    text: obj.textContent || '',
    items,
    labels,
    createdAt: usecToMs(obj.createdTimestampUsec),
    editedAt: usecToMs(obj.userEditedTimestampUsec),
    archived: obj.isArchived === true,
  }, now);
}

const CHECK_LINE = /^\s*[-*]\s+\[( |x|X)\]\s+/;

// .txt / .md contents -> note. First non-empty line is the title; checklist lines become items.
export function readText(text, fileName, now) {
  const lines = String(text).split(/\r?\n/);
  const first = lines.findIndex((l) => l.trim() !== '');
  let title = '';
  if (first >= 0) title = lines[first].replace(/^\s*#+\s*/, '').trim();
  const items = [];
  const rest = [];
  lines.forEach((line, i) => {
    if (i <= first) return;
    const m = line.match(CHECK_LINE);
    if (m) items.push({ text: line.replace(CHECK_LINE, '').trim(), checked: m[1] !== ' ' });
    else rest.push(line);
  });
  return makeNote({ source: 'text', title, text: rest.join('\n').trim(), items }, now);
}

function decodeXml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

// word/document.xml contents -> note. Regex scan, so it needs no DOMParser and runs in Node.
export function readDocxXml(documentXml, fileName, now) {
  const paras = [];
  for (const m of String(documentXml).matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
    const p = m[0];
    let text = '';
    for (const t of p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) text += decodeXml(t[1]);
    text = text.trim();
    if (!text) continue;
    const style = (p.match(/<w:pStyle\s+w:val="([^"]*)"/) || [])[1];
    paras.push({ text, list: /<w:numPr[ >\/]/.test(p), heading: style === 'Title' || style === 'Heading1' });
  }
  // a Title/Heading1 first paragraph is the title; otherwise the first paragraph is
  const titleAt = paras.length ? 0 : -1;
  const title = titleAt >= 0 ? paras[titleAt].text : '';
  const items = [];
  const body = [];
  paras.forEach((p, i) => {
    if (i === titleAt) return;
    if (p.list) items.push({ text: p.text, checked: false });
    else body.push(p.text);
  });
  return makeNote({ source: 'word', title: title || stripExt(fileName), text: body.join('\n'), items }, now);
}

const ext = (name) => (baseName(name).match(/\.([^.]+)$/) || [])[1]?.toLowerCase() || '';

function describe(e) {
  return (e && e.message) ? e.message : 'could not be read';
}

// A Keep note inside a zip: under Keep/, or any .json that looks like one.
function parseKeep(str, name, now) {
  const obj = JSON.parse(str);
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return undefined;
  const inKeep = /(^|\/)Keep\//.test(name);
  if (!inKeep && obj.textContent === undefined && obj.listContent === undefined) return undefined;
  return readKeepJson(obj, name, now);
}

async function readDocx(data, name, JSZip, now) {
  const zip = await JSZip.loadAsync(data);
  const entry = zip.file('word/document.xml');
  if (!entry) throw new Error('not a Word document (no word/document.xml)');
  return readDocxXml(await entry.async('string'), name, now);
}

// Reads one file into `out`: out.notes gets notes, out.skipped gets { name, reason }. Never throws.
async function readOne(file, JSZip, now, out) {
  const { name, data } = file;
  const skip = (reason) => out.skipped.push({ name, reason });
  const kind = ext(name);
  try {
    if (kind === 'json') {
      const note = parseKeep(data, name, now);
      if (note === undefined) skip('not a note');
      else if (note) out.notes.push(note);
      else out.skipped.push({ name, reason: 'in the Keep bin' });
    } else if (kind === 'txt' || kind === 'md') {
      out.notes.push(readText(data, name, now));
    } else if (kind === 'docx') {
      out.notes.push(await readDocx(data, name, JSZip, now));
    } else if (kind === 'zip') {
      const zip = await JSZip.loadAsync(data);
      const entries = Object.values(zip.files).filter((e) => !e.dir);
      for (const e of entries) {
        const k = ext(e.name);
        if (k === 'json' || k === 'txt' || k === 'md') {
          await readOne({ name: e.name, data: await e.async('string') }, JSZip, now, out);
        } else if (k === 'docx') {
          await readOne({ name: e.name, data: await e.async('uint8array') }, JSZip, now, out);
        } else {
          out.skipped.push({ name: e.name, reason: 'not a note' });
        }
      }
    } else if (kind === 'pdf') {
      skip('PDF files are not read yet');
    } else {
      skip('unknown file type');
    }
  } catch (e) {
    skip('could not be read: ' + describe(e));
  }
}

// files: [{ name, data }] (string for .json/.txt/.md, ArrayBuffer/Uint8Array for .zip/.docx).
// Returns { notes, skipped: [{ name, reason }] }; a bad file is reported, never thrown.
export async function readFiles(files, { JSZip, now }) {
  const out = { notes: [], skipped: [] };
  for (const file of files) await readOne(file, JSZip, now, out);
  return out;
}
