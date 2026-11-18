import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Icon, ProLock, Sheet, useSnackbar } from '@/components';
import { addReceiptPhoto } from '@/features/receipts/receiptsRepo';
import type { Receipt } from '@/features/receipts/types';
import { fonts, useTheme } from '@/theme';

import { newPhotoId, photoPath, preparePhoto } from './photos';
import { ReceiptPhoto } from './ReceiptPhoto';
import { enqueueUpload } from './uploadQueue';

/** Photos per receipt: one on Free, up to five with Pro (the rules enforce the same). */
export const FREE_PHOTOS = 1;
export const PRO_PHOTOS = 5;
/** iOS cannot present the picker while the source sheet is still sliding away. */
const SHEET_SWAP_MS = Platform.OS === 'ios' ? 400 : 0;

export function photoLimit(isPro: boolean): number {
  return isPro ? PRO_PHOTOS : FREE_PHOTOS;
}

type Props = { uid: string; receipt: Receipt; isPro: boolean };

/**
 * The receipt's photos, and "Add photo" for the product, serial number or manual. Free users
 * keep one photo per receipt; adding more opens the paywall.
 */
export function ExtraPhotos({ uid, receipt, isPro }: Props) {
  const { colors, sizes, spacing } = useTheme();
  const [source, setSource] = useState(false);
  const [busy, setBusy] = useState(false);
  const count = receipt.photoPaths.length;
  const full = count >= PRO_PHOTOS;
  const locked = !isPro && count >= FREE_PHOTOS;

  const add = async (pick: () => Promise<ImagePicker.ImagePickerResult>) => {
    setSource(false);
    try {
      await new Promise((r) => setTimeout(r, SHEET_SWAP_MS));
      const picked = await pick();
      const uri = picked.canceled ? undefined : picked.assets[0]?.uri;
      if (!uri) return;
      setBusy(true);
      const photoId = newPhotoId();
      const localUri = await preparePhoto(uri, photoId);
      const path = photoPath(uid, receipt.id, photoId);
      // Queue the upload first, so the receipt never lists a photo that nothing will upload.
      await enqueueUpload({ uid, receiptId: receipt.id, photoId, path, localUri });
      addReceiptPhoto(uid, receipt.id, path);
    } catch {
      useSnackbar.getState().show({ message: "That photo couldn't be added. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const camera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      useSnackbar.getState().show({ message: 'Allow camera access in Settings to take a photo.' });
      return { canceled: true, assets: null } as ImagePicker.ImagePickerResult;
    }
    return ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  };
  const library = () => ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });

  return (
    <Card style={{ overflow: 'hidden' }} testID="receipt-photos">
      {count > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        >
          {receipt.photoPaths.map((p, i) => (
            <ReceiptPhoto key={p} path={p} width={56} height={72} testID={`receipt-photo-${i}`} />
          ))}
        </ScrollView>
      ) : null}
      <Pressable
        onPress={() =>
          locked ? router.push('/paywall') : !full && !busy ? setSource(true) : undefined
        }
        disabled={full || busy}
        accessibilityRole="button"
        accessibilityLabel={
          full
            ? `${count} of ${PRO_PHOTOS} photos`
            : locked
              ? 'Add photo, Pro feature'
              : 'Add photo'
        }
        accessibilityState={{ disabled: full || busy, busy }}
        style={[
          styles.row,
          {
            minHeight: sizes.tapTarget + 8,
            paddingHorizontal: spacing.lg,
            gap: spacing.md,
            borderTopWidth: count > 1 ? sizes.hairline : 0,
            borderTopColor: colors.border,
          },
        ]}
        testID="receipt-add-photo"
      >
        <Icon name="image" size={22} color={colors.ink2} />
        <View style={{ flex: 1 }}>
          <AppText variant="body" style={{ fontFamily: fonts.medium }}>
            {full ? 'Photos' : 'Add photo'}
          </AppText>
          <AppText variant="caption">
            {full ? `${count} of ${PRO_PHOTOS} photos` : 'Product, serial number or manual'}
          </AppText>
        </View>
        {busy ? (
          <ActivityIndicator color={colors.ink2} />
        ) : locked ? (
          <View style={styles.center}>
            <ProLock />
          </View>
        ) : full ? null : (
          <Icon name="plus" size={20} color={colors.primary} />
        )}
      </Pressable>
      <Sheet visible={source} onClose={() => setSource(false)} title="Add photo">
        <View style={{ gap: spacing.sm }}>
          <Button
            label="Take photo"
            icon="scan"
            onPress={() => void add(camera)}
            testID="add-photo-camera"
          />
          <Button
            label="Choose from library"
            icon="image"
            variant="secondary"
            onPress={() => void add(library)}
            testID="add-photo-library"
          />
        </View>
      </Sheet>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { justifyContent: 'center' },
});
