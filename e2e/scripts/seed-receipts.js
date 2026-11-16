/* global output, maestro, http, COUNT, STORE, STORE_ID, DAYS_AGO, DAYS, CENTS */
// Adds COUNT active receipts straight to the Firestore emulator for the user in maestro.copiedText.
// The onReceiptWrite function then updates the user's activeCount, as it does for app writes.
const uid = maestro.copiedText.replace('uid:', '').trim();
const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const now = new Date();
const base = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
const day = 86400000;
const purchase = new Date(base - Number(DAYS_AGO || 0) * day);
const deadline = new Date(purchase.getTime() + Number(DAYS || 90) * day);
const str = (v) => ({ stringValue: v });
for (let i = 0; i < Number(COUNT || 1); i++) {
  const res = http.post(
    `http://127.0.0.1:8180/v1/projects/returnsafe-app/databases/(default)/documents/users/${uid}/receipts`,
    {
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({
        fields: {
          storeId: STORE_ID ? str(STORE_ID) : { nullValue: null },
          storeName: str(STORE || 'Target'),
          purchaseDate: str(iso(purchase)),
          amountCents: { integerValue: String(CENTS || 1000) },
          items: { arrayValue: { values: [] } },
          returnDays: { integerValue: String(DAYS || 90) },
          returnDeadline: str(iso(deadline)),
          warrantyMonths: { nullValue: null },
          warrantyEnd: { nullValue: null },
          status: str('active'),
          photoPaths: { arrayValue: { values: [] } },
          ocrText: { nullValue: null },
          statusChangedAt: { nullValue: null },
          createdAt: { timestampValue: now.toISOString() },
          updatedAt: { timestampValue: now.toISOString() },
        },
      }),
    },
  );
  if (res.status !== 200) throw new Error(`Seeding failed: ${res.status} ${res.body}`);
}
output.uid = uid;
