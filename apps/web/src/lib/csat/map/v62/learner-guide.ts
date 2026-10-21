// apps/web/src/lib/csat/map/v62/learner-guide.ts
//
// R5 끝단 경로(§5 §7 §8) — TASK Inspector 가 학습자 말로 보여 줄 「지금 필요한 능력 · 자료 준비 단계 · 출제 원리 경로 · 복귀 요약」(순수 함수).
// 판정하지 않는다: 이미 계산된 값(AsIsTask.check · supplyFor · supplyStep · studyItemsFor · returnNotes)을 학습자 범주로 나눌 뿐이다.
// 원칙: 숙달 % 를 만들지 않는다 · 측정 안 한 것은 「측정 전」 · 검수 전 자료를 정식 공급처럼 세지 않는다 · 수행량 ≠ 독립 근거.

import type { AsIsTask } from '../v4/as-is'
import type { MaterialRole } from './demand'
import { REASON_LABEL } from '../v4/plan-commit'
import type { ReturnNote } from './return-ctx'
import { LATEST_LABEL, transferLine, type ReturnRecap } from './return-recap'
import type { StudyItem } from './study-items'
import type { SupplyStep } from './supply-ledger'

/** 자료 준비 범주 — 서로 섞지 않는다(학습자 쪽 진행 상태는 `ProgressBucket` 으로 따로) */
export type SupplyBucket = 'qualified' | 'content_gap' | 'unreviewed' | 'release_wait' | 'in_production' | 'delivered'

export const SUPPLY_BUCKET_LABEL: Record<SupplyBucket, string> = {
  qualified: '검수된 자료 있음',
  content_gap: '콘텐츠 부족',
  unreviewed: '자격 검수 전',
  release_wait: '출시 승인 대기',
  in_production: '주문 · 생산 중',
  delivered: '납품 완료',
}

export function supplyBucket(step: SupplyStep): SupplyBucket {
  switch (step) {
    case 'learn_now':
      return 'qualified'
    // 유효 납품이 확인된 경우만 「납품 완료」. 부분 납품은 아직 채우는 중, 유효 수량 미확인은 검수 전으로 둔다(정식 공급으로 세지 않는다)
    case 'delivered':
      return 'delivered'
    case 'partially_delivered':
      return 'in_production'
    case 'delivered_count_unknown':
      return 'unreviewed'
    case 'release_wait':
      return 'release_wait'
    case 'ordered':
    case 'producing':
    case 'reviewing':
    case 'held':
      return 'in_production'
    case 'read_now':
    case 'open_unqualified':
    case 'stock_review_wait':
    case 'needs_review':
      return 'unreviewed'
    case 'not_ready':
    case 'orderable':
      return 'content_gap'
  }
}

/** 학습자 쪽 진행 — 자료 범주와 다른 축 */
export type ProgressBucket = 'not_measured' | 'practice_done' | 'independent_evidence' | 'goal_unconfirmable'

export const PROGRESS_LABEL: Record<ProgressBucket, string> = {
  not_measured: '아직 측정 전',
  practice_done: '학습 수행 완료(독립 근거 아님)',
  independent_evidence: '독립 수행 근거 확보',
  goal_unconfirmable: '목표 도달 확인 불가',
}

export interface AbilityNow {
  progress: ProgressBucket[]
  /** 학습자 문장 — 숫자는 기록에서 센 문항 수만 */
  lines: string[]
}

/**
 * 지금 필요한 능력과 이유 — 목표(need) 대비 근거(check) 차이를 문장으로. 점수 · 숙달 % 없음.
 * `assessmentQualified` = 독립 확인 · 전이 역할에 정식 자격 공급이 하나라도 있는가. 없으면 목표 도달은 확인할 수 없다고 말한다.
 */
