// packages/library-pipeline/src/textbook/excerpt-chunks.test.ts
//
// ⚠️ 아래 `SEAM` 일곱 문단은 **Gutenberg #26177 원문을 받아 같은 정제를 걸고 그대로 꺼낸 것**이다
//   (2026-09-15, `cleanBookText` → 공백 정규화). 지어낸 문장으로 이 규칙을 시험하면
//   규칙이 아니라 내가 지은 문장을 시험하게 된다.
//
//   이 일곱 문단이 **실제로 지면에 나간 결함**의 자리다 —
//   `library_articles` `5fcd1d90-…` 가 [1356]~[1360] 을 한 지문으로 담았고,
//   그 위에 만든 어휘 문항 `csat_dcp_items` `16a106d7-…` 의 밑줄 다섯이
//   두 이야기에 갈려 있었다.

import { describe, expect, it } from 'vitest'

import { disjointChunks, looksLikeHeading, type ParagraphUnit } from './excerpt-chunks'

/** `readability.PASSAGE_WORDS` 와 같은 값 — 출판사 선언 어수 실측(n=59). */
const BOUNDS = { min: 100, max: 200 }

const u = (text: string, wasDropped = false): ParagraphUnit => ({ text, wasDropped })

/** #26177 의 [1356]~[1362]. 두 이야기가 맞닿은 자리. */
const SEAM: ParagraphUnit[] = [
  u(
    'Ivan, seeing the irreparable loss of the egg, burst into tears, when suddenly the pike came swimming ashore, holding the egg between its teeth. He took the egg, broke it, drew out the needle and broke off its little point. Then he attacked Koshchei, who struggled hard, but wriggle about as he might he had to die at last.',
  ),
  u(
    'Then Ivan went into the house of Koshchei, took Vasilisa, and returned home. After that they lived together for a long, long time, and were very, very happy.',
  ),
  u('Oeyvind and Marit'), // ← 작품 제목. 정제가 밑줄만 벗기고 **남겼다**.
  u('BJOeRNE BJOeRNESON'), // ← 지은이. `Oe` 의 소문자 e 때문에 「전부 대문자」가 아니다.
  u(
    'Oeyvind was his name. A low, barren cliff overhung the house in which he was born; fir and birch looked down on the roof, and wild cherry strewed flowers over it. Upon this roof there walked about a little goat, which belonged to Oeyvind. He was kept there that he might not go astray; and Oeyvind carried leaves and grass up to him. One fine day the goat leaped down, and away to the cliff; he went straight up, and came where he never had been before.',
  ),
  u("[Footnote 20: From A Happy Boy in J. G. Whittier's _Child Life in Prose_.]"),
  u(
    'Oeyvind did not see him when he came out after dinner, and thought immediately of the fox. He grew hot all over, looked round about, and called, "Killy-killy-killy-goat!"',
  ),
]

const crosses = (text: string) => text.includes('Koshchei') && text.includes('Oeyvind')

describe('disjointChunks — 이야기 경계', () => {
  it('두 이야기를 한 조각에 담지 않는다', () => {
    const out = disjointChunks(SEAM, BOUNDS)
    expect(out.some((c) => crosses(c.text))).toBe(false)
  })

  it('경계 표시를 빼면 실제로 넘어간다 — 시험이 헛돌지 않는다는 증거', () => {
    // 고치기 전 코드가 **보던 것**이 이것이다. 제목·지은이 줄이 아무 자국도 안 남기고
    // 사라진 상태. 그러면 59어 + 28어 = 87어가 어수창(100어)에 못 미쳐 다음 문단까지
    // 삼키고, 87 + 87 = 174어로 창 안에 들어와 **한 조각이 된다.**
    const blind = SEAM.filter((x) => x.text !== 'Oeyvind and Marit' && x.text !== 'BJOeRNE BJOeRNESON')
    const out = disjointChunks(blind, BOUNDS)
    expect(out.some((c) => crosses(c.text))).toBe(true)
  })

  it('정제가 지운 줄도 경계다 — 표시가 남든 지워지든 막는다', () => {
    const dropped = SEAM.map((x) =>
      x.text === 'Oeyvind and Marit' || x.text === 'BJOeRNE BJOeRNESON' ? u('', true) : x,
    )
    expect(disjointChunks(dropped, BOUNDS).some((c) => crosses(c.text))).toBe(false)
  })
})

