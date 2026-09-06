// packages/library-pipeline/src/ingest-article/space-place.test.ts
//
// **비PD 후보까지 12곳을 훑어 두 관문(robots · 저작권 고지)을 다 통과한 유일한 소스.**
// 그래서 여기서 지키는 것은 셋이다:
//   1. 목록에서 **지문이 아닌 것**(용어 풀이)이 섞이지 않는가
//   2. 본문이 **문단 배열**로 나오는가 (발췌기가 그 꼴을 받는다)
//   3. 모르는 피드 이름에 **조용히 다른 것을 주지 않는가**
//
// 망을 타지 않는다 — 순수 함수만 검사한다.

import { describe, expect, it } from 'vitest'

import {
  SPACE_PLACE_FEEDS,
  listSpacePlaceFeed,
  spacePlaceParagraphs,
  spacePlaceSlugsIn,
  spacePlaceTitle,
  spacePlaceUrl,
} from './space-place'
import { SOURCE_POLICIES, SOURCE_REGISTER_DEFAULT, SOURCE_SPECS, resolveArticleRegister } from './_curation-spec'

/** 실측 형태 — 주제 메뉴가 `/<slug>/en/` 로 건다. `glossary` 가 같은 꼴로 섞여 있다. */
const menuHtml = `
<ul>
  <li><a href="/all-about-mars/en/">Mars</a></li>
  <li><a href="/big-bang/en/">Big Bang</a></li>
  <li><a href="/glossary/en/">Glossary</a></li>
  <li><a href="/all-about-mars/en/">Mars (again)</a></li>
</ul>`

const articleHtml = `
<html><head><title>What Is a Black Hole? | NASA Space Place – NASA Science for Kids</title></head>
<body>
<nav><p>Skip to main content and other navigation words here</p></nav>
<h1>What Is a Black Hole?</h1>
<p>A black hole is a place in space where gravity pulls so much that even light cannot get out.</p>
<p>Read more</p>
<p>The gravity is so strong because matter has been squeezed into a tiny space. This can happen when a star is dying.</p>
<footer><p>Footer text with plenty of words to be long enough to count</p></footer>
</body></html>`

describe('Space Place 목록', () => {
  it('용어 풀이는 지문이 아니다 — 목록에서 뺀다', () => {
    // 안 빼면 낱말 뜻풀이가 지문으로 들어온다.
    expect(spacePlaceSlugsIn(menuHtml)).not.toContain('glossary')
  })

  it('같은 글이 두 번 걸려도 한 번만 센다', () => {
    expect(spacePlaceSlugsIn(menuHtml)).toEqual(['all-about-mars', 'big-bang'])
  })

  it('slug 로 주소를 만든다', () => {
    expect(spacePlaceUrl('big-bang')).toBe('https://spaceplace.nasa.gov/big-bang/en/')
  })

  it('모르는 피드 이름에 조용히 다른 것을 주지 않는다', async () => {
    // StoryWeaver 에서 같은 폴백이 `--level 3` 을 L1 으로 바꿔치기했다 —
    // 오류가 안 나서 "이미 다 넣었구나" 로 읽혔다. 같은 실수를 여기서 되풀이하지 않는다.
    await expect(listSpacePlaceFeed('menu-nope', 1)).rejects.toThrow(/menu-nope/)
  })

  it('주제 메뉴가 여섯 곳이고 `all` 로 한꺼번에 훑을 수 있다', () => {
    // `/menu/all/` 은 JS 로 그려서 서버 HTML 에 링크가 없다(실측 11KB · 링크 0) —
    // 그래서 주제 메뉴를 하나씩 도는 것이 유일한 경로다.
    expect(SPACE_PLACE_FEEDS).toHaveLength(6)
    expect(SPACE_PLACE_FEEDS.map((f) => f.id)).toContain('home')
  })
})

