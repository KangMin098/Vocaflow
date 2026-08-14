// apps/web/src/lib/framework/word-progress.ts
//
// 면×단계 매트릭스 — **단어 하나가 어느 면까지 왔는가**를 실데이터에서 계산한다.
//
// 왜 이 파일이 필요한가:
//   `flow.ts` 가 `WordFrameworkState`(passed·accuracy·hits·memory·encounters)와 이동 조건
//   (`canAdvance`)을 선언해 뒀는데, **그 상태를 만드는 코드가 어디에도 없었다.**
//   축은 서 있고 판정 규칙도 있는데 입력이 없으니 처방이 그것을 쓸 수 없다 —
//   레지스트리에 소비자가 0이었던 것과 같은 종류의 공백이다.
//
//   설계안 §2: "진행률은 면×단계 매트릭스로 두고 화면에는 **가장 뒤처진 면 하나**를
//   처방으로 보여준다." 그 '가장 뒤처진 면'을 고르려면 면별 상태가 먼저 있어야 한다.
//
// ── 어떻게 면을 아는가 ────────────────────────────────────────────
//   `learning_records.module` 이 어떤 활동이었는지 말해 주고, 레지스트리가 그 활동이
//   **어떤 면을 훈련하는지** 안다(`Activity.facets`). 둘을 이으면 단어별 면 이력이 나온다.
//   면을 따로 저장하지 않는 이유는 Stage 를 저장하지 않는 이유와 같다 — 두 벌을 두면 어긋난다.
//
// ⚠️ 단일 mastery 스칼라로 접지 않는다(설계안 §9 배제 목록). 면이 6개인데 하나의 숫자로
//    접으면 "무엇이 부족한지" 를 말할 수 없다. 여기서는 면별로 남기고, 화면이 하나를 고른다.

import { FACETS, SPINE, stageOf, type FacetId, type StageId } from './axes'
import { ACCURACY_HOLD_BELOW, HITS_TO_PASS, type MemoryState, type WordFrameworkState } from './flow'
import { activityById } from './registry'

/** 한 번의 인출 기록 — `learning_records` 한 행에서 필요한 것만. */
export interface FacetAttempt {
  /** 소문자 단어 (결합 키 — 설계안 §5.5) */
  word: string
  /** `learning_records.module` — 활동 id */
  module: string
  isCorrect: boolean
}

export interface WordProgressInput {
  word: string
  attempts: FacetAttempt[]
  memory: MemoryState
  /** 누적 만남(읽기 노출 포함). 모르면 0 — 그러면 노출 하한 게이트가 걸린다. */
  encounters: number
}

/**
 * 면 하나가 "통과" 인가.
 *
 * 두 조건을 **함께** 본다:
 *   · 성공 횟수 ≥ HITS_TO_PASS — 한 번 맞힌 것은 우연일 수 있다
 *   · 정답률 ≥ ACCURACY_HOLD_BELOW — 여러 번 맞혔어도 그만큼 틀렸으면 통과가 아니다
 *
 * 정답률만 보면 1/1(100%)이 통과가 되고, 횟수만 보면 2/10 이 통과가 된다. 둘 다 거짓이다.
 */
export function isFacetPassed(hits: number, attempts: number): boolean {
  if (hits < HITS_TO_PASS) return false
  if (attempts === 0) return false
  return hits / attempts >= ACCURACY_HOLD_BELOW
}

/**
 * 인출 기록 → 단어 하나의 프레임워크 상태.
 *
 * 순수 함수다 — DB 를 모른다. 그래야 규칙을 테스트로 고정할 수 있고,
 * 입력이 어디서 오든(실시간 조회 · 배치 집계) 같은 답이 나온다.
 */
