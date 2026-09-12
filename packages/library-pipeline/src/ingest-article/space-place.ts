// packages/library-pipeline/src/ingest-article/space-place.ts
//
// **NASA Space Place — 어린이·청소년용 우주 설명글.**
//
// ── 왜 이 소스인가 (실측 2026-09-03) ─────────────────────────────────
// 비PD 후보까지 12곳을 훑었는데, **두 관문(robots · 저작권 고지)을 다 통과한 것은
// 이곳뿐**이었다. 그리고 난이도가 초·중 한가운데에 정확히 앉는다(표본 29편):
//
//     어수  p25 250 · 중앙 354 · p75 609
//     FK    p25 5.51 · **중앙 6.63** · p75 7.63   (시중 초6~중1 5.34 · 중1 7.60)
//     문장  13어                                   (시중 중1 교재 13.9어)
//     학년 칸  초6~중1 11 · 중1~2 10 · 초5~6 5 · 초3~4 2 · 중3 1
//
// 길이만 창(100~200어) 밖이고, 그건 **발췌가 푸는 문제**다(`excerptForBand`).
// 문단 구조가 뚜렷해 문단 경계로 자르면 된다.
//
// ── 라이선스 — NASA 가 교재를 이름으로 지목한다 ──────────────────────
// nasa.gov 이용 규정 원문:
//
//   "NASA content … generally are not subject to copyright in the United States.
//    You may use this material for educational or informational purposes, including
//    … **textbooks** … **text-book authors may use NASA content without needing
//    explicit permission**, subject to compliance with these guidelines.
//    NASA content used in a **factual manner that does not imply endorsement** may be
//    used without needing explicit permission."
//
// ⚠️ **NASA 휘장·로고타입은 PD 가 아니다**(별도 보호). 글만 가져오고 로고는 안 쓴다.
// ⚠️ **보증(endorsement)을 암시하면 안 된다** — "NASA 공인 교재" 같은 표현 금지.
//
// ── robots ───────────────────────────────────────────────────────────
// `User-agent: * / Disallow: /magic/` — 본문 경로는 허용.
//
// 목록: 주제 메뉴 6곳에서 `/<slug>/en/` 링크를 모은다. **sitemap 이 없다** —
//       `/sitemap.xml` 은 영문 기사 URL 을 하나도 안 준다(실측).
// source_id: "space_place:<slug>"

import type { RawArticle } from '../types-article'

import { fetchWithTimeout } from './_helpers'
import { applyArticleCurationSpec, type ArticleScore } from './_curation-spec'

const SITE = 'https://spaceplace.nasa.gov'

/**
 * 목록을 긁는 자리. **주제 메뉴다** — 전체 목록 쪽(`/menu/all/`)은 JS 로 그려서
 * 서버 HTML 에 링크가 없다(실측: 11KB 에 기사 링크 0개).
 */
export const SPACE_PLACE_FEEDS: Array<{ id: string; label: string; path: string }> = [
  { id: 'home', label: 'NASA Space Place — 첫 화면', path: '/' },
  { id: 'sun', label: 'NASA Space Place — 태양', path: '/menu/sun/' },
  { id: 'earth', label: 'NASA Space Place — 지구', path: '/menu/earth/' },
  { id: 'solar-system', label: 'NASA Space Place — 태양계', path: '/menu/solar-system/' },
  { id: 'universe', label: 'NASA Space Place — 우주', path: '/menu/universe/' },
  { id: 'space', label: 'NASA Space Place — 우주탐사', path: '/menu/space/' },
]

export interface SpacePlaceListItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
  score?: ArticleScore
}

export const spacePlaceUrl = (slug: string): string => `${SITE}/${slug}/en/`

/** slug 를 사람이 읽는 제목으로. 쪽에서 못 읽었을 때만 쓰는 대비책이다. */
const titleFromSlug = (slug: string): string =>
  slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

/**
 * 한 쪽에서 기사 slug 를 긁는다.
 *
 * ⚠️ `glossary` 는 낱말 풀이라 지문이 아니다 — 빼지 않으면 용어 목록이 지문으로 들어온다.
 */
