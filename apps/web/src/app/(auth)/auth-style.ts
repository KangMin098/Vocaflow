// apps/web/src/app/(auth)/auth-style.ts
// 인증 폼(클라이언트)들이 같이 쓰는 모양 — 서버 전용 `AuthProof` 와 나눈다(클라이언트가 import 하면 서버 조회가 번들에 끌려온다).

/** 인증 폼들이 같이 쓰는 1차 버튼 — `SignupForm` 과 같은 주묵(그림자 상승 대신 눌리면 들어간다) */
export const AUTH_PRIMARY =
  'group relative flex h-12 w-full items-center justify-center gap-s-2 rounded-md bg-[var(--ju)] font-display text-sm font-semibold tracking-[-0.005em] text-[var(--on-ju)] transition-colors duration-normal hover:bg-[var(--ju-ink)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)] disabled:cursor-not-allowed disabled:opacity-60'

/** 인증 화면 제목 — `SignupForm` 과 같은 크기·서체(한국어 디스플레이, 왼쪽 정렬) */
export const AUTH_H1 =
  'mb-s-2 break-keep font-ko-display text-[26px] font-[600] leading-[1.25] tracking-[-0.01em] text-t1 sm:text-[30px]'
