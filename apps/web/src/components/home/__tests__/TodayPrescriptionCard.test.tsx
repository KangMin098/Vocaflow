// apps/web/src/components/home/__tests__/TodayPrescriptionCard.test.tsx
//
// hub "오늘" 처방 카드 렌더 검증 (META Opt A · Phase 1).
// 런타임 처방-분기는 "진단완료 + 오늘 수동계획 없음" 계정이 필요해 스모크로 직접 보기 어렵다 —
// prescribe_today 파싱 결과(TodayPrescription)를 픽스처로 renderToString 하여 5블록·런처·분기를 단언.
// (파서 계약은 DB 실측으로, 라우팅은 라우트 정찰로 이미 확인 — 본 테스트는 카드 렌더 표면.)

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { TodayPrescription } from '@/lib/learner/prescription-actions'

import { TodayPrescriptionCard } from '../TodayPrescriptionCard'

// PrescriptionArticleLaunch(클라이언트)의 useRouter 는 라우터 컨텍스트 밖 renderToString 에서 throw — 스텁
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}))
// 서버액션 import 는 렌더 시 호출 안 되지만 안전하게 스텁
vi.mock('@/lib/articles/start-learning', () => ({
  startArticleLearning: vi.fn(),
}))

const BASE: TodayPrescription = {
  isDiagnosed: true,
  stage: 'S1',
  stageNum: 1,
  totalMinutes: 60,
  dueCount: 0,
  input: { stageBand: 'S1', candidates: [] },
  practiceActive: false,
  practiceCount: 0,
  listeningTextId: null,
  unavailable: false,
}

describe('TodayPrescriptionCard', () => {
  it('5블록 제목 + 스테이지 배지 + 총 시간을 렌더한다', () => {
    const html = renderToString(<TodayPrescriptionCard data={BASE} />)
    expect(html).toContain('오늘의 맞춤 학습')
    expect(html).toContain('복습')
    expect(html).toContain('따라읽기')
    expect(html).toContain('읽기')
    expect(html).toContain('구문 연습')
    expect(html).toContain('점검')
    expect(html).toContain('S1')
    // React 는 텍스트+보간 사이에 주석 마커(<!-- -->)를 넣어 "약 60분"이 비연속 — 마커 허용 매칭
    expect(html).toMatch(/약[\s\S]*60[\s\S]*분/)
  })

  it('due 0 → 복습은 런처 대신 "완료" 상태칩(회귀: /flashcard/play 링크 없음)', () => {
    const html = renderToString(<TodayPrescriptionCard data={BASE} />)
    expect(html).toContain('완료')
    expect(html).not.toContain('/flashcard/play')
  })

  it('due > 0 → 복습이 /flashcard/play 런처', () => {
    const html = renderToString(<TodayPrescriptionCard data={{ ...BASE, dueCount: 5 }} />)
    expect(html).toContain('/flashcard/play')
    expect(html).toContain('5개')
  })

  it('listeningTextId 없으면 듣기는 /library/books, 있으면 /text/[id]/echo', () => {
    const noText = renderToString(<TodayPrescriptionCard data={BASE} />)
    expect(noText).toContain('href="/library/books"')

    const withText = renderToString(
      <TodayPrescriptionCard data={{ ...BASE, listeningTextId: 'text-abc' }} />,
    )
    expect(withText).toContain('/text/text-abc/echo')
  })

  it('book 후보는 /library/books/[id] 직결, article 후보는 client 런처(읽기 시작) 노출', () => {
    const html = renderToString(
      <TodayPrescriptionCard
        data={{
          ...BASE,
          input: {
            stageBand: 'S2',
            candidates: [
              { kind: 'book', id: 'book-1', title: '북 후보', vLevel: 6, register: 'narrative', cefrLevel: 'B1' },
              { kind: 'article', id: 'art-1', title: '글 후보', vLevel: 3, register: 'expository', cefrLevel: 'A2' },
            ],
          },
        }}
      />,
    )
    expect(html).toContain('/library/books/book-1')
    expect(html).toContain('북 후보')
    expect(html).toContain('글 후보')
    // article 런처 버튼 (aria-label "읽기 시작")
    expect(html).toContain('읽기 시작')
    // register 라벨 매핑
    expect(html).toContain('서사')
    expect(html).toContain('설명문')
  })

  it('practice active=false → 안내, active=true → /practice/dcp 런처 (회귀: Phase 2 실런처)', () => {
    const inactive = renderToString(<TodayPrescriptionCard data={BASE} />)
    expect(inactive).toContain('이 단계에서는 아직')
    expect(inactive).not.toContain('/practice/dcp')

    const active = renderToString(
      <TodayPrescriptionCard data={{ ...BASE, practiceActive: true, practiceCount: 3 }} />,
    )
    expect(active).toContain('/practice/dcp')
    expect(active).toContain('3개')
  })

  it('점검은 /scriptquiz 런처 + 계획 우선 안내(/plan)', () => {
    const html = renderToString(<TodayPrescriptionCard data={BASE} />)
    expect(html).toContain('/scriptquiz')
    expect(html).toContain('/plan')
    expect(html).toContain('직접 계획을 짜면')
  })

  // ── 침묵 회귀 방어 ────────────────────────────────────────────────
  //
  // 2026-07-19 에 csat_item_attempts 가 삭제되면서 derive_learner_stage →
  // prescribe_today 가 모든 학습자에게 실패했다. 그런데 폴백값(S1 · 0분 · due 0)이
  // **신규 학습자의 정상 상태와 똑같아서** 화면상 구별이 불가능했고, 3주 넘게
  // 아무도 몰랐다. 화면은 "오늘 할 게 없어요" 라고 말하고 있었다.
  //
  // 그래서 계약을 고정한다: 계산에 실패했으면 **실패했다고 말해야 한다.**
  it('계산 실패(unavailable) 면 폴백임을 화면이 밝힌다 — 정상 상태와 구별되어야 한다', () => {
    const ok = renderToString(<TodayPrescriptionCard data={BASE} />)
    const failed = renderToString(<TodayPrescriptionCard data={{ ...BASE, unavailable: true }} />)

    // 실패 시에만 고지가 뜬다
    expect(failed).toContain('계산하지 못했어요')
    expect(ok, '정상인데 실패 고지가 뜬다').not.toContain('계산하지 못했어요')

    // 두 화면이 실제로 달라야 한다 — 같으면 학습자가 구별할 수 없다
    expect(failed, 'unavailable 이 화면에 아무 차이도 만들지 않는다').not.toBe(ok)

    // Empathetic Feedback — 학습자를 탓하지 않고 무엇을 해도 되는지 말한다
    expect(failed).toContain('단어장')
    expect(failed).toMatch(/괜찮아요|해도/)
  })
})
