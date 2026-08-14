// apps/web/src/lib/vcb/compose/facets.ts
//
// 면(facet) → 요구 필드 매핑. 세트가 "이 면을 훈련할 수 있다" 고 선언하면 여기서 검증한다.
//
// 왜 이것이 필요한가:
//   axes.ts 의 `retrieval` 계약은 "4지선다로 익힌 단어를 말할 수 있다고 표기하는 것" 을 금지한다.
//   그 금지가 지켜지려면 **데이터가 그 면을 지탱하는지** 를 세트 발행 시점에 셀 수 있어야 한다.
//   지금은 셀 곳이 없어서 선언이 곧 주장이다. 이 파일이 선언을 검증 가능한 것으로 바꾼다.
//
// 실측 전제 (2026-08-14):
//   meaning_ko 100% · senses 100% · example_en 92% · ipa 81% · collocations 31%
//   **audio_url 0% · image_url 0%** → Sound 면은 ipa + 런타임 TTS 로만 지탱된다(= tts_fallback).

import type { FacetId } from '@/lib/framework/axes'
import { FACETS } from '@/lib/framework/axes'
import type { CandidateWord, RequirableField } from './types'

/** 면 하나의 데이터 요구. `all` 은 전부, `any_of` 는 하나 이상. */
export interface FacetRequirement {
  /** 반드시 있어야 하는 필드 */
  all: RequirableField[]
  /** 이 그룹들에서 각각 하나 이상 */
  any_of: RequirableField[][]
  /** 있으면 품질이 오르지만 없어도 성립 */
  bonus: RequirableField[]
  /** 왜 이 필드인가 — 도움말·리포트가 그대로 쓴다 */
  why: string
}

export const FACET_REQUIREMENTS: Record<FacetId, FacetRequirement> = {
  recognize: {
    all: ['meaning_ko'],
    any_of: [],
    bonus: ['example_en'],
    why: '뜻을 보고 고르는 면이므로 한국어 뜻이 정본이어야 한다.',
  },
  spell: {
    all: ['meaning_ko'],
    any_of: [],
    bonus: ['ipa', 'example_en'],
    why: '후보 없이 쓰게 하려면 단서가 뜻뿐이므로 뜻이 모호하면 성립하지 않는다.',
  },
  sound: {
    all: [],
    any_of: [['audio_url', 'ipa']],
    bonus: ['audio_url'],
    why: '들려줄 소리가 있어야 한다. 녹음 자산이 없으면 IPA + 런타임 TTS 로 대체된다(등급 하락).',
  },
  build: {
    all: [],
    any_of: [['morphology']],
    bonus: ['korean_learner_note'],
    why: '조각으로 나눌 수 있어야 하므로 어근·접사·파생형 중 하나는 데이터로 있어야 한다.',
  },
  use: {
    all: ['example_en'],
    any_of: [],
    bonus: ['collocations', 'korean_learner_note'],
    why: '문맥 인출이므로 문장이 없으면 이 면은 훈련이 아니라 암기가 된다.',
  },
  fluency: {
    all: ['meaning_ko'],
    any_of: [],
    bonus: ['frequency_band' as RequirableField],
    why: '속도 대역은 세션 산물이므로 데이터 요구는 재인과 같다. 다만 빈도를 알아야 대역을 정한다.',
  },
}

/** 후보가 이 필드를 실제로 갖고 있나 — 필드 이름 하나당 판정 한 곳. */
export function hasField(c: CandidateWord, field: RequirableField | 'frequency_band'): boolean {
  switch (field) {
    case 'meaning_ko':
      return !!c.meaning_ko && c.meaning_ko.trim().length > 0
    case 'example_en':
      // 코퍼스 문장이 있으면 그것이 더 좋은 예문이다 (실제 원서 문장).
      return (
        (!!c.example_en && c.example_en.trim().length > 0) ||
        (!!c.corpus_sentence && c.corpus_sentence.trim().length > 0)
      )
    case 'ipa':
      return !!c.ipa
    case 'audio_url':
      return !!c.audio_url
    case 'image_url':
      return !!c.image_url
    case 'collocations':
      return c.collocations.length > 0
    case 'synonyms':
      return c.synonyms.length > 0
    case 'antonyms':
      return c.antonyms.length > 0
    case 'homophones':
      return c.homophones.length > 0
    case 'rhyme_key':
      return !!c.rhyme_key
    case 'senses_multi':
      return c.sense_count >= 2
    case 'mnemonic_ko':
      return !!c.mnemonic_ko
    case 'korean_learner_note':
      return !!c.korean_learner_note
    case 'morphology':
      return (
        !!c.base_word ||
        !!c.derivation_suffix ||
        c.derived_forms.length > 0 ||
        (c.group_keys ?? []).some((g) => g.key.startsWith('root:'))
      )
    case 'frequency_band':
      return !!c.frequency_band
    default:
      return false
  }
}

