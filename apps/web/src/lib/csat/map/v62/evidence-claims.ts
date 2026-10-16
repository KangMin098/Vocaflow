// apps/web/src/lib/csat/map/v62/evidence-claims.ts
//
// LM-G1.4 — 수행 기록을 **어떤 교육적 주장까지** 해석할 수 있는지(증거 자격 · 주장 범위). 순수 · 판정 엔진 아님.
// 기존 판정의 결과만 조합한다: skillDiagnosis(As-Is check.status · 독립 첫 시도) · effect-signals.isEligible · prior-help(timingUncertain 으로 실림)
//   · lifecycle-evidence.repairWindow · plan.transferDoneOf · passageIdentity. 기존 상태(resolved · verified_need)를 다시 판정하지 않는다.
//
// 증거 층(섞지 않는다):
//   A 수행 사실      — 원장 행(사용자 · 과제 키 · 문항 · 서버 수신 · 단계 · 정오)이 있다. 링크 클릭 · 해설 열람은 수행이 아니다.
//   B 조건 성공      — 그 과제(claim-support: 주장 문장 · 근거 문장 · 관계)를 그 주석 기준으로 맞혔다. TASK 전체 숙달이 아니다.
//   C 독립 수행      — 적격 첫 시도 · 도움 · 해설 선노출 없음 · 시각 확실(isEligible). 불확실이면 승격하지 않는다.
//   D 전이 경험      — 서로 다른 지문(정규 원문 identity)에 같은 원리를 적용한 기록. 운영 계획량과 독립 적용 능력은 다르다.
//   E 지연 유지      — 승인된 최소 간격 · 지연 확인 도구가 없으므로 지금은 **NOT_ESTABLISHED**. 120일 만료는 지연 유지가 아니다.
//   F 학습 효과      — 판정하지 않는다(NOT_EVALUATED · 실제 학생 사전/사후/지연 설계는 별도).

import { isEligible } from '@/lib/knowledge/effect-signals'
import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'

import { passageIdentity, repairWindow, type ActivityRow } from '../lifecycle-evidence'
import type { AsIsTask } from '../v4/as-is'
import { checkKeysOfTask, type TaskId } from '../v4/definition'

export type FieldStatus = 'CONFIRMED' | 'UNKNOWN' | 'STALE' | 'INELIGIBLE' | 'NOT_APPLICABLE'

/** 이 과제 도구가 실제로 관찰 · 채점하는 것과 하지 않는 것(정직한 범위). 키는 원장 task_key */
export const INSTRUMENT_SCOPE: Record<string, { observes: string[]; notObserved: string[]; review: string; rubricVersion: null }> = {
  'claim-support': {
    observes: ['중심 주장 문장 고르기', '근거 문장 고르기(정답 범위 · 논쟁 문장 제외)', '표시한 문장과 주장의 관계'],
    notObserved: ['원문 이해 전체', '자유 요약 · 자기 설명', '모든 선지 판단', '다른 유형으로의 일반화', 'R5 전체 숙달'],
    review: '주석 정답 기준 자동 채점 · 전문가 루브릭 검수(R3) 전',
    rubricVersion: null,
  },
}

/** 시도 하나의 증거 자격 */
export interface AttemptEvidence {
  itemRef: string
  taskKey: string
  phase: string
  passage: string | null
  fields: {
    performed: FieldStatus      // A — 원장 행 · 서버 수신
    correct: FieldStatus        // B — 정오(null = UNKNOWN)
    instrument: FieldStatus     // 주석 현재성: 같은 해시 CONFIRMED · 다르면 STALE · 못 구하면 UNKNOWN
    rubricPolicy: FieldStatus   // 루브릭 · 정책 버전 — 원장에 없음 → UNKNOWN(새 수준 주장 금지)
    independence: FieldStatus   // C — 첫 시도 적격 CONFIRMED · 도움/해설 선노출 INELIGIBLE · 시각 불확실 UNKNOWN · 첫 시도 아님 NOT_APPLICABLE
    effectSample: FieldStatus   // F 표본 자격 — 합성 계정은 INELIGIBLE(본인 경로 E2E 는 가능)
  }
  /** 이 시도로 말할 수 있는 가장 강한 주장 */
  claim: 'independent_check' | 'condition_success' | 'performed_only' | 'held' | 'not_counted'
  reasons: string[]
}

