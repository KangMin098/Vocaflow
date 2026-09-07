// packages/library-pipeline/src/textbook/drop-repeated-tail.test.ts
//
// 반복 꼬리 제거 회귀. **안 자르는 쪽을 더 많이 본다** — 잘못 자르면 지문 뒷부분이
// 통째로 사라지고, 조판물에서는 그게 안 보인다(짧아진 지문도 멀쩡해 보인다).
import { describe, expect, it } from 'vitest'

import { dropRepeatedTail } from './csat-format'

const OPENING =
  'The Amazon is Brazil greatest natural resource and invaluable to the rest of the world as a buffer against climate change. ' +
  'The recent election brought disputes over development plans for the region back into the spotlight. ' +
  'Historically, the development model has focused on exploitation of natural resources, resulting in degradation.'

describe('dropRepeatedTail — 글머리가 뒤에 다시 붙은 것', () => {
  it('꼬리가 글머리의 반복이면 자른다', () => {
    const body = `${OPENING} We discuss the impact on human health and outline policy actions. ${OPENING}`
    const out = dropRepeatedTail(body)
    expect(out.endsWith('outline policy actions.')).toBe(true)
    expect(out.length).toBeLessThan(body.length)
  })

  it('반복이 첫 문장 하나뿐이어도 자른다', () => {
    const first = 'The coexistence of diverse microbial communities presents a fundamental puzzle in ecology.'
    // ⚠️ 실제 지문 길이로 쓴다 — 300자 미만은 손대지 않는 규칙이라 짧은 표본으로는
    //   이 경로를 못 탄다(처음에 268자로 썼다가 통과해 버렸다).
    const middle =
      'We investigate the role of antibiotic-mediated interactions in driving microbial diversity using methods ' +
      'drawn from graph theory and theoretical ecology, and we explore spatially structured populations as well.'
    const body = `${first} ${middle} ${first}`
    expect(dropRepeatedTail(body)).toBe(`${first} ${middle}`)
  })

  // ── 자르면 안 되는 것 ──────────────────────────────────────────────
  it('반복이 없으면 한 글자도 안 바꾼다', () => {
    const s = `${OPENING} We discuss the impact on human health and outline policy actions that could help.`
    expect(dropRepeatedTail(s)).toBe(s)
  })

  it('되풀이 뒤에 새 내용이 이어지면 손대지 않는다', () => {
    const body = `${OPENING} Middle part here. ${OPENING} And then something genuinely new follows.`
    expect(dropRepeatedTail(body)).toBe(body)
  })

  it('첫 문장만 우연히 다시 나오는 경우는 자르지 않는다', () => {
    const first = 'The study was funded by a national research council.'
    const body = `${first} A long stretch of unrelated discussion follows here for quite a while indeed. ${first} But more text comes after.`
    expect(dropRepeatedTail(body)).toBe(body)
  })

  it('짧은 지문은 건드리지 않는다', () => {
    const s = 'Short passage. Short passage.'
    expect(dropRepeatedTail(s)).toBe(s)
  })

  it('빈 값·null 을 견딘다', () => {
    expect(dropRepeatedTail('')).toBe('')
    expect(dropRepeatedTail(null as unknown as string)).toBe('')
  })
})
