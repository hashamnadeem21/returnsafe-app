import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {
  AppText,
  Banner,
  Button,
  Icon,
  Screen,
  ScreenHeader,
  useSnackbar,
  type BannerKind,
} from '@/components';
import { useReceipts } from '@/features/receipts/receiptsStore';
import {
  ctaLabel,
  legalText,
  planCaption,
  PRO_FEATURES,
} from '@/features/subscription/paywallText';
import {
  buy,
  loadPlans,
  restore,
  yearlySavings,
  type Plan,
  type Plans,
} from '@/features/subscription/purchases';
import { PRIVACY_URL, TERMS_URL } from '@/lib/links';
import { useIsPro } from '@/stores/pro';
import { fonts, useTheme } from '@/theme';

import logo from '../../assets/images/logo-mark.png';
import { paywallSource, track } from '@/lib/telemetry';

const close = () => (router.canGoBack() ? router.back() : router.replace('/home'));
const platform = Platform.OS === 'ios' ? 'ios' : 'android';
/** After a purchase, how long to wait for the server to mark the account Pro before closing. */
const SERVER_PRO_WAIT_MS = 8_000;

/**
 * Resolves true once users/{uid}.isPro is true (the rules check it on save), or false after a
 * timeout.
 */
function waitForServerPro(): Promise<boolean> {
  if (useReceipts.getState().profile?.isPro) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (confirmed: boolean) => {
      clearTimeout(timer);
      unsub();
      resolve(confirmed);
    };
    const timer = setTimeout(() => done(false), SERVER_PRO_WAIT_MS);
    const unsub = useReceipts.subscribe((s) => {
      if (s.profile?.isPro) done(true);
    });
  });
}

/** Shown when the purchase went through but the account isn't Pro on the server yet. */
const ACTIVATING_MESSAGE =
  'Purchase complete. Pro is still being activated on your account; this can take a minute.';

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; plans: Plans };
type Notice = { kind: BannerKind; message: string } | null;

function Radio({ on }: { on: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.radio,
        { borderColor: on ? colors.primary : colors.muted, borderWidth: on ? 7 : 2 },
      ]}
    />
  );
}

