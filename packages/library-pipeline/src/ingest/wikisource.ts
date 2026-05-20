// packages/library-pipeline/src/ingest/wikisource.ts
// LCP v2.0 — Wikisource (English) ingester
//
// Wikisource 는 자유 라이선스 1차 문서 / 문학 작품 저장소.
//   - 대부분 PD (저자 사후 70년 경과) — 라이선스 기본 'PD'
//   - Wikibooks 와 동일하게 MediaWiki API 사용 (en.wikisource.org)
//   - 책 1권 = 상위 페이지 + sub-page 트리 (예: "Pride_and_Prejudice" + "Pride_and_Prejudice/Chapter_1" ...)
//   - 저자: 상위 페이지의 첫 표/박스 (header template) 에서 추출 시도 →
//          실패 시 'Wikisource contributors' fallback (kr_safe 트리거는 사후 70년 룰만 사용)
//
// source_id 형식:
//   "Pride_and_Prejudice"                  — 상위 페이지 + sub-page 자동 수집
//   "Pride_and_Prejudice/Chapter_1"        — 단일 sub-page 만
//
// 호출 패턴:
//   const raw = await ingestFromWikisource('Pride_and_Prejudice')

import type { RawBook } from '../types'

const WS_API = 'https://en.wikisource.org/w/api.php'
const WS_PAGE_URL = (title: string): string =>
  `https://en.wikisource.org/wiki/${title}`
const USER_AGENT = 'Vocaflow-LCP/2.0 (research; https://vocaflow.app)'

const MAX_SUBPAGES = 100 // 안전 상한 (장편 소설은 60+ 챕터 일반적)
const FETCH_TIMEOUT_MS = 15_000

/**
 * Wikisource page title 로 raw 본문 + 메타 가져오기.
 * - source_id 가 '/' 포함 → sub-page 단독 fetch
 * - source_id 가 '/' 미포함 → 상위 페이지 + sub-page 트리 수집 후 합본
 *
 * @param pageTitle Wikisource page title (공백 → _, URL 인코딩 X)
 * @returns RawBook (Stage S3 NORMALIZE 입력)
 */
