import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { buildTheme, type ColorScheme, type Theme } from './tokens';

const ThemeContext = createContext<Theme>(buildTheme('light'));

type Props = {
  children: ReactNode;
  /** Force a scheme (tests, previews). Defaults to the system setting. */
  scheme?: ColorScheme;
};

export function ThemeProvider({ children, scheme }: Props) {
  const system = useColorScheme();
  const resolved: ColorScheme = scheme ?? (system === 'dark' ? 'dark' : 'light');
  const theme = useMemo(() => buildTheme(resolved), [resolved]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
