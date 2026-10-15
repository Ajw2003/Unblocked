// run with: node --test app/js/overview.test.mjs  (Overview week strip and areas, #10)
import test from 'node:test';
import assert from 'node:assert';
import { dayStart, weekDays, weekCounts, areaSummaries } from './overview.js';

const NOW = new Date(2026, 9, 15, 15, 0).getTime(); // Thursday 15 Oct 2026, local
const task = (id, status, deadline) => Object.assign({ id, title: id, status }, deadline ? { deadline } : {});
const proj = (id, categoryId, tasks) => ({ id, name: id, color: '#abc', categoryId, tasks });
const ids = (day) => day.items.map((i) => i.task.id);
const allIds = (days) => days.reduce((a, d) => a.concat(ids(d)), []);
const cats = [{ id: 'c1', name: 'Work', color: '#111' }, { id: 'c2', name: 'Home', color: '#222' }, { id: 'c3', name: 'Empty', color: '#333' }];
const state = (tasks) => ({ projectCategories: cats, projects: [proj('p1', 'c1', tasks)] });

test('dayStart is local midnight', () => {
  assert.strictEqual(dayStart(NOW), new Date(2026, 9, 15).getTime());
});

test('due today lands on day 0; today+6 on day 6; today+7 nowhere', () => {
  const days = weekDays(state([task('a', 'next', '2026-10-15'), task('b', 'next', '2026-10-21'), task('c', 'next', '2026-10-22')]), NOW);
  assert.deepStrictEqual(ids(days[0]), ['a']);
  assert.deepStrictEqual(ids(days[6]), ['b']);
  assert.deepStrictEqual(allIds(days), ['a', 'b']);
  assert.strictEqual(days[0].items[0].project.id, 'p1');
});

test('overdue open task lands on day 0, first, and counts overdue', () => {
  const st = state([task('a', 'next', '2026-10-15'), task('o', 'next', '2026-10-10')]);
  const days = weekDays(st, NOW);
  assert.deepStrictEqual(ids(days[0]), ['o', 'a']);
  assert.strictEqual(days[0].items[0].stage, 'red');
  assert.deepStrictEqual(weekCounts(st, NOW), { overdue: 1, dueThisWeek: 1, undated: 0 });
});

test('done tasks never appear and are not counted', () => {
  const st = state([task('d', 'done', '2026-10-16'), task('e', 'done', '2026-10-01'), task('f', 'done')]);
  assert.deepStrictEqual(allIds(weekDays(st, NOW)), []);
  assert.deepStrictEqual(weekCounts(st, NOW), { overdue: 0, dueThisWeek: 0, undated: 0 });
});

test('no or unparseable deadline counts as undated and never appears', () => {
  const st = state([task('a', 'next'), task('b', 'next', 'soon')]);
  assert.deepStrictEqual(weekCounts(st, NOW), { overdue: 0, dueThisWeek: 0, undated: 2 });
  assert.deepStrictEqual(allIds(weekDays(st, NOW)), []);
});

test('order within a day: overdue, deadline, project, task', () => {
  const st = { projects: [
    proj('p1', null, [task('a', 'next', '2026-10-16'), task('b', 'next', '2026-10-16')]),
    proj('p2', null, [task('c', 'next', '2026-10-16'), task('d', 'next', '2026-10-14'), task('e', 'next', '2026-10-01')]),
  ] };
  assert.deepStrictEqual(ids(weekDays(st, NOW)[0]), ['e', 'd']);
  assert.deepStrictEqual(ids(weekDays(st, NOW)[1]), ['a', 'b', 'c']);
});

test('labels and isToday', () => {
  const days = weekDays(state([]), NOW);
  assert.strictEqual(days.length, 7);
  assert.deepStrictEqual(days.map((d) => d.label), ['THU 15', 'FRI 16', 'SAT 17', 'SUN 18', 'MON 19', 'TUE 20', 'WED 21']);
  assert.deepStrictEqual(days.map((d) => d.isToday), [true, false, false, false, false, false, false]);
  assert.strictEqual(days[0].start, dayStart(NOW));
});

test('a week crossing a month end', () => {
  const now = new Date(2026, 9, 28, 9, 0).getTime();
  const days = weekDays(state([task('a', 'next', '2026-11-03')]), now);
  assert.strictEqual(days[6].label, 'TUE 3');
  assert.strictEqual(days[6].start, new Date(2026, 10, 3).getTime());
  assert.deepStrictEqual(ids(days[6]), ['a']);
});

test('areas: no category and unknown category go to No area; empty category left out', () => {
  const st = { projectCategories: cats, projects: [proj('p1', 'c1', []), proj('p2', null, []), proj('p3', 'gone', [])] };
  const a = areaSummaries(st, NOW);
  assert.deepStrictEqual(a.map((x) => x.id), ['c1', null]);
  assert.strictEqual(a[1].name, 'No area');
  assert.strictEqual(a[1].color, null);
  assert.deepStrictEqual(a[1].projectIds, ['p2', 'p3']);
});

test('area counts and doneShare', () => {
  const st = { projectCategories: cats, projects: [
    proj('p1', 'c1', [task('a', 'done'), task('b', 'next', '2026-10-17'), task('c', 'doing', '2026-10-01')]),
    proj('p2', 'c1', [task('d', 'done')]),
    proj('p3', 'c2', [task('e', 'next')]),
  ] };
  const [work, home] = areaSummaries(st, NOW);
  assert.deepStrictEqual([work.open, work.done, work.dueThisWeek, work.overdue, work.doneShare], [2, 2, 1, 1, 0.5]);
  assert.deepStrictEqual(work.projectIds, ['p1', 'p2']);
  assert.deepStrictEqual([home.open, home.done, home.doneShare], [1, 0, 0]);
  assert.strictEqual(areaSummaries({ projectCategories: cats, projects: [proj('p', 'c1', [])] }, NOW)[0].doneShare, 0);
});

test('missing projectCategories or projects does not throw', () => {
  const st = { projects: [proj('p1', 'c1', [task('a', 'next', '2026-10-15')])] };
  assert.deepStrictEqual(areaSummaries(st, NOW).map((x) => x.id), [null]);
  assert.deepStrictEqual(areaSummaries({}, NOW), []);
  assert.strictEqual(weekDays({}, NOW).length, 7);
  assert.deepStrictEqual(weekCounts({}, NOW), { overdue: 0, dueThisWeek: 0, undated: 0 });
});

// A week holding a clock change. Only meaningful where the local zone has one, so run it as
// TZ=Europe/London node --test app/js/overview.test.mjs (UK clocks go back on Sun 25 Oct 2026).
test('a week holding a daylight-saving change keeps each task on its own day', () => {
  const now = new Date(2026, 9, 22, 12, 0).getTime(); // Thursday 22 Oct 2026, local
  const st = state([task('a', 'next', '2026-10-25'), task('b', 'next', '2026-10-26'), task('c', 'next', '2026-10-28')]);
  const days = weekDays(st, now);
  assert.deepStrictEqual(days.map((d) => d.label), ['THU 22', 'FRI 23', 'SAT 24', 'SUN 25', 'MON 26', 'TUE 27', 'WED 28']);
  assert.deepStrictEqual([ids(days[3]), ids(days[4]), ids(days[6])], [['a'], ['b'], ['c']]);
});
