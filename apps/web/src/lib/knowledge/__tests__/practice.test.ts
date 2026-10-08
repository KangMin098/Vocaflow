// apps/web/src/lib/knowledge/__tests__/practice.test.ts
// /csat/practice 이식 — 순수 규칙 · 골격 115문항 채점 회귀 · 효과 프로토콜(docs/csat-learner/PRACTICE_PORT.md)
import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { loadItemSkeleton, skeletonSiblings } from '@/lib/csat/skeleton'

import { annotationFor, gradeClaimSupport } from '../claim-support'
import {
  PRACTICE_TASK,
  SKELETON_TASK,
  TRANSFER_TYPES,
  TRAIN_TYPES,
  capabilityHits,
  checkAnswerRange,
  firstAttempts,
  gradePractice,
  isSyntheticEmail,
  keyFromAnnotation,
  keyFromSkeleton,
  parseSubmission,
  pickNext,
  type MyAttempt,
  type PracticeAnswer,
} from '../practice'
import { ANNOTATED_ITEM_IDS } from '../practice-server'
import { evaluateProtocol, effectEligible, judgeCapability, type AttemptRecord } from '../protocol'

const NOW = Date.parse('2026-10-08T06:00:00Z')
const ann = annotationFor('2022#20')!
const annKey = keyFromAnnotation(ann)
const ans = (over: Partial<PracticeAnswer> = {}): PracticeAnswer => ({ claim: 1, support: [3, 4], relation: 'reason', option: 5, confidence: 3, ...over })

describe('정본 주석 문항 채점 — gradeClaimSupport 를 그대로 쓴다', () => {
  it('주장 · 근거 · 관계가 맞으면 정답', () => {
    const g = gradePractice(gradeClaimSupport, annKey, ans())
    expect(g).toMatchObject({ claimHit: true, supportOk: true, relationOk: true, isCorrect: true })
  })
  it('논쟁 문장(supportDisputed)은 골라도 틀리지 않는다 · 재진술 문장을 주장으로 고르면 가까운 판단', () => {
    expect(gradePractice(gradeClaimSupport, annKey, ans({ support: [2, 3, 4] })).supportOk).toBe(true)
    const g = gradePractice(gradeClaimSupport, annKey, ans({ claim: 6 }))
    expect(g).toMatchObject({ claimHit: false, claimRestated: true, isCorrect: false })
  })
  it('관계를 틀리면 정답이 아니다 · 정본 채점과 같은 결론', () => {
    const g = gradePractice(gradeClaimSupport, annKey, ans({ relation: 'example' }))
    expect(g.relationOk).toBe(false)
    expect(g.isCorrect).toBe(gradeClaimSupport(ann, { claim: 1, support: [3, 4], relation: 'example' }).isCorrect)
  })
  it('근거 0개도 받는다(근거 누락으로 채점)', () => {
    expect(gradePractice(gradeClaimSupport, annKey, ans({ support: [] }))).toMatchObject({ supportOk: false, isCorrect: false })
  })
  it('주석 문항 목록이 정본 주석과 같다', () => {
    for (const id of ANNOTATED_ITEM_IDS) expect(annotationFor(id)).not.toBeNull()
  })
})

const SKELETON_ITEMS = [...TRAIN_TYPES, ...TRANSFER_TYPES].flatMap((t) => skeletonSiblings(t).map((s) => s.id))

