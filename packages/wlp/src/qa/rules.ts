// packages/wlp/src/qa/rules.ts
// VCB QA Gate — R1~R8 룰 엔진. 순수 함수, DB 의존성 없음.
// CLAUDE.md §19.6 정합.

export interface QaItem {
  queue_id: number
  lemma: string
  pos: string
  ipa: string | null
  cefr: string | null
  definitions_ko: Array<{ sense: string; register: string }>
  definitions_en: Array<{ sense: string }>
  examples: Array<{ en: string; ko: string }>
  synonyms: string[]
  antonyms: string[]
  collocations: string[]
  korean_learner_note: string | null
  confidence: number
}

export type QaSeverity = 'reject' | 'flag' | 'auto_fix'

export interface QaFlag {
  code: string
  severity: QaSeverity
  message: string
  field?: string
}

export interface QaResult {
  passed: boolean
  flags: QaFlag[]
  fixed_item?: QaItem
}

export const VALID_POS = new Set([
  'NOUN', 'VERB', 'ADJ', 'ADV', 'PREP', 'CONJ', 'PRON', 'DET', 'INTJ',
])
export const VALID_CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
export const VALID_REGISTER = new Set(['formal', 'neutral', 'informal'])

export const CONFIDENCE_THRESHOLD = 0.6
export const MIN_KO_EXAMPLE_RATIO = 2

const NGSL_RANK_CEFR_EXPECTATIONS: Array<{
  max: number
  acceptable: Set<string>
}> = [
  { max: 500, acceptable: new Set(['A1', 'A2']) },
  { max: 1500, acceptable: new Set(['A1', 'A2', 'B1']) },
  { max: 3000, acceptable: new Set(['A2', 'B1', 'B2']) },
  { max: Infinity, acceptable: new Set(['B1', 'B2', 'C1', 'C2']) },
]

// ─── R1: 스키마 ───────────────────────────────────

export function checkR1Schema(item: unknown): QaFlag[] {
  const flags: QaFlag[] = []

  if (typeof item !== 'object' || item === null) {
    flags.push({ code: 'R1', severity: 'reject', message: 'item must be an object' })
    return flags
  }
  const o = item as Record<string, unknown>

  if (typeof o.queue_id !== 'number') {
    flags.push({ code: 'R1', severity: 'reject', message: 'queue_id must be number', field: 'queue_id' })
  }
  if (typeof o.lemma !== 'string' || o.lemma.length === 0) {
    flags.push({ code: 'R1', severity: 'reject', message: 'lemma must be non-empty string', field: 'lemma' })
  }
  if (typeof o.pos !== 'string' || !VALID_POS.has(o.pos)) {
    flags.push({ code: 'R1', severity: 'reject', message: `invalid pos: ${String(o.pos)}`, field: 'pos' })
  }
  if (o.ipa !== null && typeof o.ipa !== 'string') {
    flags.push({ code: 'R1', severity: 'reject', message: 'ipa must be string or null', field: 'ipa' })
  }
  if (o.cefr !== null && (typeof o.cefr !== 'string' || !VALID_CEFR.has(o.cefr))) {
    flags.push({ code: 'R1', severity: 'reject', message: `invalid cefr: ${String(o.cefr)}`, field: 'cefr' })
  }
  if (!Array.isArray(o.definitions_ko)) {
    flags.push({ code: 'R1', severity: 'reject', message: 'definitions_ko must be array', field: 'definitions_ko' })
  } else {
    o.definitions_ko.forEach((d, i) => {
      if (typeof d !== 'object' || d === null) {
        flags.push({ code: 'R1', severity: 'reject', message: `definitions_ko[${i}] must be object`, field: 'definitions_ko' })
        return
      }
      const dd = d as Record<string, unknown>
      if (typeof dd.sense !== 'string') {
        flags.push({ code: 'R1', severity: 'reject', message: `definitions_ko[${i}].sense must be string`, field: 'definitions_ko' })
      }
      if (typeof dd.register !== 'string' || !VALID_REGISTER.has(dd.register)) {
        flags.push({ code: 'R1', severity: 'reject', message: `definitions_ko[${i}].register invalid`, field: 'definitions_ko' })
      }
    })
  }
  if (!Array.isArray(o.definitions_en)) {
    flags.push({ code: 'R1', severity: 'reject', message: 'definitions_en must be array', field: 'definitions_en' })
  }
  if (!Array.isArray(o.examples)) {
    flags.push({ code: 'R1', severity: 'reject', message: 'examples must be array', field: 'examples' })
  } else {
    o.examples.forEach((ex, i) => {
      if (typeof ex !== 'object' || ex === null) {
        flags.push({ code: 'R1', severity: 'reject', message: `examples[${i}] must be object`, field: 'examples' })
        return
      }
      const ee = ex as Record<string, unknown>
      if (typeof ee.en !== 'string' || ee.en.length === 0) {
        flags.push({ code: 'R1', severity: 'reject', message: `examples[${i}].en invalid`, field: 'examples' })
      }
      if (typeof ee.ko !== 'string' || ee.ko.length === 0) {
        flags.push({ code: 'R1', severity: 'reject', message: `examples[${i}].ko invalid`, field: 'examples' })
      }
    })
  }
  for (const f of ['synonyms', 'antonyms', 'collocations'] as const) {
    if (!Array.isArray(o[f])) {
      flags.push({ code: 'R1', severity: 'reject', message: `${f} must be array`, field: f })
    } else if ((o[f] as unknown[]).some((s) => typeof s !== 'string')) {
      flags.push({ code: 'R1', severity: 'reject', message: `${f} items must be string`, field: f })
    }
  }
  if (o.korean_learner_note !== null && typeof o.korean_learner_note !== 'string') {
    flags.push({ code: 'R1', severity: 'reject', message: 'korean_learner_note must be string or null', field: 'korean_learner_note' })
  }
  if (typeof o.confidence !== 'number' || o.confidence < 0 || o.confidence > 1 || Number.isNaN(o.confidence)) {
    flags.push({ code: 'R1', severity: 'reject', message: `confidence out of [0,1]: ${String(o.confidence)}`, field: 'confidence' })
  }

  return flags
}

