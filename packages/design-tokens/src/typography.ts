// packages/design-tokens/src/typography.ts
// 폰트 역할 매핑. 절대 사용 금지: Inter, Roboto, Arial.

export const fontFamily = {
  display: ['"Plus Jakarta Sans"', 'sans-serif'],
  body: ['"DM Sans"', 'sans-serif'],
  english: ['"Lora"', 'serif'],
  mono: ['"JetBrains Mono"', 'monospace'],
} as const;

// React Native 용 Expo Google Fonts 식별자
export const fontFamilyNative = {
  display: {
    regular: 'PlusJakartaSans_400Regular',
    semibold: 'PlusJakartaSans_600SemiBold',
    bold: 'PlusJakartaSans_700Bold',
    extrabold: 'PlusJakartaSans_800ExtraBold',
  },
  body: {
    regular: 'DMSans_400Regular',
    medium: 'DMSans_500Medium',
    semibold: 'DMSans_600SemiBold',
  },
  english: {
    regular: 'Lora_400Regular',
    semibold: 'Lora_600SemiBold',
    bold: 'Lora_700Bold',
  },
  mono: {
    regular: 'JetBrainsMono_400Regular',
    bold: 'JetBrainsMono_700Bold',
  },
} as const;

export const breakpoints = {
  mobile: 390,
  tablet: 768,
  desktop: 1280,
} as const;
