import { router } from 'expo-router';

import { ListRow, Pill, toneForDaysLeft } from '@/components';
import { daysLeftLabel, type IsoDate } from '@/lib/dates';
import { formatUsd } from '@/lib/money';

import { daysLeftFor, displayStatus, itemsLine } from '../derive';
import type { Receipt } from '../types';

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
  return (
    <ListRow
      title={receipt.storeName}
      subtitle={itemsLine(receipt, formatUsd(receipt.amountCents))}
      right={<StatusPill receipt={receipt} today={today} />}
      divider={divider}
      onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: receipt.id } })}
      testID={`receipt-row-${receipt.id}`}
    />
  );
}
