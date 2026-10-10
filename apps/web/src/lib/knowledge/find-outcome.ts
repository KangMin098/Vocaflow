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
  // 연습 화면 기록은 확인 근거가 아니다 — 연습한 지문과 마지막 연습 시각만 남긴다(뷰가 활동과 무관하게 첫 시도를 고르므로 여기서 가른다)
  const practiced = new Set<string>()
  let lastPracticeAt: string | null = null
  for (const a of attempts) {
    if (a.activity !== 'practice' || !keys.has(`${a.taskKey}|${a.itemRef}`)) continue
    practiced.add(a.itemRef)
    if (a.answeredAt && (!lastPracticeAt || a.answeredAt > lastPracticeAt)) lastPracticeAt = a.answeredAt
  }
  const recheck: Recheck = { items: [], right: 0, wrong: 0 }
  for (const a of attempts) {
    if (a.activity === 'practice') continue
    if (a.phase !== 'practice' || !keys.has(`${a.taskKey}|${a.itemRef}`) || !isOwnEvidence(a) || a.isCorrect === null) continue
    // 연습 뒤에 처음 푼 새 지문 → 재확인(진단 판정과 섞지 않는다 — 섞으면 연습 전 「요구 확인」이 「엇갈림」으로 흐려진다)
    if (lastPracticeAt && a.answeredAt && a.answeredAt > lastPracticeAt && !practiced.has(a.itemRef)) {
      if (!recheck.items.includes(a.itemRef)) {
        recheck.items.push(a.itemRef)
        if (a.isCorrect) recheck.right++
        else recheck.wrong++
      }
      continue
    }
    // 뷰가 첫 시도만 준다 — 같은 문항이 두 번 오면(과제 키가 다른 경우 등) 먼저 온 것을 둔다
    if (!byItem.has(a.itemRef)) {
      byItem.set(a.itemRef, a.isCorrect)
      partsOf.set(a.itemRef, a.parts ?? null)
    }
  }
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
  return { state, checked, wrong, right, items: [...byItem.keys()], blockedParts, practicedItems: [...practiced], lastPracticeAt, recheck, needsMoreItems, message }
}
