// apps/web/src/lib/csat/trap-drill.ts
//
// **오답 감별 훈련의 순수 모델 — 「이 수법의 이름은 무엇인가」.**
//
// ── 왜 이것이 필요한가 ────────────────────────────────────────────────
// `/csat` 재설계로 학습자는 ①**알고**(아홉 가지 분포) ②**짚을**(실제 기출 예시) 수 있게 됐다.
// 그런데 거기까지는 **읽고 납득하는** 물건이고 **인출이 일어나지 않는다**(학습과학 원칙 1
// Active Recall — 인출이 재인보다 강한 기억). 아홉 가지를 아무리 잘 읽어도, 다음 지문에서
// 그 수법을 **알아보는** 것은 다른 능력이다.
//
// 그래서 분류 훈련을 놓는다: 우리가 쓴 오답 해설(끌리는 이유 + 버리는 법)을 읽고
// **수법의 이름**을 고른다. 이름을 인출해 본 사람만 다음 지문에서 그것을 알아본다.
//
// ── 왜 지문이 없어도 되는가 ───────────────────────────────────────────
// 여기 쓰이는 글은 **전부 우리가 쓴 분석**이다(`why_tempting` · `how_to_reject`).
// 평가원 지문·선지 원문은 한 글자도 필요하지 않다 — 저작권 경계를 건드리지 않는 유일한
// 형태의 문제이고, 그래서 **문항 1,934개가 그대로 훈련 문제가 된다**(실측 2026-09-15:
// 범용 함정 9종의 오답 선지 1,935개 중 쓸 수 있는 것 1,934).
//
// ── 보기를 무작위로 뽑지 않는다 ───────────────────────────────────────
// 보기 넷을 전체에서 아무렇게나 뽑으면 **같은 유형에 나오지도 않는 함정**이 섞여 소거법으로
// 풀린다. 그러면 재는 것이 「수법을 아는가」가 아니라 「목록을 외웠는가」가 된다. 그래서
// **그 유형에서 실제로 나오는 함정** 중에서 뽑는다 — 구운 지도의 `by_type` 이 그것을 안다.
//
// ⚠️ **`server-only` 를 들이지 않는다** — 채점과 요약을 화면(클라이언트)이 부른다.
//
// ⚠️ **`trap-atlas` 를 import 하지 않는다.** 그 모듈은 JSON 을 정적 import 하는데, 굽는
//    스크립트는 번들러 없이 **맨 node** 로 이 파일을 불러 쓴다 — 그러면 `import attribute
//    of "type: json"` 으로 죽는다(실측 2026-09-15). 그래서 함정표를 **인자로 받는다.**
//    부수 효과로 설계도 나아졌다: 순수 모델이 특정 데이터 싱글턴을 붙들지 않는다.

/** `buildOptions` 가 필요로 하는 최소한의 함정 정보. `TrapEntry` 가 이것을 만족한다. */
export interface TrapLike {
  key: string
  by_type: Record<string, number>
}

/** 한 문제. `answer` 가 정답 함정 이름이고 `options` 안에 반드시 들어 있다. */
export interface DrillCard {
  /** `M2309#42:2` — 문항과 선지 번호. 같은 문항의 다른 오답이 두 문제가 될 수 있다. */
  id: string
  item_id: string
  slug: string
  exam_label: string
  no: number
  type_id: string
  type_name: string
  choice: number
  tempting: string
  reject: string
  answer: string
  options: string[]
}

/** 고른 답 하나. */
export interface DrillAnswer {
  cardId: string
  picked: string
  answer: string
}

export const OPTION_COUNT = 4

/**
 * 문자열 → 결정론적 난수기.
 *
 * **서버와 클라이언트가 같은 보기 순서를 내야 한다** — 다르면 하이드레이션이 어긋나고,
 * 최악의 경우 서버가 정한 정답 자리와 화면이 그리는 자리가 달라진다. `Math.random()` 을
 * 쓰면 그 사고가 조용히 난다.
 */