describe('Space Place 본문', () => {
  it('문단 배열로 낸다 — 발췌기가 그 꼴을 받는다', () => {
    const ps = spacePlaceParagraphs(articleHtml)
    expect(Array.isArray(ps)).toBe(true)
    expect(ps[0]).toContain('A black hole is a place in space')
  })

  it('메뉴·꼬리말을 문단으로 세지 않는다', () => {
    const ps = spacePlaceParagraphs(articleHtml).join(' ')
    expect(ps).not.toMatch(/Skip to main content|Footer text/)
  })

  it('8낱말 미만 조각은 문단이 아니다 — "Read more" 가 경계를 어지럽힌다', () => {
    expect(spacePlaceParagraphs(articleHtml)).not.toContain('Read more')
  })

  it('제목에서 사이트 이름을 뗀다', () => {
    expect(spacePlaceTitle(articleHtml)).toBe('What Is a Black Hole?')
  })

  it('`<h1>` 이 없으면 `<title>` 에서 읽는다', () => {
    const noH1 = articleHtml.replace(/<h1[\s\S]*?<\/h1>/, '')
    expect(spacePlaceTitle(noH1)).toBe('What Is a Black Hole?')
  })
})

describe('Space Place 배선', () => {
  it('register 기본값이 expository 이고 처리 경로도 같은 답을 낸다', () => {
    // 표에 적힌 것과 처리 경로가 그 표를 읽는 것은 다른 일이다.
    expect(SOURCE_REGISTER_DEFAULT.space_place).toBe('expository')
    expect(resolveArticleRegister('space_place', null)).toBe('expository')
  })

  it('초급~중급 밴드를 겨냥한다 — 실측 FK 중앙 6.63(초6~중1)', () => {
    expect(SOURCE_SPECS.space_place.targetLevels).toContain('beginner')
    expect(SOURCE_SPECS.space_place.targetCefr).toEqual({ min: 'A2', max: 'B1' })
  })

  it('정책 표가 PD 로 분류한다 — 발행·변형이 막히면 안 된다', () => {
    expect(SOURCE_POLICIES.space_place.licenseClass).toBe('public_domain')
  })
})

// ─────────────────────────────────────────────────────────────────────────
// 실측 픽스처 (2026-09-06 · 원본 HTML 그대로 옮김)
//
// 아래 두 결함은 **추측이 아니라 내려받아 센 것**이다. 주제 메뉴 6곳에서 모은 42편 기준:
//   ① 브라우저 안내가 첫 문단  — **42/42 (100%)**
//   ② 툴팁 속성값이 본문으로 샘 — 4편 (`clicked="0">` 가 본문에 그대로 남음)
//   ③ 사진·위젯 설명 `p.caption` — 118개 (위젯 조작 안내 11편 · 출처 표기 26편 포함)
// ─────────────────────────────────────────────────────────────────────────

/**
 * `<body>` 바로 다음의 IE 조건부 주석. **42편 전부가 같은 틀을 쓴다.**
 *
 * ⚠️ 앞 블록의 닫는 표지가 `<![endif\-->` 로 역슬래시가 섞여 있다 — **원본 그대로다.**
 *   고치지 말 것. `-->` 로 닫히기는 하므로 주석 규칙이 잡는다는 것을 여기서 잠근다.
 */
const ieWarningHtml = `
<html><head><title>What Is a Galaxy? | NASA Space Place – NASA Science for Kids</title></head>
<body class ="space en">

<!--[if lt IE 8]>
    <link rel = "stylesheet" href = "/css/css/ie7.css"/>
<![endif\\-->

<!--[if lt IE 7]>
    <div class = "outdated-browser-warning">
        <p>
            You are using an outdated browser.  For a faster, safer, and more beautiful web upgrade for free today.
            <a href = "http://www.apple.com/safari/" target="_blank"><img src = "/resources/icons/safari-logo.png" alt = "safari logo"></a>
        </p>
    </div>
<![endif]-->

<h1>What Is a Galaxy?</h1>
<p>A galaxy is a huge collection of gas, dust, and stars and their solar systems held together by gravity.</p>
</body></html>`

