# Handoff: the steps design, and tidying up after blockers

Written 2026-10-15 by AJ's agent, for a fresh session. aj asked for this work to move to a new
session so it doesn't mix with the house-rules work in the session that wrote this.

## Start here

1. Work on branch `AjsAgent/catch-up` (cut from `main` at `7bca645`, the merge of pull request #20).
   Never commit to `main`; aj tests and merges pull requests himself.
2. Read the catch-up page first: `docs/plans/catch-up-2026-10-15.html`. It is the clearest summary of
   where things stand. It asks aj two questions, still unanswered when this was written:
   - What should happen to the blockers pull request (#9, "Blockers: name what is in the way, and
     deal it instead")? Suggested: close it without merging.
   - What next? Suggested: write the steps build plan.
   Ask aj for those answers before closing #9 or building anything.

## What happened

- 2026-10-13: Blockers (issue #3) was built straight from the brief on branch `AjsAgent/blockers`
  (pull request #9). Each blocker became its own task in the list. aj rejected that: two chores with
  seven blockers became nine rows, which is the overwhelm Unblock exists to fix.
- The same day, the design was reworked with tappable models, and aj approved it:
  - Blockers and the old hidden "steps" field become **one list, called steps**, folded under their
    task. The folded task shows a meter ("1 of 4") and one **suggested next step**.
  - The suggestion is soft: "Not now" skips it without reordering, any step can be ticked in any
    order, and steps can be reordered.
  - **A step can belong to several tasks.** Typing a step offers a matching open step from another
    task. Ticking a whole task finishes only the steps no other open task needs, with Undo.
  - **The deal hands you the step**, not a blocked task, and lists every task it helps with each
    task's progress.
  - **"Not now" lasts as long as Settings says**: until the app closes (default), an hour, until
    tomorrow, or until brought back. Skipped steps stay listed under their task with Bring back.
  - aj's principle: "rigidity doesn't buy us anything unless it's for a reason". Each rule is weighed
    for the friction it removes against the friction it adds.
- 2026-10-15: another session built the Overview screen (#15) and the note importer (#20); aj merged
  both. That session never saw `AjsAgent/blockers`.

## Where the design lives (on branch `AjsAgent/blockers`, not yet on `AjsAgent/catch-up`)

- `docs/plans/blockers-fold-and-suggest.html`: the approved model, the rigidity ledger, and what
  changes in the real app. **This is the spec.**
- `docs/plans/hidden-not-forgotten.html`: the three directions that were compared.
- `docs/plans/blockers-walkthrough.html`: a walkthrough of the rejected first build.
- `docs/6-decisions/Decisions.md` on that branch has four 2026-10-13 entries to carry over:
  "Each feature is walked through and prototyped before it is built", "Blockers fold under their
  task...", "Steps replace blockers...", plus the blockers state row.
- The first build's code (`app/js/blockers.test.mjs`, `scripts/check-blockers-browser.mjs`,
  `docs/4-systems/blockers.md`, changes to `state.js`, `mutations.js`, `render.js`, `app.js`,
  `app.css`) is the rejected design. Read it for how blockers hooked into the pick and the card
  counts, but don't carry it over as is.

Copy the design pages and decision entries onto `AjsAgent/catch-up` with
`git checkout origin/AjsAgent/blockers -- <path>` for the pages; merge the decision entries in by hand,
because both branches added entries at the top of `Decisions.md`.

## Out-of-date notes on main to fix

In `docs/3-state/ProjectState.md` (and `docs/5-today/Today.md` where it repeats them):
- U2 Blockers says "0%, not started". It should say the design is settled and the build is next.
- U1 says isolation from Focus Deck hasn't been re-checked live; aj checked it on his S26 on
  2026-10-13 with Focus Deck open in the same Chrome.
- U7 says the importer is "not yet merged" and the "archived in Keep" badge never shows. Pull request
  #20 is merged (2026-10-15 08:58 UTC, deploy succeeded) and `app/js/notes-view.js:52` now shows the
  badge.

## Next, once aj answers

1. Close #9 if aj agrees. It is closing, not deleting: the branch stays.
2. Carry the design over and fix the notes above, on `AjsAgent/catch-up`.
3. Write the steps build plan as a page (house-rules `make_page.py`, project style
   `docs/page-style.json`), with one parent issue and small child issues. Each issue gets the
   `AjsAgent created this` label plus a category, and child issues say "Part of #N". aj approves the
   plan before any code.
4. Build, check in a real browser at 390 and 1440 wide, and open a pull request that says `Refs #N`.

## Also open, not part of this handoff

- Issues #10 to #13 (Overview) and #16 to #19 (importer) are done in code but still open. Only aj
  closes issues, after testing.
- U8, triage of imported notes, is approved in design but has no build plan.
