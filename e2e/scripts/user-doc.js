/* global output, maestro, http */
// Reads users/{uid} from the Firestore emulator. maestro.copiedText is "uid:<uid>" from the Account screen.
const uid = maestro.copiedText.replace('uid:', '').trim();
output.uid = uid;
const res = http.get(
  `http://127.0.0.1:8180/v1/projects/returnsafe-app/databases/(default)/documents/users/${uid}`,
  { headers: { Authorization: 'Bearer owner' } },
);
output.userDocStatus = res.status;
