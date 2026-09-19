// apps/web/src/components/home/__tests__/TodayStage.test.tsx
//
// `/hub` 무대 렌더 계약.
//
// ── 옮겨 온 락(v06.200, `TodayPrescriptionCard.test.tsx` 에서) ──
//   ① 계산 실패를 화면이 **밝힌다** — 처방을 못 만들었는데 정상인 척하면, 학습자는
//      기본 안내를 자기 맞춤 분량으로 읽는다.
//   ② 잠긴 블록에 링크를 걸지 않는다 — 열리지도 않은 곳으로 보내는 것은 거짓 약속이다.
//   ③ 처방이 없으면(수동 계획이 정본) 흐름을 그리지 않는다 — 표면 이중화 금지.
//
// ── 2026-09-19 「들어 올리는 곡선」(docs/design/compare/hub.md · DD-22) ──
//   ④ 어느 상태든 h1 이 있다(감사: 미진단 경로에 h1 이 없었다).
//   ⑤ 곡선의 문장·낱말·세션 링크가 **같은 N** 을 말한다 — 앞 N개에 권점, 링크는 limit=N.
//   ⑥ 미진단의 1차 행동은 진단(D7) — 곡선은 진단과 무관하게 선다.
//   ⑦ 오류를 빈 상태로 삼키지 않는다 · 모은 낱말 0 이면 곡선을 지어내지 않고 다음 한 걸음(D5).
//
// 블록 순서·완료 판정은 `lib/learner/__tests__/today-blocks.test.ts`, 곡선 계산은
// `lib/learner/__tests__/memory-lift.test.ts` 가 데이터 쪽에서 잠근다. 여기는 **화면 표면**만 본다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { HubLiftResult } from '@/lib/learner/hub-lift-query'
import type { TodayPrescription } from '@/lib/learner/prescription-actions'

import { TodayStage } from '../TodayStage'

// 클라이언트 컴포넌트의 useRouter 는 라우터 컨텍스트 밖 renderToString 에서 throw — 스텁
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}))
vi.mock('@/lib/articles/start-learning', () => ({
  startArticleLearning: vi.fn(),
}))
vi.mock('@/lib/analytics/client', () => ({ track: vi.fn() }))

const BASE: TodayPrescription = {
  isDiagnosed: true,
  vLevel: 5,
  stage: 'S1',
  stageNum: 1,
  totalMinutes: 60,
  dueCount: 3,
  input: { stageBand: 'S1', candidates: [] },
  practiceActive: false,
  practiceCount: 0,
  listeningTextId: null,
  unavailable: false,
}

// 실측 계정 모양 — 전부 흐려진 낱말. 그대로 두면 R≈0, 다시 보면 1 에서 천천히 내려간다.
const ZERO = [0, 0, 0, 0, 0, 0, 0, 0]
const AFTER = [1, 0.95, 0.9, 0.86, 0.82, 0.78, 0.74, 0.7]
const LIFT: Extract<HubLiftResult, { kind: 'ok' }> = {
  kind: 'ok',
  lift: {
    horizonDays: 7,
    words: Array.from({ length: 12 }, (_, i) => ({
      id: `w${i}`,
      word: `word${i}`,
      state: 'risk' as const,
      before: ZERO,
      after: AFTER,
    })),
  },
}

function render(
  p: TodayPrescription | null,
  opts: { lift?: HubLiftResult | null; isDiagnosed?: boolean; tasteWord?: boolean } = {},
) {
  return renderToString(
    <TodayStage
      lift={opts.lift === undefined ? LIFT : opts.lift}
      tasteWord={
        opts.tasteWord
          ? { word: 'sleeve', meaningKo: '소매', exampleEn: 'He rolled up his sleeve.', cefr: 'B1', rank: 4401 }
          : null
      }
      isDiagnosed={opts.isDiagnosed ?? true}
      prescription={p}
      time="morning"
      weekday={6}
      touchedToday={[]}
      dcpDoneToday={false}
    />,
  )
}

