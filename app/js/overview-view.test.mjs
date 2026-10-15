// run with: node --test app/js/overview-view.test.mjs  (Overview markup, #11)
import test from 'node:test';
import assert from 'node:assert';
import { renderOverview } from './overview-view.js';

const NOW = new Date(2026, 9, 15, 15, 0).getTime(); // Thursday 15 Oct 2026, local
const t = (id, status, deadline, extra) => Object.assign({ id, title: id, status }, deadline ? { deadline } : {}, extra);
const base = (over) => Object.assign({
  inbox: [], categories: [],
  projectCategories: [{ id: 'c1', name: 'Home', color: '#3E8E5E' }, { id: 'c2', name: 'School', color: '#4D6FB8' }],
  projects: [
    { id: 'p1', name: 'House', categoryId: 'c1', tasks: [t('late', 'next', '2026-10-14', { categoryIds: ['x'] }), t('soon', 'next', '2026-10-17', { categoryIds: ['x'] }), t('fin', 'done', null, { categoryIds: ['x'] })] },
    { id: 'p2', name: 'Essay', categoryId: 'c2', tasks: [t('plain', 'next', null, { categoryIds: ['x'] })] },
    { id: 'p3', name: 'Loose', tasks: [t('loose', 'next', null, { categoryIds: ['x'] })] },
  ],
}, over);

test('strip: red overdue chip sits on today with its age', () => {
  const html = renderOverview(base(), 0, NOW);
  assert.ok(/is-today" aria-current="date"/.test(html));
  assert.ok(/overview-chip due-red"[^>]*data-action="overview-task" data-project-id="p1" data-task-id="late">late · 1d overdue</.test(html));
  assert.ok(html.includes('1 overdue · 1 task due in the next 7 days · 2 with no date'));
  assert.strictEqual((html.match(/overview-day-head/g) || []).length, 7);
});

test('area cards: one per category plus No area, with progress', () => {
  const html = renderOverview(base(), 0, NOW);
  assert.strictEqual((html.match(/data-action="overview-area"/g) || []).length, 3);
  assert.ok(html.includes('data-category-id="c1"') && html.includes('data-category-id=""'));
  assert.ok(html.includes('No area') && html.includes('aria-label="33% done"'));
});

test('unsorted strip only when something is unsorted', () => {
  assert.ok(!renderOverview(base(), 0, NOW).includes('to sort'));
  const html = renderOverview(base(), 1, NOW);
  assert.ok(html.includes('1 to sort') && html.includes('data-action="set-screen" data-screen="sort"'));
});

test('empty states', () => {
  const none = renderOverview(base({ projects: [] }), 0, NOW);
  assert.ok(none.includes('data-screen="projects"') && !none.includes('overview-strip'));
  const undated = base({ projects: [{ id: 'p', name: 'P', tasks: [t('a', 'next', null, { categoryIds: ['x'] })] }] });
  assert.ok(renderOverview(undated, 0, NOW).includes('Nothing due in the next seven days.'));
});

test('user text is escaped', () => {
  const st = base({ projects: [{ id: 'p', name: 'P', categoryId: 'c1', tasks: [t('a', 'next', '2026-10-16', { title: '<img src=x onerror=1>', categoryIds: ['x'] })] }], projectCategories: [{ id: 'c1', name: '<b>Home</b>', color: '#111' }] });
  const html = renderOverview(st, 0, NOW);
  assert.ok(!html.includes('<img') && !html.includes('<b>Home') && html.includes('&lt;img'));
});
