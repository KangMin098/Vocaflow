// apps/web/src/lib/vcb/compose/select.ts
//
// 선별 — 모집단에서 무엇을 남기나. 전부 순수 함수.
//
// 기존 5 생성기가 각자 하드코딩했던 세 가지를 여기 한 곳으로 모은다:
//   ① NOISE register 집합 (roots-publish-set 과 topics-publish-set 에 같은 6개가 복붙돼 있었다)
//   ② meaning_ko 존재 요구 (publish-list-word-set 의 `meaning_ko:'present'`)
//   ③ v_level 밴드 (세 스크립트 모두 [3,11] 을 각자 적어 뒀다)
// 같은 값이 세 곳에 있으면 한 곳만 고쳐지는 날이 오고, 그날 세트들이 조용히 갈라진다.

import type { CandidateWord, Objective, SelectSpec } from './types'
import { NOISE_REGISTERS } from './types'
import { hasField } from './facets'
import { hasBaseIn } from './resolve'
import { greedyTokenCoverage, type CoverageResult } from './unlock'

export interface SelectResult {
  kept: CandidateWord[]
  dropped: Record<string, number>
  coverage?: CoverageResult
  counts: { after_filters: number; after_subtract: number; after_objective: number }
}

function drop(map: Record<string, number>, reason: string): void {
  map[reason] = (map[reason] ?? 0) + 1
}

/**
 * 사전식 변형 표제어 — 괄호·슬래시·문장부호를 품은 것, 알파벳으로 시작하지 않는 것.
 * `(be) on the ball` · `honor/honour-bound` · `…or bust` 류. 학습 카드가 될 수 없다.
 *
 * `, etc.` 열거형도 같은 부류다 — `a big, huge, tough, etc. ask` 는 사전이 "이 자리에 여러
 * 형용사가 온다" 를 적은 것이지 외울 표현이 아니다(실측: 구동사 세트 1번 항목이 이것이었다).
 * 쉼표는 열거 표제어의 신호라 함께 막는다.
 */
const VARIANT_HEADWORD = /[()/!?;:…,]|\betc\b|^[^A-Za-z]/

/** 외울 대상이 되는 품사 — 나머지(대명사·전치사·접속사·관사·조동사)는 표제어로 싣지 않는다. */
const CONTENT_POS = new Set([
  'noun',
  'verb',
  'adjective',
  'adverb',
  'idiom',
  'phrasal_verb',
])

/**
 * 품사로는 못 거르는 기능어 — **이름으로 막는다.**
 *
 * 실측 2026-08-16(스윕 리포트에 첫 표제어 열을 붙이고 나서 보였다): `빈출 2,000` ·
 * `30일 완성` · `레벨 V1-V3` 를 비롯한 여러 세트가 `have · come · but · will · say ·
 * there · know` 로 시작한다. `but`(그러나) · `there`(거기에) · `will`(~할 것이다)은
 * 외울 표제어가 아니라 문장을 잇는 부품이다.
 *
 * 왜 품사 필터가 못 잡나: 사전이 `but`·`there`·`so`·`just` 를 **부사**로,
 * `will` 을 **동사**로, `own`·`through` 를 **형용사**로 적어 두었기 때문이다. 틀린 표기가
 * 아니다 — 영어에서 그 낱말들이 실제로 그 자리에 서기도 한다. 다만 학습자가 단어장에서
 * 외울 대상은 아니다.
 *
 * 그래서 품사가 아니라 **목록**으로 정한다. 닫힌 부류라 목록이 자라지 않는다.
 * 부사 전체를 빼지는 않는다 — `quickly` · `carefully` · `finally` 는 외울 값이 있다.
 */
