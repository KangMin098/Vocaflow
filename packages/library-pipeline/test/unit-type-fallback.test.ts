// packages/library-pipeline/test/unit-type-fallback.test.ts
// chapter 류가 없는 책의 분절 폴백 — v06.35.
//
// 배경: Plato Dialogues 는 epub:type 에 `chapter` 가 **0개**다. 본문이 `division` ·
//   `z3998:drama` 로만 표시돼 unit 으로 인식되지 않았고, 그 결과 본문이 직전 챕터에
//   통째로 붙었다:
//       ch10 481,877단어 · ch22 161,624단어 (나머지 20개는 3.6~11.6천으로 정상)
//   정상 챕터들은 각 대화편의 Introduction 이었고, 대화 본문만 두 덩어리로 뭉쳤다.
//
// 수정: chapter 류가 하나도 없을 때만 division·z3998:drama 를 unit 으로 승격한다.
//   실측(실제 SE HTML): Plato 22 → 43챕터, 최대 481,877 → 133,322.
//
// ⚠️ 무조건 승격하면 안 되는 이유가 이 테스트의 핵심이다 — Proust 는 chapter 24개
//   **위에** `bodymatter division` 6개가 상위 컨테이너로 있어서, division 을 leaf 로
//   잡으면 24챕터가 6덩어리로 뭉친다. 실측으로 회귀 없음을 확인했다(24 유지).

import { describe, it, expect } from 'vitest'
import { htmlToPlainText } from '../src/ingest/standard-ebooks'

const wrap = (inner: string) => `<html><body>${inner}</body></html>`

/**
 * 분절 마커 개수 — segmenter 가 이 마커로 챕터를 나눈다.
 * 형식이 두 가지다: 제목이 있으면 `CHAPTER 1. Stave One`, 없으면 `CHAPTER 1`.
 */
function markerCount(text: string): number {
  return (text.match(/^CHAPTER \d+/gim) ?? []).length
}

describe('chapter 류가 없을 때의 unit 폴백', () => {
  it('chapter 가 0개면 division 을 unit 으로 승격한다 (Plato 구조)', () => {
    const out = htmlToPlainText(
      wrap(`
        <section epub:type="division" id="d1">
          <header><h2>Charmides</h2></header>
          <p>Socrates met Charmides at the palaestra that morning.</p>
        </section>
        <section epub:type="division" id="d2">
          <header><h2>Lysis</h2></header>
          <p>I was going from the Academy straight to the Lyceum.</p>
        </section>
      `),
    )
    expect(markerCount(out)).toBe(2)
    expect(out).toContain('palaestra')
    expect(out).toContain('Lyceum')
  })

  it('chapter 가 0개면 z3998:drama 도 unit 으로 승격한다', () => {
    const out = htmlToPlainText(
      wrap(`
        <section epub:type="z3998:drama z3998:fiction" id="r1">
          <header><h2>Book I</h2></header>
          <p>I went down yesterday to the Piraeus with Glaucon.</p>
        </section>
        <section epub:type="z3998:drama z3998:fiction" id="r2">
          <header><h2>Book II</h2></header>
          <p>With these words I was thinking that I had made an end.</p>
        </section>
      `),
    )
    expect(markerCount(out)).toBe(2)
  })

  it('chapter 가 있으면 division 은 unit 이 아니다 — 상위 컨테이너로 둔다 (Proust 구조)', () => {
    const out = htmlToPlainText(
      wrap(`
        <section epub:type="bodymatter division z3998:fiction" id="part-1">
          <header><h2>Swann's Way</h2></header>
          <section epub:type="chapter" id="c1">
            <header><h3>Overture</h3></header>
            <p>For a long time I used to go to bed early.</p>
          </section>
          <section epub:type="chapter" id="c2">
            <header><h3>Combray</h3></header>
            <p>At Combray, as every afternoon ended.</p>
          </section>
        </section>
      `),
    )
    // division 이 unit 이 되면 3개가 된다 — chapter 2개만 나와야 한다
    expect(markerCount(out)).toBe(2)
    expect(out).toContain('bed early')
    expect(out).toContain('Combray')
  })

  it('일반 소설(chapter 만 있음)은 동작이 바뀌지 않는다', () => {
    const out = htmlToPlainText(
      wrap(`
        <section epub:type="chapter" id="c1"><p>Marley was dead, to begin with.</p></section>
        <section epub:type="chapter" id="c2"><p>The Ghost of Christmas Past appeared.</p></section>
        <section epub:type="chapter" id="c3"><p>The second of the three Spirits.</p></section>
      `),
    )
    expect(markerCount(out)).toBe(3)
  })
})
