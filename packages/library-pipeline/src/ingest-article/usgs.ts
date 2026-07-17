// packages/library-pipeline/src/ingest-article/usgs.ts
// ACP §18 — USGS (U.S. Geological Survey) ingester.
//
// USGS = 미국 지질조사국. PD(US Government) 지구과학·자연재해·지질 산문(B2 과학 저널리즘).
//   신규 도메인 — NASA(우주)·NIH(건강)과 구별되는 earth-science(지진·화산·허리케인·광물·산사태).
// 라이선스: Public Domain (US Government) → license_class=public_domain → 발행 허용 · 인용 자유.
// register: expository — 자연현상·과학 설명문 (CSAT 과학 지문 유형과 유사).
// 서버렌더 Drupal HTML. 의존성 0 정규식.
//
// 리스트: /news/featured-stories · /news/science-snippets (c-usgs-teaser 카드 → 제목+teaser).
// 본문:  node-main-body 컨테이너(intro + text-with-media 필드).
//        d-media-copyright(이미지 크레딧 반복) 제거 + related-*-tab/contacts/attributions/authors
//        트레일러 절단 + 맨 끝 "Learn More" 리소스 링크 블록 plain-text 컷.
// source_id: "usgs:<slug>"

import type { RawArticle } from '../types-article'

import { decodeEntities, extractFirst, fetchWithTimeout, htmlToPlainText, safeDate, stripTags } from './_helpers'
import { applyArticleCurationSpec, type ArticleScore } from './_curation-spec'

const SITE = 'https://www.usgs.gov'

export const USGS_FEEDS: Array<{ id: string; label: string; path: string }> = [
  { id: 'featured', label: 'Featured Stories (USGS)', path: '/news/featured-stories' },
  { id: 'snippets', label: 'Science Snippets (USGS)', path: '/news/science-snippets' },
]

export interface UsgsListItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
  score?: ArticleScore
}

/** class 정규식 매칭 첫 <div> inner HTML 을 깊이 추적 슬라이스(중첩 div 안전). */
function sliceDivByClass(html: string, classRe: RegExp): string | null {
  const openRe = /<div\b([^>]*)>/gi
  let m: RegExpExecArray | null
  while ((m = openRe.exec(html)) !== null) {
    const cls = m[1]!.match(/\bclass="([^"]*)"/i)?.[1] ?? ''
    if (!classRe.test(cls)) continue
    const start = openRe.lastIndex
    const walk = /<div\b[^>]*>|<\/div\s*>/gi
    walk.lastIndex = start
    let depth = 1
    let w: RegExpExecArray | null
    while ((w = walk.exec(html)) !== null) {
      if (w[0].startsWith('</')) {
        depth--
        if (depth === 0) return html.slice(start, w.index)
      } else depth++
    }
    return html.slice(start)
  }
  return null
}

