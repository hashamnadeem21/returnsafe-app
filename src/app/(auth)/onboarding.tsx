import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { AppText, Button, Icon, Screen, type IconName } from '@/components';
import { useOnboarding } from '@/features/onboarding/OnboardingProvider';
import { fonts, useTheme } from '@/theme';

type Card = { key: string; icon: IconName; title: string; text: string };

const CARDS: Card[] = [
  {
    key: 'scan',
    icon: 'scan',
    title: 'Snap any receipt',
    text: 'Take a photo and we read the store, date and total for you.',
  },
  {
    key: 'remind',
    icon: 'bell',
    title: 'We remember the deadline',
    text: 'Every store has a different return window. We track it and remind you in time.',
  },
  {
    key: 'save',
    icon: 'check',
    title: 'Keep your money',
    text: "Return what doesn't work out, and see how much you've saved.",
  },
];

export default function Onboarding() {
  const { colors, spacing, radii } = useTheme();
  const { width } = useWindowDimensions();
  const { complete } = useOnboarding();
  const list = useRef<FlatList<Card>>(null);
  const [index, setIndex] = useState(0);
  const last = index === CARDS.length - 1;

  const finish = async () => {
    try {
      await complete();
    } catch {
      // The flag could not be saved; continue for this session (onboarding may show again next launch).
    }
    router.replace('/welcome');
  };

  const next = () => {
    if (last) {
      void finish();
      return;
    }
    list.current?.scrollToIndex({ index: index + 1, animated: true });
    setIndex(index + 1);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <Screen testID="screen-onboarding">
      <View style={[styles.top, { paddingHorizontal: spacing.xl }]}>
        <Pressable
          onPress={() => void finish()}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
          testID="onboarding-skip"
          style={styles.skip}
        >
          <AppText variant="body" tone="primary" style={{ fontFamily: fonts.semibold }}>
            Skip
          </AppText>
        </Pressable>
      </View>

      <FlatList
        ref={list}
        data={CARDS}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        keyExtractor={(c) => c.key}
        renderItem={({ item }) => (
          <View style={[styles.page, { width, paddingHorizontal: spacing.xxl + spacing.xs }]}>
            <View style={styles.artWrap}>
              <View
                style={[
                  styles.art,
                  { backgroundColor: colors.primarySoft, borderRadius: radii.sheet + 4 },
                ]}
              >
                <View style={[styles.artCircle, { backgroundColor: colors.surface }]}>
                  <Icon name={item.icon} size={56} color={colors.primary} />
                </View>
              </View>
            </View>
            <AppText variant="display" align="center" style={{ marginBottom: spacing.sm + 2 }}>
              {item.title}
            </AppText>
            <AppText variant="body" tone="ink2" align="center">
              {item.text}
            </AppText>
          </View>
        )}
      />

      <View style={{ paddingHorizontal: spacing.xxl + spacing.xs, paddingBottom: spacing.xl }}>
        <View
          style={[styles.dots, { marginBottom: spacing.xl }]}
          accessibilityLabel={`Page ${index + 1} of 3`}
        >
          {CARDS.map((c, i) => (
            <View
              key={c.key}
              style={[
                styles.dot,
                { backgroundColor: i === index ? colors.primary : colors.border },
                i === index && styles.dotOn,
              ]}
            />
          ))}
        </View>
        <Button label={last ? 'Get started' : 'Next'} onPress={next} testID="onboarding-next" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  skip: { minHeight: 48, minWidth: 48, alignItems: 'flex-end', justifyContent: 'center' },
  page: { flex: 1, justifyContent: 'flex-end', paddingBottom: 24 },
  artWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  art: {
    width: 250,
    height: 290,
    maxHeight: '90%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { width: 24 },
});
