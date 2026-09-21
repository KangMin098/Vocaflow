// apps/web/src/components/ui/tines-kit.ts
//
// 참조 UI 부품 클래스(DD-68 · tines-mapping §14 · refs/tines/ui-kit-summary.md — 80개 템플릿 대표 페이지 실측).
// 버튼 · 칩 · 입력 · 카드 · 분절을 **한 곳**에서 글자 그대로 적는다(Tailwind 는 조립한 이름을 만들지 않는다).
// 색은 토큰이라 스킨을 끄면 기존 팔레트로 돌아간다. 면 안에서 쓰면 `.tone-*` 가 글자색을 그 면 색상으로 바꾼다.
//
// ⚠️ 'use client' 파일에서 내보내지 않는다 — 서버 컴포넌트가 받으면 문자열이 아니라 참조 객체가 된다(pill.ts 와 같은 이유).

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]'
const BTN_BASE = `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 font-display text-[14px] font-[700] tracking-[0.02em] no-underline transition-colors duration-[var(--dur-quick)] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`

export const BTN = {
  /** 1차 — 참조 #542f9c · 크림 글자 · 호버 #6741bf (69/80 페이지) */
  primary: `${BTN_BASE} bg-[var(--p)] text-[var(--on-p)] hover:bg-[var(--ju)]`,
  /** 2차 — 크림 바탕 · 보라 테두리 · 호버 #d1c7ff */
  secondary: `${BTN_BASE} border border-[var(--p)] bg-[var(--bg)] text-[var(--p)] hover:bg-[var(--p-light)]`,
  /** 연한 — 라벤더 · #6741bf 글자 · 호버 #ded8ff (33/80) */
  soft: `${BTN_BASE} bg-[var(--tint-lavender)] text-[var(--ju)] hover:bg-[color-mix(in_srgb,var(--ju)_12%,var(--tint-lavender))]`,
  /** 진한 면 위 — 크림 채움 + 면 색 글자(면이 --on-ju 를 준다) */
  onDeep: `${BTN_BASE} bg-[var(--on-deep)] text-[var(--on-ju)] hover:opacity-90`,
  /** 글자만 — 화살표 링크 */
  text: `inline-flex min-h-[44px] items-center gap-1.5 font-display text-[14px] font-[700] text-[var(--ju)] no-underline hover:underline ${FOCUS}`,
} as const

export const CHIP = {
  /** 라벤더 알약 — 24px · 14/600 */
  soft: 'inline-flex h-6 items-center rounded-full bg-[var(--tint-lavender)] px-2.5 font-display text-[13px] font-[600] text-[var(--ju)]',
  /** 모노 대문자 눈썹 칩 — 28px · 12/700 */
  mono: 'inline-flex h-7 items-center rounded-full bg-[var(--tint-lavender)] px-3 font-mono text-[12px] font-[700] uppercase tracking-[0.04em] text-[var(--ju)]',
  /** 진한 칩 — 면 안에서 쓰면 면 색상의 짙은 바탕 + 옅은 글자 */
  deep: 'inline-flex h-[26px] items-center rounded-full bg-[var(--t1)] px-3 font-mono text-[12px] font-[700] uppercase tracking-[0.04em] text-[var(--bg)]',
} as const

export const INPUT = {
  /** 참조 입력 — 투명 · 1px #d7c4fa · 6px · 46px · 16/400 */
  field: `h-[46px] w-full rounded-[6px] border border-[var(--bd-input)] bg-transparent px-3.5 font-body text-[16px] text-[var(--t1)] placeholder:text-[var(--t2)] focus:border-[var(--ju)] focus:outline-none ${FOCUS}`,
  /** 검색 알약 — 라벤더 · 1px #d1c7ff · 990px · 41px */
  search: `h-[42px] w-full rounded-full border border-[var(--bd)] bg-[var(--tint-lavender)] px-4 font-body text-[14px] font-[500] text-[var(--t1)] placeholder:text-[var(--t2)] focus:outline-none ${FOCUS}`,
} as const

export const CARD = {
  /** 크림 + 강한 보라 테두리 12px (18페이지) */
  line: 'rounded-[12px] border border-[var(--bd-strong)] bg-[var(--bg)]',
  /** 웜그레이 10px, 테두리 없음 */
  warm: 'rounded-[10px] bg-[#f3efea] dark:bg-[var(--bg2)]',
  /** 라벤더 + 옅은 테두리 14px */
  lavender: 'rounded-[14px] border border-[var(--bd)] bg-[var(--tint-lavender)]',
  /** 숯 14px — 코드 · 영상 · 제품 화면 */
  charcoal: 'rounded-[14px] bg-[var(--deep-charcoal)] text-[var(--on-deep)]',
} as const

/** 분절 — 반투명 트랙 + 켠 칸 크림 (참조 aria-pressed 10.5px · 45px) */
export const SEG = {
  track: 'inline-flex items-center gap-1 rounded-[14px] bg-[color-mix(in_srgb,var(--ju)_14%,transparent)] p-1',
  item: `inline-flex min-h-[44px] items-center justify-center rounded-[10.5px] px-4 font-display text-[14px] font-[600] text-[var(--t1)] transition-colors ${FOCUS}`,
  on: 'bg-[var(--bg)] text-[var(--ju)]',
} as const
