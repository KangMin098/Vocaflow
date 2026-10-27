// packages/library-pipeline/src/ingest/storyweaver.ts
// LCP — StoryWeaver (Pratham Books) ingester
//
// 다국어 그림책(책마다 라이선스가 뒷장에 있다 — 대개 CC BY 4.0 이지만 **책마다 읽는다**).
// API: /api/v1/stories/{id|slug}/read (server-side fetch 가능).
// 그림책 구조: FrontCoverPage | StoryPage×N | BackCoverPage.
//   - StoryPage = 1 페이지 = 1 문단(짧은 문장) + 1 삽화(coverImage.sizes 최대).
//   - 본문 = StoryPage 텍스트 '\n\n' join → 문단 인덱스 == 페이지 순서.
//   - illustrations = 페이지별 삽화 URL (링크), idx 가 본문 문단과 정합.
//   - audioPath = readalong mp3 (단일 스트림 낭독 — 워크스페이스 보이스).
// UA 필수 (빈 UA → 403). 텍스트는 content div 만 (삽화 div·스크립트·페이지번호 제거).

import type { RawBook, BookIllustration } from '../types'
import { storyweaverLicense, storyweaverPageText } from '../ingest-article/storyweaver'

// StoryWeaver 는 Cloudflare 가 Node TLS(JA3) 핑거프린트를 403 차단 — 브라우저 UA 사용.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const API = 'https://storyweaver.org.in/api/v1'

/**
 * StoryWeaver JSON fetch — undici fetch 우선, 실패(Cloudflare 403/네트워크) 시 curl 폴백.
 *   Cloudflare 가 Node 의 TLS 핸드셰이크를 핑거프린트 차단하므로(curl 은 통과),
 *   admin/dev 서버 작업인 큐레이션 fetch 는 curl 로 폴백한다.
 */
async function swFetchJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
    if (res.ok) return await res.json()
  } catch {
    /* 네트워크/TLS 오류 → curl 폴백 */
  }
  try {
    const { execFile } = await import('child_process')
    const { promisify } = await import('util')
    const run = promisify(execFile)
    const { stdout } = await run(
      'curl',
      ['-s', '--max-time', '30', '-H', `User-Agent: ${UA}`, '-H', 'Accept: application/json', url],
      { maxBuffer: 32 * 1024 * 1024 },
    )
    if (stdout && stdout.trim()) return JSON.parse(stdout)
    throw new Error('empty response')
  } catch (e) {
    throw new Error(
      `StoryWeaver fetch failed (fetch blocked + curl fallback): ${
        e instanceof Error ? e.message : String(e)
      } — ${url}`,
    )
  }
}

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

/**
 * 책 한 권의 라이선스 — 본문(StoryPage)이 아닌 페이지(뒤표지·크레딧)의 「Released under …」 문장에서만 읽는다.
 *
 * ⚠️ 2026-06-14 도입 때부터 이 적재기는 모든 책을 'CC BY 4.0' 으로 **하드코딩**했다 — 책별 근거 없이
 *    발행 20권이 전부 CC BY 4.0 표시를 받았다(2026-10-27 감사). ACP 기사 적재기의 파서를 그대로 쓴다.
 * 못 읽거나(뒷장 없음·문장 없음) 서로 다른 라이선스 문장이 둘 이상이면(예: 삽화만 다른 조건) null —
 * 짐작해서 허용 라이선스를 붙이지 않는다. 형식은 기존 도서 표기('CC BY 4.0', 'CC BY-NC 4.0')로 맞춘다.
 */
export function storyweaverBookLicense(pages: ReadonlyArray<{ pageType: string; html?: string | null }>): string | null {
  const back = pages
    .filter((p) => p.pageType !== 'StoryPage')
    .map((p) => storyweaverPageText(p.html ?? ''))
    .join(' ')
  if (!back.trim()) return null
  const found = new Set<string>()
  for (const m of back.matchAll(/Released under.{0,40}?licen[cs]e/gi)) {
    const one = storyweaverLicense(m[0])
    if (!one) return null
    found.add(one)
  }
  if (found.size !== 1) return null
  const [label] = [...found] // 'CC-BY-4.0' · 'CC-BY-NC-SA-4.0'
  const v = label!.match(/-(\d[\d.]*)$/)?.[1]
  const kind = label!.replace(/-\d[\d.]*$/, '').replace(/^CC-BY/, 'CC BY')
  return v ? `${kind} ${v}` : kind
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
  const json = (await swFetchJson(url)) as SWRead
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

  // 라이선스를 책에서 못 읽으면 적재하지 않는다 — 수집 오류로 멈춰 검수로 넘긴다(허용으로 채우지 않는다).
  const license = storyweaverBookLicense(d.pages)
  if (!license) {
    throw new Error(`StoryWeaver: 라이선스를 책에서 읽지 못했다(뒷장 문장 없음·상충) — 검수 필요: ${key}`)
  }

  return {
    source: 'storyweaver',
    source_id: key,
    source_url: `https://storyweaver.org.in/stories/${slug}`,
    title,
    author,
    language: 'en',
    license,
    raw_content,
    fetched_at: new Date(),
    illustrations,
    ...(cover_image_url ? { cover_image_url } : {}),
    ...(audio_url ? { audio_url } : {}),
    ...(description ? { description } : {}),
  }
}
