import AsyncStorage from '@react-native-async-storage/async-storage';

import { takeFreshInstall } from '@/lib/install';
import { hasSeenOnboarding, markOnboardingSeen } from '@/lib/onboarding';
import * as telemetry from '@/lib/telemetry';

/** Loads a fresh copy of a src/lib module with the emulator flag set or unset. */
function load<T extends object>(path: string, emulators: boolean): T {
  const before = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS;
  process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS = emulators ? '1' : '';
  let mod: T | undefined;
  jest.isolateModules(() => {
    mod = jest.requireActual<T>(path);
  });
  process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS = before;
  return mod as T;
}

describe('autofill', () => {
  type Mod = typeof import('@/lib/autofill');

  it('gives password managers their hints in real builds', () => {
    const { autofill } = load<Mod>('@/lib/autofill', false);
    expect(autofill('username')).toEqual({ autoComplete: 'email', textContentType: 'username' });
    expect(autofill('new-password').textContentType).toBe('newPassword');
    expect(autofill('current-password').textContentType).toBe('password');
  });

  it('switches the iOS password sheets off in emulator builds', () => {
    const { autofill } = load<Mod>('@/lib/autofill', true);
    expect(autofill('username')).toEqual({ autoComplete: 'off', textContentType: 'none' });
    expect(autofill('new-password')).toEqual({
      autoComplete: 'off',
      textContentType: 'oneTimeCode',
    });
  });
});

describe('configureFirebase', () => {
  type Mod = typeof import('@/lib/firebase');

  beforeEach(() => jest.clearAllMocks());

  it('starts App Check in real builds and keeps going if it fails', async () => {
    const appCheck = jest.requireMock<{ initializeAppCheck: jest.Mock }>(
      '@react-native-firebase/app-check',
    );
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    appCheck.initializeAppCheck.mockRejectedValueOnce(new Error('no attest'));
    const { configureFirebase } = load<Mod>('@/lib/firebase', false);
    await expect(configureFirebase()).resolves.toBeUndefined();
    expect(appCheck.initializeAppCheck).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('App Check init failed', expect.any(Error));
    // A second call does nothing.
    await configureFirebase();
    expect(appCheck.initializeAppCheck).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('skips App Check against the emulators', async () => {
    const appCheck = jest.requireMock<{ initializeAppCheck: jest.Mock }>(
      '@react-native-firebase/app-check',
    );
    const { configureFirebase } = load<Mod>('@/lib/firebase', true);
    await configureFirebase();
    expect(appCheck.initializeAppCheck).not.toHaveBeenCalled();
  });
});

describe('install and onboarding flags', () => {
  beforeEach(() => AsyncStorage.clear());

  it('reports a fresh install once', async () => {
    expect(await takeFreshInstall()).toBe(true);
    expect(await takeFreshInstall()).toBe(false);
  });

  it('treats unreadable storage as not fresh and onboarding not seen', async () => {
    const getItem = AsyncStorage.getItem as jest.Mock;
    getItem.mockRejectedValueOnce(new Error('locked')).mockRejectedValueOnce(new Error('locked'));
    expect(await takeFreshInstall()).toBe(false);
    expect(await hasSeenOnboarding()).toBe(false);
  });

  it('remembers onboarding', async () => {
    expect(await hasSeenOnboarding()).toBe(false);
    await markOnboardingSeen();
    expect(await hasSeenOnboarding()).toBe(true);
  });
});

describe('telemetry when the SDK fails', () => {
  it('never throws into the app', async () => {
    const analytics = jest.requireMock<{
      logEvent: jest.Mock;
      setAnalyticsCollectionEnabled: jest.Mock;
    }>('@react-native-firebase/analytics');
    const crashlytics = jest.requireMock<{ recordError: jest.Mock }>(
      '@react-native-firebase/crashlytics',
    );
    analytics.setAnalyticsCollectionEnabled.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    await expect(telemetry.startTelemetry(true)).resolves.toBeUndefined();
    expect(telemetry.telemetryEnabled()).toBe(true);

    analytics.logEvent.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(() => telemetry.track({ name: 'receipt_returned' })).not.toThrow();
    analytics.logEvent.mockImplementationOnce(() => Promise.reject(new Error('later')));
    expect(() => telemetry.track({ name: 'receipt_returned' })).not.toThrow();

    telemetry.reportError('plain string', 'test');
    expect(crashlytics.recordError).toHaveBeenLastCalledWith(
      expect.anything(),
      new Error('plain string'),
      'test',
    );
    crashlytics.recordError.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(() => telemetry.reportError(new Error('x'), 'test')).not.toThrow();
    await telemetry.startTelemetry(false);
  });
});
