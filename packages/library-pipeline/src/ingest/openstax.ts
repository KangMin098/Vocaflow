// packages/library-pipeline/src/ingest/openstax.ts
// LCP v2.0 Phase 17 — OpenStax Textbooks ingester
//
// OpenStax (Rice University) — CC BY 4.0 무료 교과서. 챕터 구조 명확 + 학습 친화적.
//
// API 흐름:
//   1) 메타 + TOC: https://openstax.org/apps/cms/api/v2/pages/?type=books.Book&fields=...&slug=<slug>
//      → 페이지 1개 (id) 획득
//   2) 상세: https://openstax.org/apps/cms/api/v2/pages/<id>
//      → book_state, table_of_contents 트리, language, license_name 등 획득
//   3) 챕터 HTML: https://openstax.org/books/<slug>/pages/<page-slug>
//      → fetch → htmlToPlainText 으로 본문 추출 (페이지 단위)
//
// source_id 형식: book slug (예: 'college-physics-2e', 'introduction-business')
//
// 라이선스: 모든 OpenStax 교과서는 CC BY 4.0 — 한국 저작권 안전 (저자 사후 70년 무관).
// admin_enqueue_book 의 license 파라미터로 'CC-BY-4.0' 전달.

import type { RawBook } from '../types'

const OS_CMS = 'https://openstax.org/apps/cms/api/v2/pages'
const OS_BOOK_URL = (slug: string): string => `https://openstax.org/books/${slug}`
const OS_PAGE_URL = (slug: string, pageSlug: string): string =>
  `https://openstax.org/books/${slug}/pages/${pageSlug}`
const USER_AGENT = 'Vocaflow-LCP/2.0 (research; https://vocaflow.app)'

const MAX_CHAPTERS = 30 // 안전 상한 (대부분 OpenStax 책은 15~25 챕터)
const FETCH_TIMEOUT_MS = 20_000

interface CmsListResponse {
  items?: Array<{ id: number; title: string; meta?: { slug?: string } }>
}

interface CmsPageDetail {
  id: number
  title: string
  meta?: { slug?: string }
  language?: string
  license_name?: string
  license_version?: string
  book_state?: string
  table_of_contents?: TocNode[] | { contents?: TocNode[] }
  /** 일부 응답은 cnx_archive_url 포함 — 본문 fetch 폴백 */
  cnx_archive_url?: string
  authors?: Array<{ value?: { name?: string } }> | string
}

interface TocNode {
  id?: string
  slug?: string
  title?: string
  type?: string // 'chapter' / 'page' / 'unit' 등
  contents?: TocNode[]
}

/**
 * OpenStax book slug 로 raw 본문 + 메타 fetch.
 *
 * @param slug OpenStax 책 슬러그 (예: 'college-physics-2e')
 * @returns RawBook (Stage S3 NORMALIZE 입력)
 */
