// apps/web/src/lib/vcb/compose/__tests__/compose.test.ts
//
// 컴포저 순수 코어 회귀. DB 없이 돈다.
//
// 여기서 지키려는 불변식은 "이 유형이 이 유형인 이유" 다 —
// 혼동어 세트에 짝 없는 단어가 섞이지 않는다 · 어원 세트의 cap 이 정렬 뒤에 걸린다 ·
// 해금 순서가 빈도순을 실제로 이긴다 · 면 선언이 데이터 요구로 자동 번역된다.

import { describe, expect, it } from 'vitest'
import { BLUEPRINTS, getBlueprint, catalogSummary } from '../blueprints'
import { compose } from '../compose'
import { evaluateSet } from '../evaluate'
import { facetVerdict, requiredFieldsFor } from '../facets'
import { buildConfusableGroups, buildFamilyKeys, isNearSpelling, organize } from '../organize'
import { select } from '../select'
import {
  baselineSentenceUnlock,
  buildSentenceIndex,
  greedySentenceUnlock,
  greedyTokenCoverage,
} from '../unlock'
import type { CandidateWord, OrganizeSpec, SelectSpec } from '../types'
import { NOISE_REGISTERS } from '../types'

// ── 픽스처 ──────────────────────────────────────────────────────────

function word(w: string, over: Partial<CandidateWord> = {}): CandidateWord {
  return {
    word: w,
    lemma: null,
    // 뜻에 영문이 있으면 meaning_clean 필터에 걸린다 (실데이터 규칙과 같다)
    meaning_ko: `테스트 뜻`,
    pos: 'noun',
    primary_pos: 'noun',
    cefr_level: 'B1',
    v_level: 5,
    frequency_rank: 1000,
    frequency_band: 'top2k',
    word_register: 'standard',
    ipa: `/${w}/`,
    audio_url: null,
    image_url: null,
    example_en: `A sentence with ${w}.`,
    collocations: [],
    synonyms: [],
    antonyms: [],
    homophones: [],
    rhyme_key: null,
    sense_count: 1,
    mnemonic_ko: null,
    korean_learner_note: null,
    base_word: null,
    derivation_suffix: null,
    derived_forms: [],
    inflected_forms: [],
    verified: true,
    ...over,
  }
}

const baseSelect = (over: Partial<SelectSpec> = {}): SelectSpec => ({
  filters: {
    v_level_min: null,
    v_level_max: null,
    cefr_levels: [],
    freq_bands: [],
    primary_pos: [],
    verified_only: false,
    exclude_registers: [...NOISE_REGISTERS],
    require_fields: [],
  },
  objective: { kind: 'all' },
  subtract_known_for: null,
  family_collapse: 'none',
  must_include: [],
  must_exclude: [],
  ...over,
})

const baseOrganize = (over: Partial<OrganizeSpec> = {}): OrganizeSpec => ({
  group_by: 'none',
  group_order: 'size_desc',
  group_cap: null,
  order_within: 'frequency',
  pacing: null,
  keep_pairs_together: false,
  ...over,
})

// ── 면(facet) ───────────────────────────────────────────────────────

