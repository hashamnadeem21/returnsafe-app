/** Typed helpers over the in-memory Firebase fake used in Jest. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fake = require('./fakeFirebase') as {
  state: {
    currentUser: { uid: string; isAnonymous: boolean; email: string | null } | null;
    accounts: Map<string, { password: string; user: unknown }>;
    callables: { name: string; data: unknown }[];
  };
  reset: () => void;
  fakeAuth: { signInAnonymously: () => Promise<unknown> };
};

export const fakeState = fake.state;
export const reset = fake.reset;
export const signInAnonymously = () => fake.fakeAuth.signInAnonymously();
