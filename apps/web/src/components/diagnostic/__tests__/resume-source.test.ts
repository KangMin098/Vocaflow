// apps/web/src/components/diagnostic/__tests__/resume-source.test.ts
//
// T-0239 r4 재리뷰 회귀 — 메모리 응답 우선 재개 · 만료 안내 · 추천 대기 중 대체된 제출이 결과로 덮지 않음.
// 판정은 순수 함수(pickResumeSource · readProgress · acceptFetch), 배선은 소스 단언. 화면 흐름은 하네스(pd-t239-r5).
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { acceptFetch, ownerTag, pickResumeSource, questionSig, readProgress, writeProgress, type DiagQuestion, type KV, type ProgressRecord } from '../progress-store'

const Q = (id: string, i: number): DiagQuestion => ({ id, word: `w-${id}`, target_v_level: 3, target_track_level: null, display_order: i })
const QS = [Q('q1', 1), Q('q2', 2), Q('q3', 3)]
const A = ownerTag('a'), B = ownerTag('b')
const rec = (owner: string, ids: string[], savedAt = 0): ProgressRecord => ({ v: 2, owner, testId: 't1', sig: questionSig(QS), responses: ids.map((id) => ({ question_id: id, knew: true })), savedAt })

describe('pickResumeSource — 메모리 응답 우선', () => {
  it('저장 실패로 저장소가 낡았으면(q1) 메모리 최신(q1,q2)을 쓴다', () => {
    expect(pickResumeSource(rec(A, ['q1', 'q2']), rec(A, ['q1']), A)?.responses.length).toBe(2)
  })
  it('저장분이 아예 없어도 메모리로 이어 간다', () => {
    expect(pickResumeSource(rec(A, ['q1']), null, A)?.responses.length).toBe(1)
  })
  it('메모리가 없거나 비었으면 저장소', () => {
    expect(pickResumeSource(null, rec(A, ['q1']), A)?.responses.length).toBe(1)
    expect(pickResumeSource(rec(A, []), rec(A, ['q1']), A)?.responses.length).toBe(1)
  })
  it('다른 owner 의 메모리 · 저장소는 쓰지 않는다 · owner 확인 전(null)은 아무것도', () => {
    expect(pickResumeSource(rec(B, ['q1', 'q2']), rec(A, ['q1']), A)?.owner).toBe(A)
    expect(pickResumeSource(rec(B, ['q1']), rec(B, ['q1']), A)).toBeNull()
    expect(pickResumeSource(rec(A, ['q1']), rec(A, ['q1']), null)).toBeNull()
  })
})

describe('만료 — 이유와 새로 시작을 보이도록 시험 id 를 돌려준다', () => {
  it('readProgress expired 에 testId', () => {
    const m = new Map<string, string>()
    const kv: KV = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }
    writeProgress(kv, { owner: A, testId: 't9', sig: 's', responses: [{ question_id: 'q1', knew: true }] }, 0)
    expect(readProgress(kv, A, 25 * 3600_000)).toEqual({ kind: 'expired', testId: 't9' })
  })
})

describe('추천 대기 중 대체 — 결과로 덮지 않는다', () => {
  it('재확인 · 새 시작으로 세대가 바뀌면 acceptFetch 거짓', () => {
    expect(acceptFetch(3, 4, true)).toBe(false)
    expect(acceptFetch(3, 3, false)).toBe(false)
  })
})

describe('배선', () => {
  const c = fs.readFileSync(path.join(__dirname, '../DiagnosticClient.tsx'), 'utf8')
  it('시작 화면은 pickResumeSource 로 고르고, 만료 · 형식 오류는 안내로', () => {
    expect(c).toContain('const pick = pickResumeSource(memProgress.current, r.kind === \'ok\' ? r.rec : null, owner)')
    expect(c).toContain("if (!pick && r.kind === 'expired') setResumeBlocked({ text: RESUME_REASON_TEXT.expired, testId: r.testId })")
  })
  it('답할 때 메모리 응답을 같은 결속으로 남기고, 새 시작 · 지우기 · 제출 성공에서 끊는다', () => {
    expect(c).toContain('memProgress.current = { v: 2, ...rec, savedAt: now() }')
    expect((c.match(/memProgress\.current = null/g) ?? []).length).toBe(3)
  })
  it('추천 반영 · 결과 전환 직전 같은 세대 · 인증 검사', () => {
    expect(c).toContain('const live = () => acceptFetch(ctx.req, req.current, viewerId === null || guard.isCurrent(ctx.token))')
    expect(c).toMatch(/const recs = await loadRecommendations\(userId, \[\]\)\n\s+if \(!live\(\)\) return\n\s+setRecommendations\(recs\)/)
    expect(c).toMatch(/if \(!live\(\)\) return\n\s+setPhase\('results'\)/)
  })
})
