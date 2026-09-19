// scripts/textbook/repaginate.mjs
//
// **문단 나누기 정본.** 적재기(`write-drain-import.mjs`)와 수율 검사기
// (`write-drain-yield.mjs`)가 **같은 함수**를 써야 한다 — 복제하면 검사기가 통과시킨 글이
// 적재 뒤에 문항 0 으로 남는다. 이 저장소는 이미 그 사고를 두 번 겪었다
// (52편을 쓰고 순서 0 · V2 원글 85편에 10단원).
//
// 값도 여기서 나간다 — 하한을 두 곳에 적으면 한쪽만 바뀐다.

/**
 * 넣을 수 있는 글의 하한.
 *
 * `order` 문항은 도입문 + 세 덩어리를 만들어야 하고 `insert` 는 자리 다섯을 만들어야 한다.
 * 게다가 **문단이 6문장이어야 두 유형이 다 나온다** — 순서는 4~6문장 문단에서, 교재용 삽입은
 * 본문 5~9문장(= 문단 6~10문장)에서 나온다. 겹치는 값은 6뿐이다.
 * 그래서 한 편에 **최소 열두 문장**(6+6)이 필요하다. 그 아래는 원글 수만 늘리고 단원은 못 늘린다.
 */
export const MIN_SENTENCES = 12
export const MIN_WORDS = 60

/**
 * 문단을 4~6문장으로 다시 나눈다.
 *
 * ⚠️ **이게 없으면 순서 문항이 한 개도 안 나온다.** 생성기(`generateDcpItems`)는 본문을
 *   **빈 줄로** 문단을 가르고, 순서 문항은 **4~6문장 문단**에서만 만든다(도입문 1 + (A)(B)(C)).
 *   집필 지침에 "한 덩어리 평문" 이라고 적었더니 52편이 전부 1문단 9~13문장이 됐고,
 *   결과는 **순서 0 · 삽입 28** 이었다. 단원은 순서와 삽입이 둘 다 있어야 만들어지므로
 *   글을 52편이나 써 놓고 단원은 하나도 못 늘렸다.
 *
 * 이미 4~6문장으로 나뉘어 있으면 그대로 둔다 — 글쓴이가 의도한 단락을 함부로 깨지 않는다.
 */
export function repaginate(content) {
  const paras = content
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const sentsOf = (p) => p.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 1)
  // ⚠️ 예전에는 `4~6문장`이면 그대로 뒀는데, **그게 바로 교재 삽입 규격에서 걸리는 형태다**
  //   (본문이 3~5문장이 되어 하한 5 를 아슬아슬하게 못 넘긴다). `6~10` 이어야 손대지 않는다.
  if (paras.length > 1 && paras.every((p) => { const n = sentsOf(p).length; return n >= 6 && n <= 10 })) {
    return paras.join('\n\n')
  }
  const all = paras.flatMap(sentsOf)
  // **6문장을 노린다.** 두 규격이 겹치는 유일한 값이기 때문이다:
  //   · 순서 문항 — 문단이 **4~6문장**이어야 한다(도입문 1 + (A)(B)(C)).
  //   · 삽입 문항 — 교재는 본문 **5~9문장**을 요구하고(`CSAT_INSERT_BODY`),
  //     본문은 문단에서 한 문장을 빼낸 것이므로 문단이 **6~10문장**이어야 한다.
  //
  // ⚠️ 5문장으로 나누던 동안 삽입 본문이 4문장이 되어 **조합기가 통째로 걸렀다.**
  //   그래서 V2 는 원글 85편에 삽입 문항 136개를 갖고도 10단원에서 멈췄다
  //   (V6 은 원글 41편으로 20단원 — 긴 외부 기사라 문단이 6문장을 넘겼기 때문이다).
  //   문단을 한 문장 키우는 것만으로 재고가 살아난다.
  // 문단 수를 후보로 다 세어 보고 **쓸 수 있는 문항이 가장 많이 나오는 것**을 고른다.
  // 규칙을 손으로 끼워 맞추면 8~11문장처럼 애매한 수에서 조용히 한 덩어리로 남는다.
  const n = all.length
  const split = (k) => {
    const out = []
    let taken = 0
    for (let i = 0; i < k; i++) {
      const size = Math.round((n - taken) / (k - i))
      out.push(all.slice(taken, taken + size))
      taken += size
    }
    return out.filter((p) => p.length)
  }
  const score = (parts) =>
    parts.reduce((s, p) => s + (p.length >= 4 && p.length <= 6 ? 1 : 0) + (p.length >= 6 && p.length <= 10 ? 1 : 0), 0)
  const candidates = []
  for (let k = 1; k <= Math.max(1, Math.floor(n / 4)); k++) candidates.push(split(k))
  // **6문장 우선 분할도 후보에 넣는다.** 균등 분할만 보면 10문장이 `[5,5]`(삽입 0)에 머무는데
  // `[6,4]` 면 삽입 하나를 더 건진다 — 한쪽을 6 으로 채우는 편이 규격에 맞다.
  {
    const greedy = []
    for (let i = 0; i < n; i += 6) greedy.push(all.slice(i, i + 6))
    if (greedy.length > 1 && greedy[greedy.length - 1].length < 4) {
      const tail = greedy.pop()
      greedy[greedy.length - 1] = greedy[greedy.length - 1].concat(tail)
    }
    candidates.push(greedy)
  }
  let best = candidates[0]
  let bestScore = score(best)
  for (const cand of candidates) {
    const s = score(cand)
    // 같은 점수면 문단이 적은 쪽 — 잘게 쪼개면 문맥이 짧아진다.
    if (s > bestScore || (s === bestScore && cand.length < best.length)) {
      best = cand
      bestScore = s
    }
  }
  return best.map((p) => p.join(' ')).join('\n\n')
}

