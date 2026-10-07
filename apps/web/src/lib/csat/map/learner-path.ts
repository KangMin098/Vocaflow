// apps/web/src/lib/csat/map/learner-path.ts
//
// 학습자 학습 지도 — 화면에 보이는 「영어 실력이 만들어지는 길」(2026-10-07 사용자 지시 · 학습자 관점 재구성).
// **새 taxonomy 가 아니다.** 지금 Phase 1 데이터(핵심 축 V/S/R/E/L/X 관찰 · 기존 54라인 과제 182)를 학생이 이해하는 순서로 보여 주는 표현 층이다.
//   · 읽기 길 7단계 — 단어 → 문장 → 문장 관계 → 글 → 선지 → 근거 → 실전. 듣기는 억지로 합치지 않고 보조 트랙 4단계.
//   · 단계 상태는 근거 중심(기록 없음 · 기록 더 필요 · 기출에서 관찰됨 · 먼저 확인 · 직접 확인됨) — 낮음/중간/높음은 메인에 내지 않는다
//     (0.6 · 0.8 은 교육적 기준이 아닌 표시 기준이라 실력 판정처럼 읽히면 안 된다).
//   · 내부 판정 순서 observation → diagnostic_need → verified_diagnosis → prescription 은 그대로(core.ts · prescription.ts) — 학생 말로만 옮긴다.
//   · 단계 ↔ 기존 라인 대응은 과제를 꺼내 오는 표현용 묶음이다. 라인 하나는 한 단계에만 들어간다(테스트가 지킨다).
// 순수 함수 · 상수(DB · 시계 없음).

import { coreSummary, type CoreAxisView, type CoreCode, type CoreSummary, type DiagnosisBasis } from './core'
import type { MapModel, MapSettings } from './model'
import type { PrescriptionStage } from './prescription'
import { distinguishActivity, distinguishTitle, type DistinguishActivity } from './distinguish'

export type StepKey = 'vocab' | 'sentence' | 'relation' | 'structure' | 'option' | 'evidence' | 'integrate' | 'l-sound' | 'l-sentence' | 'l-retain' | 'l-respond'

export interface PathStep {
  key: StepKey
  track: 'read' | 'listen'
  name: string
  /** 한 줄 — 이 힘이 무엇인가 */
  what: string
  /** 수능에서 왜 중요한가 */
  why: string
  /** 관찰 상태를 빌려 오는 핵심 축(Phase 1 rule_proxy) */
  axis: CoreCode
  /** 과제를 꺼내 오는 기존 라인(표현용 묶음) */
  lines: string[]
}

export const READ_PATH: readonly PathStep[] = [
  { key: 'vocab', track: 'read', name: '어휘·표현', axis: 'V', lines: ['A1', 'I6', 'B9'],
    what: '단어와 표현의 뜻을 문장 속에서 바로 떠올리는 힘', why: '모르는 단어 하나가 문장 전체 해석을 막아요. 모든 다음 단계의 재료예요.' },
  { key: 'sentence', track: 'read', name: '문장 이해', axis: 'S', lines: ['A2', 'A8', 'I2', 'D4'],
    what: '문장의 뼈대를 잡아 누가 무엇을 했는지 정확히 읽는 힘', why: '긴 문장 · 명사화 · 삽입이 많은 수능 문장은 뼈대를 놓치면 뜻이 뒤집혀요.' },
  { key: 'relation', track: 'read', name: '문장 관계', axis: 'R', lines: ['A3', 'B11'],
    what: '앞뒤 문장이 같은 말인지 · 반대인지 · 원인과 결과인지 잇는 힘', why: '순서 · 삽입 · 무관한 문장 문항이 바로 이 연결을 묻고, 빈칸도 연결로 풀려요.' },
  { key: 'structure', track: 'read', name: '글 구조·핵심', axis: 'R', lines: ['B6', 'B7', 'I5', 'I8'],
    what: '글 전체가 어떻게 흘러가는지 보고 필자의 핵심을 한 줄로 잡는 힘', why: '주제 · 요지 · 제목 · 함축 문항은 글 전체의 핵심을 묻는 문항이에요.' },
  { key: 'option', track: 'read', name: '본문↔선지', axis: 'E', lines: ['A4', 'B10', 'B12', 'C1', 'C3', 'C5', 'C6', 'C8', 'I10'],
    what: '선지가 본문의 어떤 말을 바꿔 쓴 것인지 맞춰 보는 힘', why: '정답 선지는 본문을 다른 말로 바꿔 쓰고, 오답 선지는 그 말을 살짝 비틀어요.' },
  { key: 'evidence', track: 'read', name: '근거 판단', axis: 'E', lines: ['A5', 'B8', 'C2', 'C4', 'C7', 'D1', 'D3', 'I9'],
    what: '고른 답의 이유를 지문 문장에서 찾아 확인하는 힘', why: '상식이나 느낌이 아니라 지문 근거로 고를 때 매력적인 오답을 피할 수 있어요.' },
  { key: 'integrate', track: 'read', name: '시간 내 통합', axis: 'X', lines: ['A9', 'B13', 'J1', 'J2', 'J3', 'J4', 'J5', 'D5', 'I4'],
    what: '정해진 시간 안에 앞의 과정을 끝까지 해내는 힘', why: '알아도 시간이 모자라면 점수가 되지 않아요. 마지막 단계는 실전 운영이에요.' },
]

