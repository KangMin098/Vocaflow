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
 * 본문 문단만 뽑는다 — **발췌기가 문단 배열을 받기 때문에** 이어붙이지 않고 배열로 돌려준다.
 *
 * ⚠️ 8낱말 미만은 캡션·버튼이라 뺀다. 안 빼면 "More about this" 같은 조각이
 *   문단으로 세어져 발췌 경계가 엉뚱한 데 생긴다.
 */
export function spacePlaceParagraphs(html: string): string[] {
  const h = String(html)
    .replace(/<head[\s\S]*?<\/head>/i, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
  return [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) =>
      m[1]!
        .replace(/<[^>]*>/g, ' ')
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
    .replace(/<[^>]*>/g, ' ')
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