export function rngFrom(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    h |= 0
    return (h >>> 0) / 4294967296
  }
}

/** 제자리 섞기(Fisher–Yates) — 주어진 난수기로만 돈다. */
export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * 보기 넷 — 정답 + **그 유형에서 실제로 나오는** 함정 셋.
 *
 * 그 유형에 함정이 모자라면(드문 유형) 범용 아홉에서 채운다. 그래도 모자라면 전체에서 채운다.
 * 어느 경우에도 **정답은 반드시 들어가고 중복은 없다.**
 */
export function buildOptions(answer: string, typeId: string, seed: string, traps: TrapLike[]): string[] {
  const inType = traps
    .filter((t) => t.key !== answer && (t.by_type[typeId] ?? 0) > 0)
    .sort((a, b) => (b.by_type[typeId] ?? 0) - (a.by_type[typeId] ?? 0) || (a.key < b.key ? -1 : 1))
  const seen = new Set(inType.map((t) => t.key))
  const pool: TrapLike[] = [...inType, ...traps.filter((t) => t.key !== answer && !seen.has(t.key))]

  const picked: string[] = []
  for (const t of pool) {
    if (picked.length >= OPTION_COUNT - 1) break
    if (!picked.includes(t.key)) picked.push(t.key)
  }
  return shuffle([answer, ...picked], rngFrom(seed))
}

/**
 * 해설이 정답 이름을 그대로 품고 있으면 문제가 안 된다.
 *
 * 실측 2026-09-15: 1,935개 중 **3개**(0.16%)뿐이라 버려도 표본이 안 준다. 남겨 두면
 * 그 세 문제는 읽기 검사가 되고, 학습자는 **훈련이 쉬운 줄로 오해한다.**
 */
export function leaksAnswer(tempting: string, reject: string, answer: string): boolean {
  const hay = `${tempting} ${reject}`
  if (hay.includes(answer)) return true
  // 「범위 과대」처럼 띄어쓰기가 있는 이름은 붙여 쓴 형태도 본다.
  const tight = answer.replace(/\s+/g, '')
  return tight.length > 1 && hay.replace(/\s+/g, '').includes(tight)
}

export interface TrapTally {
  trap: string
  seen: number
  correct: number
}

export interface DrillResult {
  total: number
  correct: number
  /** 틀린 문제들 — 요약이 실제로 줄 수 있는 것은 이것이다. */
  missed: DrillAnswer[]
  /** 함정별 성적. **8문항으로는 분포를 말할 수 없다** — 화면이 그 사실을 함께 적어야 한다. */
  byTrap: TrapTally[]
  /** 두 번 이상 보고 한 번도 못 맞힌 함정 — 유일하게 「약하다」고 말해도 되는 것 */
  weak: string[]
}

export function scoreDrill(answers: DrillAnswer[]): DrillResult {
  const by = new Map<string, TrapTally>()
  for (const a of answers) {
    const e = by.get(a.answer) ?? { trap: a.answer, seen: 0, correct: 0 }
    e.seen += 1
    if (a.picked === a.answer) e.correct += 1
    by.set(a.answer, e)
  }
  const byTrap = [...by.values()].sort(
    (x, y) => x.correct / x.seen - y.correct / y.seen || y.seen - x.seen || (x.trap < y.trap ? -1 : 1),
  )
  return {
    total: answers.length,
    correct: answers.filter((a) => a.picked === a.answer).length,
    missed: answers.filter((a) => a.picked !== a.answer),
    byTrap,
    // ⚠️ **한 번 틀린 것을 「약점」이라고 부르지 않는다.** 8문항 훈련에서 1/1 은 표본이 아니고,
    //    그것을 약점이라 적으면 학습자가 없는 결함을 고치러 간다(철학 3 — 비난하지 않는다).
    weak: [...by.values()].filter((t) => t.seen >= 2 && t.correct === 0).map((t) => t.trap),
  }
}