describe('facets — 선언이 데이터 요구로 번역된다', () => {
  it('Use 면은 예문이 없으면 성립하지 않는다', () => {
    const v = facetVerdict(word('alpha', { example_en: null, corpus_sentence: null }), 'use')
    expect(v.tier).toBe('missing')
    expect(v.missing).toContain('example_en')
  })

  it('코퍼스 문장이 있으면 사전 예문이 없어도 Use 가 성립한다', () => {
    const v = facetVerdict(
      word('alpha', { example_en: null, corpus_sentence: 'The alpha came first.' }),
      'use',
    )
    expect(v.tier).toBe('full')
  })

  it('Sound 면은 녹음도 IPA 도 없이 성립한다 — 재생 경로는 브라우저 TTS 하나다', () => {
    // 한때 녹음 유무로 강등했고(fallback · 0.7 가중), 그다음엔 IPA 를 요구했다.
    // 둘 다 "파일이나 표기가 재생을 지탱한다" 는 전제였는데, 재생은 TTS 가 한다.
    // 확정된 경로를 계속 결핍으로 세면 오디오 유형이 영원히 감점된 채로 남는다.
    const v = facetVerdict(word('alpha', { ipa: null }), 'sound')
    expect(v.tier).toBe('full')
    expect(v.note).toMatch(/TTS/)
  })

  it('Sound 면은 소리로 낼 수 없는 표제어에서만 불가다', () => {
    // TTS 는 라틴 문자를 영어로 읽는다. 사전에 섞인 비라틴 표기는 읽히지 않는다.
    const v = facetVerdict(word('한글'), 'sound')
    expect(v.tier).toBe('missing')
    expect(v.missing).toContain('speakable')
  })

  it('Build 면은 형태소 정보 중 하나라도 있으면 성립한다', () => {
    expect(facetVerdict(word('alpha'), 'build').tier).toBe('missing')
    expect(facetVerdict(word('alpha', { base_word: 'bravo' }), 'build').tier).toBe('full')
    expect(facetVerdict(word('alpha', { derived_forms: ['alphas'] }), 'build').tier).toBe('full')
  })

  it('any_of 요구는 필수 필드 목록에 들어가지 않는다 (넣으면 그 면의 세트가 전멸한다)', () => {
    // Build 면의 요구는 any_of(['morphology']) 하나뿐 — 형태소 커버리지 34.7% 이므로
    // 이것을 선별 필터로 올리면 어원 계열 세트가 3분의 1로 줄어든다.
    expect(requiredFieldsFor(['build'])).toEqual([])
    // Sound 면은 반대로 `all` 요구가 하나 있다 — 소리로 낼 수 없는 표제어는 애초에 빼야 한다.
    expect(requiredFieldsFor(['sound'])).toEqual(['speakable'])
    // Use 면은 예문이 **그 단어를 담고 있는지**까지 요구한다 (유의어로 쓴 예문 배제)
    expect(requiredFieldsFor(['use'])).toEqual(['example_en', 'example_matches'])
  })
})

// ── 선별 ────────────────────────────────────────────────────────────

describe('select — 필터·차감·family·목표', () => {
  it('register 잡음은 기본으로 빠진다', () => {
    const pop = [word('good'), word('olde', { word_register: 'archaic_literary' })]
    const r = select(pop, baseSelect())
    expect(r.kept.map((c) => c.word)).toEqual(['good'])
    expect(r.dropped['register:archaic_literary']).toBe(1)
  })

  it('must_include 는 필터를 이긴다 — 어드민 개입이 자동 규칙에 지워지면 안 된다', () => {
    const pop = [word('olde', { word_register: 'archaic_literary' })]
    const r = select(pop, baseSelect({ must_include: ['olde'] }))
    expect(r.kept).toHaveLength(1)
  })

  it('중복은 첫 등장만 남는다', () => {
    const r = select([word('same'), word('SAME')], baseSelect())
    expect(r.kept).toHaveLength(1)
    expect(r.dropped['duplicate']).toBe(1)
  })

  it('기지 어휘 차감은 subtract_known_for 가 있을 때만 걸린다', () => {
    const pop = [word('known'), word('fresh')]
    const known = new Set(['known'])
    expect(select(pop, baseSelect(), { knownWords: known }).kept).toHaveLength(2)
    const r = select(pop, baseSelect({ subtract_known_for: 'u1' }), { knownWords: known })
    expect(r.kept.map((c) => c.word)).toEqual(['fresh'])
    expect(r.dropped['already_known']).toBe(1)
  })

  it('family 접기는 빈도가 높은 형태를 대표로 남긴다', () => {
    const pop = [
      word('nationality', { base_word: 'nation', frequency_rank: 9000 }),
      word('national', { base_word: 'nation', frequency_rank: 800 }),
    ]
    const r = select(pop, baseSelect({ family_collapse: 'base_only' }))
    expect(r.kept.map((c) => c.word)).toEqual(['national'])
  })

  it('요구 필드 결측은 이유별로 집계된다', () => {
    const pop = [word('alpha', { collocations: [] }), word('bravo', { collocations: ['bravo up'] })]
    const r = select(pop, baseSelect({ filters: { ...baseSelect().filters, require_fields: ['collocations'] } }))
    expect(r.kept.map((c) => c.word)).toEqual(['bravo'])
    expect(r.dropped['missing:collocations']).toBe(1)
  })
})

// ── 조직 ────────────────────────────────────────────────────────────

