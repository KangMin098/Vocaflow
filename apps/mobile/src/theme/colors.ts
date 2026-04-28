// apps/mobile/src/theme/colors.ts
import { useColorScheme } from 'react-native';
import { colorsLight, colorsDark } from './tokens';

export function useTokens() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? colorsDark : colorsLight;
}
