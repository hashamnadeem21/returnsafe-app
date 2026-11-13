/** Talks to the Firebase Emulator Suite started by `firebase emulators:exec`. */
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

export const PROJECT_ID = 'returnsafe-app';
export const BUCKET = `${PROJECT_ID}.appspot.com`;

for (const v of [
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIREBASE_STORAGE_EMULATOR_HOST',
]) {
  if (!process.env[v])
    throw new Error(`${v} is not set: run these tests with "npm run test:emulators".`);
}

if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET });
export const db = getFirestore();
export const adminAuth = getAuth();
export const bucket = getStorage().bucket(BUCKET);

const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`;
const FUNCTIONS = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1`;

export type Session = { uid: string; idToken: string };

async function post<T>(url: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

export async function signUp(email?: string, password = 'Test1234'): Promise<Session> {
  const body = email ? { email, password, returnSecureToken: true } : { returnSecureToken: true };
  const r = await post<{ localId: string; idToken: string }>(
    `${AUTH}/accounts:signUp?key=fake-key`,
    body,
  );
  return { uid: r.localId, idToken: r.idToken };
}

/** Unsigned emulator-style ID token with a chosen auth_time (the emulators accept alg "none"). */
export function tokenWithAuthTime(uid: string, authTime: number, provider = 'password'): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return [
    enc({ alg: 'none', typ: 'JWT' }),
    enc({
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      aud: PROJECT_ID,
      auth_time: authTime,
      user_id: uid,
      sub: uid,
      iat: now,
      exp: now + 3600,
      firebase: { identities: {}, sign_in_provider: provider },
    }),
    '',
  ].join('.');
}

export type CallResult<T> = {
  result?: T;
  error?: { status: string; message: string; details?: unknown };
};

export function call<T>(name: string, data: unknown, token?: string): Promise<CallResult<T>> {
  return post<CallResult<T>>(`${FUNCTIONS}/${name}`, { data }, token);
}
