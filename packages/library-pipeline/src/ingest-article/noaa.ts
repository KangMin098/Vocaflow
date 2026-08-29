// packages/library-pipeline/src/ingest-article/noaa.ts
// ACP §18 — NOAA Climate.gov ingester.
//
// NOAA Climate.gov = 미국 해양대기청 기후 교육 포털. PD(US Gov) 기후과학 explainer 산문(B2-C1).
//   신규 도메인 climate-science(대기 CO₂·해양 열용량·지구온난화·빙하) — **CSAT 최빈출 주제**.
//   USGS(지질·재해)·NASA(우주)와 구별. 접근형 과학 저널리즘.
// 라이선스: Public Domain (US Government · NOAA 저작물) → license_class=public_domain → 발행 허용.
// register: expository — 기후·과학 설명문 (CSAT 과학 지문 유형).
// 서버렌더 Drupal HTML. 의존성 0 정규식.
//
// 리스트: /news-features/understanding-climate · /features · /event-tracker (anchor 텍스트=제목).
// 본문:  node__content 컨테이너 → field-media-caption(차트 캡션) 제거 + References 인용목록 절단.
// source_id: "noaa:<slug>"

import type { RawArticle } from '../types-article'

import { decodeEntities, extractFirst, fetchWithTimeout, htmlToPlainText, safeDate, stripTags } from './_helpers'
import { applyArticleCurationSpec, type ArticleScore } from './_curation-spec'

const SITE = 'https://www.climate.gov'

export const NOAA_FEEDS: Array<{ id: string; label: string; path: string }> = [
  { id: 'understanding-climate', label: 'Understanding Climate (NOAA)', path: '/news-features/understanding-climate' },
  { id: 'features', label: 'Features (NOAA)', path: '/news-features/features' },
]

export interface NoaaListItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
  score?: ArticleScore
}

/** class 정규식 매칭 모든 <div> inner HTML 깊이 추적 슬라이스(중첩 div 안전). */
function sliceAllDivByClass(html: string, classRe: RegExp): string[] {
  const openRe = /<div\b([^>]*)>/gi
  const out: string[] = []
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
        if (depth === 0) {
          out.push(html.slice(start, w.index))
          break
        }
      } else depth++
    }
  }
  return out
}