/** `/galaxy/en/` 188·203·207줄 — 툴팁 속성값 안에 태그가 들어 있는 실제 문단과 사진 설명. */
const definitionHtml = `
<body>
<p>A <strong>galaxy</strong> is a huge collection of gas, dust, and <span class="definition" definitiontext="A billion is one thousand millions, or 1,000,000,000." clicked="0">billions</span> of stars and their solar systems. A galaxy is held together by gravity. Our galaxy, the Milky Way, also has a <span class="definition" definitiontext="A <strong>supermassive black hole</strong> is the biggest kind of black hole. Its gravity is more than a million times stronger than our sun's. It has very strong gravity that pulls in everything around it." clicked="0">supermassive black hole</span> in the middle.</p>
<p class="caption">The Milky Way galaxy fills the night sky in this photo. Credit: NPS/Dan Duriscoe</i></p>
<p>There are many galaxies besides ours, though. There are so many, we can even count them all yet! The <span class="definition" definitiontext="  <img src='/review/pinwheel-galaxy/hubble.en.png' width='95%' style='border-radius: 30px'> <strong>The Hubble Space Telescope</strong> was launched in 1990. It orbits Earth and takes amazing pictures of stars, planets, and other galaxies. <br><br> " clicked="0">Hubble Space Telescope</span> looked at a small patch of space for 12 days and found 10,000 galaxies.</p>
</body>`

describe('Space Place 본문 — 실측 결함 두 갈래', () => {
  it('브라우저 안내가 첫 문단이 되지 않는다 — 42/42 가 이 틀이었다', () => {
    // ⚠️ 8낱말 문턱은 이것을 못 막는다 — 안내문이 18낱말이라 문단으로 통과했다.
    //   그래서 98~189낱말짜리 짧은 설명글의 앞 18~50낱말이 안내문으로 채워졌고,
    //   멀쩡한 설명글이 판정에서 `fragmentary` 로 반려됐다.
    const ps = spacePlaceParagraphs(ieWarningHtml)
    expect(ps[0]).toMatch(/^A galaxy is a huge collection/)
    expect(ps.join(' ')).not.toMatch(/outdated browser/i)
  })

  it('안내문 자체는 8낱말 문턱을 넘는다 — 문턱으로는 못 막는다는 사실을 잠근다', () => {
    // 이 검사가 깨지면 위 검사가 "주석을 지워서" 가 아니라 "짧아서" 통과하는 것이 된다.
    const warning =
      'You are using an outdated browser. For a faster, safer, and more beautiful web upgrade for free today.'
    expect(warning.split(/\s+/).filter(Boolean).length).toBeGreaterThanOrEqual(8)
  })

  it('닫는 표지에 역슬래시가 섞인 블록(`<![endif\\-->`)도 지운다 — 원본 그대로다', () => {
    // 픽스처가 진짜 역슬래시를 담고 있는지부터 확인한다 — 템플릿 리터럴은 `\-` 를 조용히
    // `-` 로 바꾼다. 그러면 "실측 그대로" 라는 주장이 거짓이 되고 검사도 헐거워진다.
    expect(ieWarningHtml).toContain('<![endif\\-->')
    expect(spacePlaceParagraphs(ieWarningHtml).join(' ')).not.toMatch(/stylesheet|ie7\.css/i)
  })

  it('툴팁 속성값이 본문으로 새지 않는다 — 앵커 낱말만 남고 문장이 이어진다', () => {
    // `<[^>]*>` 는 `definitiontext="A <strong>` 에서 멈춰 속성 나머지를 본문에 흘렸다:
    //   "…also has a supermassive black hole is the biggest kind of black hole. …
    //    around it." clicked="0">supermassive black hole in the middle."
    const ps = spacePlaceParagraphs(definitionHtml)
    expect(ps[0]).toBe(
      'A galaxy is a huge collection of gas, dust, and billions of stars and their solar systems. ' +
        'A galaxy is held together by gravity. Our galaxy, the Milky Way, also has a supermassive black hole in the middle.',
    )
  })

  it('속성값 잔재(`clicked="0">` · 풀이 문장)가 본문에 남지 않는다', () => {
    const all = spacePlaceParagraphs(definitionHtml).join(' ')
    expect(all).not.toMatch(/clicked=/)
    expect(all).not.toMatch(/is the biggest kind of black hole/)
    expect(all).not.toMatch(/A billion is one thousand millions/)
  })

  it('풀이 속성 안에 홑따옴표 속성이 중첩돼도 샌다 — `<img src=\'…\'>` 도 실측 형태다', () => {
    const all = spacePlaceParagraphs(definitionHtml).join(' ')
    expect(all).toContain('The Hubble Space Telescope looked at a small patch of space')
    expect(all).not.toMatch(/pinwheel-galaxy|border-radius|was launched in 1990/)
  })

  it('따옴표가 안 닫힌 깨진 마크업에서도 `<` 가 본문에 남지 않는다 — 되돌림 안전판', () => {
    // 첫 대안이 실패하면 예전 규칙(`<[^>]*>`)으로 떨어져야 한다. 안 그러면 새 규칙이
    // 깨진 쪽 하나로 원문에 태그를 흘린다.
    const broken = `<body><p>The Sun <span class="definition definitiontext=oops>is a star</span> that warms our whole planet every day.</p></body>`
    const all = spacePlaceParagraphs(broken).join(' ')
    expect(all).not.toContain('<')
  })
})

