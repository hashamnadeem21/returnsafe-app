import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type BannerKind = 'warn' | 'info' | 'offline';

type Props = { kind: BannerKind; message: string; testID?: string };

export function Banner({ kind, message, testID }: Props) {
  const { colors, radii } = useTheme();
  const map: Record<BannerKind, { bg: string; fg: string; icon: IconName }> = {
    warn: { bg: colors.warningSoft, fg: colors.bannerWarnText, icon: 'alert' },
    info: { bg: colors.primarySoft, fg: colors.bannerInfoText, icon: 'info' },
    offline: { bg: colors.bannerOfflineBg, fg: colors.bannerOfflineText, icon: 'wifiOff' },
  };
  const s = map[kind];
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: s.bg, borderRadius: radii.banner }]}
    >
      <Icon name={s.icon} size={18} color={s.fg} />
      <AppText variant="caption" style={[styles.text, { color: s.fg }]}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  text: { flex: 1 },
});
