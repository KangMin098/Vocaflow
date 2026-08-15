// apps/web/src/lib/library/__tests__/bibliographic.test.ts
//
// 서지정보 정규화 회귀.
//
// 이 테스트의 절반은 **바꾸면 안 되는 것**을 지킨다. 무차별 타이틀케이스·무차별 도치풀이는
// 이미 옳은 표기를 망가뜨리는데, 그 손상은 카탈로그 전체에 조용히 퍼진 뒤에야 보인다.

import { describe, expect, it } from 'vitest'

import { collapseSpaces, needsNormalization, normalizeAuthor, normalizeTitle } from '../bibliographic'

describe('collapseSpaces', () => {
  it('이중 공백과 앞뒤 공백을 없앤다 (StoryWeaver 실측 결함)', () => {
    expect(collapseSpaces('Shabnam  Minwalla')).toBe('Shabnam Minwalla')
    expect(collapseSpaces('Mathangi  Subramanian ')).toBe('Mathangi Subramanian')
  })
})

describe('normalizeAuthor', () => {
  it('도서관 도치형을 자연형으로 (Gutenberg 실측)', () => {
    expect(normalizeAuthor('Austen, Jane')).toBe('Jane Austen')
    expect(normalizeAuthor('Dumas, Alexandre')).toBe('Alexandre Dumas')
  })

  it('이미 자연형이면 그대로', () => {
    expect(normalizeAuthor('Charles Dickens')).toBe('Charles Dickens')
    expect(normalizeAuthor('J. M. Barrie')).toBe('J. M. Barrie')
    expect(normalizeAuthor('Hans Jakob Christoffel von Grimmelshausen')).toBe(
      'Hans Jakob Christoffel von Grimmelshausen',
    )
  })

  it('접미사가 붙은 3부 이름은 뒤집지 않는다 — Jr. King 이 되면 안 된다', () => {
    expect(normalizeAuthor('King, Martin Luther, Jr.')).toBe('King, Martin Luther, Jr.')
    expect(normalizeAuthor('Smith, Jr.')).toBe('Smith, Jr.')
  })

  it('조직명은 뒤집지 않는다', () => {
    expect(normalizeAuthor('Little, Brown and Company')).toBe('Little, Brown and Company')
  })

  it('빈 값은 null', () => {
    expect(normalizeAuthor(null)).toBeNull()
    expect(normalizeAuthor('   ')).toBeNull()
  })
})

describe('normalizeTitle', () => {
  it('문장형 제목을 타이틀케이스로 (Gutenberg 실측)', () => {
    expect(normalizeTitle('Twenty years after')).toBe('Twenty Years After')
  })

  it('기능어는 소문자로 두되 첫/끝 단어는 올린다', () => {
    expect(normalizeTitle('the man in the moon')).toBe('The Man in the Moon')
    expect(normalizeTitle('a tale of two cities')).toBe('A Tale of Two Cities')
  })

  it('이미 옳은 제목은 한 글자도 바꾸지 않는다', () => {
    for (const t of [
      'Romeo and Juliet',
      'At the Back of the North Wind',
      'Adventures of Huckleberry Finn',
      'The Adventures of Pinocchio',
      'Introduction to Sociology - 2nd Canadian Edition',
      'Tell Me, What is a Drone?',
    ]) {
      expect(normalizeTitle(t)).toBe(t)
    }
  })

  it('대문자가 섞인 토큰은 건드리지 않는다 — 이미 의도된 표기다', () => {
    expect(normalizeTitle('Suspiria de Profundis')).toBe('Suspiria de Profundis')
    expect(normalizeTitle('At the Earth’s Core')).toBe('At the Earth’s Core')
  })

  // ── 문장형 게이트 ────────────────────────────────────────────────
  // 소문자 실단어가 **하나뿐이면 출판사의 표기**로 보고 손대지 않는다.
  // `Tell Me, What is a Drone?` 의 `is` 를 `Is` 로 고치는 것은 교정이 아니라 훼손이다.
  it('소문자 실단어가 1개뿐이면 출판사 표기로 보고 보존한다', () => {
    expect(normalizeTitle('Tell Me, What is a Drone?')).toBe('Tell Me, What is a Drone?')
    expect(normalizeTitle('MacDonald and the moon')).toBe('MacDonald and the moon')
    expect(normalizeTitle('“the raven”')).toBe('“the raven”')
  })

  it('소문자 실단어가 2개 이상이면 소스가 문장형으로 넣은 것 — 교정한다', () => {
    expect(normalizeTitle('Twenty years after')).toBe('Twenty Years After')
    expect(normalizeTitle('the man in the moon')).toBe('The Man in the Moon')
  })

  it('서수·판차를 망가뜨리지 않는다 (2nd → 2Nd 회귀)', () => {
    expect(normalizeTitle('introduction to sociology 2nd canadian edition')).toBe(
      'Introduction to Sociology 2nd Canadian Edition',
    )
  })
})

describe('needsNormalization', () => {
  it('고칠 것이 있으면 true', () => {
    expect(needsNormalization({ title: 'Twenty years after', author: 'Dumas, Alexandre' })).toBe(true)
    expect(needsNormalization({ title: 'Fine Title', author: 'Shabnam  Minwalla' })).toBe(true)
  })

  it('이미 균질하면 false — 백필이 헛돌지 않게', () => {
    expect(needsNormalization({ title: 'A Christmas Carol', author: 'Charles Dickens' })).toBe(false)
    expect(needsNormalization({ title: 'Romeo and Juliet', author: null })).toBe(false)
  })
})
