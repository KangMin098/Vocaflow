// packages/design-tokens/src/shadow.ts
// 웹은 CSS 변수(--sh-*) 사용. RN 은 Platform.select 로 아래 값 분기.

export const shadowCss = {
  xs: '0 1px 2px rgba(0,0,0,.05)',
  sm: '0 1px 3px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.06)',
  md: '0 4px 6px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.06)',
  lg: '0 10px 15px rgba(0,0,0,.10), 0 4px 6px rgba(0,0,0,.05)',
  xl: '0 20px 25px rgba(0,0,0,.10), 0 10px 10px rgba(0,0,0,.04)',
} as const;

// RN — iOS shadowOffset / Android elevation
export const shadowNative = {
  xs: { ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 }, android: { elevation: 1 } },
  sm: { ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 3 }, android: { elevation: 2 } },
  md: { ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 }, android: { elevation: 3 } },
  lg: { ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 8 }, android: { elevation: 6 } },
  xl: { ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 16 }, android: { elevation: 12 } },
} as const;

export type ShadowKey = keyof typeof shadowCss;