describe('골격 115문항 — 개발 · 연습용 후보(효과 계산 제외)', () => {
  it('네 유형 115문항 모두 정답 근거 앵커로 키가 만들어진다', () => {
    expect(SKELETON_ITEMS).toHaveLength(115)
    for (const id of SKELETON_ITEMS) expect(keyFromSkeleton(loadItemSkeleton(id)!), id).not.toBeNull()
  })
  it('옛 의미 보존 — 정답 근거 문장 어느 것을 주장으로 골라도 적중, 함정 문장을 근거로 고르면 「더 고름」', () => {
    for (const id of SKELETON_ITEMS) {
      const k = keyFromSkeleton(loadItemSkeleton(id)!)!
      for (const c of [k.claim, ...k.claimRestated]) {
        expect(gradePractice(gradeClaimSupport, k, ans({ claim: c, support: [], relation: null })).claimHit, `${id} 문장 ${c}`).toBe(true)
      }
      const wrong = Array.from({ length: k.sentenceCount }, (_, i) => i).find((i) => i !== k.claim && !k.claimRestated.includes(i))
      if (wrong !== undefined) expect(gradePractice(gradeClaimSupport, k, ans({ claim: wrong, support: [], relation: null })).claimHit).toBe(false)
      if (k.trap.length) expect(gradePractice(gradeClaimSupport, k, ans({ claim: k.claim, support: [k.trap[0]], relation: null })).supportOk).toBe(false)
      expect(k.relationProbe).toBeNull()
    }
  })
  it('채점 회귀 지문 — 골격을 다시 구워 키가 바뀌면 여기서 멈춘다(바뀐 문항을 확인한 뒤 값을 갱신)', () => {
    const digest = createHash('sha256')
      .update(JSON.stringify(SKELETON_ITEMS.map((id) => keyFromSkeleton(loadItemSkeleton(id)!))))
      .digest('hex')
    expect(digest).toMatchInlineSnapshot(`"321a7245211cb654a1c7c41d39485964baabe1ad1dfe5fb7e2660251a33625ee"`)
  })
  it('과제 키가 둘로 갈린다 — 골격 기록은 정본 과제 키를 쓰지 않는다', () => {
    expect(SKELETON_TASK).not.toBe(PRACTICE_TASK)
  })
})

describe('제출 검사', () => {
  const base = {
    itemId: '2022#20', claim: 1, support: [4, 3, 3], relation: 'reason', option: 5, confidence: 2, sec: 12.4,
    clientMutationId: '7f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b', clientSessionId: '0a1b2c3d-4e5f-4a6b-9c7d-8e9f0a1b2c3d',
    answeredAt: '2026-10-08T05:59:00Z', helpLevel: 'independent',
  }
  it('정상 — 근거는 중복 제거 · 정렬, 판단 시각은 ISO 로', () => {
    const r = parseSubmission(base, NOW)
    expect(r.ok && r.value).toMatchObject({ support: [3, 4], answeredAt: '2026-10-08T05:59:00.000Z', sec: 12, preview: false })
  })
  it('판단 시각 · 제출 id · 세션 id 는 필수', () => {
    for (const k of ['answeredAt', 'clientMutationId', 'clientSessionId'] as const) {
      expect(parseSubmission({ ...base, [k]: undefined }, NOW).ok, k).toBe(false)
    }
    expect(parseSubmission({ ...base, answeredAt: '2026-10-08T07:00:00Z' }, NOW).ok).toBe(false)
  })
  it('근거 4개 · 선지 6 · 확신 0 · 모르는 관계 · 도움 수준 hint 는 거부', () => {
    expect(parseSubmission({ ...base, support: [0, 2, 3, 4] }, NOW).ok).toBe(false)
    expect(parseSubmission({ ...base, option: 6 }, NOW).ok).toBe(false)
    expect(parseSubmission({ ...base, confidence: 0 }, NOW).ok).toBe(false)
    expect(parseSubmission({ ...base, relation: 'cause' }, NOW).ok).toBe(false)
    expect(parseSubmission({ ...base, helpLevel: 'hint' }, NOW).ok).toBe(false)
  })
  it('문항 범위 — 범위 밖 번호 · 주석 문항의 관계 누락 · 골격 문항의 관계 지정 거부', () => {
    expect(checkAnswerRange(annKey, ans({ claim: 7 }))).not.toBeNull()
    expect(checkAnswerRange(annKey, ans({ relation: null }))).not.toBeNull()
    const sk = keyFromSkeleton(loadItemSkeleton(SKELETON_ITEMS[0])!)!
    expect(checkAnswerRange(sk, ans({ claim: 0, support: [], relation: 'reason' }))).not.toBeNull()
    expect(checkAnswerRange(sk, ans({ claim: 0, support: [], relation: null }))).toBeNull()
  })
})

