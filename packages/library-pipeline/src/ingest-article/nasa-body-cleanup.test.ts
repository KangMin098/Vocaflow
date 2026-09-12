// packages/library-pipeline/src/ingest-article/nasa-body-cleanup.test.ts
//
// **NASA 수확 본문에서 템플릿 껍데기를 걷어내는 규칙의 회귀.**
//
// ── 왜 이 테스트가 있는가 (실측 2026-09-06) ─────────────────────────
// 원본 수확 **398편이 전부(100%) 오염**돼 있었다. `<article>` 통짜를 평문으로 바꾸는데
// NASA 템플릿은 읽기시간(`5 min read`)·크레딧·바이라인·공유 버튼·"Explore More" 추천
// 카드를 **전부 `<article>` 안**에 두기 때문이다. `htmlToPlainText` 가 떼는 것은
// `figure/figcaption/aside/nav` 뿐이라 나머지가 통과했고, 200자 하한도 **껍데기가 글자수를
// 채워 주기 때문에** 방어가 되지 않았다(= 짧은 기사조차 "충분히 길다" 로 통과).
//
// 패턴별 편수(422행 기준): `N min read` 281 · 단독 `Article`/`Image Article` 229 ·
// APOD 마스트헤드 211 · 바이라인 265 · `Share/Details/Last Updated/Related Terms` 꼬리 154 ·
// `Keep Exploring` 150 · 미해독 엔티티 79 · `Explore More` 추천 카드 77.
//
// ── 이 테스트가 잠그는 두 가지 ─────────────────────────────────────
// **① 순서 함정** — 머리를 먼저 확정하고 꼬리는 그 뒤에서만 찾아야 한다.
//   photojournal 쪽은 `Downloads → 제목 → JPEG (2.44 MB) → Description → 본문` 순서라
//   `Downloads` 를 꼬리 표지로 먼저 자르면 **본문 전체가 사라진다**(시뮬레이션 1차에서
//   38편이 200자 미만으로 떨어졌다). `photojournal` 케이스가 이걸 지킨다.
//
// **② 오탐 회귀** — `X Navigation` 은 본문에 실제로 있었다:
//   "Theriot created a Field Navigation Exercise at Challenger 7 Memorial Park".
//   바이라인 모양(`^[A-Z][a-z]+( [A-Z][a-z.]+){1,3}$`)의 단독 줄도 본문 한복판에 433회
//   나온다. 둘 다 지워지면 안 된다.
//
// 규칙은 "지우는" 종류라 되돌리기 쉽다(한 줄만 넓히면 조용히 본문을 먹는다). 그래서 잠근다.

import { afterEach, describe, expect, it, vi } from 'vitest'

import { cleanNasaBody, ingestNasaArticle, pickNasaBodyHtml } from './nasa'

// ─────────────────────────────────────────────
// 실제 NASA 마크업의 성격만 본뜬 최소 골격
// (라이브 5쪽 실측: news-release · image-article · earth-observatory · photojournal ·
//  science.nasa.gov APOD 미러 — 여섯 쪽 모두 본문은 `<div class="entry-content">` 안이고
//  읽기시간·크레딧·공유버튼·추천카드는 전부 그 **밖**이었다.)
// ─────────────────────────────────────────────

const HEAD = '<meta property="og:title" content="테스트 기사" />'

/** `<article>` 안이지만 본문 컨테이너 **밖** — 예전 코드가 통째로 삼키던 것들. */
const OUTER_CHROME = `
<div class="hds-article-header"><p>5 min read</p><p>Article</p>
<p>Jane Q Public</p><p>Credits: NASA/JPL-Caltech</p>
<button>Copy URL to clipboard</button></div>`

const OUTER_TAIL = `
<div class="hds-related"><h2>Explore More</h2>
<p>7 min read</p><p>Keep Exploring</p><p>Last Updated</p><p>Related Terms</p></div>`

