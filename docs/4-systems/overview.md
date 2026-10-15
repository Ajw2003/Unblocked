# Overview screen

**Status: planned, not built.** Design approved 2026-10-15 (see the 2026-10-15 entry in
`docs/6-decisions/Decisions.md`); the build plan is `docs/plans/overview-build-plan.html`. This file
describes the intended design and is rewritten against the real code once it ships.

## What it owns

The fifth screen in the rail, beside Focus, Sort, Board and Projects: one calm view of the week
ahead and of every life area. It owns the week-strip and area-card calculations and their markup.
It owns no data: everything it shows is read from `state.projects`, their tasks and
`state.projectCategories`, and every change still goes through `app/js/mutations.js`.

## How it will work

- **Two files, the Board's pattern.** `app/js/overview.js` is pure (no DOM, no clock of its own) and
  is unit-tested in `app/js/overview.test.mjs`. `app/js/overview-view.js` turns its result into an
  HTML string, as `app/js/board-view.js` does for `app/js/board.js`.
- **The week strip.** Seven day columns starting today. Every open task with a deadline in that
  range sits on its day. Overdue open tasks sit on today, so nothing overdue drops out of sight.
  Each chip takes its colour from `dueStage()` in `app/js/due-stage.js`, the same white, yellow and
  red stages the deadline chips use everywhere else. A line above the strip counts overdue tasks,
  tasks due in the next seven days, and open tasks with no date.
- **Area cards.** One card per life area, with its open task count, how many are due this week, how
  many are overdue, and a bar for the share of its tasks that are done. What counts as an area is a
  build-plan choice (project category is the suggestion), with a last card for projects that have
  no area.
- **The bottom strip.** Until the importer (roadmap U7) exists, it shows the Unsorted count and opens
  the Sort screen. Once the Notes library exists it counts imported notes waiting for triage.
- **Taps reuse existing navigation.** A task chip opens its project on the Projects screen; an area
  card opens the Projects screen filtered to that area (the existing `ui.projectFilter`).

## Invariants (to keep once built)

- The screen never writes state; it only reads and navigates.
- Done tasks never appear in the strip; overdue open tasks always do, on today.
- Every new module is listed in `SHELL_ASSETS` in `app/service-worker.js`, or the app stops
  working offline (`app/js/service-worker-shell.test.mjs` enforces this).
