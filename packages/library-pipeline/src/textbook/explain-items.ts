// packages/library-pipeline/src/textbook/explain-items.ts
//
// **결정론 해설 — 단원·어법·어휘 유형.**
//
// ── 왜 필요한가 (실측) ──────────────────────────────────────────────
// 2026-08-30 시중 교재 79종 5,214쪽을 재서 시장 규격을 고정했다
// (`market-spec.json` · `scripts/textbook-corpus/market-spec.mjs`). 그 결과:
//
//   해설 보유율   시중 사실상 100%  ↔  우리 **2.7%** (463/17,206)
//   해설 길이     시중 중앙 143자 (p25 75 ~ p90 473)
//   오답 배제     시중 53.6%
//   원문 인용     시중 49.7%
//
// 깊이는 이미 이겼다(우리 해설 중앙 399자 · 인용 98.7%). **문제는 97%에 해설이 없다는 것**이다.
// 해설이 없는 교재는 다른 게 아무리 좋아도 혼자 공부할 수 없다 — 시장이 교재를 고르는 첫 기준이다.
//
// ── 왜 결정론인가 ──────────────────────────────────────────────────
// `explain.ts`(순서·삽입)는 지문 결속을 읽어야 해서 표면 단서로는 15%밖에 못 쓴다.
// 그런데 여기 7유형은 사정이 다르다 — **정답 근거가 문항 안에 이미 들어 있다.**
// `unit_vocab` 은 정답 뜻과 오답 뜻이 `choices` 에 있고, `grammar_fix` 는 규칙 이름이
// `answer_key.rule` 에 있다. 읽어서 알아내야 할 것이 없으므로 100% 쓸 수 있다.
//
// ── 규격을 지킨다 ──────────────────────────────────────────────────
// 모든 해설은 (1) 원문을 인용하고 (2) 선택지가 있으면 오답을 배제하며
// (3) 75자 이상이 되도록 쓴다. 473자를 넘으면 인용을 줄인다 — 길면 안 읽는다.

import { hasFinalConsonant } from './explain'
import { headNounAt, looksModifier as looksModifierShared, looksPlural, standardArticle } from './grammar-choice'

/** 시장 규격 — `market-spec.json` 의 `explanation.lengthChars` p25/p90 실측값. */
export const EXPLANATION_CHARS = { min: 75, max: 473 } as const

/**
 * **해설이 갖춰야 할 두 가지** — 시중 해설지를 실측해서 나온 조건이다.
 *
 *   오답 배제 언급률  시중 **53.6%**   (`market-spec.json` explanation.wrongOptionMentionRate)
 *   원문 인용률       시중 **49.7%**   (같은 파일 sourceCitationRate)
 *
 * 시중 해설의 절반은 "왜 나머지가 아닌지" 를 적고, 절반은 지문의 영어를 그대로 따온다.
 * 둘 다 학습자가 **자기 오답을 스스로 확인**하는 데 쓰는 장치다.
 *
 * ⚠️ **여기 한 벌만 둔다** (2026-08-31). 이 두 규칙은 원래 `market-benchmark.mjs` 안에만
 *   있었고, 집필 지침(`item-drain-export.mjs`)에도 적재 게이트에도 없었다. 그 결과
 *   Claude Code 가 손으로 쓴 초등 87문항의 해설이 개념 설명만 하고 원문을 인용하지도
 *   오답을 짚지도 않아, 같은 권에서 **A3 7.0% · A4 31.7%** 로 나왔다 —
 *   기계가 만든 결정론 해설은 같은 축에서 99.9% 였다. **사람이 쓴 쪽이 더 나빴다.**
 *   재는 자에만 있고 쓰는 자리에는 없는 기준은 지켜지지 않는다.
 */
export const EXPLANATION_MENTIONS_WRONG = /오답|나머지|적절하지 않|틀린 이유|[①②③④⑤]/
/** 영어 낱말 두 개 이상을 이어 따온 자리 — 지문에서 근거를 그대로 가져왔다는 표시. */
export const EXPLANATION_QUOTES_SOURCE = /[A-Za-z]{4,}[^가-힣]{0,3}[A-Za-z]{4,}/

/** 앞말 받침에 맞는 조사. `explain.ts` 와 같은 규칙을 쓴다. */
function josa(word: string, [withBatchim, without]: readonly [string, string]): string {
  return hasFinalConsonant(word) ? withBatchim : without
}
const EUN_NEUN = ['은', '는'] as const
const I_GA = ['이', '가'] as const
/** 서술격 조사 — `"이른" 다` 가 아니라 `"이른" 이다` 여야 한다. */
const I_DA = ['이다', '다'] as const
/**
 * ⚠️ **조사를 템플릿에 박지 않는다** (3인 검수 실측 2026-09-14).
 *
 * `josa()` 헬퍼가 있는데도 여러 자리가 `가`·`는`·`를` 를 그대로 박고 있었다. 그래서
 * 지면에 `"spring" 는`·`"rising" 가`·`"their necks" 를` 가 인쇄됐다 — 한 검수자가
 * **10건 중 6건이 틀렸다**고 셌다. 영어 낱말은 한국어 끝소리로 받침을 판정해야 한다
 * (`hasFinalConsonant` — spring 스프링 → 받침 있음 → `은`).
 */
const EUL_REUL = ['을', '를'] as const
const WA_GWA = ['과', '와'] as const

/**
 * 인용이 길면 앞뒤를 잘라 규격 안에 넣는다. 잘랐다는 것을 말줄임으로 보인다.
 *
 * ⚠️ **낱말 가운데를 자르지 않는다.** 여기가 `slice(0, limit - 1)` 뿐이었다 —
 *   3인 검수 chunk-01 이 실물로 짚었다:
 *
 *     `…one in Montana and one in Washingt…`
 *     `…controlling the pollution o…`
 *
 *   같은 파일이 「낱말 가운데도 인용 가운데도 아니게」를 길게 적어 두고 그 규칙을
 *   `finish()`(해설 전체 길이)에만 적용했다. `quote()` 는 **모든 흐름무관 해설의
 *   첫 문장**에 쓰이는데 그 규칙이 안 걸려 있었다 — 자가 둘이면 한쪽만 좋아진다.
 *
 * ⚠️ **물러서다 너무 많이 잃으면 그냥 자른다.** 마지막 공백이 앞쪽에 있는 경우
 *   (긴 URL·화학식 한 덩어리) 낱말 경계를 지키려다 인용이 반토막 난다. 실측 규칙과
 *   같은 몫(60%)을 하한으로 둔다 — `trimExplanation` 이 쓰는 그 값이다.
 */