export function spacePlaceSlugsIn(html: string): string[] {
  const out = new Set<string>()
  for (const m of String(html).matchAll(/href="\/([a-z0-9-]+)\/en\/"/g)) {
    if (m[1] && m[1] !== 'glossary') out.add(m[1])
  }
  return [...out]
}

export async function listSpacePlaceFeed(
  feedId = 'home',
  limit?: number,
): Promise<SpacePlaceListItem[]> {
  // 모르는 피드에 조용히 첫 번째를 주지 않는다 — 그러면 "받았는데 다른 것" 이 된다.
  const feeds = feedId === 'all' ? SPACE_PLACE_FEEDS : SPACE_PLACE_FEEDS.filter((f) => f.id === feedId)
  if (!feeds.length) {
    throw new Error(
      `Space Place 피드 '${feedId}' 를 모른다. 쓸 수 있는 것: all · ${SPACE_PLACE_FEEDS.map((f) => f.id).join(' · ')}`,
    )
  }

  const slugs = new Set<string>()
  for (const f of feeds) {
    const res = await fetchWithTimeout(`${SITE}${f.path}`)
    if (!res.ok) continue
    for (const s of spacePlaceSlugsIn(await res.text())) slugs.add(s)
  }
  if (!slugs.size) throw new Error('Space Place 목록에서 기사 링크를 못 찾았다')

  const items: SpacePlaceListItem[] = [...slugs].map((slug) => ({
    source_id: `space_place:${slug}`,
    title: titleFromSlug(slug),
    url: spacePlaceUrl(slug),
    // 이 쪽들은 발행일을 싣지 않는다. **지어내지 않는다** — null 이 사실이다.
    published_at: null,
    description: '',
  }))
  return applyArticleCurationSpec(items.slice(0, limit ?? items.length), 'space_place', feedId, {
    maxItems: limit,
  })
}

/**
 * 태그 하나를 삼키는 규칙 — **따옴표로 닫힌 속성값 안은 통째로 건너뛴다.**
 *
 * ⚠️ 흔한 `<[^>]*>` 는 **속성값 안의 `<`** 에서 멈춘다. Space Place 는 낱말 풀이를
 *   속성에 통째로 싣는데 그 값 안에 태그가 들어 있다 (실측 2026-09-06 `/galaxy/en/` 원본):
 *
 *     <span class="definition" definitiontext="A <strong>supermassive black hole</strong> is the
 *       biggest kind of black hole. … pulls in everything around it." clicked="0">supermassive black hole</span>
 *
 *   `<[^>]*>` 는 `…definitiontext="A <strong>` 까지만 먹고 끝나 속성 나머지가 본문으로 샌다:
 *     "…also has a supermassive black hole is the biggest kind of black hole. Its gravity …
 *      pulls in everything around it." clicked="0">supermassive black hole in the middle."
 *   실측: 내려받은 42편 중 **4편**의 본문에 `clicked="0">` 가 그대로 남아 문장이 파열돼 있었다.
 *
 *   그래서 `<` 뒤를 (따옴표 밖 문자) 와 (`=` 뒤에 오는 따옴표 구간) 의 반복으로 읽는다.
 *   값 안의 홑따옴표(`our sun's`)도, 홑따옴표로 쓴 중첩 속성(`<img src='…' width='95%'>` —
 *   실측 `/galaxy/en/` 의 Hubble 풀이)도 둘 다 실측 형태라 양쪽을 받는다.
 *
 *   ⚠️ 따옴표 건너뛰기를 `=` 뒤로 한정한 것은 **오탐 방지**다. 그냥 따옴표만 보면
 *   `<p title=don't>` 같은 비따옴표 속성에서 본문의 다음 `'` 까지 삼킨다.
 *   ⚠️ 두 번째 대안 `<[^>]*>` 는 **되돌림 안전판**이다 — 따옴표가 열리고 안 닫힌 깨진
 *   마크업에서 첫 대안이 실패해도 예전과 똑같이 동작해 `<` 가 본문에 남지 않는다.
 */