const BODY_SENTENCE =
  'The mission team confirmed that the spacecraft completed its orbital insertion burn on schedule, ' +
  'and the flight director reported nominal telemetry across every subsystem for the following twelve hours. ' +
  'Engineers will spend the coming week checking each instrument in turn before science operations begin.'

function page(entryContent: string, opts: { chrome?: boolean } = {}): string {
  const chrome = opts.chrome === false ? '' : OUTER_CHROME
  return `${HEAD}<article id="post-1">${chrome}<div class="desktop:grid-col-9"><div class="entry-content">${entryContent}</div></div>${
    opts.chrome === false ? '' : OUTER_TAIL
  }</article>`
}

function stubPage(html: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, text: async () => html })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// ─────────────────────────────────────────────

describe('NASA 본문 컨테이너 선택', () => {
  it('일반 기사 — 머리 표지(Article)와 꼬리(Share/Details)를 걷고 본문만 남긴다', async () => {
    stubPage(
      // 실제 순서: 바이라인이 표지 줄 **앞**에 온다 → 머리 절단에 흡수된다(별도 규칙 금지).
      page(`<p>Jane Q Public</p><p>Article</p><p>${BODY_SENTENCE}</p>
            <p>Share</p><p>Details</p><p>Last Updated</p>`),
    )
    const article = await ingestNasaArticle('https://www.nasa.gov/news-release/x/')
    expect(article.content).toContain('orbital insertion burn')
    // 머리 표지도, 그 앞 바이라인도, 꼬리도 남지 않는다.
    expect(article.content).not.toMatch(/^Article$/m)
    expect(article.content).not.toContain('Jane Q Public')
    expect(article.content).not.toMatch(/^Share$/m)
    expect(article.content).not.toMatch(/^Last Updated$/m)
  })

  it('컨테이너 밖 껍데기(읽기시간·크레딧·Explore More)는 애초에 들어오지 않는다', async () => {
    stubPage(page(`<p>${BODY_SENTENCE}</p>`))
    const article = await ingestNasaArticle('https://www.nasa.gov/news-release/x/')
    expect(article.content).not.toMatch(/min read/)
    expect(article.content).not.toContain('Credits:')
    expect(article.content).not.toContain('Explore More')
    expect(article.content).not.toContain('Copy URL to clipboard')
    expect(article.content.trim()).toBe(BODY_SENTENCE)
  })

  it('`form-entry-content` 를 본문으로 착각하지 않는다 — 클래스는 토큰 일치', () => {
    // 미끼는 **200자를 넘긴다** — 짧으면 하한에 걸려 우연히 통과하므로 규칙을 검사하지 못한다.
    const decoy =
      'Sign up for our newsletter to receive mission updates, launch schedules, and imagery releases ' +
      'directly in your inbox every week. You can unsubscribe at any time using the link at the bottom ' +
      'of any message we send you.'
    expect(decoy.length).toBeGreaterThan(200)
    const html = `<div class="form-entry-content"><p>${decoy}</p></div>
                  <div class="entry-content"><p>${BODY_SENTENCE}</p></div>`
    expect(pickNasaBodyHtml(html)).toContain('orbital insertion burn')
    expect(pickNasaBodyHtml(html)).not.toContain('newsletter')
  })

  it('중첩 `<div>` 가 있어도 컨테이너 끝까지 읽는다 — 첫 `</div>` 로 자르면 본문이 잘린다', async () => {
    // 본문 앞에 이미지 블록(중첩 div)이 오는 것이 image-article·photojournal 의 기본 모양이다.
    // 첫 `</div>` 로 자르면 컨테이너가 이미지 블록에서 끝나 본문을 놓치고, 그러면 `<article>`
    // 통짜로 물러나 껍데기가 다시 딸려 들어온다 — 그래서 껍데기 부재로 검사한다.
    stubPage(
      page(`<div class="wp-block-image"><div class="hds-media-wrapper"><img /></div></div><p>${BODY_SENTENCE}</p>`),
    )
    const article = await ingestNasaArticle('https://science.nasa.gov/image-article/x/')
    expect(article.content.trim()).toBe(BODY_SENTENCE)
  })

  it('컨테이너가 없으면 `<article>` 로 물러나되 표지 절단은 계속 돈다 — 구형 쪽을 버리지 않는다', async () => {
    stubPage(
      `${HEAD}<article><p>5 min read</p><p>Article</p><p>${BODY_SENTENCE}</p><p>Keep Exploring</p><p>Perseverance rover mission page</p></article>`,
    )
    const article = await ingestNasaArticle('https://www.nasa.gov/general/x/')
    expect(article.content.trim()).toBe(BODY_SENTENCE)
  })
})

