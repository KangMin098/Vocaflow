// apps/web/src/lib/learner/wayfinder.ts
//
// 셸 최상단이 답해야 하는 **여섯 질문**의 순수 모델 — JSX 없음, 서버 코드 없음.
//
// ── 왜 다시 설계했나 (실측 2026-09-05, dev 1280×900, 계정 lexicon-test) ─────────────
// 학습자 라우트 9곳을 순회해 상단 띠를 재 봤다.
//
//   · 면적:   1040 × 69px = 71,760px² — 뷰포트의 6.2%를 **모든 화면에서** 쓴다
//   · 내용:   칩 1개(`새 단어 8`), 링크 1개
//   · 변화:   9개 라우트에서 텍스트가 **100% 동일**
//
// 즉 화면의 6%를 늘 차지하면서, 어느 화면에 서 있든 같은 숫자 하나만 말하고 있었다.
// 위치도, 단계도, 다음 걸음도, 왜 지금 해야 하는지도 없었다.
//
// 더 나쁜 것은 **반쯤 빈 상태**였다. 이전 띠의 규칙 ①은 "셋이 전부 0이면 숫자 대신
// 격려 문장 하나" 인데, 이 계정은 `fresh=8` 때문에 그 분기에 들어가지 못했다. 결과는
// 격려도 아니고 상태도 아닌 **고아 숫자 하나**. 가장 방향이 필요한 학습자(미진단)에게
// 가장 적게 말하고 있었다.
//
// ── 여섯 질문 ────────────────────────────────────────────────────────────────
//   Q1 나의 위치  — 지금 나는 어디에 서 있나            → `surface`
//   Q2 단계      — 오늘의 흐름 중 어디까지 왔나          → `steps`
//   Q3 방향      — 지금 누를 한 개는 무엇인가            → `now`
//   Q4 가치      — 이 학습이 나에게 무엇을 열어 주나      → `reach`
//   Q5 동기      — 왜 내일이 아니라 오늘인가             → `forecast`
//   Q6 성장      — 과거의 나보다 얼마나 왔나             → `past`
//
// 여섯을 **한 줄에 다 그리지 않는다**(철학 ② Progressive Disclosure · 학습원칙 ⑥
// 작업기억 ~4항목). 상시 층은 Q1·Q2·Q3 세 개만 그리고, Q4·Q5·Q6 은 학습자가 폈을 때
// 나온다. 그래서 모델은 여섯을 **전부 계산해 두되** 층을 나눠 노출한다.
//
// ⚠️ 이 파일에 `server-only` 를 넣지 말 것 — 클라이언트 컴포넌트가 이 계산을 import 하는
//    순간 모듈 그래프가 깨져 모든 라우트가 500 이 된다(`today-status.ts` 머리 주석 참조).

import { SURFACES, SURFACE_ORDER, type Surface, type SurfaceId } from '@/lib/framework/axes'

import type { MemoryForecast } from './memory-forecast'
import type { LevelReach } from './reach-math'
import type { TodayBlockKey } from './today-blocks'

/**
 * 학습자가 지금 어느 국면에 있는가 — **화면 분기의 유일한 기준.**
 *
 * 네 국면마다 "가장 값나가는 한 문장" 이 다르다. 이 값이 없으면 화면마다 자기 판정을
 * 만들게 되고, 그러면 같은 학습자가 화면마다 다른 대접을 받는다(이 저장소가 이미 겪은 계열).
 */
export type WayfinderPhase =
  /** 진단 전 — 레벨이 없어 처방도 사정권도 성립하지 않는다 */
  | 'undiagnosed'
  /** 진단됨, 오늘 아직 아무것도 안 함 */
  | 'ready'
  /** 오늘 일부 완료 */
  | 'moving'
  /** 오늘 할 것을 다 함 */
  | 'complete'

/**
 * 셸이 쓰는 블록의 **직렬화 가능한** 모양.
 *
 * `TodayBlock` 을 그대로 쓰지 않는 이유: 그 타입은 `icon: LucideIcon` 을 들고 있어
 * 서버 컴포넌트 → 클라이언트 컴포넌트 경계를 넘지 못한다(함수는 직렬화되지 않는다).
 * 구조적으로 부분집합이라 `TodayBlock[]` 을 그대로 넘길 수 있다.
 */
export interface WayfinderBlock {
  key: TodayBlockKey
  name: string
  headline: string
  href: string
  done: boolean
  locked: boolean
}

