// apps/web/src/lib/knowledge/find-outcome.ts
//
// 트랙 B — 학습 지도 「직접 확인(FIND)」 결과 → **확인된 학습 요구**(2026-10-08 · 판정 기준 VNEXT_LOOP_ACCEPTANCE.md B1–B3).
// 사용자 규칙: 진단 관찰 → 역량 후보 → **추가 확인 과제** → 확인된 요구 → 원리 기반 과제. 한 번의 오답으로 약점을 확정하지 않는다.
//
// 기본 기준(보수적, 바꾸려면 여기 상수만):
//   서로 다른 확인 문항 CONFIRM_ITEMS(2)개 이상에서 독립 첫 시도가 막혔고 맞힌 확인 문항이 없으면 「요구 확인됨」.
//   2개 이상을 모두 맞혔으면 「이 단계는 지금 필요 없어 보임」 · 섞이면 「엇갈림 — 더 확인」 · 1개뿐이면 「확인 중」.
// 독립 첫 시도만 센다 — 해설 먼저 · 해설 뒤 · 시각 불확실 · 도움 수준 미기록은 확인 근거가 아니다(효과 표본과 같은 isEligible).
// 단 「합성」은 빼지 않는다: 이 판정은 그 학습자 **본인**에게 보이는 것이고, 합성 표시는 집단 통계(성과 신호 · 효과)에서 빼기 위한 것이다.
//   합성 계정(시험 · 합성 학습자)도 자기 기록으로는 같은 판정을 받아야 한다 — 그래야 화면 E2E 가 실제 경로로 검증된다(2026-10-10).
// 첫 시도는 DB 뷰 learning_first_attempts 가 고른 행을 받는다(학습자 · 과제 · 문항 · 단계 키).
import { isEligible, type FirstAttempt } from './effect-signals'

const isOwnEvidence = (a: FirstAttempt) => isEligible({ ...a, synthetic: false })

export const CONFIRM_ITEMS = 2

export interface FindTarget {
  itemRef: string
  taskKey: string
}

export interface FindAttemptRow extends FirstAttempt {
  itemRef: string
  taskKey: string
  /** 판단 시각(ISO) — 기능 단위 직접 확인(skill-diagnosis)의 순서 · 기한에 쓴다 */
  answeredAt?: string | null
  /** 세부 채점(수행 기록 response.grade) — 완전 정답 판정은 바꾸지 않고 「어디서 막혔나」만 알린다. 없으면 null */
  parts?: Record<string, boolean> | null
  /** 어디서 푼 기록인가 — 'theater'(확인 과제) · 'practice'(연습 화면). 연습 기록은 확인 근거가 아니다(find-policy.v3) */
  activity?: string | null
}

/** 연습 뒤 **새 지문**에서 다시 확인한 결과 — 연습한 지문 · 연습 전에 푼 지문은 넣지 않는다 */
export interface Recheck {
  items: string[]
  right: number
  wrong: number
  /** 가장 최근 재확인 — 결정은 최신 사건으로 정한다 */
  last: { item: string; ok: boolean; at: string | null } | null
  /** 처방 뒤 연습이 마지막 재확인보다 뒤에 있다(또는 재확인 전) — 새 지문 재확인 차례 */
  pending: boolean
}

/** 막힌 확인 문항에서 각 부분(주장 · 근거 · 관계 …)이 틀린 문항 수 — 세부 채점이 없는 문항은 unknown */
export type BlockedParts = Record<string, number> & { unknown: number }

export type FindState = 'untried' | 'in_progress' | 'confirmed_need' | 'not_needed' | 'mixed'

