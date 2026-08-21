// packages/library-pipeline/src/textbook/school-types.test.ts
//
// 밴드별 유형과 **출처 축**의 계약. 두 축을 섞으면 커버리지가 부풀려진다 —
// "기출 빈칸" 과 "창작 빈칸" 은 같은 유형이고 출처만 다르다.

import { describe, expect, it } from 'vitest'

import { SCHOOL_TYPES, measureSchoolCoverage } from './school-types'
import { PASSAGE_ORIGINS, measureOrigins } from './passage-origin'

describe('SCHOOL_TYPES', () => {
  it('세 밴드를 모두 담고 키가 겹치지 않는다', () => {
    const keys = SCHOOL_TYPES.map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const b of ['elementary', 'middle', 'high_naesin'] as const) {
      expect(SCHOOL_TYPES.some((t) => t.band === b), b).toBe(true)
    }
  })

  it('모든 유형이 근거를 남긴다', () => {
    for (const t of SCHOOL_TYPES) expect(t.note.length, t.key).toBeGreaterThan(20)
  })

  it('본교 교과서가 필요한 것은 우리가 공급할 수 없다고 적는다', () => {
    for (const t of SCHOOL_TYPES.filter((x) => x.sourceNeed === 'own_textbook')) {
      expect(t.note, t.key).toMatch(/공급할 수 없다|BYO|사람이 채점/)
    }
  })
})

describe('measureSchoolCoverage', () => {
  it('서술형은 자동 채점 분모에서 뺀다 — 사람이 채점한다', () => {
    const c = measureSchoolCoverage()
    const written = SCHOOL_TYPES.filter((t) => t.answerMode === 'written').length
    expect(written).toBeGreaterThan(0)
    expect(c.autoGradable.total).toBe(SCHOOL_TYPES.length - written)
  })

  it('가장 싸게 만들 수 있는 유형을 따로 낸다 — 결정론 · 자동채점 · 지문 제약 없음', () => {
    const cheap = measureSchoolCoverage().cheapWins.map((t) => t.key)
    // **만든 것은 여기서 빠진다** — 남은 할 일 목록이지 자랑 목록이 아니다.
    //
    // 2026-08-21 에 다섯을 다 만들어 **목록이 비었다**:
    //   `buildWordOrder`(영작 배열) · `buildBlankWord`(빈칸) · `buildGrammarFix`(어법 고쳐쓰기)
    //   · `buildUnitVocab`(본문 어휘 뜻) · `buildUnitGrammar`(단원 문법)
    // 비었다는 것은 "**결정론 · 자동채점 · 지문 제약 없음**" 조건을 만족하는 남은 유형이
    // 없다는 뜻이지 내신을 다 덮었다는 뜻이 아니다 — 남은 것은 그림·음원이 필요하거나
    // (`word_picture`·`listen_choose`), 생성형이거나(`passage_comprehension`),
    // 본교 교과서가 있어야 하거나(`textbook_variant`), 사람이 채점한다(`written_*`).
    for (const key of ['word_order', 'blank_word', 'grammar_fix', 'unit_vocab', 'unit_grammar']) {
      expect(cheap, `${key} 는 만들었으니 남은 할 일이 아니다`).not.toContain(key)
      expect(SCHOOL_TYPES.find((t) => t.key === key)!.implemented, key).toBe(true)
    }
    expect(cheap).toEqual([])
    for (const k of cheap) {
      const t = SCHOOL_TYPES.find((x) => x.key === k)!
      expect(t.generation).toBe('deterministic')
      expect(t.answerMode).not.toBe('written')
    }
  })

  it('BYO 전용을 따로 낸다 — 내신의 유일한 경로다', () => {
    expect(measureSchoolCoverage().byoOnly.length).toBeGreaterThan(0)
  })
})

describe('PASSAGE_ORIGINS', () => {
  it('출처 축은 유형 축과 겹치지 않는다 — 다섯 출처', () => {
    expect(PASSAGE_ORIGINS).toHaveLength(5)
    expect(new Set(PASSAGE_ORIGINS.map((o) => o.key)).size).toBe(5)
  })

  it('조건 없이 쓸 수 있는 것은 창작과 PD 뿐이다', () => {
    const usable = measureOrigins().usable.map((o) => o.key)
    expect(usable.sort()).toEqual(['authored', 'public_domain'])
  })

  it('기출·기출변형은 이용 조건 확인이 남아 있다 — 확인 전에는 쓰지 않는다', () => {
    const check = measureOrigins().needsCheck.map((o) => o.key)
    expect(check.sort()).toEqual(['past_exam', 'past_variant'])
  })

  it('쓸 수 있는 출처는 우리 파이프라인의 대응물을 적는다', () => {
    for (const o of measureOrigins().usable) expect(o.ours.length, o.key).toBeGreaterThan(0)
  })
})
