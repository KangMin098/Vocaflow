// packages/library-pipeline/src/ingest-article/plos-abstract-duplication.test.ts
//
// **초록이 두 번 들어가던 것 — 원인은 마크업의 부모/자식 관계였다.**
//
// ── 왜 이 테스트가 있는가 (실측 2026-09-06) ─────────────────────────
// `extractProse` 는 `abstract-content` 와 `article-text` 를 각각 잘라 앞뒤로 이어 붙였다.
// 그런데 PLOS 에서 `abstract-content` 는 `article-text` 의 **자식**이다.
// 원본 HTML 실측 (`10.1371/journal.pone.0348669`):
//
//   <div class="article-text" id="artText">          ← 오프셋 100,807
//     <div class="abstract …"><h2>Abstract</h2>
//       <div class="abstract-content">               ← 101,053  (article-text 안쪽)
//
// 즉 초록 조각은 본문 조각에 **이미 들어 있는데** 앞에 한 번 더 붙었다. 산출물은
// `[초록] / "Abstract" / [같은 초록] / Introduction …` 이 됐고, 구조화 초록이면
// Background·Methods·Results·Conclusion 블록이 통째로 반복됐다.
//
// 피해: 400편 중 **393편(98.3%)** 중복 · 96.7% 는 바이트 동일 ·
//   `word_count` 평균 **6.2% 과대**(중앙 5.7% · 최대 25.9%). 학령 판정과 지문 규격 판정이
//   그만큼 틀린 분모 위에서 돌았다. 같은 원본으로 실측한 고침 전후: 4,228 → 3,860 단어(-9.5%).
//
// ⚠️ 이 결함은 **눈에 안 띄는 종류**다 — 산출물은 문법적으로 멀쩡하고 길이만 늘어난다.
//   그리고 고치는 쪽으로 과하게 가면(초록을 항상 버리면) **본문 div 없이 초록만 있는 편**이
//   통째로 빈 지문이 된다(실측 20편 중 1편이 그랬고 그 편은 원래 정상 산출이었다).
//   그래서 네 갈래를 전부 못 박는다.

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ingestPlosArticle } from './plos'

const URL_ = 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0348669'

const HEAD =
  '<meta name="citation_title" content="Vital signs and the Hospital Frailty Risk Score" />' +
  '<meta name="citation_publication_date" content="2026/02/11" />' +
  '<meta name="citation_author" content="Kutrani H" />'

/** 200단어 게이트를 넘기려는 채움 산문. 초록/본문 어느 쪽에서도 재사용한다. */
function filler(times: number, marker: string): string {
  const s = `The cohort ${marker} was followed for twelve months and the outcome was recorded by trained staff. `
  return s.repeat(times)
}

/** A형 — 초록이 한 덩어리. `abstract-content` 가 `article-text` **안쪽**에 있다(실제 구조). */
const ABSTRACT_A = `<div class="abstract-content"><p>${'ABSTRACT_SENTINEL. '}${filler(
  14,
  'in the abstract',
)}</p></div>`

/**
 * B형 — 구조화 초록. `abstract-content` 안에 Background/Methods/Results/Conclusion 네 블록이
 * 각각 `section toc-section` div 로 들어간다(실제 PLOS 구조 — 중첩 div 다).
 */
const ABSTRACT_B = `<div class="abstract-content">${['Background', 'Methods', 'Results', 'Conclusion']
  .map(
    (h, i) =>
      // ⚠️ 채움 문장에 소제목 낱말을 넣지 않는다 — 아래 소제목 개수 검사가 무의미해진다.
      `<div id="section${i + 1}" class="section toc-section"><h3>${h}</h3><p>${h.toUpperCase()}_SENTINEL. ${filler(
        4,
        `part ${i + 1}`,
      )}</p></div>`,
  )
  .join('')}</div>`