export type CurrentCheck = 'not_started' | 'checking' | 'need_confirmed' | 'still_needed' | 'passed' | 'expired'
export interface EvidenceView {
  task: TaskId
  taskKey: string | null
  /** 현재 운영 기준의 독립 CHECK(skillDiagnosis 그대로 — 다시 판정하지 않음) */
  currentCheck: { status: CurrentCheck; independentItems: number; policy: 'skill-diagnosis: FIND 2 · CHECK 연속 2 · 회차 120일' }
  /** 교수 경로 수행(바로잡기 · 적용) — 성취 · 지연 유지가 아니다 */
  instructionPath: { repair: 'none' | 'tried' | 'succeeded'; transferDone: number; transferPlanned: number | null }
  /** 다른 원문 적용 경험(서로 다른 정규 원문 수) — 독립 적용 능력 주장 아님 */
  newPassageTransfer: { status: 'none' | 'experienced' | 'no_content' | 'unknown'; passages: number }
  /** 지연 유지 — 승인된 간격 · 도구가 없으면 NOT_ESTABLISHED. 120일 만료 · resolved 를 승격하지 않는다 */
  delayedRetention: { status: 'NOT_ESTABLISHED'; reason: 'no_approved_interval_or_instrument' }
  learningEffect: 'NOT_EVALUATED'
  /** 원장 읽기 완전성 — 못 읽었으면 'unknown'(근거 완전성 PASS 금지) */
  ledger: 'complete' | 'unknown'
  attempts: AttemptEvidence[]
  /** 같은 지문의 다른 문항을 둘 이상 확인에 쓴 경우 — 서로 독립 관찰이 아니다 */
  sharedPassageGroups: string[][]
  /** 이 도구의 관찰 범위(도구가 없으면 null) */
  scope: (typeof INSTRUMENT_SCOPE)[string] | null
}

const CHECK_OF: Record<string, CurrentCheck> = { unverified: 'checking', verified: 'need_confirmed', still_needed: 'still_needed', resolved: 'passed', expired: 'expired' }

export interface EvidenceInput {
  task: TaskId
  check: AsIsTask['check']
  /** 확인 첫 시도(learning_first_attempts) — 없으면(undefined) 원장 못 읽음 */
  firsts: readonly FindAttemptRow[] | undefined
  /** 전체 수행(learning_task_attempts) — 없으면(undefined) 원장 못 읽음 */
  activity: readonly ActivityRow[] | undefined
  /** 과제 키|문항 → 현재 주석 해시(undefined = 못 구함) */
  hashes: Record<string, string | null> | undefined
  transfer: { done: number; planned: number | null }
}

