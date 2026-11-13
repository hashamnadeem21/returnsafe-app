/* global jest */
/**
 * In-memory stand-in for the @react-native-firebase/firestore modular API used by the app.
 * Writes apply at once and notify listeners, like the local cache does.
 */
const docs = new Map(); // path -> data
const listeners = new Set(); // { ref, next }
let nextId = 1;
/** Paths whose latest change has not reached the server (offline). */
const pending = new Set();

const SERVER_TIME = { __serverTimestamp: true };

function join(segments) {
  return segments.filter(Boolean).join('/');
}

function collection(parent, ...segments) {
  const base = parent && parent.path ? [parent.path] : [];
  return { kind: 'col', path: join([...base, ...segments]) };
}

function doc(parent, ...segments) {
  const base = parent && parent.path ? [parent.path] : [];
  if (parent && parent.kind === 'col' && segments.length === 0) {
    const id = `doc${nextId++}`;
    return { kind: 'doc', path: `${parent.path}/${id}`, id };
  }
  const path = join([...base, ...segments]);
  return { kind: 'doc', path, id: path.split('/').pop() };
}

function query(col, ...constraints) {
  return { kind: 'query', path: col.path, constraints };
}

function orderBy(field, direction = 'asc') {
  return { type: 'orderBy', field, direction };
}

function where(field, op, value) {
  return { type: 'where', field, op, value };
}

function stamp(value) {
  const now = Date.now();
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = v === SERVER_TIME ? { toMillis: () => now } : v;
  }
  return out;
}

function snapshotFor(ref) {
  if (ref.kind === 'doc') {
    const data = docs.get(ref.path);
    return { id: ref.id, exists: () => data !== undefined, data: () => data };
  }
  const prefix = `${ref.path}/`;
  let rows = [...docs.entries()]
    .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
    .map(([p, data]) => ({ id: p.slice(prefix.length), data }));
  for (const c of ref.constraints ?? []) {
    if (c.type === 'where' && c.op === '==') rows = rows.filter((r) => r.data[c.field] === c.value);
    if (c.type === 'orderBy') {
      const dir = c.direction === 'desc' ? -1 : 1;
      rows.sort((a, b) =>
        a.data[c.field] > b.data[c.field] ? dir : a.data[c.field] < b.data[c.field] ? -dir : 0,
      );
    }
  }
  return {
    size: rows.length,
    docs: rows.map((r) => ({
      id: r.id,
      data: () => r.data,
      metadata: { hasPendingWrites: pending.has(`${prefix}${r.id}`), fromCache: false },
    })),
  };
}

function notify() {
  for (const l of [...listeners]) l.next(snapshotFor(l.ref));
}

function onSnapshot(ref, ...args) {
  const [next, error] = typeof args[0] === 'function' ? args : args.slice(1);
  const l = { ref, next, error };
  listeners.add(l);
  next(snapshotFor(ref));
  return () => listeners.delete(l);
}

const writes = [];

async function setDoc(ref, value) {
  writes.push({ op: 'set', path: ref.path, value });
  docs.set(ref.path, stamp(value));
  notify();
}

async function updateDoc(ref, value) {
  writes.push({ op: 'update', path: ref.path, value });
  const current = docs.get(ref.path);
  if (!current) throw Object.assign(new Error('not-found'), { code: 'firestore/not-found' });
  docs.set(ref.path, { ...current, ...stamp(value) });
  notify();
}

async function deleteDoc(ref) {
  writes.push({ op: 'delete', path: ref.path });
  docs.delete(ref.path);
  notify();
}

function reset() {
  docs.clear();
  listeners.clear();
  writes.length = 0;
  pending.clear();
  nextId = 1;
}

/** Puts a document in place (as if it came from the server) and notifies listeners. */
function seed(path, data) {
  docs.set(path, data);
  notify();
}

const fakeFirestore = {
  getFirestore: () => ({ path: '' }),
  connectFirestoreEmulator: jest.fn(),
  terminate: jest.fn(async () => undefined),
  clearPersistence: jest.fn(async () => undefined),
  collection,
  doc,
  query,
  orderBy,
  where,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp: () => SERVER_TIME,
};

/** Marks a document as waiting to sync (or synced) and notifies listeners. */
function setPending(path, isPending) {
  if (isPending) pending.add(path);
  else pending.delete(path);
  notify();
}

module.exports = { fakeFirestore, docs, writes, reset, seed, setPending };
