# Blockers

What it owns: naming what is in the way of a task, holding a blocked task out of the pick, and
freeing it again (#3).

## The model

A blocker is an ordinary task. The blocked task keeps a list of their ids, `task.blockedBy`.

- `openBlockers(t)` (`app/js/state.js`) is the tasks in `t.blockedBy` that still exist and are not
  done. A blocker that is finished or deleted stops blocking by itself; nothing is ever cleared by
  hand, and `blockedBy` keeps the old ids.
- `tasksBlockedBy(t)` is the reverse: the open tasks waiting on `t`, for the blocker's own row.
- `addBlocker(taskId, text)` (`app/js/mutations.js`) makes the blocker with `addTask`, in the same
  project with the same labels, so it is dealt from the same card as the task it blocks.

## Where it shows

| Place | What it does | Code |
|---|---|---|
| Pick | A blocked task is never dealt; `openTasksMatching` skips it | `app/js/state.js`, `openTasksMatching` |
| Card counts | "N open" counts only unblocked tasks, so a card never promises a task it cannot deal | `app/js/render.js`, `openWhere` |
| Task row | "In the way: …" on the blocked task, "Unblocks: …" on the blocker; dashed edge, ellipsis when long | `blockerChips` in `render.js`, `.blocked-chip`/`.unblocks-chip` in `app/css/app.css` |
| Task editor | Lists open blockers; "What's in the way?" box, one blocker per line, made on Save | `renderBlockerField` in `render.js`; the `save-task-edit` handler in `app/js/app.js` |
| Focus card | A focused blocked task names each blocker with "…, do that first", which focuses it | `focusBlockers` in `render.js` (reuses the `focus-task` action) |

## Sync

`blockedBy` is an ordinary task field: the Gist merge carries it with the task's `updatedAt`, and a
GitHub sync updates linked tasks field by field (`app/js/github-sync.js`), so it survives. A blocker
in a GitHub project becomes an issue like any new task there (`createIssueIfGithubProject`).

## Not yet

- The GitHub issue body does not mention blockers; the link lives only in Unblock.
- The Board screen (`app/js/board-view.js`) does not show blockers.
- A blocker can't be unlinked without finishing or deleting it.

## Checks

`app/js/blockers.test.mjs` (logic and markup); `scripts/check-blockers-browser.mjs` (the whole flow in
Chromium at 390 and 1440 wide, screenshots in `docs/generated/blockers/`).