const FUNCTION_WORDS = new Set([
  // 조동사·be·대동사
  'be', 'am', 'is', 'are', 'was', 'were', 'been', 'being',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'ought',
  'do', 'does', 'did', 'done', 'have', 'has', 'had',
  // 접속·연결
  'but', 'and', 'or', 'nor', 'so', 'yet', 'than', 'then', 'if', 'unless', 'though',
  'although', 'because', 'while', 'whereas', 'whether',
  // 지시·존재
  'there', 'here', 'this', 'that', 'these', 'those', 'such', 'same', 'other', 'another',
  // 정도·빈도 부사 (문법 부품)
  'very', 'just', 'also', 'too', 'only', 'even', 'still', 'already', 'yet', 'ever',
  'never', 'always', 'often', 'sometimes', 'again', 'once', 'else', 'quite', 'rather',
  // 수량·한정
  'much', 'many', 'more', 'most', 'less', 'least', 'few', 'several', 'own', 'all', 'both',
  'each', 'every', 'any', 'some', 'none', 'enough',
  // 전치사처럼 쓰이는 것
  'through', 'about', 'over', 'under', 'between', 'among', 'during', 'across', 'along',
  'around', 'behind', 'beyond', 'within', 'without', 'upon', 'toward', 'towards',
])

/**
 * 풀 안에 기본형이 있는 굴절형 집합.
 *
 * 사전의 `inflected_forms` 를 뒤집어 만든다 — `go` 가 `goes·going·went·gone` 를 들고 있으므로
 * 그 넷은 `go` 가 같은 풀에 있을 때 버려진다. 어느 쪽이 기본형인지 추측하지 않는다.
 */
function poolInflections(population: CandidateWord[]): Set<string> {
  const present = new Set(population.map((c) => c.word.toLowerCase()))
  const drop = new Set<string>()

  // ① 사전이 명시한 굴절형 — 정확하지만 `inflected_forms` 가 있는 행이 15,217 개뿐이다.
  for (const c of population) {
    const base = c.word.toLowerCase()
    for (const f of c.inflected_forms) {
      const form = f.toLowerCase().trim()
      if (form && form !== base && present.has(form)) drop.add(form)
    }
  }

  // ② 철자 규칙 — ① 이 비어 있는 행을 메운다. 실측: `field` 행에 `fielding` 이 없어
  // 두 낱말이 나란히 실렸다("다섯 면" 세트 9·10번). 지면 단어장은 표제어를 한 번만 싣는다.
  // 대조군은 **이 풀**이다 — 풀 밖의 기본형까지 보려면 사전 전체가 필요하고, 그건
  // `exclude_inflections` 가 하는 더 비싼 일이다.
  for (const c of population) {
    const w = c.word.toLowerCase()
    if (!drop.has(w) && hasBaseIn(w, present)) drop.add(w)
  }

  return drop
}

/**
 * 영/미 철자 변이를 한쪽으로 접는다 — 같은 풀에 둘 다 있을 때만.
 *
 * 실측 2026-08-16: `교육과정 중등` 에 `neighbor/neighbour · favor/favour · honor/honour ·
 * humor/humour · labor/labour · theater/theatre` 여섯 쌍이 **각각 한 자리씩** 차지하고 있었다.
 * `30일 완성` 에는 `color/colour · colored/coloured · coloring/colouring · center/centre`.
 * 지면 단어장은 `favor (英 favour)` 처럼 한 표제어로 싣는다 — 둘을 나란히 두면 분량을
 * 낭비하고 교열을 안 한 책처럼 보인다.
 *
 * 어느 쪽을 남기나: **빈도가 높은 쪽**. 미국식을 기본으로 정하는 것보다 데이터가 낫다
 * (`theatre` 가 `theater` 보다 흔한 코퍼스도 있다).
 */
