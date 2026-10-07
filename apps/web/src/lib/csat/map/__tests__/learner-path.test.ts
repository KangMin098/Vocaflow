// apps/web/src/lib/csat/map/__tests__/learner-path.test.ts
//
// 학습자 학습 지도 회귀(2026-10-07) — 읽기 길 7단계 순서 · 듣기 분리 · 단계 ↔ 라인 대응(라인 하나는 한 단계) ·
// 근거 중심 상태(낮음/중간/높음 아님) · 먼저 확인할 것은 하나(+ 다음 하나) · 원인 확인 전에는 「직접 확인됨」 없음 ·
// 학생 메인 화면에 내부 용어가 없다.
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { FORBIDDEN_WORDS } from '../core'
import { ALL_STEPS, EVIDENCE_LABEL, JOURNEY, LISTEN_PATH, READ_PATH, STAGE_WORD, learnerPath } from '../learner-path'
import type { NodeValue } from '../model'
import { TASK_STAGE } from '../prescription'

const SETTINGS = { core: { weak: 0.6, watch: 0.8 }, min_coverage: 0.5 }
const v = (achieved: number | null, points = 10, n: number | null = 5): NodeValue => ({
  target: 1, achieved, status: achieved === null ? 'needs_diagnosis' : 'short', coverage: null, n, points,
} as unknown as NodeValue)
const model = (vals: Record<string, NodeValue>, currentScore: number | null = 74) => ({ nodes: vals, currentScore })
const MAP_DIR = path.resolve(__dirname, '../../../../components/csat/diagnosis/map')

describe('학습 길', () => {
  it('읽기 길 7단계 순서 · 듣기 4단계는 따로', () => {
    expect(READ_PATH.map((s) => s.name)).toEqual(['어휘·표현', '문장 이해', '문장 관계', '글 구조·핵심', '본문↔선지', '근거 판단', '시간 내 통합'])
    expect(LISTEN_PATH.map((s) => s.name)).toEqual(['소리 인식', '문장 이해', '정보 유지', '응답 판단'])
    expect(READ_PATH.every((s) => s.axis !== 'L')).toBe(true)
    expect(LISTEN_PATH.every((s) => s.axis === 'L')).toBe(true)
  })
  it('단계 ↔ 기존 라인: 라인 하나는 한 단계에만 · 실제 과제가 있는 라인만', () => {
    const lines = ALL_STEPS.flatMap((s) => s.lines)
    expect(new Set(lines).size).toBe(lines.length)
    const taskLines = new Set(Object.keys(TASK_STAGE).map((id) => id.split('-')[0]))
    for (const l of lines) expect(taskLines.has(l)).toBe(true)
    // 모든 단계에 「확인하기」 과제가 하나 이상 — 진단 전에 지금 할 일이 있다
    for (const s of ALL_STEPS) expect(Object.entries(TASK_STAGE).some(([id, st]) => st === 'FIND' && s.lines.includes(id.split('-')[0]))).toBe(true)
  })
})

describe('상태 · 먼저 확인할 것', () => {
  it('기록이 없으면 — 모든 단계 「기록 없음」, 먼저 할 일 = 시험 기록', () => {
    const p = learnerPath(model({}, null), SETTINGS)
    expect(p.read.every((s) => s.evidence === 'none')).toBe(true)
    expect(p.focus).toEqual({ kind: 'record' })
    expect(p.journey).toBe('observation')
  })
  it('관찰이 낮은 축이 있으면 — 그 축의 첫 단계 하나만 「먼저 확인」, 다음 후보 하나', () => {
    const vals = { A1: v(0.9), A2: v(0.85), A8: v(0.85), A3: v(0.4), A6: v(0.4), A4: v(0.5), A5: v(0.5), A9: v(0.7) }
    const p = learnerPath(model(vals), SETTINGS)
    expect(p.focus).toEqual({ kind: 'step', step: 'relation', next: 'option' })
    expect(p.read.filter((s) => s.evidence === 'focus').map((s) => s.key)).toEqual(['relation'])
    // 낮음/중간/높음이 아니라 근거 상태만
    expect(p.read.find((s) => s.key === 'vocab')?.evidence).toBe('observed')
    expect(p.journey).toBe('diagnostic_need')
  })
  it('기록은 있는데 분석된 문항이 0 이면 — 「분석 준비 중」, 더 기록하라고 하지 않는다', () => {
    const p = learnerPath(model({}, 74), SETTINGS)
    expect(p.focus).toEqual({ kind: 'pending' })
    expect(p.read.every((s) => s.evidence === 'pending')).toBe(true)
  })
  it('원인 확인(verified_diagnosis) 전에는 「직접 확인됨」 이 없다', () => {
    const p = learnerPath(model({ A1: v(0.3) }), SETTINGS)
    expect([...p.read, ...p.listen].some((s) => s.evidence === 'verified')).toBe(false)
  })
  it('학생 말 — 상태 · 여정 · 단계 이름에 판정 금지어 · 내부 용어가 없다', () => {
    const texts = [...Object.values(EVIDENCE_LABEL), ...JOURNEY.map((j) => j.label), ...Object.values(STAGE_WORD), ...ALL_STEPS.flatMap((s) => [s.name, s.what, s.why])]
    for (const t of texts) {
      expect(t).not.toMatch(FORBIDDEN_WORDS)
      expect(t).not.toMatch(/observation|diagnostic|prescription|FIND|REPAIR|TRANSFER|CHECK|낮음|중간|높음/)
    }
    expect(JOURNEY.map((j) => j.label)).toEqual(['기출에서 보인 모습', '먼저 확인할 것', '원인 확인', '맞춤 학습'])
    expect(STAGE_WORD).toEqual({ FIND: '확인하기', REPAIR: '바로잡기', TRANSFER: '다른 문제에 적용하기', CHECK: '다시 확인하기' })
  })
})

describe('학생 메인 화면(LearnerMap.tsx) — 내부 용어 없음', () => {
  it('라인 코드 · 현재 계산 · vNext · 54라인 호환 · 0.6/0.8 · 영어 단계 코드가 화면 글에 없다', () => {
    const src = fs.readFileSync(path.join(MAP_DIR, 'LearnerMap.tsx'), 'utf8')
    // 주석을 뺀 코드만 본다
    const code = src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
    for (const bad of [/현재 계산/, /vNext/, /54라인/, /호환/, /0\.6|0\.8/, /'(FIND|REPAIR|TRANSFER|CHECK)'/, /관찰 낮음|관찰 중간|관찰 높음/, /\b[A-J]\d{1,2}\b/]) {
      expect(code).not.toMatch(bad)
    }
  })
})
