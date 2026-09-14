// packages/library-pipeline/src/textbook/csat-format.test.ts
//
// 수능 인쇄 형식의 계약. 형식이 실전과 다르면 연습 효과가 반감되므로,
// **답지 개수·자리 개수·원순서 제외**를 못 박는다.

import { describe, expect, it } from 'vitest'

import {
  hasArticleChrome,
  CSAT_INSERT_BODY_SENTENCES,
  hasCitationResidue,
  isPrintablePassage,
  normalizeSourceMarkup,
  ORDER_PERMS,
  splitIntoThree,
  toCsatInsert,
  toCsatOrder,
} from './csat-format'

/** 원문 n문장을 만들고, DCP 저장 형식(presented + source_order)으로 셔플해 돌려준다. */
const shuffled = (n: number, perm: number[]) => {
  const original = Array.from({ length: n }, (_, i) => `S${i}.`)
  return { presented: perm.map((i) => original[i]!), sourceOrder: perm, original }
}

describe('toCsatOrder', () => {
  it('도입문을 떼고 나머지를 (A)(B)(C) 세 덩어리로 만든다', () => {
    const { presented, sourceOrder } = shuffled(4, [2, 0, 3, 1])
    const it4 = toCsatOrder(presented, sourceOrder)!
    expect(it4.intro).toBe('S0.')
    expect(it4.blocks.map((b) => b.label)).toEqual(['A', 'B', 'C'])
    expect(it4.blocks.flatMap((b) => b.sentences).sort()).toEqual(['S1.', 'S2.', 'S3.'])
  })

  it('답지는 5개이고 **원순서 (A)-(B)-(C) 는 없다**', () => {
    // 원순서가 답지에 있으면 그게 정답일 때 문제가 성립하지 않는다. 수능도 뺀다.
    const { presented, sourceOrder } = shuffled(5, [1, 3, 0, 4, 2])
    const item = toCsatOrder(presented, sourceOrder)!
    expect(item.choices).toHaveLength(5)
    expect(item.choices.some((c) => c.join('') === 'ABC')).toBe(false)
    expect(ORDER_PERMS).toHaveLength(5)
  })

  it('정답 번호가 가리키는 답지대로 배열하면 원문이 된다', () => {
    for (const [n, perm] of [
      [4, [2, 0, 3, 1]],
      [5, [1, 3, 0, 4, 2]],
      [6, [3, 1, 5, 0, 4, 2]],
    ] as const) {
      const { presented, sourceOrder, original } = shuffled(n, [...perm])
      const item = toCsatOrder(presented, sourceOrder)!
      const answerLabels = item.choices[item.answer - 1]!
      const rebuilt = [
        item.intro,
        ...answerLabels.flatMap((l) => item.blocks.find((b) => b.label === l)!.sentences),
      ]
      expect(rebuilt, `n=${n}`).toEqual(original)
    }
  })

  it('같은 지문은 늘 같은 문항이 된다 — 멱등', () => {
    const { presented, sourceOrder } = shuffled(5, [1, 3, 0, 4, 2])
    const a = toCsatOrder(presented, sourceOrder)!
    const b = toCsatOrder(presented, sourceOrder)!
    expect(a.answer).toBe(b.answer)
    expect(a.blocks).toEqual(b.blocks)
  })

  it('4문장 미만이면 만들지 않는다 — 도입 + 3덩어리가 안 나온다', () => {
    const { presented, sourceOrder } = shuffled(3, [1, 2, 0])
    expect(toCsatOrder(presented, sourceOrder)).toBeNull()
  })
})