function poolSpellingVariants(population: CandidateWord[]): Set<string> {
  // 같은 낱말로 접히는 표준형 키. 영↔미 차이가 나는 철자를 한 방향으로 정규화한다.
  const canon = (w: string): string =>
    w
      .replace(/our(s?)\b/g, 'or$1') // colour → color · honours → honors
      .replace(/([bcdfghjklmnpqrstvwxz])re\b/g, '$1er') // centre → center · metre → meter
      .replace(/is(e|ed|es|ing|ation)\b/g, 'iz$1') // organise → organize
      .replace(/ys(e|ed|es|ing)\b/g, 'yz$1') // analyse → analyze
      .replace(/ll(ed|ing|er)\b/g, 'l$1') // travelled → traveled

  // **같은 낱말은 세지 않는다.** `same` 과 `SAME` 은 철자 변이가 아니라 중복이고,
  // 그건 이 함수가 아니라 중복 검사가 다룬다 (그 구분을 놓쳐 회귀가 한 번 깨졌다).
  const byCanon = new Map<string, Map<string, CandidateWord>>()
  for (const c of population) {
    const lower = c.word.toLowerCase()
    const k = canon(lower)
    const bucket = byCanon.get(k)
    if (bucket) {
      if (!bucket.has(lower)) bucket.set(lower, c)
    } else {
      byCanon.set(k, new Map([[lower, c]]))
    }
  }

  const drop = new Set<string>()
  for (const bucket of byCanon.values()) {
    const group = [...bucket.values()]
    if (group.length < 2) continue
    // 빈도가 가장 높은 하나만 남긴다 (순위가 없으면 뒤로).
    const keep = group.reduce((best, c) =>
      (c.frequency_rank ?? Number.MAX_SAFE_INTEGER) < (best.frequency_rank ?? Number.MAX_SAFE_INTEGER)
        ? c
        : best,
    )
    for (const c of group) {
      if (c !== keep) drop.add(c.word.toLowerCase())
    }
  }
  return drop
}

/** 필터 한 겹 — 왜 떨어졌는지 이유별로 센다. 드라이런 진단이 이 카운터에서 나온다. */
export function applyFilters(
  population: CandidateWord[],
  spec: SelectSpec,
  dropped: Record<string, number>,
): CandidateWord[] {
  const f = spec.filters
  const minLen = f.min_word_length ?? 3
  // 레시피가 품사를 직접 지정했으면(전치사 단어장 등) 내용어 필터를 걸지 않는다.
  const contentOnly = (f.content_pos_only ?? true) && f.primary_pos.length === 0
  const inflectionsToDrop =
    (f.drop_pool_inflections ?? true) ? poolInflections(population) : new Set<string>()
  const variantsToDrop =
    (f.drop_pool_spelling_variants ?? true) ? poolSpellingVariants(population) : new Set<string>()
  const excluded = new Set(f.exclude_registers.length > 0 ? f.exclude_registers : NOISE_REGISTERS)
  const mustExclude = new Set(spec.must_exclude.map((w) => w.toLowerCase()))
  const mustInclude = new Set(spec.must_include.map((w) => w.toLowerCase()))

  const kept: CandidateWord[] = []
  const seen = new Set<string>()

  for (const c of population) {
    const key = c.word.toLowerCase()

    if (seen.has(key)) {
      drop(dropped, 'duplicate')
      continue
    }

    if (mustExclude.has(key)) {
      drop(dropped, 'must_exclude')
      continue
    }

    // 수동 포함은 필터를 이긴다 — 어드민이 명시한 것을 자동 규칙이 지우면 개입이 무의미해진다.
    if (mustInclude.has(key)) {
      seen.add(key)
      kept.push(c)
      continue
    }

    if (!c.meaning_ko || c.meaning_ko.trim().length === 0) {
      drop(dropped, 'no_meaning_ko')
      continue
    }
    if (key.replace(/\s/g, '').length < minLen) {
      drop(dropped, 'too_short')
      continue
    }
    if (contentOnly) {
      const pos = c.primary_pos ?? c.pos
      if (!pos || !CONTENT_POS.has(pos)) {
        drop(dropped, 'function_word')
        continue
      }
      // 품사가 내용어여도 기능어일 수 있다 — 사전이 `but` 을 부사로, `will` 을 동사로 적는다.
      if (FUNCTION_WORDS.has(key)) {
        drop(dropped, 'function_word_listed')
        continue
      }
    }
    if (inflectionsToDrop.has(key)) {
      drop(dropped, 'inflection_of_pool_base')
      continue
    }
    if (variantsToDrop.has(key)) {
      drop(dropped, 'spelling_variant_of_pool')
      continue
    }
    if ((f.exclude_variant_headwords ?? true) && VARIANT_HEADWORD.test(c.word)) {
      drop(dropped, 'variant_headword')
      continue
    }
    // 굴절형 배제 — 근거 둘을 함께 본다.
    //   ① 사전 컬럼 `base_word` (정확하지만 커버리지 7%)
    //   ② 어휘집 대조 판정 `is_inflection` (resolve 가 차집합 좌변에서 계산)
    // 하나만 쓰면 `worn`(①만) 또는 `listing`(②만) 중 한쪽이 새어 나간다.
    if (f.exclude_inflections && ((c.base_word && !c.derivation_suffix) || c.is_inflection)) {
      drop(dropped, 'inflected_form')
      continue
    }
    if (f.require_frequency_rank && c.frequency_rank == null) {
      drop(dropped, 'no_frequency_rank')
      continue
    }
    if (f.verified_only && !c.verified) {
      drop(dropped, 'not_verified')
      continue
    }
    if (excluded.has(c.word_register ?? 'standard')) {
      drop(dropped, `register:${c.word_register}`)
      continue
    }
    if (f.v_level_min != null && (c.v_level == null || c.v_level < f.v_level_min)) {
      drop(dropped, 'v_level_below')
      continue
    }
    if (f.v_level_max != null && (c.v_level == null || c.v_level > f.v_level_max)) {
      drop(dropped, 'v_level_above')
      continue
    }
    if (f.cefr_levels.length > 0 && !(c.cefr_level && f.cefr_levels.includes(c.cefr_level as never))) {
      drop(dropped, 'cefr_mismatch')
      continue
    }
    if (f.freq_bands.length > 0 && !(c.frequency_band && f.freq_bands.includes(c.frequency_band as never))) {
      drop(dropped, 'freq_band_mismatch')
      continue
    }
    if (f.primary_pos.length > 0) {
      const pos = c.primary_pos ?? c.pos
      if (!pos || !f.primary_pos.includes(pos as never)) {
        drop(dropped, 'pos_mismatch')
        continue
      }
      // 한 품사만 모으는 유형은 두 컬럼의 일치를 요구한다 — `other`(형용사/동사)가
      // "동사 300" 에 들어오는 것을 막는다.
      if (f.require_pos_agreement && c.pos && c.primary_pos && c.pos !== c.primary_pos) {
        drop(dropped, 'pos_disagree')
        continue
      }
    }
    if (f.min_corpus_freq != null && (c.corpus_freq ?? 0) < f.min_corpus_freq) {
      drop(dropped, 'corpus_freq_below')
      continue
    }

    let fieldMissing: string | null = null
    for (const field of f.require_fields) {
      if (!hasField(c, field)) {
        fieldMissing = field
        break
      }
    }
    if (fieldMissing) {
      drop(dropped, `missing:${fieldMissing}`)
      continue
    }

    seen.add(key)
    kept.push(c)
  }

  return kept
}

