// apps/web/src/lib/csat/map/v4/as-is.ts
//
// As-Is Map — 기준 시점(asOf)까지 알 수 있었던 시험 기록 · 확인 시도로 TASK 별 **근거 상태**를 계산한다. 목표가 없어도 계산한다.
// 계약: docs/csat-learner/LEARNING_MAP_EXAM_INPUT_CONTRACT.md §1–§4. 순수 함수(DB · 시계 없음 — asOf 를 주입).
//
// 규칙(정본 rev2.1 §10 · §11 그대로):
//   · 근거 상태를 바꾸는 것은 직접 확인(skill-diagnosis — 독립 첫 시도 · 합성/도움/해설 뒤/시각 불확실 제외)뿐이다.
//     축 proxy(rule_proxy)는 그 축 TASK 전부에 「축 기록에서 보인 모습」으로만 붙는다 — TASK 능력 점수 · verified 로 바꾸지 않는다.
//   · 보류 TASK(L · X)는 측정 불가 — 요구 · 실행을 만들지 않는다.
//   · asOf 뒤에 시행 · 입력된 시험, asOf 뒤의 시도는 쓰지 않는다. 저장된 최신 스냅샷(축 proxy)은 asOf 뒤 기록을 포함할 수 있으므로
//     그런 기록이 하나라도 있으면 proxy 를 쓰지 않고 「과거 시점 축 관찰 재현 불가」로 표시한다.
//   · 서로 다른 시험의 원점수는 합치지 않는다 — 시험별 나열만.

import { isEligible } from '@/lib/knowledge/effect-signals'
import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'
import { skillDiagnosis, type SkillStatus } from '../skill-diagnosis'

import { CANON_EFFECTIVE_FROM, CANON_VERSION, DOMAINS, RULE_VERSION, checkKeysOfTask, tasks, type Domain, type TaskId } from './definition'
import type { DirectCheck } from './types'

/** 축 proxy 의 학생 쪽 상태(learner-path 의 단계 근거 상태를 축 단위로) */
export type AxisProxyState = 'none' | 'pending' | 'insufficient' | 'observed' | 'check_first'

export interface AsIsSession {
  id: string
  examId: string
  examLabel: string
  /** 시험 시행일(학습자가 본 날) */
  takenAt: string
  /** 기록 입력일 */
  enteredAt: string
  raw: number | null
  grade: number | null
  /** 입력 신뢰도(record-quality) 통과 */
  diagnosable: boolean
  /** 시험의 문항 진단 입력이 사람 검수를 마쳤나(csat_exams.diagnosis_ready) */
  examReady: boolean
}

export interface AsIsCheck {
  /** 확인 과제 키(claim-support …) */
  taskKey: string
  /** 그 키의 확인 문항(보류 문항은 이미 빠진 목록) */
  items: string[]
}

export interface AsIsInput {
  asOf: string
  sessions: readonly AsIsSession[]
  /**
   * 저장된 최신 스냅샷에서 빌린 축 관찰 — 없으면 null(스냅샷 없음 · 보류 기록 등).
   * covers = 그 스냅샷이 반영한 세션 id. 근거로 쓸 세션 중 여기 없는 것이 있으면 축 관찰은 아직 그 기록을 모른다 → 「반영 중」.
   */
  axisProxy: { state: Record<Domain, AxisProxyState>; contributions: Record<Domain, number>; covers?: readonly string[] } | null
  checks: readonly AsIsCheck[]
  /** 확인 문항 시도(learning_first_attempts + 연습 기록) — 판정은 skill-diagnosis 가 거른다 */
  attempts: readonly FindAttemptRow[]
}

export type TaskEvidence =
  | 'unmeasurable'      // 측정 도구가 없다(정본 보류)
  | 'unmeasured'        // 그 TASK 를 관찰할 기록이 없다
  | 'analysis_pending'  // 기록은 있지만 분석 가능한 시험이 아니다(학습 능력과 무관)
  | 'insufficient'      // 관찰 근거가 모자란다
  | 'observed'          // 축 기록에서 관찰됨(proxy — 확정 아님)
  | 'check_first'       // 축 기록상 먼저 확인할 후보(확정 아님)
  | 'checking'          // 직접 확인 진행 중(아직 판정 없음)
  | 'verified_need'     // 직접 확인된 학습 요구
  | 'resolved'          // 확정 뒤 다시 확인 통과
  | 'expired'           // 확정 뒤 기한 경과 — 다시 확인 필요

export type EvidenceBasis = 'none' | 'axis_proxy' | 'direct_check'

