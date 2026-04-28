// apps/mobile/src/theme/ThemeProvider.tsx
import { ReactNode, createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { colorsLight, colorsDark, type Colors } from '@vocaflow/design-tokens';

const ThemeContext = createContext<Colors>(colorsLight);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const value = scheme === 'dark' ? colorsDark : colorsLight;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
