// unblock/js/notes-library.js -- the Notes library on this device (#17).
// Two layers: pure merge/list functions (unit-tested) and a thin IndexedDB store.
// Own database 'unblock-notes'; never touches the app's main state, tasks, projects or inbox.

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameBody = (a, b) => a.title === b.title && a.text === b.text && same(a.items || [], b.items || []);
const sameContent = (a, b) => sameBody(a, b) && same(a.labels || [], b.labels || []);

// existing: library notes; incoming: notes from import-read; now: ms timestamp.
export function mergeImport(existing, incoming, now) {
  const notes = existing.slice();
  const byId = new Map(notes.map((n, i) => [n.id, i]));
  const added = [];
  const updated = [];
  const skipped = [];
  for (const inc of incoming) {
    if (byId.has(inc.id)) {
      const i = byId.get(inc.id);
      const cur = notes[i];
      if (cur.status === 'waiting' && !sameContent(cur, inc)) {
        const next = {
          ...cur,
          title: inc.title, text: inc.text, items: inc.items, labels: inc.labels,
          editedAt: inc.editedAt, updatedAt: now, status: 'waiting',
        };
        notes[i] = next;
        updated.push(next);
      } else {
        skipped.push(inc);
      }
    } else if (notes.some((n) => sameBody(n, inc))) {
      skipped.push(inc);
    } else {
      const next = { ...inc, status: 'waiting' };
      byId.set(next.id, notes.length);
      notes.push(next);
      added.push(next);
    }
  }
  return { notes, added: added.length, updated: updated.length, skipped: skipped.length,
    addedNotes: added, updatedNotes: updated, skippedNotes: skipped };
}

export function waitingCount(notes) {
  return notes.filter((n) => n.status === 'waiting').length;
}

export function notesBySource(notes) {
  const out = { keep: 0, text: 0, word: 0 };
  for (const n of notes) if (n.source in out) out[n.source]++;
  return out;
}

const stamp = (n) => n.editedAt ?? n.createdAt ?? n.importedAt ?? 0;

export function listNotes(notes, { source, query, status } = {}) {
  const q = String(query || '').trim().toLowerCase();
  return notes
    .filter((n) => !source || n.source === source)
    .filter((n) => !status || n.status === status)
    .filter((n) => {
      if (!q) return true;
      const hay = [n.title, n.text, ...(n.items || []).map((i) => i.text), ...(n.labels || [])];
      return hay.some((s) => String(s || '').toLowerCase().includes(q));
    })
    .sort((a, b) => stamp(b) - stamp(a));
}

// ---- IndexedDB layer (browser only; checked in the browser check, #19) ----

const DB_NAME = 'unblock-notes';
const STORE = 'notes';

function fail(what, err) {
  const detail = err && err.message ? err.message : (err && err.name) || 'unknown error';
  return new Error('Notes library: could not ' + what + ' (' + detail + ')');
}

function request(req, what) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(fail(what, req.error));
  });
}

export function openLibrary(indexedDBImpl = globalThis.indexedDB) {
  if (!indexedDBImpl) return Promise.reject(new Error('Notes library: this browser has no IndexedDB'));
  const opening = new Promise((resolve, reject) => {
    let req;
    try { req = indexedDBImpl.open(DB_NAME, 1); } catch (e) { reject(fail('open the library', e)); return; }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(fail('open the library', req.error));
    req.onblocked = () => reject(fail('open the library', new Error('blocked by another tab')));
  });
  return opening.then((db) => {
    const store = (mode) => db.transaction(STORE, mode).objectStore(STORE);
    return {
      all: () => { try { return request(store('readonly').getAll(), 'read notes'); } catch (e) { return Promise.reject(fail('read notes', e)); } },
      saveAll: (notes) => new Promise((resolve, reject) => {
        try {
          const tx = db.transaction(STORE, 'readwrite');
          const s = tx.objectStore(STORE);
          for (const n of notes) s.put(n);
          tx.oncomplete = () => resolve(notes.length);
          tx.onerror = () => reject(fail('save notes', tx.error));
          tx.onabort = () => reject(fail('save notes', tx.error));
        } catch (e) { reject(fail('save notes', e)); }
      }),
      clear: () => { try { return request(store('readwrite').clear(), 'clear notes').then(() => undefined); } catch (e) { return Promise.reject(fail('clear notes', e)); } },
    };
  });
}

// all() -> mergeImport -> saveAll(changed only) -> counts.
export async function importIntoLibrary(lib, incoming, now) {
  const existing = await lib.all();
  const r = mergeImport(existing, incoming, now);
  await lib.saveAll([...r.addedNotes, ...r.updatedNotes]);
  return { added: r.added, updated: r.updated, skipped: r.skipped };
}
