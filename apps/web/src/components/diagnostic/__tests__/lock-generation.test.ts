// apps/web/src/components/diagnostic/__tests__/lock-generation.test.ts
//
// T-0239 r7 재리뷰 회귀 — 진행 화면의 모든 잠금(제출 진행 중 · 확인 화면 · 새 시작 조회)은
// 「잠근 요청 세대 === 지금 req 세대」일 때만 성립한다(answerLocked). 재개를 받아들이면 그 응답이 메모리에도 결속된다.
// 판정은 순수 함수, 배선은 소스 단언. 화면 흐름 · 기준 재현은 하네스(pd-t239-r8 · pd-t239-r8base).
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { answerLocked, canSubmit, ownerTag, pickResumeSource, questionSig, type ProgressRecord } from '../progress-store'

const c = fs.readFileSync(path.join(__dirname, '../DiagnosticClient.tsx'), 'utf8')
const base = { ctxReq: 7, curReq: 7, ctxOwner: 'a', viewerId: 'a', authOk: true, complete: true }

describe('제출 진행 중(busy)은 같은 세대 안에서만', () => {
  it('이전 세대(5) 제출이 대기 중이어도 새 세대(7) 완답 제출은 막히지 않는다', () => {
    expect(canSubmit({ ...base, busy: answerLocked(5, 7) })).toBeNull()
  })
  it('같은 세대 연타는 1회만 — 진행 중(7)이면 busy', () => {
    let inflight: number | null = null
    let sent = 0
    for (let i = 0; i < 3; i++) {
      if (canSubmit({ ...base, busy: answerLocked(inflight, 7) }) === null) { inflight = 7; sent++ }
    }
    expect(sent).toBe(1)
  })
  it('배선 — busy 는 answerLocked(submittingReq.current, req.current), 끝날 때 그 세대일 때만 해제', () => {
    expect(c).toContain('busy: answerLocked(submittingReq.current, req.current),')
    expect(c).toContain('submittingReq.current = ctx.req')
    expect(c).toContain('const mine = answerLocked(submittingReq.current, ctx.req)')
    expect(c).toContain('if (mine) submittingReq.current = null')
    expect(c).not.toMatch(/const submitting = useRef\(false\)/)
  })
})

describe('확인 화면 잠금도 세대 파생', () => {
  it('최신 시작 요청이 끝나거나 대체되면 풀린다 — 별도 상태 없이 startLocked 와 같다', () => {
    expect(answerLocked(9, 9)).toBe(true)
    expect(answerLocked(9, 10)).toBe(false)
    expect(c).toContain('const reviewLocked = startLocked')
    expect(c).not.toContain('setReviewLocked')
  })
})

describe('재개를 받아들이면 메모리에 결속', () => {
  const Q = (id: string, i: number) => ({ id, word: 'w' + id, target_v_level: 3, target_track_level: null, display_order: i })
  const QS = [Q('q1', 1), Q('q2', 2), Q('q3', 3)]
  it('저장소가 나중에 읽히지 않아도 방금 받아들인 응답으로 다시 이어 갈 수 있다', () => {
    const A = ownerTag('a')
    const mem: ProgressRecord = { v: 2, owner: A, testId: 't1', sig: questionSig(QS), responses: [{ question_id: 'q1', knew: true }, { question_id: 'q2', knew: false }], savedAt: 0 }
    expect(pickResumeSource(mem, null, A)?.responses.length).toBe(2)
  })
  it('배선 — 재개 수락 시 owner · test.id · questionSig(data) · 응답 복사본', () => {
    expect(c).toMatch(/setResponses\(plan\.responses\)\n\s+memProgress\.current = \{ v: 2, owner, testId: test\.id, sig: questionSig\(data\), responses: plan\.responses\.map\(\(x\) => \(\{ \.\.\.x \}\)\), savedAt: progress\.savedAt \}/)
  })
})
