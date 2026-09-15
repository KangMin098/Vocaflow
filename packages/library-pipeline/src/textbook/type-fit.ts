// packages/library-pipeline/src/textbook/type-fit.ts
//
// **이 지문이 이 유형을 떠받칠 수 있는가 — 유형↔지문 적합 판정.**
//
// ── 왜 이 파일이 생겼나 (실측 2026-09-15) ────────────────────────────
// 3인 검수 53문항 배치에서 **서로 다른 두 청크가 각자** 같은 것을 짚었다: `purpose`(18번
// 글의 목적) 문항 3건이 **3건 모두 3인칭 서술 소설**이었다. 편지도 공지도 아닌 글에
// 「이 글의 목적은?」을 물으면, 정답은 필자의 요청이 아니라 **장면 요약**이 될 수밖에 없다 —
// 즉 주제·요지 문항이 목적 딱지를 달고 나간다.
//
// 재고 전체를 세니 표본이 아니라 **구조**였다:
//
//   저장된 purpose 문항            86건
//   인사말(`Dear …,`)이 있는 것       **0**
//   요청 행위 표현이 있는 것          **0**
//   둘 다 있는 것                    **0**
//
// 원문 쪽도 같다 — `library_articles` 10.7만 편 중 `Dear ` 를 담은 것이 518편인데 그중
// **편지 꼴(줄머리 인사말 + 쉼표)은 7편**이다. 나머지는 전부 소설 대사(`my dear`·`Dear me`)다.
//
// ── 규칙은 이 저장소가 이미 적어 둔 것이다 ───────────────────────────
// `docs/CSAT_TYPE_BLUEPRINTS.md` §R-PURPOSE 출제자의 사고 1번:
//
//   > 장르를 먼저 고른다 — 편지·이메일·공지문. **화자와 수신자가 분명해야 '목적' 이
//   > 성립한다(설명문에는 목적이 없다).**
//
// 규칙이 없어서가 아니라 **문서에만 있고 코드에 닿지 않아서** 86건이 만들어졌다. 이
// 저장소가 같은 자국을 이미 두 번 적었다(`csat-format.ts` §버리는 자 · `volume-pool.mjs`
// §같은 자). **적어 둔다고 같은 자가 되지 않는다** — 그래서 판정을 여기로 옮긴다.
//
// ── 무엇을 하지 않는가 ──────────────────────────────────────────────
// ⚠️ **규칙이 없는 유형을 「통과」로 세지 않는다.** `judged: false` 로 돌려준다.
//   `source-eligibility.ts` 가 `unjudged` 를 `usable` 로 세지 않는 것과 같은 이유다 —
//   안 본 것과 보고 괜찮은 것은 다르고, 둘을 한 칸에 넣으면 다음 사람이 구별할 수 없다.
//
// ⚠️ **질을 재지 않는다.** 여기 통과한 편지가 좋은 지문이라는 뜻이 아니다. 떨어진 것이
//   **이 유형으로는 절대 안 된다**는 것만 말한다(필요조건이지 충분조건이 아니다).
//
// 순수 함수만 둔다 — 네트워크·DB 를 모른다.

/** 왜 이 유형을 떠받칠 수 없는가. **사유가 없으면 다시 만들 수가 없다.** */
export type TypeFitReason =
  /** 글이 아무도 부르지 않는다 — 수신자가 없으면 '목적' 이 성립하지 않는다. */
  | 'no_addressee'
  /** 독자에게 시키는 행위가 없다 — 목적 유형의 정답은 그 행위다. */
  | 'no_request_act'
  /** 당위 표현이 없다 — 주장 유형의 정답은 그 문장의 재진술이다. */
  | 'no_deontic'

export interface TypeFit {
  /** 이 유형으로 문항을 만들어도 되는가. `judged` 가 거짓이면 이 값은 뜻이 없다. */
  ok: boolean
  /** **이 유형에 규칙이 있는가.** 없으면 통과가 아니라 미판정이다. */
  judged: boolean
  /** 떨어진 사유. 통과·미판정이면 null. */
  reason: TypeFitReason | null
}

/**
 * 줄머리 인사말 — 편지·이메일의 첫 줄.
 *
 * ⚠️ **줄머리로 못박는다.** 소설의 `“My dear Watson,”` 은 문장 한가운데 온다. 실측
 *   518편 중 편지 꼴로 걸린 것은 7편뿐이고, 줄머리 조건을 빼면 그 511편이 전부 들어온다.
 */
