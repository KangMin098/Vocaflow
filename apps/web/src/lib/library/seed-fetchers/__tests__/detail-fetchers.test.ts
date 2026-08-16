// apps/web/src/lib/library/seed-fetchers/__tests__/detail-fetchers.test.ts
//
// 시드 카탈로그 상세 파서 회귀.
//
// 왜 있는가 (실측 2026-08-16):
//   Standard Ebooks 는 `<section id="description">` **안에** 후원 배너 `<aside class="donation">`
//   를 끼워 넣는다. "첫 <p> 를 줄거리로 본다" 는 규칙이 그 배너를 집어서, 표본 5권이 전부
//   "Help us reach 40 new patrons by August 24" 를 돌려줬다 — 책마다 똑같은 41자.
//   빈 값이면 화면이 비어 눈에 띄지만, 이건 **그럴듯한 자리에 앉아 검수를 통과한다**.
//   1,439권을 백필하기 직전에 잡았고, 다시는 조용히 돌아오지 못하게 여기 고정한다.

import { describe, expect, it } from 'vitest'

import {
  parseStandardEbooksDescription,
  parseStandardEbooksReadingMinutes,
} from '../detail-fetchers'

// 실제 응답 구조를 줄인 것 (standardebooks.org/ebooks/guy-boothby/a-bid-for-fortune, 2026-08-16)
const SE_HTML = `
<aside id="reading-ease">
  <meta property="schema:wordCount" content="88518"/>
  <p>88,518 words (5 hours 22 minutes) with a reading ease of 80.11 (easy)</p>
  <ul class="tags"><li><a href="/subjects/fiction">Fiction</a></li></ul>
</aside>
<section id="description">
  <h2>Description</h2>
  <aside class="donation closable">
    <header><p>Help us reach 40 new patrons by August 24</p></header>
    <div class="progress"><p>23/40</p></div>
  </aside>
  <p>Guy Newell Boothby, born in Adelaide, was one of the most popular of Australian authors.</p>
  <p>A Bid for Fortune is the first of his series of five books featuring Dr. Nikola.</p>
</section>
`

describe('parseStandardEbooksDescription', () => {
  it('후원 배너(aside)를 줄거리로 집지 않는다', () => {
    const d = parseStandardEbooksDescription(SE_HTML)
    expect(d).not.toBeNull()
    expect(d).not.toMatch(/patrons/i)
    expect(d).not.toMatch(/Help us reach/i)
  })

  it('배너를 걷어낸 뒤 남은 문단을 모두 이어 붙인다', () => {
    const d = parseStandardEbooksDescription(SE_HTML) ?? ''
    // 첫 문단만 쓰면 저자 소개로 끝나 "무슨 이야기인지" 가 안 나온다.
    expect(d).toMatch(/Guy Newell Boothby/)
    expect(d).toMatch(/Dr\. Nikola/)
  })

  it('description 절이 없으면 null (빈 문자열로 채우지 않는다)', () => {
    expect(parseStandardEbooksDescription('<html><body>없음</body></html>')).toBeNull()
  })

  it('1500자에서 자른다', () => {
    const long = `<section id="description"><p>${'가'.repeat(4000)}</p></section>`
    expect(parseStandardEbooksDescription(long)).toHaveLength(1500)
  })
})

describe('parseStandardEbooksReadingMinutes', () => {
  it('"(N hours M minutes)" 를 분으로 환산한다', () => {
    expect(parseStandardEbooksReadingMinutes(SE_HTML)).toBe(5 * 60 + 22)
  })

  it('분만 있는 짧은 책도 읽는다', () => {
    expect(parseStandardEbooksReadingMinutes('<p>9,000 words (42 minutes) with a reading ease</p>')).toBe(42)
  })

  it('시간 표기가 없으면 null — 아무 괄호나 숫자로 읽지 않는다', () => {
    expect(parseStandardEbooksReadingMinutes('<p>reading ease of 80.11 (easy)</p>')).toBeNull()
  })
})
