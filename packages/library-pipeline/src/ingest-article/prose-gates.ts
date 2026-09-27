// packages/library-pipeline/src/ingest-article/prose-gates.ts
//
// **적재 전 본문 게이트** — 넣고 나서는 못 고치는 오염을 수집기 공통으로 막는다.
//
// ── 왜 수집기마다가 아니라 여기인가 ──────────────────────────────────
// 같은 결함이 원천을 가리지 않고 나왔다. 「본문만 자국어」는 OpenAlex·OLH·
// The Conversation 셋 다에서, 리가처·하이픈·2단 조판은 **PDF 를 쓰는 모든 수집기**에서
// 나왔다(`docs/reports/sources-window-supply.md` §2 G-a~G-q). 수집기마다 따로 두면
// 같은 것을 다르게 재게 되고, 고친 곳과 안 고친 곳이 갈린다.
//
// ⚠️ 여기 있는 임계값은 **전부 실측에서 나왔다.** 바꾸려면 표본을 다시 재라 —
//    근거 없는 수를 넣으면 「멀쩡한 글이 사라지는데 아무도 모르는」 상태가 된다.
//
// ⚠️ **G-a(OpenAlex 스팸·SEO 6%)는 여기 없다.** 표본 6.0% 라는 수는 있지만 실물 본문이
//    저장돼 있지 않아 어떤 문자열로 걸리는지 확인할 수 없다. 짐작으로 정규식을 굳히면
//    「무엇을 거르는지 아무도 모르는 규칙」이 남는다 — 그건 이 저장소에서 이미 한 번
//    로더 20곳을 걸었던 실수다. 표본을 다시 뽑아 **눈으로 보고** 추가할 것.

// ── G-b · G-e · G-i · G-o: 본문이 영어인가 ────────────────────────────
//
// 선언 필드(`language`, `<html lang>`)를 못 믿는 것이 세 원천에서 확인됐다:
//   OLH  `language` null 40.3% · 값이 `eng`/`en` 둘로 갈림 → 선언 기준 영어 56.6%,
//        본문 판정 80.5% (영어분 24%p 를 버리고 있었다)
//   The Conversation  `<html lang>` 이 전 페이지 `en-GLOBAL` — africa/2024 슬러그의
//        22.8% 가 프랑스어인데 선언은 전부 영어다
//   OpenAlex  `language:en` 질의에 비영어가 샌다. ★**본문이 비영어인 비율이 초록의
//        40~60배**(초록 0.5% → 본문 18.5~29.6%) — 영어 제목 + 영어 초록인데 본문만
//        자국어인 논문이 많다.
//
// 그래서 **선언이 아니라 본문**으로 판정한다. 두 자를 함께 쓴다:
//   ① 라틴문자 비율 — 키릴·아랍·한자를 잡는다
//   ② 영어 기능어 비율 — 라틴문자를 쓰는 독일어·폴란드어·포르투갈어를 잡는다
// ①만으로는 ②가 안 잡히고, ②만으로는 로마자 전사 비영어가 통과한다.

/** 기능어 목록 — `scripts/csat/source-doc-inspect.mts` 와 **같은 목록**이다. 갈리면 두 자가 다른 것을 잰다. */
const ENGLISH_FUNCTION_WORDS = new Set(
  ('the of and to in a is that for it as with was on be by are this not from or an at ' +
    'which have has but they we their can more one all other than when')
    .split(' '),
)

/**
 * 라틴문자 비율 — 글자 중 ASCII a–z 의 몫. 숫자·문장부호·공백은 세지 않는다.
 *
 * 임계 **0.70**. 실측 27편에서 비영어 문서의 값은 0.015 · 0.088 · 0.108 이고
 * 영어 문서는 전부 **0.99 이상**이었다 — 사이에 아무것도 없다.
 */
export function latinRatio(text: string): number {
  const letters = text.match(/\p{L}/gu) ?? []
  if (!letters.length) return 0
  let latin = 0
  for (const ch of letters) if (/[A-Za-z]/.test(ch)) latin++
  return latin / letters.length
}

/**
 * 영어 기능어 비율 — 앞 5,000 토큰에서 기능어가 차지하는 몫.
 *
 * 50토큰 미만이면 **0 을 돌려준다**(판정하지 않는다는 뜻). 짧은 글에서 이 비율은
 * 우연히 튄다 — 그걸 판정으로 쓰면 결측을 비영어로 오인한다.
 *
 * 임계 **0.15**. 실측 27편(라틴문자 문서만):
 *   영어   최소 0.266 · 중앙 0.404 · 최대 0.452
 *   비영어 최대 0.061 (0.029 · 0.036 · 0.038 · 0.043 · 0.061)
 * **0.061 과 0.266 사이가 비어 있다.** 0.15 는 그 빈 구간의 한가운데다 —
 * 어느 쪽으로 4배 넘게 여유가 있으므로 표본이 얇아도 뒤집히기 어렵다.
 */