describe('TodayStage — 옮겨 온 계약', () => {
  it('계산 실패(unavailable)면 폴백임을 화면이 밝힌다', () => {
    const ok = render(BASE)
    const failed = render({ ...BASE, unavailable: true })

    expect(failed).toContain('계산하지 못했어요')
    expect(ok).not.toContain('계산하지 못했어요')
  })

  it('잠긴 블록(구문 연습)은 링크가 아니다 — 열리지 않은 곳으로 보내지 않는다', () => {
    const locked = render({ ...BASE, practiceActive: false })
    expect(locked).not.toContain('/practice/dcp')

    const open = render({ ...BASE, practiceActive: true, practiceCount: 5 })
    expect(open).toContain('/practice/dcp')
  })

  it('처방이 없으면(수동계획 등) 흐름을 렌더하지 않고, 곡선의 행동은 2차로만 둔다', () => {
    const none = render(null)
    expect(none).not.toContain('data-today-flow')
    expect(none).not.toContain('/scriptquiz')
    // 곡선과 낱말은 처방과 무관하게 남는다
    expect(none).toContain('word0')
    // 1차(주묵 채움) 행동은 TodayPlanCard 쪽이다 — 여기엔 주묵 채움 버튼이 없다
    expect(none).not.toContain('background:var(--ju)')
  })
})

describe('TodayStage — 들어 올리는 곡선', () => {
  it('h1 이 문장·낱말·세션 링크와 같은 N 을 말한다 (기본 N = 10)', () => {
    const html = render(BASE)
    // 기대값 10 × 0.7 = 7 — 「약」 을 붙인 정수
    expect(html).toMatch(/<h1[^>]*>오늘 10개를 다시 보면, 다음 주 토요일에도 약 7개가 기억에 남아요\.<\/h1>/)
    expect(html).toContain('/flashcard/play?limit=10&amp;from=%2Fhub')
    // 앞 10개에만 권점
    expect(html.match(/data-on="true"/g)).toHaveLength(10)
    expect(html.match(/data-on="false"/g)).toHaveLength(2)
    expect(html).toContain('그대로 두면 약 <!-- -->0<!-- -->개')
  })

  it('지금 블록이 복습이 아니면 「시작」 은 그 블록 하나뿐 — 곡선의 링크는 「먼저 다시 보기」 (단일 CTA)', () => {
    // dueCount 0 → 복습 블록 완료 → 지금 블록은 다음 것
    const html = render({ ...BASE, dueCount: 0 })
    expect(html.match(/>지금 시작</g)).toHaveLength(1)
    expect(html).not.toContain('부터 시작')
    expect(html).toContain('이 10개 먼저 다시 보기')
  })

  it('미진단이면 1차 행동은 진단이고, 곡선의 세션은 2차로 남는다 (D7)', () => {
    const html = render(null, { isDiagnosed: false })
    expect(html).toContain('/diagnostic')
    expect(html).toContain('5분 진단으로 내 수준 찾기')
    expect(html).toContain('/flashcard/play?limit=10')
  })

  it('처음 만나는 낱말만 고르면 「익히면」 으로 말한다', () => {
    const fresh: HubLiftResult = {
      kind: 'ok',
      lift: {
        ...LIFT.lift,
        words: LIFT.lift.words.slice(0, 3).map((w) => ({ ...w, state: 'new' as const })),
      },
    }
    const html = render(null, { lift: fresh, isDiagnosed: false })
    expect(html).toContain('오늘 3개를 익히면')
    expect(html).toContain('오늘 익힐 단어')
    // 범위를 밝힌다 — 곡선은 전체 단어장이 아니라 아래 낱말들 기준이다
    expect(html).toContain('아래 <!-- -->3<!-- -->개 기준')
  })

  it('오류는 빈 상태와 다르게 말한다 — 삼키지 않는다', () => {
    const err = render(BASE, { lift: { kind: 'error' } })
    const empty = render(BASE, { lift: { kind: 'empty' } })
    expect(err).toMatch(/<h1[^>]*>기억 곡선을 불러오지 못했어요<\/h1>/)
    expect(empty).toMatch(/<h1[^>]*>아직 모아 둔 단어가 없어요<\/h1>/)
    expect(err).not.toContain('모아 둔 단어가 없어요')
  })

  it('모은 낱말 0 — 곡선을 지어내지 않고 다음 한 걸음을 둔다 (D5)', () => {
    const html = render(null, { lift: { kind: 'empty' }, isDiagnosed: false, tasteWord: true })
    expect(html).not.toContain('role="img"')
    expect(html).toContain('/diagnostic')
    expect(html).toContain('/library')
    expect(html).toContain('sleeve')
  })

  it('비로그인(null)이면 무대를 그리지 않는다', () => {
    expect(render(BASE, { lift: null })).toBe('')
  })
})
