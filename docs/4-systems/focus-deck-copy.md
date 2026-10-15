# Focus Deck copy and the GitHub issues switch

Status: planned, not built. Decisions: the two 2026-10-15 entries in `docs/6-decisions/Decisions.md`
("Copy Focus Deck's data into Unblock once, with issue links cut" and "Unblock's GitHub issue sync
gets a switch, off to start with").

## What it owns

- **The GitHub issues switch.** One per-device setting, `unblock-github-issues`, off unless set to
  `on`. While it is off, `ghFetch` (`app/js/github.js:11`) refuses every request whose path is not
  `/user` or does not start with `/gists`, so no issue, label or repo is read or written, wherever
  the call comes from. Auto-sync (`autoSyncGithub`, `app/js/app.js:1200`) returns early instead of
  failing, and the topbar sync button says the switch is off. Settings has the checkbox.
- **Copy from Focus Deck.** A Settings button. It finds Focus Deck's Gist by its file,
  `focus-deck-state.json` (Focus Deck `app/js/sync.js:10` at `f231bfd`), reads it with `GET` only,
  cuts the issue links in the copy, merges it into Unblock with `mergeStates` (`app/js/merge.js`), and
  saves with `persist()`, which pushes to Unblock's own Gist, `unblock-state.json`.

## How the links are cut

For every copied task with `source: 'github'`, the same fields `unlinkTask` clears
(`app/js/github-sync.js:263`) are cleared: `source` becomes `manual`, and `repoFullName`,
`issueNumber`, `url` and `priorityLabel` are removed. The issue reference is kept by appending
` (owner/repo#N)` to the title, and the key goes into `excludedIssues`, so turning the switch on later
does not import that issue again beside the copy. This is a pure function with unit tests.

## Traps

- Focus Deck's Gist must never be written. The copy only calls `ghFetch` with no `method`, which is
  `GET`. The browser check records every request and fails on any non-`GET` to Focus Deck's Gist.
- Without a connected Unblock Gist the copy still lands on this device; the person is told sync is
  off, as everywhere else.