export function evidenceView(input: EvidenceInput): EvidenceView {
  const keys = new Set(checkKeysOfTask(input.task))
  const key = [...keys][0] ?? null
  const c = input.check
  const ledger: EvidenceView['ledger'] = input.firsts && input.activity ? 'complete' : 'unknown'
  const mine = (input.activity ?? []).filter((a) => a.itemRef && keys.has(a.taskKey.replace(/-skeleton$/, '')))
  const firsts = (input.firsts ?? []).filter((f) => keys.has(f.taskKey))
  const firstKey = new Set(firsts.map((f) => `${f.taskKey}|${f.itemRef}|${f.phase}`))
  const seenFirst = new Set<string>()

  const attempts: AttemptEvidence[] = mine.map((a) => {
    const reasons: string[] = []
    const itemKey = `${a.taskKey.replace(/-skeleton$/, '')}|${a.itemRef}`
    const now = input.hashes === undefined ? undefined : input.hashes[itemKey]
    const instrument: FieldStatus = a.contentHash === undefined || now === undefined ? 'UNKNOWN' : now === null || a.contentHash === null ? 'UNKNOWN' : a.contentHash === now ? 'CONFIRMED' : 'STALE'
    if (instrument === 'STALE') reasons.push('과거 주석 기준의 수행')
    const performed: FieldStatus = a.receivedAt === undefined ? 'UNKNOWN' : a.receivedAt ? 'CONFIRMED' : 'UNKNOWN'
    const correct: FieldStatus = a.isCorrect === null ? 'UNKNOWN' : 'CONFIRMED'
    // 첫 시도 — 같은 과제 · 문항 · 단계의 가장 이른 기록만(같은 문항 반복은 독립 관찰을 늘리지 않는다)
    const fk = `${a.taskKey}|${a.itemRef}|${a.phase}`
    const isFirst = firstKey.has(fk) && !seenFirst.has(fk)
    if (isFirst) seenFirst.add(fk)
    const f = isFirst ? firsts.find((x) => `${x.taskKey}|${x.itemRef}|${x.phase}` === fk) ?? null : null
    let independence: FieldStatus = 'NOT_APPLICABLE'
    if (a.phase === 'practice' && f) {
      if (f.activity === 'practice') { independence = 'INELIGIBLE'; reasons.push('연습 화면 기록 — 확인 근거 아님') }
      // 도움 · 해설 뒤가 확정이면 그것이 먼저(보류가 아니라 독립 아님). 기록이 없거나 독립이라고 했는데 순서를 못 가리면 보류
      else if ((f.helpLevel !== null && f.helpLevel !== 'independent') || f.afterViewedFirst || f.afterExplanation) { independence = 'INELIGIBLE'; reasons.push('도움 · 해설 뒤 수행') }
      else if (f.timingUncertain) { independence = 'UNKNOWN'; reasons.push('해설 · 도움 시각과 제출 순서 확인 불가 — 보류') }
      else if (f.helpLevel === null) { independence = 'UNKNOWN'; reasons.push('도움 수준 기록 없음 — 보류') }
      else if (f.isCorrect === null) independence = 'UNKNOWN'
      else independence = 'CONFIRMED'
    } else if (a.phase === 'practice' && !isFirst) reasons.push('같은 문항 반복 — 독립 관찰 아님')
    const effectSample: FieldStatus = a.synthetic === undefined || a.synthetic === null ? 'UNKNOWN' : a.synthetic ? 'INELIGIBLE' : (f && isEligible({ ...f, synthetic: false }) ? 'CONFIRMED' : 'INELIGIBLE')
    // 주장 — 새 주장은 핵심 근거(수행 · 정오 · 현재 주석 · 독립)가 모두 CONFIRMED 일 때만
    let claim: AttemptEvidence['claim'] = 'performed_only'
    if (performed !== 'CONFIRMED') claim = 'not_counted'
    else if (independence === 'UNKNOWN') claim = 'held'
    else if (independence === 'CONFIRMED' && correct === 'CONFIRMED' && instrument === 'CONFIRMED') claim = 'independent_check'
    else if (correct === 'CONFIRMED' && a.isCorrect === true && instrument !== 'STALE') claim = 'condition_success'
    return {
      itemRef: a.itemRef!, taskKey: a.taskKey, phase: a.phase, passage: passageIdentity(a.itemRef, a.passageKey),
      fields: { performed, correct, instrument, rubricPolicy: 'UNKNOWN', independence, effectSample },
      claim, reasons,
    }
  })

  // 같은 정규 원문을 공유하는 서로 다른 확인 문항(독립 관찰이 아니다)
  const byPassage = new Map<string, Set<string>>()
  for (const x of attempts) if (x.phase === 'practice' && x.passage && x.passage !== x.itemRef) byPassage.set(x.passage, new Set([...(byPassage.get(x.passage) ?? []), x.itemRef]))
  const sharedPassageGroups = [...byPassage.values()].filter((s) => s.size > 1).map((s) => [...s].sort())

  // 교수 경로 — lifecycle 창 그대로
  let repair: EvidenceView['instructionPath']['repair'] = 'none'
  if (c?.verifiedAt) {
    const w = repairWindow({ status: c.status, verifiedAt: c.verifiedAt, verifiedItems: c.verifiedItems, check: { wrongItems: c.wrongItems, lastWrongAt: c.lastWrongAt ?? null } })
    if (w) {
      const blocked = new Set(w.blocked)
      const tries = mine.filter((a) => a.phase !== 'transfer' && blocked.has(a.itemRef!) && !!a.answeredAt && a.answeredAt > w.since)
      repair = tries.some((a) => a.isCorrect === true) ? 'succeeded' : tries.length ? 'tried' : 'none'
    }
  }
  const status = c ? CHECK_OF[c.status] ?? 'checking' : 'not_started'
  return {
    task: input.task,
    taskKey: key,
    currentCheck: { status: c && c.independentItems === 0 && status === 'checking' ? 'not_started' : status, independentItems: c?.independentItems ?? 0, policy: 'skill-diagnosis: FIND 2 · CHECK 연속 2 · 회차 120일' },
    instructionPath: { repair, transferDone: input.transfer.done, transferPlanned: input.transfer.planned },
    newPassageTransfer: { status: ledger === 'unknown' ? 'unknown' : input.transfer.done > 0 ? 'experienced' : input.transfer.planned === null && c?.status === 'verified' ? 'no_content' : 'none', passages: input.transfer.done },
    delayedRetention: { status: 'NOT_ESTABLISHED', reason: 'no_approved_interval_or_instrument' },
    learningEffect: 'NOT_EVALUATED',
    ledger,
    attempts,
    sharedPassageGroups,
    scope: key ? INSTRUMENT_SCOPE[key] ?? null : null,
  }
}

export const CURRENT_CHECK_LABEL: Record<CurrentCheck, string> = {
  not_started: '아직 확인 전', checking: '확인 중', need_confirmed: '연습이 필요하다고 확인됨', still_needed: '다시 확인에서 아직 막힘', passed: '통과(지금 기준)', expired: '기간 지나 다시 확인 필요',
}