/**
 * 파생어를 기본형으로 접는다.
 *
 * word family 유형에서만 켠다 — 켜면 `nation`/`national`/`nationality` 가 한 항목이 되고,
 * 끄면 각자 독립 카드가 된다. 어느 쪽도 기본값으로 옳지 않으므로 레시피가 정한다.
 * 남기는 대표는 **빈도가 가장 높은 형태**다 (기본형이 사전에 없을 수도 있으므로).
 */
export function collapseFamilies(
  candidates: CandidateWord[],
  dropped: Record<string, number>,
): CandidateWord[] {
  const byFamily = new Map<string, CandidateWord>()
  for (const c of candidates) {
    const key = (c.base_word ?? c.word).toLowerCase()
    const cur = byFamily.get(key)
    if (!cur) {
      byFamily.set(key, c)
      continue
    }
    const curRank = cur.frequency_rank ?? Number.MAX_SAFE_INTEGER
    const newRank = c.frequency_rank ?? Number.MAX_SAFE_INTEGER
    if (newRank < curRank) byFamily.set(key, c)
    drop(dropped, 'family_collapsed')
  }
  return [...byFamily.values()]
}

/** 목표 적용 — 개수 · 커버리지 · 전량. 커버리지는 코퍼스 빈도가 있어야 성립한다. */
export function applyObjective(
  candidates: CandidateWord[],
  objective: Objective,
  opts: { knownWords?: Set<string> },
): { kept: CandidateWord[]; coverage?: CoverageResult } {
  switch (objective.kind) {
    case 'all':
      return { kept: candidates }
    case 'count':
      return { kept: candidates.slice(0, objective.n) }
    case 'coverage': {
      const { picked, coverage } = greedyTokenCoverage(candidates, {
        target: objective.target,
        knownWords: opts.knownWords,
        maxWords: objective.max_words,
      })
      return { kept: picked, coverage }
    }
    default:
      return { kept: candidates }
  }
}

