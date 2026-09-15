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
//   **audio_url 0% · image_url 0%** → Sound 면의 재생은 **브라우저 TTS 하나**다(제품 결정
//   2026-08-15 · 대체 경로 불필요). 그래서 단어 단위 녹음은 요구도 가산도 아니다.
//   Picture 는 재생할 방법이 아예 없어 여전히 결핍이다.

import type { FacetId } from '@/lib/framework/axes'
import { FACETS } from '@/lib/framework/axes'
import type { CandidateWord, RequirableField } from './types'
import { exampleContainsHeadword } from './match'

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
    // **TTS 는 단어장 범위 밖**이다(제품 결정 2026-08-15). 그러면 들려줄 것은 녹음 파일뿐이고,
    // 그것이 없으면 이 면은 성립하지 않는다 — IPA 는 표기이지 소리가 아니므로 대신 세지 않는다.
    // 현재 `audio_url` 0% 이므로 이 면을 선언하는 유형은 0건을 낸다. 그것이 사실이다.
    all: ['audio_url'],
    any_of: [],
    bonus: [],
    why: '들려줄 녹음이 있어야 한다. TTS 는 범위 밖이고 IPA 는 표기라 소리를 대신하지 못한다.',
  },
  build: {
    all: [],
    any_of: [['morphology']],
    bonus: ['korean_learner_note'],
    why: '조각으로 나눌 수 있어야 하므로 어근·접사·파생형 중 하나는 데이터로 있어야 한다.',
  },
  use: {
    // 문장이 **그 단어를 담고 있어야** 문맥 인출이 된다. 유의어로 쓴 예문
    // ('breeze through' 의 예문이 "She sailed through her exams")은 이 면을 지탱하지 못한다.
    all: ['example_en', 'example_matches'],
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

/**
 * 뜻이 **읽을 수 있는 상태**인가.
 *
 * ⚠️ 한때 "영문자 4자 이상이 있으면 오염" 으로 봤다가 **좋은 항목 1,640개를 모든 세트에서 뺐다**.
 * 실측하니 그 영문은 대부분 사전의 정상 표기였다:
 *   `dispose :: 처리하다 (dispose of)` — 필요한 구문을 보여 준다
 *   `criteria :: 기준들 (criterion의 복수형)` · `amphitheater :: 원형 경기장(amphitheatre 미국형)`
 * 진짜 결함은 **한국어가 아예 없는 것**(실측 2건)과 깨진 글자다. 그것만 막는다.
 */
export function meaningIsClean(meaning: string | null): boolean {
  const m = meaning?.trim() ?? ''
  if (m.length === 0 || m.length > 80) return false
  if (/[�]/.test(m)) return false
  return /[가-힣]/.test(m)
}

/** 후보가 이 필드를 실제로 갖고 있나 — 필드 이름 하나당 판정 한 곳. */
export function hasField(c: CandidateWord, field: RequirableField | 'frequency_band'): boolean {
  switch (field) {
    case 'meaning_ko':
      return !!c.meaning_ko && c.meaning_ko.trim().length > 0
    case 'meaning_clean':
      return meaningIsClean(c.meaning_ko)
    case 'example_en':
      // 코퍼스 문장이 있으면 그것이 더 좋은 예문이다 (실제 원서 문장).
      return (
        (!!c.example_en && c.example_en.trim().length > 0) ||
        (!!c.corpus_sentence && c.corpus_sentence.trim().length > 0)
      )
    case 'example_matches': {
      // 실측: 예문 42,133건 중 635건이 표제어를 담고 있지 않고, 관용어 쪽은 유의어로 쓴 예문이 섞여 있다
      // ('breeze through' 의 예문이 "She sailed through her exams"). 그런 예문은 문맥 학습에 쓸 수 없다.
      const ex = c.corpus_sentence ?? c.example_en
      if (!ex || ex.trim().length === 0) return false
      return exampleContainsHeadword(c.word, ex, c.inflected_forms)
    }
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
        (c.group_keys ?? []).some((g) => g.key.startsWith('root:')) ||
        // 구동사·관용어는 그 자체가 조각으로 나뉜다 — `give up` = give + up.
        // Build 면("조각으로 나누고 다시 붙일 수 있어요")이 가장 잘 맞는 항목이 오히려
        // 형태소 컬럼이 비어 있다는 이유로 빠지고 있었다.
        /\s/.test(c.word.trim())
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
  /** 어떻게 지탱되는가 — 리포트가 그대로 읽는다 (예: TTS 재생 · 녹음 없음) */
  note: string | null
}

/**
 * 후보 하나가 면 하나를 지탱하는가.
 *
 * `fallback` 은 "성립하지만 최선이 아님" 이다. 지금 이 등급을 쓰는 면은 없다 — Sound 가
 * 유일한 사용처였는데 브라우저 TTS 가 전달 방식으로 확정되면서 `full` 이 됐다.
 * 등급 자체는 남겨 둔다: 앞으로 "되긴 하지만 최선은 아닌" 경로(저해상도 이미지 등)가
 * 생기면 그때 쓸 자리다.
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