// ─── R2 ───────────────────────────────────────────

export function checkR2MinDefinitionsKo(item: QaItem): QaFlag[] {
  if (item.definitions_ko.length === 0) {
    return [{ code: 'R2', severity: 'reject', message: 'definitions_ko must have at least 1 entry', field: 'definitions_ko' }]
  }
  if (item.definitions_ko.length > 3) {
    return [{ code: 'R2', severity: 'flag', message: `definitions_ko has ${item.definitions_ko.length} (max 3 by policy)`, field: 'definitions_ko' }]
  }
  return []
}

// ─── R3 ───────────────────────────────────────────

export function lemmaInExample(en: string, lemma: string): boolean {
  if (en.length === 0 || lemma.length === 0) return false
  const lowerEn = en.toLowerCase()
  const lowerLemma = lemma.toLowerCase()

  if (lowerEn.includes(lowerLemma)) return true

  if (lowerLemma.length >= 3) {
    const stem3 = lowerLemma.slice(0, lowerLemma.length - 1)
    if (lowerEn.includes(stem3)) return true
  }
  if (lowerLemma.length >= 4) {
    const stem4 = lowerLemma.slice(0, lowerLemma.length - 2)
    if (lowerEn.includes(stem4)) return true
  }
  return false
}

export function checkR3LemmaInExamples(item: QaItem): QaFlag[] {
  const flags: QaFlag[] = []
  item.examples.forEach((ex, i) => {
    if (!lemmaInExample(ex.en, item.lemma)) {
      flags.push({
        code: 'R3',
        severity: 'flag',
        message: `examples[${i}].en does not contain lemma "${item.lemma}" or its inflection`,
        field: 'examples',
      })
    }
  })
  return flags
}

// ─── R4 ───────────────────────────────────────────

