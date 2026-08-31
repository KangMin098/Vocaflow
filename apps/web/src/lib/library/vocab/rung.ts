// apps/web/src/lib/library/vocab/rung.ts
//
// 발행 단어장을 **사다리의 계단에 앉힌다.**
//
// ── 왜 필요한가 ────────────────────────────────────────────────────
// `/library/vocab` 은 70권을 카테고리 칩으로만 갈랐다. 칩은 "초등·중등·고등·수능·공인시험…"
// 이라 **학습 단계처럼 보이지만 단계가 아니다** — '주제별' 43권이 한 칸에 뭉쳐 있고,
// 그 43권은 서로 난이도가 다르다. 그래서 학습자가 "내 다음 권" 을 고를 수 없다.
//
// 시중 단어장은 이 문제를 사다리로 푼다(능률VOCA: 중학 → 고등 기본 → 수능 필수 → 수능 고난도).
// 우리도 사다리가 이미 있다(`VOCAB_SPINE` 7단) — 없던 것은 **발행물을 그 계단에 앉히는 일**이다.
//
// ── 무엇을 근거로 앉히는가 (센 것부터) ──────────────────────────────
//
//   ① `ladderStep` — 컴포저가 정한 값. 저작물이므로 추정으로 덮지 않는다.
//   ② **낱말 실측 중앙값** — 그 권에 실제로 든 낱말을 센 값(`curation_query.level`).
//      사다리 위(V8+)면 **계단을 비우고 멈춘다.**
//   ③ `category` — 학교급을 직접 말하는 칸(초등·중등·고등·수능).
//   ④ `cefr_level` — 칸이 학교급을 말하지 않으면 CEFR 로 환산한다.
//
// **전부 없으면 앉히지 않는다.** 짐작으로 계단을 채우면 학습자가 자기 학년이라 믿고 연 책이
// 자기 학년이 아니게 된다 — 빈칸보다 나쁘다. 그래서 `null` 을 그대로 두고 화면이 '미분류' 로 적는다.
//
// ⚠️ ②가 ③·④보다 **앞에 있어야 한다.** 실측 2026-08-31 — 주제 단어장 13권이 낱말 중앙값
//   V8~V9(성인)인데 `cefr_level='A2'` 라벨 때문에 3단(중학 1-2학년)에 앉고 있었다.
//   컴포저가 선언한 **목표** CEFR 은 그 권이 실제로 무엇을 담았는지 말하지 않는다.

import { cefrToVLevel } from '@/lib/learner/plan-activities'
import { rungForVLevel, VOCAB_SPINE, type VocabRung } from '@vocaflow/library-pipeline/vocab-brand'

/**
 * 계단을 무엇으로 정했는지. 화면이 근거를 밝힐 수 있어야 한다 —
 * "왜 이 책이 5단인가" 에 답하지 못하면 사다리를 믿을 수 없다.
 */
export type RungBasis = 'authored' | 'measured' | 'above-ladder' | 'category' | 'cefr' | 'none'

/** 사다리의 꼭대기. 이보다 높은 중앙값은 학령 밖이다 — `lib/vcb/compose/publish.ts` 와 같은 값. */
const LADDER_TOP = 7

/**
 * 계단을 정하는 데 필요한 두 신호.
 *
 * ⚠️ `category` 를 `VocabCategory` 유니온으로 좁히지 않는다. **DB 컬럼이 free text 라서**
 *   유니온에 없는 값이 실제로 들어온다(2026-08-15 에 칩에는 있고 타입에는 없던 칸이
 *   두 개 있었다 — `queries.ts` 주석). 모르는 칸은 타입 오류가 아니라 **CEFR 로 내려가야 할
 *   경우**다. 좁혀 두면 발행 경로가 컴파일되지 않고, 억지로 캐스팅하면 그 사실이 숨는다.
 */
export interface SetLevelSignals {
  category: string
  cefrLevel: string | null
  /**
   * 컴포저가 정해 둔 계단(`shared_word_sets.ladder_step`).
   *
   * **있으면 이것이 이긴다.** 아래 두 신호는 그 값이 없을 때 쓰는 **추정**이고,
   * 추정으로 저작물을 덮으면 컴포저가 정한 일이 화면에서 사라진다.
   */
  ladderStep?: number | null
  /**
   * 표제어 V-Level **실측 중앙값** (`scripts/vocab/stamp-imprint.mts` 가 각인한 값).
   *
   * ⚠️ **추정보다 세다.** 아래 카테고리·CEFR 두 경로는 라벨을 보고 짐작하는 것이고,
   *   이것은 그 권에 실제로 든 낱말을 센 값이다. 실측 2026-08-31 — 주제 단어장 13권이
   *   낱말 중앙값 V8~V9(성인)인데 `cefr_level='A2'` 라는 라벨 때문에 **3단(중학 1-2학년)**
   *   으로 앉고 있었다. 컴포저가 선언한 목표 CEFR 은 그 권이 실제로 어떤 낱말을 담았는지
   *   말하지 않는다.
   *
   * 중앙값이 사다리 위면 **계단을 비운다**(`basis: 'above-ladder'`) — 그때 아래 추정으로
   * 내려가면 안 된다. 내려가는 순간 "쟀더니 학령 밖" 이 "라벨상 중학" 으로 덮인다.
   *
   * 모양이 `PublishedVocabSet.level` 과 같아서 호출자가 세트를 통째로 넘기면 그냥 붙는다.
   */
  level?: { median: number } | null
}

