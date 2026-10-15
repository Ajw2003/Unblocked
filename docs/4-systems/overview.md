# Overview screen

**Status: built** on `AjsAgent/nifty-albattani-22uvtl` (issues #10, #11, #12, #13); waiting on aj to try it.
Design approved 2026-10-15 (see the 2026-10-15 entry in `docs/6-decisions/Decisions.md`); the build
plan is `docs/plans/overview-build-plan.html`.

## What it owns

The fifth screen in the rail, beside Focus, Sort, Board and Projects (`SCREENS`,
`app/js/render.js:40`; its rail label and icon, `app/js/render.js:46`): one calm view of the week
ahead and of every life area. It owns the week-strip and area-card calculations and their markup.
It owns no data: everything it shows is read from `state.projects`, their tasks and
`state.projectCategories` (`app/js/overview.js:36-37`, `app/js/overview.js:70-72`), and it never
calls a mutation.

## How it works

- **Two files, the Board's pattern.** `app/js/overview.js` is pure (no DOM; the caller passes `now`,
  `app/js/overview.js:1-4`) and is tested in `app/js/overview.test.mjs`. `app/js/overview-view.js`
  turns its result into an HTML string (`renderOverview`, `app/js/overview-view.js:47`), tested in
  `app/js/overview-view.test.mjs`. `app/js/render.js` re-exports it (`app/js/render.js:52`) and
  `app/js/app.js:260` paints it inside `.screen-overview`.
- **The week strip.** `weekDays` (`app/js/overview.js:30`) builds seven day columns starting today
  (labels like `MON 12`, `app/js/overview.js:34`). Done tasks and tasks without a usable deadline are
  skipped (`app/js/overview.js:38-40`); every other open task with a deadline within the seven days
  sits on its day (`app/js/overview.js:42-43`). Inside a day, overdue chips come first, then by
  deadline, then project order, then task order (`app/js/overview.js:48-49`). A deadline is the end
  of its due day in local time (`dueMoment`, `app/js/due-stage.js:38-42`).
- **Chip colours.** Each chip carries `dueStage()` from `app/js/due-stage.js`
  (`app/js/overview.js:43`), applied as a `due-<stage>` class (`app/js/overview-view.js:20`);
  yellow and red are styled at `app/css/app.css:1188-1189`, white is the plain chip
  (`app/css/app.css:1187`). Overdue chips also read "· Nd overdue" (`app/js/overview-view.js:21`).
- **The count line.** `weekCounts` (`app/js/overview.js:57-67`) counts open tasks that are overdue,
  due today..today+6, or undated; the headline reads "N overdue · N tasks due in the next 7 days ·
  N with no date" (`app/js/overview-view.js:56`). With no dated tasks in range it adds "Nothing due in
  the next seven days." (`app/js/overview-view.js:30`).
- **Area cards.** An area is a project category. `areaSummaries` (`app/js/overview.js:70-88`) makes one
  card per category that has projects, in `projectCategories` order, then a last "No area" card for
  projects with no category or an unknown one (`app/js/overview.js:75-76`); empty areas are dropped
  (`app/js/overview.js:77`). Each card shows open count, due this week, overdue (or "no dates this
  week") and a bar for the done share (`app/js/overview-view.js:33-43`). The card's left edge uses the
  category colour (`app/js/overview-view.js:39`, `app/css/app.css:1193`).
- **The bottom strip.** When the Unsorted count is above zero it shows "N to sort" and a button that
  opens the Sort screen (`app/js/overview-view.js:60-61`). Once the Notes library exists it can also
  count imported notes waiting for triage (not built; the importer is roadmap U7).
- **Empty state.** With no projects at all the screen shows a message and a "Go to Projects" button
  instead of the strip (`app/js/overview-view.js:48-52`).
- **Taps only navigate.** A task chip calls `scrollToProject` (`app/js/app.js:429`), which switches to
  Projects and shows that project (`app/js/app.js:1081-1089`). An area card sets `ui.projectFilter` to
  the category id (or `null` for "No area"), switches to Projects, closes the drawer and scrolls to the
  top (`app/js/app.js:430-437`).

## Invariants

- The screen never writes state; it only reads and navigates (`app/js/overview-view.js:3-5`,
  `app/js/app.js:428-437`).
- Done tasks never appear in the strip (`app/js/overview.js:38`); overdue open tasks always do, on
  today (`app/js/overview.js:41-42`).
- Both modules are listed in `SHELL_ASSETS` (`app/service-worker.js:24-25`), or the app stops working
  offline (`app/js/service-worker-shell.test.mjs` enforces this).

## Traps

- **`unsortedCount` is passed in.** `renderOverview(st, unsortedCount, now)` takes the count from
  `app/js/app.js:253,260` rather than importing `unsortedQueue` from `render.js`, because `render.js`
  re-exports this module and importing back would be a circular import
  (`app/js/overview-view.js:45-46`, `app/js/render.js:52`).
- **Overdue chips always sit on today.** A task overdue by ten days is in today's column, not ten
  columns back; its "Nd overdue" text is the only sign of how late it is
  (`app/js/overview.js:41-42`, `app/js/overview-view.js:12-16`).
- **The week strip scrolls sideways inside its own container.** The seven columns are at least 130px
  wide in a grid with `overflow-x:auto` (`app/css/app.css:1183`), so on a phone the strip scrolls
  within itself and the page does not widen.
- **Two clocks of "today".** `dayStart` and the day columns use local midnight built from date parts
  (`app/js/overview.js:10-19`); a deadline is end-of-day local (`app/js/due-stage.js:38-42`). Do not
  swap in 24-hour arithmetic, or daylight-saving days shift.
- **"No area" has an empty `data-category-id`.** The card sends `''` (`app/js/overview-view.js:39`),
  which `app/js/app.js:432` turns into `projectFilter = null`, the "no category" filter.
