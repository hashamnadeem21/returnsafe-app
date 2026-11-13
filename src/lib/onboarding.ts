import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDING_KEY = 'rs.onboarding.done.v1';

/** True once the user has finished or skipped onboarding on this install. */
export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
}
