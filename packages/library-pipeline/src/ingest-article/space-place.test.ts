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
