// packages/library-pipeline/src/ingest/pressbooks.ts
// LCP T-2 (α) — Pressbooks OA book ingester. OBP 동결 해제 retarget.
//
// 배경: OBP(Open Book Publishers) 는 챕터 전문(全文)이 PDF-only 다 (챕터 페이지는
//   Next.js 클라이언트 렌더 + __NEXT_DATA__ 에 메타·PDF URL 만 · prose 없음 — P0/재정찰 실측).
//   PDF 파서는 dependency-0 원칙 위반이라 OBP-proper 는 동결 유지. 대신 **Pressbooks**
//   (opentextbc.ca 등 OA book 표준 플랫폼) 는 챕터별 서버렌더 HTML(CC-BY 다수) 을 제공 →
//   Standard Ebooks 와 동일하게 EPUB/PDF 파싱 없이 의존성 0 으로 RawBook 추출 가능.
//   OBP 가 겨냥한 니치(현대 OA 논픽션·학술 산문) 를 발행 가능(CC-BY) 콘텐츠로 채운다.
//
// URL 패턴 (Pressbooks 공통):
//   book:    https://<host>/<book-slug>/
//   chapter: https://<host>/<book-slug>/chapter/<chapter-slug>/
//   메타:    <meta name="citation_title|citation_author"> · 라이선스: creativecommons.org/licenses/<code>/<ver>
//   본문:    <div class="… hentry"> 내부 (theme 별 entry-content 없음 → hentry 슬라이스)
//
// source_id 형식: "<host>/<book-slug>" (예: "opentextbc.ca/introductiontosociology2ndedition")
//   host 는 알려진 OA Pressbooks 네트워크 allowlist 로 제한 (URL 주입 방지).

import type { RawBook } from '../types'
import { CHAPTER_HREF_SEP } from '../segment/segment'

const USER_AGENT = 'Vocaflow-LCP/2.0 (research)'

// 알려진 OA Pressbooks 네트워크 (SSRF/URL 주입 방지 allowlist). 확장 시 여기에 추가.
const ALLOWED_HOST =
  /^(?:[a-z0-9-]+\.)*(?:opentextbc\.ca|pressbooks\.pub|bccampus\.ca|ecampusontario\.ca)$/

interface PBMeta {
  title: string
  author?: string
  license: string
}

/**
 * Pressbooks source_id 로 raw 본문(모든 챕터 결합) + 메타 가져오기.
 * Rate limit: 호출자 책임 (챕터당 1 fetch — 도서 20~40 요청 발생 가능).
 *
 * @param sourceId "<host>/<book-slug>" 예: 'opentextbc.ca/introductiontosociology2ndedition'
 * @param maxChapters 0=무제한(기본). 미리보기/검증 시 상한.
 * @returns RawBook (Stage S3 NORMALIZE 입력) — raw_content 는 "CHAPTER N. 제목<HREF>url" 마커로 구분.
 */