export const LISTEN_PATH: readonly PathStep[] = [
  { key: 'l-sound', track: 'listen', name: '소리 인식', axis: 'L', lines: ['A7', 'I7', 'D9'],
    what: '빠르게 이어지는 소리를 단어로 알아듣는 힘', why: '연음 · 속도에서 놓친 소리는 뒤의 이해까지 끊어요.' },
  { key: 'l-sentence', track: 'listen', name: '문장 이해', axis: 'L', lines: ['B4'],
    what: '들은 문장의 뜻을 바로 잡는 힘', why: '짧은 대화 응답은 마지막 한 문장으로 결정돼요.' },
  { key: 'l-retain', track: 'listen', name: '정보 유지', axis: 'L', lines: ['B2', 'B3', 'B5'],
    what: '들은 정보(숫자 · 조건 · 순서)를 기억해 두는 힘', why: '그림 · 계산 · 세트 문항은 앞에서 들은 정보를 끝까지 들고 가야 해요.' },
  { key: 'l-respond', track: 'listen', name: '응답 판단', axis: 'L', lines: ['B1'],
    what: '들은 내용의 목적 · 의견을 판단하는 힘', why: '대의 문항은 세부가 아니라 말하는 사람의 목적을 물어요.' },
]

export const ALL_STEPS: readonly PathStep[] = [...READ_PATH, ...LISTEN_PATH]

/** 학생에게 보이는 단계 상태 — 근거 중심. 실력 수준 낱말을 쓰지 않는다 */
export type StepEvidence = 'none' | 'pending' | 'more' | 'observed' | 'focus' | 'verified'
export const EVIDENCE_LABEL: Record<StepEvidence, string> = {
  none: '기록 없음',
  pending: '분석 준비 중',
  more: '기록 더 필요',
  observed: '기출에서 관찰됨',
  focus: '먼저 확인',
  verified: '직접 확인됨',
}

/** 내부 판정 순서 → 학생 말(구조는 그대로, 이름만 옮긴다) */
export const JOURNEY: readonly { phase: 'observation' | 'diagnostic_need' | 'verified_diagnosis' | 'prescription'; label: string }[] = [
  { phase: 'observation', label: '기출에서 보인 모습' },
  { phase: 'diagnostic_need', label: '먼저 확인할 것' },
  { phase: 'verified_diagnosis', label: '원인 확인' },
  { phase: 'prescription', label: '맞춤 학습' },
]

/** 처방 단계 → 학생 말 */
export const STAGE_WORD: Record<PrescriptionStage, string> = {
  FIND: '확인하기',
  REPAIR: '바로잡기',
  TRANSFER: '다른 문제에 적용하기',
  CHECK: '다시 확인하기',
}

export interface StepView extends PathStep {
  evidence: StepEvidence
  axisView: CoreAxisView
}

/** 지금 먼저 확인할 것 — 하나만(+ 다음 후보 하나). 원인 확정이 아니다 */
export type Focus =
  | { kind: 'step'; step: StepKey; next: StepKey | null }
  /** 1위를 믿을 수 없다(core RANKING_GATE) — 두 단계를 가르는 확인 하나. 약점을 정하지 않는다 */
  | { kind: 'distinguish'; step: StepKey; rival: StepKey; activity: DistinguishActivity; title: string }
  | { kind: 'record' }            // 기록이 없다 — 시험 기록부터
  | { kind: 'more'; step: StepKey } // 기록은 있지만 이 단계 근거가 모자라다 — 기록을 더 쌓는다
  | { kind: 'pending' }           // 기록은 받았지만 그 시험들의 단계별 분석이 아직 준비되지 않았다 — 더 기록해도 바뀌지 않는다
  | { kind: 'none' }              // 지금 근거로 먼저 확인할 단계가 없다

