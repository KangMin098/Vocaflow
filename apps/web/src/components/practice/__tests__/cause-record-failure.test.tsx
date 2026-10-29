// apps/web/src/components/practice/__tests__/cause-record-failure.test.tsx
// T-0247 — 오답 원인 기록 실패 판정(순수 함수)과 DcpPlayer 배선. DOM 의존성 없이 판정을 결속하고, 클릭 흐름은 PC 하네스(pc-t247r2)가 잰다.
import fs from 'node:fs'
import path from 'node:path'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { DcpErrorCause, DcpGradeOk, DcpItem } from '@/lib/learner/dcp'

const actions = vi.hoisted(() => ({ gradeDcpItem: vi.fn(), recordDcpErrorCause: vi.fn() }))
vi.mock('@/lib/learner/dcp-actions', () => actions)

import { DcpRevisitView, causeOutcome, shouldRecordCause, shouldShowCauseFailure, type SeenFeedback } from '../DcpPlayer'

describe('causeOutcome — {ok:true} 만 성공', () => {
  it('{ok:true} → ok · {ok:false} · 모양 틀림 · null → failed · reject → failed', async () => {
    expect(await causeOutcome(async () => ({ ok: true }))).toBe('ok')
    expect(await causeOutcome(async () => ({ ok: false }))).toBe('failed')
    expect(await causeOutcome(async () => ({ ok: 'yes' }))).toBe('failed')
    expect(await causeOutcome(async () => null)).toBe('failed')
    expect(await causeOutcome(async () => { throw new Error('network down') })).toBe('failed')
  })
  it('호출은 정확히 1회 — 실패해도 스스로 다시 보내지 않는다 · 같은 칩 재선택은 같은 인자로 1회 더', async () => {
    const rec = vi.fn<[string, DcpErrorCause], Promise<{ ok: boolean }>>(async () => ({ ok: false }))
    expect(await causeOutcome(() => rec('att-1', 'vocab'))).toBe('failed')
    expect(rec).toHaveBeenCalledTimes(1)
    rec.mockResolvedValueOnce({ ok: true })
    expect(await causeOutcome(() => rec('att-1', 'vocab'))).toBe('ok') // 학습자가 같은 칩을 다시 누른 것
    expect(rec).toHaveBeenCalledTimes(2)
    expect(rec.mock.calls[0]).toEqual(rec.mock.calls[1])
  })
})

describe('shouldShowCauseFailure — 늦은 응답은 문항 · attempt · 선택 · 마지막 호출이 모두 같을 때만', () => {
  const item = { id: 'a' }
  const base = { seq: 3, lastSeq: 3, item, curItem: item, attempt: 'att-1', curAttempt: 'att-1', choice: 'vocab' as DcpErrorCause, curChoice: 'vocab' as DcpErrorCause }
  it('모두 같으면 보인다', () => expect(shouldShowCauseFailure(base)).toBe(true))
  it('선택을 바꾼 뒤(현재 선택 다름 · 더 최근 호출 있음) 늦은 실패는 숨긴다', () => {
    expect(shouldShowCauseFailure({ ...base, curChoice: 'parsing' })).toBe(false)
    expect(shouldShowCauseFailure({ ...base, lastSeq: 4 })).toBe(false)
  })
  it('다음 문항 뒤(문항 객체 · attempt 다름 · 다음 문항이 호출을 무효화) 늦은 실패는 숨긴다', () => {
    expect(shouldShowCauseFailure({ ...base, curItem: { id: 'b' } })).toBe(false)
    expect(shouldShowCauseFailure({ ...base, curItem: { id: 'a' } })).toBe(false) // 같은 id 라도 다른 객체
    expect(shouldShowCauseFailure({ ...base, curAttempt: 'att-2' })).toBe(false)
    expect(shouldShowCauseFailure({ ...base, curAttempt: null, curChoice: null })).toBe(false)
  })
  it('attempt 없음은 보이지 않는다', () => expect(shouldShowCauseFailure({ ...base, attempt: null, curAttempt: null })).toBe(false))
})

describe('shouldRecordCause — attempt 있음 · 칩 켬 · 다시 보기 아님', () => {
  it('세 조건이 모두 맞을 때만 기록을 보낸다', () => {
    expect(shouldRecordCause({ attemptId: 'att-1', causeChips: true, reviewing: false })).toBe(true)
    expect(shouldRecordCause({ attemptId: null, causeChips: true, reviewing: false })).toBe(false)
    expect(shouldRecordCause({ attemptId: '', causeChips: true, reviewing: false })).toBe(false)
    expect(shouldRecordCause({ attemptId: undefined, causeChips: true, reviewing: false })).toBe(false)
    expect(shouldRecordCause({ attemptId: 'att-1', causeChips: false, reviewing: false })).toBe(false)
    expect(shouldRecordCause({ attemptId: 'att-1', causeChips: true, reviewing: true })).toBe(false)
  })
})

describe('완료 복기 — 원인 칩 · 실패 안내 · 기록 호출 0', () => {
  const A: DcpItem = { id: 'a', type: 'title', paragraphIdx: 0, payload: { passage: 'One. Two.', choices: ['a', 'b', 'c', 'd', 'e'], stemKo: '제목은?', underline: null, summarySentence: null } }
  const wrong: DcpGradeOk = { ok: true, correct: false, attemptId: 'att-1', answerKey: { answer: 1, explanation_ko: '해설' } }
  it('다시 보기에는 칩 · 안내가 없다', () => {
    const html = renderToString(<DcpRevisitView entry={{ item: A, result: wrong, submitted: { choice: 3 } } as SeenFeedback} items={[A]} onBack={() => {}} />)
    expect(html).not.toContain('어떤 점이 어려웠나요')
    expect(html).not.toContain('dcp-cause-failed')
    expect(actions.recordDcpErrorCause).not.toHaveBeenCalled()
  })
})

describe('DcpPlayer 배선 — 판정 함수를 실제로 쓴다', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../DcpPlayer.tsx'), 'utf8')
  const handler = src.slice(src.indexOf('async function handleCause('), src.indexOf('function handleNext('))
  it('handleCause 가 shouldRecordCause · causeOutcome · shouldShowCauseFailure 를 거친다', () => {
    expect(handler).toMatch(/shouldRecordCause\(\{ attemptId, causeChips, reviewing: false \}\)/)
    expect(handler).toMatch(/await causeOutcome\(\(\) => recordCause\(/)
    expect(handler).toMatch(/if \(shouldShowCauseFailure\(\{/)
    expect(handler).not.toMatch(/setTimeout|setInterval/) // 자동 재전송 없음
    expect(handler.match(/recordCause\(/g)).toHaveLength(1)
  })
  it('다음 문항은 안내를 지우고 진행 중 호출을 무효화한다 · 안내는 진행 중 피드백에만 넘긴다', () => {
    const next = src.slice(src.indexOf('function handleNext('), src.indexOf('// ── 완료 요약 ──'))
    expect(next).toContain('setCauseFailed(null)')
    expect(next).toContain('causeSeq.current++')
    expect(src).toMatch(/onCause=\{handleCause\} causeFailed=\{/)
    expect(src).toMatch(/onCause=\{\(\) => \{\}\} onNext=\{onBack\} isLast review/) // 복기는 기록 없음
  })
})