/** NOAA 기사 본문 HTML → 산문. field--name-body(본문 필드만·관련링크 region 제외) → 캡션/References 제거. */
function extractProse(html: string): string {
  // field--name-body 슬라이스 — node__content 는 관련링크 region 포함해 오염.
  //
  // ⚠️ 원래 **가장 긴 HTML 조각**을 본문으로 골랐다. 그게 2026-08-30 에 NOAA 적재를
  //   211편 중 25편으로 떨어뜨린 원인이다. climate.gov 의 모든 기사 페이지에는
  //   `field--name-body` 클래스를 단 **11,345자짜리 공통 보일러플레이트 div**가 있고
  //   그 안에는 산문이 한 글자도 없다. 본문이 그보다 짧은 기사에서는 이 껍데기가 이겨
  //   `extractProse` 가 **정확히 0 words** 를 돌려주고 "body too short" 로 버려졌다.
  //
  //     understanding-cop                 슬라이스 [11345, 8343, 361] → 최장=껍데기 → 0 words
  //     climate-change-global-temperature 슬라이스 [11345, 21113, 361] → 최장=본문  → 1,579 words
  //
  //   같은 코드가 어떤 기사는 되고 어떤 기사는 안 되니 "일부 페이지가 이상하다" 로 보였다.
  //   길이가 아니라 **산문 양**으로 고르면 두 경우가 같은 이유로 맞는다.
  const bodies = sliceAllDivByClass(html, /\bfield--name-body\b/)
  const scored = bodies
    .map((b) => ({ html: b, words: htmlToPlainText(b).split(/\s+/).filter(Boolean).length }))
    .sort((a, b) => b.words - a.words)
  // 어느 슬라이스에도 산문이 없으면 문서 전체로 물러선다(기존 폴백 유지).
  let body = (scored[0]?.words ?? 0) > 0 ? scored[0]!.html : html
  // 차트/미디어 캡션 제거 (Drupal field-media-caption — 그래프 설명, 본문 아님).
  body = body.replace(/<div[^>]*class="[^"]*field--name-field-media-caption[^"]*"[\s\S]*?<\/div>/gi, '\n')
  body = body.replace(/<figcaption[\s\S]*?<\/figcaption>/gi, '\n')
  // 공유·관련·사이드바 트레일러 절단.
  body = body.replace(
    /<div[^>]*class="[^"]*(?:field--name-field-related|addtoany|social-share|region-sidebar)[^"]*"[\s\S]*$/i,
    '',
  )

  let text = htmlToPlainText(body)
  // References/인용목록 절단 (학술 참고문헌 — 산문 아님. 자체 라인 heading).
  text = text.replace(
    /\n[ \t]*(?:References?|Bibliography|Sources|Notes|Further Reading|Related Content|More information)[ \t]*\n[\s\S]*$/i,
    '',
  )
  // 후행 관련-기사 링크 제거 — body 필드에 임베드된 관련 링크(제목만·문장부호 없음)는
  //   문장으로 끝나는 산문과 달리 짧고 마침표가 없음. 그런 후행 라인만 최대 6줄 제거(산문 보존).
  const lines = text.split('\n')
  for (let i = 0; i < 6 && lines.length > 3; i++) {
    const last = lines[lines.length - 1]!.trim()
    if (last.length === 0) {
      lines.pop()
      continue
    }
    const wordCount = last.split(/\s+/).filter(Boolean).length
    const endsSentence = /[.!?:”"')\]]$/.test(last)
    if (wordCount <= 12 && !endsSentence) lines.pop()
    else break
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * 목록 URL 1페이지분. Drupal 뷰라 `?page=N`(0-index)으로 넘어간다 — 실측 2026-08-30:
 * base·page=1·page=2 의 HTML 해시가 모두 달랐다. 첫 페이지만 읽으면 최신 ~13편이 상한이고,
 * 그걸 다 담는 순간 "새 것 0" 이 떠서 **소진처럼 보인다**(위키미디어와 같은 조용한 상한).
 */
export function buildNoaaListUrl(feedId: string, page: number = 0): string {
  const feed = NOAA_FEEDS.find((f) => f.id === feedId) ?? NOAA_FEEDS[0]!
  return page > 0 ? `${SITE}${feed.path}?page=${page}` : `${SITE}${feed.path}`
}

/** NOAA Climate.gov 리스트 → 항목. anchor 텍스트가 제목(USGS 와 달리 직접 페어). */
export async function listNoaaFeed(
  feedId: string = 'understanding-climate',
  limit: number = 24,
): Promise<NoaaListItem[]> {
  return listNoaaFeedPage(feedId, limit, 0).then((r) => r.items)
}

/** 한 페이지 — 항목이 하나도 없을 때를 끝으로 본다(HTML 목록엔 토큰이 없다). */
export async function listNoaaFeedPage(
  feedId: string = 'understanding-climate',
  limit: number = 24,
  page: number = 0,
): Promise<{ items: NoaaListItem[]; cont: number | null }> {
  const feed = NOAA_FEEDS.find((f) => f.id === feedId) ?? NOAA_FEEDS[0]!
  const res = await fetchWithTimeout(buildNoaaListUrl(feedId, page), { accept: 'text/html' })
  if (!res.ok) throw new Error(`NOAA list fetch failed: ${res.status} ${feed.path}`)
  const html = await res.text()

  // /news-features/<section>/<slug> anchor(href+제목) 페어 추출.
  const anchorRe = /<a[^>]+href="(\/news-features\/[a-z0-9-]+\/[a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/gi
  const seen = new Set<string>()
  const raw: NoaaListItem[] = []
  let m: RegExpExecArray | null
  while ((m = anchorRe.exec(html)) !== null) {
    const href = m[1]!
    const slug = href.split('/').pop()!
    if (seen.has(slug)) continue
    const title = decodeEntities(stripTags(m[2]!)).replace(/\s+/g, ' ').trim()
    // anchor 텍스트가 실 제목인 것만 (영문자 시작·8자↑ — nav/아이콘 링크 제외).
    if (title.length < 8 || !/^[A-Za-z]/.test(title)) continue
    seen.add(slug)
    raw.push({
      source_id: `noaa:${slug}`,
      title,
      url: `${SITE}${href}`,
      published_at: null, // 리스트에 발행일 없음 — 기사 fetch 시 확정
      description: title, // 리스트 teaser 부재 → 제목으로 대체(minDescriptionLen 낮춤)
    })
  }

  return {
    items: applyArticleCurationSpec(raw.slice(0, limit * 2), 'noaa', feedId),
    cont: raw.length > 0 ? page + 1 : null,
  }
}

/** www.climate.gov/news-features/<section>/<slug> URL → RawArticle. */
export async function ingestNoaaArticle(itemUrl: string): Promise<RawArticle> {
  const url = itemUrl.startsWith('http')
    ? itemUrl
    : `${SITE}${itemUrl.startsWith('/') ? '' : '/'}${itemUrl}`
  const slug = url.match(/\/news-features\/[a-z0-9-]+\/([a-z0-9-]+)/i)?.[1]
  if (!slug) throw new Error(`NOAA: slug 추출 실패 (${itemUrl})`)

  const res = await fetchWithTimeout(url, { accept: 'text/html' })
  if (!res.ok) throw new Error(`NOAA fetch failed: ${res.status} ${url}`)
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
    throw new Error(`NOAA body too short: ${words} words (${slug})`)
  }

  return {
    source: 'noaa',
    source_id: `noaa:${slug}`,
    source_url: url,
    title: decodeEntities(stripTags(title)).replace(/\s+/g, ' ').trim(),
    author: 'NOAA Climate.gov',
    language: 'en',
    license: 'Public Domain (US Government)', // NOAA 저작물 = PD → license_class=public_domain → 발행 허용
    published_at: safeDate(publishedAt),
    content,
    estimated_cefr: null,
    audio_url: null,
    fetched_at: new Date(),
  }
}
