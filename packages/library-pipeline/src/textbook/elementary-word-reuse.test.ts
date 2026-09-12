// packages/library-pipeline/src/textbook/elementary-word-reuse.test.ts
//
// **초등 권은 한 권 안에서 같은 낱말을 다시 묻지 않는다.**
//
// 실측 2026-08-31 — V1 열 단원 중 넷이 단원 어휘 4~5개(나머지는 6개)라 자동 검수
// "단원마다 어휘가 고르다" 가 실패했다. 원인은 재고 부족이 아니었다: 낱말 재고는 **807개**인데
// 쓰는 것은 60개뿐이었고, 같은 낱말이 rhyme·word_meaning·spell_blank 세 유형에 하나씩
// 있어 **다른 단원에서 최대 세 번** 뽑혔다. 세 번째부터는 재등장 상한에 걸려
// 그 낱말이 어휘 목록에서 조용히 빠졌다.
//
// 같은 낱말을 세 번 묻는 것보다 서로 다른 낱말 60개를 묻는 편이 교재로도 낫다.
// ⚠️ 원글 유형에는 같은 규칙을 걸지 않는다 — 한 글에서 문항 여럿이 나오는 것은 설계다.
import { describe, expect, it } from 'vitest'

import { composeUnits, ELEMENTARY_ITEM_TYPES, type PoolItem } from './compose-unit'

const elementaryItem = (word: string, type: string, i: number): PoolItem =>
  ({
    id: `${type}-${word}-${i}`,
    type,
    ref_id: `word:${word}`,
    ref_title: word,
    v_level: 1,
    passage_text: '',
    passage_words: 0,
    body_sentences: 0,
    payload: { choices: ['a', 'b', 'c', 'd'] },
    answer_key: { answer: 1 },
  }) as unknown as PoolItem

describe('초등 권의 낱말 재사용', () => {
  it('세 유형이 같은 낱말을 들고 있어도 한 권에서 한 번만 쓴다', () => {
    // 낱말 30개 × 3유형 = 90문항. 5단원 × 6문항 = 30 슬롯이므로 재고는 넉넉하다.
    const words = Array.from({ length: 30 }, (_, i) => `word${i}`)
    const pool = words.flatMap((w, i) =>
      [...ELEMENTARY_ITEM_TYPES].map((t) => elementaryItem(w, t, i)),
    )
    const vocabByRef = new Map(
      words.map((w) => [`word:${w}`, [{ word: w, meaning_ko: `${w}의 뜻`, v_level: 1, frequency_in_article: 1 }]]),
    )
    const { units } = composeUnits(pool, vocabByRef as never, {
      band: 1,
      unitCount: 5,
      itemsPerUnit: 6,
      vocabCount: 6,
      targetShare: Object.fromEntries([...ELEMENTARY_ITEM_TYPES].map((t) => [t, 1 / 3])),
    } as never)

    expect(units).toHaveLength(5)
    const allRefs = units.flatMap((u) => u.items.map((i) => i.ref_id))
    expect(new Set(allRefs).size, '같은 낱말이 두 번 이상 쓰였다').toBe(allRefs.length)

    // 그리고 그 결과로 단원 어휘가 고르다 — 이것이 실패하던 자동 검수 항목이다.
    const sizes = units.map((u) => u.vocabulary.length)
    expect(new Set(sizes).size, `단원별 어휘 수가 갈린다: ${sizes.join(',')}`).toBe(1)
    expect(sizes[0]).toBe(6)
  })
})
