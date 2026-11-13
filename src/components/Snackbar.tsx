import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { fonts, sizes, useTheme } from '@/theme';

import { AppText } from './AppText';

type SnackbarMessage = {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs: number;
  /** Lift above the tab bar on tab screens. */
  aboveTabBar: boolean;
};

type SnackbarState = {
  current: SnackbarMessage | null;
  show: (
    m: Omit<SnackbarMessage, 'id' | 'aboveTabBar' | 'durationMs'> & {
      durationMs?: number;
      aboveTabBar?: boolean;
    },
  ) => number;
  hide: (id?: number) => void;
};

let nextId = 1;

export const useSnackbar = create<SnackbarState>((set, get) => ({
  current: null,
  show: (m) => {
    const id = nextId++;
    set({ current: { durationMs: 5000, aboveTabBar: false, ...m, id } });
    return id;
  },
  hide: (id) => {
    if (id === undefined || get().current?.id === id) set({ current: null });
  },
}));

/** One snackbar at a time, drawn above every screen. Rendered once in the root layout. */
export function SnackbarHost() {
  const current = useSnackbar((s) => s.current);
  const hide = useSnackbar((s) => s.hide);
  const insets = useSafeAreaInsets();
  const { colors, radii, spacing } = useTheme();

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => hide(current.id), current.durationMs);
    return () => clearTimeout(t);
  }, [current, hide]);

  if (!current) return null;
  const bottom = insets.bottom + spacing.lg + (current.aboveTabBar ? sizes.tabBar : 0);
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.wrap]}>
      <View
        testID="snackbar"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[
          styles.bar,
          {
            bottom,
            marginHorizontal: spacing.lg,
            backgroundColor: colors.bannerOfflineBg,
            borderRadius: radii.input,
          },
        ]}
      >
        <AppText variant="body" style={[styles.text, { color: colors.bannerOfflineText }]}>
          {current.message}
        </AppText>
        {current.actionLabel ? (
          <Pressable
            testID="snackbar-action"
            accessibilityRole="button"
            accessibilityLabel={current.actionLabel}
            hitSlop={8}
            onPress={() => {
              current.onAction?.();
              hide(current.id);
            }}
            style={styles.action}
          >
            <AppText
              variant="body"
              style={{ color: colors.primaryLine, fontFamily: fonts.semibold }}
            >
              {current.actionLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'flex-end' },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    minHeight: sizes.tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
  },
  text: { flex: 1, paddingVertical: 12 },
  action: {
    minWidth: sizes.tapTarget,
    minHeight: sizes.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});
