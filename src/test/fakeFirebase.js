/* global jest */
/**
 * In-memory stand-in for @react-native-firebase/* used by Jest (no native modules in tests).
 * Behaves like the auth emulator for the calls the app makes.
 */
const state = {
  currentUser: null,
  accounts: new Map(),
  listeners: new Set(),
  nextUid: 1,
  callables: [],
};

function makeUser(fields) {
  return {
    uid: `uid-${state.nextUid++}`,
    email: null,
    displayName: null,
    isAnonymous: false,
    emailVerified: false,
    providerData: [],
    getIdToken: jest.fn(async () => 'token'),
    reload: jest.fn(async () => undefined),
    ...fields,
  };
}

function setCurrent(user) {
  state.currentUser = user;
  state.listeners.forEach((l) => l(user));
}

function authError(code) {
  const e = new Error(code);
  e.code = code;
  return e;
}

const authInstance = {
  get currentUser() {
    return state.currentUser;
  },
};

const fakeAuth = {
  getAuth: () => authInstance,
  connectAuthEmulator: jest.fn(),
  onAuthStateChanged: (_a, cb) => {
    state.listeners.add(cb);
    cb(state.currentUser);
    return () => state.listeners.delete(cb);
  },
  onIdTokenChanged: (_a, cb) => {
    state.listeners.add(cb);
    return () => state.listeners.delete(cb);
  },
  signInAnonymously: jest.fn(async () => {
    const user = makeUser({ isAnonymous: true });
    setCurrent(user);
    return { user };
  }),
  createUserWithEmailAndPassword: jest.fn(async (_a, email, password) => {
    if (state.accounts.has(email)) throw authError('auth/email-already-in-use');
    const user = makeUser({ email, providerData: [{ providerId: 'password' }] });
    state.accounts.set(email, { password, user });
    setCurrent(user);
    return { user };
  }),
  signInWithEmailAndPassword: jest.fn(async (_a, email, password) => {
    const acct = state.accounts.get(email);
    if (!acct || acct.password !== password) throw authError('auth/invalid-credential');
    setCurrent(acct.user);
    return { user: acct.user };
  }),
  linkWithCredential: jest.fn(async (user, cred) => {
    if (state.accounts.has(cred.email)) throw authError('auth/email-already-in-use');
    Object.assign(user, {
      isAnonymous: false,
      email: cred.email,
      providerData: [{ providerId: 'password' }],
    });
    state.accounts.set(cred.email, { password: cred.password, user });
    return { user };
  }),
  signInWithCredential: jest.fn(async () => ({ user: state.currentUser })),
  reauthenticateWithCredential: jest.fn(async () => undefined),
  fetchSignInMethodsForEmail: jest.fn(async (_a, email) =>
    state.accounts.has(email) ? ['password'] : [],
  ),
  sendEmailVerification: jest.fn(async () => undefined),
  sendPasswordResetEmail: jest.fn(async (_a, email) => {
    if (!state.accounts.has(email)) throw authError('auth/user-not-found');
  }),
  updateProfile: jest.fn(async (user, p) => Object.assign(user, p)),
  signOut: jest.fn(async () => setCurrent(null)),
  EmailAuthProvider: {
    credential: (email, password) => ({ providerId: 'password', email, password }),
  },
  GoogleAuthProvider: { credential: (idToken) => ({ providerId: 'google.com', idToken }) },
  AppleAuthProvider: {
    credential: (idToken, nonce) => ({ providerId: 'apple.com', idToken, nonce }),
  },
};

const fakeFunctions = {
  getFunctions: () => ({}),
  connectFunctionsEmulator: jest.fn(),
  httpsCallable: (_f, name) =>
    jest.fn(async (data) => {
      state.callables.push({ name, data });
      if (name === 'deleteAccount') {
        state.accounts.forEach((v, k) => v.user === state.currentUser && state.accounts.delete(k));
      }
      return { data: {} };
    }),
};

function reset() {
  state.currentUser = null;
  state.accounts.clear();
  state.listeners.clear();
  state.callables = [];
  state.nextUid = 1;
}

module.exports = { state, fakeAuth, fakeFunctions, reset, makeUser, setCurrent };
