// apps/web/src/lib/dict/word-web.ts
//
// **낱말 그물의 정제 규칙 — 한 곳.**
//
// 파생어·유의어·반의어를 학습자에게 보여 주기 전에 걸러야 하는 것이 있다. 플래시카드
// 정답면(`CardBack`)과 읽기 조회 창(`WordLookupPopover`)이 **같은 규칙**을 써야 하므로
// 규칙을 여기 한 곳에 둔다 — 두 곳에 복사하면 반드시 갈린다(`_example-shape.mjs` 와 같은 이유).
//
// ── 무엇을 왜 버리는가 (실측 2026-08-30) ────────────────────────────
// 사전의 `synonyms` 는 WordNet 계열 자료가 섞여 있어 **유의어가 아닌 것**이 들어 있다.
// 카탈로그 표제어 기준으로 유의어 항목 17,544 개 중:
//
//   · 여러 낱말로 된 것        1,668 (9.5%)
//   · **표제어 자신을 품은 것**  886 (5.1%)  ← 이것이 문제다
//   · 유의어가 전부 그런 낱말    553
//
// 표제어를 품은 항목은 유의어가 아니라 **그 낱말의 다른 뜻**이다:
//
//   cell  → jail cell · prison cell · cellular telephone   (뜻이지 유의어가 아니다)
//   bank  → bank building · savings bank                    (하위어지 유의어가 아니다)
//
// 학습자가 "비슷한 말: jail cell" 을 읽으면 **cell 이 jail cell 과 바꿔 쓸 수 있다**고
// 배운다. 틀린 것을 가르치는 것은 아무것도 안 보여 주는 것보다 나쁘다.
//
// ⚠️ **여러 낱말이라고 다 버리지는 않는다.** `abandon → give up` 은 정당한 유의어다.
//   버리는 기준은 길이가 아니라 **표제어를 품었는가**다.
//
// ⚠️ **낱말 경계로 본다.** 단순 부분 문자열로 보면 `accord → accordance` 가 걸려 버리는데,
//   그건 정당한 관련어다. `bank building` 은 `bank` 를 **낱말로** 품었지만
//   `accordance` 는 아니다.

/** 표제어를 낱말로 품고 있는가 — `bank building`⊃`bank` 는 참, `accordance`⊃`accord` 는 거짓. */
function containsHeadword(candidate: string, headword: string): boolean {
  const head = headword.trim().toLowerCase()
  if (!head) return false
  return candidate
    .toLowerCase()
    .split(/[^a-z0-9'’-]+/)
    .some((tok) => tok === head)
}

/**
 * 그물 한 줄을 학습자에게 보여 줄 형태로 정제한다.
 *
 * · 빈 값·중복 제거
 * · 표제어 자신과 같은 것 제거 (자기를 "파생어" 로 보여 주면 오해다)
 * · 표제어를 낱말로 품은 것 제거 (유의어가 아니라 다른 뜻이다 — 위 주석)
 * · 남은 것이 없으면 `null` — 호출부가 그 줄을 통째로 뺀다(빈 줄이 카드를 흔들지 않게)
 */
export function cleanWordWebRow(
  list: readonly string[] | null | undefined,
  headword: string,
): string[] | null {
  if (!Array.isArray(list)) return null
  const self = headword.trim().toLowerCase()
  const out = [
    ...new Set(
      list
        .map((s) => (typeof s === 'string' ? s.trim() : ''))
        .filter((s) => s.length > 0)
        .filter((s) => s.toLowerCase() !== self)
        .filter((s) => !containsHeadword(s, self)),
    ),
  ]
  return out.length > 0 ? out : null
}