export interface SetRung {
  /** 앉힌 계단. 근거가 없으면 null. */
  rung: VocabRung | null
  basis: RungBasis
}

/**
 * 학교급을 직접 말하는 카테고리 → 계단.
 *
 * ⚠️ 한 카테고리가 **두 계단**을 덮는다(중등 = 3단 중1-2 + 4단 중3). 어느 쪽인지 모르므로
 *   **아래 계단**에 앉힌다 — 위로 잘못 앉히면 학습자가 어려운 책을 자기 수준으로 착각하고,
 *   아래로 앉히면 쉬운 책을 먼저 만난다. 틀리는 방향이 안전한 쪽을 고른다.
 */
const CATEGORY_STEP: Record<string, number> = {
  preschool: 1,
  elementary: 1,
  middle: 3,
  high: 5,
  csat: 7,
}

/**
 * `cefrToVLevel` 은 **두 벌**이 있다. 여기서 쓰는 것은 `lib/learner/plan-activities` 쪽이다
 * (`lib/library/book-cover` 의 동명 함수는 **표지 명도 매핑용**이라 값이 다르다 —
 * A2 를 3 이 아니라 2 로 준다). 계단은 의미이지 명도가 아니므로 이쪽이 맞다.
 */
export function rungForSet(set: SetLevelSignals): SetRung {
  // 컴포저가 정한 값이 있으면 그것이 정본이다 — 추정으로 덮지 않는다.
  if (set.ladderStep != null) {
    const authored = VOCAB_SPINE.find((r) => r.step === set.ladderStep) ?? null
    if (authored) return { rung: authored, basis: 'authored' }
  }

  // 실측이 추정을 이긴다 — 라벨(카테고리·CEFR)보다 낱말을 센 값이 먼저다.
  const med = set.level?.median
  if (typeof med === 'number' && med >= 1) {
    // 사다리 위: 계단을 비우고 **여기서 멈춘다.** 추정으로 내려가면 성인 권이 학령 칸에 앉는다.
    if (med > LADDER_TOP) return { rung: null, basis: 'above-ladder' }
    const measured = VOCAB_SPINE.find((r) => r.step === Math.round(med)) ?? null
    if (measured) return { rung: measured, basis: 'measured' }
  }

  const byCategory = CATEGORY_STEP[set.category]
  if (byCategory != null) {
    const rung = VOCAB_SPINE.find((r) => r.step === byCategory) ?? null
    if (rung) return { rung, basis: 'category' }
  }

  const vLevel = cefrToVLevel(set.cefrLevel)
  if (vLevel != null) {
    const rung = rungForVLevel(vLevel)
    if (rung) return { rung, basis: 'cefr' }
  }

  return { rung: null, basis: 'none' }
}

export interface RungFill {
  rung: VocabRung
  /** 이 계단에 앉은 발행 권 수. */
  volumes: number
  /** 그 권들의 표제어 합. */
  words: number
}

export interface LadderFill {
  rungs: RungFill[]
  /** 계단에 앉히지 못한 권 수. **숨기지 않는다** — 분모가 안 맞으면 사다리를 못 믿는다. */
  unplaced: number
  /** 권이 하나도 없는 계단. 여기가 비면 그 학년 학습자가 다른 곳으로 간다. */
  emptySteps: number[]
}

/**
 * 사다리를 발행 재고에 대 본다.
 *
 * **브랜드는 이름이 아니라 채울 수 있는 계단이다** — 교재 쪽 `measureSeriesFill` 과 같은 생각이다.
 * 빈 계단을 숨기면 학습자는 "내 학년이 없다" 가 아니라 "이 브랜드는 이상하다" 로 읽는다.
 */
export function measureLadderFill(
  sets: ReadonlyArray<SetLevelSignals & { wordCount: number }>,
): LadderFill {
  const byStep = new Map<number, { volumes: number; words: number }>()
  for (const r of VOCAB_SPINE) byStep.set(r.step, { volumes: 0, words: 0 })

  let unplaced = 0
  for (const set of sets) {
    const { rung } = rungForSet(set)
    if (!rung) {
      unplaced += 1
      continue
    }
    const cell = byStep.get(rung.step)!
    cell.volumes += 1
    cell.words += set.wordCount
  }

  const rungs = VOCAB_SPINE.map((rung) => ({ rung, ...byStep.get(rung.step)! }))
  return {
    rungs,
    unplaced,
    emptySteps: rungs.filter((r) => r.volumes === 0).map((r) => r.rung.step),
  }
}
