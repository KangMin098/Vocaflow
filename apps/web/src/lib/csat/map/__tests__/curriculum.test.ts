// apps/web/src/lib/csat/map/__tests__/curriculum.test.ts
// 기준 정본 — 모든 단계가 정의되고, 정본 보류 · 학년 권장 · §13 절차 · 생애주기 4칸이 어긋나지 않게
import { describe, expect, it } from 'vitest'

import { CRITERIA, CURRICULUM, PROTOCOL, criteriaOf, SCHOOL_BANDS, TRANSFER_HREF, exposureOf, lifecycleCells, repairProtocol, stepOfTask } from '../curriculum'
import { ALL_STEPS, READ_PATH } from '../learner-path'

describe('기준 정본', () => {
  it('읽기 7 + 듣기 4 단계 모두 정의 — 빠진 단계 · 남는 단계 없음', () => {
    expect(Object.keys(CURRICULUM).sort()).toEqual(ALL_STEPS.map((s) => s.key).sort())
  })
  it('§13 Protocol 은 7단계 · 번호 1–7', () => {
    expect(PROTOCOL.map((p) => p.no)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
  it('듣기 · 실전(X)은 정본 보류(§20-4 · §20-5) — 확인 과제를 붙이지 않는다', () => {
    for (const s of ALL_STEPS.filter((x) => x.track === 'listen' || x.key === 'integrate')) {
      expect(CURRICULUM[s.key].readiness).toBe('blocked')
      expect(CURRICULUM[s.key].taskKeys).toEqual([])
    }
  })
  it('live · ready 단계는 확인 과제 · 바로잡기 절차가 있고, 적용 링크는 practice 종류만', () => {
    for (const c of Object.values(CURRICULUM).filter((x) => x.readiness === 'live' || x.readiness === 'ready')) {
      expect(c.taskKeys.length).toBeGreaterThan(0)
      expect(repairProtocol(c.step).length).toBeGreaterThan(0)
      // 적용 링크는 기록이 실제로 남는 곳(practice)만 — item 종류는 전이 문항 풀 전까지 「준비 중」(Codex P2)
      for (const k of c.taskKeys) expect(!!TRANSFER_HREF[k]).toBe(c.transfer === 'practice')
    }
  })
  it('과제 키는 한 단계에만 속한다', () => {
    const keys = Object.values(CURRICULUM).flatMap((c) => c.taskKeys)
    expect(new Set(keys).size).toBe(keys.length)
    expect(stepOfTask('claim-support')).toBe('structure')
    expect(stepOfTask('evidence-locate')).toBe('evidence')
    expect(stepOfTask('nope')).toBeNull()
  })
  it('학년 권장(§15): 초등은 LP1–2 중심 · LP3 맛보기, 중등은 LP2–4 중심, 고등은 LP3–7 중심 — 잠금 값 없음', () => {
    const lp = READ_PATH.map((s) => s.key)
    expect(lp.filter((k) => exposureOf(k, 'elementary') === 'core')).toEqual(['vocab', 'sentence'])
    expect(exposureOf('relation', 'elementary')).toBe('preview')
    expect(lp.filter((k) => exposureOf(k, 'middle') === 'core')).toEqual(['vocab', 'sentence', 'relation', 'structure'])
    expect(lp.filter((k) => exposureOf(k, 'high') === 'core')).toEqual(['vocab', 'relation', 'structure', 'option', 'evidence', 'integrate'])
    for (const b of SCHOOL_BANDS) for (const k of lp) expect(['core', 'preview', 'later']).toContain(exposureOf(k, b))
    expect(exposureOf('vocab', null)).toBeNull()
  })
})

describe('판정 기준', () => {
  it('확인 과제가 있는 단계는 기준이 있고, 없는 단계는 없다 · 엔진 상수와 같다', () => {
    for (const c of Object.values(CURRICULUM)) expect(criteriaOf(c.step) === null).toBe(c.taskKeys.length === 0)
    expect(CRITERIA).toEqual({ verifyItems: 2, checkItems: 2, expiryDays: 120, minConfirmItems: 4 })
  })
})

describe('생애주기 4칸', () => {
  const sk = (status: 'unverified' | 'verified' | 'still_needed' | 'resolved' | 'expired', right = 0, wrong = 0) => ({ status, check: { right, wrong, need: 2 } })
  const states = (c: ReturnType<typeof lifecycleCells>) => c.map((x) => x.state)
  it('확인 전에는 확인하기만 열린다(처방 잠김 — 정본 §14)', () => {
    expect(states(lifecycleCells(null, false))).toEqual(['now', 'locked', 'locked', 'locked'])
    expect(states(lifecycleCells(sk('unverified'), true))).toEqual(['now', 'locked', 'locked', 'locked'])
  })
  it('직접 확인 → 바로잡기가 지금 할 일 · 적용 · 다시 확인 열림', () => {
    expect(states(lifecycleCells(sk('verified', 1), true))).toEqual(['done', 'now', 'open', 'open'])
    expect(lifecycleCells(sk('verified', 1), true)[3].note).toBe('맞힘 1/2')
  })
  it('다시 확인에서 막히면 바로잡기 · 다시 확인이 다시 지금 할 일', () => {
    expect(states(lifecycleCells(sk('still_needed', 1, 1), true))).toEqual(['done', 'now', 'open', 'open']) // 지금 할 일은 하나 — 바로잡기 기록이 생기면 적용 → 다시 확인 순서
  })
  it('통과하면 확인 · 다시 확인만 마침 · 기한이 지나면 다시 확인부터', () => {
    expect(states(lifecycleCells(sk('resolved', 2), true))).toEqual(['done', 'open', 'open', 'done']) // 바로잡기 · 적용은 수행 근거가 없어 마침이 아니다
    expect(states(lifecycleCells(sk('expired'), true))).toEqual(['now', 'locked', 'locked', 'locked'])
  })
})