export function englishFunctionWordRatio(text: string): number {
  const toks = (text.toLowerCase().match(/[a-z]+/g) ?? []).slice(0, 5000)
  if (toks.length < 50) return 0
  let hit = 0
  for (const t of toks) if (ENGLISH_FUNCTION_WORDS.has(t)) hit++
  return hit / toks.length
}

export const LATIN_RATIO_MIN = 0.7
export const ENGLISH_FUNCTION_RATIO_MIN = 0.15
/** 이 아래면 판정하지 않는다 — 「비영어」가 아니라 「모름」이다. */
export const ENGLISH_JUDGEABLE_TOKENS = 50

export interface EnglishVerdict {
  english: boolean
  /** 판정을 내리기에 본문이 모자란 경우. `english` 는 false 지만 **비영어라는 뜻이 아니다.** */
  undecidable: boolean
  latin: number
  functionWords: number
  why: string
}

/**
 * 본문이 영어인가. 선언 필드를 보지 않는다 — 셋 다 틀린 것이 실측됐다.
 *
 * ⚠️ `undecidable` 을 「비영어」로 합치지 마라. 본문 결측을 비영어로 세면
 *    「이 원천은 영어가 아니다」는 **없는 진단**이 만들어진다 — 같은 실수를
 *    「짧다 vs 없다」에서 세 번 했다(OLH 875건 중 853이 결측이었다).
 */
export function judgeEnglishBody(text: string): EnglishVerdict {
  const toks = (text.toLowerCase().match(/[a-z]+/g) ?? []).length
  const latin = latinRatio(text)
  const fw = englishFunctionWordRatio(text)

  if (toks < ENGLISH_JUDGEABLE_TOKENS) {
    return { english: false, undecidable: true, latin, functionWords: fw, why: `본문 ${toks}토큰 — 판정 불가` }
  }
  if (latin < LATIN_RATIO_MIN) {
    return { english: false, undecidable: false, latin, functionWords: fw, why: `라틴문자 ${(latin * 100).toFixed(1)}% < 70%` }
  }
  if (fw < ENGLISH_FUNCTION_RATIO_MIN) {
    return { english: false, undecidable: false, latin, functionWords: fw, why: `영어 기능어 ${(fw * 100).toFixed(1)}% < 15%` }
  }
  return { english: true, undecidable: false, latin, functionWords: fw, why: '' }
}

// ── G-j: 문장부호가 다음 낱말에 붙는다 ────────────────────────────────
/**
 * `…sentence.Next…` → `…sentence. Next…`
 *
 * **대문자 조건이 필수다.** 소문자가 뒤따르는 경우(`e.g`·`i.e`·`www.example`)를
 * 건드리면 멀쩡한 약어가 쪼개진다.
 *
 * 영향이 계산기마다 다르다: 낱말을 `[A-Za-z][A-Za-z'-]*` 로 세는 쪽은 이미 2낱말로
 * 세므로 **어수가 안 바뀐다**. 문장 분할을 쓰는 쪽에만 필요하다 —
 * 안 고치면 두 문장이 한 문장으로 붙어 평균 문장 길이가 조용히 부푼다.
 * 실측: OpenAlex 표본 174편에 756곳 · PDF 추출 본문 19편에 59곳.
 */