export interface LearnerPath {
  read: StepView[]
  listen: StepView[]
  focus: Focus
  /** 학생 여정에서 지금 위치(JOURNEY 의 phase) */
  journey: (typeof JOURNEY)[number]['phase']
  basis: DiagnosisBasis
  summary: CoreSummary
}

/** hasRecords: 시험 기록이 있는가 · analyzable: 그 기록 중 단계별로 분석된 것이 하나라도 있는가 */
const evidenceOf = (a: CoreAxisView, hasRecords: boolean, analyzable: boolean): StepEvidence =>
  a.basis === 'verified_diagnosis'
    ? 'verified'
    : a.status === 'no_data'
      ? hasRecords && !analyzable ? 'pending' : 'none'
      : a.status === 'insufficient'
        ? a.contributions > 0 ? 'more' : hasRecords ? (analyzable ? 'more' : 'pending') : 'none'
        : 'observed'

/**
 * 학습자 길 계산. 먼저 확인할 단계는 핵심 지도의 「우선 확인 후보」(관찰값 기준 · 목표 점수와 무관)를 그대로 쓴다 —
 * 축 → 그 축의 읽기 길 첫 단계. 후보가 없으면 기록 여부로 「시험 기록」 · 「기록 더 쌓기」 · 「없음」.
 */
export function learnerPath(model: Pick<MapModel, 'nodes' | 'currentScore'>, settings: Pick<MapSettings, 'core' | 'min_coverage'>): LearnerPath {
  const summary = coreSummary(model, settings)
  const byAxis = new Map(summary.axes.map((a) => [a.code, a]))
  const firstStepOf = (axis: CoreCode) => READ_PATH.find((s) => s.axis === axis)?.key ?? null
  const cand = summary.candidates.map(firstStepOf).filter((k): k is StepKey => k !== null)
  const hasRecords = model.currentScore !== null
  // 기록이 있어도 단계별 분석에 쓰인 문항이 0 이면(분석 준비 안 된 시험만 기록) — 더 기록하라고 하지 않는다
  const analyzable = summary.axes.some((a) => a.contributions > 0)

  let focus: Focus
  const r = summary.ranking
  const pair = r.kind === 'unstable' && r.top && r.rival ? { a: firstStepOf(r.top), b: firstStepOf(r.rival), act: distinguishActivity(r.top, r.rival) } : null
  if (pair && pair.a && pair.b && pair.act) focus = { kind: 'distinguish', step: pair.a, rival: pair.b, activity: pair.act, title: distinguishTitle(r.top as CoreCode, r.rival as CoreCode) }
  else if (cand.length > 0) focus = { kind: 'step', step: cand[0], next: cand[1] ?? null }
  else if (!hasRecords) focus = { kind: 'record' }
  else if (!analyzable) focus = { kind: 'pending' }
  else {
    const thin = READ_PATH.find((s) => evidenceOf(byAxis.get(s.axis) as CoreAxisView, hasRecords, analyzable) !== 'observed')
    focus = thin ? { kind: 'more', step: thin.key } : { kind: 'none' }
  }
  const view = (s: PathStep): StepView => {
    const axisView = byAxis.get(s.axis) as CoreAxisView
    const focused = (focus.kind === 'step' && focus.step === s.key) || (focus.kind === 'distinguish' && (focus.step === s.key || focus.rival === s.key))
    return { ...s, axisView, evidence: focused ? 'focus' : evidenceOf(axisView, hasRecords, analyzable) }
  }
  const journey = summary.basis === 'verified_diagnosis' ? 'verified_diagnosis' : focus.kind === 'step' || focus.kind === 'distinguish' ? 'diagnostic_need' : 'observation'
  return { read: READ_PATH.map(view), listen: LISTEN_PATH.map(view), focus, journey, basis: summary.basis, summary }
}

export const stepByKey = (k: StepKey): PathStep => ALL_STEPS.find((s) => s.key === k) as PathStep