export interface WayfinderStep {
  key: TodayBlockKey
  name: string
  done: boolean
  /** 지금 눌러야 할 단계 — 하나만 true */
  current: boolean
  href: string
}

/** Q3 — 지금 누를 한 개. **셸에서 CTA 는 언제나 하나다.** */
export interface WayfinderNow {
  /** '지금' · '다음' · '먼저' — 문장이 아니라 시점 표지 */
  kicker: string
  /** 무엇을 왜 — 명사가 아니라 문장 */
  headline: string
  /** 버튼 라벨 */
  cta: string
  /**
   * 언제나 **바로 갈 수 있는 주소**다.
   *
   * 처방의 읽기 후보가 article 이면 URL 직결이 불가능하다(서버 액션이 `texts` 행을 만든
   * 뒤에야 `/text/[id]` 가 생긴다). 셸에서 그 액션을 부르지 않는다 — 띠를 누르는 것만으로
   * 학습자 데이터에 행이 생기면 안 된다. 그런 경우 `today-blocks.readHref` 가 이미
   * 서재(`/library/books`)를 주고, 거기서 학습자가 고른다.
   */
  href: string
}

/** Q6 — 과거의 나. 평가가 아니라 서술이다. */
export interface WayfinderPast {
  /** 최근 7일 중 학습한 날 */
  activeDays: number
  /** 그 앞 7일 중 학습한 날 — 비교 대상이 없으면 0 */
  prevActiveDays: number
  streak: number
}

export interface WayfinderModel {
  phase: WayfinderPhase
  /** Q1 — 지금 서 있는 표면. 어느 표면에도 안 속하면 null(그때는 위치를 말하지 않는다) */
  surface: Surface | null
  /** Q2 — 오늘의 흐름. 미진단이면 빈 배열(없는 계단을 그리지 않는다) */
  steps: WayfinderStep[]
  done: number
  total: number
  /** Q3 */
  now: WayfinderNow
  /** Q4 */
  reach: LevelReach
  /** Q5 */
  forecast: MemoryForecast
  /** Q6 */
  past: WayfinderPast
  /** 이전 띠가 그리던 두 수 — 예보 옆에서 뜻을 얻는다 */
  counts: { attention: number; fresh: number }
}

/**
 * 경로 → 표면. `SURFACES[].owns` 가 정본이다(목록을 여기서 다시 적지 않는다).
 *
 * 하위 경로까지 그 표면으로 본다 — `/library/books` 에서 Library 가 꺼져 있으면
 * 학습자는 자기가 어디 있는지 알 수 없다(WCAG 2.4.8 Location).
 */
export function surfaceForPath(pathname: string): Surface | null {
  const under = (p: string) => pathname === p || pathname.startsWith(`${p}/`)
  // 순서가 있는 배열로 훑는다 — 객체 키 순서에 의존하면 조용히 바뀐다.
  for (const id of SURFACE_ORDER) {
    const s = SURFACES[id as SurfaceId]
    if (under(s.href) || (s.owns ?? []).some(under)) return s
  }
  return null
}

/** 진단 전에 쓰는 한 걸음 — 레벨이 없으면 나머지 다섯 질문이 전부 비어 있다. */
function diagnosticStep(reach: LevelReach, fresh: number): WayfinderNow {
  // 카탈로그 수는 실측이다. "많은 책" 같은 형용사를 쓰지 않는다(§I5 상수·과장 금지).
  if (reach.total > 0) {
    return {
      kicker: '먼저',
      headline: `5분 진단이 끝나면 ${reach.total.toLocaleString('ko-KR')}권 중 지금 읽을 수 있는 책이 정해져요`,
      cta: '진단 시작',
      href: '/diagnostic',
    }
  }
  // 카탈로그를 못 읽었을 때도 막다른 화면을 만들지 않는다(D5).
  if (fresh > 0) {
    return {
      kicker: '먼저',
      headline: `아직 만나지 않은 단어 ${fresh}개가 담겨 있어요`,
      cta: '단어 보기',
      href: '/wordvault/browse?filter=state:new',
    }
  }
  return {
    kicker: '먼저',
    headline: '5분 진단으로 내 수준을 정하면 오늘 할 일이 생겨요',
    cta: '진단 시작',
    href: '/diagnostic',
  }
}

export interface WayfinderInput {
  /** 오늘의 5블록. 미진단·처방 실패면 빈 배열 */
  blocks: readonly WayfinderBlock[]
  isDiagnosed: boolean
  pathname: string
  reach: LevelReach
  forecast: MemoryForecast
  past: WayfinderPast
  counts: { attention: number; fresh: number }
}

