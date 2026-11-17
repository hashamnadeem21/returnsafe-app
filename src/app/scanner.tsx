import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, StyleSheet, View } from 'react-native';
import DocumentScanner, {
  ResponseType,
  ScanDocumentResponseStatus,
} from 'react-native-document-scanner-plugin';

import { AppText, Button, EmptyState, Screen, ScreenHeader } from '@/components';
import { useToday } from '@/features/receipts/useToday';
import { forgetLocalPhoto } from '@/features/scan/photos';
import { draftFromImage, useScanDraft } from '@/features/scan/scanDraft';
import { useTheme } from '@/theme';

type Mode = 'starting' | 'ready' | 'denied' | 'reading';

const close = () => (router.canGoBack() ? router.back() : router.replace('/home'));
const enterManually = () => router.replace('/receipt/new');

/**
 * iOS asks for the camera before VisionKit opens. Android's ML Kit scanner runs in Google Play
 * services and needs no camera permission from the app.
 */
async function cameraAllowed(ask: boolean): Promise<boolean> {
  if (Platform.OS !== 'ios') return true;
  let status = await ImagePicker.getCameraPermissionsAsync();
  if (!status.granted && status.canAskAgain && ask) {
    status = await ImagePicker.requestCameraPermissionsAsync();
  }
  return status.granted;
}

/**
 * Scan (S09). Opens the system document scanner straight away (VisionKit on iOS, ML Kit on
 * Android), which finds the receipt's edges and captures it. Whenever the scanner is closed,
 * Scan again, Choose photo and Enter manually are one tap away.
 */
export default function Scanner() {
  const { colors, spacing } = useTheme();
  const today = useToday();
  const [mode, setMode] = useState<Mode>('starting');
  const [notice, setNotice] = useState<string | null>(null);
  // False once the screen is closed: a photo still being read is then thrown away.
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
    };
  }, []);

  const readImage = async (uri: string) => {
    setMode('reading');
    try {
      const draft = await draftFromImage(uri, today);
      if (!open.current) {
        forgetLocalPhoto(draft.photoId);
        return;
      }
      useScanDraft.getState().set(draft);
      router.replace({ pathname: '/receipt/new', params: { from: 'scan' } });
    } catch {
      if (!open.current) return;
      setNotice("That photo couldn't be opened. Try again or enter the receipt by hand.");
      setMode('ready');
    }
  };

  // Written as a promise chain so every state change happens after the permission check.
  const scan = (ask = true): Promise<void> =>
    cameraAllowed(ask).then(async (allowed) => {
      setNotice(null);
      if (!allowed) {
        setMode('denied');
        return;
      }
      try {
        const result = await DocumentScanner.scanDocument({
          maxNumDocuments: 1,
          croppedImageQuality: 100,
          responseType: ResponseType.ImageFilePath,
        });
        const uri = result.scannedImages?.[0];
        if (result.status === ScanDocumentResponseStatus.Success && uri) {
          await readImage(uri);
          return;
        }
      } catch {
        setNotice("The scanner isn't available on this device. Choose a photo instead.");
      }
      setMode('ready');
    });

  const choosePhoto = async () => {
    setNotice(null);
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    const uri = picked.canceled ? undefined : picked.assets[0]?.uri;
    if (uri) await readImage(uri);
  };

  // Open the scanner as soon as the screen appears.
  useEffect(() => {
    void scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Back from Settings with the camera now allowed: offer the scanner again.
  useEffect(() => {
    if (mode !== 'denied') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void cameraAllowed(false).then((ok) => {
        if (ok) setMode('ready');
      });
    });
    return () => sub.remove();
  }, [mode]);

  return (
    <Screen testID="screen-scanner">
      <ScreenHeader
        mode="nav"
        title="Scan receipt"
        onBack={close}
        backIcon="x"
        testID="screen-scanner-title"
      />
      {mode === 'reading' || mode === 'starting' ? (
        <View style={[styles.center, { gap: spacing.md }]} testID="scanner-reading">
          <ActivityIndicator color={colors.primary} size="large" />
          <AppText variant="body" tone="ink2">
            {mode === 'reading' ? 'Reading receipt…' : 'Opening the scanner…'}
          </AppText>
        </View>
      ) : mode === 'denied' ? (
        <EmptyState
          icon="lock"
          title="Camera access is off"
          message="ReturnSafe uses the camera to scan your receipts. Turn on camera access in Settings, or enter the receipt by hand."
          testID="scanner-denied"
        />
      ) : (
        <EmptyState
          icon="scan"
          title="Scan a receipt"
          message="Hold the receipt flat in good light. The scanner finds the edges and takes the photo for you."
          testID="scanner-ready"
        />
      )}
      {mode === 'ready' || mode === 'denied' ? (
        <View style={{ padding: spacing.screen, gap: spacing.sm }}>
          {notice ? (
            <AppText variant="caption" tone="ink2" align="center" testID="scanner-notice">
              {notice}
            </AppText>
          ) : null}
          {mode === 'denied' ? (
            <Button
              label="Open Settings"
              onPress={() => void Linking.openSettings()}
              testID="scanner-open-settings"
            />
          ) : (
            <Button
              label="Scan receipt"
              icon="scan"
              onPress={() => void scan()}
              testID="scanner-start"
            />
          )}
          <Button
            label="Choose photo"
            variant="secondary"
            icon="image"
            onPress={() => void choosePhoto()}
            testID="scanner-library"
          />
          <Button
            label="Enter manually"
            variant="text"
            onPress={enterManually}
            testID="scanner-enter-manually"
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
