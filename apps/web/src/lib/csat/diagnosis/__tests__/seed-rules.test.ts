// apps/web/src/lib/csat/diagnosis/__tests__/seed-rules.test.ts
//
// 시드 규칙 회귀(2026-10-08) — seed-v1 = 마이그레이션 값 그대로 · seed-v2 = 일반 규칙 4개.
// M2409 픽스처(문항 메타 · 에이전트 검수안 v2)로 일치율 · Tier 를 고정하고, 추천 근사가 실제 엔진 기록과 같은지 본다.
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { ATTRIBUTE_CODES } from '../engine/types'
import {
  FLOW_TYPES, SEED_RULES_V2, TYPE_BASE_V1, applyPerturbation, diffItem, rank, seedWeights, singlePerturbations, summarize,
  type TaggedItem, type Weights,
} from '../seed-rules'

const ROOT = path.resolve(__dirname, '../../../../../../..')
const pilot = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/csat/diagnosis/pilot', f), 'utf8'))
const meta = pilot('M2409-items.json') as { items: { no: number; type: string; points: number; choiceWords: number }[] }
const review = pilot('M2409-review.json') as { items: { no: number; w: Weights }[] }
const rw = (no: number) => review.items.find((r) => r.no === no)!.w

describe('seed-v1 = 마이그레이션 값', () => {
  it('csat_dx_type_attribute 시드(20261001150000 §8-3)와 한 칸도 다르지 않다', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261001150000_csat_diagnosis_mvp.sql'), 'utf8')
    const block = sql.slice(sql.indexOf('INSERT INTO public.csat_dx_type_attribute'), sql.indexOf(') v(t, a, w)'))
    const rows = [...block.matchAll(/\('([A-Z0-9-]+)','(A[1-9])',([0-2])\)/g)].map((m) => [m[1], m[2], Number(m[3])] as const)
    expect(rows.length).toBeGreaterThan(50)
    const fromSql: Record<string, Record<string, number>> = {}
    for (const [t, a, w] of rows) (fromSql[t] ??= {})[a] = w
    expect(fromSql).toEqual(TYPE_BASE_V1)
  })
})

describe('seed-v2 일반 규칙 4개', () => {
  const v2 = (type: string, choiceWords: number | null = 10) => seedWeights({ type, choiceWords }).weights
  it('R1 — 흐름 유형의 보조 A2 를 뗀다 · 흐름이 아닌 유형(함축 · 일치 · 어법)의 A2 는 그대로', () => {
    for (const t of ['R-ORDER', 'R-INSERT', 'R-REFER', 'X-REFER', 'R-BLANK']) expect(v2(t).A2).toBe(0)
    expect(v2('R-IMPLY').A2).toBe(1)
    expect(v2('R-FACT').A2).toBe(1)
    expect(v2('R-GRAMMAR').A2).toBe(1)
  })
  it('R1 — 핵심 A2(2)는 흐름 유형이어도 건드리지 않는다', () => {
    const rule = SEED_RULES_V2.find((r) => r.id === 'R1-flow-no-secondary-A2')!
    const w = { ...seedWeights({ type: 'R-ORDER', choiceWords: 5 }, 'seed-v1').weights, A2: 2 }
    rule.apply(w)
    expect(w.A2).toBe(2)
    expect(FLOW_TYPES).toContain('R-ORDER')
  })
  it('R2 — 빈칸 · 요약은 선지가 낱말(≤2)일 때만 A1=2, 구 · 절 선지와 모르는 형태(null)는 그대로', () => {
    expect(v2('R-BLANK', 1).A1).toBe(2)
    expect(v2('R-SUMMARY', 1).A1).toBe(2)
    expect(v2('R-BLANK', 12).A1).toBe(1)
    expect(v2('R-SUMMARY', null).A1).toBe(1)
    expect(v2('R-TOPIC', 1).A1).toBe(1) // 빈칸 · 요약이 아니면 선지 형태를 보지 않는다
  })
  it('R3 — 문맥 어휘는 A3=2', () => {
    expect(v2('R-VOCAB').A3).toBe(2)
    expect(v2('X-VOCAB').A3).toBe(2)
  })
  it('R4 — 대의 계열은 A3 최소 1(이미 1 이상이면 올리지 않는다) · 함축은 대상 아님', () => {
    expect(v2('R-MOOD').A3).toBe(1)
    expect(v2('R-CLAIM').A3).toBe(1)
    expect(v2('R-IMPLY').A3).toBe(0)
  })
  it('규칙은 유형 · 선지 형태만 본다 — 시험 · 문항 번호를 받지 않는다', () => {
    for (const r of SEED_RULES_V2) expect(r.applies.length).toBe(1)
    expect(Object.keys(seedWeights({ type: 'R-BLANK', choiceWords: 1 }).weights)).toEqual([...ATTRIBUTE_CODES])
  })
  it('모르는 유형은 전부 0 · 규칙 미적용', () => {
    const s = seedWeights({ type: 'Z-UNKNOWN', choiceWords: 1 })
    expect(Object.values(s.weights).every((v) => v === 0)).toBe(true)
    expect(s.rules).toEqual([])
  })
})

