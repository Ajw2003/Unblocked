# Importer and Notes library

**Status: built on this branch (issues #16 to #19), not yet tried on a real export.** Design approved
2026-10-15 (the life dashboard entry in `docs/6-decisions/Decisions.md`); build plan
`docs/plans/importer-build-plan.html`. Checked in real Chromium by `scripts/check-importer-browser.mjs`
with generated sample exports; waiting on aj to import a real Takeout zip. Triage (U8, #14) is not built.

## What it owns

Reading exported notes on the device and keeping them in a Notes library, so that triage can turn them
into tasks one note at a time. It owns the file readers (`app/js/import-read.js`), the library
(`app/js/notes-library.js`), the Notes tab markup (`app/js/notes-view.js`) and the Overview strip's
notes count. Nothing is uploaded: files are read in the browser with `File.text()` / `arrayBuffer()`
(`app/js/app.js:445-448`).

## How it works

- **Readers are pure** (`app/js/import-read.js:1-5`): no DOM, no storage, the caller passes `now`.
  `readFiles(files, { JSZip, now })` returns `{ notes, skipped }` and never throws; a bad file goes into
  `skipped` with a reason (`import-read.js:152-196`).
  - **Keep** (`readKeepJson`, `import-read.js:62-79`): `title`, `textContent`, `listContent` (items with
    `text`, `isChecked`), `labels[].name`, `isArchived`, `createdTimestampUsec`,
    `userEditedTimestampUsec` (microseconds, converted to ms at `:56-59`). `isTrashed` notes are not
    imported and show as "in the Keep bin" (`:62`, `:162`). The note's id is the JSON file name without
    its extension (`:70`). The `.html` beside each JSON in a Takeout is listed as "not a note" (`:177`).
  - **Text and Markdown** (`readText`, `:81-98`): first non-empty line is the title (leading `#`
    stripped); `- [ ]` / `- [x]` / `* [ ]` lines become items.
  - **Word** (`readDocxXml`, `:105-128`): a regex scan of `word/document.xml`, so no DOMParser and it
    runs in Node. The first paragraph is the title, paragraphs with `w:numPr` become items, the rest is
    body text. Only the first paragraph is taken as title whether or not it is a heading (`:117-119`).
  - **Zip** (`:167-179`): opened with JSZip; `.json`, `.txt`, `.md`, `.docx` entries are read
    recursively, anything else is skipped. **PDF** files are skipped with "PDF files are not read yet"
    (`:180-181`).
- **One note shape** (`makeNote`, `import-read.js:31-53`): `{ id, source, sourceId, title, text,
  items: [{ text, checked }], labels, createdAt, editedAt, importedAt, status: 'waiting' }`, plus
  `archived: true` for archived Keep notes. `id` is `source:sourceId`, or `source:h` + an FNV-1a hash of
  title, text and items when the export has no id of its own (Text and Word files).
- **Merging** (`mergeImport`, `app/js/notes-library.js:10-42`): same id and still `waiting` with changed
  content is an update (title, text, items, labels, editedAt); same id and same content is skipped; a new
  id whose title, text and items equal an existing note's is skipped; anything else is added.
  `importIntoLibrary` saves only added and updated notes (`:118-123`).
- **Stored on this device only**: IndexedDB database `unblock-notes`, store `notes`, key `id`
  (`notes-library.js:71-72`, `:86-115`). It is not part of the synced state, so a few hundred notes never
  reach the Gist; syncing it is a later choice.
- **The Notes tab** is the second tab of the Sort screen (`app/js/notes-view.js:10-15`), remembered per
  device (`app.js:158-165`). The file input is `#import-files` accepting `.zip,.json,.txt,.md,.docx`
  (`notes-view.js:21`), and files can be dropped on `.import-drop` (`app.js:1252-1257`).
  Choosing files only reads them and shows the preview "Found N notes: Keep a · Word b · Text c" with the
  files not read (`notes-view.js:26-35`, `app.js:450-467`); nothing is saved until **Import** is pressed
  (`app.js:469-485`), which shows "Imported N notes (U updated, S skipped)". The list has source pills
  and a search over title, text, items and labels (`notes-view.js:60-79`, `notes-library.js:56-67`).
- **The Overview's yellow strip** reads "N notes to triage", joined to the unsorted count as "3 to sort ·
  212 notes to triage"; its button is "Sort them" when something is unsorted and "Open notes" (which
  opens the Notes tab, `app.js:640`) when only notes are waiting (`app/js/overview-view.js:63-74`).
- **Offline**: `vendor/jszip.min.js`, `import-read.js`, `notes-library.js` and `notes-view.js` are in
  `SHELL_ASSETS` (`app/service-worker.js:26`, `:47-49`).

## Invariants

- No file content leaves the device.
- An import never edits or deletes a task, a project or the capture inbox; it writes only to the
  `unblock-notes` database.
- Importing the same files again adds nothing (measured: 206 skipped of 206).
- Every module and vendored library is in `SHELL_ASSETS` (`app/service-worker.js`), or the app stops
  working offline (`app/js/service-worker-shell.test.mjs`).

## Traps

- **JSZip is a classic script, not a module.** `app/vendor/jszip.min.js` is a UMD build with no ES
  export, loaded by `<script src="vendor/jszip.min.js">` (`app/index.html:34`) which defines
  `window.JSZip`. Readers never import it: `browserJSZip()` (`import-read.js:8-10`) fetches the global
  and callers pass the constructor in; Node tests `require` it.
- **Keep field names come from community converters, not from Google.** Only a real Takeout file proves
  them. The browser check uses a Takeout-shaped sample built from those names, so it cannot catch a
  difference in the real export. Real Takeouts may also hold files such as `Labels.txt`, which would be
  read as a Text note (unverified).
- **Notes are device-only.** Clearing the browser's site data deletes the library, and a second device
  has its own empty one.
- **Archived badge never shows (found by the #19 check, not fixed).** The readers store
  `archived: true` (`import-read.js:51`) but the card shows "archived in Keep" only when
  `n.status === 'archived'` (`notes-view.js:52`), and status is always `waiting`. Archived notes import
  correctly (10 of 10 in the sample) but are indistinguishable on the list.
- **Duplicate bodies collapse.** Two different notes with identical title, text and items are treated as
  one (`notes-library.js:31`).
- **Word titles are the first paragraph.** A document that starts with body text gets that sentence as
  its title (`import-read.js:117-119`).
- **Offline, the Google Fonts stylesheet fails** (`app/index.html:11`), which Chromium logs as a console
  error; the browser check ignores exactly that error offline.
