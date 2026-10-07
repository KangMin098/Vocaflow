// apps/web/src/lib/csat/map/__tests__/axis-routing.test.ts
//
// 축 관측 특성 기반 routing 회귀(2026-10-08) — R · E 안정 1위 → 그 단계 · V 1위 → R/E 와 가르는 구분 확인(겹침으로 고름 · 동률이면 공통) ·
// X 1위 → 시간/내용 구분 · S → 다른 행동이 없을 때 직접 확인 · 불안정 → 구분 확인 · 근거 부족 → 기록 · 행동은 언제나 하나 · V 단독 추천 없음.
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { AXIS_EXAM_EVIDENCE, routeAction, vPartner } from '../axis-routing'
import { coreSummary } from '../core'
import { S_DIRECT, V_VS_RE, X_TITLE } from '../distinguish'
import { learnerPath } from '../learner-path'
import type { NodeValue } from '../model'

const SETTINGS = { core: { weak: 0.6, watch: 0.8 }, min_coverage: 0.5 }
const v = (achieved: number | null, n = 10, den = 20): NodeValue => ({ target: 1, achieved, status: 'short', coverage: null, n, den, points: 10 } as unknown as NodeValue)
const path_ = (nodes: Record<string, NodeValue>, vOverlap: { wrongV: number; R: number; E: number; X: number } | null = null, currentScore: number | null = 70) =>
  learnerPath({ nodes, currentScore, vOverlap }, SETTINGS)
// 기본: 모든 축 관찰 높음(S 는 관측 없음 — 평가원 단일 시험 꼴)
const base = { A1: v(0.9), A3: v(0.9), A4: v(0.9), A5: v(0.9), A9: v(0.9) }

describe('계약', () => {
  it('R · E 기출 관측 · V · X 보조 · S 직접 · L 범위 밖', () => {
    expect(AXIS_EXAM_EVIDENCE).toEqual({ R: 'exam_observable', E: 'exam_observable', V: 'exam_assisted', X: 'exam_assisted', S: 'direct_diagnostic', L: 'out_of_scope' })
  })
})