export function deriveWordState(input: WordProgressInput): WordFrameworkState {
  const hits: Partial<Record<FacetId, number>> = {}
  const tries: Partial<Record<FacetId, number>> = {}

  for (const a of input.attempts) {
    const activity = activityById(a.module)
    // 레지스트리에 없는 module — 활동으로 등록되지 않은 기록이다. 세면 없는 면이 생긴다.
    if (!activity) continue
    for (const facet of activity.facets) {
      tries[facet] = (tries[facet] ?? 0) + 1
      if (a.isCorrect) hits[facet] = (hits[facet] ?? 0) + 1
    }
  }

  const accuracy: Partial<Record<FacetId, number>> = {}
  const passed: FacetId[] = []
  for (const facet of Object.keys(tries) as FacetId[]) {
    const t = tries[facet] ?? 0
    const h = hits[facet] ?? 0
    accuracy[facet] = t > 0 ? h / t : 0
    if (isFacetPassed(h, t)) passed.push(facet)
  }

  return {
    word: input.word,
    passed,
    accuracy,
    hits,
    memory: input.memory,
    encounters: input.encounters,
  }
}

/** 여러 단어를 한 번에 — 기록을 단어별로 모아 각각 계산한다. */
export function deriveWordStates(
  attempts: FacetAttempt[],
  meta: Map<string, { memory: MemoryState; encounters: number }>,
): WordFrameworkState[] {
  const byWord = new Map<string, FacetAttempt[]>()
  for (const a of attempts) {
    const key = a.word.toLowerCase()
    const list = byWord.get(key) ?? []
    list.push(a)
    byWord.set(key, list)
  }

  return [...byWord.entries()].map(([word, list]) =>
    deriveWordState({
      word,
      attempts: list,
      memory: meta.get(word)?.memory ?? 'new',
      encounters: meta.get(word)?.encounters ?? 0,
    }),
  )
}

// ── 처방이 쓰는 요약 ──────────────────────────────────────────────

export interface FacetGap {
  facet: FacetId
  /** 이 면의 정답률 (시도 없으면 null) */
  accuracy: number | null
  /** 시도 자체가 없었나 — "못한다" 와 "안 해봤다" 는 다르다 */
  untried: boolean
}

/**
 * **가장 뒤처진 spine 면 하나** — 설계안이 화면에 보이라고 한 그것.
 *
 * 순서는 정직하게 spine 순이다(Recognize → Spell → Use → Fluency):
 *   ① 아직 통과 못한 면 중 **시도조차 없는 가장 앞 면**이 우선이다.
 *      정답률이 낮은 뒤쪽 면을 먼저 권하면 앞을 건너뛰게 된다.
 *   ② 전부 시도는 했는데 통과가 없으면 **정답률이 가장 낮은 면**.
 *   ③ spine 을 다 통과했으면 null — 더 권할 것이 없다(cross 면은 처방이 따로 고른다).
 *
 * cross 면(Sound·Build)은 단계를 정의하지 않으므로 여기서 고르지 않는다 —
 * "발음을 모르면 문맥으로 못 간다" 는 근거 없는 게이트를 만들지 않기 위해서다.
 */
export function weakestFacet(state: WordFrameworkState): FacetGap | null {
  const passed = new Set(state.passed)
  const pending = SPINE.filter((f) => !passed.has(f))
  if (pending.length === 0) return null

  const untried = pending.find((f) => (state.hits[f] ?? 0) === 0 && state.accuracy[f] == null)
  if (untried) return { facet: untried, accuracy: null, untried: true }

  let worst = pending[0]
  for (const f of pending) {
    if ((state.accuracy[f] ?? 0) < (state.accuracy[worst] ?? 0)) worst = f
  }
  return { facet: worst, accuracy: state.accuracy[worst] ?? null, untried: false }
}

/** 단어의 현재 단계 — 통과한 spine 면에서 파생(저장하지 않는다). */
export function stageOfWord(state: WordFrameworkState): StageId {
  return stageOf(state.passed)
}

/** 학습자 전체의 면별 분포 — "무엇이 비어 있나" 를 한 눈에. */
export function facetDistribution(
  states: WordFrameworkState[],
): Record<FacetId, { passed: number; tried: number }> {
  const out = {} as Record<FacetId, { passed: number; tried: number }>
  for (const facet of Object.keys(FACETS) as FacetId[]) out[facet] = { passed: 0, tried: 0 }
  for (const s of states) {
    for (const facet of Object.keys(FACETS) as FacetId[]) {
      if (s.accuracy[facet] != null) out[facet].tried += 1
      if (s.passed.includes(facet)) out[facet].passed += 1
    }
  }
  return out
}
