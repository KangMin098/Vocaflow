// apps/web/src/lib/csat/content-review/__tests__/workspace.test.ts
//
// F2 화면 모델 — 실제 스냅샷으로 대기열 · 대조 자료 · 발행 차단을 확인한다.

import { describe, expect, it } from 'vitest'

import snapshot from '../data/snapshot.json'
import { publishAllowed } from '../prepublish'
import { candidateDetail, queueRows, toLectureCue, wordDiff, type Snapshot } from '../workspace'

const S = snapshot as unknown as Snapshot

describe('대기열', () => {
  it('후보 50건 · 결속이 모두 현재 판본과 같다', () => {
    const rows = queueRows(S)
    expect(rows).toHaveLength(50)
    expect(rows.filter((r) => r.stale)).toEqual([])
  })
})

describe('2015#25 복수정답', () => {
  const c = S.candidates.find((x) => x.itemId === '2015#25')!
  const d = candidateDetail(S, c.id)!
  it('공식 정답은 집합 {4,5} 그대로 온다', () => {
    expect(d.candidate.officialAnswers).toEqual([4, 5])
  })
  it('현재 분석·강의는 발행 전 검증에서 차단된다', () => {
    expect(d.prepublishNow?.blocked).toBe(true)
    const where = d.prepublishNow!.findings.filter((f) => f.severity === 'BLOCK').map((f) => f.where).join(' ')
    expect(where).toMatch(/c9/)
  })
  it('사람 승인이 없으므로 발행 게이트가 닫혀 있다', () => {
    expect(publishAllowed([], c, d.prepublishNow).allowed).toBe(false)
  })
})

describe('승인 0건', () => {
  it('스냅샷의 모든 후보에 대해 빈 원장의 발행 게이트가 닫혀 있다', () => {
    for (const c of S.candidates) {
      const d = candidateDetail(S, c.id)!
      expect(publishAllowed([], c, d.prepublishNow).allowed).toBe(false)
    }
  })
})

describe('보조', () => {
  it('없는 id 는 null', () => {
    expect(candidateDetail(S, 'cr_nope')).toBeNull()
  })
  it('cue target 을 강의 형태로 바꾼다', () => {
    const q = toLectureCue({ id: 'c9', role: 'eliminate', target: 'analysis:reject:5', text: 't' }, 8)
    expect(q.target).toEqual({ kind: 'analysis', id: 'reject:5' })
  })
  it('낱말 차이', () => {
    expect(wordDiff('사 번 정답', '오 번 정답')).toEqual([
      { op: 'del', text: '사' },
      { op: 'add', text: '오' },
      { op: 'same', text: ' 번 정답' },
    ])
  })
})

// ── T-0158 Codex 24차 반례: 다른 문항 승인 원장의 후보 ID 만 바꾼 이식 ──────────
import { bindingHash, transition, verifyLedger } from '../state'
import type { LedgerEntry, Reviewer } from '../types'

describe('T-0158 24차 반례 — 승인 이식 차단', () => {
  it('다른 문항의 정상 승인 원장을 후보 ID 만 바꿔도 발행 게이트가 닫혀 있다', () => {
    const A = S.candidates.find((c) => c.id === 'cr_6132c29377569b4a')!
    const B = S.candidates.find((c) => c.id === 'cr_81e20c41c8c918ae')!
    const human: Reviewer = { id: 'h', kind: 'human', roles: ['content_reviewer'] }
    const h = bindingHash(A.binding)
    const led: LedgerEntry[] = []
    for (const [to, evidence] of [['in_review', []], ['content_approved', [{ kind: 'official_pdf_text', ref: 'x', boundHash: h }, { kind: 'lecture_cue', ref: 'x', boundHash: h }]]] as const) {
      const r = transition(led, { candidate: A, track: 'lecture_cue', to, by: human, currentBinding: A.binding, evidence: [...evidence], reason: 'r', at: '2026-10-24T00:00:00Z' })
      if (!r.ok) throw new Error(r.message)
      led.push(r.entry)
    }
    const forged = led.map((e) => ({ ...e, candidateId: B.id }))
    const bReport = candidateDetail(S, B.id)!.prepublishNow
    const gate = publishAllowed(forged, { ...B, tracks: ['lecture_cue'] }, bReport)
    expect(gate.allowed).toBe(false)
    expect(gate.reasons.join()).toMatch(/판본|다른 문항/)
    // 한 원장 안에서 같은 후보가 두 문항을 오가면 무결성 오류
    const mixed = [led[0]!, { ...led[1]!, binding: B.binding }]
    expect(verifyLedger(mixed).problems.join()).toMatch(/문항이/)
  })
})
