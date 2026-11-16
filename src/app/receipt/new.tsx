import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { Screen, ScreenHeader, useSnackbar } from '@/components';
import { ensureUserDoc } from '@/features/auth/authService';
import { canAddActive, activeUsed } from '@/features/receipts/derive';
import { LimitSheet } from '@/features/receipts/components/LimitSheet';
import { ReceiptForm, type ScanReview } from '@/features/receipts/components/ReceiptForm';
import { useReceipts } from '@/features/receipts/receiptsStore';
import { addReceipt } from '@/features/receipts/saveReceipt';
import type { ReceiptFormValues } from '@/features/receipts/schema';
import { DEFAULT_CUSTOM_WINDOW, storeById } from '@/features/receipts/stores';
import { useToday } from '@/features/receipts/useToday';
import { forgetLocalPhoto } from '@/features/scan/photos';
import { useScanDraft, type ScanDraft } from '@/features/scan/scanDraft';
import { centsToInput } from '@/lib/money';
import { useSession } from '@/stores/session';

const close = () => (router.canGoBack() ? router.back() : router.replace('/home'));

const PROFILE_WAIT_MS = 8_000;

/**
 * Right after sign-in the profile (users/{uid}) may not exist yet: the server creates it, and the
 * rules need it to check the free limit, so a receipt saved before it exists would be refused.
 * Creates it first (safe to repeat), waiting at most a few seconds. True once it surely exists.
 */
async function profileReady(): Promise<boolean> {
  if (useReceipts.getState().profile) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ready = await Promise.race([
    ensureUserDoc().then(
      () => true,
      () => false,
    ),
    new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), PROFILE_WAIT_MS);
    }),
  ]);
  clearTimeout(timer);
  return ready;
}

function initialValues(draft: ScanDraft | null, today: string): ReceiptFormValues {
  const p = draft?.parsed;
  const store = storeById(p?.storeId);
  return {
    storeId: store?.id ?? null,
    storeName: store?.name ?? '',
    purchaseDate: p?.purchaseDate ?? today,
    amount: p?.amountCents ? centsToInput(p.amountCents) : '',
    items: p?.items.join(', ') ?? '',
    returnDays: store?.returnDays ?? DEFAULT_CUSTOM_WINDOW,
  };
}

/**
 * New receipt (S10). Entered by hand, or reviewing a scan: then the photo is attached, fields the
 * scan filled in show "Detected", and an unreadable scan says so. Free users at the limit see the
 * limit sheet instead.
 */
export default function NewReceipt() {
  const uid = useSession((s) => s.user?.uid);
  const today = useToday();
  const params = useLocalSearchParams<{ from?: string }>();
  const profile = useReceipts((s) => s.profile);
  const receipts = useReceipts((s) => s.receipts);
  const allowed = canAddActive(profile, receipts);
  // Read once: the draft belongs to this screen until it is saved or left.
  const [draft] = useState(() => (params.from === 'scan' ? useScanDraft.getState().draft : null));
  const [initial] = useState(() => initialValues(draft, today));
  // Opens by itself once the profile shows the limit is reached, and again on Save if it is.
  const [limitOpen, setLimitOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const saved = useRef(false);
  // False once the screen is closed: a save still waiting for the profile is then dropped.
  const open = useRef(true);

  // Leaving without saving drops the scanned photo kept on the device.
  useEffect(
    () => () => {
      open.current = false;
      useScanDraft.getState().clear();
      if (draft && !saved.current) forgetLocalPhoto(draft.photoId);
    },
    [draft],
  );

  const scan: ScanReview | undefined = draft
    ? {
        photoUri: draft.photoUri,
        readable: draft.readable,
        detected: {
          store: draft.parsed.storeId !== null,
          date: draft.parsed.purchaseDate !== null,
          total: draft.parsed.amountCents !== null,
        },
        onRetake: () => router.replace('/scanner'),
      }
    : undefined;

  return (
    <Screen testID="screen-receipt-new">
      <ScreenHeader mode="nav" title="New receipt" onBack={close} backIcon="x" />
      <ReceiptForm
        initial={initial}
        scan={scan}
        submitLabel="Save receipt"
        onSubmit={async (input) => {
          if (!uid) return;
          const ready = await profileReady();
          // Closed while waiting: nothing to save (a scanned photo is already discarded).
          if (!open.current) return;
          if (!ready) {
            useSnackbar.getState().show({
              message: "Couldn't save the receipt. Check your connection and try again.",
            });
            return;
          }
          const st = useReceipts.getState();
          if (!canAddActive(st.profile, st.receipts)) {
            setLimitOpen(true);
            return;
          }
          saved.current = true;
          addReceipt(
            uid,
            input,
            draft ? { photoId: draft.photoId, localUri: draft.photoUri } : undefined,
          );
          useSnackbar
            .getState()
            .show({ message: 'Receipt saved', aboveTabBar: true, durationMs: 3000 });
          router.dismissTo('/home');
        }}
      />
      <LimitSheet
        visible={limitOpen || (!allowed && !dismissed)}
        used={activeUsed(profile, receipts)}
        limit={profile?.freeLimit ?? 5}
        onClose={() => {
          setLimitOpen(false);
          setDismissed(true);
          // Nothing can be saved while the limit is reached, so leave the form.
          const st = useReceipts.getState();
          if (!canAddActive(st.profile, st.receipts)) close();
        }}
      />
    </Screen>
  );
}