describe('첫 시도 · 역량 판정 · 다음 문항', () => {
  const a = (itemId: string, at: string, over: Partial<MyAttempt> = {}): MyAttempt => ({ itemId, phase: 'practice', helpLevel: 'independent', claimHit: true, answeredAt: at, ...over })
  it('첫 시도는 도착 순이 아니라 판단 시각 순 · 같은 문항 재제출은 빠진다', () => {
    const rows = [a('X', '2026-10-08T05:00:00Z', { claimHit: true }), a('X', '2026-10-08T04:00:00Z', { claimHit: false })]
    expect(firstAttempts(rows).map((r) => r.claimHit)).toEqual([false])
  })
  it('해설 먼저 본 시도 · 전이 시도는 역량 판정에 들어가지 않는다', () => {
    const rows = [a('A', '2026-10-08T01:00:00Z'), a('B', '2026-10-08T02:00:00Z', { helpLevel: 'viewed_first' }), a('C', '2026-10-08T03:00:00Z', { phase: 'transfer' })]
    expect(capabilityHits(rows)).toEqual([true])
    expect(judgeCapability(capabilityHits(rows)).state).toBe('unconfirmed')
  })
  it('연습 5문항을 채우면 전이 문항을 추천한다(완료 수 = 문항 수)', () => {
    const pool = { practice: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], transfer: ['t1'] }
    expect(pickNext(pool, new Set(['p1', 'p2', 'p3', 'p4']), 4)).toEqual({ itemId: 'p5', phase: 'practice' })
    expect(pickNext(pool, new Set(['p1', 'p2', 'p3', 'p4', 'p5']), 5)).toEqual({ itemId: 't1', phase: 'transfer' })
  })
  it('합성 계정 판정은 테스트 도메인만', () => {
    expect(isSyntheticEmail('runtime-test-0705@vocaflow.dev')).toBe(true)
    expect(isSyntheticEmail('someone@gmail.com')).toBe(false)
    expect(isSyntheticEmail(null)).toBe(false)
  })
})

describe('효과 프로토콜 입력', () => {
  const r = (userId: string, phase: AttemptRecord['phase'], hit: boolean, i: number, over: Partial<AttemptRecord> = {}): AttemptRecord => ({
    userId, itemId: `${phase}-${i}`, taskKey: PRACTICE_TASK, phase, helpLevel: 'independent', synthetic: false, claimHit: hit, optionCorrect: null, at: NOW + i, appVersion: 1, ...over,
  })
  it('합성 · 골격 · 해설 먼저 · 적용 없는 기록은 빠진다', () => {
    expect(effectEligible(r('u', 'pre', true, 0, { synthetic: true }))).toBe(false)
    expect(effectEligible(r('u', 'pre', true, 0, { taskKey: SKELETON_TASK }))).toBe(false)
    expect(effectEligible(r('u', 'pre', true, 0, { helpLevel: 'viewed_first' }))).toBe(false)
    expect(effectEligible(r('u', 'pre', true, 0, { appVersion: null }))).toBe(false)
    expect(effectEligible(r('u', 'pre', true, 0))).toBe(true)
  })
  it('자격 학습자가 문턱 미만이면 판정하지 않는다 · 버전이 섞이면 거부', () => {
    const one = [0, 1, 2].flatMap((i) => [r('u1', 'pre', false, i), r('u1', 'post', true, 10 + i)])
    const res = evaluateProtocol(one)
    expect(res.verdict).toBe('insufficient_data')
    expect(res.nQualified).toBe(1)
    expect(() => evaluateProtocol([...one, r('u2', 'pre', true, 50, { appVersion: 2 })])).toThrow()
  })
  it('20명이 모두 사전 0 → 사후 1 이면 향상 · 문항당 첫 시도만(재제출은 세지 않는다)', () => {
    const rows = Array.from({ length: 20 }, (_, u) =>
      [0, 1, 2].flatMap((i) => [r(`u${u}`, 'pre', false, i), r(`u${u}`, 'pre', true, 100 + i, { itemId: `pre-${i}` }), r(`u${u}`, 'post', u % 5 !== 0, 10 + i)]),
    ).flat()
    const res = evaluateProtocol(rows)
    expect(res.metrics.preHit).toBe(0)
    expect(res.verdict).toBe('positive')
  })
})
