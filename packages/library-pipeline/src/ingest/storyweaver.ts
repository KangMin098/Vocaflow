// packages/library-pipeline/src/ingest/storyweaver.ts
// LCP — StoryWeaver (Pratham Books) ingester
//
// CC BY 4.0 다국어 그림책. API: /api/v1/stories/{id|slug}/read (server-side fetch 가능).
// 그림책 구조: FrontCoverPage | StoryPage×N | BackCoverPage.
//   - StoryPage = 1 페이지 = 1 문단(짧은 문장) + 1 삽화(coverImage.sizes 최대).
//   - 본문 = StoryPage 텍스트 '\n\n' join → 문단 인덱스 == 페이지 순서.
//   - illustrations = 페이지별 삽화 URL (링크), idx 가 본문 문단과 정합.
//   - audioPath = readalong mp3 (단일 스트림 낭독 — 워크스페이스 보이스).
// UA 필수 (빈 UA → 403). 텍스트는 content div 만 (삽화 div·스크립트·페이지번호 제거).

import type { RawBook, BookIllustration } from '../types'

const UA = 'Vocaflow-LCP-StoryWeaver/1.0 (education/research)'
const API = 'https://storyweaver.org.in/api/v1'

interface SWSize {
  url: string
  width: number
  height: number
}
interface SWPage {
  pageType: string
  html: string
  coverImage?: { sizes?: SWSize[] } | null
}
interface SWRead {
  ok?: boolean
  data?: {
    pages?: SWPage[]
    authors?: Array<{ name: string }>
    audioPath?: string | null
    isAudio?: boolean
    level?: string | null
    slug?: string
    language?: string
  }
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&#39;': "'",
  '&apos;': "'",
  '&quot;': '"',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
}

function decodeEntities(s: string): string {
  return s.replace(/&#?\w+;/g, (m) => {
    const named = ENTITIES[m]
    if (named) return named
    const dec = m.match(/^&#(\d+);$/)
    if (dec?.[1]) return String.fromCodePoint(Number(dec[1]))
    const hex = m.match(/^&#x([0-9a-fA-F]+);$/)
    if (hex?.[1]) return String.fromCodePoint(parseInt(hex[1], 16))
    return ' '
  })
}

/** StoryWeaver 페이지 html → 순수 본문 텍스트 (삽화 div·스크립트·페이지번호 제거). */
function cleanPageText(html: string): string {
  let t = html
  t = t.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  t = t.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  // 삽화 div (data-*-src 속성에 이미지 URL) 제거 — 본문 텍스트는 content div 에만
  t = t.replace(/<div[^>]*\billustration\b[^>]*>[\s\S]*?<\/div>/gi, ' ')
  t = t.replace(/<[^>]+>/g, ' ')
  // jQuery 잔여 ($(document).ready(...) 류) 제거
  t = t.replace(/\$\(document[\s\S]*$/g, ' ')
  t = decodeEntities(t)
  // 페이지 번호 마커 "N/M"
  t = t.replace(/\b\d{1,3}\s*\/\s*\d{1,3}\b/g, ' ')
  return t.replace(/\s+/g, ' ').trim()
}

/** coverImage.sizes 최대 크기 URL (마지막 = 최대). */
function largestImage(page: SWPage): string | null {
  const sizes = page.coverImage?.sizes
  if (!Array.isArray(sizes) || sizes.length === 0) return null
  const u = sizes[sizes.length - 1]?.url
  return typeof u === 'string' && /^https?:\/\//.test(u) ? u : null
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/**
 * StoryWeaver story 1권 ingest.
 * @param sourceId story id (예: '2') 또는 slug (예: '2-smile-please')
 */
export async function ingestFromStoryWeaver(sourceId: string): Promise<RawBook> {
  const key = sourceId.trim().replace(/^storyweaver:/, '')
  if (!key) throw new Error('StoryWeaver: empty source_id')

  const url = `${API}/stories/${encodeURIComponent(key)}/read`
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`StoryWeaver fetch failed: ${res.status} ${url}`)

  const json = (await res.json()) as SWRead
  const d = json?.data
  if (!d || !Array.isArray(d.pages) || d.pages.length === 0) {
    throw new Error(`StoryWeaver: unexpected response shape for ${key}`)
  }

  const front = d.pages.find((p) => p.pageType === 'FrontCoverPage') ?? null
  const back = d.pages.find((p) => p.pageType === 'BackCoverPage') ?? null

  // 제목 — back_cover_title span 우선, fallback front cover 첫 줄
  let title = ''
  if (back) {
    const m = back.html.match(/back_cover_title[^>]*>([\s\S]*?)<\/span>/i)
    if (m?.[1]) title = stripTags(m[1])
  }
  if (!title && front) {
    title = cleanPageText(front.html).replace(/\s*Author:.*$/i, '').trim()
  }
  if (!title) title = `StoryWeaver ${key}`

  // 줄거리(synopsis) — back cover
  let description: string | undefined
  if (back) {
    const m = back.html.match(/synopsis[^>]*>([\s\S]*?)<\/p>/i)
    if (m?.[1]) {
      const syn = stripTags(m[1])
      if (syn) description = syn
    }
  }

  // 저자
  const author =
    Array.isArray(d.authors) && d.authors.length > 0
      ? d.authors.map((a) => a.name).filter(Boolean).join(', ')
      : 'Pratham Books'

  // 본문 + 삽화 — StoryPage 만 (페이지 순서 == 문단 idx)
  const story = d.pages.filter((p) => p.pageType === 'StoryPage')
  const paragraphs: string[] = []
  const illustrations: BookIllustration[] = []
  for (const p of story) {
    const text = cleanPageText(p.html)
    const img = largestImage(p)
    if (!text && !img) continue
    const idx = paragraphs.length
    // 삽화만 있고 텍스트 없는 페이지 → nbsp placeholder (idx 정합 유지)
    paragraphs.push(text || ' ')
    if (img) illustrations.push({ idx, url: img, ...(text ? { alt: text } : {}) })
  }
  if (paragraphs.length === 0) {
    throw new Error(`StoryWeaver: no story pages with content for ${key}`)
  }

  const raw_content = paragraphs.join('\n\n')

  // 표지 — front cover 삽화
  const cover_image_url = front ? largestImage(front) ?? undefined : undefined

  // 낭독 오디오 (readalong) — 단일 스트림
  const audio_url =
    d.isAudio && typeof d.audioPath === 'string' && /^https?:\/\//.test(d.audioPath)
      ? d.audioPath
      : undefined

  const slug = typeof d.slug === 'string' && d.slug ? d.slug : key

  return {
    source: 'storyweaver',
    source_id: key,
    source_url: `https://storyweaver.org.in/stories/${slug}`,
    title,
    author,
    language: 'en',
    license: 'CC BY 4.0',
    raw_content,
    fetched_at: new Date(),
    illustrations,
    ...(cover_image_url ? { cover_image_url } : {}),
    ...(audio_url ? { audio_url } : {}),
    ...(description ? { description } : {}),
  }
}
