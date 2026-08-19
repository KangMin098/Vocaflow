// packages/library-pipeline/src/compose/extract.test.ts
// ACP §20 — 기사 본문 추출 회귀.
//
// 지키는 것: **네비·광고를 사실로 읽지 않는다.** 뉴스 페이지는 본문보다 주변 요소가 길어서
// 통째로 태그를 벗기면 메뉴 문구가 사실 카드로 올라간다.

import { describe, expect, it } from 'vitest'

import { MIN_ARTICLE_WORDS, extractArticle, fromJsonLd, splitSentences, trimBoilerplate } from './extract'

const BODY =
  'A magnitude 5.2 earthquake struck the central coast on Tuesday morning. County officials said three people were treated for minor injuries at a regional hospital. The shaking lasted about twenty seconds and was felt as far north as San Jose. State geologists reported no damage to major bridges or highways. Schools in two districts closed for the day while inspectors checked buildings.'

const NOISE = `
<nav><a href="/">Home</a><a href="/sport">Sport</a>Subscribe now for unlimited access</nav>
<aside>Most read: Ten things you missed this week</aside>
<footer>Copyright 2026. All rights reserved. Terms of use. Privacy policy.</footer>
<script>window.ads=1;var tracking="pageview";</script>
<style>.ad{display:block}</style>
`

function page(inner: string, head = ''): string {
  return `<!doctype html><html><head><title>Site title</title>${head}</head><body>${NOISE}${inner}${NOISE}</body></html>`
}

describe('fromJsonLd', () => {
  it('NewsArticle 의 articleBody·headline·datePublished 를 꺼낸다', () => {
    const html = page(
      '<div>x</div>',
      `<script type="application/ld+json">${JSON.stringify({
        '@type': 'NewsArticle',
        headline: 'Quake hits the coast',
        datePublished: '2026-08-14T09:00:00Z',
        articleBody: BODY,
      })}</script>`,
    )
    const r = fromJsonLd(html)
    expect(r.title).toBe('Quake hits the coast')
    expect(r.publishedAt).toBe('2026-08-14T09:00:00Z')
    expect(r.body).toContain('magnitude 5.2 earthquake')
  })

  it('@graph 배열 구조도 흡수한다 (발행사마다 모양이 다르다)', () => {
    const html = page(
      '<div>x</div>',
      `<script type="application/ld+json">${JSON.stringify({
        '@graph': [{ '@type': 'WebPage' }, { '@type': ['NewsArticle'], articleBody: BODY }],
      })}</script>`,
    )
    expect(fromJsonLd(html).body).toContain('twenty seconds')
  })

  it('깨진 JSON-LD 는 조용히 건너뛴다 (한 조각 때문에 추출이 죽지 않는다)', () => {
    const html = page('<article><p>' + BODY + '</p></article>', '<script type="application/ld+json">{not json</script>')
    expect(() => extractArticle(html)).not.toThrow()
    expect(extractArticle(html).text).toContain('magnitude 5.2')
  })
})

