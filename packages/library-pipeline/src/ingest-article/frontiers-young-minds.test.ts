// packages/library-pipeline/src/ingest-article/frontiers-young-minds.test.ts
//
// **중3 칸을 메우는 유일한 후보.** 재고를 재면 그 칸만 4축 통과 13편이었다
// (초3~4 40 · 초5~6 86 · 초6~중1 185 · 중1~2 130 · **중3 13**).
// 2026-09-07 실측으로 한 가지가 더 붙었다 — 이 소스 혼자 **V≤4 재고의 7.2%** 를 댄다.
//
// 그래서 여기서 지키는 것은 여섯이다:
//   1. 초록에서 **JATS 태그가 지문에 새지 않는가**
//   2. 라이선스를 **글마다** 확인하는가 (학술지 단위로 뭉뚱그리지 않는가)
//   3. 모르는 피드 이름에 조용히 다른 것을 주지 않는가
//   4. `/full` 본문 컨테이너에서 **본문이 나오는가** — 그리고 못 찾으면 물러서지 않는가
//   5. 후미(Glossary·Conflict of Interest·References…)가 **잘리는가**, 그러면서
//      **본문 첫 문단은 살아남는가**(과절단 회귀 — 잘못 자르면 초록만 남는다)
//   6. 그림 참조가 **괄호만** 지워지는가 (문장을 통째로 지우면 본문이 날아간다)
//
// 망을 타지 않는다 — 순수 함수와 **가짜 fetch** 만 검사한다.

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  FRYM_FEEDS,
  frymAbstractText,
  frymCutBackMatter,
  frymDropAbstractBlock,
  frymFullTextContainer,
  frymFullTextContent,
  frymFullUrl,
  frymLicenseCode,
  frymLicenseUrl,
  frymPublishedAt,
  frymStripFigureRefs,
  ingestFrymArticle,
  listFrymFeed,
} from './frontiers-young-minds'
import { SOURCE_POLICIES, SOURCE_REGISTER_DEFAULT, SOURCE_SPECS, resolveArticleRegister } from './_curation-spec'

/** 실측 형태 — Crossref 는 초록을 JATS 조각으로 준다. */
const jats =
  '<jats:p>Have you ever followed a recipe to make your favorite cake? ' +
  'Sometimes it turns out perfect, and sometimes it does not.</jats:p>'

describe('FrYM 초록', () => {
  it('JATS 태그를 지문에 남기지 않는다', () => {
    const t = frymAbstractText(jats)
    expect(t).not.toMatch(/<|jats:/)
    expect(t).toContain('Have you ever followed a recipe')
  })

  it('엔티티를 사람이 읽는 글자로 되돌린다', () => {
    // 안 되돌리면 낱말 경계가 깨져 어수와 FK 가 함께 틀어진다.
    expect(frymAbstractText('<jats:p>Brain&#8217;s messenger</jats:p>')).toBe('Brain’s messenger')
  })

  it('없으면 빈 문자열이다 — null 을 흘리지 않는다', () => {
    expect(frymAbstractText(null)).toBe('')
    expect(frymAbstractText(undefined)).toBe('')
  })
})

describe('FrYM 라이선스 — 글마다 확인한다', () => {
  it('Crossref 의 license 배열에서 CC 주소만 고른다', () => {
    expect(
      frymLicenseUrl([
        { URL: 'https://www.frontiersin.org/terms' },
        { URL: 'https://creativecommons.org/licenses/by/4.0/' },
      ]),
    ).toBe('https://creativecommons.org/licenses/by/4.0/')
  })

  it('CC 주소가 없으면 null 이다 — 짐작해서 붙이지 않는다', () => {
    expect(frymLicenseUrl([{ URL: 'https://www.frontiersin.org/terms' }])).toBeNull()
    expect(frymLicenseUrl(undefined)).toBeNull()
  })

  it('주소를 우리 표기로 옮긴다 — 등급이 다르면 발행 가능 여부가 다르다', () => {
    expect(frymLicenseCode('https://creativecommons.org/licenses/by/4.0/')).toBe('CC-BY-4.0')
    expect(frymLicenseCode('https://creativecommons.org/licenses/by-nc/4.0/')).toBe('CC-BY-NC-4.0')
  })

  it('모르는 꼴이면 null 이다', () => {
    expect(frymLicenseCode('https://creativecommons.org/publicdomain/zero/1.0/')).toBeNull()
    expect(frymLicenseCode(null)).toBeNull()
  })
})

