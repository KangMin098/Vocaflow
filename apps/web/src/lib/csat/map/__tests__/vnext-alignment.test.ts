// apps/web/src/lib/csat/map/__tests__/vnext-alignment.test.ts
//
// 학습 지도 vNext 정렬(2026-10-07 사용자 결정) 회귀 — 현재 Phase 1 화면이 vNext 방향과 어긋나는 말을 하지 않게 지킨다.
//   ① 표시명 = vNext 이름(문장 이해 · 글 이해 …)  ② 기존 라인 대응은 「현재 계산」이고 A4 · A6 는 vNext 와 다름을 밝힌다
//   ③ 54라인 상세 지도 = 기존 상세 지도  ④ 구분선은 표시 기준  ⑤ 오답 원인 ≠ 카드 상태  ⑥ 성장 경로는 점수 없이 순서만
//   + B/C/D/I/J 는 능력이 아님 · 과제 ≠ 능력 상태 · 목표 점수 = 시험 전략. 문구에는 판정 금지어가 없어야 한다.
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  AXIS_ROLE, CAUSE_NOTE, CORE_AXES, FORBIDDEN_WORDS, GOAL_STRATEGY_NOTE, GRADE_EXPOSURE_GUIDE, LEARNING_PROGRESSION, LEGACY_DETAIL_NOTE,
  LEGACY_PROXY_LABEL, TASK_NOTE, THRESHOLD_NOTE,
} from '../core'
import { READ_PATH } from '../learner-path'

const MAP_DIR = path.resolve(__dirname, '../../../../components/csat/diagnosis/map')
const read = (f: string) => fs.readFileSync(path.join(MAP_DIR, f), 'utf8')

