import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Chip, Icon, Sheet, type IconName } from '@/components';
import { displayStatus } from '@/features/receipts/derive';
import { useVisibleReceipts } from '@/features/receipts/receiptsStore';
import { useToday } from '@/features/receipts/useToday';
import { fonts, useTheme } from '@/theme';

import { exportReceipts, type ExportFormat } from './exportReceipts';

type Include = 'all' | 'active';

const FORMATS: { key: ExportFormat; icon: IconName; title: string; caption: string }[] = [
  { key: 'pdf', icon: 'doc', title: 'PDF report', caption: 'With photos, one receipt per page' },
  {
    key: 'csv',
    icon: 'receipt',
    title: 'CSV spreadsheet',
    caption: 'Opens in Excel, Numbers or Sheets',
  },
];

function Option({
  icon,
  title,
  caption,
  selected,
  onPress,
  testID,
}: {
  icon: IconName;
  title: string;
  caption: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { colors, radii, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}, ${caption}`}
      testID={testID}
      style={[
        styles.option,
        {
          borderRadius: radii.card,
          padding: spacing.md + 2,
          gap: spacing.md,
          backgroundColor: colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: selected ? 2 : 1,
        },
      ]}
    >
      <Icon name={icon} size={24} color={selected ? colors.primary : colors.ink2} />
      <View style={styles.flex}>
        <AppText variant="body" style={{ fontFamily: fonts.semibold }}>
          {title}
        </AppText>
        <AppText variant="caption">{caption}</AppText>
      </View>
      <View
        style={[
          styles.radio,
          { borderColor: selected ? colors.primary : colors.muted, borderWidth: selected ? 7 : 2 },
        ]}
      />
    </Pressable>
  );
}

/** S20 (Pro): export receipts as a PDF with photos or a CSV, through the share sheet. */
export function ExportSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { spacing } = useTheme();
  const today = useToday();
  const receipts = useVisibleReceipts();
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [include, setInclude] = useState<Include>('all');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const active = receipts.filter((r) => displayStatus(r, today) === 'active');
  const chosen = include === 'all' ? receipts : active;

  const run = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await exportReceipts(chosen, format, today);
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Export receipts" testID="export-sheet">
      <AppText variant="caption" style={{ marginBottom: spacing.lg }}>
        For insurance, taxes or your records.
      </AppText>
      <View style={{ gap: spacing.sm + 2, marginBottom: spacing.lg }}>
        {FORMATS.map((f) => (
          <Option
            key={f.key}
            icon={f.icon}
            title={f.title}
            caption={f.caption}
            selected={format === f.key}
            onPress={() => setFormat(f.key)}
            testID={`export-${f.key}`}
          />
        ))}
      </View>
      <AppText variant="label" tone="ink2" style={{ marginBottom: spacing.sm }}>
        Include
      </AppText>
      <View style={[styles.chips, { gap: spacing.sm, marginBottom: spacing.lg }]}>
        <Chip
          label="All receipts"
          count={receipts.length}
          selected={include === 'all'}
          onPress={() => setInclude('all')}
          testID="export-include-all"
        />
        <Chip
          label="Active only"
          count={active.length}
          selected={include === 'active'}
          onPress={() => setInclude('active')}
          testID="export-include-active"
        />
      </View>
      {failed ? (
        <View style={{ marginBottom: spacing.md }}>
          <Banner
            kind="warn"
            message="Couldn't create the export. Please try again."
            testID="export-error"
          />
        </View>
      ) : null}
      <Button
        label={chosen.length === 0 ? 'No receipts to export' : 'Export'}
        icon="export"
        onPress={() => void run()}
        loading={busy}
        disabled={chosen.length === 0}
        testID="export-run"
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  option: { flexDirection: 'row', alignItems: 'center' },
  radio: { width: 22, height: 22, borderRadius: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
