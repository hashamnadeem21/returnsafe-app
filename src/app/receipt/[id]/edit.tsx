import { router, useLocalSearchParams } from 'expo-router';

import { EmptyState, Screen, ScreenHeader } from '@/components';
import { centsToInput } from '@/lib/money';
import { ReceiptForm } from '@/features/receipts/components/ReceiptForm';
import { useReceipts } from '@/features/receipts/receiptsStore';
import { editReceipt } from '@/features/receipts/saveReceipt';
import { useSession } from '@/stores/session';

const back = () => (router.canGoBack() ? router.back() : router.replace('/home'));

/** Edit receipt: the same form, filled in. Saving recomputes the deadline. */
export default function EditReceipt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const uid = useSession((s) => s.user?.uid);
  const receipt = useReceipts((s) => s.receipts.find((r) => r.id === id));

  return (
    <Screen testID="screen-receipt-edit">
      <ScreenHeader mode="nav" title="Edit receipt" onBack={back} backIcon="x" />
      {receipt ? (
        <ReceiptForm
          initial={{
            storeId: receipt.storeId,
            storeName: receipt.storeName,
            purchaseDate: receipt.purchaseDate,
            amount: centsToInput(receipt.amountCents),
            items: receipt.items.join(', '),
            returnDays: receipt.returnDays,
          }}
          submitLabel="Save changes"
          onSubmit={(input) => {
            if (!uid) return;
            editReceipt(uid, receipt.id, input);
            back();
          }}
        />
      ) : (
        <EmptyState icon="receipt" title="Receipt not found" message="It may have been deleted." />
      )}
    </Screen>
  );
}
