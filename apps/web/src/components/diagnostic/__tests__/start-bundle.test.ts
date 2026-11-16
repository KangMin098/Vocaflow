// apps/web/src/components/diagnostic/__tests__/start-bundle.test.ts
//
// T-0239 r5 재리뷰 회귀 — (1) 새 시작은 selectedTest · questions · responses 를 받아들여진 조회 결과로 한 묶음만 바꾸고,
// 조회 중에는 답 단추를 잠근다 (2) 이전 제출의 분석 RPC 오류는 세대 · 인증 확인 뒤에만 반영한다.
// 판정은 기존 순수 함수(acceptFetch) 재사용, 배선은 소스 단언. 화면 흐름은 하네스(pd-t239-r6).
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { acceptFetch, answerLocked } from '../progress-store'

const c = fs.readFileSync(path.join(__dirname, '../DiagnosticClient.tsx'), 'utf8')
const startBody = c.slice(c.indexOf('  async function startTest(test: TestInfo) {'), c.indexOf('  /**\n   * 보관된 진행을 이어서 푼다'))

describe('acceptFetch — 시작 조회의 수락', () => {
  it('A 진행 중 인증 재확인 화면에서 B 시작 → 그 사이 더 새 요청이 없고 인증이 확인됐을 때만 받는다', () => {
    expect(acceptFetch(5, 5, true)).toBe(true)
    expect(acceptFetch(5, 5, false)).toBe(false) // 인증 확인 전에 온 조회는 버린다
    expect(acceptFetch(5, 6, true)).toBe(false) // 그 뒤 또 다른 시작
  })
})

describe('새 시작 — 한 묶음 교체', () => {
  it('selectedTest 는 조회가 받아들여진 뒤에만 바꾼다(조회 전에 바꾸지 않는다)', () => {
    const iFetch = startBody.indexOf('got = await fetchQuestions(test.id)')
    const iAccept = startBody.indexOf('if (!stillMine(my, token)) return')
    const iSelect = startBody.indexOf('setSelectedTest(test)')
    expect(iFetch).toBeGreaterThan(0)
    expect(iAccept).toBeGreaterThan(iFetch)
    expect(iSelect).toBeGreaterThan(iAccept)
    expect(startBody.indexOf('setQuestions(data)')).toBeGreaterThan(iSelect)
    expect(startBody.indexOf('setResponses([])')).toBeGreaterThan(iSelect)
    expect((startBody.match(/setSelectedTest\(/g) ?? []).length).toBe(1)
  })
  it('조회 중에는 진행 화면 답 단추를 잠그고, 그 요청이 최신일 때만 잠금을 푼다', () => {
    expect(startBody).toContain('setStartPending(my)')
    expect(startBody).toContain('if (my === req.current) setStartPending(null)')
    expect(c).toContain('if (startLocked) return')
    expect((c.match(/disabled=\{startLocked\}/g) ?? []).length).toBe(2)
  })
})

describe('r6 재리뷰 — 재개 · 다른 시작이 대체하면 잠금이 풀린다', () => {
  it('answerLocked: 잠근 요청이 지금 세대일 때만 잠김', () => {
    expect(answerLocked(null, 3)).toBe(false)
    expect(answerLocked(3, 3)).toBe(true)
    // 새 진단 조회(3) 중 「이어서 하기」가 세대를 4 로 올림 → 이전 조회가 해제하지 못해도 잠김 아님
    expect(answerLocked(3, 4)).toBe(false)
  })
  it('렌더는 answerLocked(startPending, req.current) 로 계산하고, 재개는 잠금 표식을 지운다', () => {
    expect(c).toContain('const startLocked = answerLocked(startPending, req.current)')
    const resume = c.slice(c.indexOf('  async function resumeTest(progress: ProgressRecord) {'))
    expect(resume.slice(0, 300)).toMatch(/const my = \+\+req\.current\n\s+const token = guard\.token\(\)\n\s+setStartPending\(null\)/)
  })
})

describe('이전 제출의 오류 반영', () => {
  it('분석 RPC 오류는 authGone()(acceptFetch 대체 여부 + 인증) 뒤에만 setError', () => {
    expect(c).toMatch(/if \(authGone\(\)\) return\n\s+if \(applyErr\) \{\n\s+setError\(applyErr\.message\)/)
    expect(c).toMatch(/if \(authGone\(\)\) return\n\s+if \(insertErr \|\| !insertData\) \{/)
  })
})
