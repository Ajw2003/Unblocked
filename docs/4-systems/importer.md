# Importer and Notes library

**Status: planned, not built.** Design approved 2026-10-15 (the life dashboard entry in
`docs/6-decisions/Decisions.md`); the build plan is `docs/plans/importer-build-plan.html`. This file
describes the intended design and is rewritten against the real code once it ships.

## What it owns

Reading exported notes on the device and keeping them in a Notes library, so that triage (roadmap
U8, #14) can turn them into tasks one note at a time. It owns the file readers, the library's storage
and the Import screen. It never uploads a file: everything is read in the browser.

## How it will work

- **Readers are pure.** `app/js/import-read.js` turns one file's contents into notes of one shape,
  with no DOM and no storage, so it is unit-tested with sample files in the shape each app exports:
  - Google Keep, from a Google Takeout zip: one JSON file per note, with `title`, `textContent` or
    `listContent` (items with `text` and `isChecked`), `labels` (each with a `name`), `isTrashed`,
    `isArchived`, `createdTimestampUsec` and `userEditedTimestampUsec`. Trashed notes are skipped.
    These field names come from open-source Keep converters, not from Google, so the first real
    Takeout file aj imports is the real test.
  - Text and Markdown files (Apple Notes' Markdown export, Samsung Notes' Text export): the first
    line is the title; `- [ ]` and `- [x]` lines become checklist items.
  - Word files (Samsung Notes' Word export, Google Docs downloads, Word itself), which are zips of
    XML; how they are read is a build-plan choice.
  - A zip holding any of the above, opened with JSZip.
- **One note shape.** `{ id, source, sourceId, title, text, items: [{ text, checked }], labels,
  createdAt, editedAt, importedAt, status }`, where `source` is `keep`, `text`, `word` or `pdf` and
  `status` is `waiting`, `triaged` or `archived`.
- **Stored on this device only.** Notes live in IndexedDB, not in the synced state, so a few hundred
  notes never bloat the Gist; syncing the library is a later choice (approved design, 4A).
- **Importing twice skips what is already there,** matched by source and the note's own id where the
  export has one, else by identical title and text.
- **The Overview's yellow strip** counts notes waiting for triage once the library exists, beside the
  Unsorted count.

## Invariants (to keep once built)

- No file content leaves the device.
- An import never edits or deletes a task, a project or the capture inbox.
- Every module and vendored library is in `SHELL_ASSETS` (`app/service-worker.js`), or the app stops
  working offline (`app/js/service-worker-shell.test.mjs`).