describe('disjointChunks — 원래 지키던 것', () => {
  const body = (n: number, word: string) => u(Array.from({ length: n }, () => word).join(' ') + '.')

  it('조각끼리 문단을 나눠 갖지 않는다', () => {
    const units = [body(120, 'alpha'), body(120, 'beta'), body(120, 'gamma')]
    const out = disjointChunks(units, BOUNDS)
    expect(out).toHaveLength(3)
    expect(out.map((c) => c.text.split(' ')[0])).toEqual(['alpha', 'beta', 'gamma'])
  })

  it('어수창을 지킨다', () => {
    const out = disjointChunks([body(60, 'alpha'), body(60, 'beta')], BOUNDS)
    expect(out).toHaveLength(1)
    const w = out[0]!.text.match(/[A-Za-z][A-Za-z'-]*/g)!.length
    expect(w).toBeGreaterThanOrEqual(BOUNDS.min)
    expect(w).toBeLessThanOrEqual(BOUNDS.max)
  })

  it('창을 넘기면 버린다 — 늘려 담지 않는다', () => {
    expect(disjointChunks([body(260, 'alpha')], BOUNDS)).toHaveLength(0)
  })

  it('장 머리 뒤에서 시작한 조각만 opensChapter 다', () => {
    const out = disjointChunks([u('CHAPTER IV'), body(120, 'alpha'), body(120, 'beta')], BOUNDS)
    expect(out.map((c) => c.opensChapter)).toEqual([true, false])
  })

  it('짧은 대사 줄은 끊기는 하되 opensChapter 로 세지 않는다', () => {
    // ⚠️ 이 둘을 한 깃발에 적었다가 실측에서 들켰다 — 「장머리 조각」이 80 → 814 로
    //   뛰었다. 조각이 좋아진 것이 아니라 **깃발의 뜻이 바뀐 것**이었다.
    const out = disjointChunks([body(120, 'alpha'), u('"Killy-killy-killy-goat!"'), body(120, 'beta')], BOUNDS)
    expect(out).toHaveLength(2)
    expect(out.map((c) => c.opensChapter)).toEqual([false, false])
  })

  it('짧은 줄이 실제로 끊는다 — 없으면 한 조각이 된다', () => {
    const withLine = disjointChunks([body(60, 'alpha'), u('"Hush!"'), body(60, 'beta')], BOUNDS)
    const without = disjointChunks([body(60, 'alpha'), body(60, 'beta')], BOUNDS)
    expect(withLine).toHaveLength(0)
    expect(without).toHaveLength(1)
  })
})

describe('looksLikeHeading', () => {
  it.each([
    ['CHAPTER IV', true],
    ['BOOK THE SECOND', true],
    ['IV.', true],
    ['THE LOST KEY', true],
    ['Oeyvind and Marit', false], // ← 못 잡는다. 그래서 「본문 아닌 줄」 쪽이 본줄기다.
    ['BJOeRNE BJOeRNESON', false], // ← `Oe` 의 소문자 e 때문에 전부 대문자가 아니다.
    ['He grew hot all over, looked round about, and called.', false],
    ['', false],
  ])('%s → %s', (line, expected) => {
    expect(looksLikeHeading(line)).toBe(expected)
  })

  it('70자를 넘으면 표제로 보지 않는다', () => {
    expect(looksLikeHeading('A'.repeat(71))).toBe(false)
  })
})
