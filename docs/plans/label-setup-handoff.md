# Handoff: the house-rules plugin creates missing GitHub labels

Written 2026-10-15 at the end of an Unblock session, so a session with push access to
`Ajw2003/AjsClaudeCodeTools` can build this without re-deriving anything. The design is approved
(the 2026-10-15 "Label setup" entry in this repo's `docs/6-decisions/Decisions.md`; the proposal page
is `docs/plans/label-tool.html`). The build still follows the house-rules repo's own design loop:
record the approval there, write a build plan, and get "Build plan approved: Label setup" from aj.

## What aj asked for

"Can we make a tool to create issue labels for future projects/repos without them?" Today a new
repo has none of the labels the house rules expect, so the issue workflow stalls until someone
creates them by hand. On `Ajw2003/Unblocked` this cost several turns on 2026-10-15.

Approved answers:

- **Where:** inside the house-rules plugin, not a standalone script or a GitHub Action.
- **Which labels:** only the three house labels below. Leave GitHub's category labels (enhancement,
  bug, documentation and so on) alone; new repos already have them.
- **Behaviour:** when the plugin needs a house label that the repo lacks, it creates it and says so.
  A `/house-rules:labels` command creates all three on the current repo (or a named `owner/repo`) on
  demand and lists what it created and what already existed.

## The three labels

Use exactly these, matching what is now on `Ajw2003/Unblocked` (read with `gh api` on 2026-10-15):

| Name | Colour | Description |
|---|---|---|
| `AjsAgent created this` | `5b6b7a` | Opened by AJ's agent |
| `in progress` | `FBCA04` | AJ's agent is working on it |
| `needs review` | `0E8A16` | Waiting on aj |

Never change or delete an existing label, even one with a different colour or description. Creating is
the only write.

## What exists today (house-rules 2.66.0, `AjsClaudeCodeTools` commit `e879981`)

All paths are under `claude-house-rules/plugins/house-rules/`.

- `scripts/hook.py:4809` — `ISSUES_LABEL = "AjsAgent created this"`. The issue-workflow note at
  `scripts/hook.py:4814-4823` only tells the agent to "create it first with `gh label create`" if the
  repo lacks it.
- `scripts/hook.py:5197` — `LOOP_WORKING, LOOP_REVIEW = "in progress", "needs review"`.
- `scripts/hook.py:5208` `_loop_gh_labels` reads an issue's labels with
  `gh api repos/<repo>/issues/<n>`, and `scripts/hook.py:5218` `_loop_labels` gathers them for the
  feature's issues. `scripts/hook.py:5244` `_loop_wrong` and `scripts/hook.py:5268`
  `_loop_label_refusal` refuse a stage move when an issue lacks the right label.
- `scripts/hook.py:5594` `_loop_record_labels` records label changes after a tool call and moves Build
  to QA when every issue says `needs review`.
- Commands live in `commands/*.md` (for example `commands/docref.md`, with `description` and
  `argument-hint` front matter); scripts they run live in `scripts/`.
- Tests: `python claude-house-rules/plugins/house-rules/scripts/verify.py` from the repo root (see the
  root `README.md`, around line 221). The label-check cases are near `scripts/verify.py:8534-8606`
  and use `HOUSE_RULES_LOOP_LABELS_FILE` (`scripts/hook.py:5201`) as a stand-in for GitHub.

## Facts learned the hard way in a cloud session

- The GitHub MCP connector cannot create labels; its `issue_write` refuses a label the repo lacks
  ("failed to resolve label").
- `gh label create "<name>" --repo <owner/repo> --color <hex> --description "<text>"` works.
- `gh issue edit --add-label` does **not** work in a cloud session: it goes through GitHub's GraphQL
  API, which returns HTTP 403 there. REST works: `gh api repos/<owner>/<repo>/issues/<n>/labels -f
  "labels[]=in progress"` to add, and `gh api -X DELETE repos/<owner>/<repo>/issues/<n>/labels/<name>`
  to remove. The plugin's own advice text (`scripts/hook.py:4820`, `gh issue edit N --add-label`)
  should say the REST form, or both.
- A label name with a space must be URL-encoded in a REST path (`in%20progress`).

## Suggested shape (for the build plan; aj approves the details)

1. A small `ensure_labels(repo)` in `scripts/hook.py` (or a new `scripts/labels.py`) that lists the
   repo's labels with `gh api repos/<repo>/labels --paginate`, creates any of the three that is
   missing with `gh label create`, and returns what it created. It never raises into the hook: a
   missing `gh`, no sign-in or a 403 becomes a plain note naming what failed.
2. Call it where the plugin first needs a house label: when the issue workflow asks for issues, and
   in the label check before reporting an issue as wrongly labelled. The note says which labels were
   created.
3. `commands/labels.md` running that same function for the current repo or a named `owner/repo`.
4. `verify.py` cases: all three missing → all created; one missing → only it created; all present →
   nothing created and nothing changed; `gh` missing → a clear note and no crash. Use a stand-in for
   GitHub like `HOUSE_RULES_LOOP_LABELS_FILE`.
5. Fix the `gh issue edit` advice to the REST form, which works in cloud sessions.

## Done when

- `verify.py` passes, including the new cases.
- On a scratch repo with none of the labels, the first issue-workflow step creates all three, and the
  reply names them.
- `/house-rules:labels` on `Ajw2003/Unblocked` reports all three as already present and changes
  nothing.
- The plugin version is bumped and its changelog says what changed.
