// packages/library-pipeline/src/ingest-article/ocean-facts.ts
//
// **NOAA Ocean Service — Ocean Facts.** 한 물음에 한 편인 PD 설명글.
//
// ── 두 번 재고 두 번 다르게 판단했다 ─────────────────────────────────
// 2026-09-02 에 "중앙 439어 · 적중 0%" 로 재고 후보에서 뺐다. 그때는 쪽 전체를 통째로
// 세었고(`<main>`·`<article>` 이 없어 추출이 거칠었다) **그 어수는 상한**이라고 함께 적어 뒀다.
//
// 문단으로 다시 재니 완전히 다른 그림이었다(실측 `facts/tsunami.html`):
//
//     문단 0~4  정부 공통 배너 + 셧다운 안내 + weather.gov 안내   ← 전부 크롬
//     문단 5    사진 설명(32어)                                  ← 지문 아님
//     **문단 6    본문 112어**                                    ← 창(100~200) 안
//     문단 7    도표 캡션(8어)
//
// 크롬을 떼고 보니 본문은 112어였다 — 창(100~200) 한가운데다.
//
// ── ⚠️ 그런데 그건 **한 쪽을 보고 일반화한 것**이었다 (재측 2026-09-03) ──────
// 어댑터를 만들고 8쪽을 재 보니 tsunami 쪽이 **유난히 짧은** 쪽이었다:
//
//     어수  213 · 262 · 326 · 337 · 391 · 588 · 640 · 753     (tsunami 만 112)
//     FK    9.51 ~ 13.94  (중앙 ~11.4)
//     교육과정 밖  32 ~ 53.8%
//
// 즉 이 소스는 **중3 이상**이고 대부분 발췌가 필요하며,
// 어휘 가드에서도 상당수 떨어진다. 처음에 "발췌 없이 창에 드는 드문 소스" 라고
// 적었는데 **틀렸다** — 표본 하나로 소스를 판정한 것이 원인이다.
//
// ── 크롬을 자리로 떼지 않는다 ────────────────────────────────────────
// ⚠️ 배너 문단 수가 **때에 따라 바뀐다** — 셧다운 안내는 있을 때만 있다.
//   "앞 5문단을 버린다" 로 짜면 안내가 없는 날 본문 첫 문단이 잘린다.
//   그래서 **내용으로** 가른다.
//
// 라이선스: Public Domain (미 연방정부 저작물). nasa.gov 와 같은 계열이다.
// robots: `User-agent: * / Disallow:` 아래 `facts/` 는 허용.
// source_id: "ocean_facts:<slug>"

import type { RawArticle } from '../types-article'

import { fetchWithTimeout } from './_helpers'
import { applyArticleCurationSpec, type ArticleScore } from './_curation-spec'

const SITE = 'https://oceanservice.noaa.gov'

/** 목록은 주제별 분류 쪽에 링크로 있다. `facts/` 아래 129쪽을 실측했다. */
export const OCEAN_FACTS_FEEDS: Array<{ id: string; label: string; path: string }> = [
  { id: 'basics', label: 'Ocean Facts — 기초', path: '/facts/oceanfacts-basics.html' },
  { id: 'oceanlife', label: 'Ocean Facts — 바다 생물', path: '/facts/oceanfacts-oceanlife.html' },
  { id: 'ecosystems', label: 'Ocean Facts — 생태계', path: '/facts/oceanfacts-ecosystems.html' },
  { id: 'health', label: 'Ocean Facts — 바다 건강', path: '/facts/oceanfacts-health.html' },
]

export interface OceanFactsListItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
  score?: ArticleScore
}

export const oceanFactsUrl = (slug: string): string => `${SITE}/facts/${slug}.html`

/**
 * 정부 공통 크롬 — **자리가 아니라 내용으로 가른다.**
 * 셧다운 안내처럼 있다가 없어지는 문단이 있어 위치로 세면 어긋난다.
 */
const CHROME = [
  /official website of the United States government/i,
  /Official websites use \.gov/i,
  /Secure websites use HTTPS/i,
  /U\.S\. government is closed/i,
  /visit weather\.gov/i,
  /Here'?s how you know/i,
]

