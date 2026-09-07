// apps/web/src/lib/vcb/compose/__tests__/market.test.ts
//
// 경쟁 루브릭의 **공정성 규칙**을 고정한다.
//
// 이 파일이 지키는 것은 점수가 아니라 비교의 정직함이다:
//   · 우리에게 유리하게 기준선을 낮추지 않았는가
//   · 매체 특성 때문에 지는 것을 우리 결함으로 세지 않는가 (구에는 지면도 발음기호를 안 싣는다)
//   · 반대로 우리에게 유리한 판정(해당 없음·상한)을 우위로 둔갑시키지 않는가

import { describe, expect, it } from 'vitest'
import { BLUEPRINTS } from '../blueprints'
import { compose } from '../compose'
import {
  BLUEPRINT_COMPETITOR,
  COMPETITOR_BY_ID,
  ELEMENTS,
  evaluateMarket,
  exampleContainsHeadword,
} from '../market'
import type { CandidateWord } from '../types'

function word(w: string, over: Partial<CandidateWord> = {}): CandidateWord {
  return {
    word: w,
    lemma: null,
    meaning_ko: '테스트 뜻',
    pos: 'verb',
    primary_pos: 'verb',
    cefr_level: 'B1',
    v_level: 5,
    frequency_rank: 100,
    frequency_band: 'top1k',
    word_register: 'standard',
    ipa: `/${w}/`,
    audio_url: null,
    image_url: null,
    example_en: `They ${w} every day.`,
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

describe('경쟁 상대 프로필 — 우리에게 유리하게 깎지 않았는가', () => {
  it('모든 blueprint 에 같은 유형의 상대가 지정돼 있다', () => {
    for (const b of BLUEPRINTS) {
      const id = BLUEPRINT_COMPETITOR[b.id]
      expect(id, `${b.id} 에 경쟁 상대 없음`).toBeTruthy()
      expect(COMPETITOR_BY_ID.get(id!), `${id} 프로필 없음`).toBeTruthy()
    }
  })

  it('지면이 잘하는 요소의 기준선은 만점으로 잡혀 있다 (우리에게 가장 불리한 가정)', () => {
    for (const comp of COMPETITOR_BY_ID.values()) {
      expect(comp.profile.meaning, `${comp.id} 뜻 기준선`).toBe(1)
      expect(comp.profile.error_free, `${comp.id} 오류 기준선`).toBe(1)
      expect(comp.profile.example ?? 0, `${comp.id} 예문 기준선`).toBeGreaterThanOrEqual(0.95)
    }
  })

  it('지면이 구조상 못 하는 요소만 기준선 0 이다', () => {
    const impossible = ELEMENTS.filter((e) => e.print_impossible).map((e) => e.id)
    expect(impossible).toEqual(['personalization', 'adaptive_review', 'content_link', 'updatable'])
    for (const comp of COMPETITOR_BY_ID.values()) {
      for (const id of impossible) {
        // 원서 부록만 예외로 콘텐츠 연결을 부분 제공한다 — 그 사실을 기준선에 반영해 둔다.
        if (comp.id === 'voca-reader' && id === 'content_link') continue
        expect(comp.profile[id] ?? 0, `${comp.id}/${id}`).toBe(0)
      }
    }
  })
})

describe('예문 포함 판정 — 굴절·구', () => {
  it('불규칙 굴절은 사전 데이터로 잡는다 (어간 자르기로는 못 잡는다)', () => {
    expect(exampleContainsHeadword('come', 'He came down to see it.')).toBe(false)
    expect(exampleContainsHeadword('come', 'He came down to see it.', ['came', 'comes'])).toBe(true)
  })

  it('구는 조각이 떨어져 나타나도 인정한다', () => {
    expect(exampleContainsHeadword('give up', 'She will give it up tomorrow.')).toBe(true)
  })

  it('구의 머리 동사가 굴절해도 인정한다', () => {
    expect(
      exampleContainsHeadword('bring about', 'The crisis brought about reform.', ['brought']),
    ).toBe(true)
  })

  it('다른 낱말로 쓴 예문은 인정하지 않는다 (데이터 결함을 숨기지 않는다)', () => {
    expect(exampleContainsHeadword('breeze through', 'She sailed through her exams.')).toBe(false)
  })
})

describe('발음 표기 — 범위에서 제외된 요소는 승패를 가르지 않는다', () => {
  it('구 세트에서 발음 표기는 판정 대상이 아니다', () => {
    const bp = BLUEPRINTS.find((b) => b.id === 'phrasal-idiom')!
    const set = compose(bp.build({ count: 10 }), [
      word('give up', { primary_pos: 'phrasal_verb', ipa: null, frequency_rank: 10 }),
      word('take over', { primary_pos: 'phrasal_verb', ipa: null, frequency_rank: 20 }),
    ])
    const m = evaluateMarket(set)
    const pron = m.elements.find((e) => e.id === 'pronunciation')!
    expect(pron.applicable).toBe(false)
    expect(pron.delta).toBe(0)
    // 해당 없음은 "깰 수 있는 동률" 이 아니다 — 목표 초과 판정을 막지 않는다.
    expect(m.beatable_ties).not.toContain('pronunciation')
  })

  it('낱말 세트에서도 판정 대상이 아니다 — IPA 유무로 이기지도 지지도 않는다', () => {
    // 발음(IPA)·소리(TTS)를 단어장 범위에서 제외했다(제품 결정 2026-08-15).
    // 요소를 목록에서 지우지 않고 `applicable: false` 로 두는 이유는, 지우면
    // "16요소 전부 우위" 라는 말이 슬그머니 15요소 이야기가 되기 때문이다.
    const bp = BLUEPRINTS.find((b) => b.id === 'freq-tier')!
    const set = compose(bp.build({ count: 10 }), [
      word('alpha', { ipa: '/a/' }),
      word('bravo', { ipa: null }),
    ])
    const m = evaluateMarket(set)
    const pron = m.elements.find((e) => e.id === 'pronunciation')!
    expect(pron.applicable).toBe(false)
    expect(pron.delta).toBe(0)
    expect(m.beatable_ties).not.toContain('pronunciation')
  })

  it('IPA 가 없다고 후보에서 빠지지 않는다 — 요구 필드가 아니다', () => {
    // 한때 모든 낱말 유형이 IPA 를 요구했다(지면과 발음 표기로 겨루려고). 발음을 다루지
    // 않기로 한 지금 그 요구는 아무도 쓰지 않는 필드를 위해 후보를 버리는 것일 뿐이다.
    const bp = BLUEPRINTS.find((b) => b.id === 'freq-tier')!
    const set = compose(bp.build({ count: 10 }), [
      word('alpha', { ipa: '/a/' }),
      word('bravo', { ipa: null }),
    ])
    expect(set.entries.map((e) => e.candidate.word).sort()).toEqual(['alpha', 'bravo'])
  })
})

describe('목표 초과 판정 — 동률을 뭉뚱그리지 않는다', () => {
  it('상한(1.00) 동률과 해당 없음(0 vs 0)은 우위를 막지 않는다', () => {
    const bp = BLUEPRINTS.find((b) => b.id === 'freq-tier')!
    const set = compose(
      bp.build({ count: 6 }),
      // 레벨을 흩어 두 그룹 이상이 생기게 한다 — 한 챕터짜리 세트는 목차가 없는 것이고,
      // 그것을 목차 설계 만점으로 세면 루브릭이 거짓이 된다.
      Array.from({ length: 6 }, (_, i) =>
        word(`alfa${i}`, {
          // freq-tier 의 목차 축은 빈도 대역이다 — 대역이 하나뿐이면 목차가 갈리지 않는다.
          frequency_band: i % 2 === 0 ? 'top1k' : 'top2k',
          v_level: 4 + (i % 3),
          frequency_rank: i + 1,
          synonyms: ['x'],
          collocations: ['y z'],
          mnemonic_ko: '연상',
          base_word: 'alfa',
        }),
      ),
    )
    const m = evaluateMarket(set)
    // 뜻·오류는 1.00 상한이라 동률이지만 깰 수 있는 동률은 아니다.
    expect(m.tied).toContain('meaning')
    expect(m.beatable_ties).not.toContain('meaning')
    expect(m.losing).toEqual([])
  })
})