export function quote(sentence: string, limit = 150): string {
  const s = sentence.replace(/\s+/g, ' ').trim()
  if (s.length <= limit) return s
  const hard = s.slice(0, limit - 1)
  const lastSpace = hard.lastIndexOf(' ')
  const cut = lastSpace >= Math.floor((limit - 1) * 0.6) ? hard.slice(0, lastSpace) : hard
  return `${cut.trimEnd()}…`
}

/**
 * **보여 주려는 낱말이 들어간 구간**을 인용한다.
 *
 * 앞에서부터 자르면 정작 보여 줘야 할 자리가 잘려 나간다 — 어휘 교체 해설에서
 * 바뀐 낱말이 안 보이면 해설이 아무것도 말하지 않는 것과 같다(테스트가 이걸 잡았다).
 */
/**
 * 초점 낱말의 자리 — **낱말 단위로** 찾는다. 없으면 `-1`.
 *
 * ⚠️ 여기가 `indexOf` 였다 — 부분 문자열이라 짧은 기능어가 남의 낱말 속에 걸렸다
 *   (실측 2026-09-13: 관사 `an` 이 `Import**an**tly` 의 5번째 자리에 걸려, 인용 창이
 *   문장 첫머리에 잡히고 **정작 틀린 자리는 창 밖으로 밀려났다**. 해설은
 *   「"model"은 자음 소리로 시작하므로」라고 적는데 인용문에 model 이 없다).
 *   어법 두 유형의 밑줄은 전부 `a`·`an`·`this`·`that` 같은 짧은 낱말이라
 *   **구조적으로 이 함정 위에 있었다.**
 */
function wordIndex(haystack: string, needle: string): number {
  if (!needle) return -1
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // 앞뒤가 글자·아포스트로피가 아니어야 한 낱말이다(`\b` 는 `'` 를 경계로 봐서 못 쓴다).
  const m = new RegExp(`(^|[^A-Za-z'])(${esc})(?![A-Za-z'])`, 'i').exec(haystack)
  return m ? m.index + m[1]!.length : -1
}

function quoteAround(sentence: string, focus: string, limit = 130): string {
  const s = sentence.replace(/\s+/g, ' ').trim()
  if (s.length <= limit) return s
  // 낱말로 못 찾으면 부분 문자열로 물러선다 — 굴절형·복합어가 그렇게만 잡힌다.
  const at = focus ? (() => {
    const w = wordIndex(s, focus)
    return w >= 0 ? w : s.toLowerCase().indexOf(focus.toLowerCase())
  })() : -1
  if (at < 0) return quote(s, limit)
  const half = Math.floor((limit - focus.length) / 2)
  let start = Math.max(0, at - half)
  let end = Math.min(s.length, at + focus.length + half)
  // 낱말 가운데서 자르지 않는다.
  if (start > 0) { const sp = s.indexOf(' ', start); if (sp > 0 && sp < at) start = sp + 1 }
  if (end < s.length) { const sp = s.lastIndexOf(' ', end); if (sp > at + focus.length) end = sp }
  return `${start > 0 ? '…' : ''}${s.slice(start, end).trim()}${end < s.length ? '…' : ''}`
}

/** 어법 규칙 이름 → 한국어 설명. `answer_key.rule` 에 실제로 들어 있는 값만 담는다. */
const RULE_KO: Record<string, { name: string; why: (wrong: string, right: string, next: string) => string }> = {
  article: {
    name: '관사',
    why: (wrong, right, next) =>
      next
        ? `관사는 철자가 아니라 뒤 낱말의 첫소리에 맞춘다 — "${next}"${josa(next, EUN_NEUN)} ${/^[aeiou]/i.test(next) ? '모음' : '자음'} 소리로 시작하므로 "${right}"${josa(right, I_GA)} 맞고 "${wrong}"${josa(wrong, EUN_NEUN)} 틀리다.`
        : `관사는 뒤 낱말의 첫 소리에 맞춘다 — 여기서는 "${right}"${josa(right, I_GA)} 맞고 "${wrong}"${josa(wrong, EUN_NEUN)} 틀리다.`,
  },
  demonstrative: {
    name: '지시어',
    why: (wrong, right, next) =>
      next
        ? `지시어는 뒤 명사의 수에 맞춘다 — "${next}"${josa(next, I_GA)} ${looksPlural(next) ? '복수' : '단수'}이므로 "${right}"${josa(right, I_GA)} 맞고 "${wrong}"${josa(wrong, EUN_NEUN)} 틀리다.`
        : `지시어는 뒤 명사의 수에 맞춘다 — 여기서는 "${right}"${josa(right, I_GA)} 맞고 "${wrong}"${josa(wrong, EUN_NEUN)} 틀리다.`,
  },
}

/** 규칙 이름이 없을 때 정답 형태에서 규칙을 되짚는다. `unit_grammar` 에는 `rule` 이 없다. */
export function inferRule(correct: string): 'article' | 'demonstrative' | null {
  const w = correct.toLowerCase().replace(/[^a-z]/g, '')
  if (w === 'a' || w === 'an') return 'article'
  if (['this', 'that', 'these', 'those'].includes(w)) return 'demonstrative'
  return null
}

function bare(token: string): string {
  return token.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '')
}

