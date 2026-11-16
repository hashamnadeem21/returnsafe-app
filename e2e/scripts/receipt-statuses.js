/* global output, maestro, http */
// Reads the user's receipts from the Firestore emulator: output.statuses ("active,returned"),
// output.count and output.activeCount (from users/{uid}).
const uid = maestro.copiedText.replace('uid:', '').trim();
const root = `http://127.0.0.1:8180/v1/projects/returnsafe-app/databases/(default)/documents/users/${uid}`;
const auth = { headers: { Authorization: 'Bearer owner' } };
const list = JSON.parse(http.get(`${root}/receipts`, auth).body);
const docs = list.documents || [];
output.count = docs.length;
output.statuses = docs.map((d) => d.fields.status.stringValue).join(',');
const user = JSON.parse(http.get(root, auth).body);
output.activeCount = Number((user.fields.activeCount || {}).integerValue || 0);
