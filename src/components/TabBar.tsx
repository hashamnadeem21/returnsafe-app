import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, shadows, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

const TAB_META: Record<string, { label: string; icon: IconName }> = {
  home: { label: 'Home', icon: 'home' },
  receipts: { label: 'Receipts', icon: 'receipt' },
  scan: { label: 'Scan', icon: 'scan' },
  warranties: { label: 'Warranties', icon: 'shield' },
  settings: { label: 'Settings', icon: 'gear' },
};

type Props = BottomTabBarProps & {
  /** Called instead of switching tabs when the raised Scan button is pressed. */
  onScanPress: () => void;
};

export function TabBar({ state, navigateToTab, onScanPress }: Props) {
  const { colors, sizes, spacing, scheme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: sizes.hairline,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
          minHeight: sizes.tabBar + Math.max(insets.bottom, spacing.sm),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const meta = TAB_META[route.name];
        if (!meta) return null;
        const focused = state.index === index;

        if (route.name === 'scan') {
          return (
            <Pressable
              key={route.key}
              testID="tab-scan"
              onPress={onScanPress}
              accessibilityRole="button"
              accessibilityLabel="Scan a receipt"
              style={styles.item}
            >
              <View
                style={[
                  styles.fab,
                  {
                    width: sizes.scanFab,
                    height: sizes.scanFab,
                    borderRadius: sizes.scanFab / 2,
                    backgroundColor: colors.primary,
                    borderColor: colors.surface,
                  },
                  scheme === 'light' && shadows.fab(colors.primary),
                ]}
              >
                <Icon name="scan" size={26} color={colors.onPrimary} strokeWidth={2.2} />
              </View>
              <AppText variant="label" tone="muted" style={styles.scanLabel}>
                {meta.label}
              </AppText>
            </Pressable>
          );
        }

        const color = focused ? colors.primary : colors.muted;
        return (
          <Pressable
            key={route.key}
            testID={`tab-${route.name}`}
            accessibilityRole="tab"
            accessibilityLabel={meta.label}
            accessibilityState={{ selected: focused }}
            onPress={() => {
              if (!focused) navigateToTab(route.key);
            }}
            style={[styles.item, { minHeight: sizes.tapTarget }]}
          >
            <Icon name={meta.icon} size={24} color={color} strokeWidth={focused ? 2.3 : 1.9} />
            <AppText
              variant="label"
              style={{ color, fontFamily: focused ? fonts.semibold : fonts.medium }}
            >
              {meta.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: 8,
  },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  fab: { alignItems: 'center', justifyContent: 'center', marginTop: -26, borderWidth: 4 },
  scanLabel: { marginTop: 2 },
});
