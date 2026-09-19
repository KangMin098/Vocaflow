// apps/web/src/lib/comic/__tests__/vocab-integrity.test.ts
// 만화 target_vocab ↔ 챕터 단어장 정합 판정 회귀 (설계서 §7.4 · G7).

import { describe, expect, it } from 'vitest'

import { computeVocabOrphans, normalizeWord } from '../vocab-integrity'

const sets = (...pairs: Array<[string | null, string | null]>) =>
  pairs.map(([word, lemma]) => ({ word, lemma }))

describe('normalizeWord', () => {
  it('대소문자·공백·전후 문장부호를 제거한다', () => {
    expect(normalizeWord('  Humbug! ')).toBe('humbug')
    expect(normalizeWord('"Bah,"')).toBe('bah')
  })

  it('하이픈·어퍼스트로피는 단어 내부에서 보존한다', () => {
    expect(normalizeWord("don't")).toBe("don't")
    expect(normalizeWord('ill-favoured')).toBe('ill-favoured')
  })
})

describe('computeVocabOrphans', () => {
  it('단어장에 있으면 matched, 없으면 orphan', () => {
    const r = computeVocabOrphans(['humbug', 'shroud'], sets(['humbug', 'humbug']))
    expect(r.total).toBe(2)
    expect(r.matched).toBe(1)
    expect(r.orphans).toEqual(['shroud'])
  })

  it('lemma 로도 매칭된다 (굴절형 표면화 허용)', () => {
    const r = computeVocabOrphans(['wrought'], sets([null, 'wrought']))
    expect(r.orphans).toEqual([])
    expect(r.matched).toBe(1)
  })

  it('중복 target 은 한 번만 센다', () => {
    const r = computeVocabOrphans(['Humbug', 'humbug', 'HUMBUG'], sets(['humbug', null]))
    expect(r.total).toBe(1)
    expect(r.matched).toBe(1)
  })

  it('빈 문자열·기호만 있는 항목은 무시한다', () => {
    const r = computeVocabOrphans(['', '  ', '—', 'ghost'], sets(['ghost', null]))
    expect(r.total).toBe(1)
    expect(r.orphans).toEqual([])
  })

  it('단어장이 비면 전부 orphan (정합 위반이 그대로 드러난다)', () => {
    const r = computeVocabOrphans(['a', 'b'], [])
    expect(r.matched).toBe(0)
    expect(r.orphans).toEqual(['a', 'b'])
  })

  it('orphan 목록은 정렬되어 결정적이다', () => {
    const r = computeVocabOrphans(['zeal', 'apt', 'mirth'], [])
    expect(r.orphans).toEqual(['apt', 'mirth', 'zeal'])
  })
})