const SALUTATION =
  /(?:^|\n)[ \t]*(?:My dear|Dear)\s+[A-Z][A-Za-z.]{1,20}(?:\s+[A-Z][A-Za-z.]{1,20})?\s*[,:]|\bTo whom it may concern\b/

/** 2인칭 — 수신자를 부르는 가장 흔한 자국. */
const SECOND_PERSON = /\byou(?:r|rs|rself|rselves)?\b/gi

/**
 * 독자에게 시키는 행위 — **정답이 되는 문장의 자국**이다.
 *
 * ⚠️ **2인칭만으로는 부족하다.** 처음엔 「2인칭이 둘 이상」만 봤더니 86건 중 6건이
 *   통과했는데, 표본 6건을 읽으니 **6건 모두** 수필·소설의 일반 호칭이었다
 *   (`If you have ever been a cat …` · `If you’ve ever struggled to reduce your carb intake …`).
 *   부르는 것과 **시키는 것**은 다르고, 18번이 재는 것은 뒤쪽이다.
 *
 * ⚠️ **`please` 를 낱말로 세면 안 된다 — 이것이 동사이기도 하다.** 첫 판은 `\bplease\b` 였고,
 *   V5 후보 8편을 꺼내 읽으니 **7편이 그 한 낱말의 오탐**이었다:
 *
 *     `we may give any which we please`      (Plato, *Laws*)
 *     `Resolve as deliberately as you please`(*The Teacher*)
 *     `much of its power to please is lost`  (*Composition-Rhetoric*)
 *
 *   요청의 `please` 는 **문장 첫머리의 명령형**으로 온다(`Please observe the postscript`).
 *   그래서 자리를 본다 — 낱말이 아니라 **문장 머리**를.
 */
/**
 * ⚠️ **대소문자를 가리는 규칙과 안 가리는 규칙을 한 정규식에 섞지 않는다.** 처음엔 `/i` 를
 *   떼서 `Please` 만 잡히게 했더니 **`We would like to remind you` 가 함께 죽었다**(회귀가
 *   바로 잡았다). 자리를 보는 규칙과 낱말을 보는 규칙은 성질이 달라 따로 둔다.
 */