export interface AsIsTask {
  id: TaskId
  axis: Domain
  status: TaskEvidence
  basis: EvidenceBasis
  /** 정의상 직접 확인 준비 상태 */
  directCheck: DirectCheck
  /** 직접 확인 판정(그 TASK 를 겨누는 확인 과제가 있을 때만) */
  check: {
    taskKey: string
    status: SkillStatus
    /** 판정에 쓴 독립 첫 시도 문항 수(서로 다른 문항) — 성취(직접 확인) 근거 */
    independentItems: number
    /** 확인 과제 화면에서 실제로 푼 확인 문항 수(서로 다른 문항 · 도움 · 합성 여부와 무관) — 계획의 「수행량」. 성취 근거가 아니다 */
    attemptedItems: number
    verifiedItems: string[]
    wrongItems: string[]
    /** 아직 본 적 없는 확인 문항 — 「확인」 · 「다시 확인」에 쓸 수 있는 실제 문항(확인 과제로도, 기록한 시험지로도 안 본 것) */
    unseen: string[]
    /** 확인 과제로는 안 봤지만 학습자가 그 시험을 기록해 이미 푼 확인 문항 — 새 문항으로 내밀지 않는다 */
    examSeen: string[]
    verifiedAt: string | null
  } | null
  /** 근거 출처와 개수 */
  sources: { kind: 'exam_sessions' | 'independent_attempts'; count: number }[]
  /** 상태의 이유 코드(화면 문구 키) */
  reason: string
}

export type ReplayMode = 'current' | 'past_reanalysis'

export interface AsIsMap {
  asOf: string
  canonVersion: string
  ruleVersion: string
  /** current = 기준 시점 뒤 기록이 없다(지금 분석). past_reanalysis = 과거 기준 — 현재 정의 · 규칙으로 다시 분석한 것 */
  mode: ReplayMode
  /** 그 시점의 정확한 지도인가 — 한계(limits)가 하나라도 있으면 false. 정의 · 규칙 버전 이력이 없어 과거 기준 재분석은 항상 false */
  exact: boolean
  /** 재현 한계 코드 */
  limits: ('snapshot_after_as_of' | 'definition_newer_than_as_of')[]
  sessions: (AsIsSession & { used: boolean; excluded: null | 'after_as_of' | 'not_diagnosable' | 'exam_not_ready' })[]
  /** 시험별 점수(합치지 않는다 · 시행일 순) */
  scores: { sessionId: string; examId: string; examLabel: string; takenAt: string; raw: number | null; grade: number | null }[]
  domains: Record<Domain, { state: 'deferred' | 'no_records' | 'analysis_pending' | 'proxy_unavailable' | 'proxy_pending' | AxisProxyState; contributions: number }>
  tasks: Record<TaskId, AsIsTask>
  excluded: { sessionsAfterAsOf: number; attemptsAfterAsOf: number; syntheticAttempts: number }
}

const PROXY_TO_TASK: Record<AxisProxyState, TaskEvidence> = {
  none: 'unmeasured',
  pending: 'analysis_pending',
  insufficient: 'insufficient',
  observed: 'observed',
  check_first: 'check_first',
}

const SKILL_TO_TASK: Record<SkillStatus, TaskEvidence | null> = {
  unverified: null,
  verified: 'verified_need',
  still_needed: 'verified_need',
  resolved: 'resolved',
  expired: 'expired',
}

const HOLD_DOMAINS = new Set<Domain>(['L', 'X'])

/**
 * 시각 비교는 밀리초로 — taken_at 은 날짜만(`2026-10-10`), 나머지는 ISO 시각이라 문자열 비교는 같은 날을 「앞」으로 잘못 본다(2차 화면 검토).
 * 날짜만 있는 값은 그날 0시(UTC)로 읽는다. 읽을 수 없는 값은 가장 뒤(기준 시점 필터에서 빠지게).
 */
export function ms(v: string): number {
  const t = new Date(v).getTime()
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
}

