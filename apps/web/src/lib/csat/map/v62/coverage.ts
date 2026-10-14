// apps/web/src/lib/csat/map/v62/coverage.ts
//
// v6.2 §8 — 목표 지원 커버리지: 6 Ledger(서로 다른 분모) × 8 지원 공백. **플랫폼 지원 상태이지 학생 능력이 아니다.**
//   supported = 확인된 지원 · partial = 일부 · unsupported = 확인된 미지원 · unknown = 조회 · 검수 미실시(0 이 아니다).
// 입력은 V4View(제품 판정 결과)와 시험 카탈로그 대조 결과뿐 — 연구 coverage.json 의 unsupported 를 제품 unavailable 로 복사하지 않는다(§8.3).
// 상향 금지선: 정적 direct_check='live' 를 「평가 검증 완료」로 올리지 않는다(루브릭 R3 검증 전 → Assessment 최대 partial).
//             라인 수준 연결(legacy_line)은 문항 단위 검토 링크가 아니다 → TaskLink 최대 partial.
//             검증된 학습 효과가 없으므로 Verification 은 지연 · 독립 재확인 콘텐츠가 있어도 최대 partial.

import type { V4View } from '../v4/compose'
import { checkKeysOfTask, taskOf, tasks, templates, type TaskId } from '../v4/definition'
import { TRANSFER_PASSAGES } from '../v4/workspace'
import { CHECK_ITEMS, VERIFY_ITEMS } from '../skill-diagnosis'

import type { InventoryCoverage, SupportStatus } from './inventory'

export type LedgerKey = 'ExamInventoryCoverage' | 'ReasoningCoverage' | 'TaskLinkCoverage' | 'InstructionCoverage' | 'AssessmentCoverage' | 'GoalSupportCoverage'
export const LEDGERS: readonly LedgerKey[] = ['ExamInventoryCoverage', 'ReasoningCoverage', 'TaskLinkCoverage', 'InstructionCoverage', 'AssessmentCoverage', 'GoalSupportCoverage']

export type GapCode = 'CONCEPT_GAP' | 'ASSESSMENT_GAP' | 'LEVEL_GAP' | 'METHOD_GAP' | 'CONTENT_GAP' | 'EXECUTION_GAP' | 'TRANSFER_GAP' | 'VERIFICATION_GAP'
export const GAP_CODES: readonly GapCode[] = ['CONCEPT_GAP', 'ASSESSMENT_GAP', 'LEVEL_GAP', 'METHOD_GAP', 'CONTENT_GAP', 'EXECUTION_GAP', 'TRANSFER_GAP', 'VERIFICATION_GAP']

export interface LedgerCell {
  status: SupportStatus
  /** 분모 · 분자 — 셀 수 없으면 null(0 으로 채우지 않는다) */
  denominator: number | null
  numerator: number | null
  evidenceSource: string
  claimScope: string
}

export interface TaskCoverage {
  task: TaskId
  hold: boolean
  ledgers: Record<Exclude<LedgerKey, 'ExamInventoryCoverage'>, LedgerCell>
  gaps: GapCode[]
}

export interface GoalCoverageLedger {
  asOf: string
  definitionVersion: string
  /** 목표 기준 시험별 인벤토리(시험 단위 분모) */
  exams: InventoryCoverage[]
  examInventory: SupportStatus
  tasks: TaskCoverage[]
  /** 서로 다른 상태 차원 — 하나의 숫자로 합치지 않는다(§8.2 · §12.3) */
  dimensions: { researchUnverified: true; learningEffectUnmeasured: true }
}

const cell = (status: SupportStatus, evidenceSource: string, claimScope: string, numerator: number | null = null, denominator: number | null = null): LedgerCell => ({ status, numerator, denominator, evidenceSource, claimScope })

export interface CoverageInput {
  view: V4View
  /** 목표 기준 시험의 카탈로그 대조 결과 — 없으면 시험 인벤토리 unknown */
  exams: readonly InventoryCoverage[]
  /** 확인 과제 키 → 출시된 확인 문항 수(confirmLinks) */
  confirmItems: Record<string, number>
  /** 확인 과제 키 → 확인 묶음 밖 전이 문항 수 */
  transferItems: Record<string, number>
  /** 문항 단위로 검토된 TASK 링크 수(제품) — 지금 0. 연구 후보는 넣지 않는다 */
  reviewedLinks?: Record<TaskId, number>
  /** 기출 분석(의미 · 정답 · 오답 · 근거)이 공개된 기준 시험 문항 수 / 기준 시험 문항 수 — 모르면 null */
  reasoning?: { analyzed: number; total: number } | null
}

function worst(list: SupportStatus[]): SupportStatus {
  if (list.length === 0) return 'unknown'
  if (list.includes('unknown')) return 'unknown'
  if (list.every((s) => s === 'supported')) return 'supported'
  if (list.every((s) => s === 'unsupported')) return 'unsupported'
  return 'partial'
}

