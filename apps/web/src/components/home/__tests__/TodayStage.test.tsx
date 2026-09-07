// apps/web/src/components/home/__tests__/TodayStage.test.tsx
//
// `/hub` 무대 렌더 계약 — **`TodayPrescriptionCard.test.tsx` 에서 옮겨 온 락.**
//
// 그 카드는 `/hub` 재설계(v06.200)로 `TodayStage` 에 자리를 넘기고 importer 0 이 됐다.
// 컴포넌트는 지웠지만 **계약은 지우면 안 된다** — 특히 아래 둘은 화면이 조용히 거짓말할 수
// 있는 자리라, 락이 사라지면 다음 변경이 아무 저항 없이 통과한다.
//
//   ① 계산 실패를 화면이 **밝힌다** — 처방을 못 만들었는데 정상인 척하면, 학습자는
//      기본 안내를 자기 맞춤 분량으로 읽는다. 틀린 숫자보다 나쁜 것은 틀린 줄 모르는 것이다.
//   ② 잠긴 블록에 링크를 걸지 않는다 — 열리지도 않은 곳으로 보내는 것은 거짓 약속이다.
//
// 나머지(블록 순서·이름·완료 판정·href)는 `lib/learner/__tests__/today-blocks.test.ts` 가
// 데이터 쪽에서 잠근다. 여기는 **화면 표면**만 본다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { TodayPrescription } from '@/lib/learner/prescription-actions'
import type { ReadingRoom } from '@/lib/learner/reading-room-actions'

import { TodayStage } from '../TodayStage'

// 클라이언트 컴포넌트의 useRouter 는 라우터 컨텍스트 밖 renderToString 에서 throw — 스텁
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}))
vi.mock('@/lib/articles/start-learning', () => ({
  startArticleLearning: vi.fn(),
}))

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

const ROOM: ReadingRoom = {
  lead: {
    id: 'w1',
    word: 'resilient',
    meaning: '회복력 있는',
    example: 'She proved resilient after the setback.',
    pos: 'adj',
    cefr: 'B2',
    overdueDays: 3,
  },
  rest: [],
  overdueTotal: 1,
}

function render(p: TodayPrescription | null) {
  return renderToString(
    <TodayStage
      room={ROOM}
      prescription={p}
      time="morning"
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
    // 정상 상태와 **구별**되어야 한다 — 둘 다 같은 화면이면 밝히는 의미가 없다
    expect(ok).not.toContain('계산하지 못했어요')
  })

  it('잠긴 블록(구문 연습)은 링크가 아니다 — 열리지 않은 곳으로 보내지 않는다', () => {
    const locked = render({ ...BASE, practiceActive: false })
    expect(locked).not.toContain('/practice/dcp')

    const open = render({ ...BASE, practiceActive: true, practiceCount: 5 })
    expect(open).toContain('/practice/dcp')
  })

  it('처방이 없으면(수동계획 등) 흐름을 렌더하지 않는다 — 표면 이중화 금지', () => {
    const none = render(null)
    expect(none).not.toContain('/flashcard/play')
    expect(none).not.toContain('/scriptquiz')
    // 단어 지면은 처방과 무관하게 남는다
    expect(none).toContain('resilient')
  })
})