export function abilityNow(input: { check: AsIsTask['check']; needed: boolean; goalSet: boolean; assessmentQualified: boolean }): AbilityNow {
  const { check, needed, goalSet, assessmentQualified } = input
  const progress: ProgressBucket[] = []
  const lines: string[] = []
  const attempted = check?.attemptedItems ?? 0
  const independent = check?.independentItems ?? 0
  if (!goalSet) lines.push('목표를 정하지 않아 이 능력이 목표에 얼마나 필요한지는 아직 말할 수 없어요.')
  else lines.push(needed ? '저장한 목표의 기준 시험에서 이 능력을 쓰는 문항이 있어 지금 필요해요.' : '저장한 목표에서 이 능력을 먼저 요구하지는 않아요.')
  if (attempted === 0 && independent === 0) {
    progress.push('not_measured')
    lines.push('이 능력은 아직 직접 확인한 기록이 없어요 — 측정 전이지, 부족하다는 뜻이 아니에요.')
  } else {
    if (attempted > independent) {
      progress.push('practice_done')
      lines.push(`확인 문항 ${attempted}개를 풀었어요. 그중 해설을 먼저 보지 않고 처음 혼자 푼 것만 독립 근거로 셉니다.`)
    }
    if (independent > 0) {
      progress.push('independent_evidence')
      lines.push(`처음 보는 문항을 혼자 푼 독립 근거 ${independent}개가 있어요.`)
    }
  }
  if (!assessmentQualified) {
    progress.push('goal_unconfirmable')
    lines.push('정식 자격을 확인한 확인 · 전이 문항이 아직 없어 목표에 도달했는지는 확인할 수 없어요.')
  }
  return { progress, lines }
}

/** 정식 공급이 0일 때의 구체적 다음 행동 — 없으면 null(정식 공급이 있다) */
export interface FallbackAction {
  kind: 'read_explanation' | 'practice_unqualified' | 'wait'
  text: string
}

export function fallbackActions(lines: readonly { role: MaterialRole; bucket: SupplyBucket }[], hasStudyItem: boolean): FallbackAction[] | null {
  if (lines.some((l) => l.bucket === 'qualified' || l.bucket === 'delivered')) return null
  const out: FallbackAction[] = []
  if (hasStudyItem) out.push({ kind: 'read_explanation', text: '연결된 기존 해설(내가 푼 확인 문항 또는 AI 연구 사례)을 아래 출제 원리 순서대로 읽어 보세요(수업용 검수 전 자료예요).' })
  if (lines.some((l) => l.bucket === 'unreviewed' && (l.role === 'independent_check' || l.role === 'transfer' || l.role === 'guided_practice')))
    out.push({ kind: 'practice_unqualified', text: '기존 과제로 연습할 수 있어요 — 다만 정식 자격 확인 전이라 독립 근거로는 세지 않아요.' })
  if (out.length === 0) out.push({ kind: 'wait', text: '지금 열 수 있는 자료가 없어요. 자료가 준비되면 이 자리에 표시돼요 — 학생의 부족이 아니에요.' })
  return out
}

/** §7 출제 원리 경로 — 기존 해설 극장의 장면으로 순서대로 잇는다 */
export interface PrincipleStep {
  id: 'measures' | 'relations' | 'answer' | 'distractor' | 'explain' | 'transfer'
  label: string
  /** 해설 극장 쿼리(장면) — 전이는 해설이 아니라 새 지문 과제라 null */
  query: string | null
}

export const PRINCIPLE_STEPS: readonly PrincipleStep[] = [
  { id: 'measures', label: '이 문항이 재는 것', query: 'scene=task' },
  { id: 'relations', label: '주장 · 근거 · 관계', query: 'scene=meaning' },
  { id: 'answer', label: '정답이 되는 이유', query: 'scene=judgment&judgmentView=answer' },
  { id: 'distractor', label: '오답 설계', query: 'scene=judgment&judgmentView=options' },
  { id: 'explain', label: '내 말로 설명해 보기', query: 'scene=explain' },
  { id: 'transfer', label: '처음 보는 지문에 적용', query: null },
]

