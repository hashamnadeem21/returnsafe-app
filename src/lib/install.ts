import AsyncStorage from '@react-native-async-storage/async-storage';

/** Set on the first launch of an install. AsyncStorage is wiped on uninstall; the iOS Keychain is not. */
export const INSTALL_KEY = 'rs.install.v1';

/**
 * True on the first launch after (re)installing. Firebase keeps the login in the iOS Keychain,
 * which survives deleting the app, so the caller signs out on a fresh install.
 */
export async function takeFreshInstall(): Promise<boolean> {
  try {
    if ((await AsyncStorage.getItem(INSTALL_KEY)) === '1') return false;
    await AsyncStorage.setItem(INSTALL_KEY, '1');
    return true;
  } catch {
    return false;
  }
}