describe('순서 함정 — 머리 먼저, 꼬리 나중', () => {
  // ⚠️ 이 케이스가 이 파일의 존재 이유다. `Downloads` 를 꼬리로 먼저 자르면 본문이 0자가 된다.
  const PHOTOJOURNAL = `<p>Downloads</p><p>The Rich Color Variations of Pluto</p>
    <p>JPEG (2.44 MB)</p><p>The Rich Color Variations of Pluto</p><p>TIFF (43.89 MB)</p>
    <p>Description</p><p>${BODY_SENTENCE}</p>`

  it('photojournal — 다운로드 껍데기가 본문 **앞**에 있어도 본문이 살아남는다', async () => {
    stubPage(page(PHOTOJOURNAL, { chrome: false }))
    const article = await ingestNasaArticle('https://science.nasa.gov/photojournal/pluto/')
    expect(article.content).toContain('orbital insertion burn')
    expect(article.content.length).toBeGreaterThanOrEqual(200)
  })

  it('photojournal — `Downloads`·파일크기·중복 제목이 남지 않는다', () => {
    const cleaned = cleanNasaBody(
      ['Downloads', '', 'The Rich Color Variations of Pluto', '', 'JPEG (2.44 MB)', '', 'Description', '', BODY_SENTENCE].join('\n'),
    )
    expect(cleaned).toBe(BODY_SENTENCE)
  })

  it('APOD — `Explanation:` 앞 마스트헤드가 사라지고 같은 줄의 본문은 남는다', () => {
    const cleaned = cleanNasaBody(
      [
        'APOD',
        '',
        'Astronomy Picture of the Day',
        '',
        'Discover the cosmos! Each day a different image or photograph of our fascinating universe is featured.',
        '',
        'Nā ʻUhane Māhoe Huki Pū i ke Ola',
        '',
        `Explanation: ${BODY_SENTENCE}`,
        '',
        "Tomorrow's picture: chasing shadows",
        '',
        'Random APOD Generator',
      ].join('\n'),
    )
    expect(cleaned).toBe(BODY_SENTENCE)
    expect(cleaned).not.toContain('Astronomy Picture of the Day')
    expect(cleaned).not.toContain('Explanation:')
  })
})