describe('학습 지도 vNext 정렬', () => {
  it('① 핵심 카드 표시명은 vNext 이름', () => {
    expect(Object.fromEntries(CORE_AXES.map((a) => [a.code, a.name]))).toEqual({
      V: '어휘 · 표현', S: '문장 이해', R: '글 이해', E: '근거 · 선지 판단', L: '듣기', X: '실전 수행',
    })
  })

  it('② 기존 라인 대응은 「현재 계산」이고, vNext 에서 옮겨 가는 A6 · A4 는 카드에 밝힌다', () => {
    expect(LEGACY_PROXY_LABEL).toMatch(/현재 계산/)
    const R = CORE_AXES.find((a) => a.code === 'R')!
    const E = CORE_AXES.find((a) => a.code === 'E')!
    expect(R.lines).toContain('A6')
    expect(R.legacyNote).toMatch(/A6.*맥락 자원/)
    expect(E.legacyNote).toMatch(/A4/)
    // 학생 화면에 내부 용어(vNext)를 쓰지 않는다
    for (const a of CORE_AXES) expect(a.legacyNote ?? '').not.toMatch(/vNext/)
    // 현재 계산 라벨은 학생 메인이 아니라 단계 시트의 「상세 근거」 안에만(2026-10-07 학습자 관점 재구성)
    expect(read('StepSheet.tsx')).toContain('{LEGACY_PROXY_LABEL}')
    expect(read('LearnerMap.tsx')).not.toContain('LEGACY_PROXY_LABEL')
  })

  it('③ 54라인 화면은 「기출 상세 분석」 — 학습 순서가 아니라 판단 근거를 보는 곳', () => {
    expect(LEGACY_DETAIL_NOTE).toMatch(/기출 상세 분석/)
    expect(LEGACY_DETAIL_NOTE).toMatch(/학습 순서는 아니에요/)
    const main = read('LearnerMap.tsx')
    expect(main).toContain('기출 상세 분석')
    expect(main).not.toMatch(/기존 상세 지도|전체 지도 보기/)
    expect(read('MapScreen.tsx')).toContain('{LEGACY_DETAIL_NOTE}')
  })

  it('④ 관찰 구분선은 표시 기준 — 학생 메인에 내지 않고 상세 근거에만', () => {
    expect(THRESHOLD_NOTE).toMatch(/검증된 기준이 아니라/)
    expect(read('StepSheet.tsx')).toContain('{THRESHOLD_NOTE}')
    expect(read('LearnerMap.tsx')).not.toContain('THRESHOLD_NOTE')
  })

  it('⑤ 원인 확인 전에는 약점 · 처방을 확정하지 않는다 — 학생 말로', () => {
    expect(CAUSE_NOTE).toMatch(/바로 바뀌지 않아요/)
    expect(read('LearnerMap.tsx')).toContain('아직 약점으로 확정된 것은 아니에요')
  })

  it('⑥ 성장 경로 — 8단계 순서, 핵심 축 V · S · R · E · X 를 모두 지나고 값은 없다', () => {
    expect(LEARNING_PROGRESSION.map((p) => p.step)).toEqual([
      '어휘 · 표현', '문장 의미', '문장 관계', '글 구조', '중심 의미', '본문 ↔ 선지', '근거 판단', '시간 내 통합',
    ])
    const covered = new Set(LEARNING_PROGRESSION.flatMap((p) => p.axes))
    for (const c of ['V', 'S', 'R', 'E', 'X'] as const) expect(covered.has(c)).toBe(true)
    for (const p of LEARNING_PROGRESSION) expect(Object.keys(p).sort()).toEqual(['axes', 'step'])
  })

  it('B · C · D · I · J 영역은 능력 라벨을 달지 않는다', () => {
    for (const k of ['B', 'C', 'D', 'I', 'J']) {
      expect(AXIS_ROLE[k].role).not.toBe('ability_proxy')
      expect(AXIS_ROLE[k].label).not.toMatch(/능력$|역량/)
    }
    expect(AXIS_ROLE.B.label).toMatch(/측정 정보/)
    expect(AXIS_ROLE.C.label).toMatch(/문항 특성/)
    expect(AXIS_ROLE.D.label).toBe(AXIS_ROLE.I.label)
    expect(AXIS_ROLE.J.label).toMatch(/실전/)
  })

  it('팝업 — 「현 상태」 대신 「학습 활동」, 과제 ≠ 능력 상태 · 목표 점수 = 시험 전략', () => {
    const popup = read('NodePopup.tsx')
    expect(popup).toContain("label: '학습 활동'")
    expect(popup).not.toContain("label: '현 상태'")
    expect(popup).toContain('${TASK_NOTE}')
    expect(popup).toContain('GOAL_STRATEGY_NOTE')
    expect(TASK_NOTE).toMatch(/바뀌지 않아요/)
    expect(GOAL_STRATEGY_NOTE).toMatch(/시험 수행 전략/)
  })

  it('새 문구에는 판정 금지어(숙달 · 취약 · 달성 · 병목 …)가 없다', () => {
    const texts = [
      THRESHOLD_NOTE, CAUSE_NOTE, GOAL_STRATEGY_NOTE, TASK_NOTE, LEGACY_DETAIL_NOTE, LEGACY_PROXY_LABEL,
      ...CORE_AXES.flatMap((a) => [a.name, a.legacyNote ?? '']),
      ...LEARNING_PROGRESSION.map((p) => p.step),
      ...Object.values(AXIS_ROLE).flatMap((r) => [r.label, r.desc]),
    ]
    for (const t of texts) expect(t).not.toMatch(FORBIDDEN_WORDS)
  })

  // ── T-0019 학년별 권장 참고(정본 rev2.1 §15) ──
  const LIB = path.resolve(__dirname, '..')
  const lib = (f: string) => fs.readFileSync(path.join(LIB, f), 'utf8')

  it('T0 학교급별 LP 배열이 정본 §15 그대로', () => {
    const by = Object.fromEntries(GRADE_EXPOSURE_GUIDE.bands.map((b) => [b.stage, { main: [...b.main], preview: [...b.preview] }]))
    expect(by).toEqual({
      upper_elementary: { main: ['LP1', 'LP2'], preview: ['LP3'] },
      middle: { main: ['LP2', 'LP3', 'LP4'], preview: [] },
      high: { main: ['LP3', 'LP4', 'LP5', 'LP6', 'LP7'], preview: [] },
    })
  })

  it('T1 축은 CORE_AXES 식별자만 참조한다(복제 정의 없음)', () => {
    const codes = new Set(CORE_AXES.map((a) => a.code))
    for (const b of GRADE_EXPOSURE_GUIDE.bands) for (const c of [...b.axes, ...b.earlyAxes]) expect(codes.has(c)).toBe(true)
    // core.ts 안에 축 코드 목록을 새로 만든 곳이 CORE_AXES · CoreCode 외에 없다
    expect(lib('core.ts').split("'V' | 'S' | 'R' | 'E' | 'L' | 'X'").length - 1).toBe(1)
  })

  it('T2 참고(advisory) · 출처 버전만 — 범위 계산 · 단계 키 · 진단 상태 · 잠금 · 완료 값이 없다', () => {
    expect(GRADE_EXPOSURE_GUIDE.advisory).toBe(true)
    expect(GRADE_EXPOSURE_GUIDE.source).toBe('LEARNING_MAP_VNEXT rev2.1 §15')
    const json = JSON.stringify(GRADE_EXPOSURE_GUIDE)
    expect(json).not.toMatch(/"(start|end|from|to|step|stepKey|status|state|locked?|lock|done|complete[d]?|evidence)"/)
    const stepKeys = new Set(READ_PATH.map((s) => s.key as string))
    for (const b of GRADE_EXPOSURE_GUIDE.bands) for (const lp of [...b.main, ...b.preview]) expect(stepKeys.has(lp)).toBe(false)
  })

  it('T3 지도는 세 학교급을 모두 보이고 참고 · 진단 결정 · 듣기 별도 문구를 화면과 접근성 트리에 둔다', () => {
    const main = read('LearnerMap.tsx')
    expect(main).toContain('GRADE_EXPOSURE_GUIDE.bands.map(')
    expect(main).toMatch(/aria-labelledby="grade-guide-h"/)
    expect(main).toContain('학년별 권장 참고')
    expect(main).toContain('실제 경로는 진단 결과가 결정')
    expect(main).toContain('듣기는 별도 트랙')
  })

  it('T4 학교급은 카드 표시 · 학습 길 · 행동 계산에 들어가지 않는다(숨김 · 비활성 · 재정렬 · 강조 없음)', () => {
    const main = read('LearnerMap.tsx')
    // 단계 카드는 학교급 값을 받지 않는다
    expect(main).toContain('function StepNode({ s, i, last, onOpen }')
    expect(main).not.toMatch(/exposureOf|SchoolBand|data-band|step-exposure/)
    for (const f of ['learner-path.ts', 'axis-routing.ts', 'skill-diagnosis.ts', 'curriculum.ts']) {
      expect(lib(f)).not.toMatch(/GRADE_EXPOSURE_GUIDE|SchoolStage/)
    }
  })

  it('T6 정본 LP 배열 · 성장 경로 8단계 · 읽기 길 7단계는 서로 다른 계약이다', () => {
    const lps = new Set(GRADE_EXPOSURE_GUIDE.bands.flatMap((b) => [...b.main, ...b.preview]))
    expect([...lps].sort()).toEqual(['LP1', 'LP2', 'LP3', 'LP4', 'LP5', 'LP6', 'LP7'])
    expect(LEARNING_PROGRESSION).toHaveLength(8)
    expect(READ_PATH).toHaveLength(7)
    // LP 이름이 성장 경로 단계명 · 읽기 길 키로 쓰이지 않는다(같은 배열로 취급 금지)
    for (const lp of lps) {
      expect(LEARNING_PROGRESSION.some((p) => p.step === lp)).toBe(false)
      expect(READ_PATH.some((s) => s.key === lp || s.name === lp)).toBe(false)
    }
  })
})
