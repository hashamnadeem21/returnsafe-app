/**
 * On-device text recognition for receipt photos: Apple Vision on iOS, Google ML Kit (bundled
 * Latin model) on Android. Returns every recognised line with its position in image pixels, so
 * the label and amount columns of a receipt can be put back on their rows.
 */
import { requireNativeModule } from 'expo-modules-core';

export type TextRect = { left: number; top: number; right: number; bottom: number };
export type RecognizedLine = { text: string; frame: TextRect };

type ReceiptTextNative = {
  recognizeText(fileUri: string): Promise<RecognizedLine[]>;
};

const native = requireNativeModule<ReceiptTextNative>('ReceiptText');

/** Lines of text in the image at this file URI (file:// or a plain path). */
export function recognizeText(fileUri: string): Promise<RecognizedLine[]> {
  return native.recognizeText(fileUri);
}
