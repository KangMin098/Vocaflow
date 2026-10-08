// apps/web/src/lib/csat/map/prescription.ts
//
// 처방 모델 — 관찰 → 진단 필요 → 처방, 그리고 처방 안의 FIND → REPAIR → TRANSFER → CHECK(LEARNING_MAP_VNEXT §14 · 2026-10-07 구현).
// 순수 함수 · 상수(DB · 시계 없음). 과제 단계는 이 파일의 대응표가 정본이다(과제 182 = 라인 54 × ord 1–3 + FIND 보강 ord 4 × 20).
//
// 책임 경계(층을 섞지 않는다):
//   관찰(observation)      — 지금 데이터에서 무엇이 보이는가(rule_proxy 카드 상태). 처방을 고르지 않는다.
//   진단 필요(diagnostic_need) — 무엇을 더 확인해야 하는가(우선 확인 후보 · 지금 필요한 진단). 과제를 확정하지 않는다.
//   처방(prescription)     — **verified_diagnosis 로 확인된 필요**에 학습 활동을 제시한다. 그 전에는 「처방」이라고 부르지 않는다.
// 관찰에서 처방으로 바로 가지 않는다 — 반드시 진단 필요를 거친다(nextPhase).
//
// 처방 안의 단계(과제 **사이** 순서 — 7단계 기출 분석 Protocol(과제 **안** 절차)과 다르다):
//   FIND     어느 처리 단계에서 깨졌나를 증거로 찾는다(측정 · 수집 · 분류 · 기록)
//   REPAIR   잘못된 처리를 고친다(풀어 쓰기 · 표시 · 절차 · 기초 보강 · 습관 세우기)
//   TRANSFER 같은 기제를 다른 문맥 · 문항으로 옮긴다(모음 풀이 · 새 글 · 실전 조건 · 배속)
//   CHECK    도움 없이 다시 확인한다(재풀이 · 시간이 지난 뒤 확인 · 결과 점검)
// 진단 전에도 FIND 활동은 쓸 수 있다 — 「어디서 막혔나 확인」은 진단을 돕는 활동이라 처방이 아니다.

import type { DiagnosisBasis } from './core'

export type PrescriptionStage = 'FIND' | 'REPAIR' | 'TRANSFER' | 'CHECK'
export const STAGE_ORDER: readonly PrescriptionStage[] = ['FIND', 'REPAIR', 'TRANSFER', 'CHECK']
// 학생 말(2026-10-07 학습자 관점 재구성) — 내부 코드 FIND/REPAIR/TRANSFER/CHECK 는 그대로
export const STAGE_LABEL: Record<PrescriptionStage, string> = { FIND: '확인하기', REPAIR: '바로잡기', TRANSFER: '다른 문제에 적용하기', CHECK: '다시 확인하기' }
export const STAGE_DESC: Record<PrescriptionStage, string> = {
  FIND: '어디서 막혔는지 근거로 찾아요',
  REPAIR: '잘못 처리한 부분을 고쳐요',
  TRANSFER: '다른 글 · 문항에 옮겨 써요',
  CHECK: '도움 없이 다시 확인해요',
}

/** 관찰 → 진단 필요 → 처방. 처방은 verified_diagnosis 뒤에만 */
export type PrescriptionPhase = 'observation' | 'diagnostic_need' | 'prescription'
export const PHASE_ORDER: readonly PrescriptionPhase[] = ['observation', 'diagnostic_need', 'prescription']

/**
 * 한 칸만 나아간다. 관찰 → 처방으로 건너뛰지 않는다.
 * 진단 필요 → 처방은 근거가 verified_diagnosis 일 때만(그 밖에는 진단 필요에 머문다).
 */
export function nextPhase(phase: PrescriptionPhase, basis: DiagnosisBasis): PrescriptionPhase {
  if (phase === 'observation') return 'diagnostic_need'
  if (phase === 'diagnostic_need') return basis === 'verified_diagnosis' ? 'prescription' : 'diagnostic_need'
  return 'prescription'
}

