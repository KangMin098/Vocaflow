// apps/web/src/components/practice/__tests__/DcpRevisit.test.tsx
// 완료 뒤 「이미 본 해설 다시 보기 · 안내 복습」 — 당시 선택 · 당시 서버 결과 그대로, 원인 칩 없음, 새 채점 · 기록 없음.
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { DcpItem, DcpGradeOk } from '@/lib/learner/dcp'

const actions = vi.hoisted(() => ({ gradeDcpItem: vi.fn(), recordDcpErrorCause: vi.fn() }))
vi.mock('@/lib/learner/dcp-actions', () => actions)

import { DcpRevisitView, revisitable, type SeenFeedback } from '../DcpPlayer'

const PASSAGE = 'The bakery opens early. People line up because the owner bakes by hand.'
const A: DcpItem = { id: 'a', type: 'title', paragraphIdx: 0, payload: { passage: PASSAGE, choices: ['Handmade Bread', 'Cold Mornings', 'City Traffic', 'Online Shops', 'Old Corners'], stemKo: '제목은?', underline: null, summarySentence: null } }
const B: DcpItem = { id: 'b', type: 'topic', paragraphIdx: 0, payload: { passage: PASSAGE, choices: ['bread', 'weather', 'hours', 'cakes', 'traffic'], stemKo: '주제는?', underline: null, summarySentence: null } }
const wrong: DcpGradeOk = { ok: true, correct: false, attemptId: 'att-1', answerKey: { answer: 1, explanation_ko: '손으로 굽는 빵 이야기가 글 전체에 이어진다.' } }
const right: DcpGradeOk = { ok: true, correct: true, attemptId: 'att-2', answerKey: null }
const seen: SeenFeedback[] = [
  { item: A, result: wrong, submitted: { choice: 3 } },
  { item: B, result: right, submitted: { choice: 1 } },
]

describe('revisitable — 현재 문항에 묶인 기록만', () => {
  it('같은 문항 객체만 남는다 · 자료가 바뀌면 비고 · 비어 있으면 비어 있다', () => {
    expect(revisitable(seen, [A, B])).toHaveLength(2)
    expect(revisitable(seen, [{ ...A }, { ...B }])).toHaveLength(0) // 같은 id 라도 새 자료 객체면 옛 피드백을 보이지 않는다
    expect(revisitable([], [A, B])).toHaveLength(0)
    expect(revisitable(seen, [])).toHaveLength(0)
  })
})

describe('DcpRevisitView — 틀린 문항 다시 보기', () => {
  const html = renderToString(<DcpRevisitView entry={seen[0]!} items={[A, B]} onBack={() => {}} />)
  it('안내 복습 표지 · 당시 선택 · 정답 · 해설 · 근거 짚기가 보인다', () => {
    expect(html).toContain('이미 본 해설 다시 보기 · 안내 복습')
    expect(html).toContain('City Traffic') // 당시 고른 3번
    expect(html).toContain('Handmade Bread') // 공개된 정답
    expect(html).toContain('손으로 굽는 빵 이야기가 글 전체에 이어진다.')
    expect(html).toContain('The bakery opens early.') // MeaningEvidence 문장
  })
  it('원인 기록 칩이 없고 「요약으로」 하나 — 44px · focus-visible', () => {
    expect(html).not.toContain('어떤 점이 어려웠나요')
    for (const l of ['단어를 몰랐어요', '문장 해석이 어려웠어요', '시간이 부족했어요']) expect(html).not.toContain(l)
    expect(html).toMatch(/<button[^>]*min-h-\[44px\][^>]*focus-visible:ring-2[^>]*>요약으로/)
    expect(html).toMatch(/<h2[^>]*tabindex="-1"/)
  })
  it('렌더해도 채점 · 원인 기록을 부르지 않는다', () => {
    expect(actions.gradeDcpItem).not.toHaveBeenCalled()
    expect(actions.recordDcpErrorCause).not.toHaveBeenCalled()
  })
  it('맞힌 문항도 같은 표지(해설이 없으면 정답 공개 없이)', () => {
    const h = renderToString(<DcpRevisitView entry={seen[1]!} items={[A, B]} onBack={() => {}} />)
    expect(h).toContain('2<!-- -->번 문항')
    expect(h).toContain('정확해요')
  })
})

describe('opt-in 경계 — 세션 경계를 확인한 호출자만 켠다', () => {
  it('기록은 revisit 일 때만 모으고, 켜는 곳은 기사 · 교재 연습 다리(계정 경계)와 합성 dev 뿐', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const src = (p: string) => fs.readFileSync(path.resolve(__dirname, p), 'utf8')
    expect(src('../DcpPlayer.tsx')).toMatch(/if \(revisit\) setSeen\(/)
    expect(src('../DcpPlayer.tsx')).toContain('revisit = false')
    // R0-REVISIT-READ-01 — 키가 기사 · 본인 글 · 계정 · 본문 결속으로 넓어졌다(articlePlayerKey)
    expect(src('../ArticlePracticeBridge.tsx')).toMatch(/<DcpPlayer\s+key=\{articlePlayerKey\(articleId, textId, ownerId, nextReading\.gen, nextItems\.gen\)\}\s+revisit/)
    // 교재: 범위 컴포넌트는 기본 끔 · 넘겨받을 때만, 넘기는 곳은 status === 'same' 확인 뒤의 계정 경계뿐
    expect(src('../TextbookPracticeScope.tsx')).toContain('revisit = false')
    expect(src('../TextbookPracticeBridge.tsx')).toMatch(/if \(status !== 'same'\) \{[\s\S]*<TextbookPracticeScope[\s\S]*revisit\s*\/>/)
    for (const p of ['../../../app/(main)/practice/dcp/session/page.tsx', '../../../app/(main)/library/textbooks/[series]/[step]/practice/page.tsx', '../../csat/factory/FactoryDcpRunner.tsx']) {
      expect(src(p)).not.toMatch(/<DcpPlayer[^>]*revisit/)
    }
  })
})
