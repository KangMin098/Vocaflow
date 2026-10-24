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