export function goalCoverageLedger(input: CoverageInput): GoalCoverageLedger {
  const { view } = input
  const examInventory = input.exams.length === 0 ? 'unknown' : worst(input.exams.map((e) => e.status))
  const reasoningCell: LedgerCell = !input.reasoning
    ? cell('unknown', 'none', '기준 시험 문항별 기출 분석 공개 범위 미조회')
    : cell(input.reasoning.analyzed === 0 ? 'unsupported' : input.reasoning.analyzed >= input.reasoning.total ? 'supported' : 'partial', 'csat analysis ledger', '공개 분석 문항 / 기준 시험 문항', input.reasoning.analyzed, input.reasoning.total)

  const out: TaskCoverage[] = tasks().map((def) => {
    const hold = def.status === 'hold'
    const keys = checkKeysOfTask(def.id)
    const confirm = keys.reduce((s, k) => s + (input.confirmItems[k] ?? 0), 0)
    const transfer = keys.reduce((s, k) => s + (input.transferItems[k] ?? 0), 0)
    const reviewed = input.reviewedLinks?.[def.id] ?? 0
    const asIs = view.asIs.tasks[def.id]
    const legacyLinked = view.toBe ? !view.toBe.relevanceUnknown.includes(def.id) && !view.toBe.notComputable.some((n) => n.task === def.id) : null
    const inTemplate = templates().some((w) => !w.hold && (w.core.includes(def.id) || w.support.includes(def.id)))
    const plan = view.taskPlans.find((p) => p.task === def.id)

    const taskLink: LedgerCell = hold
      ? cell('unsupported', 'definition', '정본 보류 TASK')
      : reviewed > 0
        ? cell('partial', 'human_review', '문항 단위 검토 링크 — 전 문항 검토 아님', reviewed, null)
        : legacyLinked === null
          ? cell('unknown', 'none', '목표 미설정 — 기준 시험 연결 미계산')
          : legacyLinked
            ? cell('partial', 'legacy_line', '기존 라인 수준 연결(문항 단위 검토 아님)')
            : cell('unknown', 'legacy_line', '기준 시험 문항과 연결 없음 — 관련성 미확인')
    const instruction: LedgerCell = hold
      ? cell('unsupported', 'definition', '정본 보류 TASK')
      : !inTemplate
        ? cell('unknown', 'definition', '학습 묶음(Template)에 들지 않음 — 교수 단위 미검토')
        : confirm > 0
          ? cell('partial', 'workspace', '확인 · 바로잡기 단계 실행 가능 — 교수 효과 미검증', confirm, null)
          : cell('unsupported', 'workspace', '출시된 학습 · 확인 콘텐츠 없음')
    const needed = VERIFY_ITEMS + CHECK_ITEMS
    const assessment: LedgerCell = hold
      ? cell('unsupported', 'definition', '정본 보류 TASK')
      : confirm === 0
        ? cell(def.direct_check === 'content_needed' || def.direct_check === 'blocked' ? 'unsupported' : 'unknown', 'confirm_links', '출시된 직접 확인 문항 0')
        // 루브릭 R3 검증 전이라 문항이 충분해도 partial 이 상한
        : cell('partial', 'confirm_links', `독립 확인 문항(확정 ${VERIFY_ITEMS} + 재확인 ${CHECK_ITEMS} 필요) · 루브릭 R3 검증 전`, confirm, needed)
    const goalSupport = cell(hold ? 'unsupported' : worst([examInventory, taskLink.status, instruction.status, assessment.status]), 'ledgers', '위 Ledger 의 최솟값 — 점수 · 숙달 확률 아님')

    const gaps: GapCode[] = []
    if (hold || taskLink.status !== 'partial') gaps.push('CONCEPT_GAP')
    if (assessment.status !== 'supported') gaps.push('ASSESSMENT_GAP')
    gaps.push('LEVEL_GAP') // 목표 · 현재 수준을 해석할 검증된 기준 없음(§5.2 U/S1~S4 자동 배정 금지)
    if (instruction.status !== 'partial' && instruction.status !== 'supported') gaps.push('METHOD_GAP')
    if (confirm === 0) gaps.push('CONTENT_GAP')
    if (hold || !plan?.next && (asIs.status === 'unmeasurable' || confirm === 0)) gaps.push('EXECUTION_GAP')
    if (transfer < TRANSFER_PASSAGES) gaps.push('TRANSFER_GAP')
    gaps.push('VERIFICATION_GAP') // 지연 재확인 · 학습 효과 측정 없음

    return { task: def.id, hold, ledgers: { ReasoningCoverage: reasoningCell, TaskLinkCoverage: taskLink, InstructionCoverage: instruction, AssessmentCoverage: assessment, GoalSupportCoverage: goalSupport }, gaps }
  })

  return {
    asOf: view.asIs.asOf,
    definitionVersion: view.asIs.canonVersion,
    exams: [...input.exams],
    examInventory,
    tasks: out,
    dimensions: { researchUnverified: true, learningEffectUnmeasured: true },
  }
}

/** 한 TASK 의 지원 공백 — 학생 실패 문구로 쓰지 않는다 */
export const GAP_LABEL: Record<GapCode, string> = {
  CONCEPT_GAP: '관련 기출 연결 검토 전',
  ASSESSMENT_GAP: '직접 확인 과제 · 채점 기준 부족',
  LEVEL_GAP: '수준 해석 기준 미정',
  METHOD_GAP: '학습 방법 검토 전',
  CONTENT_GAP: '학습 자료 준비 중',
  EXECUTION_GAP: '앱 안 실행 경로 없음',
  TRANSFER_GAP: '다른 글에 적용할 문항 부족',
  VERIFICATION_GAP: '다른 날 재확인 · 효과 측정 전',
}

export const isHoldTask = (id: TaskId) => taskOf(id).status === 'hold'
