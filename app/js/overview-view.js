// unblock/js/overview-view.js
// The Overview screen's markup (#11, part of the life dashboard): a week strip of deadlines, then one
// card per life area (project category), then a strip for what is still unsorted. The numbers come
// from js/overview.js. Read-only: every tap is navigation (data-action overview-task / overview-area /
// set-screen in js/app.js), never a mutation. See docs/4-systems/overview.md
import { esc } from './state.js';
import { weekDays, weekCounts, areaSummaries, dayStart } from './overview.js';
// render.js re-exports this module, so the import is circular; both only use each other inside functions
import { unsortedQueue } from './render.js';

const n = (count, one, many) => count + ' ' + (count === 1 ? one : many);

// Whole local days between the deadline and today; the strip only calls this for overdue chips.
function daysOverdue(task, now) {
  const d = new Date(task.deadline + 'T00:00:00');
  return Math.max(1, Math.round((dayStart(now) - d.getTime()) / 86400000));
}

function chip(it, now) {
  const late = it.stage === 'red' && it.task.deadline && new Date(it.task.deadline + 'T23:59:59').getTime() < dayStart(now);
  return '<button type="button" class="overview-chip due-' + esc(it.stage) + '" data-action="overview-task" data-project-id="' + esc(it.project.id) + '" data-task-id="' + esc(it.task.id) + '">'
    + esc(it.task.title) + (late ? ' · ' + daysOverdue(it.task, now) + 'd overdue' : '') + '</button>';
}

function strip(days, now) {
  const any = days.some((d) => d.items.length);
  return '<div class="overview-strip">' + days.map((d) =>
    '<section class="overview-day' + (d.isToday ? ' is-today' : '') + '"' + (d.isToday ? ' aria-current="date"' : '') + '>'
    + '<h3 class="overview-day-head">' + esc(d.label) + '</h3>'
    + d.items.map((it) => chip(it, now)).join('') + '</section>').join('') + '</div>'
    + (any ? '' : '<p class="overview-empty">Nothing due in the next seven days.</p>');
}

function areaCard(a) {
  const pct = Math.round(a.doneShare * 100);
  const bits = [a.open + ' open'];
  if (a.dueThisWeek) bits.push(a.dueThisWeek + ' due this week');
  if (a.overdue) bits.push(a.overdue + ' overdue');
  if (!a.dueThisWeek && !a.overdue) bits.push('no dates this week');
  return '<button type="button" class="overview-area" data-action="overview-area" data-category-id="' + esc(a.id || '') + '" style="--area-color:' + esc(a.color || 'var(--line)') + '">'
    + '<span class="overview-area-name">' + esc(a.name) + '</span>'
    + '<span class="overview-area-line">' + esc(bits.join(' · ')) + '</span>'
    + '<span class="overview-bar" role="img" aria-label="' + pct + '% done"><span class="overview-bar-fill" style="width:' + pct + '%"></span></span></button>';
}

export function renderOverview(st, now = Date.now()) {
  if (!(st.projects || []).length) {
    return '<div class="overview-none"><h2 class="overview-head">Overview</h2>'
      + '<p class="overview-empty">Nothing here yet. Add a project and its tasks and deadlines show up on this screen.</p>'
      + '<button type="button" class="btn primary" data-action="set-screen" data-screen="projects">Go to Projects</button></div>';
  }
  const c = weekCounts(st, now);
  const unsorted = unsortedQueue(st).length;
  return '<div class="overview-top"><h2 class="overview-head">This week</h2>'
    + '<p class="overview-counts">' + c.overdue + ' overdue · ' + n(c.dueThisWeek, 'task', 'tasks') + ' due in the next 7 days · ' + c.undated + ' with no date</p></div>'
    + strip(weekDays(st, now, st.dueDefaults), now)
    + '<div class="overview-top"><h2 class="overview-head">Life areas</h2><p class="overview-counts">tap an area to open its projects</p></div>'
    + '<div class="overview-areas">' + areaSummaries(st, now).map(areaCard).join('') + '</div>'
    + (unsorted > 0 ? '<div class="overview-sort"><b>' + unsorted + ' to sort</b>'
      + '<button type="button" class="btn" data-action="set-screen" data-screen="sort">Sort them</button></div>' : '');
}