const IMPERATIVE_PLEASE = /(?:^|[.!?"”'’]\s+|\n\s*)Please\s+[a-z]/
const REQUEST_ACT =
  /\bI am writing to\b|\bwe (?:would like to|invite|kindly ask|request|remind|inform|announce|regret to)\b|\byou are (?:invited|requested|asked)\b|\b(?:would|could|will) you (?:please|kindly)\b|,\s*please[.!]|\bbe advised\b|\bRSVP\b|\bwe hope you will\b/i

/** 2인칭이 이만큼은 나와야 「부른다」고 본다. 한 번은 스쳐 지나가는 일반 호칭일 수 있다. */
export const SECOND_PERSON_FLOOR = 2

function countMatches(text: string, re: RegExp): number {
  return (String(text ?? '').match(re) ?? []).length
}

/**
 * **따옴표 안은 인물이 인물에게 하는 말이다 — 필자가 독자에게 하는 말이 아니다.**
 *
 * ⚠️ 이 구별이 없으면 소설 대사가 통째로 요청으로 읽힌다. 실측 2026-09-15, V5 후보 5편 중:
 *
 *     `"You have informed me of that point before. Please proceed,"` (*The Funny Side of Physic*)
 *
 *   의사가 환자에게 하는 말이지 필자가 독자에게 하는 말이 아니다. 18번의 정답은
 *   **필자가 독자에게** 시키는 행위이므로, 인물의 대사는 근거가 될 수 없다.
 *
 * 짝이 맞는 큰따옴표 안만 지운다 — **홀로 선 따옴표는 건드리지 않는다**(어디까지가
 * 대사인지 모르는데 지우면 본문을 잃는다. `pairStraightQuotes` 가 같은 이유로 그렇게 한다).
 */
export function dropQuotedSpeech(text: string): string {
  return String(text ?? '')
    .replace(/“[^”]{0,600}”/g, ' ')
    .replace(/"[^"]{0,600}"/g, ' ')
}

/**
 * 목적(18번)을 떠받치는가 — **부르고**(수신자) **시켜야**(요청 행위) 한다.
 *
 * 실측 2026-09-15: 저장된 purpose 86건 중 통과 **0**. 떨어뜨리는 것이 목적이 아니라,
 * **이 유형은 가진 원문으로 만들 수 없다**는 사실을 숫자로 말하는 것이 목적이다 —
 * 그러면 다음에 할 일이 「거르기」가 아니라 **「원문을 쓰기」**로 분명해진다.
 */
export function bearsPurpose(passage: string): TypeFit {
  // **인사말은 원문에서 본다** — 편지 첫 줄의 `Dear …,` 가 따옴표에 들어가는 일은 없고,
  //   반대로 서간체 소설은 편지를 통째로 인용하기도 한다(그건 진짜 편지다).
  const text = String(passage ?? '')
  // 나머지 판정은 **대사를 뺀 글**로 한다 — 필자가 독자에게 하는 말만 센다.
  const narration = dropQuotedSpeech(text)
  const addressed =
    SALUTATION.test(text) || countMatches(narration, SECOND_PERSON) >= SECOND_PERSON_FLOOR
  if (!addressed) return { ok: false, judged: true, reason: 'no_addressee' }
  if (!IMPERATIVE_PLEASE.test(narration) && !REQUEST_ACT.test(narration)) {
    return { ok: false, judged: true, reason: 'no_request_act' }
  }
  return { ok: true, judged: true, reason: null }
}

/**
 * 의무·당위 표현 — **주장(20번)의 정답이 되는 문장의 자국.**
 *
 * 정본은 `docs/CSAT_TYPE_BLUEPRINTS.md` §R-CLAIM 출제 명제다:
 *
 *   > 정답은 지문에서 **의무·당위 표현(should·must·need to·명령문)** 이 붙은 문장의
 *   > 재진술이다.
 *
 * ⚠️ **`must be` 는 좁히지 않는다.** 추측으로도 쓰이지만(`He must be tired`) 당위로도 쓰이고
 *   (`must be protected` · `must be taught`), 좁혀 보니 잃는 쪽이 컸다.
 *
 * ⚠️ **완료형은 뺀다 — `must/should + have` 는 당위가 아니다.** 실측 2026-09-15: 게이트를
 *   켜고 뽑은 첫 8편을 읽으니 다섯이 오탐이었고, 그중 **셋이 이 한 꼴**이었다:
 *
 *     `Her influence must have been widespread`        (Sappho 전기 — 추측)
 *     `That pile must have been the accumulation …`    (Whitman 방 묘사 — 추측)
 *     `measures … should have a significant impact`    (논문 — 예측)
 *
 *   셋 다 필자가 독자에게 무엇을 하라는 말이 아니다. 완료형 `have` 가 뒤따르면 그 자리는
 *   **추측·예측·반사실**이지 의무가 아니므로 당위에서 제외한다.
 *   (`must have to` 같은 겹침은 실재하지 않아 따로 보지 않는다.)
 *
 * ⚠️ **남는 오탐 둘은 이 규칙으로 못 잡는다** — 같은 실측에서 확인했다:
 *     · 제3자에 대한 서술 속 `should`(`no reason why he should place obstacles` — 회고록)
 *     · 보도문이 **남의 말을 옮긴** `should`(`Russia should be ready …` — 트윗 인용 기사)
 *   둘 다 구문이 아니라 **화자가 누구인가**의 문제라 정규식 밖이다. 적어 두는 이유는,
 *   다음 사람이 이것을 새 결함으로 다시 조사하지 않게 하기 위해서다.
 */
const EPISTEMIC_PERFECT = /\b(?:should|must|ought to)\s+have\b/gi
/**
 * ⚠️ **`need to` 는 명사이기도 하다.** 실측 2026-09-15 두 번째 표본에서 걸렸다:
 *   `but little leisure, freedom, wealth, security, or economic need to make such education
 *   possible` — 여기서 `need` 는 명사고 `to` 는 그 명사에 붙은 부정사다. 조동사가 아니다.
 *   앞에 관사·한정사·형용사가 오면 명사로 보고 뺀다.
 */
const NOUN_NEED =
  /\b(?:a|an|the|no|any|this|that|some|little|great|urgent|real|dire|special|economic|financial|pressing)\s+needs?\s+to\b/gi
const DEONTIC =
  /\b(?:should|must|ought to|need(?:s)? to|have to|has to|it is (?:essential|necessary|vital|important|crucial) (?:that|to))\b/i

/**
 * 주장(20번)을 떠받치는가 — **당위 표현이 있어야** 재진술할 정답이 생긴다.
 *
 * ── 왜 이 규칙이 생겼나 (실측 2026-09-15) ────────────────────────────
 * `claim` 청크를 채우려고 지문 8편을 읽었더니 여섯 편이 순수 서술문이었다(러시아 영토
 * 분석 · 나사 절삭기 역사 · 연잎 발수 보도 · 라틴어 교재 목록 · 등대 공사 일지).
 * 그런 글에 「필자가 주장하는 바는?」을 물으면 정답은 **필자의 당위가 아니라 내용 요약**이
 * 되고, 요지 문항이 주장 딱지를 달고 나간다.
 *
 * 표본이 아니라 구조였다 — 저장된 `claim` **52건 중 당위 표현이 있는 것 8건(15.4%)**,
 * 없는 것 **44건(84.6%)**. `purpose` 가 86건 중 0건이었던 것과 같은 자국이고, 원인도 같다:
 * **규칙이 문서에만 있고 코드에 닿지 않았다.**
 *
 * ⚠️ **`purpose` 와 달리 이 유형은 만들 수 있다.** 창(90~220어) 안 지문 중 당위 표현을
 *   가진 것이 V5 **535** · V6 **173** · V7 **57** 편이다(실측 2026-09-15). 그러니 이 게이트는
 *   막는 것이 아니라 **뽑기를 옳은 지문 쪽으로 돌린다.**
 *
 * ⚠️ **「한 번만 나와야 한다」로 좁히지 않는다.** 설계도는 당위가 지문에 하나뿐이도록
 *   *설계하라*고 하지만, 그것은 지문을 **쓸 때**의 지침이다. 찾아 쓰는 글에서 당위가 둘이어도
 *   같은 주장을 떠받치면 문항은 선다. 이 파일의 계약은 **필요조건만 적는 것**이므로
 *   (머리말 §무엇을 하지 않는가) 여기서는 ≥1 만 본다. 참고로 정확히 1회는 V5 411 · V7 49 다.
 *
 * ⚠️ 판정은 **대사를 뺀 글**로 한다 — 인물이 "You must go" 라고 말한 것은 필자가 독자에게
 *   하는 주장이 아니다(`bearsPurpose` 와 같은 이유).
 */
export function bearsClaim(passage: string): TypeFit {
  // 완료형 추측(`must have been`)을 먼저 지운다 — 남은 자리에 진짜 당위가 있는지 본다.
  // 지우지 않고 「완료형이 아닌 것도 있나」를 따로 세면 같은 문장을 두 번 훑게 된다.
  const narration = dropQuotedSpeech(String(passage ?? ''))
    .replace(EPISTEMIC_PERFECT, ' ')
    .replace(NOUN_NEED, ' ')
  if (!DEONTIC.test(narration)) return { ok: false, judged: true, reason: 'no_deontic' }
  return { ok: true, judged: true, reason: null }
}

/**
 * 규칙이 있는 유형만 적는다. **없는 유형을 여기 빈 규칙으로 채우지 않는다** —
 * 그러면 미판정이 통과로 둔갑한다.
 */
const RULES: Record<string, (passage: string) => TypeFit> = {
  purpose: bearsPurpose,
  claim: bearsClaim,
}

/** 이 유형에 적합 규칙이 있는가. */
export function hasTypeFitRule(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(RULES, type)
}

/**
 * 이 지문이 이 유형을 떠받칠 수 있는가.
 *
 * @returns 규칙이 없으면 `{ ok: true, judged: false }` — **통과가 아니라 미판정이다.**
 *   부르는 쪽이 `judged` 를 보고 세야 한다.
 */
export function bearsType(type: string, passage: string): TypeFit {
  const rule = RULES[type]
  if (!rule) return { ok: true, judged: false, reason: null }
  return rule(passage)
}

/** 사유를 사람 말로 — 드레인·조판이 세어 찍는 자리에 쓴다. */
export const TYPE_FIT_REASON_KO: Record<TypeFitReason, string> = {
  no_addressee: '수신자가 없다 — 아무도 부르지 않는 글에는 목적이 없다',
  no_request_act: '요청 행위가 없다 — 정답이 될 문장이 지문에 없다',
  no_deontic: '당위 표현이 없다 — 서술문에 주장을 물으면 정답이 요지가 된다',
}