/**
 * 그 낱말이 **답이 아닌 다른 문장에** 그대로 남아 있는가 — 남아 있으면 그 자리가 근거다.
 *
 * ⚠️ 이것은 `vocab-choice.ts` 의 설계(바꿀 낱말은 글 안에 두 번 이상 나와야 한다)를
 *   **확인**하는 함수이지 가정하는 함수가 아니다. 확인이 안 되면 `null` 이고, 그때 해설은
 *   그 문장을 아예 언급하지 않는다 — 없는 근거를 「있다」고 적는 것이 이 파일이 고친 결함이다.
 *
 * 토큰을 통째로 견준다(`bare` 로 구두점을 벗긴 뒤 정확히 일치). 부분 일치를 허용하면
 * `increase` 가 `increased` 를 잡아 **굴절형을 원형이라고 말하게 된다** — 이 유형은
 * 굴절형을 일부러 안 건드리므로(그쪽 머리말 참조) 그 구별이 사실 판정에 그대로 걸린다.
 */
function sentenceStillHolding(
  sentences: readonly string[],
  word: string,
  skipIdx: number,
): number | null {
  const target = bare(word).toLowerCase()
  if (!target) return null
  for (let i = 0; i < sentences.length; i += 1) {
    if (i === skipIdx) continue
    const s = sentences[i] ?? ''
    if (s.split(/\s+/).some((t) => bare(t).toLowerCase() === target)) return i
  }
  return null
}

/** 밑줄 낱말 바로 뒤 낱말 — 관사 판정의 근거가 되는 자리다(관사는 **바로 뒤 소리**를 본다). */
function wordAfter(sentence: string, target: string, tokenIdx?: number): string {
  const tokens = sentence.split(/\s+/)
  if (typeof tokenIdx === 'number' && tokens[tokenIdx] != null) {
    return bare(tokens[tokenIdx + 1] ?? '')
  }
  const i = tokens.findIndex((t) => bare(t).toLowerCase() === target.toLowerCase())
  return i >= 0 ? bare(tokens[i + 1] ?? '') : ''
}

/** 수식어로 보이는 낱말 — 이걸 명사라고 지목하면 해설이 사실과 어긋난다. */
/**
 * ⚠️ **자를 여기 베껴 적지 않는다.** 수식어 판정과 머리 명사 찾기는 생성기
 * (`grammar-choice`)가 정본이다 — 2026-09-13 에 생성기가 바로 뒤 낱말로 판정해
 * `these late hour` 문항을 만들고, 이 파일은 머리 명사를 제대로 찾아 **둘이 갈렸다.**
 * 해설만 옳아도 문항이 틀리면 소용이 없다.
 */
const looksModifier = looksModifierShared

/**
 * 지시어가 받는 **머리 명사**를 찾는다.
 *
 * 바로 뒤 낱말을 그냥 쓰면 `those AI-focused data centers` 에서 형용사 `AI-focused` 를
 * 명사라고 부르게 된다 — 실제로 그런 해설이 나왔다. 해설이 사실과 어긋나면
 * 해설이 없느니만 못하다. 그래서 수식어로 보이는 것을 건너뛰고, **3칸 안에 못 찾으면
 * 이름을 대지 않는다**(빈 문자열 → 낱말을 지목하지 않는 문장으로 떨어진다).
 */
function headNounAfter(sentence: string, target: string, tokenIdx?: number): string {
  // ⚠️ 여기가 `/s+/` 로 적혀 있었다 — 백슬래시 하나가 빠져 **리터럴 s 로 쪼개고 있었다**
  //   (실측 2026-09-13: "This collectives are typically organized loosely…" 에서 머리 명사가
  //   `"aretypicallyorganizedloo"` 로 나왔고, 그 뭉개진 토큰이 단수로 판정돼 해설이
  //   「단수이므로 These 가 맞다」는 **자기모순**을 적었다). 저장된 옛 해설은 `"collectives"가
  //   복수이므로` 로 멀쩡했으므로 **이 고장은 적재 이후에 들어왔다** — 즉 지금 상태로 재생성하면
  //   17,619문항이 그 쓰레기를 받는다. 타입도 테스트도 이것을 못 봤다: 두 정규식 다 유효하고
  //   결과는 빈 문자열이 아니라 **그럴듯한 문자열**이라 게이트를 그냥 지난다.
  const tokens = sentence.split(/\s+/)
  let start: number
  if (typeof tokenIdx === 'number' && tokens[tokenIdx] != null) start = tokenIdx + 1
  else {
    const i = tokens.findIndex((t) => bare(t).toLowerCase() === target.toLowerCase())
    if (i < 0) return ''
    start = i + 1
  }
  // **생성기와 같은 함수를 부른다** — 문항을 만든 근거와 해설의 근거가 같아야 한다.
  return headNounAt(tokens, start)
}

/** 1-based 라벨 번호 → 0-based 배열 첨자. 저장 형식이 라벨 번호라 여기서 한 번만 바꾼다. */
function labelToIndex(position: unknown): number | null {
  const n = Number(position)
  return Number.isInteger(n) && n >= 1 ? n - 1 : null
}

const LABELS = ['①', '②', '③', '④', '⑤'] as const

/** 해설 하나의 결과. `null` 은 "이 문항으로는 못 쓴다" 는 뜻이고 그대로 세어야 한다. */
export interface ItemExplanation {
  ko: string
  /** 오답을 실제로 배제했는가 — 시장 기준선 53.6%. */
  hasWrongOption: boolean
  /** 원문을 인용했는가 — 시장 기준선 49.7%. */
  hasCitation: boolean
  /** 어떤 규칙으로 썼는가. 리포트에서 유형별 품질을 가르는 데 쓴다. */
  writer: string
}

type Json = Record<string, unknown>

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

/**
 * 상한을 넘는 해설을 자른다 — **낱말 가운데도, 인용 가운데도 아니게.**
 *
 * ── 3인 검수가 찾아낸 것 (실측 2026-09-14) ──────────────────────────
 * 여기가 `slice(0, max - 1)` 하나였다. 글자 수로만 자르니 지면에 이런 것이 실렸다:
 *
 *     … 문장에 그대로 남아 있다 — "…after initially denying any Libyan respo…
 *
 * `responsibility` 가 **낱말 가운데서** 잘렸고 여는 따옴표가 **닫히지 않았다.**
 * DB 실측: 해설 506,279건 중 **17,467건**이 인용을 연 채로 끝나고, 따옴표 수가 홀수인
 * 것이 **18,211건**이다. 전부 `vocab_choice` 작성기 — 그 유형이 원문을 인용하기 때문이다.
 *
 * ⚠️ **인용을 버리지 않고 닫는다.** 버리면 시중 기준선(원문 인용률 49.7%)에서 멀어지고,
 *   학습자가 자기 오답을 지문에서 확인하는 장치가 사라진다. 닫으면 둘 다 지킨다.
 * ⚠️ **낱말 경계를 먼저 찾는다** — 따옴표만 닫으면 `respo…"` 가 되어 더 이상해진다.
 */
