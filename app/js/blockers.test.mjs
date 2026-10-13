// unblock/js/blockers.test.mjs -- run with: node --test app/js/blockers.test.mjs
//
// Blockers (#3): a blocker is its own task; while it is open the blocked task is held out of the
// pick and the card counts, and finishing or deleting the blocker frees it with nothing to clear.
import test from 'node:test';
import assert from 'node:assert';

const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };

const { state, openBlockers, tasksBlockedBy, openTasksMatching } = await import('./state.js');
const M = await import('./mutations.js');
const { renderTaskRow, renderTaskEditForm, renderFocus } = await import('./render.js');
const { findTaskWithProject } = await import('./state.js');

function fresh() {
  state.projects = [{ id: 'home', name: 'Home', tasks: [
    { id: 'dishes', title: 'Do the dishes', status: 'next', source: 'manual', categoryIds: ['chore'] },
    { id: 'call', title: 'Call the doctor', status: 'next', source: 'manual', categoryIds: [] },
  ] }];
  state.categories = [{ id: 'chore', name: 'chore', color: '#888888' }];
  state.focus = null;
}

test('a blocker is a new task in the same project, with the same labels', () => {
  fresh();
  const b = M.addBlocker('dishes', '  Buy dish soap ');
  assert.equal(b.title, 'Buy dish soap');
  assert.ok(state.projects[0].tasks.includes(b));
  assert.deepEqual(b.categoryIds, ['chore']);
  assert.deepEqual(findTaskWithProject('dishes').task.blockedBy, [b.id]);
});

test('an empty line adds nothing', () => {
  fresh();
  assert.equal(M.addBlocker('dishes', '   '), null);
  assert.equal(state.projects[0].tasks.length, 2);
  assert.equal(findTaskWithProject('dishes').task.blockedBy, undefined);
});

test('a blocked task is not dealt; its blocker is', () => {
  fresh();
  const b = M.addBlocker('dishes', 'Buy dish soap');
  const pool = openTasksMatching({ categoryId: 'chore' });
  assert.deepEqual(pool, [b.id]);
  assert.deepEqual(openBlockers(findTaskWithProject('dishes').task).map((t) => t.id), [b.id]);
  assert.deepEqual(tasksBlockedBy(b).map((t) => t.id), ['dishes']);
});

test('finishing the blocker frees the task', () => {
  fresh();
  const b = M.addBlocker('dishes', 'Buy dish soap');
  b.status = 'done';
  assert.deepEqual(openTasksMatching({ categoryId: 'chore' }), ['dishes']);
});

test('deleting the blocker frees the task too', () => {
  fresh();
  const b = M.addBlocker('dishes', 'Buy dish soap');
  state.projects[0].tasks = state.projects[0].tasks.filter((t) => t.id !== b.id);
  assert.deepEqual(openTasksMatching({ categoryId: 'chore' }), ['dishes']);
});

test('two blockers: the task waits until both are done', () => {
  fresh();
  const a = M.addBlocker('dishes', 'Buy dish soap');
  const b = M.addBlocker('dishes', 'Empty the dishwasher');
  a.status = 'done';
  assert.ok(!openTasksMatching({}).includes('dishes'));
  b.status = 'done';
  assert.ok(openTasksMatching({}).includes('dishes'));
});

test('rows say what is in the way, and what a blocker unblocks', () => {
  fresh();
  const b = M.addBlocker('dishes', 'Buy dish soap');
  const p = state.projects[0];
  assert.match(renderTaskRow(findTaskWithProject('dishes').task, p, state.categories, {}), /In the way: Buy dish soap/);
  assert.match(renderTaskRow(b, p, state.categories, {}), /Unblocks: Do the dishes/);
  assert.doesNotMatch(renderTaskRow(findTaskWithProject('call').task, p, state.categories, {}), /In the way|Unblocks/);
  M.addBlocker('dishes', 'Empty the dishwasher');
  assert.match(renderTaskRow(findTaskWithProject('dishes').task, p, state.categories, {}), /In the way: 2 tasks/);
});

test('the editor lists blockers and offers an empty field for new ones', () => {
  fresh();
  M.addBlocker('dishes', 'Buy dish soap');
  const html = renderTaskEditForm(findTaskWithProject('dishes').task, state.projects[0], state.categories);
  assert.match(html, /In the way: Buy dish soap/);
  assert.match(html, /<textarea name="blockers"[^>]*><\/textarea>/);
});

test('a focused blocked task offers its blocker instead', () => {
  fresh();
  const b = M.addBlocker('dishes', 'Buy dish soap');
  state.focus = { taskId: 'dishes', startedAt: Date.now() };
  const html = renderFocus(state, findTaskWithProject, {});
  assert.match(html, new RegExp('data-action="focus-task" data-task="' + b.id + '"'));
  assert.match(html, /Buy dish soap, do that first/);
});