describe('Space Place 사진 설명 — 문자열이 아니라 구조로 뺀다', () => {
  const captionHtml = `
<body>
<p>Earth is a great planet to live on because it has an atmosphere that protects us from the Sun.</p>
<p class="caption">Explore Earth! Click and drag to rotate Earth. Scroll or pinch to zoom in and out. Credit: NASA Visualization Technology Applications and Development (VTAD)</p>
<p class = "caption">The Milky Way galaxy fills the night sky in this photo. Credit: NPS/Dan Duriscoe</p>
<p class="caption" style="margin-top:10px;">Voyager 2 took this picture of Neptune in 1989 and it was the only visit.</p>
<p class="Quicksand">The atmosphere also holds the air that we breathe every single day of our lives.</p>
</body>`

  it('`p.caption` 만 뺀다 — 위젯 조작 안내(11편)와 출처 표기(26편)가 여기 다 들어 있다', () => {
    const ps = spacePlaceParagraphs(captionHtml)
    expect(ps.join(' ')).not.toMatch(/Click and drag|Credit:|Voyager 2 took this picture/)
  })

  it('`class = "caption"` 처럼 공백을 넣은 것도 잡는다 — 실측 8건이 이 꼴이다', () => {
    expect(spacePlaceParagraphs(captionHtml).join(' ')).not.toMatch(/Dan Duriscoe/)
  })

  it('caption 이 아닌 class 는 본문으로 남긴다 — 필터가 넓어지면 본문이 사라진다', () => {
    const ps = spacePlaceParagraphs(captionHtml)
    expect(ps).toHaveLength(2)
    expect(ps[1]).toContain('the air that we breathe')
  })

  it('본문 산문에 나온 "Credit:" 은 지우지 않는다 — 문자열로 지우면 안 되는 이유', () => {
    // `_helpers.ts` 에 캡션을 문장 필터로 잡으려다 실패한 실측 기록이 있다.
    // 여기서도 같은 유혹을 잠근다 — 판정 근거는 오직 `class`.
    const prose = `<body><p>Credit: the word means trust, and scientists earn it by showing their work to everyone.</p></body>`
    expect(spacePlaceParagraphs(prose)[0]).toMatch(/^Credit: the word means trust/)
  })
})