/** 근거 수준에서 다다를 수 있는 가장 앞 단계 — rule_proxy · item_tagged 는 진단 필요까지 */
export function reachablePhase(basis: DiagnosisBasis): PrescriptionPhase {
  return nextPhase(nextPhase('observation', basis), basis)
}

export interface ActivityFrame {
  phase: PrescriptionPhase
  /** 팝업 「학습 활동」 머리 문구 */
  title: string
  note: string
  /** 지금 「지금 해 볼 수 있는」 단계 — 진단 전에는 FIND 만 */
  open: readonly PrescriptionStage[]
}

/** 학습 활동 탭의 틀 — 처방이 확정 치료처럼 보이지 않게 근거 수준으로 문구 · 열린 단계를 정한다 */
export function activityFrame(basis: DiagnosisBasis): ActivityFrame {
  if (reachablePhase(basis) === 'prescription') {
    return { phase: 'prescription', title: '맞춤 학습', note: '원인이 확인된 단계에 맞춘 활동이에요. 확인하기 → 바로잡기 → 다른 문제에 적용하기 → 다시 확인하기 순서로 해요.', open: STAGE_ORDER }
  }
  return {
    phase: 'diagnostic_need',
    title: '지금 할 수 있는 것',
    note: '아직 원인을 확인하기 전이에요. 「확인하기」부터 해 보세요 — 원인이 확인되면 바로잡기 → 다른 문제에 적용하기 → 다시 확인하기로 이어져요.',
    open: ['FIND'],
  }
}

/**
 * 과제 → 단계 대응표(2026-10-07 · 에이전트 판정 v1 — 162개 제목 · 방법 · 완료 기준을 하나씩 읽고 정했다).
 * 판정 기준: 측정 · 수집 · 원인 분류 · 놓친 것 기록 = FIND / 풀어 쓰기 · 표시 · 절차 · 습관 세우기 · 기초 보강 · 다른 라인 과제 병행 = REPAIR /
 * 모음 풀이 · 새 글 · 다른 주제 · 실전 조건 · 배속 = TRANSFER / 재풀이 · 시간이 지난 뒤 다시 · 결과 확인 · 감소 추세 점검 = CHECK.
 * 다른 라인 과제로 보내는 과제는 LINKS 에도 적는다(그 자체가 새 능력 훈련이 아니라 연결이다).
 */
