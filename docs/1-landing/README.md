# Unblock — documentation index

Unblock started on 2026-10-13 as a copy of Focus Deck (`Ajw2003/focus-deck-app` at `f231bfd`), so
Focus Deck keeps working untouched while Unblock grows the layers it lacks: visible blockers, "what
can I do right now" by how much energy you have, voice capture, a life overview, and Markdown copies
of everything. Everything below, and every doc in tiers 4 and 6 dated before 2026-10-13, describes
the inherited Focus Deck code, which Unblock still runs unchanged apart from its name, storage keys,
cache names and sync Gist file (see `../6-decisions/Decisions.md`, 2026-10-13).

Unblock is a vanilla-JS installable PWA that hands you one task at a time instead of a
backlog, with optional GitHub issue sync, cross-device sync via a Gist, and on-demand/autonomous
Claude integration. Full description: root [`README.md`](../../README.md).

## Moving parts

| Part | What it does |
|---|---|
| `index.html` / `js/app.js` | entry point, DOM event wiring, repaint loop |
| `js/state.js` | in-memory state + localStorage persistence/backups |
| `js/mutations.js` | every allowed way state can change |
| `js/render.js` | pure state -> HTML string rendering |
| `js/github.js` / `js/github-sync.js` | GitHub REST client + issue/label/completion sync |
| `js/sync.js` / `js/merge.js` | cross-device sync via a Gist, record-level merge |
| `js/complexity.js` / `js/project-filter.js` | pure heuristics: complexity tier, project filter/sort |
| `service-worker.js` / `manifest.webmanifest` | offline caching, install metadata |
| `css/app.css` | all styling |
| `settings.html` | GitHub token, sync, category-color settings |
| `scripts/guard-file-churn.mjs` | blocks a commit that silently overwrites most of a file |

## Documentation tiers

| Tier | File | Answers |
|---|---|---|
| 1 | This file | What is this, where is everything |
| 2 | [`../2-roadmap/Roadmap.md`](../2-roadmap/Roadmap.md) | What 0-100% means per milestone |
| 3 | [`../3-state/ProjectState.md`](../3-state/ProjectState.md) | Where it stands right now |
| 4 | [`../4-systems/`](../4-systems/README.md) | How each runtime-critical system works |
| 5 | [`../5-today/Today.md`](../5-today/Today.md) | What's being worked on today, and why |
| 6 | [`../6-decisions/Decisions.md`](../6-decisions/Decisions.md) | Why a decision was made |

## Tier-4 systems

| System | Owns |
|---|---|
| [github-sync.md](../4-systems/github-sync.md) | syncing local tasks/projects with GitHub issues |
| [pwa-shell.md](../4-systems/pwa-shell.md) | the installable PWA shell and offline caching |
| [claude-integration.md](../4-systems/claude-integration.md) | Claude's on-demand contract on GitHub Issues |
| [local-storage.md](../4-systems/local-storage.md) | saving/loading state, the Gist ID, backups |
| [gist-sync.md](../4-systems/gist-sync.md) | merging local and remote Gist state, tombstones |
| [styling.md](../4-systems/styling.md) | the stylesheet's contract with the markup |
| [blockers.md](../4-systems/blockers.md) | what is in the way of a task, and holding it out of the pick |

## Everything else

- [`../plans/`](../plans/) — live, not-yet-executed plans. Currently:
  [`handcrafted-redesign.md`](../plans/handcrafted-redesign.md).
- [`../archive/`](../archive/) — executed plans and specs kept for history; see
  [`../archive/README.md`](../archive/README.md) for why each is inert.
- `../generated/` — tool-produced deliverables. None yet.

## Conventions

Cite claims to `file:line`. A doc that has gone inert moves to `archive/`, it is never deleted.
Tier 5 is rewritten at the start of each session, not the end. Tier 6 only grows; a superseded
entry gets its `Status` line flipped, never rewritten or deleted.
