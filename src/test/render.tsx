import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, type ColorScheme } from '@/theme';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

export function renderWithTheme(
  ui: ReactElement,
  scheme: ColorScheme = 'light',
  options?: RenderOptions,
) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider scheme={scheme}>{ui}</ThemeProvider>
    </SafeAreaProvider>,
    options,
  );
}
