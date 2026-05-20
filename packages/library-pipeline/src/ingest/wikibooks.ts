// packages/library-pipeline/src/ingest/wikibooks.ts
// LCP v2.0 — Wikibooks ingester
//
// Wikibooks 는 협업 위키 책 (CC-BY-SA 3.0). Gutenberg/SE 와 달리:
//   - 단일 저자 없음 → author='Wikibooks contributors', author_*_year=undefined
//   - 라이선스: CC-BY-SA-3.0 (저작자 표시 필수 — source_url 보존)
//   - 책 1권 = 상위 페이지 + sub-page 트리 (sub-page 자동 수집)
//
// source_id 형식:
//   "English_in_Use"                — 단일/상위 페이지 (sub-page 자동 수집)
//   "English_in_Use/Adjectives"     — 단일 sub-page 만 (재귀 안함)
//
// 호출 패턴:
//   const raw = await ingestFromWikibooks('English_in_Use')

import type { RawBook } from '../types'

const WB_API = 'https://en.wikibooks.org/w/api.php'
const WB_PAGE_URL = (title: string): string =>
  `https://en.wikibooks.org/wiki/${title}`
const USER_AGENT = 'Vocaflow-LCP/2.0 (research; https://vocaflow.app)'

const MAX_SUBPAGES = 50 // 안전 상한
const FETCH_TIMEOUT_MS = 15_000

/**
 * Wikibooks page title 로 raw 본문 + 메타 가져오기.
 * - source_id 가 '/' 포함 → sub-page 단독 fetch
 * - source_id 가 '/' 미포함 → 상위 페이지 + sub-page 트리 수집 후 합본
 *
 * @param pageTitle Wikibooks page title (공백 → _, URL 인코딩 X)
 * @returns RawBook (Stage S3 NORMALIZE 입력)
 */
export async function ingestFromWikibooks(pageTitle: string): Promise<RawBook> {
  const normalized = pageTitle.trim().replace(/\s+/g, '_')
  if (!/^[A-Za-z0-9_/().,:'\-]+$/.test(normalized)) {
    throw new Error(`Invalid Wikibooks page title: ${pageTitle}`)
  }

  const isSubpage = normalized.includes('/')
  const rootTitle = isSubpage ? normalized : normalized

  // 1. 상위 페이지 메타 (책 제목)
  const meta = await fetchWikibooksMeta(rootTitle)
  if (!meta) {
    throw new Error(`Wikibooks page not found: ${rootTitle}`)
  }

  // 2. 본문 수집
  const pages: { title: string; content: string }[] = []
  if (isSubpage) {
    const text = await fetchPagePlainText(normalized)
    if (text) pages.push({ title: stripPrefix(normalized, rootTitle), content: text })
  } else {
    // 상위 페이지 본문
    const rootText = await fetchPagePlainText(normalized)
    if (rootText) pages.push({ title: 'Introduction', content: rootText })

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
        console.warn(`[wikibooks] sub-page failed: ${sub}`, err)
      }
    }
  }

  if (pages.length === 0) {
    throw new Error(`Wikibooks ingest empty: ${normalized}`)
  }

  // 3. 합본 — Gutenberg/SE 단일 텍스트 모델과 호환되도록 chapter 헤더로 join
  //    segment-book 의 정규식 분리기가 "Chapter N" 패턴으로 분할.
  const joined = pages
    .map((p, i) => `\n\n\nChapter ${i + 1}. ${p.title}\n\n${p.content.trim()}`)
    .join('\n\n')

  return {
    source: 'wikibooks',
    source_id: normalized,
    source_url: WB_PAGE_URL(normalized),
    title: meta.title,
    author: 'Wikibooks contributors',
    // author_*_year 미설정 — copyright_safe_in_kr 트리거는 70년 사후 룰만 사용하므로
    //   wikibooks 행은 기본적으로 kr_safe=false. 사용자가 publish 하려면 별도 정책 필요
    //   (CC-BY-SA 라 사실상 KR 안전 — 별도 마이그레이션으로 source 인지 룰 추가 권장).
    language: 'en',
    license: 'CC-BY-SA-3.0',
    raw_content: joined,
    fetched_at: new Date(),
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

interface WikibooksMeta {
  title: string
  pageId: number
}

async function fetchWikibooksMeta(title: string): Promise<WikibooksMeta | null> {
  const url = `${WB_API}?action=query&format=json&prop=info&titles=${encodeURIComponent(title)}&origin=*`
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`Wikibooks meta fetch failed: ${res.status}`)
  const json = (await res.json()) as {
    query?: { pages?: Record<string, { pageid?: number; title?: string; missing?: '' }> }
  }
  const pages = json.query?.pages ?? {}
  const first = Object.values(pages)[0]
  if (!first || first.missing !== undefined || !first.pageid || !first.title) return null
  return { title: first.title, pageId: first.pageid }
}

/**
 * MediaWiki page text 가져오기 (HTML → plain text 변환).
 * `action=parse&prop=text` 의 HTML 을 간단히 stripping.
 */
async function fetchPagePlainText(title: string): Promise<string | null> {
  const url = `${WB_API}?action=parse&format=json&page=${encodeURIComponent(title)}&prop=text&disablelimitreport=1&disableeditsection=1&disabletoc=1&origin=*`
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
 */
async function listSubpages(rootTitle: string): Promise<string[]> {
  const prefix = `${rootTitle}/`
  const url = `${WB_API}?action=query&format=json&list=allpages&apprefix=${encodeURIComponent(prefix)}&apnamespace=0&aplimit=${MAX_SUBPAGES}&origin=*`
  const res = await fetchWithTimeout(url)
  if (!res.ok) return []
  const json = (await res.json()) as {
    query?: { allpages?: Array<{ title?: string }> }
  }
  return (json.query?.allpages ?? [])
    .map((p) => p.title)
    .filter((t): t is string => typeof t === 'string')
    .sort() // 알파벳 정렬 — chapter 순서 안정성
}

/**
 * MediaWiki HTML → plain text.
 * - <script>, <style>, .navigation, .infobox, .reference 등 제거
 * - <p>/<br> → 줄바꿈
 * - 나머지 태그 strip
 * 외부 의존성 0 (cheerio/jsdom 미사용 — 디스크 절약).
 */
function htmlToPlainText(html: string): string {
  let s = html
  // 제거 대상 블록 (편집 메타 / 네비게이션 / 참조)
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(
    /<(?:div|table)[^>]*class="[^"]*(?:navigation|infobox|metadata|reference|toc|navbox|noprint|mw-editsection|sister-project|mw-jump-link)[^"]*"[^>]*>[\s\S]*?<\/(?:div|table)>/gi,
    '',
  )
  s = s.replace(/<sup[^>]*class="[^"]*reference[^"]*"[^>]*>[\s\S]*?<\/sup>/gi, '')
  // 줄바꿈 변환
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/(?:p|h[1-6]|li|tr|div)>/gi, '\n')
  s = s.replace(/<h([1-6])[^>]*>/gi, '\n\n')
  // 나머지 태그 strip
  s = s.replace(/<[^>]+>/g, '')
  // HTML entities
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
  // 공백 정리
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return s
}

function stripPrefix(title: string, prefix: string): string {
  if (title.startsWith(`${prefix}/`)) return title.slice(prefix.length + 1).replace(/_/g, ' ')
  return title.replace(/_/g, ' ')
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
