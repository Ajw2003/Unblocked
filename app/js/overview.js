// unblock/js/overview.js -- the pure part of the Overview screen (#10).
// weekDays gives the seven-day strip, weekCounts the headline numbers, areaSummaries one card per area.
// Pure: no DOM, no clock of its own (the caller passes `now`). Only open tasks (status !== 'done')
// with a usable deadline are placed on the strip; overdue ones pile onto today's column.
import { dueStage, dueMoment } from './due-stage.js';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Local midnight of the day containing `now`, built from date parts so daylight saving cannot shift it.
export function dayStart(now) {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Local midnight `n` days after the day containing `now`.
function dayPlus(now, n) {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// Where an open task sits: 'overdue' (before today), 'week' (today..today+6), 'later', or 'undated'.
function bucket(t, now) {
  const due = dueMoment(t);
  if (due === null) return 'undated';
  if (due < dayStart(now)) return 'overdue';
  return due < dayPlus(now, 7).getTime() ? 'week' : 'later';
}

// Seven days from today: { start, label, isToday, items: [{ task, project, stage }] }.
export function weekDays(st, now, dueDefaults) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = dayPlus(now, i);
    days.push({ start: d.getTime(), label: DAYS[d.getDay()] + ' ' + d.getDate(), isToday: i === 0, items: [], _end: dayPlus(now, i + 1).getTime() });
  }
  (st.projects || []).forEach((project, pi) => {
    (project.tasks || []).forEach((task, ti) => {
      if (task.status === 'done') return;
      const due = dueMoment(task);
      if (due === null) return;
      // overdue goes in day 0; otherwise the day whose span holds the deadline (none past day 6)
      const day = due < days[0]._end ? days[0] : days.find((x) => due >= x.start && due < x._end);
      if (day) day.items.push({ task, project, stage: dueStage(task, now, dueDefaults), _due: due, _p: pi, _t: ti });
    });
  });
  days.forEach((day) => {
    // overdue first, then deadline, then project order, then task order
    day.items.sort((a, b) => (b._due < days[0].start) - (a._due < days[0].start)
      || a._due - b._due || a._p - b._p || a._t - b._t);
    day.items.forEach((it) => { delete it._due; delete it._p; delete it._t; });
    delete day._end;
  });
  return days;
}

// Counts over open tasks: overdue, due today..today+6 (not overdue), and with no usable deadline.
export function weekCounts(st, now) {
  const c = { overdue: 0, dueThisWeek: 0, undated: 0 };
  (st.projects || []).forEach((p) => (p.tasks || []).forEach((t) => {
    if (t.status === 'done') return;
    const b = bucket(t, now);
    if (b === 'overdue') c.overdue++;
    else if (b === 'week') c.dueThisWeek++;
    else if (b === 'undated') c.undated++;
  }));
  return c;
}

// One card per area that has projects, in projectCategories order, then 'No area' for strays.
export function areaSummaries(st, now) {
  const cats = st.projectCategories || [];
  const projects = st.projects || [];
  const known = new Set(cats.map((c) => c.id));
  const groups = cats.map((c) => ({ id: c.id, name: c.name, color: c.color, projects: projects.filter((p) => p.categoryId === c.id) }));
  const strays = projects.filter((p) => !p.categoryId || !known.has(p.categoryId));
  groups.push({ id: null, name: 'No area', color: null, projects: strays });
  return groups.filter((g) => g.projects.length).map((g) => {
    const tasks = g.projects.reduce((all, p) => all.concat(p.tasks || []), []);
    const done = tasks.filter((t) => t.status === 'done').length;
    const open = tasks.length - done;
    const counts = weekCounts({ projects: [{ tasks }] }, now);
    return {
      id: g.id, name: g.name, color: g.color, projectIds: g.projects.map((p) => p.id),
      open, done, dueThisWeek: counts.dueThisWeek, overdue: counts.overdue,
      doneShare: tasks.length ? done / tasks.length : 0,
    };
  });
}