describe('toCsatInsert', () => {
  const body = ['A.', 'B.', 'C.', 'D.', 'E.']

  it('지문 5문장 · 자리 5곳 — 수능 ①~⑤ 와 같다', () => {
    const item = toCsatInsert(body, 'X.', 3)!
    expect(item.body).toHaveLength(CSAT_INSERT_BODY_SENTENCES)
    expect(item.slots).toEqual([1, 2, 3, 4, 5])
    expect(item.answer).toBe(3)
  })

  it('**정답이 ①~⑤ 어디든 될 수 있다** — 첫 자리가 빠지지 않는다', () => {
    // 저장 형식에서는 removeIdx 가 1..n-1 이라 "첫 자리는 절대 정답이 아니다" 는
    //   편향이 있었다. n=6 일 때 1~5 가 ①~⑤ 에 그대로 대응해 편향이 사라진다.
    for (const p of [1, 2, 3, 4, 5]) {
      expect(toCsatInsert(body, 'X.', p)!.answer).toBe(p)
    }
  })

  it('자리를 5곳 못 만들면 거부한다 — ①~③ 을 연습시키지 않는다', () => {
    expect(toCsatInsert(['A.', 'B.', 'C.'], 'X.', 2)).toBeNull()
    expect(toCsatInsert(['A.', 'B.', 'C.', 'D.'], 'X.', 2)).toBeNull()
    // 상한 밖(10문장)도 거부 — 지문이 너무 길면 수능 지문이 아니다.
    expect(toCsatInsert(Array.from({ length: 10 }, (_, i) => `S${i}.`), 'X.', 2)).toBeNull()
  })

  it('지문이 6~9문장이어도 자리는 5곳이다 — 실제 수능 지문이 그렇다', () => {
    for (const n of [6, 7, 8, 9]) {
      const long = Array.from({ length: n }, (_, i) => `S${i}.`)
      const item = toCsatInsert(long, 'X.', 3)
      expect(item, `n=${n}`).not.toBeNull()
      expect(item!.slots, `n=${n}`).toHaveLength(5)
      expect(item!.body, `n=${n}`).toHaveLength(n)
    }
  })

  it('정답 자리는 언제나 답지 안에 있다', () => {
    for (const n of [5, 6, 7, 8, 9]) {
      const long = Array.from({ length: n }, (_, i) => `S${i}.`)
      for (let pos = 1; pos <= n; pos++) {
        const item = toCsatInsert(long, 'X.', pos)!
        expect(item.slots, `n=${n} pos=${pos}`).toContain(pos)
        expect(item.slots[item.answer - 1], `n=${n} pos=${pos}`).toBe(pos)
      }
    }
  })

  it('자리를 지문에 고르게 퍼뜨린다 — 정답만 외따로면 위치로 찍는다', () => {
    const nine = Array.from({ length: 9 }, (_, i) => `S${i}.`)
    const slots = toCsatInsert(nine, 'X.', 5)!.slots
    expect(slots[0]).toBe(1)
    expect(slots[slots.length - 1]).toBe(9)
  })

  it('범위 밖 정답은 거부한다', () => {
    expect(toCsatInsert(body, 'X.', 0)).toBeNull()
    expect(toCsatInsert(body, 'X.', 6)).toBeNull()
  })
})

describe('hasCitationResidue', () => {
  it('논문 인용 잔해를 잡는다 — 실물 사례', () => {
    // 실측: 문항 758개 중 64개에 있었고 전부 PLOS 였다.
    expect(hasCitationResidue('[] trained the model using a sample set and 71 features')).toBe(true)
    expect(hasCitationResidue('as shown by earlier work [12].')).toBe(true)
    expect(hasCitationResidue('see [3, 4] for details')).toBe(true)
  })

  it('평범한 문장은 통과시킨다', () => {
    for (const s of [
      'Bees pollinate most of the crops we eat.',
      'The bracket [ was never closed.',
      'He said "wait" and left.',
    ]) {
      expect(hasCitationResidue(s), s).toBe(false)
    }
  })

  it('잔해가 있으면 변환 자체를 막는다 — 교재에 인쇄될 수 없다', () => {
    const body = ['A [] b.', 'B.', 'C.', 'D.', 'E.']
    expect(toCsatInsert(body, 'X.', 3)).toBeNull()
    const presented = ['P [12] q.', 'Q.', 'R.', 'S.']
    expect(toCsatOrder(presented, [0, 1, 2, 3])).toBeNull()
  })
})

describe('splitIntoThree', () => {
  it('앞쪽 덩어리가 더 길다', () => {
    expect(splitIntoThree(3)).toEqual([1, 1, 1])
    expect(splitIntoThree(4)).toEqual([2, 1, 1])
    expect(splitIntoThree(5)).toEqual([2, 2, 1])
    expect(splitIntoThree(6)).toEqual([2, 2, 2])
  })

  it('3문장 미만은 나눌 수 없다', () => {
    expect(splitIntoThree(2)).toBeNull()
  })

  it('합이 보존된다', () => {
    for (const n of [3, 4, 5, 6, 7, 8]) {
      expect(splitIntoThree(n)!.reduce((a, b) => a + b, 0), `n=${n}`).toBe(n)
    }
  })
})

