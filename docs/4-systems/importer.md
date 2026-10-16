# Importer and Notes library

**Status: shipped (#20); fixes from aj's first real test are planned, not built (#25).** Design approved
2026-10-15 (the life dashboard entry in `docs/6-decisions/Decisions.md`); build plan
`docs/plans/importer-build-plan.html`. aj imported 15 real Samsung Notes text files on 2026-10-15: they
came in, but long notes were cut off and whole paragraphs became titles. The fixes are drawn on
`docs/plans/importer-fixes-build.html` and described under "Planned changes" below. Triage (U8, #14) is
not built.

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

## Planned changes (#25, not built yet)

- **Short titles (#16).** In `readText` and `readDocxXml`, a short first line followed by more text stays
  the title. A long first line gives a title of its first eight words, with no "…", and the whole line
  stays at the start of the note's text, so nothing is lost.
- **Whole cards (#18).** `noteCard` in `notes-view.js` stops cutting text at 140 characters: a card shows
  every word and every checklist item. aj ruled that no note text is ever cut off (Decisions.md,
  2026-10-16).
- **Renaming (#17).** `notes-library.js` gains a rename that marks the title as chosen by aj. `mergeImport`
  keeps a chosen title when the same note is imported again, while still updating a waiting note's text
  and items.
- **Note view (#26).** Tapping a card opens the whole note on its own screen: a two-line editable title,
  the full text, checklist items, labels, the "archived in Keep" flag, the source file name and the import
  date. Back returns to the same place in the list.
- **Checks (#19).** `scripts/check-importer-browser.mjs` imports a 60-word one-paragraph note and checks
  its eight-word title, that the view shows every word, that a rename survives a reload and a re-import,
  and that Back returns to the list, at 390 and 1440 pixels wide.

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
  difference in the real export. A `Keep/Labels.txt` (the label list some Takeouts include) is skipped
  as "Keep label list, not a note" (`import-read.js`, the zip walk in `readOne`; tested in
  `import-read.test.mjs`); other unexpected Takeout files are unverified.
- **Notes are device-only.** Clearing the browser's site data deletes the library, and a second device
  has its own empty one.
- **"Archived" is a flag, not a status.** The readers store `archived: true` (`import-read.js:51`) and
  status stays `waiting`, so code that shows or filters archived Keep notes must read `n.archived`, as
  the card does (`notes-view.js:52`). The #19 browser check found the card reading `status` instead; it
  now asserts 10 "archived in Keep" badges at each width.
- **Duplicate bodies collapse.** Two different notes with identical title, text and items are treated as
  one (`notes-library.js:31`).
- **Word titles are the first paragraph.** A document that starts with body text gets that sentence as
  its title (`import-read.js:117-119`).
- **Offline, the Google Fonts stylesheet fails** (`app/index.html:11`), which Chromium logs as a console
  error; the browser check ignores exactly that error offline.