describe('FrYM 발행일', () => {
  it('Crossref 의 date-parts 를 읽는다', () => {
    expect(frymPublishedAt({ 'date-parts': [[2026, 9, 3]] })).toBe('2026-09-03T00:00:00.000Z')
  })

  it('연도만 있어도 받는다 — 있는 만큼 쓴다', () => {
    expect(frymPublishedAt({ 'date-parts': [[2019]] })).toBe('2019-01-01T00:00:00.000Z')
  })

  it('없으면 null 이다 — 지어내지 않는다', () => {
    expect(frymPublishedAt(undefined)).toBeNull()
    expect(frymPublishedAt({ 'date-parts': [[]] })).toBeNull()
  })
})

describe('FrYM 배선', () => {
  it('모르는 피드 이름에 조용히 다른 것을 주지 않는다', async () => {
    await expect(listFrymFeed('nope', 1)).rejects.toThrow(/nope/)
  })

  it('정렬 축이 둘이다 — 최신만 보면 같은 주제가 몰린다', () => {
    expect(FRYM_FEEDS.map((f) => f.id)).toEqual(['recent', 'cited'])
  })

  it('register 기본값이 expository 이고 처리 경로도 같은 답을 낸다', () => {
    expect(SOURCE_REGISTER_DEFAULT.frym).toBe('expository')
    expect(resolveArticleRegister('frym', null)).toBe('expository')
  })

  it('중등~고등 밴드를 겨냥한다 — 실측 FK 중앙 10.55(중3)', () => {
    expect(SOURCE_SPECS.frym.targetLevels).toContain('intermediate')
    expect(SOURCE_SPECS.frym.targetCefr).toEqual({ min: 'B1', max: 'B2' })
  })

  it('정책 표가 CC BY 로 분류한다 — 발행·변형이 막히면 안 된다', () => {
    expect(SOURCE_POLICIES.frym.licenseClass).toBe('cc_by')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 본문(`/full`) 추출 — 아래 픽스처는 **실제 페이지에서 그대로 떼어 온 조각**이다
// (10.3389/frym.2026.1699332 · 2026-09-07 GET). 클래스 이름·중첩·엔티티 표기를
// 바꾸지 않았다 — 손으로 다듬으면 실제로는 안 되는 것이 여기서만 된다.
// ────────────────────────────────────────────────────────────────────────────

/** 컨테이너 **앞뒤의 페이지 껍데기**. 여기 있는 글이 지문에 새면 안 된다. */
const CHROME_BEFORE =
  '<header><nav><a href="/">Frontiers for Young Minds</a></nav></header>' +
  '<h2 class="sr-only">Main navigation</h2><p>CHROME_SENTINEL_TOP</p>'
const CHROME_AFTER =
  '<h2 class="heading heading-large">Related Articles</h2><p>CHROME_SENTINEL_BOTTOM</p>' +
  '<h2 class="heading article-reviewers-heading">Young Reviewers</h2>'

/** 실제 초록 블록 — 본문 컨테이너 **안쪽**의 자식 div 다(균형 잡기 회귀의 근거). */
const ABSTRACT_BLOCK =
  '<div class="abstract" style="background:#f1f1f1; padding:7px 20px 7px 20px; margin:1em 0 10px 0">\n' +
  '<h4>Abstract</h4>\n' +
  '<p>Vampire bats are the only mammals that live on nothing but blood. ' +
  'ABSTRACT_SENTINEL. In this article, we will explain how they do it.</p>\n' +
  '</div>'

/** 실제 본문 첫 문단 — 용어 링크(`KC1a`)와 인용 표시(`[7]`)가 그대로 들어 있다. */
const FIRST_SECTION =
  '<h2 class="font-size-4 text-blue">Blood: A Difficult Meal to Live on</h2>\n' +
  '<p>Despite how they are portrayed in movies, vampire bats do not want to hurt you. ' +
  'But they <i>do</i> drink blood. In fact, it is their only food source. This unusual feeding ' +
  'strategy is called <span id="KC1a"><a href="#KC1" title="A way some animals survive by feeding on blood.">' +
  'hematophagy</a></span>, and they share blood with friends and family ' +
  '[<span id="ref7a"><a href="#ref7">7</a></span>]!</p>'

/** 실제 그림 블록 — 캡션이 `<figcaption>` 안에 있다(구조로 지워지는 근거). */
const FIGURE_BLOCK =
  '<figure id="figure-1">\n<div class="figure-container">\n' +
  '<img src="" class="img-responsive fit-img lazy" alt="Vampire bat runs on a treadmill.">\n</div>\n' +
  '<figcaption class="font-size-10">\n<ul>\n<li class="figure-title">Figure 1 - A vampire bat runs on ' +
  'a treadmill in a special chamber used by researchers at the University of Toronto ' +
  '(Figure credit: Price Sewell [<span id="ref5a"><a href="#ref5">5</a></span>]).</li>\n</ul>\n</figcaption>\n</figure>'

/** 괄호 참조 · 성분 참조 · `figure out` 동사가 한자리에 있는 절. */
const SECOND_SECTION =
  '<h2 class="font-size-4 text-blue">The Big Energy Question</h2>\n' +
  '<p>To answer this question, scientists developed a clever experiment involving tiny bat treadmills ' +
  '(<a href="#figure-1">Figure 1</a>). See <a href="#figure-1">Figure 1A</a> to find your nearest ' +
  'treadmill: X marks the spot! Researchers can figure out what the bats burn by watching them run.</p>'

/** 실제 후미 — Glossary(h3)가 Conflict of Interest(h2)보다 **앞**에 온다. */
const BACK_MATTER =
  '<h3 class="font-size-5 text-blue">Glossary</h3>\n' +
  '<p id="KC1"><strong>Hematophagy</strong>: <a href="#KC1a"><strong>&#x02191;</strong></a> ' +
  'GLOSSARY_SENTINEL A way some animals survive by feeding on the blood of other animals.</p>\n' +
  '<h2 class="font-size-4 text-blue">Conflict of Interest</h2>\n' +
  '<p>CONFLICT_SENTINEL The author(s) declared that this work was conducted in the absence of any ' +
  'commercial or financial relationships.</p>\n' +
  '<h2 class="font-size-4 text-blue">AI Tool Statement</h2>\n' +
  '<p>AITOOL_SENTINEL The author(s) declared that Generative AI was not used.</p>\n' +
  '<section id="full-text-references" class="font-size-11">\n<hr>\n' +
  '<h6 class="font-size-8 text-blue">Original Source Article</h6>\n' +
  '<p><strong>&#x02191;</strong>SOURCEART_SENTINEL Rossi, G. S., and Welch, K. C. 2024.</p>\n</section>\n' +
  '<section id="full-text-references" class="font-size-11">\n<hr>\n' +
  '<h6 class="font-size-8 text-blue">References</h6>\n' +
  '<p id="ref1">[1] <a href="#ref1a"><strong>&#x02191;</strong></a> REFERENCES_SENTINEL Riskin, D. K. 2005.</p>\n</section>'

const CONTAINER =
  '<div class="size size-small fulltext-content">\r\n            \n<!-- Full Text -->\n' +
  `${ABSTRACT_BLOCK}\n${FIRST_SECTION}\n${FIGURE_BLOCK}\n${SECOND_SECTION}\n${BACK_MATTER}\n</div>`

const PAGE = `<html><body>${CHROME_BEFORE}${CONTAINER}${CHROME_AFTER}</body></html>`

describe('FrYM 본문 — 컨테이너를 잡는다', () => {
  it('`fulltext-content` 안쪽만 떼어 낸다 — 페이지 껍데기가 지문에 새지 않는다', () => {
    const c = frymFullTextContainer(PAGE)
    expect(c).toBeTruthy()
    expect(c).toContain('fulltext-content')
    expect(c).not.toContain('CHROME_SENTINEL_TOP')
    expect(c).not.toContain('CHROME_SENTINEL_BOTTOM')
  })

  it('**자식 div 의 닫는 태그에서 끊지 않는다** — 초록만 남으면 본문이 통째로 사라진다', () => {
    // 초록(`<div class="abstract">`)이 컨테이너의 자식이다. 첫 `</div>` 로 자르면
    // 여기서부터 뒤가 전부 없어지고, 산출물이 지금 고치려는 그 「초록 한 덩어리」가 된다.
    const c = frymFullTextContainer(PAGE)!
    expect(c).toContain('Blood: A Difficult Meal to Live on')
    expect(c).toContain('The Big Energy Question')
  })

  it('컨테이너가 없으면 null 이고 본문은 빈 문자열이다 — 페이지 전체로 물러서지 않는다', () => {
    const noContainer = `<html><body>${CHROME_BEFORE}${CHROME_AFTER}</body></html>`
    expect(frymFullTextContainer(noContainer)).toBeNull()
    expect(frymFullTextContent(noContainer)).toBe('')
  })
})

describe('FrYM 본문 — 후미를 자른다', () => {
  const text = frymFullTextContent(PAGE)

  it('Glossary·Conflict of Interest·AI Tool Statement·Original Source Article·References 가 전부 빠진다', () => {
    for (const sentinel of [
      'GLOSSARY_SENTINEL',
      'CONFLICT_SENTINEL',
      'AITOOL_SENTINEL',
      'SOURCEART_SENTINEL',
      'REFERENCES_SENTINEL',
    ]) {
      expect(text).not.toContain(sentinel)
    }
    expect(text).not.toMatch(/Glossary|Conflict of Interest|References/)
  })

  it('**첫 번째로 만나는 후미**에서 끊는다 — 순서가 글마다 다르다', () => {
    // 이 픽스처는 Glossary(h3)가 Conflict of Interest(h2)보다 앞이다. 뒤에서 찾아 지우면
    // 사이에 낀 것이 남는다. 잘린 자리 = 본문 마지막 문장 바로 뒤여야 한다.
    const cut = frymCutBackMatter(frymFullTextContainer(PAGE)!)
    expect(cut).toContain('X marks the spot')
    expect(cut).not.toContain('Glossary')
  })

  it('자를 것이 없으면 그대로 둔다 — 조용히 비우지 않는다', () => {
    const onlyBody = '<div class="fulltext-content"><p>KEEP_ME</p></div>'
    expect(frymCutBackMatter(onlyBody)).toContain('KEEP_ME')
  })
})

describe('FrYM 본문 — 과절단 회귀 (첫 문단이 살아남는가)', () => {
  const text = frymFullTextContent(PAGE)

  it('본문 첫 문단이 문장째 남는다', () => {
    expect(text).toContain('Despite how they are portrayed in movies, vampire bats do not want to hurt you.')
    expect(text).toContain('This unusual feeding strategy is called hematophagy')
  })

  it('소제목이 남는다 — 없으면 발췌기가 문단 경계를 못 본다', () => {
    expect(text).toContain('Blood: A Difficult Meal to Live on')
    expect(text).toContain('The Big Energy Question')
  })

  it('본문이 두 절 다 들어 있다 — 한 절만 나오면 자르는 자리가 앞당겨진 것이다', () => {
    expect(text).toContain('To answer this question, scientists developed a clever experiment')
  })
})

describe('FrYM 본문 — 초록은 지문이 아니다', () => {
  const text = frymFullTextContent(PAGE)

  it('맨 앞 초록 블록이 `content` 에 들어가지 않는다', () => {
    // 남기면 ① 본문과 겹쳐 어수가 부풀고 ② 첫 발췌창이 "In this article, we will…" 로
    //   끝나 다시 `fragmentary` 가 된다 — 34편이 그렇게 반려됐다.
    expect(text).not.toContain('ABSTRACT_SENTINEL')
    expect(text).not.toContain('In this article, we will explain')
    expect(text).not.toMatch(/^Abstract/m)
  })

  it('초록이 없는 판형이면 본문을 그대로 둔다 — 없다고 비우지 않는다', () => {
    const noAbstract = '<div class="fulltext-content"><h2>H</h2><p>BODY_ONLY</p></div>'
    expect(frymDropAbstractBlock(noAbstract)).toContain('BODY_ONLY')
  })
})

describe('FrYM 본문 — 그림 참조', () => {
  const text = frymFullTextContent(PAGE)

  it('캡션은 구조로 사라진다 — `<figcaption>` 안이라 문장 판정이 필요 없다', () => {
    expect(text).not.toContain('A vampire bat runs on a treadmill in a special chamber')
    expect(text).not.toContain('Figure credit')
  })

  it('**괄호 참조만 지우고 문장은 남긴다** — 그림 없이도 성립하는 쪽이다', () => {
    expect(text).toContain('scientists developed a clever experiment involving tiny bat treadmills.')
    expect(text).not.toMatch(/\(\s*Figure/)
  })

  it('**그림이 문장의 성분이면 그 문장만 버린다** — 빼면 남는 것이 없는 쪽이다', () => {
    expect(text).not.toContain('X marks the spot')
  })

  it('`figure out` 같은 동사는 건드리지 않는다 — 이름(숫자)이 붙은 것만 참조다', () => {
    expect(text).toContain('Researchers can figure out what the bats burn by watching them run.')
  })

  it('지문에 `Figure 1` 이 한 글자도 남지 않는다 — 남으면 학습자가 없는 그림을 찾는다', () => {
    expect(text).not.toMatch(/\bFigures?\s*\d/i)
  })

  it('여러 그림을 한 괄호에 묶은 꼴도 지운다', () => {
    expect(frymStripFigureRefs('The kelp grows fast (Figures 1, 2).')).toBe('The kelp grows fast.')
    expect(frymStripFigureRefs('The nerve exits here (Figure 1A).')).toBe('The nerve exits here.')
    expect(frymStripFigureRefs('Look at the slices (see Figure 3).')).toBe('Look at the slices.')
  })

  it('다른 글로 보내는 괄호도 지운다 — 학습자가 따라갈 수 없는 링크다', () => {
    expect(frymStripFigureRefs('Humans have five senses (See this young minds article).')).toBe(
      'Humans have five senses.',
    )
    // 좁게 잡는다 — 안내문이 아닌 괄호는 그대로 둔다.
    expect(frymStripFigureRefs('The cortex (the outer layer) is folded.')).toBe(
      'The cortex (the outer layer) is folded.',
    )
  })
})

describe('FrYM 본문 — 인용 표시', () => {
  it('`[7]` 같은 인용 표시를 지운다 — 참조 목록이 없으니 가리킬 곳이 없다', () => {
    const text = frymFullTextContent(PAGE)
    expect(text).not.toMatch(/\[\s*\d+\s*\]/)
    // 앞의 공백까지 먹지 않으면 "family !" 로 남는다 — FrYM 은 구두점 바로 앞에 표시를 둔다.
    expect(text).toContain('they share blood with friends and family!')
  })

  it('**번호 사이에 태그가 낀 `[1, 3]` 도 지운다** — 좁은 규칙이 이것만 남겨 두었다', () => {
    // 실측 markup: `[<a href="#ref1">1</a>, <span id="ref3a"><a href="#ref3">3</a></span>]`
    const multi =
      '<div class="fulltext-content"><p>The thalamus sends signals to the cortex ' +
      '[<a href="#ref1">1</a>, <span id="ref3a"><a href="#ref3">3</a></span>]. ' +
      'This is not a straightforward task.</p></div>'
    const t = frymFullTextContent(multi)
    expect(t).toBe('The thalamus sends signals to the cortex. This is not a straightforward task.')
  })

  it('숫자가 없는 대괄호는 건드리지 않는다 — 인용 표시만 지운다', () => {
    const bracket = '<div class="fulltext-content"><p>The sign said [closed] all week.</p></div>'
    expect(frymFullTextContent(bracket)).toBe('The sign said [closed] all week.')
  })
})

describe('FrYM 본문 주소', () => {
  it('`/full` 이다 — `/xml/nlm`·`/pdf` 는 404 이고 www 쪽 주소도 404 다', () => {
    expect(frymFullUrl('10.3389/frym.2026.1699332')).toBe(
      'https://kids.frontiersin.org/articles/10.3389/frym.2026.1699332/full',
    )
  })

  it('DOI 의 슬래시를 인코딩하지 않는다 — 인코딩하면 404 다', () => {
    expect(frymFullUrl('10.3389/frym.2026.1699332')).not.toContain('%2F')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 적재 한 편 — 메타는 Crossref, 본문은 `/full`. 가짜 fetch 로 둘의 **경계**를 검사한다.
// ────────────────────────────────────────────────────────────────────────────

const CROSSREF_WORK = {
  message: {
    DOI: '10.3389/frym.2026.1699332',
    title: ['Vampire Bats: Sucking the Most Out of Blood'],
    URL: 'https://doi.org/10.3389/frym.2026.1699332',
    abstract: '<jats:p>Vampire bats are the only mammals that live on nothing but blood.</jats:p>',
    license: [
      { URL: 'https://www.frontiersin.org/terms' },
      { URL: 'https://creativecommons.org/licenses/by/4.0/' },
    ],
    published: { 'date-parts': [[2026, 9, 3]] },
  },
}

/** 400어 문턱을 넘기려는 채움 산문. 본문 절 안에 넣는다. */
function filler(times: number): string {
  return `<p>${'The bats were weighed and watched by trained researchers every single day. '.repeat(times)}</p>`
}

const LONG_PAGE = PAGE.replace(SECOND_SECTION, SECOND_SECTION + filler(40))

function mockFetch(pages: Record<string, { status: number; body: string }>) {
  return vi.fn(async (url: string) => {
    const hit = Object.entries(pages).find(([k]) => String(url).includes(k))
    if (!hit) throw new Error(`가짜 fetch 에 없는 주소: ${url}`)
    const [, v] = hit
    return {
      ok: v.status >= 200 && v.status < 300,
      status: v.status,
      json: async () => JSON.parse(v.body),
      text: async () => v.body,
      headers: new Headers(),
    } as unknown as Response
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('FrYM 적재 — 메타는 Crossref · 본문은 /full', () => {
  it('제목·DOI·발행일·라이선스가 Crossref 그대로 오고 본문만 페이지에서 온다', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        'api.crossref.org': { status: 200, body: JSON.stringify(CROSSREF_WORK) },
        'kids.frontiersin.org': { status: 200, body: LONG_PAGE },
      }),
    )
    const a = await ingestFrymArticle('https://doi.org/10.3389/frym.2026.1699332')
    expect(a.source).toBe('frym')
    expect(a.source_id).toBe('frym:10.3389/frym.2026.1699332')
    expect(a.title).toBe('Vampire Bats: Sucking the Most Out of Blood')
    expect(a.license).toBe('CC-BY-4.0')
    expect(a.published_at?.toISOString()).toBe('2026-09-03T00:00:00.000Z')
    expect(a.author).toBe('Frontiers for Young Minds')
    expect(a.language).toBe('en')
    // 사람이 읽는 주소 = 리다이렉트 종착. doi.org 로 한 번 더 튕기지 않는다.
    expect(a.source_url).toBe(
      'https://kids.frontiersin.org/articles/10.3389/frym.2026.1699332/full',
    )
    // 본문이지 초록이 아니다.
    expect(a.content).toContain('Despite how they are portrayed in movies')
    expect(a.content).not.toContain('ABSTRACT_SENTINEL')
  })

  it('본문을 못 받으면 **초록으로 물러서지 않고 던진다** — 물러서면 구멍이 조용히 메워진다', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        'api.crossref.org': { status: 200, body: JSON.stringify(CROSSREF_WORK) },
        'kids.frontiersin.org': { status: 404, body: '' },
      }),
    )
    await expect(ingestFrymArticle('https://doi.org/10.3389/frym.2026.1699332')).rejects.toThrow(
      /본문 GET 실패: 404/,
    )
  })

  it('본문이 짧으면 던진다 — **짧은 값을 넣으면 다음 수확이 「완료」로 센다**', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        'api.crossref.org': { status: 200, body: JSON.stringify(CROSSREF_WORK) },
        // 채움 없는 픽스처는 본문이 60어대다 — 문턱(400) 아래.
        'kids.frontiersin.org': { status: 200, body: PAGE },
      }),
    )
    await expect(ingestFrymArticle('https://doi.org/10.3389/frym.2026.1699332')).rejects.toThrow(
      /본문이 너무 짧다/,
    )
  })

  it('라이선스를 못 읽으면 **본문을 받으러 가지도 않는다**', async () => {
    const f = mockFetch({
      'api.crossref.org': {
        status: 200,
        body: JSON.stringify({
          message: { ...CROSSREF_WORK.message, license: [{ URL: 'https://www.frontiersin.org/terms' }] },
        }),
      },
      'kids.frontiersin.org': { status: 200, body: LONG_PAGE },
    })
    vi.stubGlobal('fetch', f)
    await expect(ingestFrymArticle('https://doi.org/10.3389/frym.2026.1699332')).rejects.toThrow(
      /라이선스를 글에서 확인하지 못했다/,
    )
    expect(f.mock.calls.every(([u]) => !String(u).includes('kids.frontiersin.org'))).toBe(true)
  })

  it('DOI 를 못 읽는 주소는 망을 타지 않는다', async () => {
    const f = mockFetch({ x: { status: 200, body: '{}' } })
    vi.stubGlobal('fetch', f)
    await expect(ingestFrymArticle('https://example.com/nope')).rejects.toThrow(/DOI 를 못 읽었다/)
    expect(f).not.toHaveBeenCalled()
  })
})
