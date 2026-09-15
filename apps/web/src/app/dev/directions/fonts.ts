// apps/web/src/app/dev/directions/fonts.ts
//
// 시안 전용 폰트 선언 — **학습자 앱에는 아직 닿지 않는다.**
//
// 방향이 확정되기 전에 루트 레이아웃을 건드리면 되돌리기가 비싸진다. 그래서 3안 비교
// 화면에서만 한글 웹폰트를 켜고, 확정된 뒤에 `app/layout.tsx` 로 옮긴다.
//
// ⚠️ `preload: false` 는 취향이 아니라 필수다. Google Fonts 의 한글은 `unicode-range` 로
//    수백 조각으로 쪼개져 오고, `next/font` 의 preload 기본값(true)이면 그 조각을 전부
//    preload 한다(공개 사례: 281조각 2.32MB). 브라우저가 필요한 조각만 가져가게 둔다.
//
// ⚠️ `subsets` 를 주지 않는다. `next/font` 의 폰트 목록에 이 폰트들의 `korean` 서브셋이
//    등재돼 있지 않아서, 지정하면 오히려 라틴만 받아 온다. 미지정 + preload:false 조합이
//    Google 이 주는 전체 CSS(= 한글 unicode-range 포함)를 그대로 쓰는 경로다.

import { Hahmlet, IBM_Plex_Sans_KR } from 'next/font/google'

/** 한글 디스플레이 — 제목·단어 뜻·감성 문장. 한글과 라틴을 한 설계에서 뽑은 세리프. */
export const koDisplay = Hahmlet({
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-ko-display',
  display: 'swap',
  preload: false,
})

/** 한글 UI·본문 — 라벨·설명·버튼. 절제된 그로테스크, 숫자가 단단하다. */
export const koText = IBM_Plex_Sans_KR({
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-ko-text',
  display: 'swap',
  preload: false,
})