export const TASK_STAGE: Readonly<Record<string, PrescriptionStage>> = {
  'A1-1': 'FIND', 'A1-2': 'REPAIR', 'A1-3': 'CHECK',
  'A2-1': 'FIND', 'A2-2': 'REPAIR', 'A2-3': 'TRANSFER',
  // 문장 이해(S) 직접 확인 — 기출로 관측되지 않는 핵심 단계(axis-routing direct · 2026-10-08 승인 SQL proposed-20261008-s-direct-task.sql)
  'A2-4': 'FIND',
  'A3-1': 'REPAIR', 'A3-2': 'TRANSFER', 'A3-3': 'CHECK',
  'A4-1': 'REPAIR', 'A4-2': 'TRANSFER', 'A4-3': 'CHECK',
  'A5-1': 'REPAIR', 'A5-2': 'TRANSFER', 'A5-3': 'CHECK',
  'A6-1': 'FIND', 'A6-2': 'REPAIR', 'A6-3': 'TRANSFER',
  'A7-1': 'FIND', 'A7-2': 'REPAIR', 'A7-3': 'TRANSFER',
  'A8-1': 'FIND', 'A8-2': 'REPAIR', 'A8-3': 'REPAIR',
  'A9-1': 'FIND', 'A9-2': 'REPAIR', 'A9-3': 'TRANSFER',
  'B1-1': 'REPAIR', 'B1-2': 'TRANSFER', 'B1-3': 'FIND',
  'B2-1': 'REPAIR', 'B2-2': 'TRANSFER', 'B2-3': 'REPAIR',
  'B3-1': 'REPAIR', 'B3-2': 'TRANSFER', 'B3-3': 'FIND',
  'B4-1': 'REPAIR', 'B4-2': 'REPAIR', 'B4-3': 'CHECK',
  'B5-1': 'REPAIR', 'B5-2': 'TRANSFER', 'B5-3': 'FIND',
  'B6-1': 'REPAIR', 'B6-2': 'TRANSFER', 'B6-3': 'FIND',
  'B7-1': 'REPAIR', 'B7-2': 'REPAIR', 'B7-3': 'CHECK',
  'B8-1': 'REPAIR', 'B8-2': 'REPAIR', 'B8-3': 'TRANSFER',
  'B9-1': 'REPAIR', 'B9-2': 'REPAIR', 'B9-3': 'FIND',
  'B10-1': 'REPAIR', 'B10-2': 'FIND', 'B10-3': 'REPAIR',
  'B11-1': 'REPAIR', 'B11-2': 'REPAIR', 'B11-3': 'REPAIR',
  'B12-1': 'REPAIR', 'B12-2': 'REPAIR', 'B12-3': 'REPAIR',
  'B13-1': 'REPAIR', 'B13-2': 'REPAIR', 'B13-3': 'CHECK',
  'C1-1': 'REPAIR', 'C1-2': 'TRANSFER', 'C1-3': 'FIND',
  'C2-1': 'REPAIR', 'C2-2': 'TRANSFER', 'C2-3': 'FIND',
  'C3-1': 'REPAIR', 'C3-2': 'TRANSFER', 'C3-3': 'FIND',
  'C4-1': 'REPAIR', 'C4-2': 'TRANSFER', 'C4-3': 'FIND',
  'C5-1': 'REPAIR', 'C5-2': 'TRANSFER', 'C5-3': 'FIND',
  'C6-1': 'REPAIR', 'C6-2': 'TRANSFER', 'C6-3': 'FIND',
  'C7-1': 'REPAIR', 'C7-2': 'TRANSFER', 'C7-3': 'FIND',
  'C8-1': 'REPAIR', 'C8-2': 'TRANSFER', 'C8-3': 'REPAIR',
  'D1-1': 'REPAIR', 'D1-2': 'REPAIR', 'D1-3': 'CHECK',
  'D2-1': 'FIND', 'D2-2': 'REPAIR', 'D2-3': 'CHECK',
  'D3-1': 'REPAIR', 'D3-2': 'TRANSFER', 'D3-3': 'CHECK',
  'D4-1': 'FIND', 'D4-2': 'REPAIR', 'D4-3': 'CHECK',
  'D5-1': 'FIND', 'D5-2': 'REPAIR', 'D5-3': 'REPAIR',
  'D6-1': 'FIND', 'D6-2': 'CHECK', 'D6-3': 'FIND',
  'D7-1': 'FIND', 'D7-2': 'TRANSFER', 'D7-3': 'CHECK',
  'D8-1': 'FIND', 'D8-2': 'REPAIR', 'D8-3': 'TRANSFER',
  'D9-1': 'REPAIR', 'D9-2': 'REPAIR', 'D9-3': 'CHECK',
  'I1-1': 'FIND', 'I1-2': 'REPAIR', 'I1-3': 'REPAIR',
  'I2-1': 'FIND', 'I2-2': 'REPAIR', 'I2-3': 'REPAIR',
  'I3-1': 'FIND', 'I3-2': 'FIND', 'I3-3': 'FIND',
  'I4-1': 'TRANSFER', 'I4-2': 'FIND', 'I4-3': 'FIND',
  'I5-1': 'REPAIR', 'I5-2': 'TRANSFER', 'I5-3': 'TRANSFER',
  'I6-1': 'FIND', 'I6-2': 'REPAIR', 'I6-3': 'TRANSFER',
  'I7-1': 'REPAIR', 'I7-2': 'REPAIR', 'I7-3': 'TRANSFER',
  'I8-1': 'FIND', 'I8-2': 'REPAIR', 'I8-3': 'REPAIR',
  'I9-1': 'REPAIR', 'I9-2': 'FIND', 'I9-3': 'CHECK',
  'I10-1': 'REPAIR', 'I10-2': 'REPAIR', 'I10-3': 'REPAIR',
  'J1-1': 'REPAIR', 'J1-2': 'TRANSFER', 'J1-3': 'CHECK',
  'J2-1': 'REPAIR', 'J2-2': 'REPAIR', 'J2-3': 'CHECK',
  'J3-1': 'FIND', 'J3-2': 'TRANSFER', 'J3-3': 'CHECK',
  'J4-1': 'FIND', 'J4-2': 'REPAIR', 'J4-3': 'CHECK',
  'J5-1': 'TRANSFER', 'J5-2': 'REPAIR', 'J5-3': 'CHECK',
  // 2026-10-07 FIND 보강(ord 4) — 찾기 과제가 없던 라인 20개. 정본 scripts/csat/map/source/find-tasks-20261007.json(목적 · 관찰 신호 · 다음 단계)
  // 범위: Phase 1 · 기존 54라인용 보강이다 — A4 · D · I · J 일부는 vNext 에서 해체 · 이동 · 퇴출 대상이라 vNext 핵심 능력 정의로 읽지 않는다
  'A3-4': 'FIND', 'A4-4': 'FIND', 'A5-4': 'FIND', 'B2-4': 'FIND', 'B4-4': 'FIND',
  'B7-4': 'FIND', 'B8-4': 'FIND', 'B11-4': 'FIND', 'B12-4': 'FIND', 'B13-4': 'FIND',
  'C8-4': 'FIND', 'D1-4': 'FIND', 'D3-4': 'FIND', 'D9-4': 'FIND', 'I5-4': 'FIND',
  'I7-4': 'FIND', 'I10-4': 'FIND', 'J1-4': 'FIND', 'J2-4': 'FIND', 'J5-4': 'FIND',
}