export async function ingestFromPressbooks(sourceId: string, maxChapters = 0): Promise<RawBook> {
  const m = sourceId.match(/^([a-z0-9.-]+)\/([a-z0-9-]+)$/)
  if (!m) {
    throw new Error(`Invalid Pressbooks source_id: ${sourceId} (expected "<host>/<book-slug>")`)
  }
  const host = m[1]!
  const slug = m[2]!
  if (host.includes('..') || !ALLOWED_HOST.test(host)) {
    throw new Error(`Pressbooks host not in OA allowlist: ${host}`)
  }

  const bookUrl = `https://${host}/${slug}/`

  // 1. book landing → title / author / license / TOC(챕터 URL 순서대로)
  const res = await fetch(bookUrl, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) {
    throw new Error(`Pressbooks book fetch failed: ${res.status} ${bookUrl}`)
  }
  const bookHtml = await res.text()
  const meta = parseBookMeta(bookHtml)
  const chapterUrls = parseTocChapterUrls(bookHtml, host, slug)
  if (chapterUrls.length === 0) {
    throw new Error(`Pressbooks: TOC 에서 챕터 URL 미검출 (${bookUrl})`)
  }

  // 2. 각 챕터 fetch → prose + 제목. 파트 간지/프로즈 없는 페이지는 skip(best-effort).
  const limited = maxChapters > 0 ? chapterUrls.slice(0, maxChapters) : chapterUrls
  const parts: string[] = []
  let seq = 0
  for (const url of limited) {
    let chHtml: string
    try {
      const chRes = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
      if (!chRes.ok) continue
      chHtml = await chRes.text()
    } catch {
      continue // 네트워크 오류 챕터 skip (비치명적)
    }
    const { title, prose } = extractChapter(chHtml)
    if (prose.trim().length < 200) continue // 간지/목차 페이지 — 실질 프로즈 없음
    seq++
    const marker = `\n\n\nCHAPTER ${seq}. ${title}${CHAPTER_HREF_SEP}${url}\n\n`
    parts.push(marker + prose)
  }
  if (seq === 0) {
    throw new Error(`Pressbooks: 추출 가능한 챕터 프로즈 0 (${bookUrl})`)
  }

  return {
    source: 'pressbooks',
    source_id: sourceId,
    source_url: bookUrl,
    title: meta.title,
    ...(meta.author !== undefined && { author: meta.author }),
    language: 'en',
    license: meta.license,
    raw_content: parts.join('\n'),
    fetched_at: new Date(),
  }
}

/** book landing HTML → title / author / license 파싱 (citation_* 메타 + CC 링크). */
function parseBookMeta(html: string): PBMeta {
  const metaContent = (name: string): string | undefined =>
    html.match(new RegExp(`<meta[^>]*name="${name}"[^>]*content="([^"]+)"`, 'i'))?.[1]?.trim()

  const title =
    metaContent('citation_title') ??
    html.match(/<title>([^<]+?)(?:\s*[-–—|]\s*[^<]*)?<\/title>/i)?.[1]?.trim()
  if (!title) {
    throw new Error('Pressbooks meta: title not found')
  }

  // citation_author 는 저자 수만큼 반복될 수 있음 → 전부 수집 후 ', ' 결합.
  const authors: string[] = []
  for (const am of html.matchAll(/<meta[^>]*name="citation_author"[^>]*content="([^"]+)"/gi)) {
    const a = am[1]!.trim()
    if (a && !authors.includes(a)) authors.push(a)
  }
  const author = authors.length > 0 ? authors.join(', ') : undefined

  // 라이선스: creativecommons.org/licenses/<code>/<ver> → "CC BY 4.0" 형태로 정규화.
  //   code(by, by-sa, by-nc, by-nc-nd …) 대문자화. copyright gate/license_class 가 이 문자열 판정.
  const cc = html.match(/creativecommons\.org\/licenses\/([a-z-]+)\/([0-9.]+)/i)
  const license = cc
    ? `CC ${cc[1]!.toUpperCase().replace(/-/g, '-')} ${cc[2]}`
    : 'Unknown (Pressbooks OA)'

  return {
    title: decodeEntities(title),
    ...(author !== undefined && { author: decodeEntities(author) }),
    license,
  }
}

/**
 * book landing HTML → TOC 챕터 URL(문서 순서, 중복 제거).
 * 절대(https://host/slug/chapter/…) · 루트상대(/slug/chapter/…) href 모두 수용.
 */
function parseTocChapterUrls(html: string, host: string, slug: string): string[] {
  const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    `href="(?:https://${esc(host)})?/${esc(slug)}/chapter/([a-z0-9-]+)/"`,
    'gi',
  )
  const seen = new Set<string>()
  const urls: string[] = []
  for (const m of html.matchAll(re)) {
    const chSlug = m[1]!
    if (seen.has(chSlug)) continue
    seen.add(chSlug)
    urls.push(`https://${host}/${slug}/chapter/${chSlug}/`)
  }
  return urls
}