export function checkR4KoLengthValid(item: QaItem): QaFlag[] {
  const flags: QaFlag[] = []
  const minLength = item.lemma.length * MIN_KO_EXAMPLE_RATIO
  item.examples.forEach((ex, i) => {
    if (ex.ko.length < minLength) {
      flags.push({
        code: 'R4',
        severity: 'flag',
        message: `examples[${i}].ko too short (${ex.ko.length} < ${minLength})`,
        field: 'examples',
      })
    }
  })
  return flags
}

// ─── R5 ───────────────────────────────────────────

export function checkR5CefrNgslConsistent(
  item: QaItem,
  ngslRank: number | null
): QaFlag[] {
  if (item.cefr === null || ngslRank === null) return []

  const expectation = NGSL_RANK_CEFR_EXPECTATIONS.find((e) => ngslRank <= e.max)
  if (!expectation) return []

  if (!expectation.acceptable.has(item.cefr)) {
    return [{
      code: 'R5',
      severity: 'flag',
      message: `CEFR ${item.cefr} unexpected for NGSL rank ${ngslRank} (expected: ${[...expectation.acceptable].join(',')})`,
      field: 'cefr',
    }]
  }
  return []
}

// ─── R6 ───────────────────────────────────────────

export function checkR6Confidence(item: QaItem): QaFlag[] {
  if (item.confidence < CONFIDENCE_THRESHOLD) {
    return [{
      code: 'R6',
      severity: 'flag',
      message: `confidence ${item.confidence} below threshold ${CONFIDENCE_THRESHOLD}`,
      field: 'confidence',
    }]
  }
  return []
}

// ─── R7 ───────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function checkR7Profanity(
  item: QaItem,
  denylist: ReadonlyArray<string>
): QaFlag[] {
  if (denylist.length === 0) return []

  const flags: QaFlag[] = []
  const texts: Array<{ value: string; field: string }> = [
    ...item.definitions_ko.map((d, i) => ({ value: d.sense, field: `definitions_ko[${i}].sense` })),
    ...item.definitions_en.map((d, i) => ({ value: d.sense, field: `definitions_en[${i}].sense` })),
    ...item.examples.flatMap((ex, i) => [
      { value: ex.en, field: `examples[${i}].en` },
      { value: ex.ko, field: `examples[${i}].ko` },
    ]),
    ...(item.korean_learner_note
      ? [{ value: item.korean_learner_note, field: 'korean_learner_note' }]
      : []),
  ]

  const lowerDenylist = denylist.map((w) => w.toLowerCase())

  for (const { value, field } of texts) {
    const lower = value.toLowerCase()
    for (const bad of lowerDenylist) {
      const pattern = new RegExp(`\\b${escapeRegex(bad)}\\b`)
      if (pattern.test(lower)) {
        flags.push({
          code: 'R7',
          severity: 'reject',
          message: `profanity detected: "${bad}"`,
          field,
        })
        break
      }
    }
  }
  return flags
}

// ─── R8 ───────────────────────────────────────────

export function checkR8SelfReference(item: QaItem): {
  flags: QaFlag[]
  fixed?: QaItem
} {
  const lemmaLower = item.lemma.toLowerCase()
  const synHasSelf = item.synonyms.some((s) => s.toLowerCase() === lemmaLower)
  const antHasSelf = item.antonyms.some((a) => a.toLowerCase() === lemmaLower)

  if (!synHasSelf && !antHasSelf) return { flags: [] }

  const flags: QaFlag[] = []
  if (synHasSelf) {
    flags.push({
      code: 'R8',
      severity: 'auto_fix',
      message: `synonyms contained lemma itself "${item.lemma}" — removed`,
      field: 'synonyms',
    })
  }
  if (antHasSelf) {
    flags.push({
      code: 'R8',
      severity: 'auto_fix',
      message: `antonyms contained lemma itself "${item.lemma}" — removed`,
      field: 'antonyms',
    })
  }

  const fixed: QaItem = {
    ...item,
    synonyms: item.synonyms.filter((s) => s.toLowerCase() !== lemmaLower),
    antonyms: item.antonyms.filter((a) => a.toLowerCase() !== lemmaLower),
  }

  return { flags, fixed }
}