export async function ingestFromOpenStax(slug: string): Promise<RawBook> {
  const cleanSlug = slug.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]*$/.test(cleanSlug)) {
    throw new Error(`Invalid OpenStax slug: ${slug}`)
  }

  // 1. 메타 검색 (slug → page id)
  const listUrl = `${OS_CMS}/?type=books.Book&slug=${encodeURIComponent(cleanSlug)}&fields=title,slug,language,license_name,book_state`
  const listRes = await fetchWithTimeout(listUrl)
  if (!listRes.ok) {
    throw new Error(`OpenStax meta search failed: ${listRes.status}`)
  }
  const listJson = (await listRes.json()) as CmsListResponse
  const item = listJson.items?.[0]
  if (!item) {
    throw new Error(`OpenStax book not found: ${cleanSlug}`)
  }

  // 2. 상세 (table_of_contents 포함)
  const detailUrl = `${OS_CMS}/${item.id}/`
  const detailRes = await fetchWithTimeout(detailUrl)
  if (!detailRes.ok) {
    throw new Error(`OpenStax detail fetch failed: ${detailRes.status}`)
  }
  const detail = (await detailRes.json()) as CmsPageDetail

  // 3. TOC 평탄화 — chapter / page 노드만 추출
  const tocRoot: TocNode[] = Array.isArray(detail.table_of_contents)
    ? detail.table_of_contents
    : detail.table_of_contents?.contents ?? []
  const chapters = flattenToc(tocRoot, MAX_CHAPTERS)
  if (chapters.length === 0) {
    throw new Error(`OpenStax TOC empty: ${cleanSlug}`)
  }

  // 4. 각 챕터 HTML fetch → plain text
  const pages: { title: string; content: string }[] = []
  for (const ch of chapters) {
    if (!ch.slug) continue
    try {
      const pageHtml = await fetchPageHtml(cleanSlug, ch.slug)
      if (pageHtml) {
        const plain = htmlToPlainText(pageHtml)
        if (plain.trim().length > 200) {
          pages.push({ title: ch.title ?? ch.slug, content: plain })
        }
      }
    } catch (err) {
      console.warn(`[openstax] page failed: ${cleanSlug}/${ch.slug}`, err)
    }
  }

  if (pages.length === 0) {
    throw new Error(`OpenStax ingest empty: 0 fetched pages for ${cleanSlug}`)
  }

  // 5. 합본 — Chapter N. <title> 헤더로 join (segmenter chapter 분리기 호환)
  const joined = pages
    .map((p, i) => `\n\n\nChapter ${i + 1}. ${p.title}\n\n${p.content.trim()}`)
    .join('\n\n')

  const license = detail.license_name
    ? formatLicense(detail.license_name, detail.license_version)
    : 'CC-BY-4.0'

  return {
    source: 'openstax',
    source_id: cleanSlug,
    source_url: OS_BOOK_URL(cleanSlug),
    title: item.title,
    author: 'OpenStax (Rice University)',
    language: detail.language ?? 'en',
    license,
    raw_content: joined,
    fetched_at: new Date(),
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function flattenToc(nodes: TocNode[], maxCount: number): TocNode[] {
  const out: TocNode[] = []
  const visit = (list: TocNode[]): void => {
    for (const n of list) {
      if (out.length >= maxCount) return
      // chapter / page 타입 (또는 type 미지정이지만 slug 있음) 채택
      const isChapter = n.type === 'chapter' || n.type === 'page' || !n.type
      if (isChapter && n.slug && n.title) {
        out.push(n)
      }
      if (n.contents && n.contents.length > 0 && out.length < maxCount) {
        visit(n.contents)
      }
    }
  }
  visit(nodes)
  return out
}

async function fetchPageHtml(slug: string, pageSlug: string): Promise<string | null> {
  const url = OS_PAGE_URL(slug, pageSlug)
  const res = await fetchWithTimeout(url, { Accept: 'text/html' })
  if (!res.ok) return null
  const html = await res.text()
  // OpenStax 페이지는 React SPA 가 hydrate 되지만 초기 HTML 에 본문 포함됨
  // <main id="main-content"> 또는 <div data-type="document"> 에 본문 위치
  return html
}

function formatLicense(name: string, version: string | undefined): string {
  // 'Creative Commons Attribution License' → 'CC-BY-4.0'
  const lower = name.toLowerCase()
  if (lower.includes('attribution') && !lower.includes('non')) {
    return version ? `CC-BY-${version}` : 'CC-BY-4.0'
  }
  if (lower.includes('attribution-noncommercial-sharealike')) {
    return version ? `CC-BY-NC-SA-${version}` : 'CC-BY-NC-SA-4.0'
  }
  return name
}

/**
 * OpenStax 페이지 HTML → plain text.
 * - <main id="main-content"> 또는 <div data-type="document"> 영역만 추출 시도
 * - script/style/nav/header/footer 제거
 * - heading → 빈 줄
 * - 외부 의존성 0
 */
function htmlToPlainText(html: string): string {
  let s = html

  // 1) 본문 영역만 추출 시도 (실패 시 전체 사용)
  const mainMatch =
    s.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ??
    s.match(/<div[^>]*data-type=["']document["'][^>]*>([\s\S]*?)<\/div>\s*<(?:footer|nav|aside|\/main)/i)
  if (mainMatch && mainMatch[1]) s = mainMatch[1]

  // 2) 명백한 chrome 제거
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
  s = s.replace(/<header\b[\s\S]*?<\/header>/gi, '')
  s = s.replace(/<footer\b[\s\S]*?<\/footer>/gi, '')
  s = s.replace(/<nav\b[\s\S]*?<\/nav>/gi, '')
  s = s.replace(/<aside\b[\s\S]*?<\/aside>/gi, '')

  // 3) OpenStax 특유 노이즈
  s = s.replace(/<figure\b[\s\S]*?<\/figure>/gi, '\n') // 이미지/캡션 제거 (대용량 + 비텍스트)
  s = s.replace(/<table\b[\s\S]*?<\/table>/gi, '\n')   // 표는 단어 추출 노이즈
  s = s.replace(/<math\b[\s\S]*?<\/math>/gi, '[수식]') // MathML 치환
  s = s.replace(/<(?:span|div)[^>]*class="[^"]*os-(?:learning-objective|caption|note-body)[^"]*"[^>]*>/gi, '')

  // 4) 줄바꿈 변환
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/(?:p|h[1-6]|li|tr|div|section|article)>/gi, '\n')
  s = s.replace(/<h([1-6])[^>]*>/gi, '\n\n')

  // 5) 잔여 태그 strip
  s = s.replace(/<[^>]+>/g, '')

  // 6) entities
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))

  // 7) 공백 정리
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ')
  return s.trim()
}

async function fetchWithTimeout(
  url: string,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        ...extraHeaders,
      },
    })
  } finally {
    clearTimeout(timer)
  }
}