/** USGS 기사 본문 HTML → 산문. node-main-body → 크레딧/트레일러 제거 → plain. */
function extractProse(html: string): string {
  let body = sliceDivByClass(html, /\bnode-main-body\b/) ?? html
  // 이미지 크레딧 반복 블록 제거 (본문 중간에도 등장 — 각 이미지 뒤 "Sources/Usage: Public Domain...").
  body = body.replace(/<div[^>]*class="[^"]*d-media-copyright[^"]*"[\s\S]*?<\/div>/gi, '\n')
  // 관련 링크·연락처·기여자 트레일러 절단 (본문 이후 — 첫 트레일러부터 끝까지).
  body = body.replace(/<div[^>]*class="[^"]*paragraph--type--(?:related-[a-z-]+|contacts)[^"]*"[\s\S]*$/i, '')
  body = body.replace(/<div[^>]*class="[^"]*field--name--field-(?:attributions|authors)[^"]*"[\s\S]*$/i, '')
  body = body.replace(/<figcaption[\s\S]*?<\/figcaption>/gi, '\n')

  let text = htmlToPlainText(body)
  // 이미지 크레딧 방탄 catch-all — 기사마다 컨테이너 class 가 달라(d-media-copyright 외) HTML
  //   스트립을 빠져나가는 경우가 있어, 크레딧 고정 텍스트("Sources/Usage:")로 라인 단위 제거.
  text = text.replace(/^[ \t]*Sources\/Usage:.*$/gim, '')
  // 태그 불문 plain-text 컷 — 맨 끝 리소스/링크 블록(자체 라인 heading, <a>·<strong> 등 다양).
  text = text.replace(
    /\n[ \t]*(?:Learn More|More Information|Related Content|See Also|Additional Resources|Further Reading|Get Our News)[ \t]*\n[\s\S]*$/i,
    '',
  )
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

/** USGS 카드 리스트(c-usgs-teaser) → 항목. featured/snippets 공용(동일 Drupal teaser 뷰). */
export async function listUsgsFeed(
  feedId: string = 'featured',
  limit: number = 24,
): Promise<UsgsListItem[]> {
  const feed = USGS_FEEDS.find((f) => f.id === feedId) ?? USGS_FEEDS[0]!
  const res = await fetchWithTimeout(`${SITE}${feed.path}`, { accept: 'text/html' })
  if (!res.ok) throw new Error(`USGS list fetch failed: ${res.status} ${feed.path}`)
  const html = await res.text()

  // c-usgs-teaser 컨테이너로 카드 분할 → 각 카드에서 slug/제목/teaser 추출.
  const cards = html.split(/<div class="[^"]*c-usgs-teaser/).slice(1)
  const seen = new Set<string>()
  const raw: UsgsListItem[] = []
  for (const card of cards) {
    const href = card.match(/\/news\/(?:featured-story|science-snippet)\/[a-z0-9-]+/i)?.[0]
    if (!href) continue
    const slug = href.split('/').pop()!
    if (slug === 'feed' || seen.has(slug)) continue

    const titleRaw = card.match(/<h[1-5][^>]*class="[^"]*\btitle\b[^"]*"[^>]*>([\s\S]*?)<\/h[1-5]>/i)?.[1]
    if (!titleRaw) continue
    const title = decodeEntities(stripTags(titleRaw)).replace(/\s+/g, ' ').trim()
    // 제목이 영문자로 시작하는 실 스토리만 (네비/플레이스홀더 제거).
    if (!title || !/^[A-Za-z]/.test(title)) continue

    const teaserRaw =
      card.match(/<div class="[^"]*d-teaser-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
      card.match(/<p[^>]*>([\s\S]{30,}?)<\/p>/i)?.[1] ??
      ''
    const description = decodeEntities(stripTags(teaserRaw)).replace(/\s+/g, ' ').trim()

    seen.add(slug)
    raw.push({
      source_id: `usgs:${slug}`,
      title,
      url: `${SITE}${href}`,
      published_at: null, // 리스트에 발행일 없음 — 기사 fetch 시 확정
      description,
    })
  }

  return applyArticleCurationSpec(raw.slice(0, limit * 2), 'usgs', feedId)
}

/** www.usgs.gov/news/featured-story|science-snippet/<slug> URL → RawArticle. */
export async function ingestUsgsArticle(itemUrl: string): Promise<RawArticle> {
  const url = itemUrl.startsWith('http')
    ? itemUrl
    : `${SITE}${itemUrl.startsWith('/') ? '' : '/'}${itemUrl}`
  const slug = url.match(/\/news\/(?:featured-story|science-snippet)\/([a-z0-9-]+)/i)?.[1]
  if (!slug) throw new Error(`USGS: slug 추출 실패 (${itemUrl})`)

  const res = await fetchWithTimeout(url, { accept: 'text/html' })
  if (!res.ok) throw new Error(`USGS fetch failed: ${res.status} ${url}`)
  const html = await res.text()

  const title =
    extractFirst(html, [
      /<meta\s+property="og:title"\s+content="([^"]+)"/i,
      /<h1[^>]*>([\s\S]*?)<\/h1>/i,
      /<title>([^<|]+)/i,
    ]) ?? '(제목 미상)'
  const publishedAt = extractFirst(html, [
    /<meta\s+property="article:published_time"\s+content="([^"]+)"/i,
    /<meta\s+name="date"\s+content="([^"]+)"/i,
    /<time[^>]+datetime="([^"]+)"/i,
  ])

  const content = extractProse(html)
  const words = content.trim().split(/\s+/).filter(Boolean).length
  if (words < 200) {
    throw new Error(`USGS body too short: ${words} words (${slug})`)
  }

  return {
    source: 'usgs',
    source_id: `usgs:${slug}`,
    source_url: url,
    title: decodeEntities(stripTags(title)).replace(/\s+/g, ' ').trim(),
    author: 'U.S. Geological Survey',
    language: 'en',
    license: 'Public Domain (US Government)', // PD US Gov → license_class=public_domain → 발행 허용
    published_at: safeDate(publishedAt),
    content,
    estimated_cefr: null,
    audio_url: null,
    fetched_at: new Date(),
  }
}
