/** Typed helpers over the in-memory Firebase fake used in Jest. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fake = require('./fakeFirebase') as {
  state: {
    currentUser: { uid: string; isAnonymous: boolean; email: string | null } | null;
    accounts: Map<string, { password: string; user: unknown }>;
    callables: { name: string; data: unknown }[];
    failing: Set<string>;
  };
  reset: () => void;
  fakeAuth: { signInAnonymously: () => Promise<unknown> };
};

export const fakeState = fake.state;
export const reset = fake.reset;
export const signInAnonymously = () => fake.fakeAuth.signInAnonymously();

// eslint-disable-next-line @typescript-eslint/no-require-imports
const store = require('./fakeFirestore') as {
  docs: Map<string, Record<string, unknown>>;
  writes: { op: 'set' | 'update' | 'delete'; path: string; value?: Record<string, unknown> }[];
  reset: () => void;
  seed: (path: string, data: Record<string, unknown>) => void;
  setPending: (path: string, pending: boolean) => void;
};

/** In-memory Firestore documents, keyed by path. */
export const firestoreDocs = store.docs;
export const firestoreWrites = store.writes;
export const resetFirestore = store.reset;
export const seedDoc = store.seed;
export const setPending = store.setPending;
