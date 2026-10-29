// apps/web/src/components/diagnostic/__tests__/finally-modal.test.ts
//
// T-0239 r8 재리뷰 회귀 — (1) 이전 제출의 늦은 finally 는 화면의 제출 세대가 아직 자기일 때만 busy · phase 를 정리한다
// (2) 레벨 안내 모달의 「내 레벨」은 개인 진행이 보이는 동안만, 인증이 확인 중 · 바뀜이면 모달을 닫는다.
// 판정은 answerLocked(세대 규칙) 재사용, 배선은 소스 단언. 화면 흐름 · 기준 재현은 하네스(pd-t239-r9 · pd-t239-r9base).
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { acceptFetch, answerLocked } from '../progress-store'

const c = fs.readFileSync(path.join(__dirname, '../DiagnosticClient.tsx'), 'utf8')

describe('늦은 finally — 화면의 제출 세대일 때만', () => {
  // finally 판정을 그대로 옮긴 모형: mine = answerLocked(screenSubmitReq, endingReq)
  const onFinally = (screenSubmitReq: number | null, endingReq: number, currentReq: number, phase: string) => {
    const mine = answerLocked(screenSubmitReq, endingReq)
    return {
      screenSubmitReq: mine ? null : screenSubmitReq,
      phase: mine && !acceptFetch(endingReq, currentReq, true) && phase === 'submitting' ? 'start' : phase,
    }
  }
  it('A(5) 의 늦은 finally 는 B(7) 가 맡은 「결과 분석 중」을 시작 화면으로 덮지 않는다 · B 의 busy 도 그대로', () => {
    expect(onFinally(7, 5, 7, 'submitting')).toEqual({ screenSubmitReq: 7, phase: 'submitting' })
  })
  it('대체됐는데 화면을 맡은 다른 제출이 없으면 시작 화면으로(고착 방지는 유지)', () => {
    expect(onFinally(5, 5, 6, 'submitting')).toEqual({ screenSubmitReq: null, phase: 'start' })
  })
  it('대체되지 않은 정상 종료는 phase 를 건드리지 않는다', () => {
    expect(onFinally(5, 5, 5, 'results')).toEqual({ screenSubmitReq: null, phase: 'results' })
  })
  it('배선 — finally 는 mine 을 먼저 계산하고 mine 일 때만 해제 · 전환', () => {
    expect(c).toContain('const mine = answerLocked(submittingReq.current, ctx.req)')
    expect(c).toContain('if (mine) submittingReq.current = null')
    expect(c).toContain("if (mine && !acceptFetch(ctx.req, req.current, true)) setPhase((cur) => (cur === 'submitting' ? 'start' : cur))")
    expect(c).not.toContain('if (submittingReq.current === ctx.req) submittingReq.current = null')
  })
})

describe('레벨 안내 모달의 내 레벨', () => {
  it('시작 화면 모달은 personalOk 일 때만 내 레벨을 넘긴다', () => {
    expect(c).toContain('currentLevel={personalOk ? (lastLevel?.level ?? null) : null}')
  })
  it('개인 진행이 가려지면(확인 중 · 바뀜) 모달을 닫는다', () => {
    expect(c).toContain("const personalVisible = viewerId === null || authStatus === 'same'")
    expect(c).toMatch(/useEffect\(\(\) => \{\n\s+if \(!personalVisible\) setLevelGuideOpen\(false\)\n\s+\}, \[personalVisible\]\)/)
  })
})
