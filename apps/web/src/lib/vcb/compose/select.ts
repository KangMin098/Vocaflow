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
 */
const VARIANT_HEADWORD = /[()/!?;:…]|^[^A-Za-z]/

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
 * 풀 안에 기본형이 있는 굴절형 집합.
 *
 * 사전의 `inflected_forms` 를 뒤집어 만든다 — `go` 가 `goes·going·went·gone` 를 들고 있으므로
 * 그 넷은 `go` 가 같은 풀에 있을 때 버려진다. 어느 쪽이 기본형인지 추측하지 않는다.
 */
function poolInflections(population: CandidateWord[]): Set<string> {
  const present = new Set(population.map((c) => c.word.toLowerCase()))
  const drop = new Set<string>()
  for (const c of population) {
    const base = c.word.toLowerCase()
    for (const f of c.inflected_forms) {
      const form = f.toLowerCase().trim()
      if (form && form !== base && present.has(form)) drop.add(form)
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
    }
    if (inflectionsToDrop.has(key)) {
      drop(dropped, 'inflection_of_pool_base')
      continue
    }
    if ((f.exclude_variant_headwords ?? true) && VARIANT_HEADWORD.test(c.word)) {
      drop(dropped, 'variant_headword')
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
