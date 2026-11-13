// Creates an email/password account in the auth emulator: output.email (password Test1234).
output.email = `${PREFIX}-${Date.now()}@example.com`;
const res = http.post(
  'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key',
  {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: output.email, password: 'Test1234', returnSecureToken: true }),
  },
);
if (res.status !== 200) throw new Error(`Auth emulator signUp failed: ${res.status} ${res.body}`);
