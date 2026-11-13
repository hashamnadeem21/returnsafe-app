import { View } from 'react-native';

import { Banner } from '@/components';

/** Form-level error under the fields (Firebase errors that are not about one field). */
export function FormError({
  message,
  testID = 'auth-error',
}: {
  message: string | null;
  testID?: string;
}) {
  if (!message) return null;
  return (
    <View style={{ marginBottom: 12 }}>
      <Banner kind="warn" message={message} testID={testID} />
    </View>
  );
}
