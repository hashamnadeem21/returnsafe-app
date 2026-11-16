import { router } from 'expo-router';
import { useState } from 'react';

import { Screen, ScreenHeader, useSnackbar } from '@/components';
import { canAddActive, activeUsed } from '@/features/receipts/derive';
import { LimitSheet } from '@/features/receipts/components/LimitSheet';
import { ReceiptForm } from '@/features/receipts/components/ReceiptForm';
import { useReceipts } from '@/features/receipts/receiptsStore';
import { addReceipt } from '@/features/receipts/saveReceipt';
import { useToday } from '@/features/receipts/useToday';
import { useSession } from '@/stores/session';

const close = () => (router.canGoBack() ? router.back() : router.replace('/home'));

/** New receipt (S10, entered manually). Free users at the limit see the limit sheet instead. */
export default function NewReceipt() {
  const uid = useSession((s) => s.user?.uid);
  const today = useToday();
  const profile = useReceipts((s) => s.profile);
  const receipts = useReceipts((s) => s.receipts);
  const allowed = canAddActive(profile, receipts);
  // Opens by itself once the profile shows the limit is reached, and again on Save if it is.
  const [limitOpen, setLimitOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  return (
    <Screen testID="screen-receipt-new">
      <ScreenHeader mode="nav" title="New receipt" onBack={close} backIcon="x" />
      <ReceiptForm
        initial={{
          storeId: null,
          storeName: '',
          purchaseDate: today,
          amount: '',
          items: '',
          returnDays: 30,
        }}
        submitLabel="Save receipt"
        onSubmit={(input) => {
          if (!uid) return;
          const st = useReceipts.getState();
          if (!canAddActive(st.profile, st.receipts)) {
            setLimitOpen(true);
            return;
          }
          addReceipt(uid, input);
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