export function unglueSentencePunctuation(text: string): string {
  return text.replace(/([a-z0-9)\]”"'])([.!?])([A-Z])/g, '$1$2 $3')
}

// ── G-p: 리가처 · 줄바꿈 하이픈 ───────────────────────────────────────
const LIGATURES: ReadonlyArray<readonly [RegExp, string]> = [
  [/ﬀ/g, 'ff'],
  [/ﬁ/g, 'fi'],
  [/ﬂ/g, 'fl'],
  [/ﬃ/g, 'ffi'],
  [/ﬄ/g, 'ffl'],
  [/ﬅ/g, 'st'],
  [/ﬆ/g, 'st'],
]

/**
 * 합자를 푼다 — `Shefﬁeld` → `Sheffield` · `beneﬁts` → `benefits`.
 *
 * 안 풀면 그 낱말이 **어휘 목록 밖**으로 집계돼 off-list 비율이 부푼다.
 * 실측: PDF 본문 19편 중 3편 · 393자.
 */
export function expandLigatures(text: string): string {
  let t = text
  for (const [re, to] of LIGATURES) t = t.replace(re, to)
  return t
}

/**
 * 줄바꿈 하이픈만 잇는다 — `three-\ndimensional` 을 **`threedimensional` 로 만들지 않는다.**
 *
 * ⚠️ 줄 끝 하이픈을 무조건 지우면 **진짜 하이픈을 먹는다.** `three-dimensional` 처럼
 *    원래 하이픈이 있는 낱말이 줄 끝에 걸린 경우를 구별할 수 없기 때문이다.
 *    그래서 **하이픈을 남긴 채로만 잇는다** — 뒤 조각이 소문자로 시작할 때에 한해
 *    줄바꿈을 지우고 하이픈은 그대로 둔다. 하이픈이 원래 없던 낱말은
 *    `sheffi-\neld` 처럼 사전에 없는 꼴이 되므로 **사전 대조로 나중에 고칠 수 있다.**
 *    지워 버리면 그 정보가 사라져 되돌릴 방법이 없다.
 */
export function joinLineBreakHyphens(text: string): string {
  return text.replace(/-[ \t]*\r?\n[ \t]*([a-z])/g, '-$1')
}

// ── G-q: 2단 조판이 단별 블록으로 나온다 ─────────────────────────────
/**
 * `pdftotext` 가 2단 조판을 단별 블록으로 뱉는다 — 한 블록이 문장 중간에서 끝난다.
 * 「종결부호로 끝나야 산문」 규칙을 그대로 걸면 **12,171어가 778어가 된다**(실측:
 * 본문 80블록 중 28이 단 경계). 그래서 **먼저 이어 붙인 뒤** 문장을 나눈다.
 *
 * 이어 붙이는 조건: 앞 블록이 종결부호로 안 끝나고, 뒤 블록이 소문자로 시작한다.
 * 둘 다 맞아야 한다 — 하나만 보면 제목·머리글이 본문에 붙는다.
 */
export function joinColumnBlocks(blocks: readonly string[]): string[] {
  const out: string[] = []
  for (const raw of blocks) {
    const b = raw.trim()
    if (!b) continue
    const prev = out[out.length - 1]
    if (prev && !/[.!?][”"')\]]?$/.test(prev) && /^[a-z]/.test(b)) {
      out[out.length - 1] = `${prev} ${b}`
      continue
    }
    out.push(b)
  }
  return out
}

// ── G-k: JATS list-item 폭발 ──────────────────────────────────────────
/**
 * Janeway 의 DOCX→JATS 변환이 **들여쓰기한 원고를** `<list><list-item>` 으로 바꾼다.
 * 한 편에 list-item 이 2,256개 나온 적이 있다. 이건 목록이 아니라 산문이 쪼개진 것이고,
 * 안 거르면 **장문 토막이 8% 부푼다** — 파편이 토막으로 세어지기 때문이다.
 *
 * 목록이 진짜 목록인지 아닌지는 **항목 수와 길이**로 갈린다: 진짜 목록은 항목이
 * 적고 짧다. 산문이 쪼개진 것은 항목이 수백~수천 개인데 각 항목이 문장 길이다.
 */
export function looksLikeShreddedProse(items: readonly string[]): boolean {
  if (items.length < 50) return false
  const words = items.map((s) => (s.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length)
  const long = words.filter((w) => w >= 12).length
  return long / items.length >= 0.5
}

// ── 한데 모아 쓰는 자리 ───────────────────────────────────────────────
export interface BodyScreen {
  /** 정규화까지 마친 본문. 판정이 실패해도 이 값은 채워진다(왜 떨어졌는지 보려면 필요하다). */
  text: string
  ok: boolean
  reasons: string[]
  english: EnglishVerdict
  fixes: { ligatures: number; unglued: number; hyphenJoins: number }
}

/**
 * 수집기가 본문 하나를 적재 직전에 통과시키는 자리.
 *
 * **정규화를 먼저 하고 판정을 나중에 한다.** 순서를 뒤집으면 합자가 안 풀린 채로
 * 어휘·영어 판정에 들어가 멀쩡한 영어가 떨어진다.
 *
 * `blocks` 를 넘기면 G-q(2단 이어 붙이기)를 먼저 적용한다 — PDF 추출 경로용이다.
 */
export function screenBody(input: string | readonly string[]): BodyScreen {
  const joined = typeof input === 'string' ? input : joinColumnBlocks(input).join('\n\n')

  const beforeLig = joined
  const lig = expandLigatures(joined)
  const ligatures = countDiff(beforeLig, lig, /[ﬀ-ﬆ]/g)

  const hy = joinLineBreakHyphens(lig)
  const hyphenJoins = countDiff(lig, hy, /-[ \t]*\r?\n[ \t]*[a-z]/g)

  const text = unglueSentencePunctuation(hy)
  const unglued = countDiff(hy, text, /([a-z0-9)\]”"'])([.!?])([A-Z])/g)

  const english = judgeEnglishBody(text)
  const reasons: string[] = []
  if (!english.english) reasons.push(english.why)

  return { text, ok: reasons.length === 0, reasons, english, fixes: { ligatures, unglued, hyphenJoins } }
}

function countDiff(before: string, after: string, re: RegExp): number {
  if (before === after) return 0
  return (before.match(re) ?? []).length
}