describe('organize — 목차', () => {
  it('그룹 cap 은 정렬 뒤에 걸린다 (어근당 상위 N 이 무작위 N 이 되면 안 된다)', () => {
    const pop = [
      word('rare', { frequency_rank: 9000, group_keys: [{ key: 'root:1', label: 'spec' }] }),
      word('common', { frequency_rank: 100, group_keys: [{ key: 'root:1', label: 'spec' }] }),
    ]
    const r = organize(pop, baseOrganize({ group_by: 'root', group_cap: 1, order_within: 'frequency' }))
    expect(r.entries.map((e) => e.word)).toEqual(['common'])
    expect(r.dropped['group_cap']).toBe(1)
  })

  it('day 페이싱은 일자별로 정확히 잘린다', () => {
    const pop = Array.from({ length: 7 }, (_, i) => word(`word${i}`, { frequency_rank: i }))
    const r = organize(
      pop,
      baseOrganize({ group_by: 'day', pacing: { days: 3, per_day: 2 }, order_within: 'frequency' }),
    )
    expect(r.groups.map((g) => g.label)).toEqual(['1일차', '2일차', '3일차'])
    expect(r.groups.every((g) => g.entries.length === 2)).toBe(true)
    expect(r.dropped['pacing_overflow']).toBe(1)
  })

  it('sort_order 는 세트 전체에서 연속이다 (그룹 경계를 넘어도)', () => {
    const pop = [
      word('a', { v_level: 3 }),
      word('b', { v_level: 4 }),
      word('c', { v_level: 4 }),
    ]
    const r = organize(pop, baseOrganize({ group_by: 'v_level', group_order: 'v_level' }))
    expect(r.entries.map((e) => e.sort_order)).toEqual([0, 1, 2])
  })
})

describe('confusable — 짝', () => {
  it('편집거리 1 을 판정한다', () => {
    expect(isNearSpelling('affect', 'effect')).toBe(true)
    expect(isNearSpelling('desert', 'dessert')).toBe(true)
    expect(isNearSpelling('cat', 'dog')).toBe(false)
    expect(isNearSpelling('same', 'same')).toBe(false)
  })

  it('짝이 없는 단어는 solo 로 표시돼 blueprint_fit 감점으로 잡힌다', () => {
    const groups = buildConfusableGroups([word('affect'), word('effect'), word('zebra')])
    expect(groups.get('affect')!.key).toBe(groups.get('effect')!.key)
    expect(groups.get('zebra')!.key).toMatch(/^solo:/)
  })

  it('동음이의 목록이 사전에 없는 단어를 가리켜도 군집이 오염되지 않는다', () => {
    const groups = buildConfusableGroups([word('bank', { homophones: ['banc', 'banque'] })])
    expect(groups.get('bank')!.key).toMatch(/^solo:/)
  })
})

describe('family — derived_forms 역인덱스', () => {
  it('base_word 가 없어도 누가 나를 파생형으로 지목했으면 그 묶음에 들어간다', () => {
    const keys = buildFamilyKeys([
      word('nation', { derived_forms: ['national', 'nationality'] }),
      word('national'),
      word('nationality'),
    ])
    expect(keys.get('national')).toBe('nation')
    expect(keys.get('nationality')).toBe('nation')
    expect(keys.get('nation')).toBe('nation')
  })

  it('선언된 base 는 세트에 없어도 키가 된다 — 없는 base 를 무시하면 묶음이 흩어진다', () => {
    // Round 4 실측: "없는 base 는 무시" 로 짰다가 word-family 결과가 56 → 35 로 줄었다.
    const keys = buildFamilyKeys([
      word('national', { base_word: 'nation' }),
      word('nationality', { base_word: 'nation' }),
    ])
    expect(keys.get('national')).toBe('nation')
    expect(keys.get('nationality')).toBe('nation')
  })

  it('base_word 가 없을 때만 역인덱스가 개입한다', () => {
    const keys = buildFamilyKeys([
      word('run', { derived_forms: ['running'] }),
      word('running'),
    ])
    expect(keys.get('running')).toBe('run')
  })

  it('여러 단어가 나를 지목하면 더 짧은 쪽이 기본형이다', () => {
    const keys = buildFamilyKeys([
      word('act', { derived_forms: ['action'] }),
      word('activate', { derived_forms: ['action'] }),
      word('action'),
    ])
    expect(keys.get('action')).toBe('act')
  })
})

// ── 해금 ────────────────────────────────────────────────────────────