export interface FindOutcome {
  state: FindState
  /** 독립 첫 시도로 확인한 문항 수 · 그중 막힌 · 맞힌 수 */
  checked: number
  wrong: number
  right: number
  /** 판정에 실제로 쓴 확인 문항(적격 독립 첫 시도가 있는 것만) — 결정 추적의 관찰 근거 */
  items: string[]
  /** 막힌 문항의 세부 — 부분 정답(주장은 맞고 근거만 누락 등)을 완전 오답과 구별해 추적한다(판정 기준은 그대로) */
  blockedParts: BlockedParts
  /** 연습 화면에서 푼 확인 문항 — 같은 지문으로 재확인하지 않게 */
  practicedItems: string[]
  /** 마지막 연습 시각(ISO) — 그 뒤 새 지문 확인만 재확인으로 센다 */
  lastPracticeAt: string | null
  /** 연습 뒤 새 지문 재확인 */
  recheck: Recheck
  /** 요구 확인(처방) 뒤에 연습했는가 — 이때만 재확인 단계로 간다 */
  practiceAfterPrescription: boolean
  /** 확인 문항이 모자라 기준에 못 닿는가(문항이 1개뿐인 단계) */
  needsMoreItems: boolean
  /** 학습자에게 보이는 한 문장 — 약점을 단정하지 않는다 */
  message: string
}

export const FIND_STATE_LABEL: Record<FindState, string> = {
  untried: '아직 확인 안 함',
  in_progress: '확인 중',
  confirmed_need: '연습이 필요해 보여요',
  not_needed: '지금은 괜찮아 보여요',
  mixed: '결과가 엇갈려요',
}