describe('hasArticleChrome — 기사 껍데기', () => {
  // 실측 2026-08-30: V5 대기열 3,215편 중 이런 자국이 있는 채로 통과하던 것들.
  it.each([
    ['읽기시간 머리말', '5 Min Read Ike Theriot Helps Prepare Astronauts to Work on the Moon'],
    ['크레딧', 'Credits: NASA Sumer Loggins wrote the article for the agency.'],
    ['날짜 도장', 'Sumer Loggins Aug 03, 2026 Article From serving in the U.S. Army'],
    ['Q&A 표지', 'Q What is lenacapavir and how does it work? A Lenacapavir is a drug.'],
    ['캡션 나열', 'Micro Ocean-Bottom Seismometers Being Deployed Close Meeting a Crucial Need'],
    // ⚠️ 실측 2026-09-08: 청크 지문 60,058편 중 **153편**이 이 머리말을 달고 있었는데
    //    위 규칙 어느 것에도 안 걸렸다(날짜 도장도 `Credits:` 도 아니다). 그대로 조판하면
    //    `APOD APOD Astronomy Picture of the Day Discover the cosmos!` 가 학생 지면에 찍힌다.
    [
      'APOD 사이트 머리말',
      'APOD APOD Astronomy Picture of the Day Discover the cosmos! Each day a different image of our universe is featured.',
    ],
    ['이미지 번호 나열', 'Image 1Image 2 The Red Glow of the Cosmic Bat Nebula sits far away.'],
  ])('%s 를 잡는다', (_label, text) => {
    expect(hasArticleChrome(text)).toBe(true)
    expect(isPrintablePassage(text)).toBe(false)
  })

  it.each([
    ['평범한 산문', 'The people who ruled the roads wanted one fixed way to measure a route.'],
    ['문장 속 credit', 'Farmers could not get credit from the bank, so they sold the land.'],
    ['분기 표기', 'Sales in Q4 rose sharply after the new plant opened in March.'],
    ['월 이름만', 'In August the river runs low and the ferries stop for a week.'],
    // APOD 규칙이 넓어져 평범한 천문 산문까지 버리기 시작하면 이 줄이 먼저 깨져야 한다.
    ['천문 산문', 'She took a picture of the day the comet passed over the quiet harbor.'],
  ])('%s 는 걸리지 않는다 — 본문을 버리면 안 된다', (_label, text) => {
    expect(hasArticleChrome(text)).toBe(false)
  })

  // ── 날짜 규칙 정정 2026-08-30 (원글 24,738편 대조) ───────────────────
  // 옛 규칙은 `May` 가 온전한 달 이름이면서 세 글자 약어이기도 한 것에 기대고 있었다.
  // 그래서 5월이 든 학술지 앞장만 우연히 잡고, 산문 속 5월 날짜까지 같이 버렸다.
  it.each([
    ['학술지 접수·게재일', 'Received: December 17, 2024; Accepted: November 18, 2025; Published: December 2, 2025'],
    ['게재일 단독', 'Editor: Olaf Sporns, Indiana University Published: January 26, 2012 This is an open-access article.'],
    ['학술지 저작권 라벨', 'Copyright: © 2012 Vlachos et al. This is an open-access article distributed under the terms.'],
  ])('%s 을 잡는다 — 5월이 없어도', (_label, text) => {
    expect(hasArticleChrome(text)).toBe(true)
  })

  it.each([
    ['산문 속 5월 날짜', 'The May 18, 1980, eruption of Mount St. Helens still washes sediment downstream.'],
    ['인물 생몰년', 'Commodore Nutt (April 1, 1848 – May 25, 1881) was an American entertainer.'],
    ['문장 첫머리 5월 날짜', 'On May 18, 2023, frost damaged trees across New York state and cut the apple crop.'],
  ])('%s 는 걸리지 않는다 — 껍데기가 아니라 글이다', (_label, text) => {
    expect(hasArticleChrome(text)).toBe(false)
  })
})

// ── 왜 이 검사가 생겼나 (실측 2026-09-13) ───────────────────────────
// `splitIntoThree` 가 `sizes[(seed + k) % 3]` 로 튜플을 짚고 있었다. tsc 는 그것을
// 「undefined 일 수 있다」로 잡아 **브랜치의 typecheck 를 깨 둔 채**였고, 잡은 이유도 맞았다 —
// 내보낸 함수라 음수 seed 가 오면 JS 의 % 가 음수를 내고 튜플 밖을 짚는다.
// 지금 부르는 곳(hash)은 늘 0 이상이라 겉으로는 멀쩡했다. 고치면서 **결과가 안 바뀌는 것**을
// 함께 잠근다 — 이 함수는 멱등이 계약이라 조용히 배치가 달라지면 옛 문항과 새 문항이 갈린다.
describe('splitIntoThree — 남는 문장을 얹는 자리', () => {
  it('세 덩어리 합이 늘 n 이다', () => {
    for (let n = 3; n <= 30; n += 1) {
      for (let seed = 0; seed < 7; seed += 1) {
        const r = splitIntoThree(n, seed)!
        expect(r.reduce((a, b) => a + b, 0), `n=${n} seed=${seed}`).toBe(n)
      }
    }
  })

  it('3문장 미만은 null — 덩어리가 안 나온다', () => {
    expect(splitIntoThree(2)).toBeNull()
    expect(splitIntoThree(0)).toBeNull()
  })

  it('seed 가 0 이상이면 접기 전과 같은 배치다 — 멱등이 계약이다', () => {
    for (let n = 3; n <= 30; n += 1) {
      for (let seed = 0; seed < 20; seed += 1) {
        const base = Math.floor(n / 3)
        const want: [number, number, number] = [base, base, base]
        for (let k = 0; k < n % 3; k += 1) want[(seed + k) % 3] += 1
        expect(splitIntoThree(n, seed), `n=${n} seed=${seed}`).toEqual(want)
      }
    }
  })

  // ⚠️ 이것이 tsc 가 잡은 그 자리다 — 고치기 전에는 튜플 밖을 짚어 덩어리가 NaN 이 됐다.
  it('음수 seed 도 튜플 안에 갇힌다 — 합이 깨지지 않는다', () => {
    for (const seed of [-1, -2, -3, -7, -100]) {
      for (let n = 3; n <= 12; n += 1) {
        const r = splitIntoThree(n, seed)!
        expect(r.every((x) => Number.isInteger(x) && x >= 0), `seed=${seed} n=${n}`).toBe(true)
        expect(r.reduce((a, b) => a + b, 0)).toBe(n)
      }
    }
  })
})