const HTML_TAG = /<[^>"']*(?:=\s*(?:"[^"]*"|'[^']*')[^>"']*)*>|<[^>]*>/g

/**
 * 본문 문단만 뽑는다 — **발췌기가 문단 배열을 받기 때문에** 이어붙이지 않고 배열로 돌려준다.
 *
 * ⚠️ 8낱말 미만은 캡션·버튼이라 뺀다. 안 빼면 "More about this" 같은 조각이
 *   문단으로 세어져 발췌 경계가 엉뚱한 데 생긴다.
 */
export function spacePlaceParagraphs(html: string): string[] {
  const h = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    // ⚠️ **HTML 주석을 지운다 — 이게 없으면 브라우저 안내가 언제나 첫 문단이다.**
    //   `<body>` 바로 다음에 IE 조건부 주석이 있고 그 안에 `<p>` 가 들어 있다(실측 2026-09-06,
    //   내려받은 42편 **전부**가 같은 틀을 쓴다):
    //     <!--[if lt IE 7]>
    //         <div class = "outdated-browser-warning">
    //             <p> You are using an outdated browser. For a faster, safer, … upgrade for free today. …
    //   18낱말이라 아래 8낱말 문턱을 넘어 **offset 0 의 첫 문단**이 됐다. 98~189낱말짜리 짧은
    //   설명글에서는 이것만으로 앞머리가 브라우저 안내로 바뀌어, 멀쩡한 글이 판정에서
    //   `fragmentary` 로 반려됐다.
    //   오탐 위험 없음 — 조건부 주석 안에 본문이 없다(그래서 주석이다). script 를 먼저 지우는
    //   것은 JS 문자열 안의 `-->` 가 주석 끝으로 오인되는 것을 막는 순서다(실측 42편 중 0건이지만
    //   순서가 공짜다).
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<head[\s\S]*?<\/head>/i, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
  return [...h.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)]
    // ⚠️ **사진 설명은 구조로 뺀다** — `Credit: NASA` 를 문자열로 지우면 본문 산문에 정당하게
    //   나오는 것까지 지운다(`_helpers.ts` 에 캡션을 문장 필터로 잡으려다 실패한 기록이 있다).
    //   Space Place 는 `<p class="caption">` 이라는 표지를 직접 달아 준다 — 실측 42편에 118개,
    //   `class = "caption"` 처럼 공백을 넣은 것 8개 포함. 여기에 위젯 조작 안내
    //   ("Explore Earth! Click and drag to rotate Earth. …" 11편) 와 출처 표기
    //   ("… Credit: NASA/JPL-Caltech" 26편) 가 모두 들어 있다.
    //
    // ⚠️ **여기 「전수로 훑어보니 전부 사진·위젯 설명이고 본문 산문은 한 건도 없었다」고
    //   적혀 있었다. 틀렸다.** 사이트 전수 105편(캡션 252개)을 다시 읽어 분류한 결과:
    //   사진 설명 49% · 혼합 20% · **독립 산문 13%** · 위젯 안내 17% · 크레딧 2%.
    //   즉 **3분의 1이 독립 내용을 담는다.** `seasons` 는 계절이 생기는 이유라는 **그 글의
    //   핵심 설명 자체**가 캡션에 있고, `other-solar-systems` 의 반딧불이·등대 비유(54어),
    //   `blue-sky` 의 노을 산란 설명(37어)도 그렇다. 그것들은 지금 버려진다.
    //
    //   그래도 **제거를 유지한다.** 근거는 문서가 아니라 DB다 — 적재된 59행 중 10행에 위젯
    //   안내가, 17행에 `Credit:` 이 본문으로 들어가 있고, `all-about-the-sun#p3-5`(118어)는
    //   **첫 25어가 "Explore the Sun! Click and drag to rotate the Sun."** 이다.
    //   되돌리면 그 결함이 다음 수확에 그대로 재생산된다.
    //
    //   버려지는 산문을 되찾는 것은 구조로 안 된다 — 같은 `<p class="caption">` 안에
    //   "Glaciers galore in Antarctica." 와 나란히 들어 있다. 캡션 단위 판정(드레인)이
    //   필요하고 그건 별도 작업이다. **여기서 되찾는 것은 아래 포스트카드 하나뿐이다.**
    //
    //   ⚠️ 이 필터는 `class` 에 `caption` 이 있는 `<p>` 만 본다 — `<figcaption>`·`<figure>` 는
    //   이 사이트에 0건이라 일부러 다루지 않는다(없는 것을 지키는 규칙은 낡는다).
    .filter((m) => {
      if (!/\bclass\s*=\s*["'][^"']*\bcaption\b/i.test(m[1]!)) return true
      // **포스트카드 리드 캡션은 본문이다.** `postcard-<슬러그>.en.jpg` 바로 앞에 둔 그림의
      // 캡션은 사진 라벨이 아니라 그 글의 도입 산문이다("Jupiter is a stormy planet… a giant,
      // wild storm that has been raging for more than 300 years"). 사이트 전수에서 포스트카드는
      // 5편뿐이고 그중 8낱말 넘는 캡션을 단 것은 정확히 3편(jupiter·mars·mercury) —
      // **오탐 0 · 누락 0**. 이 한 줄이 `all-about-jupiter` 를 96어 → 130어로 올려 창 안에 넣는다.
      //
      // ⚠️ **원본 HTML 위치로 봐야 한다.** 이 배열은 `<p>` 만 담고 있어 그 사이의 `<img>` 가
      //   없다 — 앞선 `<p>` 들만 이어 붙여 찾으면 포스트카드를 영영 못 만난다.
      const at = m.index ?? 0
      return /postcard-[a-z0-9-]+\.en\.jpe?g/i.test(h.slice(Math.max(0, at - 400), at))
    })
    .map((m) =>
      m[2]!
        .replace(HTML_TAG, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
        .replace(/&#x([0-9a-f]+);/gi, (_, d: string) => String.fromCharCode(parseInt(d, 16)))
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((t) => t.split(/\s+/).filter(Boolean).length >= 8)
}

/** 쪽 제목. `<h1>` 이 없으면 `<title>` 에서 사이트명을 떼고 쓴다. */
export function spacePlaceTitle(html: string): string | null {
  const h1 = String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
  const t = (h1 ?? String(html).match(/<title>([^<]+)<\/title>/i)?.[1] ?? '')
    // 본문과 같은 규칙을 쓴다 — 제목에도 낱말 풀이 `<span>` 이 붙을 수 있고, 그때
    // `<[^>]*>` 면 속성값이 제목으로 샌다.
    .replace(HTML_TAG, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\|?\s*NASA Space Place.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  return t || null
}

export async function ingestSpacePlaceArticle(itemUrl: string): Promise<RawArticle> {
  const slug = itemUrl.match(/spaceplace\.nasa\.gov\/([a-z0-9-]+)\//i)?.[1]
  if (!slug) throw new Error(`Space Place URL 에서 slug 를 못 읽었다: ${itemUrl}`)

  const res = await fetchWithTimeout(itemUrl)
  if (!res.ok) throw new Error(`Space Place fetch failed: ${res.status} ${itemUrl}`)
  const html = await res.text()

  const paras = spacePlaceParagraphs(html)
  const content = paras.join('\n\n')
  if (content.length < 200) {
    throw new Error(`Space Place 본문이 너무 짧다: ${content.length}자 ${itemUrl}`)
  }

  return {
    source: 'space_place',
    source_id: `space_place:${slug}`,
    source_url: itemUrl,
    title: spacePlaceTitle(html) ?? titleFromSlug(slug),
    author: 'NASA Space Place',
    language: 'en',
    license: 'PD-Government',
    published_at: null,
    content,
    // 어린이·청소년용으로 쓰인 글이지만 등급이 붙어 있지 않다 — analyze 가 판정한다.
    estimated_cefr: null,
    fetched_at: new Date(),
  }
}