/**
 * 다른 라인의 과제로 보내는 과제(연결) — 새 훈련이 아니라 그 라인으로 가라는 안내.
 * 값 = 보내는 라인, null = 「원인에 맞는 라인」(진단 결과에 따라 달라진다 — 미리 정하지 않는다)
 */
export const LINKS: Readonly<Record<string, string | null>> = {
  'B7-2': 'A4', 'B10-3': 'A2', 'B11-3': 'A3', 'B12-3': 'A4', 'C8-3': 'A4',
  'D2-2': 'A2', 'D5-2': 'J1', 'D9-2': 'A7',
  'D4-2': null, 'D6-3': null, 'I3-3': null,
}

/** 과제 단계 — 대응표에 없는 과제는 null(화면에 「단계 미정」 · 숨기지 않는다) */
export const stageOf = (taskId: string): PrescriptionStage | null => TASK_STAGE[taskId] ?? null

export interface StagedTask<T> {
  stage: PrescriptionStage | null
  open: boolean
  tasks: T[]
}

/** 과제를 단계 순서로 묶는다. 대응표에 없는 과제는 맨 뒤 「단계 미정」 묶음 */
export function groupByStage<T extends { id: string; ord: number }>(tasks: readonly T[], frame: ActivityFrame): StagedTask<T>[] {
  const out: StagedTask<T>[] = []
  for (const st of STAGE_ORDER) {
    const ts = tasks.filter((t) => stageOf(t.id) === st).sort((a, b) => a.ord - b.ord)
    if (ts.length) out.push({ stage: st, open: frame.open.includes(st), tasks: ts })
  }
  const rest = tasks.filter((t) => stageOf(t.id) === null)
  if (rest.length) out.push({ stage: null, open: false, tasks: rest })
  return out
}
