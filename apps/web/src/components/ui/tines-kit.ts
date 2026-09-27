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

// ── 팝업(DD-68 · tines-mapping §28) ────────────────────────────────────────────
// 참조 팝업(3B 라이브러리 예제 모달) 실측 골격:
//   ① 배경막이 **밝다** — 뒤 화면을 어둡게 덮지 않고 지면 색으로 씻어 낸다. 그래서 패널은
//      그림자가 아니라 1px 라벤더 테두리로 떠 있는 것을 알린다(참조는 그림자를 거의 안 쓴다).
//   ② 머리: 빵부스러기 알약 → 큰 제목(크게·굵게) → 작성자 줄 → 윤곽선 태그 + 오른쪽 메타.
//   ③ 머리와 본문 사이 가로선 1px. 본문은 2열(왼쪽 틴트 패널 · 오른쪽 미리보기+설명).
//   ④ 오른쪽 위 원형 아이콘 버튼(바깥 열기 · 닫기), 패널 바깥 좌우에 원형 이전/다음.
const DLG_PAD = 'px-5 sm:px-8 lg:px-10'

export const DIALOG = {
  /** 배경막 — 지면 색으로 씻는다(어둡게 덮지 않는다). 모바일은 아래에서 올라오는 시트. */
  overlay:
    'fixed inset-0 z-[300] flex items-end justify-center overflow-y-auto overscroll-contain bg-[var(--dialog-backdrop,color-mix(in_srgb,var(--bg)_72%,transparent))] backdrop-blur-[var(--dialog-blur,6px)] p-0 sm:items-center sm:p-6',
  /** 패널 — 크림 · 1px 라벤더 · 24px · 떠 있는 그림자 */
  panel:
    'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[var(--r-2xl)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-float)] focus:outline-none sm:rounded-[var(--r-2xl)]',
  /** 머리 — 가로선으로 본문과 나뉜다 */
  header: `${DLG_PAD} border-b border-[var(--bd)] pb-5 pt-6 sm:pb-6 sm:pt-8`,
  /** 빵부스러기 — 첫 칸은 알약, 나머지는 글자 + › */
  crumbs:
    'flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-[13px] font-[600] text-[var(--t2)]',
  crumbPill:
    'inline-flex h-7 items-center rounded-full bg-[var(--tint-lavender)] px-3 font-display text-[12.5px] font-[700] text-[var(--tint-lavender-ink)]',
  /** 제목 — 참조는 팝업 제목을 페이지 제목만큼 크게 쓴다 */
  title:
    'font-display font-[700] leading-[1.06] tracking-[-0.02em] text-[var(--t1)] text-[length:var(--dialog-title-sm,26px)] sm:text-[length:var(--dialog-title-md,34px)] lg:text-[length:var(--dialog-title-lg,40px)] break-keep',
  /** 작성자·부제 줄 */
  byline: 'font-body text-[14px] leading-[1.5] text-[var(--t2)] break-keep',
  /** 윤곽선 태그 알약 — 면 색을 따르는 테두리 */
  tag: 'inline-flex min-h-[32px] items-center rounded-full border border-[var(--bd)] px-3.5 font-display text-[13px] font-[500] text-[var(--t1)]',
  /** 오른쪽 메타(「Works with」 자리) */
  meta: 'flex flex-wrap items-center gap-2 font-body text-[13px] text-[var(--t2)]',
  /** 본문 · 바닥 */
  body: `${DLG_PAD} flex-1 overflow-y-auto py-6 sm:py-8`,
  footer: `${DLG_PAD} flex items-center gap-3 border-t border-[var(--bd)] bg-[var(--bg)] py-4`,
  /** 원형 아이콘 버튼 — 1px 테두리 · 44px */
  iconBtn: `inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--bd)] bg-[var(--bg)] text-[var(--t1)] transition-colors duration-[var(--dur-quick)] hover:bg-[var(--p-light)] ${FOCUS}`,
  /** 패널 바깥 이전/다음 — 데스크톱에서만 */
  edgeBtn: `absolute top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--bd)] bg-[var(--bg)] text-[var(--t1)] shadow-[var(--sh-float)] transition-colors duration-[var(--dur-quick)] hover:bg-[var(--p-light)] lg:inline-flex ${FOCUS}`,
  /** 2열 본문 — 왼쪽이 넓다(참조 656:366 ≒ 1.8:1) */
  columns: 'grid gap-6 lg:grid-cols-[1.8fr_1fr] lg:gap-8',
  /** 구역 라벨 — 본문 안 작은 제목 */
  sectionLabel:
    'font-display text-[12px] font-[800] uppercase tracking-[0.07em] text-[var(--t2)]',
} as const

/** 틴트 패널 — 참조의 「Starting prompt」 칸. `.tone-*` 과 함께 쓰면 테두리·글자가 면 색을 따른다. */
export const TINT_PANEL = {
  root: 'overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)]',
  head: 'flex items-start justify-between gap-4 border-b border-[var(--bd)] px-5 py-4',
  title: 'font-display text-[16px] font-[800] leading-[1.25] text-[var(--t1)]',
  note: 'mt-0.5 font-body text-[13px] leading-[1.45] text-[var(--t2)]',
  body: 'px-5 py-5',
} as const

/** 층층 버튼 — 참조 「COPY PROMPT」. 크림 면 · 대문자 · 색이 어긋나 겹친 그림자. */
export const BTN_STACKED =
  `inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-[var(--t1)] bg-[var(--bg)] px-4 font-mono text-[12px] font-[700] uppercase tracking-[0.08em] text-[var(--t1)] shadow-[2px_2px_0_var(--tint-yellow),4px_4px_0_var(--tint-pink),6px_6px_0_var(--tint-lavender)] transition-[box-shadow,transform] duration-[var(--dur-quick)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_var(--tint-yellow),2px_2px_0_var(--tint-pink),3px_3px_0_var(--tint-lavender)] ${FOCUS}`
