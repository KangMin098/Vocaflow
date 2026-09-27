// apps/web/src/components/marketing/pill.ts
//
// 참조 사이트 「BOOK A DEMO」 알약(DD-68) — 14px 700 · 990px 모서리 · 누르는 자리 44px.
// 참조는 영문 대문자 모노지만 모노 대체 서체(Space Mono)에 한글이 없어 한글 라벨은 산세리프 굵게로 그린다 —
// 모노로 두면 공백만 모노 폭이 되어 낱말 사이가 벌어진다(실측 캡처 2026-09-21).
//
// ⚠️ 이 상수를 `'use client'` 파일에서 내보내지 않는다 — 서버 컴포넌트가 받으면 문자열이 아니라
//    클라이언트 참조 객체가 되어 class 에 `[object Object]` 가 박힌다(실측 2026-09-21, 랜딩 헤더 CTA).
export const PILL =
  'inline-flex min-h-[44px] items-center justify-center rounded-full px-5 font-display text-[14px] font-[700] tracking-[0.02em] transition-colors duration-[var(--dur-quick)] ease-[var(--ease-out-quint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] motion-reduce:transition-none'