/** 본문 절 — 초록과 겹치지 않는 문장. */
const SECTIONS = `<div id="section5" class="section toc-section"><h2>Introduction</h2><p>BODY_SENTINEL. ${filler(
  16,
  'in the body',
)}</p></div>`

/** 실제 배치 — 초록 div 가 article-text 의 자식으로 들어간다. */
function nestedPage(abstract: string): string {
  return `${HEAD}<div class="article-text" id="artText"><div class="abstract abstract-type-toc"><h2>Abstract</h2>${abstract}</div>${SECTIONS}</div>`
}

function stubPage(html: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, text: async () => html })),
  )
}

/** 문자열 s 안에서 needle 이 몇 번 나오는가. */
function count(s: string, needle: string): number {
  return s.split(needle).length - 1
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PLOS 초록 중복 (abstract-content 는 article-text 의 자식)', () => {
  it('A형 — 한 덩어리 초록이 본문 앞에 한 번만 들어간다', async () => {
    stubPage(nestedPage(ABSTRACT_A))
    const article = await ingestPlosArticle(URL_)

    // 고치기 전에는 2 였다.
    expect(count(article.content, 'ABSTRACT_SENTINEL')).toBe(1)
    expect(count(article.content, 'BODY_SENTINEL')).toBe(1)
    // 초록이 본문보다 앞이다 — 버린 게 아니라 안 겹치게 뒀을 뿐이다.
    expect(article.content.indexOf('ABSTRACT_SENTINEL')).toBeLessThan(
      article.content.indexOf('BODY_SENTINEL'),
    )
  })

  it('B형 — 구조화 초록 네 블록이 통째로 반복되지 않는다', async () => {
    stubPage(nestedPage(ABSTRACT_B))
    const article = await ingestPlosArticle(URL_)

    for (const sentinel of [
      'BACKGROUND_SENTINEL',
      'METHODS_SENTINEL',
      'RESULTS_SENTINEL',
      'CONCLUSION_SENTINEL',
    ]) {
      // 고치기 전에는 네 개 전부 2 였다(블록 전체가 반복).
      expect(count(article.content, sentinel)).toBe(1)
    }
    // 소제목도 한 번씩만 — 중복이면 목차처럼 두 번 찍힌다.
    expect(count(article.content, 'Background')).toBe(1)
  })

  it('본문 div 가 없고 초록만 있는 편 — 초록이 살아남는다 (회귀)', async () => {
    // `article-text` 가 아예 없는 배치. 실측 20편 중 1편이 이랬고 정상 산출이었다.
    stubPage(`${HEAD}<div class="abstract"><h2>Abstract</h2><div class="abstract-content"><p>ABSTRACT_SENTINEL. ${filler(
      36,
      'in the abstract',
    )}</p></div></div>`)
    const article = await ingestPlosArticle(URL_)

    expect(count(article.content, 'ABSTRACT_SENTINEL')).toBe(1)
    // 200단어 게이트를 넘겼다는 뜻 — 빈 지문으로 버려지지 않았다.
    expect(article.content.trim().split(/\s+/).length).toBeGreaterThan(200)
  })

  it('초록이 본문 밖에 있는 배치 — 그때는 앞에 붙인다 (원래 의도 보존)', async () => {
    // 마크업이 바뀌어 abstract-content 가 article-text 의 형제가 되는 경우.
    stubPage(
      `${HEAD}<div class="abstract"><h2>Abstract</h2><div class="abstract-content"><p>ABSTRACT_SENTINEL. ${filler(
        10,
        'in the abstract',
      )}</p></div></div><div class="article-text" id="artText">${SECTIONS}</div>`,
    )
    const article = await ingestPlosArticle(URL_)

    expect(count(article.content, 'ABSTRACT_SENTINEL')).toBe(1)
    expect(count(article.content, 'BODY_SENTINEL')).toBe(1)
    expect(article.content.indexOf('ABSTRACT_SENTINEL')).toBeLessThan(
      article.content.indexOf('BODY_SENTINEL'),
    )
  })
})
