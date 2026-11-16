import { getDownloadURL, ref } from '@react-native-firebase/storage';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Icon } from '@/components';
import { storage } from '@/lib/firebase';
import { useTheme } from '@/theme';

import { queuedPhoto } from './uploadQueue';

/** Download URLs already looked up this session, by Storage path. */
const urls = new Map<string, string>();

/** The photo's URI: the device copy while it waits to upload, else its download URL. */
function usePhotoUri(path: string | undefined, localUri: string | undefined): string | null {
  const [fetched, setFetched] = useState<{ path: string; uri: string } | null>(null);
  const local = localUri ?? (path ? queuedPhoto(path)?.localUri : undefined);
  const cached = path ? urls.get(path) : undefined;

  useEffect(() => {
    if (!path || local || cached) return;
    let live = true;
    getDownloadURL(ref(storage(), path))
      .then((uri) => {
        urls.set(path, uri);
        if (live) setFetched({ path, uri });
      })
      // Not uploaded yet, or offline: the placeholder stays.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [path, local, cached]);

  return local ?? cached ?? (fetched && fetched.path === path ? fetched.uri : null);
}

type Props = {
  /** Storage path of a saved photo. */
  path?: string;
  /** A photo still on the device (the scan being reviewed). */
  localUri?: string;
  width: number;
  height: number;
  testID?: string;
};

/** A receipt photo thumbnail, with a placeholder until it can be shown. */
export function ReceiptPhoto({ path, localUri, width, height, testID }: Props) {
  const { colors, radii, sizes } = useTheme();
  const uri = usePhotoUri(path, localUri);
  const box = {
    width,
    height,
    borderRadius: radii.input / 2,
    borderWidth: sizes.hairline,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  };
  if (!uri) {
    return (
      <View style={[styles.center, box]} testID={testID}>
        <Icon name="image" size={Math.min(22, width / 2)} color={colors.ink2} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={box}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