export interface PoolResult {
  /** 목표(개수·커버리지) 적용 **전** 의 후보 — 해금 선택이 이 풀 위에서 일어나야 한다 */
  pool: CandidateWord[]
  /** 필터만 통과한 것 (차감 전) — 커버리지 분모가 여기서 나온다 */
  filtered: CandidateWord[]
  dropped: Record<string, number>
  counts: { after_filters: number; after_subtract: number }
}

/**
 * 목표 적용 전까지 — 필터 → 차감 → family.
 *
 * 목표를 분리한 이유가 이 설계의 수정점이다: 해금(U1)은 **선별 전략**이지 정렬이 아니다.
 * 개수로 먼저 자른 뒤 그 안에서 해금 순서를 매기면, 같은 200개를 순서만 바꾸는 것이 되어
 * 대조군과 해금 문장 수가 같아진다(Round 1 실측: 155 vs 155). 풀 전체에서 200개를 고르게 해야
 * "무엇을 고르는가" 가 비교된다.
 */
export function selectPool(
  population: CandidateWord[],
  spec: SelectSpec,
  opts: { knownWords?: Set<string> } = {},
): PoolResult {
  const dropped: Record<string, number> = {}

  const filtered = applyFilters(population, spec, dropped)

  let afterSubtract = filtered
  if (opts.knownWords && opts.knownWords.size > 0 && spec.subtract_known_for) {
    afterSubtract = filtered.filter((c) => {
      if (opts.knownWords!.has(c.word.toLowerCase())) {
        drop(dropped, 'already_known')
        return false
      }
      return true
    })
  }

  const collapsed =
    spec.family_collapse === 'base_only' ? collapseFamilies(afterSubtract, dropped) : afterSubtract

  return {
    pool: collapsed,
    filtered,
    dropped,
    counts: { after_filters: filtered.length, after_subtract: afterSubtract.length },
  }
}

/** 선별 전 과정. 순서(필터 → 차감 → family → 목표)는 바꾸면 결과가 달라진다. */
export function select(
  population: CandidateWord[],
  spec: SelectSpec,
  opts: { knownWords?: Set<string> } = {},
): SelectResult {
  const dropped: Record<string, number> = {}

  const filtered = applyFilters(population, spec, dropped)
  const afterFilters = filtered.length

  // 기지 어휘 차감은 필터 뒤에 온다 — 앞에 두면 "아는 단어라서 빠졌다" 와
  // "레벨이 안 맞아서 빠졌다" 가 같은 카운터에 섞인다.
  let afterSubtract = filtered
  if (opts.knownWords && opts.knownWords.size > 0 && spec.subtract_known_for) {
    afterSubtract = filtered.filter((c) => {
      if (opts.knownWords!.has(c.word.toLowerCase())) {
        drop(dropped, 'already_known')
        return false
      }
      return true
    })
  }

  const collapsed =
    spec.family_collapse === 'base_only' ? collapseFamilies(afterSubtract, dropped) : afterSubtract

  // 커버리지 목표는 차감 전 모집단의 토큰 총량을 알아야 하므로 원본을 넘긴다.
  const objective =
    spec.objective.kind === 'coverage'
      ? applyObjective(filtered, spec.objective, { knownWords: opts.knownWords })
      : applyObjective(collapsed, spec.objective, {})

  return {
    kept: objective.kept,
    dropped,
    coverage: objective.coverage,
    counts: {
      after_filters: afterFilters,
      after_subtract: afterSubtract.length,
      after_objective: objective.kept.length,
    },
  }
}