export function asIsMap(input: AsIsInput): AsIsMap {
  const asOf = input.asOf
  const at = new Date(asOf)
  if (Number.isNaN(at.getTime())) throw new Error(`asOf 가 시각이 아니다: ${asOf}`)
  const cut = at.getTime()

  // 기준 시점 필터 — 시행일 · 입력일 둘 다 asOf 이하
  const sessions = [...input.sessions]
    .sort((a, b) => ms(a.takenAt) - ms(b.takenAt) || ms(a.enteredAt) - ms(b.enteredAt))
    .map((s) => {
      const excluded = ms(s.takenAt) > cut || ms(s.enteredAt) > cut ? 'after_as_of' as const : !s.diagnosable ? 'not_diagnosable' as const : !s.examReady ? 'exam_not_ready' as const : null
      return { ...s, used: excluded === null, excluded }
    })
  const inWindow = sessions.filter((s) => s.excluded !== 'after_as_of')
  const sessionsAfter = sessions.length - inWindow.length
  // 시각 없는 시도는 순서 · 기준 시점을 알 수 없다 — skill-diagnosis 도 판정에 쓰지 않는다. 기준 시점 필터에서도 뺀다(리뷰 P1)
  const attempts = input.attempts.filter((a) => !!a.answeredAt && ms(a.answeredAt) <= cut)
  const attemptsAfter = input.attempts.filter((a) => !!a.answeredAt && ms(a.answeredAt) > cut).length

  // 지금 분석인가 — 기준 시점 뒤 기록이 하나라도 있으면 저장 스냅샷(축 proxy)은 그 기록을 포함할 수 있다
  const future = sessionsAfter > 0 || attemptsAfter > 0
  const limits: AsIsMap['limits'] = []
  if (future) limits.push('snapshot_after_as_of')
  if (cut < ms(CANON_EFFECTIVE_FROM)) limits.push('definition_newer_than_as_of')
  const mode: ReplayMode = future ? 'past_reanalysis' : 'current'
  const proxy = future ? null : input.axisProxy

  // 영역 상태
  const hasRecords = inWindow.length > 0
  const anyAnalyzable = inWindow.some((s) => s.used)
  const covers = proxy?.covers ? new Set(proxy.covers) : null
  const lagging = covers !== null && inWindow.some((s) => s.used && !covers.has(s.id))
  const domains = Object.fromEntries(DOMAINS.map((d) => {
    if (HOLD_DOMAINS.has(d)) return [d, { state: 'deferred' as const, contributions: 0 }]
    if (!hasRecords) return [d, { state: 'no_records' as const, contributions: 0 }]
    if (!anyAnalyzable) return [d, { state: 'analysis_pending' as const, contributions: 0 }]
    if (!proxy) return [d, { state: future ? 'proxy_unavailable' as const : 'proxy_pending' as const, contributions: 0 }]
    if (lagging) return [d, { state: 'proxy_pending' as const, contributions: 0 }]
    return [d, { state: proxy.state[d], contributions: proxy.contributions[d] ?? 0 }]
  })) as AsIsMap['domains']

  const syntheticAttempts = attempts.filter((a) => a.synthetic).length
  // 기준 시점까지 기록한 시험(입력 신뢰도 · 진단 준비와 무관 — 시험지를 받아 풀었다)
  const takenExams = new Set(inWindow.map((s) => s.examId))
  const out: Record<TaskId, AsIsTask> = {}
  for (const t of tasks()) {
    const base = { id: t.id, axis: t.axis, directCheck: t.direct_check }
    if (t.status === 'hold') {
      out[t.id] = { ...base, status: 'unmeasurable', basis: 'none', check: null, sources: [], reason: 'canon_hold' }
      continue
    }
    // 직접 확인 — 이 TASK 를 중심으로 겨누는 확인 과제 키가 있고, 확인 문항이 실제로 연결돼 있을 때만
    const keys = new Set(checkKeysOfTask(t.id))
    const targets = input.checks.filter((c) => keys.has(c.taskKey)).flatMap((c) => c.items.map((itemRef) => ({ itemRef, taskKey: c.taskKey })))
    let check: AsIsTask['check'] = null
    let fromCheck: TaskEvidence | null = null
    if (targets.length > 0) {
      const d = skillDiagnosis(targets, attempts, at)
      const mine = attempts.filter((a) => targets.some((x) => x.itemRef === a.itemRef && x.taskKey === a.taskKey))
      // skill-diagnosis 와 같은 자격(확인 과제 · 독립 첫 시도 · 정오 있음) — 연습 화면 기록 · 합성 · 도움 받은 시도는 세지 않는다
      const independent = new Set(mine.filter((a) => a.activity !== 'practice' && a.phase === 'practice' && isEligible(a) && a.isCorrect !== null && !!a.answeredAt).map((a) => a.itemRef))
      // 이미 본 문항 — 다른 과제로 본 문항(과제 키 무관 · skill-diagnosis 의 seenAt 과 같은 기준) + **기록한 시험의 문항**(시험지로 이미 풀었다).
      //   후자는 「다음에 내밀 확인 문항 · 계획량」에서만 뺀다 — 직접 확인 판정(skillDiagnosis)은 그대로(3차 · 재노출 방지)
      const seen = new Set(attempts.filter((a) => targets.some((x) => x.itemRef === a.itemRef)).map((a) => a.itemRef))
      const examSeen = [...new Set(targets.map((x) => x.itemRef))].filter((i) => !seen.has(i) && takenExams.has(i.split('#')[0] ?? ''))
      check = {
        taskKey: targets[0].taskKey,
        status: d.status,
        independentItems: independent.size,
        attemptedItems: new Set(mine.filter((a) => a.activity !== 'practice' && !!a.answeredAt).map((a) => a.itemRef)).size,
        verifiedItems: d.verifiedItems,
        wrongItems: d.check.wrongItems ?? [],
        unseen: [...new Set(targets.map((x) => x.itemRef))].filter((i) => !seen.has(i) && !examSeen.includes(i)),
        examSeen,
        verifiedAt: d.verifiedAt,
      }
      fromCheck = SKILL_TO_TASK[d.status] ?? (independent.size > 0 ? 'checking' : null)
    }
    if (fromCheck) {
      out[t.id] = { ...base, status: fromCheck, basis: 'direct_check', check, sources: [{ kind: 'independent_attempts', count: check?.independentItems ?? 0 }], reason: `check_${fromCheck}` }
      continue
    }
    // 축 proxy — 축 단위 관찰을 그 축 TASK 에 「축 기록」으로만 붙인다
    const dom = domains[t.axis]
    const usedSessions = inWindow.filter((s) => s.used).length
    const status: TaskEvidence =
      dom.state === 'no_records' ? 'unmeasured'
        : dom.state === 'analysis_pending' || dom.state === 'proxy_pending' ? 'analysis_pending'
          : dom.state === 'proxy_unavailable' || dom.state === 'deferred' ? 'unmeasured'
            : PROXY_TO_TASK[dom.state]
    out[t.id] = {
      ...base,
      status,
      basis: status === 'observed' || status === 'check_first' || status === 'insufficient' ? 'axis_proxy' : 'none',
      check,
      sources: usedSessions > 0 ? [{ kind: 'exam_sessions', count: usedSessions }] : [],
      reason: dom.state === 'proxy_unavailable' ? 'past_proxy_unavailable' : dom.state === 'no_records' ? 'no_records' : dom.state === 'analysis_pending' ? 'exam_not_analyzable' : dom.state === 'proxy_pending' ? 'record_being_analyzed' : `proxy_${dom.state}`,
    }
  }

  return {
    asOf,
    canonVersion: CANON_VERSION,
    ruleVersion: RULE_VERSION,
    mode,
    exact: limits.length === 0,
    limits,
    sessions,
    scores: inWindow.map((s) => ({ sessionId: s.id, examId: s.examId, examLabel: s.examLabel, takenAt: s.takenAt, raw: s.raw, grade: s.grade })),
    domains,
    tasks: out,
    excluded: { sessionsAfterAsOf: sessionsAfter, attemptsAfterAsOf: attemptsAfter, syntheticAttempts },
  }
}

