# Handoff: republishing a page always sends its pictures

Written 2026-10-16 at the end of an Unblock session, so a session with push access to
`Ajw2003/AjsClaudeCodeTools` can add this to the house-rules plugin without re-deriving anything. aj
asked for it in so many words: "write this down as a change to remember to make when updating pages
in the future always, add it to the checks you normally do in the plugin". It still follows the
house-rules repo's own design loop there.

## What went wrong

`make_page.py build` copies a page's pictures into a `<page>-pics/` folder next to the HTML
(`scripts/make_page.py:152` and `:177` in 2.68.0) and the HTML points at them by relative path
(`importer-fixes-build-pics/card-after-light.png`). On claude.ai those pictures are separate published
files of the artifact. Republishing with only `file_path` replaces the HTML and **keeps the old
pictures**, because files left out of a publish are kept.

On `Ajw2003/Unblocked`, the importer fixes build plan (`docs/plans/importer-fixes-build.html`) was
revised after aj denied it for cutting off note text. The pictures were reshot, and versions 5 to 9
were republished with the page text alone. aj then opened version 9 and saw the old "after" card,
with its "…" title and cut text, under a caption saying nothing was cut. Their verdict was "this
seems backwards". Version 10 re-sent all six pictures through the publish tool's `files` map, and
downloading the published `card-after-light.png` confirmed the new picture.

## What to add

1. **`make_page.py build` prints the publish map.** After "wrote … (N picture(s) copied)", print the
   exact `files` map for the Artifact publish, one entry per copied picture:
   `{"<base>-pics/<name>.png": "<repo-relative path>", ...}`. Then the next step is something to copy,
   not something to remember.
2. **The page publish check refuses a republish that leaves out changed pictures.** In the
   PreToolUse check on Artifact publishes (`scripts/hook.py`, the page-save branch near line 7450 in
   2.68.0), when the HTML references `<base>-pics/` files, compare each picture's hash with what was
   last sent for that artifact URL. Record the hashes in a gitignored state file on each publish. A
   picture that changed since then and is missing from `files` gets the publish refused. The refusal
   names each stale picture and prints the `files` map to send. A first publish with no `files`
   is refused the same way, since the pictures would be missing.
3. **A verify.py case for each.** One republish after a reshoot without `files` is refused. The
   same republish with the printed map goes through. A republish where no picture changed goes
   through without `files`.
4. **A line in the page rules** (`rules/detail/show-dont-tell.md`, where page publishing is described).
   Republishing a page re-sends every picture that changed, through the publish tool's `files` map.
   Afterwards, read one published picture back to check it.

## Until the plugin has it

Every republish of a page from this repo passes all of its `<page>-pics/` files in `files`. After
publishing, one changed picture is read back with the Artifact tool's `read` action and looked at.
