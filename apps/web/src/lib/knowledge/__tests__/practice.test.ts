// apps/web/src/lib/knowledge/__tests__/practice.test.ts
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildClaimTask, parseClaimResponse, pickNext, scoreClaim, toLearnerTask, type SkeletonItemLike } from '../practice'

const item: SkeletonItemLike = {
  id: '2026#20',
  no: 20,
  type_id: 'R-CLAIM',
  sentences: [{ chars: 154 }, { chars: 273 }, { chars: 216 }, { chars: 117 }, { chars: 130 }],
  anchors: [
    { id: 'answer', sentences: [4], from: 'answer' },
    { id: 'reject:4', sentences: [0], from: 'tempt' },
  ],
}

describe('buildClaimTask', () => {
  it('정답 근거·함정 문장을 뽑는다', () => {
    const t = buildClaimTask(item)!
    expect(t.keySentences).toEqual([4])
    expect(t.trapSentences).toEqual([0])
    expect(t.bars).toEqual([154, 273, 216, 117, 130])
  })
  it('정답 근거가 없으면 과제가 아니다', () => {
    expect(buildClaimTask({ ...item, anchors: [] })).toBeNull()
  })
  it('범위 밖 문장 번호는 버린다', () => {
    expect(buildClaimTask({ ...item, anchors: [{ id: 'answer', sentences: [9] }] })).toBeNull()
  })
})

describe('저작권 경계 — toLearnerTask', () => {
  it('정답·함정 번호와 글자를 내보내지 않는다', () => {
    const out = toLearnerTask(buildClaimTask(item)!)
    expect(Object.keys(out).sort()).toEqual(['bars', 'itemId', 'no', 'typeId'])
    // 막대는 숫자뿐 — 지문 조각(영어 낱말)이 값으로 섞여 나가지 않는다
    expect(out.bars.every((b) => typeof b === 'number')).toBe(true)
    expect(JSON.stringify(Object.values(out))).not.toMatch(/[a-z]{4,}/)
  })
})

describe('parseClaimResponse', () => {
  const ok = { claimSentence: 4, evidenceSentences: [1, 2, 4], option: 3, confidence: 2, sec: 41.6 }
  it('정상 응답 — 주장 문장은 근거에서 뺀다', () => {
    const r = parseClaimResponse(ok, 5)
    expect(r.ok && r.value.evidenceSentences).toEqual([1, 2])
    expect(r.ok && r.value.sec).toBe(42)
  })
  it('범위 밖 문장', () => {
    expect(parseClaimResponse({ ...ok, claimSentence: 5 }, 5).ok).toBe(false)
  })
  it('근거 4개 이상 거부', () => {
    expect(parseClaimResponse({ ...ok, evidenceSentences: [0, 1, 2, 3] }, 5).ok).toBe(false)
  })
  it('글자 응답은 받지 않는다', () => {
    expect(parseClaimResponse({ ...ok, claimSentence: 'The study' }, 5).ok).toBe(false)
  })
  it('선지 모름은 null 허용, 6 은 거부', () => {
    expect(parseClaimResponse({ ...ok, option: null }, 5).ok).toBe(true)
    expect(parseClaimResponse({ ...ok, option: 6 }, 5).ok).toBe(false)
  })
})

describe('scoreClaim', () => {
  const t = buildClaimTask(item)!
  const base = { evidenceSentences: [], confidence: 2 as const, sec: 30 }
  it('적중', () => {
    const f = scoreClaim(t, { ...base, claimSentence: 4, option: 2 }, 2)
    expect(f.claimHit).toBe(true)
    expect(f.optionCorrect).toBe(true)
  })
  it('함정 문장을 고르면 그렇게 말한다', () => {
    const f = scoreClaim(t, { ...base, claimSentence: 0, option: 1 }, 2)
    expect(f.claimHit).toBe(false)
    expect(f.claimOnTrap).toBe(true)
    expect(f.next).toContain('오답 선지가 기대는')
  })
  it('정답 키가 없으면 선지 판정을 하지 않는다', () => {
    expect(scoreClaim(t, { ...base, claimSentence: 4, option: 2 }, null).optionCorrect).toBeNull()
  })
})

describe('pickNext', () => {
  const pool = { train: ['a', 'b', 'c'], transfer: ['x', 'y'] }
  it('안 한 훈련 문항부터', () => {
    expect(pickNext(pool, new Set(['a']), 1)).toEqual({ itemId: 'b', phase: 'train' })
  })
  it('5회마다 전이 하나', () => {
    expect(pickNext(pool, new Set(['a']), 5)).toEqual({ itemId: 'x', phase: 'transfer' })
  })
  it('다 하면 null', () => {
    expect(pickNext(pool, new Set(['a', 'b', 'c', 'x', 'y']), 3)).toBeNull()
  })
})

describe('실제 골격 데이터', () => {
  it('대의 4유형 중 과제가 되는 문항이 있다', () => {
    const dir = path.join(process.cwd(), 'src/lib/csat/skeleton-data')
    let n = 0
    for (const f of fs.readdirSync(dir)) {
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { items?: SkeletonItemLike[] }
      for (const it of d.items ?? []) {
        if (['R-CLAIM', 'R-GIST', 'R-TOPIC', 'R-TITLE'].includes(it.type_id ?? '') && buildClaimTask(it)) n++
      }
    }
    expect(n).toBeGreaterThanOrEqual(100)
  })
})