describe('extractArticle — 어디서 건졌는지 밝힌다', () => {
  it('JSON-LD 가 있으면 그것을 쓴다 (발행사가 기계용으로 준 본문)', () => {
    const html = page(
      '<article><p>짧은 다른 내용</p></article>',
      `<script type="application/ld+json">${JSON.stringify({ '@type': 'NewsArticle', articleBody: BODY })}</script>`,
    )
    const r = extractArticle(html)
    expect(r.via).toBe('json-ld')
    expect(r.wordCount).toBeGreaterThanOrEqual(MIN_ARTICLE_WORDS)
  })

  it('JSON-LD 가 없으면 <article> 을 쓴다', () => {
    const r = extractArticle(page(`<article><p>${BODY}</p></article>`))
    expect(r.via).toBe('article-tag')
    expect(r.text).toContain('State geologists')
  })

  it('itemprop=articleBody 도 인식한다', () => {
    const r = extractArticle(page(`<div itemprop="articleBody"><p>${BODY}</p></div>`))
    expect(r.via).toBe('article-tag')
  })

  it('시맨틱 마크업이 없으면 본문 밀도로 찾되 그렇게 표시한다', () => {
    const paras = BODY.split('. ').map((s) => `<p>${s}.</p>`).join('')
    const r = extractArticle(page(`<div class="story">${paras}</div>`))
    expect(r.via).toBe('density')
    expect(r.text).toContain('magnitude 5.2')
  })

  it('네비·광고·저작권 문구를 본문으로 읽지 않는다', () => {
    const r = extractArticle(page(`<article><p>${BODY}</p></article>`))
    expect(r.text).not.toContain('Subscribe now')
    expect(r.text).not.toContain('All rights reserved')
    expect(r.text).not.toContain('Most read')
    expect(r.text).not.toContain('window.ads')
  })

  it('본문이라기엔 너무 짧은 후보는 건너뛰고 다음 후보로 간다', () => {
    // <article> 이 껍데기뿐이고 실제 본문은 밀도 블록에 있다.
    const paras = BODY.split('. ').map((s) => `<p>${s}.</p>`).join('')
    const r = extractArticle(page(`<article><p>Read more</p></article><div>${paras}</div>`))
    expect(r.wordCount).toBeGreaterThanOrEqual(MIN_ARTICLE_WORDS)
    expect(r.text).toContain('twenty seconds')
  })

  it('건질 것이 없으면 via=none 으로 정직하게 말한다', () => {
    const r = extractArticle('<html><body><nav>menu</nav></body></html>')
    expect(r.via).toBe('none')
    expect(r.wordCount).toBe(0)
  })

  it('제목과 발행 시각을 메타에서도 찾는다', () => {
    const r = extractArticle(
      page(`<article><p>${BODY}</p></article>`, '<meta property="og:title" content="Coast quake"><meta property="article:published_time" content="2026-08-14T09:00:00Z">'),
    )
    expect(r.title).toBe('Coast quake')
    expect(r.publishedAt).toBe('2026-08-14T09:00:00Z')
  })

  it('문장으로 쪼개 준다 — 원장 작성 때 훑을 단위', () => {
    const r = extractArticle(page(`<article><p>${BODY}</p></article>`))
    expect(r.sentences.length).toBeGreaterThanOrEqual(4)
    expect(r.sentences[0]).toContain('magnitude 5.2')
  })

  it('HTML 엔티티를 풀어 준다', () => {
    const r = extractArticle(page(`<article><p>${BODY} It&#x27;s over &amp; done.</p></article>`))
    expect(r.text).toContain("It's over & done")
  })
})

describe('splitSentences', () => {
  it('종결부호와 줄바꿈으로 나눈다', () => {
    expect(splitSentences('One. Two!\nThree?')).toEqual(['One.', 'Two!', 'Three?'])
  })
})

describe('trimBoilerplate — 가장자리 잡음만 걷어 낸다', () => {
  it('바이라인·소셜 위젯·퍼머링크·날짜 줄을 앞에서 걷어 낸다', () => {
    // 2026-08-18 실측에서 첫 문장이 BBC=바이라인, DW=퍼머링크, 연합=Facebook 이었다.
    expect(
      trimBoilerplate([
        'By Olivia Ireland',
        '17 August 2026',
        'https://p.dw.com/p/5IyxJ',
        'URL is copied.',
        'A magnitude 5.2 earthquake struck the coast on Tuesday.',
        'Three people were hurt.',
      ]),
    ).toEqual([
      'A magnitude 5.2 earthquake struck the coast on Tuesday.',
      'Three people were hurt.',
    ])
  })

  it('뒤쪽 상투 문구도 걷어 낸다', () => {
    expect(
      trimBoilerplate(['Three people were hurt.', 'Read more', 'Advertisement']),
    ).toEqual(['Three people were hurt.'])
  })

  it('가운데는 건드리지 않는다 — 짧은 문장도 사실일 수 있다', () => {
    // 잘못 지우면 사실이 사라진다. 가장자리만 보수적으로 다듬는 이유.
    const s = ['The quake hit at dawn.', 'Nobody died.', 'Schools closed for the day.']
    expect(trimBoilerplate(s)).toEqual(s)
  })

  it('전부 잡음이면 빈 배열', () => {
    expect(trimBoilerplate(['Share', 'Facebook', 'Print'])).toEqual([])
  })
})