export type FacetTier = 'full' | 'fallback' | 'missing'

export interface FacetVerdict {
  facet: FacetId
  tier: FacetTier
  missing: RequirableField[]
  /** 왜 fallback 인가 — 리포트가 그대로 읽는다 */
  note: string | null
}

/**
 * 후보 하나가 면 하나를 지탱하는가.
 *
 * `fallback` 은 "성립하지만 최선이 아님" 이다 — Sound 를 IPA + TTS 로 지탱하는 경우가 그것이고,
 * 이것을 `full` 로 기록하면 녹음 자산 0% 라는 사실이 리포트에서 사라진다.
 */
export function facetVerdict(c: CandidateWord, facet: FacetId): FacetVerdict {
  const req = FACET_REQUIREMENTS[facet]
  const missing: RequirableField[] = []

  for (const f of req.all) {
    if (!hasField(c, f)) missing.push(f)
  }
  for (const group of req.any_of) {
    if (!group.some((f) => hasField(c, f))) missing.push(...group)
  }

  if (missing.length > 0) {
    return { facet, tier: 'missing', missing, note: null }
  }

  if (facet === 'sound' && !hasField(c, 'audio_url')) {
    return {
      facet,
      tier: 'fallback',
      missing: ['audio_url'],
      note: '녹음 자산 없음 — 런타임 TTS 로 재생된다',
    }
  }

  return { facet, tier: 'full', missing: [], note: null }
}

export interface FacetReadiness {
  facet: FacetId
  code: string
  name: string
  /** full 비율 (0~1) */
  full_ratio: number
  /** full + fallback 비율 — "훈련 가능" 의 느슨한 정의 */
  ready_ratio: number
  missing_count: number
  /** 결측 필드별 건수 — 무엇을 채워야 이 면이 열리는지 */
  missing_by_field: Record<string, number>
  fallback_note: string | null
}

/** 세트 전체의 면별 준비도. 평가기의 `fill` 지표가 이 결과에서 나온다. */
export function facetReadiness(
  candidates: CandidateWord[],
  facets: FacetId[],
): FacetReadiness[] {
  return facets.map((facet) => {
    let full = 0
    let fallback = 0
    let fallbackNote: string | null = null
    const missingByField: Record<string, number> = {}

    for (const c of candidates) {
      const v = facetVerdict(c, facet)
      if (v.tier === 'full') full += 1
      else if (v.tier === 'fallback') {
        fallback += 1
        fallbackNote = v.note
      } else {
        for (const f of v.missing) missingByField[f] = (missingByField[f] ?? 0) + 1
      }
    }

    const n = candidates.length || 1
    return {
      facet,
      code: FACETS[facet].code,
      name: FACETS[facet].name,
      full_ratio: full / n,
      ready_ratio: (full + fallback) / n,
      missing_count: candidates.length - full - fallback,
      missing_by_field: missingByField,
      fallback_note: fallbackNote,
    }
  })
}

/** 선언 면들이 요구하는 필드의 합집합 — select.require_fields 자동 도출에 쓴다. */
export function requiredFieldsFor(facets: FacetId[]): RequirableField[] {
  const out = new Set<RequirableField>()
  for (const f of facets) {
    const req = FACET_REQUIREMENTS[f]
    for (const field of req.all) out.add(field)
    // any_of 는 그룹 중 하나면 되므로 필수 목록에 넣지 않는다 —
    // 넣으면 audio_url 0% 때문에 Sound 선언 세트가 전멸한다.
  }
  return [...out]
}
