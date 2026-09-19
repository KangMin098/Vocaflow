// packages/library-pipeline/src/textbook/story-seam.ts
//
// **발췌가 이야기 경계를 넘었는지 본다.**
//
// ── 무엇을 보고 만들었나 (2026-09-15 실측) ──────────────────────────
// 해설 드레인에서 한 문항이 해설을 쓸 수 없는 상태로 나왔다
// (`csat_dcp_items` `16a106d7-6e22-419e-a616-8fa8a28da8db`, V5). 지문 10문장 중
// 1–5 는 Ivan 과 Koshchei 의 이야기가 **끝나는** 대목이고, 6–10 은 Oeyvind 라는
// 다른 아이의 이야기가 **시작하는** 대목이었다. 밑줄 ①② 는 앞 이야기에,
// ③④⑤ 는 뒤 이야기에 붙어 있었다. 원천은 선집이다 —
// `library_articles` `5fcd1d90-…` = "The Book of Stories for the Story-teller (발췌)".
//
// 즉 **고정 길이 창으로 선집을 자르면 이야기 경계를 넘는다.** 어법·어휘 문항은
// 지문 전체가 한 덩어리라는 것을 전제하므로, 이 지문 위에서는 정답 판정 자체가 선다고
// 말할 수 없다. 해설로 덮을 문제가 아니라 **지문을 다시 잘라야 하는 문제**다.
//
// ── 무엇을 신호로 삼는가 ────────────────────────────────────────────
// 처음에 두 가지를 재 보고 **둘 다 버렸다**:
//
//   ① 앞뒤 절반의 고유명사 집합이 서로 겹치지 않는 것 → 8,410편 중 2,170편(25.8%).
//      너무 넓다. 뒤에서 새 인물이 등장하는 **정상 서사**가 전부 걸린다.
//   ② 닫는 정형구("lived happily ever after" 등) 뒤에 본문이 더 있는 것 → 8건.
//      눈으로 확인하니 **3건만 실제 경계**였다(정밀도 37.5%). 닫는 말은 이야기
//      한복판에서도 쓰인다 — "They lived happily together, but…" 처럼.
//
// 남은 것이 이것이다 — **여는 정형구가 발췌 중간에서 문장 첫머리로 나타나는 것.**
// 실측: 여는 정형구가 있는 73편 중 중간(150자 이후)에 나타나는 것이 33편,
// 그 33편을 눈으로 갈라 보니 아래 두 제외 규칙을 걸었을 때 22편이 남고
// 그중 **17편이 실제 경계**였다(정밀도 77.3%). 제외 규칙은 둘 다 실물에서 나왔다:
//
//   · 따옴표 뒤 — 인물이 남에게 **들려주는** 액자 이야기다(intended).
//     "So Honker told the story, and here it is just as Peter heard it. \"Once upon a time…"
//   · 액자를 여는 말 뒤 — "And this is the tale: There were once two brothers…"
//
// 남은 오탐 5편은 정형구를 **평범한 문장으로 쓴 경우**다
// ("There was once a wall around the town." · "Once upon a time, it was four millions
//  of years ago."). 이것을 더 걸러 내려면 지문의 뜻을 읽어야 하므로 규칙으로는 여기까지다.
//
// ⚠️ **이 값은 하한이다.** 위 실물 사례(Ivan → Oeyvind)는 뒤 이야기가
//   "Oeyvind was his name." 로 시작해 **어떤 정형구도 쓰지 않는다** — 이 함수는 그것을
//   못 잡는다. 정형구 없는 경계가 얼마나 되는지는 모른다. 「걸린 것은 경계다」는 말할 수
//   있어도 「안 걸린 것은 성하다」는 말할 수 없다.

/**
 * 이야기를 여는 정형구. **문장 첫머리에 올 때만** 경계 후보로 본다 —
 * 문장 한복판의 "had once upon a time been" · "all at once there was" 는
 * 경계가 아니라 그냥 부사구다(실측에서 이 모양으로 4편이 걸렸었다).
 */
const OPENING =
  '(?:Once upon a time|Once on a time|There was once|There were once|There lived once|' +
  'There dwelt once|Once there was|Once there were|Long, long ago)'

/**
 * 문장이 끝난 자리 — 닫는 따옴표·괄호가 뒤따라도 문장 끝이다.
 *
 * `:` 를 넣은 것은 액자를 여는 말이 거기서 끝나기 때문이다
 * ("And this is the tale: There were once two brothers…"). 넣지 않으면 그 자리가
 * **아예 안 걸려서** 아래 액자 제외 규칙이 한 번도 안 돌아간다 — 제외가 죽은 채로
 * 시험만 통과한다.
 */
const SENTENCE_END = '(?:^|[.!?:][)\\]"\'’”]?\\s+)'

/**
 * 정형구 바로 앞에 **붙어 있는** 여는 따옴표. 인물이 들려주는 액자 이야기다.
 *
 * ⚠️ **붙어 있어야** 한다 — 사이에 공백이 있으면 그것은 앞 인용을 **닫는** 따옴표다.
 *   실물로 갈린다: `heard it. "Once upon a time` 은 액자이고,
 *   `So be it." There was once a rich old man` 은 진짜 경계다.
 */
const OPEN_QUOTE = '(["\'“‘]?)'

/** 뒤에 오는 정형구가 **인용된 이야기**임을 알리는 자국. 앞 90자 안에서 본다. */
const FRAMING =
  /told (?:the|a|this|his|her|us|them) story|this is the (?:tale|story)|here it is|I read it|tells? (?:to|it|us|them)|the (?:tale|story) of|following (?:weird )?story|say[s]? he|as follows/i

/** 글머리 몇 자까지는 「시작」이지 「경계」가 아닌가. */
const HEAD_CHARS = 150

/** 정형구 앞 몇 자를 액자 판정에 쓰는가. */
const BEFORE_CHARS = 90

/**
 * 발췌 본문에서 **이야기 경계로 보이는 자리**를 하나 돌려준다. 없으면 `null`.
 *
 * 돌려주는 값은 그 자리에서 시작하는 본문 60자 — **근거 없이 숫자만 남기지 않는다.**
 * 다음 사람이 이 문자열만 보고 진짜 경계인지 눈으로 가릴 수 있어야 한다.
 */
export function storySeam(body: string): string | null {
  // `i` 를 붙인 것은 실물 때문이다 — Beatrix Potter 판본은 "ONCE upon a time" 로 인쇄한다.
  // 문장 첫머리라는 조건은 정규식이 이미 잡고 있으므로 대소문자를 풀어도 한복판의
  // "had once upon a time been" 은 걸리지 않는다.
  const re = new RegExp(`${SENTENCE_END}${OPEN_QUOTE}(${OPENING}\\b)`, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    const quote = m[1] ?? ''
    const at = m.index + m[0].length - m[2]!.length
    if (at < HEAD_CHARS) continue
    if (quote) continue
    const before = body.slice(Math.max(0, at - BEFORE_CHARS), at)
    if (FRAMING.test(before)) continue
    return body.slice(at, at + 60)
  }
  return null
}