/**
 * **원본 서식과 플랫폼 껍데기** (3인 검수 3회차 실측 2026-09-14).
 *
 * 검수자 셋이 각자 같은 자국을 냈다. 둘로 갈라 다뤘다 —
 * **표기법은 옮기고**(재고를 안 버린다) **껍데기는 막는다**(지면에 올 수 없다).
 */
describe('구텐베르크 표기를 지면 글자로 옮긴다', () => {
  it('낱말 사이 이중 하이픈을 줄표로 옮긴다 — 실측 4,389문항', () => {
    expect(normalizeSourceMarkup("Larry understands--he's holding back Red Hannigan!")).toContain('understands—he')
    expect(normalizeSourceMarkup('synthetic--that is to say')).toContain('synthetic—that')
  })

  it('짝이 맞는 밑줄 강조를 벗긴다 — 실측 1,565문항', () => {
    expect(normalizeSourceMarkup('Reason must _possess a formative faculty._')).toBe(
      'Reason must possess a formative faculty.',
    )
  })

  // ⚠️ 옮기는 자가 **버리는 자**가 되면 구텐베르크 재고가 통째로 날아간다.
  it('멀쩡한 글은 그대로 둔다', () => {
    const plain = 'The tide rose twice that night and the boats pulled hard at their lines.'
    expect(normalizeSourceMarkup(plain)).toBe(plain)
  })

  it('홀로 선 밑줄·목록 구분선은 건드리지 않는다', () => {
    expect(normalizeSourceMarkup('the blank_word column')).toBe('the blank_word column')
    expect(normalizeSourceMarkup('-- item one')).toBe('-- item one')
  })
})

describe('플랫폼 껍데기와 절 번호는 막는다', () => {
  it('출판 플랫폼 껍데기를 잡는다 — 실측 13문항', () => {
    expect(hasArticleChrome('By Hannah Ritchie August 3, 2026 Browse past versions Cite this article')).toBe(true)
    expect(hasArticleChrome('Reuse our work freely under a licence.')).toBe(true)
  })

  it('지면에 없는 그림을 가리키면 잡는다 — 실측 11문항', () => {
    expect(hasArticleChrome('In the chart below you can see the trend for each country.')).toBe(true)
  })

  it('본문에 박힌 각주 번호를 잡는다 — 실측 74문항', () => {
    expect(hasArticleChrome('an important communication skill.1 Proficient use of silence helps.')).toBe(true)
  })

  // ⚠️ 처음 자(`[a-z]\.\d\s`)는 표본 6건 중 4건이 오탐이었다 — 뒤가 대문자일 때만 각주다.
  it('각주가 아닌 숫자는 안 잡는다 — 앞판이 여기서 물러섰다', () => {
    expect(hasArticleChrome('within one standard error of this minimum (lambda.1 se).')).toBe(false)
    expect(hasArticleChrome('Cells were grown on No.1 glass coverslips and fixed.')).toBe(false)
    expect(hasArticleChrome('The indicators for SDG 6 (6.a.1 and 6.b.1) provide an entry point.')).toBe(false)
  })

  it('학술서 절 번호를 잡는다 — 실측 61문항', () => {
    expect(hasArticleChrome('§ 16. The judgement of taste, by which an object is declared.')).toBe(true)
    expect(hasArticleChrome('described in § 3.2.1 results in a multivariate Gaussian')).toBe(true)
  })

  it('멀쩡한 지문은 통과한다', () => {
    expect(hasArticleChrome('The tide rose twice that night and the boats pulled hard.')).toBe(false)
  })
})
