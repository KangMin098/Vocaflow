// apps/web/src/components/practice/__tests__/pre-evidence.test.tsx
// R0-PRE-EVIDENCE-01 — 제출 전 선택적 본문 짚기: 제목 · 주제만 opt-in, 후보는 지문만, 서버 payload 불변, 「이번 제출 당시」 표현.
// 클릭 · 실패 · 재시도 · 다음 문항 흐름은 PC 하네스(pc-t230)가 실제 컴포넌트로 잰다.
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { DcpItem } from '@/lib/learner/dcp'
import { PRE_EVIDENCE_TYPES, isPreEvidenceType, preEvidenceSentences } from '@/lib/learner/meaning-evidence'

const actions = vi.hoisted(() => ({ gradeDcpItem: vi.fn(), recordDcpErrorCause: vi.fn() }))
vi.mock('@/lib/learner/dcp-actions', () => actions)

import { DcpPlayer } from '../DcpPlayer'
import { PreEvidenceNote, preEvidenceFor } from '../PreEvidence'

const PASSAGE = 'The bakery opens early. People line up because the owner bakes by hand.'
const payload = { passage: PASSAGE, choices: ['Handmade Bread', 'Cold Mornings', 'City Traffic', 'Online Shops', 'Old Corners'], stemKo: '제목은?', underline: null, summarySentence: null }
const T: DcpItem = { id: 't', type: 'title', paragraphIdx: 0, payload }
const P: DcpItem = { id: 'p', type: 'topic', paragraphIdx: 0, payload }
const M: DcpItem = { id: 'm', type: 'main_point', paragraphIdx: 0, payload }
const BANNED = ['최초 판단', '근거 정답', '정답 보기 전', '독립 수행', '숙달']

describe('preEvidenceSentences — 제목 · 주제만 · 지문만', () => {
  it('title · topic 은 문장 후보, 그 밖 · 한 문장 · 빈 지문은 null', () => {
    expect(PRE_EVIDENCE_TYPES).toEqual(['title', 'topic'])
    expect(preEvidenceSentences('title', PASSAGE)).toEqual(['The bakery opens early.', 'People line up because the owner bakes by hand.'])
    expect(preEvidenceSentences('topic', PASSAGE)).toHaveLength(2)
    for (const t of ['main_point', 'summary', 'blank', 'order', null]) expect(isPreEvidenceType(t)).toBe(false)
    expect(preEvidenceSentences('main_point', PASSAGE)).toBeNull()
    expect(preEvidenceSentences('title', 'One sentence only.')).toBeNull()
    expect(preEvidenceSentences('title', null)).toBeNull()
  })
})

describe('DcpPlayer — opt-in 화면', () => {
  it('preEvidence 켬 + 제목 문항: 후보 목록 · 미선택 상태 문구 · 금지 표현 없음', () => {
    const html = renderToString(<DcpPlayer items={[T]} preEvidence />)
    expect(html).toContain('data-testid="pre-evidence"')
    expect(html).toContain('짚은 문장 없음')
    expect(html.match(/aria-pressed="false"/g)?.length).toBeGreaterThanOrEqual(2)
    for (const w of BANNED) expect(html).not.toContain(w)
  })
  it('주제 문항도 붙고, 요지(main_point) · 기본(꺼짐)은 예전 화면 그대로', () => {
    expect(renderToString(<DcpPlayer items={[P]} preEvidence />)).toContain('data-testid="pre-evidence"')
    expect(renderToString(<DcpPlayer items={[M]} preEvidence />)).not.toContain('data-testid="pre-evidence"')
    expect(renderToString(<DcpPlayer items={[T]} />)).not.toContain('data-testid="pre-evidence"')
  })
  it('후보를 만들 수 없는 지문이면 생략 · 제출 단추는 그대로', () => {
    const one: DcpItem = { ...T, payload: { ...payload, passage: 'Only one sentence here.' } }
    const html = renderToString(<DcpPlayer items={[one]} preEvidence />)
    expect(html).not.toContain('data-testid="pre-evidence"')
    expect(html).toContain('제출')
  })
})

describe('PreEvidenceNote · preEvidenceFor', () => {
  it('짚은 문장 · 짚지 않음을 사실대로 · 「이번 제출 당시」 로만', () => {
    const a = renderToString(<PreEvidenceNote sentence="The bakery opens early." />)
    expect(a).toContain('이번 제출 당시 짚은 문장')
    expect(a).toContain('The bakery opens early.')
    const b = renderToString(<PreEvidenceNote sentence={null} />)
    expect(b).toContain('본문 문장을 짚지 않았어요')
    for (const w of BANNED) { expect(a).not.toContain(w); expect(b).not.toContain(w) }
  })
  it('같은 문항 객체에만 — 같은 id 의 새 판본 객체 · 다른 문항 · 없음은 null', () => {
    const snap = { item: T, sentence: 'x' }
    expect(preEvidenceFor(snap, T)).toBe(snap)
    expect(preEvidenceFor(snap, { ...T })).toBeNull()
    expect(preEvidenceFor(snap, P)).toBeNull()
    expect(preEvidenceFor(null, T)).toBeNull()
  })
})