/** 목록 쪽에서 기사 slug 를 긁는다. `oceanfacts-*` 는 분류 쪽이라 글이 아니다. */
export function oceanFactsSlugsIn(html: string): string[] {
  const out = new Set<string>()
  for (const m of String(html).matchAll(/facts\/([a-z0-9_-]+)\.html/gi)) {
    const slug = m[1]!
    if (slug.startsWith('oceanfacts-')) continue
    out.add(slug)
  }
  return [...out]
}

/**
 * 본문 문단만. 크롬·캡션을 뺀 뒤 남는 것을 돌려준다.
 *
 * ⚠️ 12낱말 미만은 도표 캡션이라 뺀다(실측: "NOAA Deep-ocean Assessment … (DART)" 8어).
 *   8낱말로 두면 캡션이 문단으로 세어져 발췌 경계가 엉뚱한 데 생긴다.
 */
export function oceanFactsParagraphs(html: string): string[] {
  const h = String(html)
    .replace(/<head[\s\S]*?<\/head>/i, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<figcaption[\s\S]*?<\/figcaption>/gi, ' ')
  return [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) =>
      m[1]!
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
        .replace(/&#x([0-9a-f]+);/gi, (_, d: string) => String.fromCharCode(parseInt(d, 16)))
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((t) => t.split(/\s+/).filter(Boolean).length >= 12)
    .filter((t) => !CHROME.some((re) => re.test(t)))
}

export function oceanFactsTitle(html: string): string | null {
  const h1 = String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
  const t = (h1 ?? String(html).match(/<title>([^<]+)<\/title>/i)?.[1] ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s*\|\s*National Ocean Service.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  return t || null
}

export async function listOceanFactsFeed(
  feedId = 'basics',
  limit?: number
): Promise<OceanFactsListItem[]> {
  const feeds =
    feedId === 'all' ? OCEAN_FACTS_FEEDS : OCEAN_FACTS_FEEDS.filter((f) => f.id === feedId)
  if (!feeds.length) {
    throw new Error(
      `Ocean Facts 피드 '${feedId}' 를 모른다. 쓸 수 있는 것: all · ${OCEAN_FACTS_FEEDS.map((f) => f.id).join(' · ')}`
    )
  }
  const slugs = new Set<string>()
  for (const f of feeds) {
    const res = await fetchWithTimeout(`${SITE}${f.path}`)
    if (!res.ok) continue
    for (const s of oceanFactsSlugsIn(await res.text())) slugs.add(s)
  }
  if (!slugs.size) throw new Error('Ocean Facts 목록에서 기사 링크를 못 찾았다')

  const items: OceanFactsListItem[] = [...slugs].map((slug) => ({
    source_id: `ocean_facts:${slug}`,
    title: slug.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    url: oceanFactsUrl(slug),
    published_at: null, // 쪽에 발행일이 없다 — 지어내지 않는다
    description: '',
  }))
  return applyArticleCurationSpec(items.slice(0, limit ?? items.length), 'ocean_facts', feedId, {
    maxItems: limit,
  })
}

export async function ingestOceanFactsArticle(itemUrl: string): Promise<RawArticle> {
  const slug = itemUrl.match(/facts\/([a-z0-9_-]+)\.html/i)?.[1]
  if (!slug) throw new Error(`Ocean Facts URL 에서 slug 를 못 읽었다: ${itemUrl}`)

  const res = await fetchWithTimeout(itemUrl)
  if (!res.ok) throw new Error(`Ocean Facts fetch failed: ${res.status} ${itemUrl}`)
  const html = await res.text()

  const paras = oceanFactsParagraphs(html)
  const content = paras.join('\n\n')
  if (content.length < 200) {
    throw new Error(`Ocean Facts 본문이 너무 짧다: ${content.length}자 ${itemUrl}`)
  }

  return {
    source: 'ocean_facts',
    source_id: `ocean_facts:${slug}`,
    source_url: itemUrl,
    title: oceanFactsTitle(html) ?? slug.replace(/[_-]/g, ' '),
    author: 'NOAA National Ocean Service',
    language: 'en',
    license: 'PD-Government',
    published_at: null,
    content,
    estimated_cefr: null,
    fetched_at: new Date(),
  }
}
