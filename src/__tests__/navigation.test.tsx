import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { ONBOARDING_KEY } from '@/lib/onboarding';

jest.mock('@expo-google-fonts/inter', () => ({
  useFonts: () => [true, null],
  Inter_400Regular: 1,
  Inter_500Medium: 1,
  Inter_600SemiBold: 1,
  Inter_700Bold: 1,
  Inter_800ExtraBold: 1,
}));

const APP_DIR = 'src/app';

describe('navigation', () => {
  beforeEach(() => AsyncStorage.clear());

  it('TC-101 (unit): first launch shows onboarding; Skip stores the flag and opens Welcome', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByTestId('screen-onboarding')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('onboarding-skip'));
    expect(await screen.findByTestId('screen-welcome')).toBeTruthy();
    expect(await AsyncStorage.getItem(ONBOARDING_KEY)).toBe('1');
  });

  it('TC-101 (unit): onboarding is not shown again once seen', async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    await renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByTestId('screen-welcome')).toBeTruthy();
    expect(screen.queryByTestId('screen-onboarding')).toBeNull();
  });

  it('TC-102 (unit): each tab shows its title and Scan opens the scanner modal', async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    await renderRouter(APP_DIR, { initialUrl: '/home' });
    const tabs: [string, string][] = [
      ['receipts', 'Receipts'],
      ['warranties', 'Warranties'],
      ['settings', 'Settings'],
      ['home', 'Your returns'],
    ];
    for (const [tab, title] of tabs) {
      await fireEvent.press(screen.getByTestId(`tab-${tab}`));
      expect(await screen.findByTestId(`screen-${tab}-title`)).toHaveTextContent(title);
    }
    await fireEvent.press(screen.getByTestId('tab-scan'));
    expect(await screen.findByTestId('screen-scanner')).toBeTruthy();
  });
});