export async function ingestFromWikisource(pageTitle: string): Promise<RawBook> {
  const normalized = pageTitle.trim().replace(/\s+/g, '_')
  if (!/^[A-Za-z0-9_/().,:'\-]+$/.test(normalized)) {
    throw new Error(`Invalid Wikisource page title: ${pageTitle}`)
  }

  const isSubpage = normalized.includes('/')
  const rootTitle = isSubpage ? normalized.split('/')[0]! : normalized

  // 1. 상위 페이지 메타 (책 제목 + 저자 추출 시도)
  const meta = await fetchWikisourceMeta(rootTitle)
  if (!meta) {
    throw new Error(`Wikisource page not found: ${rootTitle}`)
  }

  // 2. 본문 수집
  const pages: { title: string; content: string }[] = []
  if (isSubpage) {
    const text = await fetchPagePlainText(normalized)
    if (text) pages.push({ title: stripPrefix(normalized, rootTitle), content: text })
  } else {
    // 상위 페이지 본문 (보통 짧은 머리말 + 챕터 링크 목록)
    const rootText = await fetchPagePlainText(normalized)
    if (rootText && rootText.trim().length > 200) {
      pages.push({ title: 'Front matter', content: rootText })
    }

    // sub-page 트리 수집
    const subpages = await listSubpages(normalized)
    for (const sub of subpages.slice(0, MAX_SUBPAGES)) {
      try {
        const text = await fetchPagePlainText(sub)
        if (text) {
          pages.push({ title: stripPrefix(sub, normalized), content: text })
        }
      } catch (err) {
        // 개별 sub-page 실패는 건너뜀 (전체 ingest 중단 X)
        console.warn(`[wikisource] sub-page failed: ${sub}`, err)
      }
    }
  }

  if (pages.length === 0) {
    throw new Error(`Wikisource ingest empty: ${normalized}`)
  }

  // 3. 합본 — Gutenberg/SE 단일 텍스트 모델과 호환되도록 chapter 헤더로 join
  //    segment-book 의 정규식 분리기가 "Chapter N" 패턴으로 분할.
  const joined = pages
    .map((p, i) => `\n\n\nChapter ${i + 1}. ${p.title}\n\n${p.content.trim()}`)
    .join('\n\n')

  return {
    source: 'wikisource',
    source_id: normalized,
    source_url: WS_PAGE_URL(normalized),
    title: meta.title,
    author: meta.author ?? 'Wikisource contributors',
    // author_*_year 미설정 — copyright_safe_in_kr 트리거는 70년 사후 룰만 사용하므로
    //   wikisource 행은 기본적으로 kr_safe=false. 대부분 PD 자료이므로 큐레이션 단계에서
    //   admin 이 "강제 게시" 결정. (별도 source 인지 룰 추가 권장.)
    language: 'en',
    license: 'PD',
    raw_content: joined,
    fetched_at: new Date(),
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

interface WikisourceMeta {
  title: string
  pageId: number
  author?: string
}

/**
 * Wikisource 상위 페이지 메타 — title + 저자(추출 가능 시).
 * MediaWiki `action=parse&prop=text` 의 HTML 에서 header template 인포박스를 정규식으로 파싱.
 */
async function fetchWikisourceMeta(title: string): Promise<WikisourceMeta | null> {
  const infoUrl = `${WS_API}?action=query&format=json&prop=info&titles=${encodeURIComponent(title)}&origin=*`
  const infoRes = await fetchWithTimeout(infoUrl)
  if (!infoRes.ok) throw new Error(`Wikisource meta fetch failed: ${infoRes.status}`)
  const infoJson = (await infoRes.json()) as {
    query?: { pages?: Record<string, { pageid?: number; title?: string; missing?: '' }> }
  }
  const pages = infoJson.query?.pages ?? {}
  const first = Object.values(pages)[0]
  if (!first || first.missing !== undefined || !first.pageid || !first.title) return null

  // header template 에서 저자 추출 시도 (실패해도 무시)
  let author: string | undefined
  try {
    const htmlUrl = `${WS_API}?action=parse&format=json&page=${encodeURIComponent(title)}&prop=text&disablelimitreport=1&disableeditsection=1&origin=*`
    const htmlRes = await fetchWithTimeout(htmlUrl)
    if (htmlRes.ok) {
      const htmlJson = (await htmlRes.json()) as {
        parse?: { text?: { '*'?: string } }
      }
      const html = htmlJson.parse?.text?.['*'] ?? ''
      author = extractAuthorFromHeader(html)
    }
  } catch {
    // 저자 추출 실패는 fallback 사용
  }

  const out: WikisourceMeta = { title: first.title, pageId: first.pageid }
  if (author) out.author = author
  return out
}

/**
 * Wikisource header template 의 저자 추출.
 * 일반 패턴: `<td>...Author:...</td><td><a href="/wiki/Author:Jane_Austen">Jane Austen</a></td>`
 * 또는 `class="ws-author"` 마커.
 */
function extractAuthorFromHeader(html: string): string | undefined {
  // 1) "ws-author" 클래스 / Author: 라벨 다음 <a> 텍스트
  const wsAuthor = html.match(
    /class="[^"]*ws-author[^"]*"[^>]*>\s*(?:<[^>]+>\s*)*([^<\n]+?)\s*</i,
  )
  if (wsAuthor?.[1]) return decodeEntities(wsAuthor[1].trim())

  // 2) Author: 링크 패턴 — <a href="/wiki/Author:Name">Name</a>
  const authorLink = html.match(
    /<a[^>]+href="\/wiki\/Author:[^"]+"[^>]*>([^<]+)<\/a>/,
  )
  if (authorLink?.[1]) return decodeEntities(authorLink[1].trim())

  // 3) header table 의 "Author" 라벨 다음 셀 텍스트
  const labelCell = html.match(
    /<t[hd][^>]*>\s*Author\s*<\/t[hd]>\s*<t[hd][^>]*>\s*(?:<[^>]+>\s*)*([^<]+)/i,
  )
  if (labelCell?.[1]) return decodeEntities(labelCell[1].trim())

  return undefined
}

/**
 * MediaWiki page text 가져오기 (HTML → plain text 변환).
 * `action=parse&prop=text` 의 HTML 을 간단히 stripping.
 */
async function fetchPagePlainText(title: string): Promise<string | null> {
  const url = `${WS_API}?action=parse&format=json&page=${encodeURIComponent(title)}&prop=text&disablelimitreport=1&disableeditsection=1&disabletoc=1&origin=*`
  const res = await fetchWithTimeout(url)
  if (!res.ok) return null
  const json = (await res.json()) as {
    parse?: { text?: { '*'?: string } }
    error?: { code?: string }
  }
  if (json.error || !json.parse?.text?.['*']) return null
  return htmlToPlainText(json.parse.text['*'])
}

/**
 * sub-page 목록: `Title/` prefix 로 시작하는 모든 페이지.
 * Wikisource 는 namespace 0 (main) 에 작품 본문이 있음.
 */
async function listSubpages(rootTitle: string): Promise<string[]> {
  const prefix = `${rootTitle}/`
  const url = `${WS_API}?action=query&format=json&list=allpages&apprefix=${encodeURIComponent(prefix)}&apnamespace=0&aplimit=${MAX_SUBPAGES}&origin=*`
  const res = await fetchWithTimeout(url)
  if (!res.ok) return []
  const json = (await res.json()) as {
    query?: { allpages?: Array<{ title?: string }> }
  }
  return (json.query?.allpages ?? [])
    .map((p) => p.title)
    .filter((t): t is string => typeof t === 'string')
    .sort(naturalChapterSort) // 'Chapter 2' 가 'Chapter 10' 보다 앞에 오도록
}

/**
 * MediaWiki HTML → plain text.
 * - <script>, <style>, .navigation, .infobox, .reference 등 제거
 * - <p>/<br> → 줄바꿈
 * - 나머지 태그 strip
 * 외부 의존성 0.
 */
function htmlToPlainText(html: string): string {
  let s = html
  // 제거 대상 블록 (편집 메타 / 네비게이션 / 참조 / Wikisource header / pagenum)
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(
    /<(?:div|table)[^>]*class="[^"]*(?:navigation|infobox|metadata|reference|toc|navbox|noprint|mw-editsection|sister-project|mw-jump-link|ws-noexport|wst-header|headertemplate|pagenumbers|pagelist|notice|noinclude)[^"]*"[^>]*>[\s\S]*?<\/(?:div|table)>/gi,
    '',
  )
  s = s.replace(/<sup[^>]*class="[^"]*reference[^"]*"[^>]*>[\s\S]*?<\/sup>/gi, '')
  // 페이지 번호 마커 (Wikisource 특유 — page transclusion 잔재)
  s = s.replace(/<span[^>]*class="[^"]*pagenum[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
  // 줄바꿈 변환
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/(?:p|h[1-6]|li|tr|div)>/gi, '\n')
  s = s.replace(/<h([1-6])[^>]*>/gi, '\n\n')
  // 나머지 태그 strip
  s = s.replace(/<[^>]+>/g, '')
  // HTML entities
  s = decodeEntities(s)
  // 공백 정리
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return s
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

function stripPrefix(title: string, prefix: string): string {
  if (title.startsWith(`${prefix}/`)) return title.slice(prefix.length + 1).replace(/_/g, ' ')
  return title.replace(/_/g, ' ')
}

/**
 * 'Chapter 2' < 'Chapter 10' 이 되도록 숫자 단위 자연 정렬.
 * Wikisource 챕터 페이지는 'Title/Chapter 1', 'Title/Chapter 10' 형식이라
 * 알파벳 정렬 시 1, 10, 11, 2 순서가 됨 — 자연 정렬 필요.
 */
function naturalChapterSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    })
  } finally {
    clearTimeout(timer)
  }
}