describe('M2409 — 시드를 처음부터 다시 만들어 검수안 v2 와 대조', () => {
  const diffs = (v: 'seed-v1' | 'seed-v2') => meta.items.map((m) => {
    const s = seedWeights({ type: m.type, choiceWords: m.choiceWords }, v)
    return diffItem(m.no, m.type, s.weights, rw(m.no), s.rules)
  })
  it('기준선 seed-v1: 그대로 승인 9/28 · 변경 28', () => {
    expect(summarize(diffs('seed-v1'))).toMatchObject({ items: 28, unchanged: 9, changes: 28 })
  })
  it('seed-v2: 그대로 승인 16/28 · 변경 15 · Tier 1/2/3 = 16/5/7', () => {
    const s = summarize(diffs('seed-v2'))
    expect(s).toMatchObject({ unchanged: 16, changes: 15, tiers: { 1: 16, 2: 5, 3: 7 } })
  })
  it('규칙이 v1 일치 문항을 깨지 않는다', () => {
    const before = diffs('seed-v1')
    const after = diffs('seed-v2')
    for (const b of before.filter((d) => d.tier === 1)) expect(after.find((a) => a.no === b.no)!.tier).toBe(1)
  })
})

describe('추천 근사 = 실제 엔진(map-evidence attributePoints · core 후보)', () => {
  const items: TaggedItem[] = meta.items.map((m) => ({ no: m.no, points: m.points, weights: rw(m.no) }))
  const P1 = new Set([19, 24, 29, 30, 31, 34, 40, 42])
  const P2 = new Set([20, 23, 32, 33, 35, 36, 37, 38, 39, 43, 44])
  it('2026-10-07 파일럿의 엔진 기록과 역량값이 같다(P1 A1 0.370 · A2 0.385 / P2 A3 0.479 · A4 0.576)', () => {
    const r1 = rank(items, P1)
    expect(r1.attr.A1).toBeCloseTo(0.3704, 3)
    expect(r1.attr.A2).toBeCloseTo(0.3846, 3)
    expect(r1.candidates).toEqual(['V', 'S'])
    const r2 = rank(items, P2)
    expect(r2.attr.A3).toBeCloseTo(0.4792, 3)
    expect(r2.attr.A4).toBeCloseTo(0.5758, 3)
    expect(r2.candidates[0]).toBe('R')
  })
  it('역량 가중치는 연결 여부로만 쓰인다 — 핵심(2)↔보조(1) 변경은 추천을 바꾸지 않는다', () => {
    for (const wrong of [P1, P2]) {
      const base = rank(items, wrong)
      for (const p of singlePerturbations(items).filter((x) => x.kind === 'core_change')) {
        expect(rank(applyPerturbation(items, p), wrong).candidates).toEqual(base.candidates)
      }
    }
  })
})
