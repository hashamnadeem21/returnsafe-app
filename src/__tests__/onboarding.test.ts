import AsyncStorage from '@react-native-async-storage/async-storage';

import { hasSeenOnboarding, markOnboardingSeen, ONBOARDING_KEY } from '@/lib/onboarding';

describe('onboarding flag', () => {
  beforeEach(() => AsyncStorage.clear());

  it('is false on a fresh install', async () => {
    expect(await hasSeenOnboarding()).toBe(false);
  });

  it('persists once marked seen', async () => {
    await markOnboardingSeen();
    expect(await AsyncStorage.getItem(ONBOARDING_KEY)).toBe('1');
    expect(await hasSeenOnboarding()).toBe(true);
  });
});
