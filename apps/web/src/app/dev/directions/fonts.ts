// apps/web/src/app/dev/directions/fonts.ts
//
// 시안 전용 폰트 선언 — **학습자 앱에는 아직 닿지 않는다.**
//
// 방향이 확정되기 전에 루트 레이아웃을 건드리면 되돌리기가 비싸진다. 그래서 3안 비교
// 화면에서만 한글 웹폰트를 켜고, 확정된 뒤에 `app/layout.tsx` 로 옮긴다.
//
// ⚠️ **빌드 시점이 아니라 실행 시점에 불러온다(2026-10-14).** 예전에는 `next/font/google` 로
//    선언해, 빌드가 IBM Plex Sans KR · Hahmlet 의 한글 unicode-range 조각 수백 개를 내려받았다.
//    그 다운로드가 CI 러너에서 간헐적으로 실패해(`fonts.gstatic.com … failed` → `next/font` TypeError)
//    이 시안 화면 하나 때문에 제품 전체 `build` 필수 체크가 깨졌다(2026-10-14 PR #246 · #254 두 번).
//    같은 글꼴을 브라우저가 Google Fonts CSS 로 직접 받게 하면 빌드 의존이 없고, 화면 글꼴은 같다
//    (unicode-range 덕분에 필요한 조각만 받는다 — 예전 `preload:false` 와 같은 효과).

/** 브라우저가 받는 Google Fonts CSS — 두 글꼴 · 같은 굵기 · display=swap */
export const KO_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Hahmlet:wght@300;400;500;600;700&family=IBM+Plex+Sans+KR:wght@300;400;500;600;700&display=swap'

/** 페이지 루트 클래스 — 예전 `next/font` 객체의 `.variable` 과 같은 자리에서 CSS 변수를 정의한다 */
export const koDisplay = { variable: 'dev-ko-display' } as const
export const koText = { variable: 'dev-ko-text' } as const

/** 위 클래스가 정의하는 CSS 변수(대체 글꼴 포함 — 글꼴을 못 받아도 화면이 깨지지 않는다) */
export const KO_FONTS_CSS = `
.dev-ko-display { --font-ko-display: 'Hahmlet', 'Noto Serif KR', serif; }
.dev-ko-text { --font-ko-text: 'IBM Plex Sans KR', 'Pretendard', system-ui, sans-serif; }
`