function PlanCard({
  plan,
  selected,
  badge,
  onPress,
}: {
  plan: Plan;
  selected: boolean;
  badge: string | null;
  onPress: () => void;
}) {
  const { colors, radii, spacing } = useTheme();
  const name = plan.period === 'year' ? 'Yearly' : 'Monthly';
  const caption = planCaption(plan);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name}, ${caption}${plan.perMonth ? `, ${plan.perMonth} per month` : `, ${plan.price}`}`}
      testID={`paywall-plan-${plan.period}`}
      style={[
        styles.plan,
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
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.warning }]}>
          <AppText variant="label" style={[styles.badgeText, { color: colors.ink }]}>
            {badge}
          </AppText>
        </View>
      ) : null}
      <Radio on={selected} />
      <View style={styles.flex}>
        <AppText variant="headline" style={{ fontFamily: fonts.bold }}>
          {name}
        </AppText>
        <AppText variant="caption">{caption}</AppText>
      </View>
      <View style={styles.right}>
        <AppText variant="body" style={{ fontFamily: fonts.bold }}>
          {plan.perMonth ?? plan.price}
        </AppText>
        {plan.perMonth ? <AppText variant="label">per month</AppText> : null}
      </View>
    </Pressable>
  );
}

/** S15: Pro plans with prices from the store, the trial, renewal terms, Restore and legal links. */
export default function Paywall() {
  const { colors, sizes, spacing } = useTheme();
  const isPro = useIsPro();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [period, setPeriod] = useState<Plan['period']>('year');
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const alive = useRef(true);
  const { from } = useLocalSearchParams<{ from?: string }>();
  // Once per opening of the paywall, with where it was opened from.
  useEffect(() => {
    track({ name: 'paywall_view', source: paywallSource(from) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const fetchPlans = useCallback(() => {
    loadPlans()
      .then((plans) => {
        if (!alive.current) return;
        if (!plans.yearly && !plans.monthly) return setLoad({ state: 'error' });
        setPeriod(plans.yearly ? 'year' : 'month');
        setLoad({ state: 'ready', plans });
      })
      .catch(() => alive.current && setLoad({ state: 'error' }));
  }, []);
  useEffect(fetchPlans, [fetchPlans]);
  const retry = () => {
    setLoad({ state: 'loading' });
    fetchPlans();
  };

  const plans = load.state === 'ready' ? load.plans : null;
  const plan = plans ? (period === 'year' ? plans.yearly : plans.monthly) : null;
  const savings = plans ? yearlySavings(plans) : null;

  const unlocked = async (message: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    const confirmed = await waitForServerPro();
    if (!alive.current) return;
    useSnackbar.getState().show({
      message: confirmed ? message : ACTIVATING_MESSAGE,
      durationMs: confirmed ? 3000 : 5000,
    });
    close();
  };

  const onBuy = async () => {
    if (!plan || busy) return;
    setNotice(null);
    setBusy('buy');
    track({ name: 'purchase_start', plan: plan.period });
    const result = await buy(plan);
    // Record the purchase even if the paywall was closed while the store sheet was open.
    if (result === 'pro') track({ name: 'purchase_success', plan: plan.period });
    if (!alive.current) return;
    if (result === 'pro') return unlocked('Welcome to ReturnSafe Pro');
    setBusy(null);
    // Cancelling the store sheet is a choice, not an error: nothing is shown.
    if (result === 'pending')
      setNotice({
        kind: 'info',
        message: 'Your purchase is waiting for approval. Pro unlocks as soon as it goes through.',
      });
    if (result === 'failed')
      setNotice({ kind: 'warn', message: "The purchase didn't go through. Please try again." });
  };

  const onRestore = async () => {
    if (busy) return;
    setNotice(null);
    setBusy('restore');
    try {
      const restored = await restore();
      if (!alive.current) return;
      if (restored) return unlocked('Pro restored');
      setNotice({
        kind: 'info',
        message: `No ReturnSafe Pro purchase was found for this ${platform === 'ios' ? 'Apple ID' : 'Google Play account'}.`,
      });
    } catch {
      if (alive.current)
        setNotice({
          kind: 'warn',
          message: "Couldn't restore purchases. Check your connection and try again.",
        });
    }
    if (alive.current) setBusy(null);
  };

  const link = (label: string, url: string, testID: string) => (
    <Pressable
      onPress={() => void Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={10}
      style={styles.link}
      testID={testID}
    >
      <AppText variant="caption" tone="primary" style={{ fontFamily: fonts.semibold }}>
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <Screen testID="screen-paywall">
      <ScreenHeader
        mode="nav"
        title=""
        onBack={close}
        backIcon="x"
        right={
          <Pressable
            onPress={() => void onRestore()}
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
            accessibilityState={{ busy: busy === 'restore' }}
            style={[styles.restore, { minHeight: sizes.tapTarget, paddingHorizontal: spacing.sm }]}
            testID="paywall-restore"
          >
            {busy === 'restore' ? (
              <ActivityIndicator color={colors.ink2} />
            ) : (
              <AppText variant="body" tone="ink2" style={{ fontFamily: fonts.semibold }}>
                Restore
              </AppText>
            )}
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.screen + 2,
          paddingBottom: spacing.xxl,
        }}
      >
        <View style={[styles.hero, { marginBottom: spacing.lg }]}>
          <Image source={logo} style={styles.logo} accessibilityIgnoresInvertColors />
          <AppText
            variant="display"
            align="center"
            accessibilityRole="header"
            style={{ marginTop: spacing.md }}
          >
            ReturnSafe Pro
          </AppText>
          <AppText variant="body" tone="ink2" align="center">
            One saved return pays for a year.
          </AppText>
        </View>

        <View style={{ gap: spacing.sm + 1, marginBottom: spacing.lg }}>
          {PRO_FEATURES.map((f) => (
            <View key={f} style={[styles.feature, { gap: spacing.sm + 2 }]}>
              <View style={[styles.check, { backgroundColor: colors.primarySoft }]}>
                <Icon name="check" size={14} color={colors.primary} strokeWidth={3} />
              </View>
              <AppText variant="body">{f}</AppText>
            </View>
          ))}
        </View>

        {isPro ? (
          <Banner kind="info" message="You have ReturnSafe Pro." testID="paywall-is-pro" />
        ) : load.state === 'loading' ? (
          <View style={[styles.state, { minHeight: 150 }]}>
            <ActivityIndicator color={colors.primary} testID="paywall-loading" />
          </View>
        ) : load.state === 'error' || !plan ? (
          <View style={{ gap: spacing.md }} testID="paywall-error">
            <Banner
              kind="warn"
              message="Plans can't load right now. Check your connection and try again."
            />
            <Button label="Retry" variant="secondary" onPress={retry} testID="paywall-retry" />
          </View>
        ) : (
          <>
            <View style={{ gap: spacing.md, marginBottom: spacing.lg }}>
              {plans?.yearly ? (
                <PlanCard
                  plan={plans.yearly}
                  selected={period === 'year'}
                  badge={savings ? `SAVE ${savings}%` : null}
                  onPress={() => setPeriod('year')}
                />
              ) : null}
              {plans?.monthly ? (
                <PlanCard
                  plan={plans.monthly}
                  selected={period === 'month'}
                  badge={null}
                  onPress={() => setPeriod('month')}
                />
              ) : null}
            </View>
            {notice ? (
              <View style={{ marginBottom: spacing.md }}>
                <Banner kind={notice.kind} message={notice.message} testID="paywall-notice" />
              </View>
            ) : null}
            <Button
              label={ctaLabel(plan)}
              onPress={() => void onBuy()}
              loading={busy === 'buy'}
              disabled={busy === 'restore'}
              testID="paywall-buy"
              style={{ marginBottom: spacing.sm + 2 }}
            />
            <AppText
              variant="label"
              tone="ink2"
              align="center"
              style={styles.legal}
              testID="paywall-legal"
            >
              {legalText(plan, platform)}
            </AppText>
          </>
        )}
        {notice && (isPro || load.state !== 'ready') ? (
          <View style={{ marginTop: spacing.md }}>
            <Banner kind={notice.kind} message={notice.message} testID="paywall-notice" />
          </View>
        ) : null}
        <View style={[styles.links, { gap: spacing.xs, marginTop: spacing.xs }]}>
          {link('Terms of Use', TERMS_URL, 'paywall-terms')}
          <AppText variant="caption" tone="ink2" importantForAccessibility="no">
            ·
          </AppText>
          {link('Privacy Policy', PRIVACY_URL, 'paywall-privacy')}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center' },
  logo: { width: 64, height: 64, borderRadius: 14 },
  feature: { flexDirection: 'row', alignItems: 'center' },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plan: { flexDirection: 'row', alignItems: 'center', minHeight: 72 },
  badge: { position: 'absolute', top: -11, right: 14, borderRadius: 6, paddingHorizontal: 8 },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 18 },
  radio: { width: 22, height: 22, borderRadius: 11 },
  right: { alignItems: 'flex-end' },
  state: { alignItems: 'center', justifyContent: 'center' },
  restore: { alignItems: 'center', justifyContent: 'center' },
  legal: { fontSize: 11, lineHeight: 15 },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  link: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 4 },
});
