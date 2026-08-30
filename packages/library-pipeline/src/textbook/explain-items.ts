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
import { looksPlural, standardArticle } from './grammar-choice'

/** 시장 규격 — `market-spec.json` 의 `explanation.lengthChars` p25/p90 실측값. */
export const EXPLANATION_CHARS = { min: 75, max: 473 } as const

/** 앞말 받침에 맞는 조사. `explain.ts` 와 같은 규칙을 쓴다. */
function josa(word: string, [withBatchim, without]: readonly [string, string]): string {
  return hasFinalConsonant(word) ? withBatchim : without
}
const EUN_NEUN = ['은', '는'] as const
const I_GA = ['이', '가'] as const
/** 서술격 조사 — `"이른" 다` 가 아니라 `"이른" 이다` 여야 한다. */
const I_DA = ['이다', '다'] as const

/** 인용이 길면 앞뒤를 잘라 규격 안에 넣는다. 잘랐다는 것을 말줄임으로 보인다. */
function quote(sentence: string, limit = 150): string {
  const s = sentence.replace(/\s+/g, ' ').trim()
  return s.length <= limit ? s : `${s.slice(0, limit - 1).trimEnd()}…`
}

/**
 * **보여 주려는 낱말이 들어간 구간**을 인용한다.
 *
 * 앞에서부터 자르면 정작 보여 줘야 할 자리가 잘려 나간다 — 어휘 교체 해설에서
 * 바뀐 낱말이 안 보이면 해설이 아무것도 말하지 않는 것과 같다(테스트가 이걸 잡았다).
 */
function quoteAround(sentence: string, focus: string, limit = 130): string {
  const s = sentence.replace(/\s+/g, ' ').trim()
  if (s.length <= limit) return s
  const at = focus ? s.toLowerCase().indexOf(focus.toLowerCase()) : -1
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
        ? `관사는 뒤 낱말의 첫 **소리**에 맞춘다 — "${next}"${josa(next, EUN_NEUN)} ${/^[aeiou]/i.test(next) ? '모음' : '자음'} 소리로 시작하므로 "${right}" 가 맞고 "${wrong}" 는 틀리다.`
        : `관사는 뒤 낱말의 첫 소리에 맞춘다 — 여기서는 "${right}" 가 맞고 "${wrong}" 는 틀리다.`,
  },
  demonstrative: {
    name: '지시어',
    why: (wrong, right, next) =>
      next
        ? `지시어는 뒤 명사의 **수**에 맞춘다 — "${next}"${josa(next, I_GA)} ${looksPlural(next) ? '복수' : '단수'}이므로 "${right}" 가 맞고 "${wrong}" 는 틀리다.`
        : `지시어는 뒤 명사의 수에 맞춘다 — 여기서는 "${right}" 가 맞고 "${wrong}" 는 틀리다.`,
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
function looksModifier(word: string): boolean {
  return /-/.test(word) || /(?:ed|ing|ous|ful|ive|al|ic|able|ible)$/i.test(word)
}

/**
 * 지시어가 받는 **머리 명사**를 찾는다.
 *
 * 바로 뒤 낱말을 그냥 쓰면 `those AI-focused data centers` 에서 형용사 `AI-focused` 를
 * 명사라고 부르게 된다 — 실제로 그런 해설이 나왔다. 해설이 사실과 어긋나면
 * 해설이 없느니만 못하다. 그래서 수식어로 보이는 것을 건너뛰고, **3칸 안에 못 찾으면
 * 이름을 대지 않는다**(빈 문자열 → 낱말을 지목하지 않는 문장으로 떨어진다).
 */
function headNounAfter(sentence: string, target: string, tokenIdx?: number): string {
  const tokens = sentence.split(/\s+/)
  let start: number
  if (typeof tokenIdx === 'number' && tokens[tokenIdx] != null) start = tokenIdx + 1
  else {
    const i = tokens.findIndex((t) => bare(t).toLowerCase() === target.toLowerCase())
    if (i < 0) return ''
    start = i + 1
  }
  for (let k = start; k < Math.min(tokens.length, start + 3); k += 1) {
    const w = bare(tokens[k] ?? '')
    if (!w) continue
    if (looksModifier(w)) continue
    if (looksPlural(w) === null) continue   // 판정 못 하는 낱말은 근거로 못 쓴다
    return w
  }
  return ''
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

function finish(ko: string, writer: string): ItemExplanation | null {
  const text = ko.replace(/\s+/g, ' ').trim()
  if (text.length < EXPLANATION_CHARS.min) return null
  return {
    ko: text.length > EXPLANATION_CHARS.max ? `${text.slice(0, EXPLANATION_CHARS.max - 1).trimEnd()}…` : text,
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
    parts.push(`"${wrong}" 자리에는 "${correct}" 가 와야 한다.`)
  }

  // 나머지 밑줄은 왜 맞는가 — 같은 규칙을 반대로 적용해 보인다.
  const others = underlines
    .map((o, i) => ({ ...o, i, label: str(o.label) || LABELS[i] || `${i + 1}` }))
    .filter((o) => o.i !== idx && str(o.word))
  if (others.length) {
    parts.push(
      `나머지 ${others.map((o) => `${o.label} "${str(o.word)}"`).join(' · ')} 는 뒤 낱말과 어긋나지 않아 그대로 맞다.`,
    )
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
    parts.push(`이 자리에는 "${original}" 가 와야 뜻이 이어진다 — "${quoteAround(fixed, original, 110)}".`)
  } else {
    parts.push(`이 자리에는 "${original}" 가 와야 뜻이 이어진다.`)
  }
  const others = underlines
    .map((o, i) => ({ label: str(o.label) || LABELS[i] || `${i + 1}`, word: str(o.word), i }))
    .filter((o) => o.i !== idx && o.word)
  if (others.length) {
    parts.push(
      `나머지 ${others.map((o) => `${o.label} "${o.word}"`).join(' · ')} 는 앞뒤 내용과 어긋나지 않는다.`,
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
    parts.push(`힌트 "${hint}" 는 첫 글자 ${m[1]} 와 뜻 '${m[2]}' 를 함께 준다 — 그 둘을 모두 만족하는 낱말이다.`)
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
  parts.push('한 문단은 한 화제를 이어 가야 하므로, 낱말이 끊기는 이 문장이 전체 흐름과 관계 없는 문장이다.')
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
    parts.push(`"${stem}" 와 끝소리가 같다 — 소리를 맞추는 문제이므로 철자가 아니라 **끝소리**를 본다.`)
    if (others.length) {
      parts.push(`나머지 ${others.map((c) => `${c.label} "${c.text}"`).join(' · ')} 는 끝소리가 다르다.`)
    }
  } else if (kind === 'word_meaning') {
    parts.push(`"${stem}" 의 뜻은 ${label} "${answerText}"${josa(answerText, I_DA)}.`)
    if (others.length) {
      // 오답이 어디서 왔는지는 **사실**이다 — 보기 풀이 교육과정 별표이기 때문이다.
      // 길이를 채우려고 지어낸 말이 아니라, 학습자가 오답을 따로 외울 거리로 쓸 수 있다.
      parts.push(
        `나머지 ${others.map((c) => `${c.label} "${c.text}"`).join(' · ')} 는 같은 교육과정 낱말 목록에 있는 **다른 낱말**의 뜻이다.`,
      )
    }
  } else {
    parts.push(`빈칸을 채우면 "${answerText}" 가 된다.`)
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
