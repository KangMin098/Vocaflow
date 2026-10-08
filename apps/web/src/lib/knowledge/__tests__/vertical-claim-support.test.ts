// apps/web/src/lib/knowledge/__tests__/vertical-claim-support.test.ts
// Phase 3 첫 수직 경로 — 주석 · 채점 · 채택 사슬 게이트 · 재검토 전파(순수 규칙)
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { annotationFor, gradeClaimSupport, parseResponse, skeletonSig } from '../claim-support'
import { RELATIONS } from '../claim-support-labels'
import { cascadeTargets, resolveChain, type ChainItem, type ChainLink } from '../live-chain'

const ann = annotationFor('2022#20')!

describe('주장/근거 주석 2022#20', () => {
  it('있고, 커밋된 골격과 문장 경계가 같다(서명)', () => {
    const sk = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/lib/csat/skeleton-data/2022.json'), 'utf8')) as { items: { id: string; sentences: { chars: number }[] }[] }
    const it = sk.items.find((i) => i.id === '2022#20')!
    expect(skeletonSig(it.sentences.map((s) => s.chars))).toBe(ann.skeletonSig)
    expect(it.sentences.length).toBe(ann.sentenceCount)
  })
  it('주장 · 뒷받침 · 반박 · 재진술 · 논쟁 문장이 서로 겹치지 않고 범위 안이다', () => {
    const all = [ann.claim, ...ann.claimRestated, ...ann.support, ...ann.supportDisputed, ...ann.opposed]
    expect(new Set(all).size).toBe(all.length)
    for (const n of all) expect(n >= 0 && n < ann.sentenceCount).toBe(true)
    expect(ann.support).toContain(ann.relationProbe.sentence)
    expect(RELATIONS).toContain(ann.relationProbe.relation)
  })
  it('정답 근거 앵커와 별개 객체 — 겹침은 명시만 한다', () => {
    expect(ann.answerAnchorOverlap.answerAnchorSentences).toEqual([1])
    expect(ann.provenance.reviewerBlind).toBe(true)
    // 주석 파일에는 지문 원문이 없다(문장 번호만)
    const raw = fs.readFileSync(path.join(process.cwd(), 'src/lib/knowledge/annotations/claim-support-2022-20.v1.json'), 'utf8')
    expect(raw).not.toMatch(/social media/i)
  })
})

describe('채점', () => {
  const ok = { claim: 1, support: [3, 4], relation: 'reason' as const }
  it('정답', () => expect(gradeClaimSupport(ann, ok).isCorrect).toBe(true))
  it('두 판정자가 갈린 문장(3번째)은 골라도 틀리지 않는다', () => expect(gradeClaimSupport(ann, { ...ok, support: [2, 3, 4] }).isCorrect).toBe(true))
  it('재진술 문장을 주장으로 고르면 틀리되 가깝다고 알린다', () => {
    const g = gradeClaimSupport(ann, { ...ok, claim: 5 })
    expect(g.claimOk).toBe(false)
    expect(g.claimRestated).toBe(true)
  })
  it('빠진 · 남는 뒷받침 문장을 따로 센다', () => {
    const g = gradeClaimSupport(ann, { ...ok, support: [0, 3] })
    expect(g.supportMissed).toEqual([4])
    expect(g.supportExtra).toEqual([0])
    expect(g.isCorrect).toBe(false)
  })
  it('관계가 틀리면 틀림', () => expect(gradeClaimSupport(ann, { ...ok, relation: 'example' }).isCorrect).toBe(false))
  it('입력 검증 — 범위 밖 · 중복 · 빈 배열 · 모르는 관계는 거부', () => {
    expect(parseResponse({ claim: 7, support: [3], relation: 'reason' }, ann)).toBeNull()
    expect(parseResponse({ claim: 1, support: [3, 3], relation: 'reason' }, ann)).toBeNull()
    expect(parseResponse({ claim: 1, support: [], relation: 'reason' }, ann)).toBeNull()
    expect(parseResponse({ claim: 1, support: [3], relation: 'efficacy' }, ann)).toBeNull()
    expect(parseResponse({ claim: 1, support: [4, 3], relation: 'reason' }, ann)).toEqual({ claim: 1, support: [3, 4], relation: 'reason' })
  })
})

const item = (id: string, layer: ChainItem['layer'], status: string): ChainItem => ({ id, slug: id, title: id, layer, kind: null, status, version: 1, efficacy: 'not_assessed' })
const up = (from: string, to: string): ChainLink => ({ from_id: from, to_id: to, kind: 'implements' })

describe('채택 사슬 게이트(학습자 노출)', () => {
  const links = [up('T', 'M'), up('M', 'P'), up('P', 'E')]
  it('과제 · 방법 · 기제 모두 채택이면 살아 있다(본질 묶음은 조건이 아니다)', () => {
    const v = resolveChain('T', [item('T', 'practice', 'applied'), item('M', 'method', 'adopted'), item('P', 'principle', 'adopted'), item('E', 'essence', 'in_review')], links)
    expect(v.live).toBe(true)
    expect(v.path.map((p) => p.id)).toEqual(['T', 'M', 'P', 'E'])
  })
  it('미채택 층이 하나라도 있으면 숨긴다 — 끊긴 곳을 알려 준다', () => {
    const v = resolveChain('T', [item('T', 'practice', 'adopted'), item('M', 'method', 'in_review'), item('P', 'principle', 'adopted')], links)
    expect(v.live).toBe(false)
    expect(v.breaks).toEqual([{ layer: 'method', slug: 'M', reason: '채택 전 상태(in_review)' }])
  })
  it('연결이 없는 층도 끊김', () => {
    const v = resolveChain('T', [item('T', 'practice', 'adopted'), item('M', 'method', 'adopted')], [up('T', 'M')])
    expect(v.live).toBe(false)
    expect(v.breaks.map((b) => b.layer)).toEqual(['principle'])
  })
})

describe('재검토 전파', () => {
  it('기제가 흔들리면 그 아래 살아 있는 방법 · 과제를 모두 고른다(검토 중인 것은 빼고)', () => {
    const items = [item('P', 'principle', 'in_review'), item('M', 'method', 'adopted'), item('T', 'practice', 'applied'), item('T2', 'practice', 'in_review')]
    const links = [up('T', 'M'), up('T2', 'M'), up('M', 'P')]
    expect(cascadeTargets('P', items, links).map((i) => i.id)).toEqual(['M', 'T'])
  })
  it('다른 사슬은 건드리지 않는다', () => {
    const items = [item('P', 'principle', 'adopted'), item('X', 'method', 'adopted')]
    expect(cascadeTargets('P', items, [up('X', 'Q')])).toEqual([])
  })
})