/** 새 기록(시험 · 확인)으로 바뀐 것 — 이전 As-Is 와 다음 As-Is 비교(계획을 말없이 덮지 않고 「바뀐 것」을 보이기 위해) */
export function asIsDiff(prev: AsIsMap, next: AsIsMap): { newSessions: string[]; changed: { task: TaskId; from: TaskEvidence; to: TaskEvidence }[] } {
  const before = new Set(prev.sessions.filter((s) => s.excluded !== 'after_as_of').map((s) => s.id))
  return {
    newSessions: next.sessions.filter((s) => s.excluded !== 'after_as_of' && !before.has(s.id)).map((s) => s.id),
    changed: Object.values(next.tasks).filter((t) => prev.tasks[t.id] && prev.tasks[t.id].status !== t.status).map((t) => ({ task: t.id, from: prev.tasks[t.id].status, to: t.status })),
  }
}

/** 상태 → 학습자 문구(실력 단정 없이). 미측정 · 분석 준비 · 측정 불가를 서로 다른 말로 */
export const TASK_EVIDENCE_LABEL: Record<TaskEvidence, string> = {
  unmeasurable: '아직 측정 도구 없음',
  unmeasured: '아직 기록 없음',
  analysis_pending: '분석 준비 중인 시험',
  insufficient: '기록 더 필요',
  observed: '기출에서 관찰됨',
  check_first: '먼저 확인할 후보',
  checking: '직접 확인 진행 중',
  verified_need: '직접 확인 — 연습 필요',
  resolved: '다시 확인 통과',
  expired: '다시 확인할 때',
}