describe('오탐 회귀 — 본문을 먹지 않는다', () => {
  it('본문 한복판의 `Field Navigation Exercise` 문장이 살아남는다', () => {
    const sentence =
      'Theriot created a Field Navigation Exercise at Challenger 7 Memorial Park for the visiting students.'
    const cleaned = cleanNasaBody([BODY_SENTENCE, '', sentence].join('\n'))
    expect(cleaned).toContain('Field Navigation Exercise at Challenger 7 Memorial Park')
  })

  it('머리에 붙은 단독 `Curiosity Navigation` 줄은 지운다 — 첫 3줄 한정', () => {
    const cleaned = cleanNasaBody(['Curiosity Navigation', '', BODY_SENTENCE].join('\n'))
    expect(cleaned).toBe(BODY_SENTENCE)
  })

  it('본문 깊숙한 곳의 단독 `... Navigation` 줄은 건드리지 않는다 — 창이 3줄인 이유', () => {
    // 창을 넓히면(예: 300) 소제목·표 머리글이 조용히 사라진다. 창 자체를 잠근다.
    const deep = [BODY_SENTENCE, '', BODY_SENTENCE, '', BODY_SENTENCE, '', 'Lunar Navigation', '', BODY_SENTENCE]
    expect(cleanNasaBody(deep.join('\n'))).toContain('Lunar Navigation')
  })

  it('본문 중간의 인용 귀속 이름 줄은 남는다 — 바이라인 모양 단독 줄이 433회 있었다', () => {
    const cleaned = cleanNasaBody(
      [BODY_SENTENCE, '', 'Amit Kshatriya', '', 'The team continued its review of the flight data.'].join('\n'),
    )
    expect(cleaned).toContain('Amit Kshatriya')
  })

  it('문장 안 `min read` 는 건드리지 않는다 — 단독 줄만 지운다', () => {
    const sentence = 'The summary is a 5 min read for anyone following the mission.'
    expect(cleanNasaBody([sentence, '', BODY_SENTENCE].join('\n'))).toContain('a 5 min read for')
    expect(cleanNasaBody(['5 min read', '', BODY_SENTENCE].join('\n'))).toBe(BODY_SENTENCE)
  })

  it('꼬리 표지가 본문 앞쪽에 잘못 걸리면 자르지 않는다 — 안전판', () => {
    // `Topics:` 가 첫 줄이면 자를 수 없다(자르면 0자). 다음 후보를 보고, 없으면 그대로 둔다.
    const cleaned = cleanNasaBody(['Topics:', '', BODY_SENTENCE].join('\n'))
    expect(cleaned).toContain('orbital insertion burn')
  })
})

describe('줄·토큰 치환 — 자르기가 필요 없는 것들', () => {
  it('`&hellip;` 등 남은 named entity 를 해독한다 (79편에 잔존했다)', () => {
    const cleaned = cleanNasaBody(
      `The countdown continued&hellip; and the crew&rsquo;s reply came from Bogot&aacute;&mdash;no, from Le&oacute;n.\n\n${BODY_SENTENCE}`,
    )
    expect(cleaned).toContain('continued…')
    expect(cleaned).toContain('crew’s')
    expect(cleaned).toContain('—no')
    expect(cleaned).not.toContain('&hellip;')
    expect(cleaned).not.toContain('&rsquo;')
  })

  // 세 규칙을 **한 줄에 겹쳐 쓰지 않는다** — NASA 실제 마크업은 한 줄이지만, 겹쳐 두면
  // 규칙 하나를 지워도 다른 하나가 대신 잡아 테스트가 통과한다(변이 검사에서 실제로 살아남았다).
  it.each([
    ['영상 재생 안내', 'To view this video please enable JavaScript.'],
    ['브라우저 업그레이드 안내', 'Or consider upgrading to a web browser that supports HTML5 video.'],
    ['스페인어판 링크', 'Lee esta historia en español aquí.'],
  ])('%s 줄을 지운다', (_label, junk) => {
    expect(cleanNasaBody([junk, '', BODY_SENTENCE].join('\n'))).toBe(BODY_SENTENCE)
  })
})

describe('짧은 본문 게이트', () => {
  it('껍데기를 다 걷은 뒤에도 200자를 못 넘기면 거절한다', async () => {
    stubPage(page('<p>Article</p><p>A short caption.</p>'))
    await expect(ingestNasaArticle('https://www.nasa.gov/image-detail/x/')).rejects.toThrow(
      /body too short/,
    )
  })

  it('거절 메시지가 **세척 뒤** 길이를 말한다 — 껍데기가 글자수를 채워 주면 안 된다', async () => {
    stubPage(page('<p>Article</p><p>A short caption.</p>'))
    await expect(ingestNasaArticle('https://www.nasa.gov/image-detail/x/')).rejects.toThrow(
      /too short: (?:[0-9]|[1-9][0-9]|1[0-9]{2}) chars/,
    )
  })
})
