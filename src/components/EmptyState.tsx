import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

type Props = {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};

export function EmptyState({ icon, title, message, actionLabel, onAction, testID }: Props) {
  const { colors, spacing } = useTheme();
  return (
    <View testID={testID} style={[styles.wrap, { gap: spacing.md, padding: spacing.xxl }]}>
      <View style={[styles.circle, { backgroundColor: colors.primarySoft }]}>
        <Icon name={icon} size={40} color={colors.primary} />
      </View>
      <AppText variant="title" align="center">
        {title}
      </AppText>
      <AppText variant="body" tone="ink2" align="center">
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={{ marginTop: spacing.sm }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  circle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
