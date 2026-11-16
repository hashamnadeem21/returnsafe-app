/* global output, maestro, http */
// Lists the user's receipt photos in the Storage emulator and the photoPaths saved on their
// receipts: output.files ("users/…/x.jpg,…"), output.fileCount and output.photoPaths.
const uid = maestro.copiedText.replace('uid:', '').trim();
const auth = { headers: { Authorization: 'Bearer owner' } };
const bucket = 'returnsafe-app.firebasestorage.app';
const prefix = encodeURIComponent(`users/${uid}/receipts/`);
const listing = JSON.parse(
  http.get(`http://127.0.0.1:9199/v0/b/${bucket}/o?prefix=${prefix}`, auth).body,
);
const files = (listing.items || []).map((i) => i.name);
output.files = files.join(',');
output.fileCount = files.length;
const root = `http://127.0.0.1:8180/v1/projects/returnsafe-app/databases/(default)/documents/users/${uid}`;
const docs = JSON.parse(http.get(`${root}/receipts`, auth).body).documents || [];
output.photoPaths = docs
  .flatMap((d) => ((d.fields.photoPaths || {}).arrayValue || {}).values || [])
  .map((v) => v.stringValue)
  .join(',');