export function trimExplanation(text: string, max: number): string {
  if (text.length <= max) return text
  const floor = Math.floor(max * 0.6)
  const room = text.slice(0, max)

  // ── ① **문장 끝에서 자른다.** 끝나는 문장이 잘린 약속보다 낫다. ─────────
  //
  // ⚠️ 낱말 경계만으로는 모자랐다(실측 2026-09-14, 다시 쓴 55,238건 중 **6,177건**):
  //
  //     … 원래 낱말 "global" 는 2번째 문장에 그대로 남아 있다 —…
  //
  //   이음표에서 끊겨 **인용을 약속해 놓고 아무것도 안 준다.** 따옴표는 짝이 맞으니
  //   앞 판의 검사도 통과한다 — 「짝이 맞다」와 「말이 끝났다」는 다른 것이다.
  //   이 해설의 각 부분은 완결된 문장이므로, 마지막 완결 문장까지만 실으면 깨끗하다.
  const whole = room.match(/^[\s\S]*[.!?]["”']?(?=\s)/)
  if (whole && whole[0].trimEnd().length >= floor) return whole[0].trimEnd()

  // ── ② 문장 끝이 너무 앞이면 낱말 경계에서 자른다 ─────────────────────
  // 닫는 따옴표까지 들어갈 자리를 남긴다 — 잘라 놓고 상한을 넘기면 회귀가 잡는다.
  let cut = text.slice(0, max - 2)
  // ⚠️ 낱말 가운데서 자르지 않는다. 다만 공백이 너무 앞에 있으면(인용이 통째로 길 때)
  //   되돌리지 않는다 — 해설이 최소 길이 아래로 떨어지는 편이 더 나쁘다.
  const sp = cut.lastIndexOf(' ')
  if (sp > 0 && sp >= floor) cut = cut.slice(0, sp)
  // **약속만 남은 이음표를 떼어 낸다** — `… 남아 있다 —…` 처럼 끝나면 안 준 것을 준다고 한 꼴이다.
  cut = cut.trimEnd().replace(/[\s—–:,·-]+$/, '')
  // 따옴표가 홀수면 인용이 열린 채로 끝난 것이다 — 줄임표를 넣고 닫는다.
  const openQuote = (cut.match(/"/g)?.length ?? 0) % 2 === 1
  return openQuote ? `${cut}…"` : `${cut}…`
}

function finish(ko: string, writer: string): ItemExplanation | null {
  const text = ko.replace(/\s+/g, ' ').trim()
  if (text.length < EXPLANATION_CHARS.min) return null
  return {
    ko: trimExplanation(text, EXPLANATION_CHARS.max),
    hasWrongOption: /오답|나머지|적절하지 않|틀린 이유|[①②③④⑤]/.test(text),
    hasCitation: /[A-Za-z]{4,}[^가-힣]{0,3}[A-Za-z]{4,}/.test(text),
    writer,
  }
}

// ── 단원 어휘 (본문 낱말의 뜻 고르기) ────────────────────────────────
/**
 * 정답 근거와 오답 배제가 **문항 안에 이미 다 있다** — 뜻은 `choices` 에,
 * 쓰인 자리는 `sentences` 에. 읽어서 알아낼 것이 없으므로 전건을 쓸 수 있다.
 */
export function explainUnitVocab(payload: Json, answerKey: Json): ItemExplanation | null {
  const target = str(payload.target)
  const choices = arr(payload.choices) as Array<{ text?: string; label?: string }>
  const sentences = arr(payload.sentences).map(str)
  const idx = labelToIndex(answerKey.answer)
  if (!target || idx == null || !choices[idx]) return null

  const correct = str(choices[idx].text)
  const label = str(choices[idx].label) || LABELS[idx] || `${idx + 1}`
  const re = new RegExp(`\\b${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
  const source = sentences.find((s) => re.test(s))

  const others = choices
    .map((c, i) => ({ label: str(c.label) || LABELS[i] || `${i + 1}`, text: str(c.text), i }))
    .filter((c) => c.i !== idx && c.text)

  const parts: string[] = []
  if (source) {
    parts.push(`본문의 "${quoteAround(source, target, 120)}" 에서 "${target}"${josa(target, I_GA)} 쓰인 자리를 보면 뜻이 정해진다.`)
  } else {
    parts.push(`본문에서 "${target}"${josa(target, I_GA)} 쓰인 맥락으로 뜻이 정해진다.`)
  }
  parts.push(`정답은 ${label} "${correct}"${josa(correct, I_DA)}.`)
  if (others.length) {
    parts.push(
      `나머지는 이 자리에 넣으면 문장이 성립하지 않는다 — ${others
        .map((c) => `${c.label} "${c.text}"`)
        .join(' · ')}.`,
    )
  }
  return finish(parts.join(' '), 'unit_vocab')
}

// ── 밑줄 어법 고르기 (단원 문법 · 어법 선택) ─────────────────────────
/**
 * `unit_grammar` 와 `grammar_choice` 는 저장 모양이 같다 —
 * 밑줄 5(4)개 중 틀린 것 하나. **왜 나머지가 맞는지**까지 쓸 수 있어 오답 배제가 자동으로 붙는다.
 */
export function explainUnderlinedGrammar(payload: Json, answerKey: Json): ItemExplanation | null {
  const sentences = arr(payload.sentences).map(str)
  const underlines = arr(payload.underlines) as Array<{
    word?: string; label?: string; tokenIdx?: number; sentenceIdx?: number
  }>
  const idx = labelToIndex(answerKey.position ?? answerKey.answer)
  const correct = str(answerKey.original)
  if (idx == null || !underlines[idx] || !correct) return null

  const u = underlines[idx]
  const wrong = str(u.word)
  const label = str(u.label) || LABELS[idx] || `${idx + 1}`
  const sentence = sentences[Number(u.sentenceIdx)] ?? ''
  const rule = str(answerKey.rule) || inferRule(correct)
  // 관사는 **바로 뒤 소리**를 보고, 지시어는 **머리 명사의 수**를 본다 — 근거 자리가 다르다.
  const next = rule === 'demonstrative'
    ? headNounAfter(sentence, wrong, u.tokenIdx)
    : wordAfter(sentence, wrong, u.tokenIdx)
  const spec = rule ? RULE_KO[rule] : null

  const parts: string[] = []
  parts.push(`${label} ${josa(label, I_GA)} 틀렸다.`)
  if (sentence) parts.push(`"${quoteAround(sentence, wrong, 120)}"`)
  if (spec) {
    parts.push(`${spec.name} 규칙이다 — ${spec.why(wrong, correct, next)}`)
  } else {
    parts.push(`"${wrong}" 자리에는 "${correct}"${josa(correct, I_GA)} 와야 한다.`)
  }

  // ⚠️ **확인하지 않은 것을 단정하지 않는다.** 여기 있던 「나머지 …는 뒤 낱말과 어긋나지 않아
  //   그대로 맞다」는 생성기가 확인할 수 없는 판정이었다. 규칙을 반대로 적용해 본 적이 없고,
  //   실제로 3인 검수가 그 거짓을 잡았다(실측 2026-09-13: 「②의 that 은 명사절 접속사여서
  //   이 문항이 표방한 축으로는 애초에 틀릴 수 없는 자리다」 — 맞는 것이 아니라 **해당 없는** 자리다).
  //
  //   ⚠️⚠️ **그런데 그 「확인되는 것」이 제작 정보였다** (3인 검수 실측 2026-09-14).
  //     「나머지 …는 **지문 그대로다** — **바꾼 자리는 ① 하나다**」는 학습자가 쓸 수 없는 말이다.
  //     그에게는 「원문」이 없다 — 받은 것은 이 지문뿐이다. 게다가 이걸 인쇄하면 이 유형을
  //     **「바뀐 낱말 하나 찾기」로 푸는 법**을 가르친다. 아래 어휘 유형과 같은 자국이고,
  //     같은 날 여러 검수자가 각자 독립으로 짚었다.
  //
  //     대신 밑줄이 **몇 번째 문장**에 있는지를 적는다 — payload 가 그대로 말해 주는 값이고
  //     (`sentenceIdx`), 학습자가 그 자리로 가서 스스로 견줄 수 있다.
  const others = underlines
    .map((o, i) => ({ ...o, i, label: str(o.label) || LABELS[i] || `${i + 1}` }))
    .filter((o) => o.i !== idx && str(o.word))
  if (others.length) {
    const where = others
      .map((o) => {
        const at = Number(o.sentenceIdx)
        return Number.isInteger(at) && sentences[at]
          ? `${o.label} "${str(o.word)}"(${at + 1}문장)`
          : `${o.label} "${str(o.word)}"`
      })
      .join(' · ')
    parts.push(`나머지 ${where} 의 자리는 각각 그 문장에서 확인할 수 있다.`)
  }
  return finish(parts.join(' '), 'underlined_grammar')
}

// ── 문맥상 낱말 쓰임 (어휘 선택) ────────────────────────────────────
/**
 * 밑줄 낱말 중 문맥에 맞지 않는 것 하나. 원래 낱말이 `answer_key.original` 에 있으므로
 * **바꿔 넣은 문장을 보여 주는 것**이 가장 정확한 해설이다.
 */
export function explainVocabChoice(payload: Json, answerKey: Json): ItemExplanation | null {
  const sentences = arr(payload.sentences).map(str)
  const underlines = arr(payload.underlines) as Array<{
    word?: string; label?: string; sentenceIdx?: number
  }>
  const idx = labelToIndex(answerKey.position)
  const original = str(answerKey.original)
  if (idx == null || !underlines[idx] || !original) return null

  const u = underlines[idx]
  const wrong = str(u.word)
  const label = str(u.label) || LABELS[idx] || `${idx + 1}`
  const sentence = sentences[Number(u.sentenceIdx)] ?? ''
  const fixed = sentence && wrong
    ? sentence.replace(new RegExp(`\\b${wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`), original)
    : ''

  const parts: string[] = []
  parts.push(`${label} "${wrong}"${josa(wrong, I_GA)} 문맥에 맞지 않는다.`)
  if (sentence) parts.push(`문제 문장은 "${quoteAround(sentence, wrong, 110)}" 인데,`)
  if (fixed && fixed !== sentence) {
    parts.push(`이 자리에는 "${original}"${josa(original, I_GA)} 와야 뜻이 이어진다 — "${quoteAround(fixed, original, 110)}".`)
  } else {
    parts.push(`이 자리에는 "${original}"${josa(original, I_GA)} 와야 뜻이 이어진다.`)
  }
  // ⚠️⚠️ **확인하지 않은 것을 단정하지 않는다.** 여기 있던 「나머지 …는 앞뒤 내용과 어긋나지
  //   않는다」는 생성기가 확인할 수 없는 **의미 판정**이었고, 3인 검수가 그 거짓을 실제로 잡았다
  //   (실측 2026-09-13: 「① Indep 은 선지가 될 수 없다 — 낱말이 아니라 변수 약칭이다」 ·
  //   「①과 ④가 같은 이유로 틀린다 — 둘 다 중립어라 반의어를 넣어 볼 자리가 아니다」).
  //   바로 아래 `explainBlankWord` 는 이미 「없는 것을 지어내지 않는다」를 지키고 있었다 —
  //   **같은 파일에서 한 곳만 원칙이 깨져 있었다.**
  //
  //   대신 확인되는 것을 적는다. 이 유형은 `vocab-choice.ts` 가 **한 자리만** 반대말로 바꾸고,
  //   바꿀 낱말은 글 안에 **두 번 이상** 나와야 한다 — 그래서 원래 낱말이 다른 문장에 그대로
  //   남고, **그 불일치가 학습자가 찾을 근거**다. 그 자리를 실제로 찾아 보여 준다.
  const others = underlines
    .map((o, i) => ({ label: str(o.label) || LABELS[i] || `${i + 1}`, word: str(o.word), i }))
    .filter((o) => o.i !== idx && o.word)
  //   ⚠️⚠️ **제작 정보를 지면에 싣지 않는다** (3인 검수 실측 2026-09-14).
  //     여기 있던 「나머지 …는 **지문 그대로다** — **바꾼 자리는 ② 하나다**」를 여러 청크의
  //     검수자가 **각자 독립으로** 짚었다: 「해설이 setter 만 아는 지식으로 오답을 정당화한다」
  //     「이걸 인쇄하면 학습자가 이 유형 전체를 **바뀐 낱말 하나 찾기**로 푸는 법을 배운다」.
  //
  //     학습자에게는 「원문」이라는 것이 없다 — 그가 받는 것은 이 지문뿐이다. 그러니
  //     「지문 그대로다」는 **쓸 수 없는 말**이고, 「바꾼 자리는 하나다」는 앞 문장이 이미
  //     말한 정답을 제작 관점으로 되풀이한 것이다.
  //
  //     대신 **확인되는 것**을 적는다 — 각 밑줄이 **몇 번째 문장**에 있는지는 payload 가
  //     그대로 말해 준다(`sentenceIdx`). 학습자는 그 자리로 가서 스스로 견줄 수 있다.
  //     「어긋나는 자리가 하나뿐」은 이 **유형의 규칙**이지 이 문항에 대한 의미 판정이 아니다.
  if (others.length) {
    const where = others
      .map((o) => {
        const at = Number(underlines[o.i]?.sentenceIdx)
        return Number.isInteger(at) && sentences[at]
          ? `${o.label} "${o.word}"(${at + 1}문장)`
          : `${o.label} "${o.word}"`
      })
      .join(' · ')
    parts.push(`나머지 ${where} 의 자리는 각각 그 문장에서 확인할 수 있다.`)
  }
  // 찾지 못하면 아무 말도 하지 않는다 — 못 찾은 것을 「있다」로 적지 않는다.
  const keptAt = sentenceStillHolding(sentences, original, Number(u.sentenceIdx))
  if (keptAt != null) {
    parts.push(
      `원래 낱말 "${original}"${josa(original, EUN_NEUN)} ${keptAt + 1}번째 문장에 그대로 남아 있다 — "${quoteAround(sentences[keptAt] ?? '', original, 90)}".`,
    )
  }
  return finish(parts.join(' '), 'vocab_choice')
}

// ── 빈칸에 낱말 쓰기 ────────────────────────────────────────────────
/**
 * 선택지가 없는 단답형이라 오답 배제가 성립하지 않는다 — **없는 것을 지어내지 않는다.**
 * 대신 힌트가 무엇을 알려 주는지와 완성된 문장을 보인다.
 */
export function explainBlankWord(payload: Json, answerKey: Json): ItemExplanation | null {
  const stem = str(payload.stem)
  const hint = str(payload.hint)
  const answer = str(answerKey.text)
  if (!stem || !answer) return null

  const filled = stem.replace(/_{2,}/, answer)
  const parts: string[] = []
  parts.push(`빈칸에는 "${answer}" ${josa(answer, I_GA)} 들어간다.`)
  const m = hint.match(/^(.+?)…\s*\((.+)\)$/)
  if (m) {
    parts.push(`힌트 "${hint}"${josa(hint, EUN_NEUN)} 첫 글자 ${m[1]}${josa(m[1] ?? '', WA_GWA)} 뜻 '${m[2]}'${josa(m[2] ?? '', EUL_REUL)} 함께 준다 — 그 둘을 모두 만족하는 낱말이다.`)
  } else if (hint) {
    parts.push(`힌트는 "${hint}" 다.`)
  }
  parts.push(`완성하면 "${quoteAround(filled, answer, 160)}" 가 된다.`)
  return finish(parts.join(' '), 'blank_word')
}

// ── 어법 틀린 낱말 고쳐 쓰기 ────────────────────────────────────────
export function explainGrammarFix(payload: Json, answerKey: Json): ItemExplanation | null {
  const stem = str(payload.stem)
  const correct = str(answerKey.text)
  const rule = str(answerKey.rule) || inferRule(correct)
  if (!stem || !correct) return null
  const spec = rule ? RULE_KO[rule] : null
  if (!spec) return null

  // 틀린 자리를 찾는다 — 규칙을 어긴 토큰은 하나뿐이도록 만들어졌다.
  const tokens = stem.split(/\s+/)
  let wrong = ''
  let next = ''
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const raw = bare(tokens[i] ?? '')
    const w = raw.toLowerCase()
    const n = bare(tokens[i + 1] ?? '')
    if (!n) continue
    if (rule === 'article' && (w === 'a' || w === 'an')) {
      if (standardArticle(n) !== w) { wrong = raw; next = n; break }
    }
    if (rule === 'demonstrative' && ['this', 'that', 'these', 'those'].includes(w)) {
      const plural = looksPlural(n)
      if (plural === null) continue
      const isPluralWord = w === 'these' || w === 'those'
      if (plural !== isPluralWord) { wrong = raw; next = looksModifier(n) ? '' : n; break }
    }
  }
  if (!wrong) return null

  const fixed = stem.replace(new RegExp(`\\b${wrong}\\s+${next.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), `${correct} ${next}`)
  const parts: string[] = [
    `"${wrong} ${next}" 의 "${wrong}"${josa(wrong, I_GA)} 틀렸다.`,
    spec.why(wrong, correct, next),
    `고치면 "${quoteAround(fixed, `${correct} ${next}`, 130)}" 가 된다.`,
  ]
  return finish(parts.join(' '), 'grammar_fix')
}

// ── 영작 배열 ───────────────────────────────────────────────────────
/**
 * 낱말 은행을 배열해 문장을 만드는 유형. 정답 문장이 `answer_key.sentence` 에 있으므로
 * **문장을 어떻게 끊어 읽는지**를 보여 주는 것이 해설이 된다.
 */
export function explainWordOrder(payload: Json, answerKey: Json): ItemExplanation | null {
  const sentence = str(answerKey.sentence)
  const bank = arr(payload.bank).map(str).filter(Boolean)
  const context = str(payload.context)
  if (!sentence || bank.length < 3) return null

  const tokens = sentence.replace(/[.?!]$/, '').split(/\s+/)
  const subject = tokens[0] ?? ''
  // 첫 동사 자리 — 낱말 은행에 있는 것 중 문장에서 두 번째 이후에 오는 것을 잡는다.
  const verbIdx = tokens.findIndex((t, i) => i > 0 && /^(is|are|was|were|has|have|had|does|do|did|tells|happens|becomes|feels|makes|takes|gives|shows)$/i.test(bare(t)))
  const verb = verbIdx > 0 ? bare(tokens[verbIdx] ?? '') : ''
  const parts: string[] = []
  if (context) parts.push(`앞 문장 "${quote(context, 90)}" 에 이어지는 자리다.`)
  parts.push(`정답은 "${quote(sentence, 150)}" 다.`)
  parts.push(`주어 "${subject}" 로 시작해${verb ? ` 동사 "${verb}"${josa(verb, I_GA)} 뒤따르고,` : ''} 나머지 낱말이 그 뒤에 붙는다.`)
  parts.push(`낱말 ${bank.length}개를 모두 한 번씩 쓴다 — 남거나 모자라면 배열이 틀린 것이다.`)
  return finish(parts.join(' '), 'word_order')
}

// ── 흐름과 관계 없는 문장 ────────────────────────────────────────────

/** 선택지 번호 — `finish` 의 오답 배제 판정이 이 글자들을 본다. */
const CIRCLED = ['①', '②', '③', '④', '⑤'] as const

/**
 * 화제를 나르는 낱말만 남긴다. 기능어는 어느 글에나 나오므로 겹침의 증거가 못 된다.
 * 4자 미만도 버린다 — `this`·`that` 류가 화제를 나르는 것처럼 보이게 만든다.
 */
const FUNCTION_WORDS = new Set([
  'this', 'that', 'these', 'those', 'there', 'their', 'them', 'they', 'then', 'than',
  'with', 'from', 'have', 'has', 'had', 'been', 'were', 'was', 'will', 'would',
  'when', 'what', 'which', 'while', 'where', 'because', 'about', 'into', 'also',
  'more', 'most', 'such', 'some', 'other', 'only', 'very', 'much', 'many', 'both',
  'each', 'same', 'through', 'between', 'after', 'before', 'over', 'under', 'does',
  // 아래는 내용어처럼 보이지만 화제를 나르지 않는다 — 근거로 들면 해설이 약해진다.
  'including', 'include', 'includes', 'like', 'well', 'even', 'just', 'being',
  'however', 'therefore', 'thus', 'often', 'always', 'never', 'still', 'must',
  'used', 'using', 'make', 'made', 'take', 'taken', 'give', 'given', 'become',
])
function contentWords(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .split(/[^a-z']+/)
    .map((w) => w.replace(/'s$/, ''))
    .filter((w) => w.length >= 4 && !FUNCTION_WORDS.has(w))
}

/**
 * 정답 근거가 **문항 안에 다 있다** — 도입부와 나머지 문장이 함께 쓰는 낱말이
 * 화제이고, 그 낱말을 하나도 잇지 않는 문장이 답이다. 읽어서 알아낼 것이 없다.
 *
 * 낱말 겹침이 없다는 사실을 그대로 보여 준다. "흐름이 어색하다" 는 근거가 아니라
 * 인상이라서, 학습자가 스스로 확인할 수 없다.
 */
export function explainIrrelevant(payload: Json, answerKey: Json): ItemExplanation | null {
  const intro = str(payload.intro)
  const sentences = arr(payload.sentences).map(str).filter(Boolean)
  const pos = Number(answerKey.position)
  if (!intro || sentences.length < 3) return null
  if (!Number.isInteger(pos) || pos < 1 || pos > sentences.length) return null

  const odd = sentences[pos - 1] ?? ''
  const rest = sentences.filter((_, i) => i !== pos - 1)
  if (!odd || !rest.length) return null

  const introWords = contentWords(intro)
  const introSet = new Set(introWords)
  const restSet = new Set(rest.flatMap(contentWords))
  // 도입부와 나머지 문장이 **함께** 쓰는 낱말 = 이 글이 이어 가는 화제.
  const shared = [...new Set(introWords.filter((w) => restSet.has(w)))].slice(0, 3)
  // 정답 문장에만 있고 앞뒤 어디에도 없는 낱말 = 다른 화제라는 증거.
  const foreign = [...new Set(contentWords(odd))]
    .filter((w) => !introSet.has(w) && !restSet.has(w))
    .slice(0, 3)

  const list = (ws: string[]): string => ws.map((w) => `"${w}"`).join(' · ')
  const parts: string[] = []
  parts.push(`이 글은 "${quote(intro, 100)}" 로 시작한다.`)
  parts.push(`정답은 ${CIRCLED[pos - 1] ?? `${pos}번`} "${quote(odd, 120)}" 다.`)
  parts.push(
    shared.length
      ? `나머지 문장은 ${list(shared)} 처럼 도입부의 낱말을 그대로 이어받는데,`
      : '나머지 문장은 도입부가 꺼낸 화제를 그대로 이어받는데,',
  )
  parts.push(
    foreign.length
      ? `이 문장만 ${list(foreign)} 처럼 앞뒤 어디에도 없는 낱말로 다른 화제를 꺼낸다.`
      : '이 문장만 앞뒤 문장과 낱말이 하나도 이어지지 않는다.',
  )
  // ⚠️ **낱말 끊김을 「푸는 법」으로 가르치지 않는다.**
  //
  //   여기 마지막 문장이 「한 문단은 한 화제를 이어 가야 하므로, **낱말이 끊기는** 이 문장이
  //   무관한 문장이다」였다. 그런데 이 저장소의 기출 실측이 정반대를 말한다 —
  //   `docs/CSAT_TYPE_BLUEPRINTS.md` §R-IRRELEVANT:
  //
  //     > 무관한 문장은 전역 주제어를 피해 심는 것이 아니라 **바로 앞 문장의 어휘를
  //     > 이어받아** 심는다 — 직전 문장 기준 **83.3%**.
  //
  //   즉 낱말 끊김은 **우리 생성기의 성질**이지 평가원 문항의 성질이 아니다. 그것을
  //   전략으로 적으면 학습자가 본시험에서 **역효과가 나는 법**을 배운다(3인 검수 chunk-01).
  //
  //   앞의 두 문장은 **이 문항의 근거**를 그대로 적은 것이라 남긴다 — 사실이기 때문이다.
  //   마지막 한 줄만 기출이 쓰는 판정으로 바꾼다(같은 문서 §출제자의 사고 4번:
  //   「무관 문장을 빼고 읽어 흐름이 매끄러운지 확인한다」). **학습자가 지면에서 직접
  //   해 볼 수 있는 검사**라 인용 못지않은 근거가 된다.
  parts.push('이 문장을 빼고 읽으면 앞뒤가 그대로 이어진다 — 무관한 문장인지는 그렇게 확인한다.')
  return finish(parts.join(' '), 'irrelevant')
}

// ── 초등 저학년 3종 (운율 · 낱말 뜻 · 철자 완성) ──────────────────────
/**
 * 사전에서 나온 문항이라 **정답 근거가 사전 자체**다 — 읽어서 알아낼 것이 없다.
 *
 * ⚠️ 이 유형은 `csat_dcp_items` 에 저장되지 않아(`ref_id` NOT NULL) 조판 시점에 만들어진다.
 *   그래서 `explain-fill` 이 닿지 않고, 붙이지 않으면 **V1 한 권 120문항이 해설 0** 이 된다
 *   (실측 2026-08-30).
 *
 * @param kind 문항 종류.
 * @param stem 학습자에게 보이는 제시어 또는 빈칸 꼴.
 * @param choices 보기(철자 완성은 빈 배열).
 * @param answer 1-based 정답 번호. 0 이면 단답.
 * @param answerText 단답 정답.
 */
export function explainElementary(
  kind: 'rhyme' | 'word_meaning' | 'spell_blank',
  stem: string,
  choices: ReadonlyArray<{ label?: string; text?: string }>,
  answer: number,
  answerText: string,
): ItemExplanation | null {
  if (!answerText) return null
  const idx = answer - 1
  const label = choices[idx]?.label || LABELS[idx] || ''
  const others = choices
    .map((c, i) => ({ label: str(c.label) || LABELS[i] || `${i + 1}`, text: str(c.text), i }))
    .filter((c) => c.i !== idx && c.text)

  const parts: string[] = []
  if (kind === 'rhyme') {
    parts.push(`정답은 ${label} "${answerText}" 다.`)
    parts.push(`"${stem}" 와 끝소리가 같다 — 소리를 맞추는 문제이므로 철자가 아니라 끝소리를 본다.`)
    if (others.length) {
      parts.push(`나머지 ${others.map((c) => `${c.label} "${c.text}"`).join(' · ')} 는 끝소리가 다르다.`)
    }
  } else if (kind === 'word_meaning') {
    parts.push(`"${stem}" 의 뜻은 ${label} "${answerText}"${josa(answerText, I_DA)}.`)
    if (others.length) {
      // 오답이 어디서 왔는지는 **사실**이다 — 보기 풀이 교육과정 별표이기 때문이다.
      // 길이를 채우려고 지어낸 말이 아니라, 학습자가 오답을 따로 외울 거리로 쓸 수 있다.
      parts.push(
        `나머지 ${others.map((c) => `${c.label} "${c.text}"`).join(' · ')} 는 같은 교육과정 낱말 목록에 있는 다른 낱말의 뜻이다.`,
      )
    }
  } else {
    parts.push(`빈칸을 채우면 "${answerText}"${josa(answerText, I_GA)} 된다.`)
    parts.push(`주어진 꼴 "${stem}" 에서 빠진 글자를 넣는 문제다 — 같은 꼴로 만들 수 있는 낱말이 하나뿐이라 답이 정해진다.`)
  }
  return finish(parts.join(' '), `elementary_${kind}`)
}

// ── 갈래 ────────────────────────────────────────────────────────────

/** 이 모듈이 해설을 쓸 수 있는 유형. 여기 없으면 `explain.ts` 나 Claude Code 배치 몫이다. */
export const DETERMINISTIC_EXPLAIN_TYPES = [
  'unit_vocab', 'unit_grammar', 'grammar_choice', 'vocab_choice',
  'blank_word', 'grammar_fix', 'word_order', 'irrelevant',
] as const
export type DeterministicExplainType = (typeof DETERMINISTIC_EXPLAIN_TYPES)[number]

/**
 * 유형에 맞는 해설 작성기를 고른다. 못 쓰면 `null` — **세어야 하는 값이다.**
 * 조용히 빈 문자열을 돌려주면 다음 실행이 "완료" 로 세어 구멍이 영영 남는다.
 */
export function explainItem(
  type: string,
  payload: Json,
  answerKey: Json,
): ItemExplanation | null {
  switch (type) {
    case 'unit_vocab': return explainUnitVocab(payload, answerKey)
    case 'unit_grammar':
    case 'grammar_choice': return explainUnderlinedGrammar(payload, answerKey)
    case 'vocab_choice': return explainVocabChoice(payload, answerKey)
    case 'blank_word': return explainBlankWord(payload, answerKey)
    case 'grammar_fix': return explainGrammarFix(payload, answerKey)
    case 'word_order': return explainWordOrder(payload, answerKey)
    case 'irrelevant': return explainIrrelevant(payload, answerKey)
    default: return null
  }
}
