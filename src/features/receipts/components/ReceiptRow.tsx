import { router } from 'expo-router';

import { ListRow, Pill, toneForDaysLeft } from '@/components';
import { daysLeftLabel, type IsoDate } from '@/lib/dates';
import { formatUsd } from '@/lib/money';

import { daysLeftFor, displayStatus, itemsLine } from '../derive';
import type { Receipt } from '../types';

/** The words on a receipt's status pill: "Waiting to sync", "Returned", "Kept", "Expired" or days left. */
export function statusText(receipt: Receipt, today: IsoDate): string {
  if (receipt.pending) return 'Waiting to sync';
  switch (displayStatus(receipt, today)) {
    case 'returned':
      return 'Returned';
    case 'kept':
      return 'Kept';
    case 'expired':
      return 'Expired';
    default:
      return daysLeftLabel(daysLeftFor(receipt, today));
  }
}

/** The pill on the right of a receipt row. */
export function StatusPill({ receipt, today }: { receipt: Receipt; today: IsoDate }) {
  const testID = `receipt-pill-${receipt.id}`;
  if (receipt.pending) {
    return <Pill label="Waiting to sync" tone="gray" icon="sync" testID={testID} />;
  }
  switch (displayStatus(receipt, today)) {
    case 'returned':
      return <Pill label="Returned" tone="green" testID={testID} />;
    case 'kept':
      return <Pill label="Kept" tone="gray" testID={testID} />;
    case 'expired':
      return <Pill label="Expired" tone="gray" testID={testID} />;
    default: {
      const days = daysLeftFor(receipt, today);
      return <Pill label={daysLeftLabel(days)} tone={toneForDaysLeft(days)} testID={testID} />;
    }
  }
}

type Props = { receipt: Receipt; today: IsoDate; divider?: boolean };

export function ReceiptRow({ receipt, today, divider }: Props) {
  const subtitle = itemsLine(receipt, formatUsd(receipt.amountCents));
  return (
    <ListRow
      title={receipt.storeName}
      subtitle={subtitle}
      accessibilityLabel={`${receipt.storeName}, ${subtitle}, ${statusText(receipt, today)}`}
      right={<StatusPill receipt={receipt} today={today} />}
      divider={divider}
      onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: receipt.id } })}
      testID={`receipt-row-${receipt.id}`}
    />
  );
}
