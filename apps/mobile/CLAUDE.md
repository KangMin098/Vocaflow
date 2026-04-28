# apps/mobile — 앱 전용 가이드

루트 `CLAUDE.md` 가 SSoT. 본 문서는 RN/Expo 한정 보충만 기록.

## 핵심 원칙

- 토큰은 `@vocaflow/design-tokens` 의 JS 객체(`colorsLight` / `colorsDark`) 를 사용. CSS Variables 사용 금지.
- 다크모드: `src/theme/ThemeProvider.tsx` + `useTokens()` 훅으로 분기.
- 모든 Pressable: `minHeight: 44, minWidth: 44` + `accessibilityLabel` 필수.
- 폰트: `@expo-google-fonts/*` 로딩 — `tokens` 의 `fontFamilyNative` 식별자 사용.
- 그림자: `shadowNative` 토큰 + `Platform.select` 분기.

## 폴더 구조

`src/` 하위는 웹(`apps/web/src/`) 과 동일한 도메인 구조. 신규 컴포넌트 추가 시 양쪽에 동시에 만들거나, RN 미지원이면 웹 전용 주석 필수.