export function buildWayfinder(input: WayfinderInput): WayfinderModel {
  const surface = surfaceForPath(input.pathname)
  const blocks = input.blocks
  const done = blocks.filter((b) => b.done).length
  const total = blocks.length

  // 지금 눌러야 할 단계 = 아직 안 했고 잠기지 않은 **첫** 블록.
  // 처방 순서가 곧 근거 순서다(복습 → 듣기 → 읽기 → 구문 → 확인) — 여기서 다시 정렬하지 않는다.
  const currentIdx = blocks.findIndex((b) => !b.done && !b.locked)

  const steps: WayfinderStep[] = blocks.map((b, i) => ({
    key: b.key,
    name: b.name,
    done: b.done,
    current: i === currentIdx,
    href: b.href,
  }))

  let phase: WayfinderPhase
  let now: WayfinderNow

  if (!input.isDiagnosed || total === 0) {
    phase = 'undiagnosed'
    now = diagnosticStep(input.reach, input.counts.fresh)
  } else if (currentIdx === -1) {
    phase = 'complete'
    now = {
      kicker: '오늘',
      // 폭죽도 트로피도 없다(철학 ③·모션 금지 목록). 문장 하나로 닫는다.
      headline: '오늘 할 것을 다 마쳤어요',
      cta: '지나온 길 보기',
      href: '/dashboard',
    }
  } else {
    const b = blocks[currentIdx]
    phase = done > 0 ? 'moving' : 'ready'
    now = {
      kicker: done > 0 ? '다음' : '지금',
      headline: b.headline,
      cta: `${b.name} 시작`,
      href: b.href,
    }
  }

  return {
    phase,
    surface,
    steps,
    done,
    total,
    now,
    reach: input.reach,
    forecast: input.forecast,
    past: input.past,
    counts: input.counts,
  }
}

/**
 * 예보 한 줄 — **얻는 쪽으로 말한다.**
 *
 * 같은 수를 "3개를 잃어요" 로도 "3개를 지킬 수 있어요" 로도 쓸 수 있다. 철학 ③
 * (Empathetic Feedback)이 후자를 고르게 한다. 곡선은 감쇠를 그대로 보여주므로
 * **사실이 숨겨지지는 않는다** — 문장만 학습자 편에 선다.
 *
 * @returns 그릴 것이 없으면 null (없는 것을 문장으로 지어내지 않는다)
 */
export function forecastSentence(f: MemoryForecast): string | null {
  if (f.tracked === 0) return null
  if (f.fadingSoon > 0) {
    return `이번 주에 복습하면 ${f.fadingSoon}개를 흐려지기 전에 붙잡아요`
  }
  if (f.fadedNow > 0) {
    return `지금 다시 만나면 ${f.fadedNow}개가 제자리로 돌아와요`
  }
  return `${f.tracked}개가 이번 주 내내 자리를 지켜요`
}

/**
 * 사정권 한 줄 — 레벨을 **카탈로그로 번역**한다.
 *
 * "V7 입니다" 는 약속이 아니다. 같은 값에 발행 카탈로그를 곱해야 약속이 된다.
 */
export function reachSentence(r: LevelReach): string | null {
  if (r.vLevel === null) {
    return r.total > 0 ? `진단하면 ${r.total.toLocaleString('ko-KR')}권 중 내 것이 골라져요` : null
  }
  if (r.open === 0) return null
  if (r.unlockNext > 0) {
    return `지금 ${r.open.toLocaleString('ko-KR')}권 · 한 계단 오르면 ${r.unlockNext.toLocaleString('ko-KR')}권이 더 열려요`
  }
  return `지금 ${r.open.toLocaleString('ko-KR')}권을 읽을 수 있어요`
}

/**
 * 과거의 나 한 줄.
 *
 * 줄어든 주에도 **비난하지 않는다**(철학 ③). 줄었으면 비교를 말하지 않고 사실만 적는다 —
 * "지난주보다 2일 적어요" 는 학습자가 이미 아는 것을 굳이 소리 내어 말하는 것이다.
 */
export function pastSentence(p: WayfinderPast): string | null {
  if (p.activeDays === 0 && p.prevActiveDays === 0) return null
  if (p.activeDays > p.prevActiveDays) {
    return p.prevActiveDays === 0
      ? `이번 주에 ${p.activeDays}일 만났어요`
      : `지난주보다 ${p.activeDays - p.prevActiveDays}일 더 만났어요`
  }
  return `이번 주에 ${p.activeDays}일 만났어요`
}
