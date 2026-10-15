// unblock/js/notes-view.js
// The Sort screen's Notes tab (#18): tabs, the import area with its preview, and the notes list.
// Pure view functions returning HTML strings; js/app.js reads the files, keeps the library and wires
// the events. Nothing here touches tasks, projects or the inbox. See docs/4-systems/importer.md
import { esc } from './state.js';

const SOURCES = [['', 'All'], ['keep', 'Keep'], ['word', 'Word'], ['text', 'Text']];
const SOURCE_NAME = { keep: 'Keep', word: 'Word', text: 'Text' };

export function renderSortTabs(active, { unsortedCount = 0, waitingNotes = 0 } = {}) {
  const tab = (id, label) => '<button type="button" role="tab" class="sort-tab' + (active === id ? ' is-active' : '') + '" data-action="sort-tab" data-tab="' + id
    + '" aria-selected="' + (active === id) + '">' + esc(label) + '</button>';
  return '<div class="sort-tabs" role="tablist" aria-label="Sort">'
    + tab('unsorted', 'Unsorted (' + unsortedCount + ')') + tab('notes', 'Notes (' + waitingNotes + ' waiting)') + '</div>';
}

const plural = (c, one, many) => c + ' ' + (c === 1 ? one : many);

function importArea() {
  return '<div class="import-area"><label class="import-label" for="import-files">Import notes from files</label>'
    + '<input type="file" id="import-files" class="import-input" multiple accept=".zip,.json,.txt,.md,.docx">'
    + '<div class="import-drop" id="import-drop"><p>Drop a Google Takeout zip, or Word, text or Markdown files</p>'
    + '<p class="import-hint">PDFs aren&#39;t read yet. Samsung Notes can export Word or Text instead.</p></div></div>';
}

function previewCard(p, busy) {
  const c = p.counts || {};
  const total = p.notes.length;
  const skipped = (p.skipped || []).map((s) => '<li><b>' + esc(s.name) + '</b>: ' + esc(s.reason) + '</li>').join('');
  return '<div class="import-preview" role="status"><h3>Found ' + plural(total, 'note', 'notes') + ': Keep ' + (c.keep || 0) + ' · Word ' + (c.word || 0) + ' · Text ' + (c.text || 0) + '</h3>'
    + '<p>' + plural(p.already || 0, 'note', 'notes') + ' already in your library will be skipped or updated</p>'
    + (skipped ? '<p>Files not read:</p><ul class="import-skipped">' + skipped + '</ul>' : '')
    + '<div class="import-actions"><button type="button" class="btn primary" data-action="import-confirm"' + (busy ? ' disabled' : '') + '>Import ' + plural(total, 'note', 'notes') + '</button>'
    + '<button type="button" class="btn" data-action="import-cancel">Cancel</button></div></div>';
}

function emptyState() {
  return '<div class="notes-empty"><h3>No notes yet</h3><p>Export your notes, then drop the file above.</p><ul>'
    + '<li><b>Google Keep:</b> Google Takeout, with only Keep ticked.</li>'
    + '<li><b>Samsung Notes:</b> Save as file, then choose Word or Text.</li>'
    + '<li><b>Apple Notes:</b> Export to Markdown on a Mac.</li>'
    + '<li><b>Google Docs:</b> Takeout of Drive, or download as Word.</li></ul></div>';
}

export function noteCard(n) {
  const items = n.items || [];
  const ticked = items.filter((i) => i.checked).length;
  let body = String(n.text || '').trim();
  if (!body && items.length) body = items.map((i) => i.text).join(', ');
  if (body.length > 140) body = body.slice(0, 140).trimEnd() + '…';
  return '<li class="note-card"><div class="note-card-top"><span class="source-badge source-' + esc(n.source) + '">' + esc(SOURCE_NAME[n.source] || n.source) + '</span>'
    + (n.status === 'archived' ? '<span class="note-archived">archived in Keep</span>' : '') + '</div>'
    + '<h3 class="note-card-title">' + esc(n.title || 'Untitled') + '</h3>'
    + (body ? '<p class="note-card-body">' + esc(body) + '</p>' : '')
    + (items.length ? '<p class="note-card-count">' + ticked + ' of ' + items.length + ' ticked</p>' : '')
    + ((n.labels || []).length ? '<p class="note-card-labels">' + n.labels.map((l) => '<span class="note-label">' + esc(l) + '</span>').join('') + '</p>' : '')
    + '</li>';
}

export function renderNotesPanel(view) {
  const v = view || {};
  const notes = v.notes || [];
  const counts = v.counts || {};
  const total = (counts.keep || 0) + (counts.text || 0) + (counts.word || 0);
  const pills = SOURCES.map(([id, label]) => '<button type="button" class="source-pill' + ((v.source || '') === id ? ' is-active' : '') + '" data-action="notes-source" data-source="' + id
    + '" aria-pressed="' + ((v.source || '') === id) + '">' + label + '</button>').join('');
  let list;
  if (!total) list = emptyState();
  else if (!notes.length) list = '<p class="notes-none">No notes match.</p>';
  else list = '<ul class="notes-list">' + notes.map(noteCard).join('') + '</ul>';
  return '<div class="notes-panel">' + importArea()
    + (v.busy ? '<p class="import-busy" role="status">Reading files…</p>' : '')
    + (v.error ? '<p class="import-error" role="alert">' + esc(v.error) + '</p>' : '')
    + (v.preview ? previewCard(v.preview, v.busy) : '')
    + (total ? '<div class="notes-tools"><label class="sr-only" for="notes-query">Search notes</label>'
      + '<input type="search" id="notes-query" class="notes-query" placeholder="Search notes" value="' + esc(v.query || '') + '">'
      + '<div class="source-pills">' + pills + '</div></div>' : '')
    + list + '</div>';
}
