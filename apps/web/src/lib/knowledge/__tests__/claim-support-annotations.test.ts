// apps/web/src/lib/knowledge/__tests__/claim-support-annotations.test.ts
// 주장/근거 확인 문항 전부(2022#20 외 확대분) — 골격 서명 · 역할 겹침 · 채택 조건 · 합의 문장만 채점 · 원문 미포함
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { annotatedItemIds, annotationFor, gradeClaimSupport, skeletonSig } from '../claim-support'
import { RELATIONS } from '../claim-support-labels'

type Sk = { items: { id: string; sentences: { chars: number; reveals: { anchorId: string }[] }[] }[] }
const skeleton = (id: string) => {
  const exam = id.split('#')[0]
  const sk = JSON.parse(fs.readFileSync(path.join(process.cwd(), `src/lib/csat/skeleton-data/${exam}.json`), 'utf8')) as Sk
  return sk.items.find((i) => i.id === id)!
}
const ids = annotatedItemIds()

describe('주장/근거 확인 문항', () => {
  it('서로 다른 확인 문항이 2개 이상이다(find-outcome 확정 기준)', () => {
    expect(ids.length).toBeGreaterThanOrEqual(2)
    expect(ids).toEqual(expect.arrayContaining(['2022#20', '2025#20']))
  })

  for (const id of ids) {
    describe(id, () => {
      const ann = annotationFor(id)!
      const item = skeleton(id)
      it('커밋된 골격과 문장 경계가 같다(서명)', () => {
        expect(skeletonSig(item.sentences.map((s) => s.chars))).toBe(ann.skeletonSig)
        expect(item.sentences.length).toBe(ann.sentenceCount)
      })
      it('역할이 겹치지 않고 범위 안 · 관계 질문 문장은 합의된 뒷받침', () => {
        const all = [ann.claim, ...ann.claimRestated, ...ann.support, ...ann.supportDisputed, ...ann.opposed]
        expect(new Set(all).size).toBe(all.length)
        for (const n of all) expect(n >= 0 && n < ann.sentenceCount).toBe(true)
        expect(ann.support).toContain(ann.relationProbe.sentence)
        expect(RELATIONS).toContain(ann.relationProbe.relation)
        expect(ann.provenance.reviewerBlind).toBe(true)
      })
      it('확대분 채택 조건 — 주장 문장이 정답 근거 앵커와 같다', () => {
        const anchors = item.sentences.flatMap((s, i) => (s.reveals.some((r) => r.anchorId === 'answer') ? [i] : []))
        expect(ann.answerAnchorOverlap.answerAnchorSentences).toEqual(anchors)
        if (id !== '2022#20') expect(anchors).toContain(ann.claim)
      })
      it('합의 문장으로만 채점 — 갈린 문장은 골라도 틀리지 않는다', () => {
        const ok = { claim: ann.claim, support: ann.support, relation: ann.relationProbe.relation }
        expect(gradeClaimSupport(ann, ok).isCorrect).toBe(true)
        expect(gradeClaimSupport(ann, { ...ok, support: [...ann.support, ...ann.supportDisputed] }).isCorrect).toBe(true)
        for (const o of ann.opposed) expect(gradeClaimSupport(ann, { ...ok, support: [...ann.support, o] }).isCorrect).toBe(false)
      })
    })
  }

  it('주석 파일에 지문 원문이 없다(문장 번호만)', () => {
    const dir = path.join(process.cwd(), 'src/lib/knowledge/annotations')
    for (const f of fs.readdirSync(dir).filter((x) => x.startsWith('claim-support-'))) {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8')
      expect(raw).not.toMatch(/video games|counselor|expertise|songwriters|misinformation|bad apples/i)
    }
  })
})
