// packages/library-pipeline/test/ligature-fold.test.ts
// 합자 분해 회귀 테스트 — v06.35.
//
// 배경: 76권 감사에서 유령 어휘 6건이 전부 `œ`(U+0153) 때문이었다. winkNLP 영어 모델의
//   토크나이저 문자 클래스가 Latin-1 Supplement 까지만이라 `œ` 가 단어를 쪼갠다:
//       œconomical → "œ" + "conomical"  → `conomical` 이 학습 단어로 저장
//   정규화 단계에서 합자를 펴면 토큰이 온전해지고, 그 뒤는 사전 해소 체인이
//   oeconomical → economical 로 잇는다.
//
// 이 테스트가 지키는 것: 합자가 다시 통과되면(정규화 누락/순서 변경) 즉시 실패한다.

import { describe, it, expect } from 'vitest'
import { normalizeLigatures, normalizePunctuation } from '../src/normalize/punctuation'

describe('normalizeLigatures', () => {
  it('œ / Œ 를 oe / Oe 로 편다 (유령 어휘 conomical·cumenical·otian 의 원인)', () => {
    expect(normalizeLigatures('œconomical')).toBe('oeconomical')
    expect(normalizeLigatures('œcumenical')).toBe('oecumenical')
    expect(normalizeLigatures('Bœotian')).toBe('Boeotian')
    expect(normalizeLigatures('Phœnician')).toBe('Phoenician')
    expect(normalizeLigatures('Œconomists')).toBe('Oeconomists')
  })

  it('æ / Æ 를 ae / Ae 로 편다 (토큰은 살아남지만 학습 필터에서 버려지던 형태)', () => {
    expect(normalizeLigatures('mediæval')).toBe('mediaeval')
    expect(normalizeLigatures('æsthetic')).toBe('aesthetic')
    expect(normalizeLigatures('encyclopædia')).toBe('encyclopaedia')
    expect(normalizeLigatures('Æsop')).toBe('Aesop')
  })

  it('인쇄 합자(Alphabetic Presentation Forms)도 편다', () => {
    expect(normalizeLigatures('ﬁnal')).toBe('final')
    expect(normalizeLigatures('ﬂow')).toBe('flow')
    expect(normalizeLigatures('eﬀort')).toBe('effort')
    expect(normalizeLigatures('eﬃcient')).toBe('efficient')
    expect(normalizeLigatures('shuﬄe')).toBe('shuffle')
  })

  it('한 문장에 여러 합자가 섞여도 모두 편다', () => {
    expect(normalizeLigatures('The œconomist read a mediæval ﬁle.')).toBe(
      'The oeconomist read a mediaeval file.',
    )
  })

  it('합자가 없는 텍스트는 그대로 둔다', () => {
    const s = "It was the best of times; don't change me -- really."
    expect(normalizeLigatures(s)).toBe(s)
  })

  it('Latin-1 범위의 발음구별부호는 건드리지 않는다 (café·naïve 는 별도 정책)', () => {
    expect(normalizeLigatures('café naïve résumé')).toBe('café naïve résumé')
  })
})

describe('normalizePunctuation — 합자 + 문장부호 통합', () => {
  it('합자 분해가 문장부호 정규화와 함께 적용된다', () => {
    expect(normalizePunctuation('“œconomical” — ﬁne…')).toBe('"oeconomical" -- fine...')
  })

  it('기존 문장부호 정규화 동작은 보존된다', () => {
    expect(normalizePunctuation('‘quoted’ – dash')).toBe("'quoted' - dash")
  })
})