describe('기사 끝에 딸려 오는 다른 기사 제목 (실측 2026-08-19 · 코리아헤럴드)', () => {
  // 추출 45문장 중 25문장이 본문이 아니었다. 이전 규칙은 마침표 없는 줄을 2단어 이하일
  //   때만 걷어 내서, 제목 줄 하나에서 다듬기가 멈추고 그 뒤 24줄이 전부 살아남았다.
  const tail = [
    'The release will also coincide with the 20th anniversary of its debut.',
    'lee.jungjoo@heraldcorp.com',
    'Related Stories',
    "Big Bang to release new single 'Biiig' on 20th anniversary",
    'Big Bang unveils new teaser images as 20th anniversary merchandise goes on sale',
    'Lee Jung-joo',
    'Subscribe +',
    'good',
    '0',
    'sad',
    '0',
    'More from Headlines',
    'Jennie to return with new EP this month',
  ]

  it('본문 마지막 문장까지만 남긴다', () => {
    const out = trimBoilerplate(tail)
    expect(out).toEqual(['The release will also coincide with the 20th anniversary of its debut.'])
  })

  it('연합뉴스 꼬리(메일 주소 · (END) · 관련 기사)도 걷어 낸다', () => {
    const out = trimBoilerplate([
      'The group is set to release the digital single next week.',
      'mlee@yna.co.kr',
      '(END)',
      'Related Articles',
      'BIGBANG to release new single on 20th anniv.',
      "Taeyang kicks off BIGBANG's 20th anniv.",
    ])
    expect(out).toEqual(['The group is set to release the digital single next week.'])
  })

  it('본문 가운데의 짧은 문장은 건드리지 않는다 — 사실이 사라지면 안 된다', () => {
    const out = trimBoilerplate([
      'The agency opened in 2024.',
      'It is new.',
      'The group will speak for it.',
    ])
    expect(out).toHaveLength(3)
  })

  it('마침표로 끝나는 긴 문장은 가장자리에서도 남긴다', () => {
    const out = trimBoilerplate([
      'KASA named the group as its first honorary ambassador on Friday afternoon.',
    ])
    expect(out).toHaveLength(1)
  })

  it('스무 단어가 넘는 마침표 없는 줄은 제목으로 보지 않는다 — 잘린 문장일 수 있다', () => {
    const long =
      'the agency said that the group would help the public understand its plans about rockets and satellites in the coming years'
    expect(trimBoilerplate([long])).toEqual([long])
  })
})

describe('섹션 머리 자르기 — 본문을 통째로 날리지 않는다', () => {
  it('앞쪽 절반의 섹션 머리는 자르기 기준으로 삼지 않는다', () => {
    // 뒤쪽 절반에서만 찾는다 — 앞에서 찾으면 기사 전체가 사라진다.
    //   (가장자리 규칙과 섞이지 않게 문제의 줄을 첫 자리가 아닌 곳에 둔다.)
    const out = trimBoilerplate([
      'The agency opened its doors in 2024.',
      'Related coverage',
      'The agency named the group as ambassador.',
      'The members will speak for it in public.',
      'The tour starts next month in Goyang.',
      'The single arrives on the same week.',
    ])
    expect(out).toHaveLength(6)
  })

  it('긴 문장은 섹션 머리로 보지 않는다', () => {
    const out = trimBoilerplate([
      'The agency opened in 2024 and began its work.',
      'The group accepted the role this week.',
      'Related agencies in other countries have tried the same idea with singers.',
    ])
    expect(out).toHaveLength(3)
  })

  it('섹션 머리가 없으면 아무것도 자르지 않는다', () => {
    const body = [
      'The agency opened in 2024.',
      'The group accepted the role.',
      'The tour starts next month.',
    ]
    expect(trimBoilerplate(body)).toEqual(body)
  })
})
