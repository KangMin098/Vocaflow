// apps/web/src/lib/knowledge/find-outcome.ts
//
// 트랙 B — 학습 지도 「직접 확인(FIND)」 결과 → **확인된 학습 요구**(2026-10-08 · 판정 기준 VNEXT_LOOP_ACCEPTANCE.md B1–B3).
// 사용자 규칙: 진단 관찰 → 역량 후보 → **추가 확인 과제** → 확인된 요구 → 원리 기반 과제. 한 번의 오답으로 약점을 확정하지 않는다.
//
// 기본 기준(보수적, 바꾸려면 여기 상수만):
//   서로 다른 확인 문항 CONFIRM_ITEMS(2)개 이상에서 독립 첫 시도가 막혔고 맞힌 확인 문항이 없으면 「요구 확인됨」.
//   2개 이상을 모두 맞혔으면 「이 단계는 지금 필요 없어 보임」 · 섞이면 「엇갈림 — 더 확인」 · 1개뿐이면 「확인 중」.
// 독립 첫 시도만 센다 — 합성 · 해설 먼저 · 해설 뒤 · 시각 불확실은 확인 근거가 아니다(효과 표본과 같은 isEligible).
// 첫 시도는 DB 뷰 learning_first_attempts 가 고른 행을 받는다(학습자 · 과제 · 문항 · 단계 키).
import { isEligible, type FirstAttempt } from './effect-signals'

export const CONFIRM_ITEMS = 2

export interface FindTarget {
  itemRef: string
  taskKey: string
}

export interface FindAttemptRow extends FirstAttempt {
  itemRef: string
  taskKey: string
}

export type FindState = 'untried' | 'in_progress' | 'confirmed_need' | 'not_needed' | 'mixed'

export interface FindOutcome {
  state: FindState
  /** 독립 첫 시도로 확인한 문항 수 · 그중 막힌 · 맞힌 수 */
  checked: number
  wrong: number
  right: number
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
  for (const a of attempts) {
    if (a.phase !== 'practice' || !keys.has(`${a.taskKey}|${a.itemRef}`) || !isEligible(a) || a.isCorrect === null) continue
    // 뷰가 첫 시도만 준다 — 같은 문항이 두 번 오면(과제 키가 다른 경우 등) 먼저 온 것을 둔다
    if (!byItem.has(a.itemRef)) byItem.set(a.itemRef, a.isCorrect)
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
  return { state, checked, wrong, right, needsMoreItems, message }
}