/** chapter HTML → { title, prose }. hentry div 슬라이스 후 산문화. */
function extractChapter(html: string): { title: string; prose: string } {
  // 제목: <h1 class="entry-title">…</h1> (reading-header__title 은 도서 제목 — 제외).
  const titleRaw =
    html.match(/<h1[^>]*class="[^"]*\bentry-title\b[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? ''
  const title = decodeEntities(titleRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())

  // 본문: hentry 챕터 컨테이너 내부만 슬라이스 (reading-nav·promo 등 형제 boilerplate 배제).
  //   Pressbooks Book 테마는 <section … class="… hentry">, 타 테마는 div/article 가능 → 태그 후보 다중.
  let inner = sliceElementByClass(html, /\bhentry\b/) ?? html
  // 챕터 제목 h1(entry-title)은 마커에 이미 실었으므로 프로즈에서 중복 제거.
  inner = inner.replace(/<h1[^>]*class="[^"]*\bentry-title\b[^"]*"[^>]*>[\s\S]*?<\/h1>/i, '')
  const prose = htmlToPlainText(inner)
  return { title, prose }
}

/**
 * class 정규식에 매칭되는 첫 요소(section/article/div 순)의 inner HTML 을 깊이 추적으로 슬라이스.
 * 같은 태그 중첩에서도 매칭 close 를 정확히 찾는다 (단순 치환 불가). 미검출 시 null.
 */
function sliceElementByClass(html: string, classRe: RegExp): string | null {
  for (const tag of ['section', 'article', 'div']) {
    const openRe = new RegExp(`<${tag}\\b([^>]*)>`, 'gi')
    let m: RegExpExecArray | null
    while ((m = openRe.exec(html)) !== null) {
      const cls = m[1]!.match(/\bclass="([^"]*)"/i)?.[1] ?? ''
      if (!classRe.test(cls)) continue
      const start = openRe.lastIndex
      const walk = new RegExp(`<${tag}\\b[^>]*>|<\\/${tag}\\s*>`, 'gi')
      walk.lastIndex = start
      let depth = 1
      let w: RegExpExecArray | null
      while ((w = walk.exec(html)) !== null) {
        if (w[0].startsWith('</')) {
          depth--
          if (depth === 0) return html.slice(start, w.index)
        } else {
          depth++
        }
      }
      return html.slice(start) // close 누락 — 끝까지
    }
  }
  return null
}

/** Pressbooks 챕터 inner HTML → plain text (boilerplate·figure 제거, block 줄바꿈). */
function htmlToPlainText(html: string): string {
  let work = html
  // boilerplate 컨테이너 제거
  work = work.replace(/<(nav|footer|script|style|aside|form|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  // figure(이미지+캡션) 제거 — 학습 프로즈 아님
  work = work.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi, '\n')
  // heading → 줄바꿈 + 텍스트 (segmenter 오검출 방지 위해 챕터 마커는 상위에서 부여)
  work = work.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, '\n\n$2\n\n')
  // block-level 종료 → 줄바꿈
  work = work.replace(/<\/(p|div|li|blockquote|tr|figcaption)>/gi, '\n')
  work = work.replace(/<br\s*\/?>/gi, '\n')
  // 남은 태그 strip
  work = work.replace(/<[^>]+>/g, '')
  work = decodeEntities(work)
  // whitespace 정규화
  work = work.replace(/[ \t]+/g, ' ')
  work = work.replace(/\n{3,}/g, '\n\n')
  work = work.replace(/^[ \t]+|[ \t]+$/gm, '')
  return work.trim()
}

/** 최소 HTML entity 디코딩 (standard-ebooks 와 동일 세트). */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&hellip;/g, '…')
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rdquo;/g, '”')
    .replace(/&ldquo;/g, '“')
}