describe('routing', () => {
  it('R 안정 1위 → 문장 관계 단계(지금 동작 유지)', () => {
    expect(path_({ ...base, A3: v(0.3) }).focus).toMatchObject({ kind: 'step', step: 'relation' })
  })
  it('E 안정 1위 → 본문↔선지 단계', () => {
    expect(path_({ ...base, A4: v(0.3), A5: v(0.3) }).focus).toMatchObject({ kind: 'step', step: 'option' })
  })
  it('V 1위 + 틀린 V 문항이 R 과 더 겹침 → 어휘 ↔ 문장 관계 구분(V 단독 추천 아님)', () => {
    const f = path_({ ...base, A1: v(0.3) }, { wrongV: 6, R: 5, E: 2, X: 0 }).focus
    expect(f).toMatchObject({ kind: 'distinguish', step: 'vocab', rival: 'relation', title: '어휘 때문인지 글의 연결 때문인지 먼저 확인해 볼게요' })
  })
  it('V 1위 + E 와 더 겹침 → 어휘 ↔ 본문↔선지 구분', () => {
    const f = path_({ ...base, A1: v(0.3) }, { wrongV: 6, R: 1, E: 4, X: 0 }).focus
    expect(f).toMatchObject({ kind: 'distinguish', step: 'vocab', rival: 'option' })
  })
  it('V 1위 + R · E 겹침 같음 → 공통 구분 활동(세 단계 모두 「먼저 확인」)', () => {
    const p = path_({ ...base, A1: v(0.3) }, { wrongV: 6, R: 3, E: 3, X: 0 })
    expect(p.focus).toMatchObject({ kind: 'distinguish', step: 'vocab', rival: 'relation', also: 'option', activity: V_VS_RE })
    expect(p.read.filter((s) => s.evidence === 'focus').map((s) => s.key)).toEqual(['vocab', 'relation', 'option'])
  })
  it('V 1위 + 겹침 정보 없음(옛 스냅샷) → 순위 추정이 더 낮은 R/E 와 가른다(임의 선택 아님)', () => {
    expect(vPartner(null, { R: 0.7, E: 0.8 })).toEqual({ rival: 'R', also: null })
    expect(vPartner(null, { R: 0.8, E: 0.7 })).toEqual({ rival: 'E', also: null })
    expect(vPartner(null, { R: 0.8, E: 0.8 })).toEqual({ rival: 'R', also: 'E' })
  })
  it('X 1위 → 시간/내용 구분(시간 제한 없이 다시 풀기)', () => {
    const f = path_({ ...base, A9: v(0.3) }).focus
    expect(f).toMatchObject({ kind: 'distinguish', step: 'integrate', title: X_TITLE })
    if (f.kind === 'distinguish') expect(f.activity.how[0]).toMatch(/시간 제한 없이/)
  })
  it('S — 다른 행동이 없고 S 가 관측되지 않았고, 설명되지 않은 오답이 있으면(관찰 높음 선 아래 축) 직접 확인', () => {
    expect(path_({ ...base, A3: v(0.7) }).focus).toMatchObject({ kind: 'direct', step: 'sentence', activity: S_DIRECT })
  })
  it('S — 관찰된 축이 모두 높으면 직접 확인을 띄우지 않는다(모든 학생에게 S 부터 시키지 않는다)', () => {
    expect(path_(base).focus.kind).not.toBe('direct') // 지금 동작 그대로 「기록 더」(문장 이해 단계 근거 부족)
  })
  it('S 가 관측되면(누적 기록) 직접 확인을 띄우지 않는다', () => {
    expect(path_({ ...base, A3: v(0.7), A2: v(0.9), A8: v(0.9) }).focus.kind).toBe('none')
  })
  it('관찰된 축이 없으면(기록 얇음) 직접 확인보다 「기록 더」 · 기록이 없으면 「시험 기록」', () => {
    expect(path_({ A1: v(null, 3), A3: v(null, 3) }).focus.kind).toBe('more')
    expect(path_({}, null, null).focus).toEqual({ kind: 'record' })
  })
  it('불안정(동률)은 축 특성과 무관하게 구분 확인 — R ≈ E', () => {
    expect(path_({ ...base, A3: v(0.4), A4: v(0.41), A5: v(0.41) }).focus).toMatchObject({ kind: 'distinguish' })
  })
  it('verified 우선 — 지금은 전부 rule_proxy 라 routing 은 rule_proxy 에서만 돈다(우선순위 ① 자리)', () => {
    const s = coreSummary({ nodes: { ...base, A3: v(0.3) } }, SETTINGS)
    expect(s.basis).toBe('rule_proxy')
    expect(routeAction(s, null, { analyzable: true })).toMatchObject({ kind: 'step', axis: 'R' })
  })
})

describe('불변식', () => {
  it('V 를 단독 약점 단계로 보내는 경우가 없다 — V 가 1위인 여러 꼴', () => {
    for (const a1 of [0.1, 0.3, 0.5]) for (const ov of [null, { wrongV: 4, R: 4, E: 0, X: 0 }, { wrongV: 4, R: 0, E: 4, X: 1 }, { wrongV: 0, R: 0, E: 0, X: 0 }]) {
      const f = path_({ ...base, A1: v(a1) }, ov).focus
      expect(f.kind === 'step' && f.step === 'vocab').toBe(false)
    }
  })
  it('학생 화면 CTA 는 하나 — 「먼저 확인」 카드는 focus 하나만 그린다(LearnerMap 정적 검사)', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../../components/csat/diagnosis/map/LearnerMap.tsx'), 'utf8')
    expect((src.match(/data-testid="focus-cta"/g) ?? []).length).toBeGreaterThan(0)
    // 내부 용어가 학생 화면에 없다
    expect(src).not.toMatch(/exam_observable|exam_assisted|direct_diagnostic|confounded/)
  })
})
