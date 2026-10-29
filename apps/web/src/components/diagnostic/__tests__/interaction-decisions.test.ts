// apps/web/src/components/diagnostic/__tests__/interaction-decisions.test.ts
//
// 진단 상호작용 판정(DIAG-RESUME-BIND-01 r4) — DOM 없이 클릭 흐름의 결정을 순수 함수로 고정한다(리드 결정: DOM 의존성 추가 없음).
// 컴포넌트가 이 함수들을 실제로 쓰는지는 아래 배선 단언이 본다. 화면 흐름 자체는 같은 commit 의 하네스(pd-t239-r4)가 잰다.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { acceptFetch, canSubmit, ownerTag, planResume, questionSig, resumeNextIndex, type DiagQuestion, type ProgressRecord } from '../progress-store'

const Q = (id: string, i: number): DiagQuestion => ({ id, word: `w-${id}`, target_v_level: 3, target_track_level: null, display_order: i })
const QS = [Q('q1', 1), Q('q2', 2), Q('q3', 3), Q('q4', 4)]
const rec = (ids: string[]): ProgressRecord => ({ v: 2, owner: ownerTag('a'), testId: 't1', sig: questionSig(QS), responses: ids.map((id) => ({ question_id: id, knew: true })), savedAt: 0 })
const base = { ctxReq: 3, curReq: 3, ctxOwner: 'a', viewerId: 'a', authOk: true, complete: true, busy: false }

describe('재개 → 다음 문항', () => {
  it('끊김 없는 접두 q1,q2 → 다음 위치 2(q3)', () => {
    expect(resumeNextIndex(planResume(rec(['q1', 'q2']), 't1', QS))).toBe(2)
  })
  it('접두가 어긋나면 이어 가지 않는다(null)', () => {
    expect(resumeNextIndex(planResume(rec(['q2']), 't1', QS))).toBeNull()
    expect(resumeNextIndex(planResume(rec(['q1']), 't1', [Q('q0', 0), ...QS]))).toBeNull()
  })
})

describe('canSubmit — 제출 판정', () => {
  it('모두 맞으면 보낸다', () => {
    expect(canSubmit(base)).toBeNull()
  })
  it('owner 불일치 → owner(제출 0)', () => {
    expect(canSubmit({ ...base, viewerId: 'b' })).toBe('owner')
    expect(canSubmit({ ...base, ctxOwner: null })).toBe('owner')
  })
  it('인증 세대가 바뀜 → auth · 완답 아님 → incomplete', () => {
    expect(canSubmit({ ...base, authOk: false })).toBe('auth')
    expect(canSubmit({ ...base, complete: false })).toBe('incomplete')
  })
  it('재시작(요청 세대 증가) 뒤 이전 묶음 → stale(조용히 버림)', () => {
    expect(canSubmit({ ...base, curReq: 4 })).toBe('stale')
  })
  it('제출 1회 — 진행 중 두 번째 누름은 busy', () => {
    let busy = false
    const sends: number[] = []
    const press = () => { if (canSubmit({ ...base, busy }) === null) { busy = true; sends.push(1) } }
    press(); press(); press()
    expect(sends).toHaveLength(1)
  })
})

describe('acceptFetch — 늦은 조회 · 대체된 제출', () => {
  it('재시작 뒤 늦게 온 응답은 버린다', () => {
    let cur = 0
    const my = ++cur        // 첫 시작 · 재개
    cur++                   // 「처음부터 새로 풀기」 → 새 요청
    expect(acceptFetch(my, cur, true)).toBe(false)
    expect(acceptFetch(cur, cur, true)).toBe(true)
  })
  it('세대가 같아도 인증이 바뀌었으면 버린다', () => {
    expect(acceptFetch(1, 1, false)).toBe(false)
  })
})

describe('배선 — 컴포넌트가 이 판정을 쓴다', () => {
  const c = fs.readFileSync(path.join(__dirname, '../DiagnosticClient.tsx'), 'utf8')
  it('조회 수락은 acceptFetch, 재개 위치는 resumeNextIndex', () => {
    expect(c).toContain('const stillMine = (my: number, token: number) => acceptFetch(my, req.current, viewerId === null || guard.isCurrent(token))')
    expect(c).toContain('setCurrentIdx(resumeNextIndex(plan) ?? 0)')
  })
  it('제출은 canSubmit 를 먼저 거치고, 기다린 뒤마다 요청 세대를 다시 본다', () => {
    expect(c).toMatch(/const block = canSubmit\(\{\s+ctxReq: ctx\.req,\s+curReq: req\.current,/)
    expect(c).toContain("if (block === 'stale' || block === 'busy') return")
    expect(c).toContain('const replaced = () => !acceptFetch(ctx.req, req.current, true)')
    expect((c.match(/if \(replaced\(\)\) return\n/g) ?? []).length).toBe(2)
    expect(c).toContain('if (replaced()) return true')
  })
  it('제출 묶음은 만든 시점의 요청 세대를 싣는다 · 재시작은 확인 화면을 즉시 잠근다', () => {
    expect((c.match(/owner: viewerId, req: req\.current \}/g) ?? []).length).toBe(2)
    expect(c).toContain('setReviewLocked(true)\n                void startTest(selectedTest)')
    expect((c.match(/disabled=\{reviewLocked\}/g) ?? []).length).toBe(2)
  })
})