describe('unlock — 문장 해금이 빈도순을 이긴다', () => {
  // 구성: 문장 s1 = [rareA, rareB] · s2 = [rareA, rareB] · s3..s5 = [freqC] 각각 다른 문장.
  // 빈도순은 freqC 를 먼저 집지만, 문장 2개를 여는 데는 rareA+rareB 가 필요하다.
  const candidates: CandidateWord[] = [
    word('alpha', { frequency_rank: 9000, corpus_freq: 2, corpus_sentence: 'alpha beta gamma.' }),
    word('beta', { frequency_rank: 9500, corpus_freq: 2, corpus_sentence: 'alpha beta gamma.' }),
    word('gamma', { frequency_rank: 100, corpus_freq: 1, corpus_sentence: 'gamma delta zeta.' }),
    word('delta', { frequency_rank: 200, corpus_freq: 1, corpus_sentence: 'gamma delta zeta.' }),
    word('zeta', { frequency_rank: 300, corpus_freq: 1, corpus_sentence: 'gamma delta zeta.' }),
  ]

  it('문장 인덱스는 후보 어휘로만 환원된다', () => {
    const sentences = buildSentenceIndex(candidates)
    expect(sentences).toHaveLength(2)
    expect(sentences[0]!.words.sort()).toEqual(['alpha', 'beta', 'gamma'])
  })

  it('탐욕 해금은 같은 예산에서 빈도순 이상을 낸다', () => {
    const sentences = buildSentenceIndex(candidates)
    for (const budget of [1, 2, 3, 4]) {
      const ours = greedySentenceUnlock(candidates, sentences, { budget })
      const base = baselineSentenceUnlock(candidates, sentences, { budget })
      expect(ours.sentences_unlocked).toBeGreaterThanOrEqual(base.sentences_unlocked)
    }
  })

  it('마지막 조각 한 개가 문장을 연다 — 이득이 빈도와 다른 값이 되는 지점', () => {
    const sentences = buildSentenceIndex(candidates)
    const known = new Set(['gamma', 'delta'])
    const plan = greedySentenceUnlock(candidates, sentences, { budget: 1, knownWords: known })
    // gamma·delta 를 알고 있으면 zeta 하나로 두 번째 문장이 열린다.
    expect(plan.picks[0]!.word).toBe('zeta')
    expect(plan.picks[0]!.sentences_unlocked).toBe(1)
  })

  it('토큰 커버리지는 기지 어휘를 분자에 포함한다', () => {
    const pop = [
      word('a', { corpus_freq: 70 }),
      word('b', { corpus_freq: 20 }),
      word('c', { corpus_freq: 10 }),
    ]
    const r = greedyTokenCoverage(pop, { target: 0.9, knownWords: new Set(['a']) })
    expect(r.coverage.achieved).toBeCloseTo(0.9, 5)
    expect(r.picked.map((c) => c.word)).toEqual(['b'])
  })
})

// ── 평가 ────────────────────────────────────────────────────────────

describe('evaluate — 미달 원인이 blocker 로 드러난다', () => {
  it('짝 없는 단어는 세트에서 빠진다 — 개수를 채우려고 유형을 깨지 않는다', () => {
    const bp = getBlueprint('confusable')!
    // 요청 개수를 데이터가 줄 수 있는 만큼으로 둔다 — 규모 미달 가드가 옳게 작동하므로
    const set = compose(bp.build({ count: 2 }), [word('affect'), word('effect'), word('zebra')])
    expect(set.entries.map((e) => e.word).sort()).toEqual(['affect', 'effect'])
    expect(set.funnel.dropped['undersized_group']).toBe(1)
    expect(evaluateSet(set).blockers).toEqual([])
  })

  it('그룹 인지 선별은 목차의 폭을 지킨다 — 예산이 작아도 그룹이 굶지 않는다', () => {
    // 빈도 상위가 한 그룹에 몰려 있어도, 예산 4개가 두 그룹에 나뉘어야 한다.
    const bp = getBlueprint('pos-focus')!
    const pop = [
      word('alfa', { primary_pos: 'verb', frequency_rank: 1, v_level: 3 }),
      word('bravo', { primary_pos: 'verb', frequency_rank: 2, v_level: 3 }),
      word('charlie', { primary_pos: 'verb', frequency_rank: 3, v_level: 3 }),
      word('delta', { primary_pos: 'verb', frequency_rank: 900, v_level: 6 }),
    ]
    const set = compose(bp.build({ count: 2 }), pop)
    expect(set.groups).toHaveLength(2)
    expect(set.entries).toHaveLength(2)
  })

  it('짝이 온전하면 통과한다', () => {
    const bp = getBlueprint('confusable')!
    const set = compose(bp.build({ count: 2 }), [word('affect'), word('effect')])
    const card = evaluateSet(set)
    expect(card.blockers).toEqual([])
    expect(card.total).toBeGreaterThanOrEqual(0.8)
  })

  it('빈 세트는 즉시 blocker 다 — 조용한 0건 발행을 막는다', () => {
    const bp = getBlueprint('freq-tier')!
    const card = evaluateSet(compose(bp.build({}), []))
    expect(card.blockers[0]).toMatch(/빈 세트/)
    expect(card.passed).toBe(false)
  })

  it('선언 면이 전부 채워지면 fill 이 1.0 이다', () => {
    const bp = getBlueprint('freq-tier')!
    const set = compose(bp.build({ count: 2 }), [word('alpha'), word('bravo')])
    const fill = evaluateSet(set).metrics.find((m) => m.id === 'fill')!
    expect(fill.score).toBe(1)
  })
})

