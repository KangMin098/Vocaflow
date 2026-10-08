// apps/web/src/lib/knowledge/__tests__/claim-support-2025.test.ts
// 두 번째 확인 문항 2025#20 — 골격 서명 · 겹침 없음 · 합의 문장만 채점 · 원문 미포함
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { annotationFor, gradeClaimSupport, skeletonSig } from '../claim-support'

const ann = annotationFor('2025#20')!
const sk = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/lib/csat/skeleton-data/2025.json'), 'utf8')) as { items: { id: string; sentences: { chars: number }[] }[] }

describe('주장/근거 주석 2025#20', () => {
  it('있고, 커밋된 골격과 문장 경계가 같다(서명)', () => {
    const item = sk.items.find((i) => i.id === '2025#20')!
    expect(skeletonSig(item.sentences.map((s) => s.chars))).toBe(ann.skeletonSig)
    expect(item.sentences.length).toBe(ann.sentenceCount)
  })
  it('역할이 겹치지 않고 관계 질문 문장은 합의된 뒷받침이다', () => {
    const all = [ann.claim, ...ann.claimRestated, ...ann.support, ...ann.supportDisputed, ...ann.opposed]
    expect(new Set(all).size).toBe(all.length)
    expect(ann.support).toContain(ann.relationProbe.sentence)
    expect(ann.provenance.reviewerBlind).toBe(true)
  })
  it('합의 문장으로만 채점 — 갈린 문장은 골라도 틀리지 않고, 반박 대상을 뒷받침으로 고르면 틀린다', () => {
    expect(gradeClaimSupport(ann, { claim: 4, support: [5], relation: 'reason' }).isCorrect).toBe(true)
    expect(gradeClaimSupport(ann, { claim: 4, support: [1, 3, 5], relation: 'reason' }).isCorrect).toBe(true)
    expect(gradeClaimSupport(ann, { claim: 4, support: [0, 5], relation: 'reason' }).isCorrect).toBe(false)
    expect(gradeClaimSupport(ann, { claim: 0, support: [5], relation: 'reason' }).claimOk).toBe(false)
  })
  it('주석 파일에 지문 원문이 없다', () => {
    const raw = fs.readFileSync(path.join(process.cwd(), 'src/lib/knowledge/annotations/claim-support-2025-20.v1.json'), 'utf8')
    expect(raw).not.toMatch(/video games/i)
  })
})
