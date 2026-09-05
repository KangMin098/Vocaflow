// packages/library-pipeline/src/analyze/__tests__/clip-around-word.test.ts
//
// **긴 문장을 잘라도 낱말이 남는가.**
//
// 이 값(`first_sentence`)은 학습자 화면으로 그대로 간다 — 플래시카드 예문과 빈칸,
// 리더의 낱말 카드. 낱말이 잘려 나가면 **그 낱말이 없는 예문**이 되고, 빈칸도 안 뚫려
// 카드 앞면에 정답이 그대로 보인다. 저장도 렌더도 성공하므로 조용하다.
//
// 실측 2026-09-05: `slice(0, 300)` 때문에 도서 75,570행 · 글 30,526행이 그 상태였다.

import { describe, expect, it } from 'vitest'

import { clipAroundWord, SENTENCE_CAP } from '../extract-lemmas'

/**
 * 앞에 n자를 채운 뒤 낱말을 놓고, 뒤로 더 채운다 — 300자 경계를 확실히 넘긴다.
 * 채움과 낱말 사이에 **공백을 반드시 둔다**: 안 두면 `abmagnificence` 같은 붙은 토큰이 생겨
 * 「낱말 한가운데서 끊지 않는다」 검사가 코드가 아니라 이 빌더 때문에 깨진다(실제로 깨졌다).
 */
const build = (before: number, word: string, after: number) =>
  `${'ab '.repeat(Math.ceil(before / 3)).slice(0, before).trim()} ${word} ${'cd '.repeat(Math.ceil(after / 3)).slice(0, after).trim()}`.trim()

describe('clipAroundWord', () => {
  it('상한 이하 문장은 그대로 둔다', () => {
    const s = 'The cat sat on the mat.'
    expect(clipAroundWord(s, 'cat')).toBe(s)
  })

  it('낱말이 상한 뒤에 있어도 잘린 결과에 남는다', () => {
    const s = build(500, 'willow', 200)
    const out = clipAroundWord(s, 'willow')
    expect(s.length).toBeGreaterThan(SENTENCE_CAP)
    expect(out.toLowerCase()).toContain('willow')
  })

  it('잘라도 상한을 넘지 않는다 (말줄임표 몫 포함)', () => {
    const out = clipAroundWord(build(800, 'cannon', 800), 'cannon')
    expect(out.length).toBeLessThanOrEqual(SENTENCE_CAP + 2)
  })

  it('잘린 쪽에 말줄임표를 붙여 문장을 다 보여 준 척하지 않는다', () => {
    const out = clipAroundWord(build(600, 'legible', 600), 'legible')
    expect(out.startsWith('…')).toBe(true)
    expect(out.endsWith('…')).toBe(true)
  })

  it('문장 머리에 있으면 앞에는 말줄임표를 붙이지 않는다', () => {
    const out = clipAroundWord(`Willow ${'cd '.repeat(200)}`, 'Willow')
    expect(out.startsWith('…')).toBe(false)
    expect(out).toContain('Willow')
  })

  it('문장 끝에 있으면 뒤에는 말줄임표를 붙이지 않는다', () => {
    const out = clipAroundWord(`${'ab '.repeat(200)}willow`, 'willow')
    expect(out.endsWith('…')).toBe(false)
    expect(out).toContain('willow')
  })

  it('굴절형(표면형)으로 찾는다 — 표제어는 문장에 없을 수 있다', () => {
    const out = clipAroundWord(build(500, 'travellers', 200), 'travellers')
    expect(out).toContain('travellers')
  })

  it('대소문자가 달라도 찾는다', () => {
    const out = clipAroundWord(build(500, 'Cannon', 200), 'cannon')
    expect(out).toContain('Cannon')
  })

  it('낱말 한가운데서 끊지 않는다', () => {
    const out = clipAroundWord(build(500, 'magnificence', 500), 'magnificence')
    const body = out.replace(/^…|…$/g, '')
    // 잘린 양 끝이 온전한 토큰이어야 한다 — 'ab'/'cd' 로 채웠으므로 파편은 'a'/'c' 로 남는다
    expect(body.split(' ').every((t) => t === 'ab' || t === 'cd' || t === 'magnificence')).toBe(true)
  })

  it('표면형을 못 찾으면 예전처럼 머리를 자른다 — 빈 값을 내지 않는다', () => {
    const s = 'ab '.repeat(200)
    const out = clipAroundWord(s, 'nowhere-in-this-string')
    expect(out.length).toBeGreaterThan(0)
    expect(out.length).toBeLessThanOrEqual(SENTENCE_CAP)
  })
})