// ── 카탈로그 불변식 ─────────────────────────────────────────────────

describe('blueprint 카탈로그', () => {
  it('id 와 taxon 이 유일하다', () => {
    expect(new Set(BLUEPRINTS.map((b) => b.id)).size).toBe(BLUEPRINTS.length)
    expect(new Set(BLUEPRINTS.map((b) => b.taxon)).size).toBe(BLUEPRINTS.length)
  })

  it('모든 blueprint 가 유효한 레시피를 만든다', () => {
    for (const b of BLUEPRINTS) {
      const r = b.build({})
      expect(r.version).toBe(3)
      expect(r.blueprint).toBe(b.id)
      expect(r.meta.slug.length).toBeGreaterThan(0)
      expect(r.meta.title.length).toBeGreaterThan(0)
      expect(r.present.facets.length).toBeGreaterThan(0)
      // 면 선언이 요구 필드로 번역돼 있어야 한다 (자동 도출 계약)
      for (const f of requiredFieldsFor(r.present.facets)) {
        expect(r.select.filters.require_fields).toContain(f)
      }
    }
  })

  it('가중치 합이 1 에 가깝다 — 유형 간 점수 비교가 성립하려면', () => {
    for (const b of BLUEPRINTS) {
      const sum = Object.values(b.weights).reduce((s, x) => s + (x ?? 0), 0)
      expect(sum).toBeGreaterThan(0.95)
      expect(sum).toBeLessThan(1.05)
    }
  })

  it('자산 결손/부분 유형은 이유를 수치로 적어 둔다', () => {
    for (const b of BLUEPRINTS) {
      if (b.status !== 'ready') {
        expect(b.gap_note, `${b.id} 에 gap_note 없음`).toBeTruthy()
      }
    }
  })

  it('고유 유형은 우위 증명 규칙 또는 데이터 게이트를 갖는다', () => {
    const unique = BLUEPRINTS.filter((b) => b.family === 'unique')
    expect(unique.length).toBeGreaterThanOrEqual(3)
    for (const b of unique) {
      const hasProof = b.fit_rules.some(
        (r) => r.kind === 'beats_baseline' || r.kind === 'all_have_field' || r.kind === 'min_group_size',
      )
      expect(hasProof, `${b.id} 에 우위 증명 규칙 없음`).toBe(true)
    }
  })

  it('카탈로그 요약이 시중 26 + 고유 4 를 센다', () => {
    const s = catalogSummary()
    expect(s.total).toBe(31)
    expect(s.by_family.unique).toBe(5)
    // 자산이 없어 **만들 수 없는** 유형은 그림 하나뿐이다.
    // 오디오는 한때 여기 있었지만 오판이었다 — audio_url 은 0% 여도 흘려듣기는 런타임 TTS 로
    // 이미 돌고 있었다. 없는 것은 녹음본(오프라인·원어민 억양)이므로 partial 이 맞다.
    expect(s.by_status.asset_gap).toBe(1) // image_url 0% — 이미지 자산 수집이 선행 과제
  })
})
