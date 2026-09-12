// packages/library-pipeline/test/matter-strip-guard.test.ts
// front/back-matter 제거가 본문을 삼키지 않는다 — v06.35.
//
// 배경: Personal Recollections of Joan of Arc 는 73개 chapter 가 세 개의
//   <section epub:type="frontmatter part z3998:fiction"> 안에 중첩돼 있다.
//   (SE 가 이 책의 Book 1/2/3 을 그렇게 태깅했다 — 보통은 part 나 bodymatter 다.)
//   frontmatter 제거가 본문 전체를 삼켜 raw_content 가 0바이트가 됐고, 실패는 한참 뒤
//   DB 에서 `store_content_chunk: empty content` 로 터져 원인이 안 보였다.
//
// 불변식: matter 판정이 틀려도 본문(chapter/story/poem/fable)을 품은 블록은 지우지 않는다.
//   진짜 boilerplate(endnotes·colophon·copyright)는 본문 단위를 품지 않으므로
//   기존 제거 동작(Gibbon 473k 미주 차단)에 영향이 없다.

import { describe, it, expect } from 'vitest'
import { htmlToPlainText } from '../src/ingest/standard-ebooks'

const wrap = (inner: string) => `<html><body>${inner}</body></html>`

describe('stripMatterSections 안전망', () => {
  it('frontmatter 로 태깅됐어도 chapter 를 품었으면 본문이 살아남는다 (Joan of Arc 구조)', () => {
    const out = htmlToPlainText(
      wrap(`
        <section epub:type="frontmatter part z3998:fiction" id="book-1">
          <header><h2>Book I</h2></header>
          <section epub:type="chapter" id="book-1-chapter-1">
            <hgroup><h3>I</h3></hgroup>
            <p>When I was a child I was playing near the fairy tree.</p>
          </section>
          <section epub:type="chapter" id="book-1-chapter-2">
            <hgroup><h3>II</h3></hgroup>
            <p>The village of Domremy stood on the border of Lorraine.</p>
          </section>
        </section>
      `),
    )
    expect(out).toContain('fairy tree')
    expect(out).toContain('Domremy')
    expect(out.length).toBeGreaterThan(50)
  })

  it('본문 단위를 품지 않은 backmatter 는 그대로 제거된다 (Gibbon 미주 차단 유지)', () => {
    const out = htmlToPlainText(
      wrap(`
        <section epub:type="chapter" id="chapter-1">
          <p>The empire of Rome comprehended the fairest part of the earth.</p>
        </section>
        <section epub:type="backmatter endnotes" id="endnotes">
          <ol><li><p>See Strabo, book two, page forty.</p></li></ol>
        </section>
        <section epub:type="backmatter colophon" id="colophon">
          <p>This ebook was produced by volunteers.</p>
        </section>
      `),
    )
    expect(out).toContain('fairest part of the earth')
    expect(out).not.toContain('Strabo')
    expect(out).not.toContain('produced by volunteers')
  })

  it('단편/시 모음도 본문 단위로 인정한다 (chapter 만이 본문은 아니다)', () => {
    const out = htmlToPlainText(
      wrap(`
        <section epub:type="frontmatter" id="collection">
          <section epub:type="se:short-story" id="story-1">
            <p>How the Whale Got His Throat, a tale for children.</p>
          </section>
        </section>
        <section epub:type="frontmatter" id="poems">
          <section epub:type="z3998:poem" id="poem-1">
            <p>Because I could not stop for Death.</p>
          </section>
        </section>
      `),
    )
    expect(out).toContain('Whale Got His Throat')
    expect(out).toContain('could not stop for Death')
  })

  it('titlepage·imprint 같은 순수 frontmatter 는 계속 제거된다', () => {
    const out = htmlToPlainText(
      wrap(`
        <section epub:type="frontmatter titlepage" id="titlepage">
          <h1>The Title Page Heading</h1>
        </section>
        <section epub:type="frontmatter imprint" id="imprint">
          <p>This ebook is for the use of anyone anywhere.</p>
        </section>
        <section epub:type="chapter" id="chapter-1">
          <p>Marley was dead, to begin with.</p>
        </section>
      `),
    )
    expect(out).toContain('Marley was dead')
    expect(out).not.toContain('Title Page Heading')
    expect(out).not.toContain('for the use of anyone')
  })
})