/** 출제 원리 경로의 기준 문항 — 이미 푼 확인 문항을 먼저(노출 규칙상 안전), 없으면 연구 사례 */
export function principleItem(items: readonly StudyItem[]): StudyItem | null {
  return items.find((i) => i.basis === 'attempted_check_item') ?? items[0] ?? null
}

export const isAiOnly = (s: StudyItem) => s.basis === 'research_case'

/** §8 복귀 요약 — 이 TASK 로 돌아왔을 때만 */
export function returnSummary(input: {
  check: AsIsTask['check']
  taskDisplay: string
  /** T-0062 — 가장 최근 기록 · 적용 0/일부/완료/확인 불가 · 저장 계획 버전과 지금 제안(return-recap) */
  recap: ReturnRecap
  remaining: string
  nextLabel: string | null
  notes: readonly ReturnNote[]
  planVersion: number | null
  goalVersion: number | null
}): string[] {
  const { check, taskDisplay, recap, remaining, nextLabel, notes, planVersion, goalVersion } = input
  const out: string[] = []
  const attempted = check?.attemptedItems ?? 0
  const independent = check?.independentItems ?? 0
  if (recap.latest.state === 'found') out.push(`이번 활동(${recap.latest.at.slice(5, 16).replace('T', ' ')}): ${LATEST_LABEL[recap.latest.kind]}${recap.latest.isCorrect === null ? '' : recap.latest.isCorrect ? ' · 맞았어요' : ' · 틀렸어요'}.`)
  else if (recap.latest.state === 'unknown') out.push('수행 기록을 지금 읽지 못했어요 — 이번 활동이 반영됐는지 말하지 않을게요.')
  else out.push('이번 활동을 특정하지 못했어요 — 아래는 이 TASK 의 누적 기록이에요.')
  out.push(attempted > 0 ? `기록됨: ${taskDisplay} 확인 문항 풀이 ${attempted}개 — ${taskDisplay} 에 반영해요.` : `${taskDisplay} 에 반영된 확인 문항 풀이는 아직 없어요(해설 열람은 풀이 기록이 아니에요).`)
  out.push(independent > 0 ? `그중 처음 보는 문항을 혼자 푼 독립 근거 ${independent}개.` : '독립 근거로 센 풀이는 없어요.')
  out.push(transferLine(recap.transfer))
  out.push(`목표까지: ${remaining}`)
  if (nextLabel) out.push(`다음 추천: ${nextLabel} — 기록이 가장 부족한 단계부터 권해요.`)
  if (recap.plan) {
    const g = (id: number | null) => (id === null ? '' : ` · 저장 당시 목표 v${id}`)
    out.push(`저장한 학습계획 v${recap.plan.version}(${REASON_LABEL[recap.plan.reason]}${g(recap.plan.goalVersionId)})${recap.plan.prev ? ` · 직전 v${recap.plan.prev.version}(${REASON_LABEL[recap.plan.prev.reason]}${g(recap.plan.prev.goalVersionId)})` : ''} — 계획 버전이 바뀐 것은 실력 변화가 아니에요.`)
    if (goalVersion !== null && recap.plan.goalVersionId !== null && goalVersion !== recap.plan.goalVersionId) out.push(`지금 목표는 v${goalVersion} — 저장한 계획 뒤에 목표가 바뀌었어요(계획은 그대로예요).`)
    out.push(recap.plan.proposalDiffers ? '지금 기록으로 다시 계산한 계획은 저장본과 달라요 — 제안이에요. 확정해야 저장 계획이 바뀌어요.' : '지금 다시 계산해도 저장한 계획과 같아요.')
  } else if (notes.length === 0 && planVersion !== null) out.push(`저장한 학습계획 v${planVersion}${goalVersion !== null ? ` · 목표 v${goalVersion}` : ''} 은 그대로예요. 추천은 제안일 뿐 계획을 바꾸지 않았어요.`)
  else if (notes.length === 0) out.push('저장한 학습계획이 없어요 — 추천은 제안이고, 계획은 저장할 때 확정돼요.')
  return out
}