export function findOutcome(targets: readonly FindTarget[], attempts: readonly FindAttemptRow[]): FindOutcome {
  const keys = new Set(targets.map((t) => `${t.taskKey}|${t.itemRef}`))
  const byItem = new Map<string, boolean>()
  const partsOf = new Map<string, Record<string, boolean> | null>()
  // ── 회차를 시간 순서로 다시 세운다(2026-10-10 · 반복 지적 원인: 「마지막 연습 시각」 하나로 경계를 잡아
  //    재확인 실패 → 재연습이 오면 앞 재확인이 진단으로 섞여 사라졌다). 진단 → 처방 → 연습 → 재확인 → (실패면 재연습 → 재확인) …
  // 연습: 같은 원리 과제 키(·골격 변형)면 문항과 무관(확인 문항 밖 지문 연습 포함). 연습은 확인 근거가 아니다
  const taskKeys = new Set(targets.flatMap((t) => [t.taskKey, `${t.taskKey}-skeleton`]))
  const practiced = new Set<string>()
  const practiceTimes: string[] = []
  for (const a of attempts) {
    if (a.activity !== 'practice' || !taskKeys.has(a.taskKey)) continue
    practiced.add(a.itemRef)
    if (a.answeredAt) practiceTimes.push(a.answeredAt)
  }
  practiceTimes.sort()
  const lastPracticeAt = practiceTimes.length ? practiceTimes[practiceTimes.length - 1] : null
  // 확인: 문항마다 첫 시도 하나(뷰가 고른 것) · 시간순
  const checks: { item: string; ok: boolean; at: string | null; parts: Record<string, boolean> | null }[] = []
  const seenItem = new Set<string>()
  for (const a of attempts) {
    if (a.activity === 'practice' || a.phase !== 'practice' || !keys.has(`${a.taskKey}|${a.itemRef}`) || !isOwnEvidence(a) || a.isCorrect === null) continue
    if (seenItem.has(a.itemRef)) continue
    seenItem.add(a.itemRef)
    checks.push({ item: a.itemRef, ok: a.isCorrect, at: a.answeredAt ?? null, parts: a.parts ?? null })
  }
  checks.sort((x, y) => (x.at ?? '').localeCompare(y.at ?? ''))
  // 처방 시점 = 확인 기록만으로 「서로 다른 2문항 막힘 · 맞힘 0」이 처음 성립한 순간
  let prescribedAt: string | null = null
  {
    let w = 0, r = 0
    for (const c of checks) {
      if (c.ok) r++
      else w++
      if (w >= CONFIRM_ITEMS && r === 0 && c.at) { prescribedAt = c.at; break }
    }
  }
  // 처방 뒤 첫 연습 — 이 앞까지가 진단, 이 뒤 새 지문 확인이 재확인
  const firstPracticeAfter = prescribedAt ? practiceTimes.find((t) => t > prescribedAt!) ?? null : null
  const prescribedBeforePractice = !!firstPracticeAfter
  const recheck: Recheck = { items: [], right: 0, wrong: 0, last: null, pending: false }
  for (const c of checks) {
    const isRecheck = prescribedBeforePractice && c.at !== null && c.at > firstPracticeAfter! && !practiced.has(c.item)
    if (isRecheck) {
      recheck.items.push(c.item)
      if (c.ok) recheck.right++
      else recheck.wrong++
      recheck.last = { item: c.item, ok: c.ok, at: c.at }
      continue
    }
    byItem.set(c.item, c.ok)
    partsOf.set(c.item, c.parts)
  }
  // 마지막 재확인보다 뒤에 연습이 있으면(또는 재확인이 아직 없으면) 새 지문 재확인을 기다린다
  recheck.pending = prescribedBeforePractice && (!recheck.last || (lastPracticeAt !== null && lastPracticeAt > (recheck.last.at ?? '')))
  const blockedParts: BlockedParts = { unknown: 0 }
  for (const [item, ok] of byItem) {
    if (ok) continue
    const p = partsOf.get(item)
    if (!p) { blockedParts.unknown++; continue }
    // 주장이 틀리면 근거 · 관계는 정답 주장에 대고 채점되므로 따라 틀린다 — 그 문항은 「주장」으로만 센다(따라 틀린 것을 별도 약점으로 세지 않는다 · 합성 집단 C 그룹에서 확인)
    if (p.claim === false) { blockedParts.claim = (blockedParts.claim ?? 0) + 1; continue }
    for (const [k, v] of Object.entries(p)) if (v === false) blockedParts[k] = (blockedParts[k] ?? 0) + 1
  }
  const checked = byItem.size
  const right = [...byItem.values()].filter(Boolean).length
  const wrong = checked - right
  const available = new Set(targets.map((t) => t.itemRef)).size
  const needsMoreItems = available < CONFIRM_ITEMS

  let state: FindState
  let message: string
  if (checked === 0) {
    state = 'untried'
    message = '아직 직접 확인한 문항이 없어요. 아래 문항으로 확인해 보세요.'
  } else if (checked < CONFIRM_ITEMS) {
    state = 'in_progress'
    message = needsMoreItems
      ? `확인 문항 ${checked}개를 풀었어요. 한 문항으로는 판단하지 않아요 — 확인 문항이 더 준비되면 이어서 볼게요.`
      : `확인 문항 ${checked}개를 풀었어요. 한 문항으로는 판단하지 않아요 — 다른 문항으로 한 번 더 확인해요.`
  } else if (wrong >= CONFIRM_ITEMS && right === 0) {
    state = 'confirmed_need'
    message = `서로 다른 확인 문항 ${wrong}개에서 같은 단계가 막혔어요. 이 단계 연습부터 하면 좋아요.`
  } else if (right >= CONFIRM_ITEMS && wrong === 0) {
    state = 'not_needed'
    message = `확인 문항 ${right}개를 혼자 해냈어요. 지금은 이 단계보다 다른 단계를 먼저 봐도 돼요.`
  } else {
    state = 'mixed'
    message = `확인 문항 ${checked}개 중 ${wrong}개가 막혔어요. 결과가 엇갈려서 한 번 더 확인해요.`
  }
  return { state, checked, wrong, right, items: [...byItem.keys()], blockedParts, practicedItems: [...practiced], lastPracticeAt, recheck, practiceAfterPrescription: prescribedBeforePractice, needsMoreItems, message }
}
