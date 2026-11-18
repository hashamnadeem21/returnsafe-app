/* global output, maestro, http */
// Counts the push tokens saved on users/{uid} in the Firestore emulator (output.tokenCount).
// maestro.copiedText is "uid:<uid>" from the Account screen.
const uid = maestro.copiedText.replace('uid:', '').trim();
const res = http.get(
  `http://127.0.0.1:8180/v1/projects/returnsafe-app/databases/(default)/documents/users/${uid}`,
  { headers: { Authorization: 'Bearer owner' } },
);
const fields = JSON.parse(res.body).fields || {};
const tokens = ((fields.fcmTokens || {}).arrayValue || {}).values || [];
output.tokenCount = tokens.length;
